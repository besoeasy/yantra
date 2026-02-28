import { Router } from "express";
import { log } from "../shared.js";
import { asyncHandler } from "../utils.js";
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
import { listSnapshots } from "../restic.js";
import { docker } from "../shared.js";

const router = Router();

// ─── S3 Config ────────────────────────────────────────────────────────────────

// GET /api/backup/config
router.get("/api/backup/config", asyncHandler(async (req, res) => {
  const config = await getS3Config();
  if (!config) return res.json({ success: true, configured: false, config: null });

  const safeConfig = { ...config };
  if (safeConfig.secretKey) safeConfig.secretKey = "***";
  res.json({ success: true, configured: true, config: safeConfig });
}));

// POST /api/backup/config
router.post("/api/backup/config", asyncHandler(async (req, res) => {
  const { endpoint, accessKey, secretKey, bucket, region, provider, resticPassword } = req.body;
  if (!endpoint || !accessKey || !secretKey || !bucket) {
    return res.status(400).json({ success: false, error: "endpoint, accessKey, secretKey, and bucket are required" });
  }

  // Read the existing config so we can preserve the restic password if not re-supplied.
  const existing = await getS3Config();

  // On first setup there is no existing config — resticPassword is mandatory.
  if (!existing && !resticPassword) {
    return res.status(400).json({ success: false, error: "resticPassword is required when configuring backups for the first time" });
  }

  const config = {
    endpoint,
    accessKey,
    secretKey,
    bucket,
    region: region || "us-east-1",
    provider: provider || "Other",
    // Preserve the existing password if the user did not supply a new one.
    resticPassword: resticPassword || existing?.resticPassword || "",
  };

  await saveS3Config(config);
  log("info", "[POST /api/backup/config] Backup configuration saved");
  res.json({ success: true, message: "Backup configuration saved successfully" });
}));

// ─── Job Status ───────────────────────────────────────────────────────────────

// GET /api/backup/jobs/:jobId
router.get("/api/backup/jobs/:jobId", asyncHandler(async (req, res) => {
  const job = getBackupJobStatus(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: "Job not found" });
  res.json({ success: true, job });
}));

// GET /api/restore/jobs/:jobId
router.get("/api/restore/jobs/:jobId", asyncHandler(async (req, res) => {
  const job = getRestoreJobStatus(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: "Job not found" });
  res.json({ success: true, job });
}));

// ─── Backup Schedules ─────────────────────────────────────────────────────────

// GET /api/backup/schedules
router.get("/api/backup/schedules", asyncHandler(async (req, res) => {
  const schedules = await getSchedules();
  res.json({ success: true, schedules });
}));

// POST /api/backup/schedules  — create or update a schedule
// Body: { volumeName, intervalHours, keepCount, enabled }
router.post("/api/backup/schedules", asyncHandler(async (req, res) => {
  const { volumeName, intervalHours, keepCount, enabled = true } = req.body;

  if (!volumeName) {
    return res.status(400).json({ success: false, error: "volumeName is required" });
  }

  const parsedInterval = parseInt(intervalHours, 10);
  const parsedKeep = parseInt(keepCount, 10);

  if (!parsedInterval || parsedInterval < 1) {
    return res.status(400).json({ success: false, error: "intervalHours must be a positive integer" });
  }
  if (!parsedKeep || parsedKeep < 1) {
    return res.status(400).json({ success: false, error: "keepCount must be a positive integer" });
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

  log("info", `[POST /api/backup/schedules] Schedule saved for volume: ${volumeName}`);
  res.json({ success: true, schedule: saved });
}));

// DELETE /api/backup/schedules/:volumeName
router.delete("/api/backup/schedules/:volumeName", asyncHandler(async (req, res) => {
  const { volumeName } = req.params;
  await deleteSchedule(volumeName);
  removeScheduleTimer(volumeName);
  log("info", `[DELETE /api/backup/schedules] Schedule removed for volume: ${volumeName}`);
  res.json({ success: true, message: `Schedule for ${volumeName} removed` });
}));

// POST /api/backup/schedules/:volumeName/run  — trigger an immediate backup
router.post("/api/backup/schedules/:volumeName/run", asyncHandler(async (req, res) => {
  const { volumeName } = req.params;
  log("info", `[POST /api/backup/schedules/${volumeName}/run] Manual trigger`);
  // runNow is async but we respond immediately; the backup runs in background
  runNow(volumeName).catch((err) => {
    log("error", `[Scheduler/runNow] ${volumeName}: ${err.message}`);
  });
  res.json({ success: true, message: `Backup triggered for ${volumeName}` });
}));

// ─── Backed-up Volumes ────────────────────────────────────────────────────────

// GET /api/backup/volumes — list volumes that have at least one snapshot.
// Returns per volume: full snapshot list (id, timestamp, sizeMB), snapshot count,
// newest/oldest timestamps, and the running container that uses this volume (if any).
router.get("/api/backup/volumes", asyncHandler(async (req, res) => {
  const config = await getS3Config();
  if (!config) return res.json({ success: true, volumes: [] });

  // One restic call to discover all backed-up volume names
  const allSnapshots = await listSnapshots({ tag: "yantr" }, config, log);
  const volumeNames = [...new Set(
    allSnapshots
      .flatMap(s => s.tags || [])
      .filter(t => t.startsWith("vol:"))
      .map(t => t.slice(4))
  )];

  if (volumeNames.length === 0) return res.json({ success: true, volumes: [] });

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

  res.json({ success: true, volumes });
}));

export default router;
