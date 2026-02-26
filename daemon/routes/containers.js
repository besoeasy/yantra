import { Router } from "express";
import path from "path";
import { access } from "fs/promises";
import {
  docker, log, appsDir, socketPath,
  getAppsCatalogCached, getContainerEnv, mapWithConcurrency, parseAppLabels,
} from "../shared.js";
import { asyncHandler, spawnProcess, getBaseAppId } from "../utils.js";
import { resolveComposeCommand } from "../compose.js";
import { getS3Config, createContainerBackup, listVolumeBackups } from "../backup.js";

const router = Router();

// GET /api/containers
router.get("/api/containers", asyncHandler(async (req, res) => {
  const containers = await docker.listContainers({ all: true });
  const catalog = await getAppsCatalogCached();
  const catalogMap = new Map(catalog.apps.map(a => [a.id, a]));

  const formattedContainers = await mapWithConcurrency(containers, 8, async (container) => {
    const appLabels = parseAppLabels(container.Labels);
    const composeProject = container.Labels["com.docker.compose.project"];
    let envVars = [];
    try {
      envVars = await getContainerEnv(container.Id);
    } catch (error) {
      log("error", `Failed to get env for container ${container.Id}:`, error.message);
    }

    const baseAppId = getBaseAppId(composeProject) || container.Names[0]?.replace("/", "") || "unknown";
    const appId = appLabels.app || baseAppId;
    const catalogEntry = catalogMap.get(appId) || null;

    return {
      id: container.Id,
      name: container.Names[0]?.replace("/", "") || "unknown",
      image: container.Image,
      imageId: container.ImageID,
      state: container.State,
      status: container.Status,
      created: container.Created,
      ports: container.Ports,
      labels: container.Labels,
      appLabels,
      env: envVars,
      app: {
        id: appId,
        projectId: composeProject || container.Names[0]?.replace("/", "") || "unknown",
        service: appLabels.service || container.Names[0]?.replace("/", "") || "unknown",
        name: catalogEntry?.name || appLabels.service || container.Names[0]?.replace("/", "") || "unknown",
        logo: catalogEntry?.logo || null,
        tags: catalogEntry?.tags || [],
        ports: Array.isArray(catalogEntry?.ports) ? catalogEntry.ports : [],
        short_description: catalogEntry?.short_description || "",
        description: catalogEntry?.description || "",
        usecases: catalogEntry?.usecases || [],
        website: catalogEntry?.website || null,
      },
    };
  });

  const yantrProjects = new Set();
  formattedContainers.forEach(c => {
    const project = c.labels?.["com.docker.compose.project"];
    if (c.appLabels?.app && project) yantrProjects.add(project);
  });

  const filteredContainers = formattedContainers.filter(c => {
    const hasYantrLabel = !!(c.appLabels?.app);
    const project = c.labels?.["com.docker.compose.project"];
    const isPartOfYantrStack = project && yantrProjects.has(project);
    return hasYantrLabel || !isPartOfYantrStack;
  });

  res.json({ success: true, count: filteredContainers.length, containers: filteredContainers });
}));

// GET /api/containers/:id
router.get("/api/containers/:id", asyncHandler(async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const info = await container.inspect();
  const appLabels = parseAppLabels(info.Config.Labels);
  const composeProject = info.Config.Labels["com.docker.compose.project"];

  const catalog = await getAppsCatalogCached();
  const catalogMap = new Map(catalog.apps.map(a => [a.id, a]));
  const baseAppId = getBaseAppId(composeProject) || info.Name.replace("/", "") || "unknown";
  const appId = appLabels.app || baseAppId;
  const catalogEntry = catalogMap.get(appId) || null;
  const allPorts = info.NetworkSettings.Ports;

  res.json({
    success: true,
    container: {
      id: info.Id,
      name: info.Name.replace("/", ""),
      image: info.Config.Image,
      imageId: info.Image,
      state: info.State.Status || (info.State.Running ? "running" : "stopped"),
      stateDetails: info.State,
      created: info.Created,
      ports: allPorts,
      mounts: info.Mounts,
      env: info.Config.Env,
      labels: appLabels,
      expireAt: info.Config.Labels?.["yantr.expireAt"] || null,
      app: {
        id: appId,
        projectId: composeProject || info.Name.replace("/", "") || "unknown",
        service: appLabels.service || info.Name.replace("/", ""),
        name: catalogEntry?.name || appLabels.service || info.Name.replace("/", ""),
        logo: catalogEntry?.logo || null,
        tags: catalogEntry?.tags || [],
        ports: Array.isArray(catalogEntry?.ports) ? catalogEntry.ports : [],
        short_description: catalogEntry?.short_description || "",
        description: catalogEntry?.description || "",
        usecases: catalogEntry?.usecases || [],
        website: catalogEntry?.website || null,
      },
    },
  });
}));

// GET /api/containers/:id/stats
router.get("/api/containers/:id/stats", asyncHandler(async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const stats = await container.stats({ stream: false });

  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

  const memoryRawUsage = stats?.memory_stats?.usage || 0;
  const memoryLimit = stats?.memory_stats?.limit || 0;
  const memStats = stats?.memory_stats?.stats || {};
  const memoryCache =
    typeof memStats.inactive_file === "number" ? memStats.inactive_file
    : typeof memStats.cache === "number" ? memStats.cache
    : 0;
  const memoryUsage = Math.max(0, memoryRawUsage - memoryCache);
  const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

  let networkRx = 0, networkTx = 0;
  if (stats.networks) {
    Object.values(stats.networks).forEach(n => { networkRx += n.rx_bytes || 0; networkTx += n.tx_bytes || 0; });
  }

  let blockRead = 0, blockWrite = 0;
  if (stats.blkio_stats?.io_service_bytes_recursive) {
    stats.blkio_stats.io_service_bytes_recursive.forEach(io => {
      if (io.op === "Read") blockRead += io.value;
      if (io.op === "Write") blockWrite += io.value;
    });
  }

  res.json({
    success: true,
    stats: {
      cpu: { percent: cpuPercent.toFixed(2), usage: stats.cpu_stats.cpu_usage.total_usage },
      memory: { usage: memoryUsage, rawUsage: memoryRawUsage, cache: memoryCache, limit: memoryLimit, percent: memoryPercent.toFixed(2) },
      network: { rx: networkRx, tx: networkTx },
      blockIO: { read: blockRead, write: blockWrite },
    },
  });
}));

// GET /api/containers/:id/logs
router.get("/api/containers/:id/logs", asyncHandler(async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const tailLines = req.query.tail || 100;
  const rawLogs = await container.logs({ stdout: true, stderr: true, tail: tailLines, timestamps: true });
  const logString = rawLogs.toString("utf8");
  const lines = logString.split("\n").filter(l => l.trim()).map(l => l.substring(8));
  res.json({ success: true, logs: lines });
}));

// DELETE /api/containers/:id
router.delete("/api/containers/:id", async (req, res) => {
  log("info", `🗑️  [DELETE /api/containers/:id] Remove request for: ${req.params.id}`);
  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();
    const containerName = info.Name.replace("/", "");
    const labels = info.Config.Labels || {};
    const composeProject = labels["com.docker.compose.project"];

    if (composeProject) {
      const baseAppId = getBaseAppId(composeProject);
      const appPath = path.join(appsDir, baseAppId);
      const composePath = path.join(appPath, "compose.yml");

      try {
        await access(composePath);
        const composeCmd = await resolveComposeCommand({ socketPath });
        const { stdout, stderr, exitCode } = await spawnProcess(
          composeCmd.command,
          [...composeCmd.args, "-p", composeProject, "down"],
          { cwd: appPath, env: { ...process.env, DOCKER_HOST: `unix://${socketPath}` } }
        );
        if (exitCode !== 0) throw new Error(`docker compose down failed: ${stderr}`);
        return res.json({ success: true, message: `App stack '${composeProject}' removed successfully`, container: containerName, stackRemoved: true, volumesRemoved: [], volumesFailed: [], output: stdout });
      } catch (err) {
        log("info", `⚠️  Compose file not found at ${composePath}, falling back to single container deletion`);
      }
    }

    const volumeNames = info.Mounts.filter(m => m.Type === "volume").map(m => m.Name);
    if (info.State.Running) await container.stop();
    await container.remove();

    res.json({ success: true, message: `Container '${containerName}' removed successfully`, container: containerName, volumesPreserved: volumeNames });
  } catch (error) {
    log("error", `❌ [DELETE /api/containers/:id] Error:`, error.message);
    res.status(500).json({ success: false, error: "Failed to remove container", message: error.message });
  }
});

// POST /api/containers/:id/backup
router.post("/api/containers/:id/backup", asyncHandler(async (req, res) => {
  const containerId = req.params.id;
  log("info", `💾 [POST /api/containers/${containerId}/backup] Creating backup`);

  const containerInfo = await docker.getContainer(containerId).inspect();
  const volumes = containerInfo.Mounts.filter(m => m.Type === "volume").map(m => m.Name);

  if (volumes.length === 0) {
    return res.status(400).json({ success: false, error: "No volumes attached to this container" });
  }

  const config = await getS3Config();
  if (!config) {
    return res.status(400).json({ success: false, error: "S3 not configured. Please configure S3 settings first." });
  }

  const result = await createContainerBackup({ containerId, volumes, s3Config: config, log });
  res.json({ success: true, ...result, volumes });
}));

// GET /api/containers/:id/backups
router.get("/api/containers/:id/backups", asyncHandler(async (req, res) => {
  const containerId = req.params.id;
  const containerInfo = await docker.getContainer(containerId).inspect();
  const volumeNames = containerInfo.Mounts.filter(m => m.Type === "volume").map(m => m.Name);

  if (volumeNames.length === 0) return res.json({ success: true, backups: {} });

  const config = await getS3Config();
  if (!config) return res.json({ success: true, backups: {}, configured: false });

  const backups = await listVolumeBackups(volumeNames, config, log);
  res.json({ success: true, backups, configured: true });
}));

export default router;
