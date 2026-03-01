import {
  docker, log, logs, MAX_LOGS, packageJson,
  getPublicIpIdentityCached,
} from "../shared.js";

export default async function systemRoutes(fastify) {

  // GET /api/version
  fastify.get("/api/version", (request, reply) => {
    return reply.send({ success: true, version: packageJson.version });
  });

  // GET /api/health
  fastify.get("/api/health", (request, reply) => {
    return reply.send({ success: true, status: "ok", timestamp: new Date().toISOString(), version: packageJson.version });
  });

  // GET /api/network/identity
  fastify.get("/api/network/identity", async (request, reply) => {
    const force = String(request.query.force || "").toLowerCase() === "true";
    const identity = await getPublicIpIdentityCached({ forceRefresh: force });
    return reply.send({ success: true, identity });
  });

  // GET /api/logs
  fastify.get("/api/logs", (request, reply) => {
    const limit = parseInt(request.query.limit) || MAX_LOGS;
    const level = request.query.level;
    const filtered = level ? logs.filter(l => l.level === level) : logs;
    return reply.send({ success: true, count: filtered.length, maxLogs: MAX_LOGS, logs: filtered.slice(-limit).reverse() });
  });

  // GET /api/ports/used
  fastify.get("/api/ports/used", async (request, reply) => {
    log("info", "🔌 [GET /api/ports/used] Fetching all used ports");
    try {
      const containers = await docker.listContainers({ all: false });
      const usedPorts = new Set();
      containers.forEach(c => {
        (c.Ports || []).forEach(p => { if (p.PublicPort) usedPorts.add(p.PublicPort); });
      });
      const portArray = Array.from(usedPorts).sort((a, b) => a - b);
      return reply.send({ success: true, count: portArray.length, ports: portArray });
    } catch (error) {
      log("error", "❌ [GET /api/ports/used] Error:", error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // POST /api/ports/suggest
  fastify.post("/api/ports/suggest", async (request, reply) => {
    log("info", "💡 [POST /api/ports/suggest] Suggesting ports for app");
    try {
      const { appId, ports: appPorts } = request.body;
      if (!appId || !appPorts || !Array.isArray(appPorts)) {
        return reply.code(400).send({ success: false, error: "appId and ports array are required" });
      }

      const containers = await docker.listContainers({ all: false });
      const usedPorts = new Set();
      containers.forEach(c => (c.Ports || []).forEach(p => { if (p.PublicPort) usedPorts.add(p.PublicPort); }));

      const START_PORT = 5255;
      let currentPort = START_PORT;

      const suggestedPorts = appPorts.map(port => {
        if (!port.isNamed) return { ...port, suggestedPort: port.hostPort, isOriginal: true };
        while (usedPorts.has(currentPort)) currentPort++;
        const suggested = currentPort;
        usedPorts.add(currentPort);
        currentPort++;
        return { ...port, suggestedPort: suggested, isOriginal: false };
      });

      return reply.send({ success: true, appId, suggestions: suggestedPorts });
    } catch (error) {
      log("error", "❌ [POST /api/ports/suggest] Error:", error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // GET /api/system/info
  fastify.get("/api/system/info", async (request, reply) => {
    try {
      const info = await docker.info();
      let storageInfo = { driver: info.Driver || "unknown", total: null, used: null, available: null };
      try {
        const df = await docker.df();
        const imagesSize = df.Images?.reduce((s, i) => s + (i.Size || 0), 0) || 0;
        const containersSize = df.Containers?.reduce((s, c) => s + (c.SizeRw || 0), 0) || 0;
        const volumesSize = df.Volumes?.reduce((s, v) => s + (v.UsageData?.Size || 0), 0) || 0;
        storageInfo.used = imagesSize + containersSize + volumesSize;
        if (info.DriverStatus) {
          storageInfo.total = extractStorageInfo(info.DriverStatus, "Data Space Total");
          const driverUsed = extractStorageInfo(info.DriverStatus, "Data Space Used");
          if (driverUsed) storageInfo.used = driverUsed;
          storageInfo.available = extractStorageInfo(info.DriverStatus, "Data Space Available");
        }
      } catch {}

      return reply.send({
        success: true,
        info: {
          cpu: { cores: info.NCPU || 0 },
          memory: { total: info.MemTotal || 0 },
          storage: storageInfo,
          docker: {
            version: info.ServerVersion || "unknown",
            containers: { total: info.Containers || 0, running: info.ContainersRunning || 0, paused: info.ContainersPaused || 0, stopped: info.ContainersStopped || 0 },
            images: info.Images || 0,
          },
          os: { type: info.OSType || "unknown", name: info.OperatingSystem || "unknown", arch: info.Architecture || "unknown", kernel: info.KernelVersion || "unknown" },
          name: info.Name || "unknown",
        },
      });
    } catch (error) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

function extractStorageInfo(driverStatus, key) {
  if (!Array.isArray(driverStatus)) return null;
  const entry = driverStatus.find(([k]) => k === key);
  if (!entry || !entry[1]) return null;
  const match = entry[1].match(/([\d.]+)\s*([KMGT]?B)/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return value * (multipliers[unit] || 1);
}

  // POST /api/system/prune
  fastify.post("/api/system/prune", async (request, reply) => {
    log("info", "🧹 [POST /api/system/prune] Prune request received");
    try {
      const { images, volumes } = request.body;
      const results = {
        images: { count: 0, spaceReclaimed: 0 },
        volumes: { count: 0, spaceReclaimed: 0 },
      };

      if (images) {
        try {
          const pruned = await docker.pruneImages({ filters: { dangling: { false: true } } });
          results.images.count = pruned.ImagesDeleted?.length || 0;
          results.images.spaceReclaimed = pruned.SpaceReclaimed || 0;
        } catch (err) {
          log("error", "❌ [POST /api/system/prune] Failed to prune images:", err.message);
        }
      }

      if (volumes) {
        try {
          const volList = await docker.listVolumes();
          const allVolumes = volList.Volumes || [];
          const containers = await docker.listContainers({ all: true });
          const usedVolumeNames = new Set();
          containers.forEach(c => {
            (c.Mounts || []).forEach(m => { if (m.Type === "volume" && m.Name) usedVolumeNames.add(m.Name); });
          });
          const unusedVolumes = allVolumes.filter(v => !usedVolumeNames.has(v.Name));
          for (const vol of unusedVolumes) {
            try {
              await docker.getVolume(vol.Name).remove();
              results.volumes.count++;
            } catch (err) {
              log("warn", `⚠️ [POST /api/system/prune] Failed to remove volume ${vol.Name}: ${err.message}`);
            }
          }
        } catch (err) {
          log("error", "❌ [POST /api/system/prune] Failed to prune volumes:", err.message);
        }
      }

      return reply.send({ success: true, results });
    } catch (error) {
      log("error", "❌ [POST /api/system/prune] Error:", error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}
