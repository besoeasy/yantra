import { docker, log } from "../shared.js";
import http from "node:http";
import { startBrowser, stopBrowser, isBrowsing, getBrowserPort, listBrowsers } from "../dufs.js";
import { getS3Config, restoreVolumeBackup, deleteVolumeBackup } from "../backup.js";

export default async function volumesRoutes(fastify) {

  // GET /api/volumes
  fastify.get("/api/volumes", async (request, reply) => {
    try {
      const volumes = await docker.listVolumes();
      const volumeList = volumes.Volumes || [];

      let volumeSizes = {};
      try {
        const dfData = await docker.df();
        if (dfData.Volumes) {
          dfData.Volumes.forEach(vol => {
            if (vol.Name && vol.UsageData?.Size !== undefined) volumeSizes[vol.Name] = vol.UsageData.Size;
          });
        }
      } catch (dfError) {
        log("warn", "⚠️  [GET /api/volumes] Could not get volume sizes:", dfError.message);
      }

      const containers = await docker.listContainers({ all: true });
      const usedVolumeNames = new Set();
      containers.forEach(c => {
        (c.Mounts || []).forEach(m => { if (m.Type === "volume" && m.Name) usedVolumeNames.add(m.Name); });
      });

      const enrichedVolumes = volumeList.map(vol => {
        const sizeBytes = volumeSizes[vol.Name] || 0;
        return { name: vol.Name, driver: vol.Driver, mountpoint: vol.Mountpoint, createdAt: vol.CreatedAt, labels: vol.Labels || {}, isBrowsing: isBrowsing(vol.Name), isUsed: usedVolumeNames.has(vol.Name), size: (sizeBytes / (1024 * 1024)).toFixed(2), sizeBytes };
      });

      const usedVolumes = enrichedVolumes.filter(v => v.isUsed).sort((a, b) => b.sizeBytes - a.sizeBytes);
      const unusedVolumes = enrichedVolumes.filter(v => !v.isUsed).sort((a, b) => b.sizeBytes - a.sizeBytes);
      const totalSize = enrichedVolumes.reduce((s, v) => s + v.sizeBytes, 0);
      const unusedSize = unusedVolumes.reduce((s, v) => s + v.sizeBytes, 0);

      return reply.send({ success: true, total: enrichedVolumes.length, used: usedVolumes.length, unused: unusedVolumes.length, totalSize: (totalSize / (1024 * 1024)).toFixed(2), unusedSize: (unusedSize / (1024 * 1024)).toFixed(2), volumes: enrichedVolumes, usedVolumes, unusedVolumes });
    } catch (error) {
      log("error", "❌ [GET /api/volumes] Error:", error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // GET /api/volumes/browsers
  fastify.get("/api/volumes/browsers", async (request, reply) => {
    return reply.send(listBrowsers());
  });

  // POST /api/volumes/:name/browse
  fastify.post("/api/volumes/:name/browse", async (request, reply) => {
    const volumeName = request.params.name;
    const expiryMinutes = parseInt(request.body?.expiryMinutes) || 0;
    log("info", `🔍 [POST /api/volumes/${volumeName}/browse] Starting volume browser`);

    try {
      const volumes = await docker.listVolumes();
      if (!volumes.Volumes?.find(v => v.Name === volumeName)) {
        return reply.code(404).send({ success: false, error: "Volume not found" });
      }

      const port = await startBrowser(volumeName, expiryMinutes);
      return reply.send({ success: true, port, message: "Volume browser started successfully" });
    } catch (error) {
      log("error", `❌ [POST /api/volumes/${volumeName}/browse] Error:`, error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // DELETE /api/volumes/:name/browse
  fastify.delete("/api/volumes/:name/browse", async (request, reply) => {
    const volumeName = request.params.name;
    log("info", `🛑 [DELETE /api/volumes/${volumeName}/browse] Stopping volume browser`);
    try {
      const stopped = stopBrowser(volumeName);
      if (!stopped) return reply.code(404).send({ success: false, error: "No active browser for this volume" });
      return reply.send({ success: true, message: "Volume browser stopped" });
    } catch (error) {
      log("error", `❌ [DELETE /api/volumes/${volumeName}/browse] Error:`, error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // DELETE /api/volumes/:name
  fastify.delete("/api/volumes/:name", async (request, reply) => {
    const volumeName = request.params.name;
    log("info", `🗑️  [DELETE /api/volumes/:name] Remove request for volume: ${volumeName}`);
    try {
      const volume = docker.getVolume(volumeName);
      try { await volume.inspect(); }
      catch { return reply.code(404).send({ success: false, error: "Volume not found", message: `Volume '${volumeName}' does not exist` }); }
      await volume.remove();
      return reply.send({ success: true, message: `Volume '${volumeName}' removed successfully`, volume: volumeName });
    } catch (error) {
      const isInUseError = error.message?.includes("in use");
      return reply.code(500).send({ success: false, error: isInUseError ? "Volume is in use" : "Failed to remove volume", message: isInUseError ? `Volume '${volumeName}' is currently in use by a container and cannot be deleted` : error.message });
    }
  });

  // POST /api/volumes/:volumeName/restore
  fastify.post("/api/volumes/:volumeName/restore", async (request, reply) => {
    const volumeName = request.params.volumeName;
    const { snapshotId, overwrite = true } = request.body;
    if (!snapshotId) return reply.code(400).send({ success: false, error: "snapshotId is required" });

    const config = await getS3Config();
    if (!config) return reply.code(400).send({ success: false, error: "S3 not configured" });

    const result = await restoreVolumeBackup(volumeName, snapshotId, config, overwrite, log);
    return reply.send({ success: true, ...result });
  });

  // DELETE /api/volumes/:volumeName/backup/:snapshotId
  fastify.delete("/api/volumes/:volumeName/backup/:snapshotId", async (request, reply) => {
    const { volumeName, snapshotId } = request.params;
    const config = await getS3Config();
    if (!config) return reply.code(400).send({ success: false, error: "S3 not configured" });

    await deleteVolumeBackup(volumeName, snapshotId, config, log);
    return reply.send({ success: true, message: "Backup deleted successfully" });
  });
}
