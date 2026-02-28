/**
 * BackupScheduler
 *
 * Manages interval-based scheduled backups for Docker volumes.
 * Each schedule specifies:
 *   - volumeName     : Docker volume to back up
 *   - intervalHours  : how often to run (e.g. 6, 12, 24, 168)
 *   - keepCount      : max backups to retain per volume (oldest pruned automatically)
 *   - enabled        : whether the schedule is active
 *
 * Schedules are persisted to backup-schedules.json next to the config file.
 */

import {
  getSchedules,
  saveSchedules,
  getS3Config,
  createContainerBackup,
  enforceRetention,
  getBackupJobStatus,
} from "./backup.js";

// Map<volumeName, NodeJS.Timer>
const activeTimers = new Map();

let _log = null;

/**
 * Poll a backup job until it reaches a terminal state (completed / failed)
 * or the timeout expires.
 *
 * @param {string} jobId
 * @param {{ pollMs?: number, timeoutMs?: number }} opts
 * @returns {Promise<'completed'|'failed'|'timeout'>}
 */
async function waitForJob(jobId, { pollMs = 2000, timeoutMs = 30 * 60 * 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = getBackupJobStatus(jobId);
    if (job?.status === "completed") return "completed";
    if (job?.status === "failed") return "failed";
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return "timeout";
}

/**
 * Run a single scheduled backup for a volume.
 */
async function runScheduledBackup(schedule) {
  const { volumeName, keepCount } = schedule;
  _log?.("info", `[Scheduler] Running scheduled backup for volume: ${volumeName}`);

  const s3Config = await getS3Config();
  if (!s3Config) {
    _log?.("warn", `[Scheduler] S3 not configured — skipping backup for ${volumeName}`);
    return;
  }

  try {
    // createContainerBackup is fire-and-forget — capture the jobId to poll.
    const { jobId } = createContainerBackup({
      containerId: "scheduled",
      volumes: [volumeName],
      s3Config,
      log: _log,
    });

    // Wait for the job to reach a terminal state before enforcing retention.
    const outcome = await waitForJob(jobId);

    if (outcome === "failed") {
      const job = getBackupJobStatus(jobId);
      throw new Error(`Backup job failed: ${job?.error || "unknown error"}`);
    }
    if (outcome === "timeout") {
      throw new Error("Backup job timed out after 30 minutes");
    }

    // Enforce retention only after a confirmed successful backup.
    await enforceRetention(volumeName, keepCount, s3Config, _log);

    // Update lastRunAt / nextRunAt in persisted schedules
    const schedules = await getSchedules();
    const idx = schedules.findIndex((s) => s.volumeName === volumeName);
    if (idx >= 0) {
      schedules[idx].lastRunAt = new Date().toISOString();
      schedules[idx].nextRunAt = new Date(
        Date.now() + schedules[idx].intervalHours * 60 * 60 * 1000
      ).toISOString();
      await saveSchedules(schedules);
    }

    _log?.("info", `[Scheduler] Backup + retention complete for ${volumeName}`);
  } catch (err) {
    _log?.("error", `[Scheduler] Backup failed for ${volumeName}: ${err.message}`);
  }
}

/**
 * Register (or re-register) an interval timer for a schedule entry.
 */
function registerTimer(schedule) {
  const { volumeName, intervalHours, enabled } = schedule;

  // Clear any existing timer for this volume
  if (activeTimers.has(volumeName)) {
    clearInterval(activeTimers.get(volumeName));
    activeTimers.delete(volumeName);
  }

  if (!enabled) {
    _log?.("info", `[Scheduler] Schedule for ${volumeName} is disabled — no timer set`);
    return;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;
  _log?.("info", `[Scheduler] Scheduling ${volumeName} every ${intervalHours}h`);

  const timer = setInterval(() => {
    runScheduledBackup(schedule).catch((err) => {
      _log?.("error", `[Scheduler] Unhandled error for ${volumeName}: ${err.message}`);
    });
  }, intervalMs);

  // Allow the process to exit even if timers are pending
  if (timer.unref) timer.unref();

  activeTimers.set(volumeName, timer);
}

/**
 * Load all enabled schedules from disk and start their timers.
 * Call once at startup.
 */
export async function startScheduler(logFn) {
  _log = logFn;
  _log?.("info", "[Scheduler] Starting backup scheduler");

  const schedules = await getSchedules();
  for (const schedule of schedules) {
    registerTimer(schedule);
  }

  _log?.("info", `[Scheduler] ${schedules.length} schedule(s) loaded`);
}

/**
 * Add or update a schedule and (re)start its timer immediately.
 */
export async function applySchedule(schedule) {
  registerTimer(schedule);
}

/**
 * Remove the timer for a volume (called after a schedule is deleted).
 */
export function removeScheduleTimer(volumeName) {
  if (activeTimers.has(volumeName)) {
    clearInterval(activeTimers.get(volumeName));
    activeTimers.delete(volumeName);
    _log?.("info", `[Scheduler] Timer removed for ${volumeName}`);
  }
}

/**
 * Trigger an immediate (manual) backup run for a schedule, ignoring the interval timer.
 */
export async function runNow(volumeName) {
  const schedules = await getSchedules();
  const schedule = schedules.find((s) => s.volumeName === volumeName);
  if (!schedule) throw new Error(`No schedule found for volume: ${volumeName}`);
  await runScheduledBackup(schedule);
}
