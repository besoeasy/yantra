import Docker from "dockerode";
import { spawnProcess } from "./utils.js";

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock" });

const RESTIC_PREFIX = "yantr-restic";

/**
 * Build the environment object for every restic subprocess call.
 * The RESTIC_REPOSITORY is computed at runtime and never stored.
 *
 * AWS native format:  s3:<bucket>.s3.<region>.amazonaws.com/<prefix>
 * Everything else:    s3:<endpoint>/<bucket>/<prefix>
 *
 * @param {Object} s3Config
 * @returns {Object} env
 */
export function buildResticEnv(s3Config) {
  const { endpoint, bucket, region, accessKey, secretKey, resticPassword } = s3Config;

  let repo;
  if (endpoint && endpoint.includes("amazonaws.com")) {
    repo = `s3:${bucket}.s3.${region || "us-east-1"}.amazonaws.com/${RESTIC_PREFIX}`;
  } else {
    // Normalise endpoint: strip trailing slash
    const ep = (endpoint || "").replace(/\/$/, "");
    repo = `s3:${ep}/${bucket}/${RESTIC_PREFIX}`;
  }

  return {
    ...process.env,
    RESTIC_REPOSITORY: repo,
    RESTIC_PASSWORD: resticPassword || "",
    AWS_ACCESS_KEY_ID: accessKey || "",
    AWS_SECRET_ACCESS_KEY: secretKey || "",
    AWS_DEFAULT_REGION: region || "us-east-1",
  };
}

/**
 * Returns the computed repository URL (for display purposes).
 * @param {Object} s3Config
 * @returns {string}
 */
export function getRepoUrl(s3Config) {
  const env = buildResticEnv(s3Config);
  return env.RESTIC_REPOSITORY;
}

/**
 * Run `restic init`.
 * If the repo already exists (exit 1 + "already initialized") treats as OK.
 *
 * @param {Object} s3Config
 * @param {Function} [log]
 */
export async function initRepo(s3Config, log) {
  const env = buildResticEnv(s3Config);
  log?.("info", `[restic] Initialising repository at ${env.RESTIC_REPOSITORY}`);

  const { stdout, stderr, exitCode } = await spawnProcess("restic", ["init"], { env });

  if (exitCode === 0) {
    log?.("info", "[restic] Repository initialised successfully");
    return;
  }

  // Restic exits 1 when repo already exists — that's fine
  if (stderr.includes("already initialized") || stdout.includes("already initialized")) {
    log?.("info", "[restic] Repository already exists, continuing");
    return;
  }

  throw new Error(`restic init failed (exit ${exitCode}): ${stderr || stdout}`);
}

/**
 * Backup a Docker volume via restic.
 * Streams directly to S3 — no temp directory needed.
 *
 * @param {string} volumeName
 * @param {string[]} extraTags  Additional tags beyond "yantr" and "vol:<volumeName>"
 * @param {Object} s3Config
 * @param {Function} [log]
 * @returns {string} snapshotId (restic short ID)
 */
export async function backupVolume(volumeName, extraTags, s3Config, log) {
  const env = buildResticEnv(s3Config);
  const dataPath = `/var/lib/docker/volumes/${volumeName}/_data`;

  const args = [
    "backup",
    dataPath,
    "--tag", "yantr",
    "--tag", `vol:${volumeName}`,
    "--json",
  ];

  for (const tag of (extraTags || [])) {
    args.push("--tag", String(tag));
  }

  log?.("info", `[restic] Backing up volume ${volumeName} → ${env.RESTIC_REPOSITORY}`);

  const { stdout, stderr, exitCode } = await spawnProcess("restic", args, { env });

  if (exitCode !== 0) {
    throw new Error(`restic backup failed (exit ${exitCode}): ${stderr || stdout}`);
  }

  // restic --json emits several JSON lines; the last one with "message_type":"summary"
  // contains the snapshot_id.
  let snapshotId = null;
  for (const line of stdout.split("\n").reverse()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.message_type === "summary" && obj.snapshot_id) {
        snapshotId = obj.snapshot_id.substring(0, 8); // short ID
        break;
      }
    } catch {
      // not JSON, skip
    }
  }

  if (!snapshotId) {
    // Fallback: grab short_id from any JSON line
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        if (obj.short_id) { snapshotId = obj.short_id; break; }
        if (obj.snapshot_id) { snapshotId = obj.snapshot_id.substring(0, 8); break; }
      } catch {
        // skip
      }
    }
  }

  log?.("info", `[restic] Backup complete. Snapshot: ${snapshotId}`);
  return snapshotId;
}

/**
 * List restic snapshots, optionally filtered by tag or path.
 *
 * @param {{ tag?: string, path?: string }} filter
 * @param {Object} s3Config
 * @param {Function} [log]
 * @returns {Array} Array of snapshot objects
 */
export async function listSnapshots(filter, s3Config, log) {
  const env = buildResticEnv(s3Config);
  const args = ["snapshots", "--json"];

  if (filter?.tag) {
    args.push("--tag", filter.tag);
  }
  if (filter?.path) {
    args.push("--path", filter.path);
  }

  const { stdout, stderr, exitCode } = await spawnProcess("restic", args, { env });

  if (exitCode !== 0) {
    // Empty repo is not an error worth throwing
    if (stderr.includes("no matching ID") || stderr.includes("Is there a repository")) {
      return [];
    }
    throw new Error(`restic snapshots failed (exit ${exitCode}): ${stderr || stdout}`);
  }

  try {
    const parsed = JSON.parse(stdout.trim() || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    log?.("warn", `[restic] Could not parse snapshot list output: ${stdout}`);
    return [];
  }
}

/**
 * Get size statistics for a single snapshot.
 * Uses `restic stats <snapshotId> --json` which returns { total_size, total_file_count }.
 * Returns null on failure (non-fatal — callers treat null as unknown size).
 *
 * @param {string} snapshotId
 * @param {Object} s3Config
 * @returns {Promise<{ sizeMB: number } | null>}
 */
export async function getSnapshotStats(snapshotId, s3Config) {
  const env = buildResticEnv(s3Config);

  const { stdout, exitCode } = await spawnProcess(
    "restic",
    ["stats", snapshotId, "--json"],
    { env }
  );

  if (exitCode !== 0) return null;

  try {
    const obj = JSON.parse(stdout.trim());
    if (obj.total_size == null) return null;
    return {
      sizeMB: parseFloat((obj.total_size / (1024 * 1024)).toFixed(2)),
    };
  } catch {
    return null;
  }
}

/**
 * Restore a restic snapshot into a Docker volume path.
 * Streams directly from S3 — no temp directory needed.
 *
 * Uses `--target /` so restic restores files to their original absolute paths
 * (e.g. /var/lib/docker/volumes/<name>/_data/...).
 * Using `--target <dataPath>` would cause double-nesting because restic
 * appends the backed-up absolute path under the target directory.
 *
 * @param {string} snapshotId
 * @param {string} volumeName
 * @param {Object} s3Config
 * @param {Function} [log]
 */
export async function restoreSnapshot(snapshotId, volumeName, s3Config, log) {
  const env = buildResticEnv(s3Config);
  const dataPath = `/var/lib/docker/volumes/${volumeName}/_data`;

  log?.("info", `[restic] Restoring snapshot ${snapshotId} → ${dataPath}`);

  const { stdout, stderr, exitCode } = await spawnProcess(
    "restic",
    ["restore", snapshotId, "--target", "/", "--include", dataPath],
    { env }
  );

  if (exitCode !== 0) {
    throw new Error(`restic restore failed (exit ${exitCode}): ${stderr || stdout}`);
  }

  log?.("info", `[restic] Restore complete for snapshot ${snapshotId}`);
}

/**
 * Run `restic forget --prune` for a set of tags with a keep policy.
 *
 * @param {string[]} tags
 * @param {{ daily?: number, weekly?: number, monthly?: number }} keepPolicy
 * @param {Object} s3Config
 * @param {Function} [log]
 */
export async function forget(tags, keepPolicy, s3Config, log) {
  const env = buildResticEnv(s3Config);
  const policy = {
    daily: keepPolicy?.daily ?? 7,
    weekly: keepPolicy?.weekly ?? 4,
    monthly: keepPolicy?.monthly ?? 6,
  };

  const args = ["forget", "--prune", "--json"];
  for (const tag of (tags || [])) {
    args.push("--tag", tag);
  }
  args.push("--keep-daily", String(policy.daily));
  args.push("--keep-weekly", String(policy.weekly));
  args.push("--keep-monthly", String(policy.monthly));

  log?.("info", `[restic] Running forget/prune for tags: ${tags?.join(", ")}`);

  const { stdout, stderr, exitCode } = await spawnProcess("restic", args, { env });

  if (exitCode !== 0) {
    throw new Error(`restic forget failed (exit ${exitCode}): ${stderr || stdout}`);
  }

  log?.("info", `[restic] Forget/prune complete`);
}

/**
 * Forget a single snapshot by its ID.
 *
 * @param {string} snapshotId
 * @param {Object} s3Config
 * @param {Function} [log]
 */
export async function forgetSnapshot(snapshotId, s3Config, log) {
  const env = buildResticEnv(s3Config);

  log?.("info", `[restic] Forgetting snapshot ${snapshotId}`);

  const { stdout, stderr, exitCode } = await spawnProcess(
    "restic",
    ["forget", "--prune", snapshotId],
    { env }
  );

  if (exitCode !== 0) {
    throw new Error(`restic forget snapshot failed (exit ${exitCode}): ${stderr || stdout}`);
  }

  log?.("info", `[restic] Snapshot ${snapshotId} removed`);
}

/**
 * Run `restic check` — integrity verification.
 *
 * @param {Object} s3Config
 * @param {Function} [log]
 */
export async function checkRepo(s3Config, log) {
  const env = buildResticEnv(s3Config);

  log?.("info", "[restic] Running repository integrity check");

  const { stdout, stderr, exitCode } = await spawnProcess("restic", ["check"], { env });

  if (exitCode !== 0) {
    throw new Error(`restic check failed (exit ${exitCode}): ${stderr || stdout}`);
  }

  log?.("info", "[restic] Repository check passed");
  return { ok: true, output: stdout };
}

// ============================================================================
// CONTAINER LIFECYCLE HELPERS
// ============================================================================

/**
 * Find running containers that have the given volume mounted.
 *
 * @param {string} volumeName
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getContainersUsingVolume(volumeName) {
  const containers = await docker.listContainers({ all: false }); // running only
  const result = [];

  for (const c of containers) {
    const mounts = c.Mounts || [];
    if (mounts.some((m) => m.Type === "volume" && m.Name === volumeName)) {
      result.push({
        id: c.Id,
        name: (c.Names?.[0] || "").replace(/^\//, ""),
      });
    }
  }

  return result;
}

/**
 * Stop all running containers that use the given volume.
 * Returns the list of container IDs that were stopped (for restart later).
 * Containers already stopped are not included.
 *
 * @param {string} volumeName
 * @param {Function} [log]
 * @returns {Promise<string[]>} stoppedIds
 */
export async function stopContainersForVolume(volumeName, log) {
  const running = await getContainersUsingVolume(volumeName);
  const stoppedIds = [];

  for (const { id, name } of running) {
    try {
      log?.("info", `[restic] Stopping container ${name} (${id.substring(0, 12)}) for volume ${volumeName}`);
      await docker.getContainer(id).stop({ t: 10 });
      stoppedIds.push(id);
    } catch (err) {
      // 304 = already stopped, 404 = gone — both are safe to ignore
      if (err.statusCode !== 304 && err.statusCode !== 404) {
        log?.("warn", `[restic] Could not stop container ${name}: ${err.message}`);
      }
    }
  }

  return stoppedIds;
}

/**
 * Start a list of containers by their IDs.
 * Designed for use in `finally` blocks so it does not throw.
 *
 * @param {string[]} containerIds
 * @param {Function} [log]
 */
export async function startContainers(containerIds, log) {
  for (const id of (containerIds || [])) {
    try {
      log?.("info", `[restic] Restarting container ${id.substring(0, 12)}`);
      await docker.getContainer(id).start();
    } catch (err) {
      // 304 = already running — not an error
      if (err.statusCode !== 304) {
        log?.("warn", `[restic] Could not restart container ${id.substring(0, 12)}: ${err.message}`);
      }
    }
  }
}
