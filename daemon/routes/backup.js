import { log, docker } from "../shared.js";
import {
  getS3Config,
  saveS3Config,
  getSchedules,
  upsertSchedule,
  deleteSchedule,
  getBackupJobStatus,
  getRestoreJobStatus,
  listVolumeBackups,
} from "../backup.js";
import {
  applySchedule,
  removeScheduleTimer,
  runNow,
} from "../backup-scheduler.js";
import { listSnapshots, saveSchedulesToRepo, loadSchedulesFromRepo } from "../restic.js";

export default async function backupRoutes(fastify) {

// ─── S3 Config ────────────────────────────────────────────────────────────────

  // ─── S3 Config ────────────────────────────────────────────────────────────────────────────────

  // GET /api/backup/config
  fastify.get("/api/backup/config", async (request, reply) => {
    const config = await getS3Config();
    if (!config) return reply.send({ success: true, configured: false, config: null });

    const safeConfig = { ...config };
    if (safeConfig.secretKey) safeConfig.secretKey = "***";
    return reply.send({ success: true, configured: true, config: safeConfig });
  });

  // POST /api/backup/config
  fastify.post("/api/backup/config", async (request, reply) => {
    const { endpoint, accessKey, secretKey, bucket, region, provider, resticPassword } = request.body;
    if (!endpoint || !accessKey || !secretKey || !bucket) {
      return reply.code(400).send({ success: false, error: "endpoint, accessKey, secretKey, and bucket are required" });
    }

    const existing = await getS3Config();

    if (!existing && !resticPassword) {
      return reply.code(400).send({ success: false, error: "resticPassword is required when configuring backups for the first time" });
    }

    const config = {
      endpoint,
      accessKey,
      secretKey,
      bucket,
      region: region || "us-east-1",
      provider: provider || "Other",
      resticPassword: resticPassword || existing?.resticPassword || "",
    };

    await saveS3Config(config);
    log("info", "[POST /api/backup/config] Backup configuration saved");
    return reply.send({ success: true, message: "Backup configuration saved successfully" });
  });

  // ─── Job Status ───────────────────────────────────────────────────────────────────────────────

  // GET /api/backup/jobs/:jobId
  fastify.get("/api/backup/jobs/:jobId", async (request, reply) => {
    const job = getBackupJobStatus(request.params.jobId);
    if (!job) return reply.code(404).send({ success: false, error: "Job not found" });
    return reply.send({ success: true, job });
  });

  // GET /api/restore/jobs/:jobId
  fastify.get("/api/restore/jobs/:jobId", async (request, reply) => {
    const job = getRestoreJobStatus(request.params.jobId);
    if (!job) return reply.code(404).send({ success: false, error: "Job not found" });
    return reply.send({ success: true, job });
  });

  // ─── Backup Schedules ──────────────────────────────────────────────────────────────────────────────

  // GET /api/backup/schedules
  fastify.get("/api/backup/schedules", async (request, reply) => {
    const schedules = await getSchedules();
    return reply.send({ success: true, schedules });
  });

  // POST /api/backup/schedules  — create or update a schedule
  // Body: { volumeName, intervalHours, keepCount, enabled }
  fastify.post("/api/backup/schedules", async (request, reply) => {
    const { volumeName, intervalHours, keepCount, enabled = true } = request.body;

    if (!volumeName) {
      return reply.code(400).send({ success: false, error: "volumeName is required" });
    }

    const parsedInterval = parseInt(intervalHours, 10);
    const parsedKeep = parseInt(keepCount, 10);

    if (!parsedInterval || parsedInterval < 1) {
      return reply.code(400).send({ success: false, error: "intervalHours must be a positive integer" });
    }
    if (!parsedKeep || parsedKeep < 1) {
      return reply.code(400).send({ success: false, error: "keepCount must be a positive integer" });
    }

    const now = new Date();
    const nextRunAt = new Date(now.getTime() + parsedInterval * 60 * 60 * 1000).toISOString();

    const schedule = {
      volumeName,
      intervalHours: parsedInterval,
      keepCount: parsedKeep,
      enabled: Boolean(enabled),
      createdAt: now.toISOString(),
      lastRunAt: null,
      nextRunAt,
    };

    const saved = await upsertSchedule(schedule);
    await applySchedule(saved);

    getS3Config().then(async (cfg) => {
      if (cfg) await saveSchedulesToRepo(await getSchedules(), cfg, log);
    }).catch(() => {});

    log("info", `[POST /api/backup/schedules] Schedule saved for volume: ${volumeName}`);
    return reply.send({ success: true, schedule: saved });
  });

  // DELETE /api/backup/schedules/:volumeName
  fastify.delete("/api/backup/schedules/:volumeName", async (request, reply) => {
    const { volumeName } = request.params;
    await deleteSchedule(volumeName);
    removeScheduleTimer(volumeName);

    getS3Config().then(async (cfg) => {
      if (cfg) await saveSchedulesToRepo(await getSchedules(), cfg, log);
    }).catch(() => {});

    log("info", `[DELETE /api/backup/schedules] Schedule removed for volume: ${volumeName}`);
    return reply.send({ success: true, message: `Schedule for ${volumeName} removed` });
  });

  // POST /api/backup/schedules/restore-from-repo
  fastify.post("/api/backup/schedules/restore-from-repo", async (request, reply) => {
    const config = await getS3Config();
    if (!config) {
      return reply.code(400).send({ success: false, error: "S3 not configured" });
    }

    const schedules = await loadSchedulesFromRepo(config, log);
    if (!schedules || schedules.length === 0) {
      return reply.send({ success: true, imported: 0, message: "No schedules found in repository" });
    }

    for (const schedule of schedules) {
      await upsertSchedule(schedule);
      await applySchedule(schedule);
    }

    log("info", `[POST /api/backup/schedules/restore-from-repo] Imported ${schedules.length} schedule(s)`);
    return reply.send({ success: true, imported: schedules.length, schedules });
  });

  // POST /api/backup/schedules/:volumeName/run  — trigger an immediate backup
  fastify.post("/api/backup/schedules/:volumeName/run", async (request, reply) => {
    const { volumeName } = request.params;
    log("info", `[POST /api/backup/schedules/${volumeName}/run] Manual trigger`);
    runNow(volumeName).catch((err) => {
      log("error", `[Scheduler/runNow] ${volumeName}: ${err.message}`);
    });
    return reply.send({ success: true, message: `Backup triggered for ${volumeName}` });
  });

  // ─── Backed-up Volumes ─────────────────────────────────────────────────────────────────────────────

  // GET /api/backup/volumes
  fastify.get("/api/backup/volumes", async (request, reply) => {
    const config = await getS3Config();
    if (!config) return reply.send({ success: true, volumes: [] });

  // One restic call to discover all backed-up volume names
  const allSnapshots = await listSnapshots({ tag: "yantr" }, config, log);
  const volumeNames = [...new Set(
    allSnapshots
      .flatMap(s => s.tags || [])
      .filter(t => t.startsWith("vol:"))
      .map(t => t.slice(4))
  )];

  if (volumeNames.length === 0) return reply.send({ success: true, volumes: [] });

  // Fetch full snapshot details and running containers in parallel
  const [backups, runningContainers] = await Promise.all([
    listVolumeBackups(volumeNames, config, log),
    docker.listContainers({ all: false }).catch(() => []),
  ]);

  // Map volume name → first running container that mounts it
  const volumeToContainer = new Map();
  for (const c of runningContainers) {
    for (const mount of (c.Mounts || [])) {
      if (mount.Type === "volume" && !volumeToContainer.has(mount.Name)) {
        volumeToContainer.set(mount.Name, {
          id: c.Id,
          name: (c.Names?.[0] || "").replace(/^\//, ""),
        });
      }
    }
  }

  const volumes = volumeNames.map(volumeName => {
    const snaps = backups[volumeName] || [];
    return {
      volumeName,
      snapshotCount: snaps.length,
      latestAt: snaps[0]?.timestamp ?? null,
      oldestAt: snaps[snaps.length - 1]?.timestamp ?? null,
      snapshots: snaps,
      container: volumeToContainer.get(volumeName) ?? null,
    };
  });

    return reply.send({ success: true, volumes });
  });
}
