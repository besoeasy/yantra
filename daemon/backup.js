import Docker from "dockerode";
import { readFile, writeFile, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { spawnProcess } from "./utils.js";
import { resolveComposeCommand } from "./compose.js";
import * as restic from "./restic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock" });

// Backup job tracking
const backupJobs = new Map();
const restoreJobs = new Map();

// Generate unique job ID
function generateJobId() {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const CONFIG_PATH = path.join(__dirname, "..", "backup-config.json");
const SCHEDULES_PATH = path.join(__dirname, "..", "backup-schedules.json");

// Get S3 config from environment or config file
export async function getS3Config() {
  try {
    const content = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

// Save S3 config
export async function saveS3Config(config) {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ---- Schedule persistence ----

/**
 * A schedule entry:
 * {
 *   volumeName: string,
 *   intervalHours: number,   // e.g. 6, 12, 24, 168
 *   keepCount: number,       // max number of backups to retain per volume
 *   enabled: boolean,
 *   lastRunAt: string|null,  // ISO timestamp
 *   nextRunAt: string|null,  // ISO timestamp (informational)
 * }
 */
export async function getSchedules() {
  try {
    const content = await readFile(SCHEDULES_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    return [];
  }
}

export async function saveSchedules(schedules) {
  await writeFile(SCHEDULES_PATH, JSON.stringify(schedules, null, 2), "utf-8");
}

export async function upsertSchedule(schedule) {
  const schedules = await getSchedules();
  const idx = schedules.findIndex((s) => s.volumeName === schedule.volumeName);
  if (idx >= 0) {
    schedules[idx] = { ...schedules[idx], ...schedule };
  } else {
    schedules.push(schedule);
  }
  await saveSchedules(schedules);
  return schedules.find((s) => s.volumeName === schedule.volumeName);
}

export async function deleteSchedule(volumeName) {
  const schedules = await getSchedules();
  const filtered = schedules.filter((s) => s.volumeName !== volumeName);
  await saveSchedules(filtered);
}

function getComposeEnv(socketPath) {
  return {
    ...process.env,
    DOCKER_HOST: socketPath ? `unix://${socketPath}` : process.env.DOCKER_HOST,
  };
}

async function startRestoredApps(metadata, log) {
  const apps = Array.isArray(metadata?.apps) ? metadata.apps : [];
  const appConfigs = Array.isArray(metadata?.appConfigs) ? metadata.appConfigs : [];
  const appIds = new Set();

  for (const app of apps) {
    if (app?.appId) {
      appIds.add(app.appId);
    }
  }

  for (const appConfig of appConfigs) {
    if (appConfig?.appId) {
      appIds.add(appConfig.appId);
    }
  }

  if (appIds.size === 0) {
    return;
  }

  const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
  const compose = await resolveComposeCommand({ socketPath, log });
  const env = getComposeEnv(socketPath);
  const appsDir = path.join(__dirname, "..", "apps");

  for (const appId of appIds) {
    const composePath = path.join(appsDir, appId, "compose.yml");

    try {
      await stat(composePath);
    } catch (err) {
      log?.("warn", `[Restore] Compose file not found for ${appId}, skipping start`);
      continue;
    }

    const { exitCode, stderr } = await spawnProcess(
      compose.command,
      [...compose.args, "-f", composePath, "up", "-d"],
      { env }
    );

    if (exitCode !== 0) {
      log?.("warn", `[Restore] Failed to start ${appId}: ${stderr}`);
    }
  }
}

// Get job status
export function getBackupJobStatus(jobId) {
  return backupJobs.get(jobId) || null;
}

export function getRestoreJobStatus(jobId) {
  return restoreJobs.get(jobId) || null;
}

// Get all jobs
export function getAllBackupJobs() {
  return Array.from(backupJobs.entries()).map(([id, job]) => ({ id, ...job }));
}

export function getAllRestoreJobs() {
  return Array.from(restoreJobs.entries()).map(([id, job]) => ({ id, ...job }));
}

// ============================================================================
// RESTIC-BASED VOLUME BACKUP FUNCTIONS
// ============================================================================

/**
 * Create a restic backup for each volume associated with a container.
 * Containers using a volume are stopped before backup and always restarted.
 *
 * @param {{ containerId: string, volumes: string[], s3Config: Object, log: Function }} opts
 * @returns {{ jobId: string, status: string }}
 */
export function createContainerBackup({ containerId, volumes, s3Config, log }) {
  const jobId = generateJobId();
  const volumeList = Array.isArray(volumes) ? volumes : [];

  backupJobs.set(jobId, {
    status: "in-progress",
    progress: 0,
    containerId,
    volumes: volumeList,
    startedAt: new Date().toISOString(),
  });

  (async () => {
    try {
      log?.("info", `[Backup ${jobId}] Starting restic backup for container ${containerId} (${volumeList.length} volume(s))`);

      // Ensure repo exists (safe to call every time — no-op if already initialised)
      await restic.initRepo(s3Config, log);

      const snapshotIds = [];
      const totalVolumes = volumeList.length;

      for (let i = 0; i < volumeList.length; i++) {
        const volumeName = volumeList[i];

        backupJobs.set(jobId, {
          ...backupJobs.get(jobId),
          progress: Math.floor((i / totalVolumes) * 90),
          currentVolume: volumeName,
        });

        log?.("info", `[Backup ${jobId}] Processing volume ${i + 1}/${totalVolumes}: ${volumeName}`);

        // Stop containers using this volume for consistency
        const stopped = await restic.stopContainersForVolume(volumeName, log);
        try {
          const snapshotId = await restic.backupVolume(
            volumeName,
            [String(containerId)],
            s3Config,
            log
          );
          snapshotIds.push({ volumeName, snapshotId });
          log?.("info", `[Backup ${jobId}] Volume ${volumeName} snapshot: ${snapshotId}`);
        } finally {
          // Always restart containers even if backup fails
          await restic.startContainers(stopped, log);
        }
      }

      backupJobs.set(jobId, {
        ...backupJobs.get(jobId),
        status: "completed",
        progress: 100,
        completedAt: new Date().toISOString(),
        snapshotIds,
      });

      log?.("info", `[Backup ${jobId}] All volumes backed up successfully`);
    } catch (err) {
      log?.("error", `[Backup ${jobId}] Backup failed: ${err.message}`);
      backupJobs.set(jobId, {
        ...backupJobs.get(jobId),
        status: "failed",
        error: err.message,
      });
    }
  })();

  return { jobId, status: "started" };
}

/**
 * Restore a Docker volume from a restic snapshot.
 * Containers using the volume are stopped and always restarted.
 *
 * @param {string} volumeName
 * @param {string} snapshotId  restic snapshot short ID
 * @param {Object} s3Config
 * @param {boolean} overwrite  If false and volume exists, throws.
 * @param {Function} [log]
 * @returns {{ jobId: string, status: string }}
 */
export function restoreVolumeBackup(volumeName, snapshotId, s3Config, overwrite, log) {
  const jobId = generateJobId();

  restoreJobs.set(jobId, {
    status: "in-progress",
    progress: 0,
    volumeName,
    snapshotId,
    startedAt: new Date().toISOString(),
  });

  (async () => {
    try {
      log?.("info", `[Restore ${jobId}] Starting restore for volume ${volumeName} from snapshot ${snapshotId}`);

      // Check if volume exists
      let volumeExists = false;
      try {
        await docker.getVolume(volumeName).inspect();
        volumeExists = true;
      } catch {
        volumeExists = false;
      }

      if (volumeExists && !overwrite) {
        throw new Error("Volume exists and overwrite is false");
      }

      restoreJobs.set(jobId, { ...restoreJobs.get(jobId), progress: 10 });

      // Stop containers using this volume
      const stopped = await restic.stopContainersForVolume(volumeName, log);

      try {
        if (!volumeExists) {
          log?.("info", `[Restore ${jobId}] Creating volume ${volumeName}`);
          await docker.createVolume({ Name: volumeName });
        }

        restoreJobs.set(jobId, { ...restoreJobs.get(jobId), progress: 30 });

        // restic restore writes directly into the volume path — no temp dir needed
        await restic.restoreSnapshot(snapshotId, volumeName, s3Config, log);

        restoreJobs.set(jobId, {
          ...restoreJobs.get(jobId),
          status: "completed",
          progress: 100,
          completedAt: new Date().toISOString(),
        });

        log?.("info", `[Restore ${jobId}] Restore completed successfully`);
      } finally {
        // Always restart containers
        await restic.startContainers(stopped, log);
      }
    } catch (err) {
      log?.("error", `[Restore ${jobId}] Restore failed: ${err.message}`);
      restoreJobs.set(jobId, {
        ...restoreJobs.get(jobId),
        status: "failed",
        error: err.message,
      });
    }
  })();

  return { jobId, status: "started" };
}

/**
 * List restic snapshots for one or more volumes.
 *
 * Returns:
 *   {
 *     [volumeName]: [
 *       { snapshotId, timestamp, tags, sizeMB }
 *     ]
 *   }
 *
 * @param {string[]} volumeNames
 * @param {Object} s3Config
 * @param {Function} [log]
 * @returns {Object}
 */
export async function listVolumeBackups(volumeNames, s3Config, log) {
  const result = {};

  for (const volumeName of volumeNames) {
    try {
      const snapshots = await restic.listSnapshots(
        { tag: `vol:${volumeName}` },
        s3Config,
        log
      );

      result[volumeName] = await Promise.all(
        snapshots.map(async (s) => {
          const snapshotId = s.short_id || s.id?.substring(0, 8) || s.id;
          const stats = await restic.getSnapshotStats(snapshotId, s3Config).catch(() => null);
          return {
            snapshotId,
            timestamp: s.time,
            tags: s.tags || [],
            sizeMB: stats?.sizeMB ?? null,
          };
        })
      );
      result[volumeName].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (err) {
      log?.("warn", `[listVolumeBackups] Failed for ${volumeName}: ${err.message}`);
      result[volumeName] = [];
    }
  }

  return result;
}

/**
 * Enforce retention for a volume using restic forget --prune.
 * keepCount maps to --keep-daily.
 *
 * @param {string} volumeName
 * @param {number} keepCount
 * @param {Object} s3Config
 * @param {Function} [log]
 */
export async function enforceRetention(volumeName, keepCount, s3Config, log) {
  if (!keepCount || keepCount <= 0) return;
  try {
    await restic.forget(
      [`vol:${volumeName}`],
      {
        daily: keepCount,
        weekly: Math.ceil(keepCount / 7),
        monthly: 2,
      },
      s3Config,
      log
    );
  } catch (err) {
    log?.("warn", `[Retention] Failed for ${volumeName}: ${err.message}`);
  }
}

/**
 * Delete a single restic snapshot by ID.
 *
 * @param {string} volumeName  (unused — kept for API compat)
 * @param {string} snapshotId
 * @param {Object} s3Config
 * @param {Function} [log]
 */
export async function deleteVolumeBackup(volumeName, snapshotId, s3Config, log) {
  await restic.forgetSnapshot(snapshotId, s3Config, log);
  return { success: true };
}
