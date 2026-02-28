import { Router } from "express";
import { docker, log } from "../shared.js";
import { asyncHandler } from "../utils.js";
import { getS3Config, restoreVolumeBackup, deleteVolumeBackup } from "../backup.js";

const router = Router();

// GET /api/volumes
router.get("/api/volumes", async (req, res) => {
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
    const browsedVolumes = new Set();
    const usedVolumeNames = new Set();
    containers.forEach(c => {
      if (c.Labels?.["yantr.volume-browser"]) browsedVolumes.add(c.Labels["yantr.volume-browser"]);
      (c.Mounts || []).forEach(m => { if (m.Type === "volume" && m.Name) usedVolumeNames.add(m.Name); });
    });

    const enrichedVolumes = volumeList.map(vol => {
      const sizeBytes = volumeSizes[vol.Name] || 0;
      return { name: vol.Name, driver: vol.Driver, mountpoint: vol.Mountpoint, createdAt: vol.CreatedAt, labels: vol.Labels || {}, isBrowsing: browsedVolumes.has(vol.Name), isUsed: usedVolumeNames.has(vol.Name), size: (sizeBytes / (1024 * 1024)).toFixed(2), sizeBytes };
    });

    const usedVolumes = enrichedVolumes.filter(v => v.isUsed).sort((a, b) => b.sizeBytes - a.sizeBytes);
    const unusedVolumes = enrichedVolumes.filter(v => !v.isUsed).sort((a, b) => b.sizeBytes - a.sizeBytes);
    const totalSize = enrichedVolumes.reduce((s, v) => s + v.sizeBytes, 0);
    const unusedSize = unusedVolumes.reduce((s, v) => s + v.sizeBytes, 0);

    res.json({ success: true, total: enrichedVolumes.length, used: usedVolumes.length, unused: unusedVolumes.length, totalSize: (totalSize / (1024 * 1024)).toFixed(2), unusedSize: (unusedSize / (1024 * 1024)).toFixed(2), volumes: enrichedVolumes, usedVolumes, unusedVolumes });
  } catch (error) {
    log("error", "❌ [GET /api/volumes] Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/volumes/:name/browse
router.post("/api/volumes/:name/browse", async (req, res) => {
  const volumeName = req.params.name;
  const expiryMinutes = parseInt(req.body?.expiryMinutes) || 0;
  log("info", `🔍 [POST /api/volumes/${volumeName}/browse] Starting volume browser`);

  try {
    const volumes = await docker.listVolumes();
    if (!volumes.Volumes?.find(v => v.Name === volumeName)) {
      return res.status(404).json({ success: false, error: "Volume not found" });
    }

    const containers = await docker.listContainers({ all: true });
    const existingBrowser = containers.find(c => c.Labels?.["yantr.volume-browser"] === volumeName);
    if (existingBrowser) {
      const container = docker.getContainer(existingBrowser.Id);
      const inspect = await container.inspect();
      if (inspect.State.Status !== "running") await container.start();
      const port = inspect.NetworkSettings.Ports["5000/tcp"]?.[0]?.HostPort;
      return res.json({ success: true, port: port ? parseInt(port) : null, containerId: existingBrowser.Id, message: "Browser container already exists and is now running" });
    }

    const imageName = "sigoden/dufs:latest";
    try { await docker.getImage(imageName).inspect(); }
    catch {
      log("info", `📥 Pulling ${imageName}...`);
      await new Promise((resolve, reject) => {
        docker.pull(imageName, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err, output) => err ? reject(err) : resolve(output));
        });
      });
    }

    const labels = { "yantr.volume-browser": volumeName, "yantr.managed": "true" };
    if (expiryMinutes > 0) labels["yantr.expireAt"] = String(Math.floor(Date.now() / 1000) + expiryMinutes * 60);

    const container = await docker.createContainer({
      Image: imageName,
      name: `yantr-v-${volumeName}`,
      Cmd: ["/data", "--enable-cors", "--allow-all"],
      Labels: labels,
      HostConfig: { Binds: [`${volumeName}:/data`], PortBindings: { "5000/tcp": [{ HostPort: "" }] }, RestartPolicy: { Name: "no" } },
      ExposedPorts: { "5000/tcp": {} },
    });
    await container.start();
    const inspect = await container.inspect();
    const port = inspect.NetworkSettings.Ports["5000/tcp"]?.[0]?.HostPort;
    res.json({ success: true, port: port ? parseInt(port) : null, containerId: container.id, message: "Volume browser started successfully" });
  } catch (error) {
    log("error", `❌ [POST /api/volumes/${volumeName}/browse] Error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/volumes/:name/browse
router.delete("/api/volumes/:name/browse", async (req, res) => {
  const volumeName = req.params.name;
  log("info", `🛑 [DELETE /api/volumes/${volumeName}/browse] Stopping volume browser`);
  try {
    const containers = await docker.listContainers({ all: true });
    const browserContainer = containers.find(c => c.Labels?.["yantr.volume-browser"] === volumeName);
    if (!browserContainer) return res.status(404).json({ success: false, error: "No browser container found for this volume" });

    const container = docker.getContainer(browserContainer.Id);
    const inspect = await container.inspect();
    if (inspect.State.Running) await container.stop();
    await container.remove();
    res.json({ success: true, message: "Volume browser stopped and removed successfully" });
  } catch (error) {
    log("error", `❌ [DELETE /api/volumes/${volumeName}/browse] Error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/volumes/:name
router.delete("/api/volumes/:name", async (req, res) => {
  const volumeName = req.params.name;
  log("info", `🗑️  [DELETE /api/volumes/:name] Remove request for volume: ${volumeName}`);
  try {
    const volume = docker.getVolume(volumeName);
    try { await volume.inspect(); }
    catch { return res.status(404).json({ success: false, error: "Volume not found", message: `Volume '${volumeName}' does not exist` }); }
    await volume.remove();
    res.json({ success: true, message: `Volume '${volumeName}' removed successfully`, volume: volumeName });
  } catch (error) {
    const isInUseError = error.message?.includes("in use");
    res.status(500).json({ success: false, error: isInUseError ? "Volume is in use" : "Failed to remove volume", message: isInUseError ? `Volume '${volumeName}' is currently in use by a container and cannot be deleted` : error.message });
  }
});

// POST /api/volumes/:volumeName/restore
router.post("/api/volumes/:volumeName/restore", asyncHandler(async (req, res) => {
  const volumeName = req.params.volumeName;
  const { snapshotId, overwrite = true } = req.body;
  if (!snapshotId) return res.status(400).json({ success: false, error: "snapshotId is required" });

  const config = await getS3Config();
  if (!config) return res.status(400).json({ success: false, error: "S3 not configured" });

  const result = await restoreVolumeBackup(volumeName, snapshotId, config, overwrite, log);
  res.json({ success: true, ...result });
}));

// DELETE /api/volumes/:volumeName/backup/:snapshotId
router.delete("/api/volumes/:volumeName/backup/:snapshotId", asyncHandler(async (req, res) => {
  const { volumeName, snapshotId } = req.params;
  const config = await getS3Config();
  if (!config) return res.status(400).json({ success: false, error: "S3 not configured" });

  await deleteVolumeBackup(volumeName, snapshotId, config, log);
  res.json({ success: true, message: "Backup deleted successfully" });
}));

export default router;
