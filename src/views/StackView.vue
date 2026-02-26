<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApiUrl } from "../composables/useApiUrl";
import { useCurrentTime } from "../composables/useCurrentTime";
import { useNotification } from "../composables/useNotification";
import { formatDuration, formatBytes } from "../utils/metrics";
import {
  ArrowLeft, Globe, ExternalLink, Bot, Activity,
  Terminal, Server, Network, Trash2, RefreshCw, HardDrive, FolderOpen, AlertCircle,
  Eye, EyeOff, Settings2,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const { apiUrl } = useApiUrl();
const { currentTime } = useCurrentTime();
const toast = useNotification();

const projectId = computed(() => route.params.projectId);

const stack = ref(null);
const loading = ref(true);
const removing = ref(false);
const showOnlyDescribedPorts = ref(true);

// Env vars reveal state
const revealedVars = ref(new Set());

function isSensitive(key) {
  const k = key.toLowerCase();
  return k.includes("password") || k.includes("secret") || k.includes("token")
    || k.includes("_key") || k.endsWith("key") || k.includes("passwd")
    || k.includes("_pass") || k.endsWith("pass") || k.includes("auth")
    || k.includes("credential") || k.includes("private");
}

function toggleReveal(key) {
  const s = new Set(revealedVars.value);
  s.has(key) ? s.delete(key) : s.add(key);
  revealedVars.value = s;
}

// Aggregate unique env vars across all services (primary service wins on conflict)
const stackEnvVars = computed(() => {
  if (!stack.value) return [];
  const map = new Map();
  // Process primary service first so its values take precedence
  const sorted = [...stack.value.services].sort((a, b) => (b.hasYantrLabel ? 1 : 0) - (a.hasYantrLabel ? 1 : 0));
  for (const svc of sorted) {
    for (const v of (svc.env || [])) {
      if (!map.has(v.key)) map.set(v.key, { ...v, service: svc.service });
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
});

// Browse / Backup state
const browsingVolume = ref({});
const showVolumeMenu = ref({});
const s3Configured = ref(false);
const volumeBackups = ref({});
const backingUp = ref(false);
const showRestoreMenu = ref({});

// Build a port-number → {label, protocol} lookup from the info.json ports array
function buildPortLabels(ports) {
  const labels = {};
  if (!Array.isArray(ports)) return labels;
  for (const p of ports) {
    if (p.port != null) {
      labels[String(p.port)] = {
        protocol: (p.protocol || '').toLowerCase(),
        label: p.label || null,
      };
    }
  }
  return labels;
}

// Merge published ports with described labels from info.json
const enrichedPorts = computed(() => {
  if (!stack.value) return [];
  const portLabels = buildPortLabels(stack.value.app?.ports);
  return stack.value.publishedPorts.map((p) => ({
    ...p,
    label: portLabels[String(p.containerPort)]?.label || null,
    labeledProtocol: portLabels[String(p.containerPort)]?.protocol || null,
  }));
});

const visiblePorts = computed(() => {
  if (!showOnlyDescribedPorts.value) return enrichedPorts.value;
  const described = enrichedPorts.value.filter((p) => p.label);
  // Fall back to all if none have descriptions
  return described.length > 0 ? described : enrichedPorts.value;
});

const hasDescribedPorts = computed(() => enrichedPorts.value.some((p) => p.label));

// Collect all unique mounts across all services (includes svcId for backup ops)
const allMounts = computed(() => {
  if (!stack.value) return [];
  const seen = new Set();
  const result = [];
  for (const svc of stack.value.services) {
    for (const m of (svc.mounts || [])) {
      const key = `${m.type}:${m.source}:${m.destination}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ ...m, svcName: svc.service, svcId: svc.id });
      }
    }
  }
  const order = { volume: 0, bind: 1, tmpfs: 2 };
  result.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
  return result;
});

// Named Docker volumes only — these support browse / backup / restore
const namedVolumes = computed(() => allMounts.value.filter((m) => m.type === 'volume' && m.name));

// Bind mounts and tmpfs — shown in a simple compact list
const otherMounts = computed(() => allMounts.value.filter((m) => m.type !== 'volume' || !m.name));

function appUrl(hostPort, proto) {
  const scheme = proto === 'https' ? 'https' : 'http';
  return `${scheme}://${window.location.hostname}:${hostPort}`;
}

let refreshInterval = null;

// ── helpers ───────────────────────────────────────────────────────────────────

function formatUptime(service) {
  if (service.state !== "running" || !service.created) return null;
  const uptime = currentTime.value - service.created * 1000;
  if (uptime <= 0) return "Just started";
  return formatDuration(uptime);
}

const overallState = computed(() => {
  if (!stack.value) return "unknown";
  const states = stack.value.services.map((s) => s.state);
  if (states.every((s) => s === "running")) return "running";
  if (states.some((s) => s === "running")) return "partial";
  return "stopped";
});

const stateClass = computed(() => {
  if (overallState.value === "running")
    return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
  if (overallState.value === "partial")
    return "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20";
  return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";
});

// ── API ────────────────────────────────────────────────────────────────────────

async function fetchStack() {
  try {
    const res = await fetch(`${apiUrl.value}/api/stacks/${projectId.value}`);
    const data = await res.json();
    if (data.success) {
      stack.value = data.stack;
    } else {
      toast.error("Stack not found");
      router.push("/");
    }
  } catch (e) {
    console.error("Failed to load stack:", e);
    toast.error("Failed to load stack");
  } finally {
    loading.value = false;
  }
}

async function removeStack() {
  if (removing.value) return;
  const name = stack.value?.app?.name || projectId.value;
  if (!confirm(`Remove the entire "${name}" stack? This will stop and delete all its containers.`)) return;

  removing.value = true;
  toast.info(`Removing ${name}…`);

  try {
    // Use any one container from the stack as the handle for removal
    const firstId = stack.value?.services?.[0]?.id;
    if (!firstId) throw new Error("No container found to remove");

    const res = await fetch(`${apiUrl.value}/api/containers/${firstId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toast.success(`${name} removed`);
      router.push("/");
    } else {
      throw new Error(data.message || "Removal failed");
    }
  } catch (e) {
    console.error("Remove error:", e);
    toast.error(`Failed to remove: ${e.message}`);
  } finally {
    removing.value = false;
  }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

// ── Browse / Backup / Restore ────────────────────────────────────────────────

async function browseVolume(volumeName, expiryMinutes = 60) {
  browsingVolume.value[volumeName] = true;
  showVolumeMenu.value[volumeName] = false;
  try {
    const response = await fetch(`${apiUrl.value}/api/volumes/${volumeName}/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiryMinutes }),
    });
    const data = await response.json();
    if (data.success) {
      const expiryText = expiryMinutes > 0 ? ` (expires in ${expiryMinutes}m)` : ' (no expiry)';
      toast.success(`Volume browser started on port ${data.port}${expiryText}`);
      if (data.port) window.open(`http://${window.location.hostname}:${data.port}`, '_blank');
    }
  } catch (e) {
    toast.error('Failed to start volume browser');
  } finally {
    delete browsingVolume.value[volumeName];
  }
}

async function checkS3Config() {
  try {
    const res = await fetch(`${apiUrl.value}/api/backup/config`);
    const data = await res.json();
    s3Configured.value = data.configured;
  } catch (e) { /* silent */ }
}

async function fetchVolumeBackups() {
  if (!stack.value) return;
  // Collect unique svcIds that have named volumes
  const svcIds = [...new Set(namedVolumes.value.map((m) => m.svcId))];
  const merged = {};
  await Promise.all(svcIds.map(async (svcId) => {
    try {
      const res = await fetch(`${apiUrl.value}/api/containers/${svcId}/backups`);
      const data = await res.json();
      if (data.success && data.backups) {
        Object.assign(merged, data.backups);
        if (data.configured !== false) s3Configured.value = true;
      }
    } catch (e) { /* silent */ }
  }));
  volumeBackups.value = merged;
}

async function backupVolume(svcId) {
  if (backingUp.value) return;
  backingUp.value = true;
  try {
    const res = await fetch(`${apiUrl.value}/api/containers/${svcId}/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data.success) {
      toast.success('Backup started');
      pollBackupJob(data.jobId);
    } else {
      toast.error(data.error || 'Failed to start backup');
    }
  } catch (e) {
    toast.error('Failed to start backup');
  } finally {
    backingUp.value = false;
  }
}

async function backupAll() {
  if (backingUp.value) return;
  const svcIds = [...new Set(namedVolumes.value.map((m) => m.svcId))];
  for (const svcId of svcIds) await backupVolume(svcId);
}

function pollBackupJob(jobId) {
  const iv = setInterval(async () => {
    try {
      const res = await fetch(`${apiUrl.value}/api/backup/jobs/${jobId}`);
      const data = await res.json();
      if (data.success && data.job) {
        if (data.job.status === 'completed') {
          clearInterval(iv);
          toast.success('Backup completed');
          await fetchVolumeBackups();
        } else if (data.job.status === 'failed') {
          clearInterval(iv);
          toast.error(`Backup failed: ${data.job.error}`);
        }
      }
    } catch (e) { clearInterval(iv); }
  }, 2000);
}

async function restoreBackup(volumeName, backupKey) {
  if (!confirm(`Restore ${volumeName} from backup?\n\nThis will overwrite current data.`)) return;
  try {
    const res = await fetch(`${apiUrl.value}/api/volumes/${volumeName}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupKey, overwrite: true }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success('Restore started');
      pollRestoreJob(data.jobId);
    } else {
      toast.error(data.error || 'Failed to start restore');
    }
  } catch (e) {
    toast.error('Failed to start restore');
  }
  showRestoreMenu.value[volumeName] = false;
}

function pollRestoreJob(jobId) {
  const iv = setInterval(async () => {
    try {
      const res = await fetch(`${apiUrl.value}/api/restore/jobs/${jobId}`);
      const data = await res.json();
      if (data.success && data.job) {
        if (data.job.status === 'completed') { clearInterval(iv); toast.success('Restore completed'); }
        else if (data.job.status === 'failed') { clearInterval(iv); toast.error(`Restore failed: ${data.job.error}`); }
      }
    } catch (e) { clearInterval(iv); }
  }, 2000);
}

async function deleteBackupFile(volumeName, backupKey) {
  const timestamp = backupKey.split('/')[1]?.replace('.tar', '');
  if (!confirm('Delete this backup?')) return;
  try {
    const res = await fetch(`${apiUrl.value}/api/volumes/${volumeName}/backup/${timestamp}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { toast.success('Backup deleted'); await fetchVolumeBackups(); }
    else toast.error(data.error || 'Failed to delete backup');
  } catch (e) {
    toast.error('Failed to delete backup');
  }
}

function toggleRestoreMenu(volumeName) {
  showRestoreMenu.value[volumeName] = !showRestoreMenu.value[volumeName];
}

function hasBackups(volumeName) {
  return volumeBackups.value[volumeName]?.length > 0;
}

function getLatestBackupAge(volumeName) {
  const backups = volumeBackups.value[volumeName];
  if (!backups?.length) return 'Never';
  const diffMs = Date.now() - new Date(backups[0].timestamp);
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

function formatBackupDate(ts) {
  return new Date(ts).toLocaleString();
}

onMounted(async () => {
  await fetchStack();
  await Promise.all([checkS3Config(), fetchVolumeBackups()]);
  refreshInterval = setInterval(fetchStack, 8000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-200 font-sans">

    <!-- Header bar -->
    <header class="bg-white dark:bg-[#18181b] border-b border-slate-200 dark:border-slate-800/50">
      <div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">

        <div class="flex items-center gap-4">
          <button
            @click="router.back()"
            class="inline-flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all text-slate-600 dark:text-slate-400"
          >
            <ArrowLeft :size="18" />
          </button>
          <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>
          <div class="flex items-center gap-2.5 text-sm">
            <button @click="router.push('/')" class="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Dashboard</button>
            <span class="text-slate-300 dark:text-slate-700">/</span>
            <span class="font-semibold text-slate-900 dark:text-white truncate max-w-xs">
              {{ stack?.app?.name || projectId }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Refresh -->
          <button
            @click="fetchStack"
            class="inline-flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500 dark:text-slate-400"
            title="Refresh"
          >
            <RefreshCw :size="16" />
          </button>

          <!-- State badge -->
          <div
            v-if="stack"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide border"
            :class="stateClass"
          >
            <span
              v-if="overallState === 'running'"
              class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
            ></span>
            <span
              v-else-if="overallState === 'partial'"
              class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"
            ></span>
            <span v-else class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            {{ overallState }}
          </div>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh]">
      <div class="animate-spin text-slate-300"><Activity :size="32" /></div>
      <div class="mt-4 font-mono text-xs tracking-widest text-slate-400 uppercase">Loading Stack…</div>
    </div>

    <!-- Content -->
    <div v-else-if="stack" class="max-w-5xl mx-auto px-6 py-8 space-y-6">

      <!-- ── Identity card ─────────────────────────────────────────────────── -->
      <div class="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-slate-200/50 dark:border-slate-800/50 p-6 flex items-center gap-6 shadow-sm">

        <!-- Logo -->
        <div class="w-20 h-20 shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-800">
          <img
            v-if="stack.app?.logo"
            :src="stack.app.logo"
            :alt="stack.app.name"
            loading="lazy"
            class="w-14 h-14 object-contain"
          />
          <Bot v-else :size="32" class="text-slate-400" />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0 space-y-2">
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
              {{ stack.app?.name || stack.appId }}
            </h1>
            <!-- Project ID badge -->
            <span class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {{ stack.projectId }}
            </span>
          </div>

          <p v-if="stack.app?.short_description" class="text-sm text-slate-500 dark:text-slate-400">
            {{ stack.app.short_description }}
          </p>

          <div class="flex flex-wrap gap-1.5 pt-0.5">
            <span
              v-for="tag in (stack.app?.tags || []).slice(0, 6)"
              :key="tag"
              class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
            >{{ tag }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-2 shrink-0">
          <a
            v-if="stack.app?.website"
            :href="stack.app.website"
            target="_blank"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Globe :size="13" />
            Website
          </a>
          <button
            v-if="stack.app"
            @click="router.push(`/apps/${stack.appId}`)"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ExternalLink :size="13" />
            App Page
          </button>
          <button
            @click="removeStack"
            :disabled="removing"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 :size="13" />
            {{ removing ? "Removing…" : "Remove Stack" }}
          </button>
        </div>
      </div>

      <!-- ── Published Ports ────────────────────────────────────────────────── -->
      <div v-if="enrichedPorts.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Network :size="13" />
            Network Access
          </h2>
          <!-- Toggle only shown when there are described ports -->
          <div v-if="hasDescribedPorts" class="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-slate-900/50 p-1">
            <button
              @click="showOnlyDescribedPorts = false"
              :class="!showOnlyDescribedPorts ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
              class="px-3 py-1.5 text-xs rounded-full transition-all font-medium"
            >All Ports</button>
            <button
              @click="showOnlyDescribedPorts = true"
              :class="showOnlyDescribedPorts ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
              class="px-3 py-1.5 text-xs rounded-full transition-all font-medium"
            >Described</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="(p, i) in visiblePorts"
            :key="i"
            class="bg-white dark:bg-[#1c1c1e] border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 hover:shadow-md hover:border-blue-500/50 transition-all"
          >
            <div class="flex items-start gap-3 mb-4">
              <div class="w-11 h-11 rounded-xl bg-linear-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Network :size="20" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-mono text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{{ p.protocol }}</span>
                  <span v-if="p.labeledProtocol" class="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg uppercase font-semibold">{{ p.labeledProtocol }}</span>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {{ p.label || p.service }}
                </div>
              </div>
            </div>

            <div class="space-y-2 mb-4">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500">Host Port</span>
                <span class="font-mono font-bold text-slate-900 dark:text-white">{{ p.hostPort }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500">Container Port</span>
                <span class="font-mono text-slate-700 dark:text-slate-300">{{ p.containerPort }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500">Service</span>
                <span class="font-mono text-slate-500 dark:text-slate-400">{{ p.service }}</span>
              </div>
            </div>

            <a
              v-if="p.protocol === 'tcp'"
              :href="appUrl(p.hostPort, p.labeledProtocol || 'http')"
              target="_blank"
              class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-semibold"
            >
              <ExternalLink :size="14" />
              Open
            </a>
            <div v-else class="w-full flex items-center justify-center px-3 py-2 bg-slate-100 dark:bg-slate-800/50 text-slate-400 rounded-lg text-xs">
              {{ p.protocol.toUpperCase() }} Port
            </div>
          </div>
        </div>
      </div>

      <div v-else class="bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-5 flex items-center gap-3 text-slate-400">
        <Network :size="18" class="shrink-0" />
        <span class="text-sm">No ports published to host — all services communicate internally.</span>
      </div>

      <!-- ── Storage (Named Volumes) ────────────────────────────────────── -->
      <div v-if="namedVolumes.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <HardDrive :size="13" />
            Storage
          </h2>
          <button
            v-if="s3Configured && namedVolumes.length > 0"
            @click="backupAll"
            :disabled="backingUp"
            class="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
          >{{ backingUp ? 'Backing up…' : 'Backup All' }}</button>
        </div>

        <!-- S3 warning -->
        <div v-if="!s3Configured" class="bg-yellow-100/50 dark:bg-yellow-900/20 rounded-xl p-3.5 flex items-start gap-3">
          <AlertCircle :size="16" class="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <p class="text-xs text-yellow-900 dark:text-yellow-200">
            <span class="font-semibold">S3 storage not configured.</span>
            <router-link to="/minioconfig" class="underline hover:text-yellow-950 dark:hover:text-yellow-100 font-semibold ml-1">Configure now</router-link> to enable backups.
          </p>
        </div>

        <div class="grid gap-3">
          <div
            v-for="vol in namedVolumes"
            :key="vol.name"
            class="bg-white dark:bg-[#1c1c1e] border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 hover:shadow-md hover:border-blue-500/50 transition-all"
          >
            <div class="flex items-start gap-3.5 mb-4">
              <div class="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <HardDrive :size="22" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-slate-900 dark:text-white truncate" :title="vol.name">{{ vol.name }}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">{{ vol.destination }}</div>
                <div class="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                  Service: <span class="font-medium text-slate-600 dark:text-slate-300">{{ vol.svcName }}</span>
                  <span v-if="s3Configured" class="ml-3">Backup: <span class="font-medium">{{ getLatestBackupAge(vol.name) }}</span></span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <!-- Browse -->
              <div v-if="browsingVolume[vol.name]" class="text-xs text-blue-600 dark:text-blue-400 animate-pulse font-medium px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                Starting WebDAV server…
              </div>
              <button
                v-else-if="!showVolumeMenu[vol.name]"
                @click="showVolumeMenu[vol.name] = true"
                class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <FolderOpen :size="13" />
                Browse Files
              </button>
              <div v-else class="flex items-center gap-1.5">
                <button @click="browseVolume(vol.name, 60)" class="px-2.5 py-2 text-[10px] font-bold uppercase bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all" title="1 Hour Access">1H</button>
                <button @click="browseVolume(vol.name, 0)" class="px-2.5 py-2 text-[10px] font-bold uppercase bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-600 dark:hover:bg-slate-500 transition-all" title="Permanent Access">Perm</button>
              </div>
              <!-- Backup -->
              <button
                @click="backupVolume(vol.svcId)"
                :disabled="backingUp || !s3Configured"
                class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >Backup</button>
              <!-- Restore -->
              <button
                @click="toggleRestoreMenu(vol.name)"
                :disabled="!hasBackups(vol.name) || !s3Configured"
                class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >Restore</button>
            </div>

            <!-- Restore dropdown -->
            <div
              v-if="showRestoreMenu[vol.name] && hasBackups(vol.name)"
              class="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50"
            >
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Available Backups</div>
              <div class="space-y-1.5 max-h-40 overflow-y-auto">
                <div
                  v-for="backup in volumeBackups[vol.name]"
                  :key="backup.key"
                  class="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-all"
                >
                  <div class="flex-1 min-w-0">
                    <div class="font-mono text-xs text-slate-900 dark:text-white">{{ formatBackupDate(backup.timestamp) }}</div>
                    <div class="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">{{ formatBytes(backup.size) }}</div>
                  </div>
                  <div class="flex gap-1.5 ml-3">
                    <button @click="restoreBackup(vol.name, backup.key)" class="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-[10px] font-bold">Restore</button>
                    <button @click="deleteBackupFile(vol.name, backup.key)" class="px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-[10px] font-bold">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bind / tmpfs mounts compact list -->
      <div v-if="otherMounts.length > 0" class="space-y-3">
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <HardDrive :size="13" />
          Bind Mounts
        </h2>
        <div class="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-sm">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/50 dark:border-slate-800/50">
                <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Type</th>
                <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Host Path</th>
                <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Container Path</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
              <tr v-for="(m, i) in otherMounts" :key="i" class="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                <td class="px-4 py-3">
                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded border"
                    :class="m.type === 'bind' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'"
                  >{{ m.type }}</span>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300 break-all max-w-xs">{{ m.source || '—' }}</td>
                <td class="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 break-all max-w-xs">{{ m.destination }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Containers ─────────────────────────────────────────────────────── -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Server :size="13" />
            Containers
          </h2>
          <span class="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            {{ stack.services.length }}
          </span>
        </div>

        <div class="grid gap-3">
          <div
            v-for="svc in stack.services"
            :key="svc.id"
            class="bg-white dark:bg-[#1c1c1e] border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 hover:shadow-md transition-all"
            :class="svc.state === 'running' ? 'hover:border-emerald-500/40' : 'hover:border-slate-400/40'"
          >
            <!-- Top row: icon + name/image + uptime -->
            <div class="flex items-start gap-3.5 mb-4">
              <!-- State icon -->
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm relative"
                :class="svc.state === 'running'
                  ? 'bg-linear-to-br from-emerald-500 to-emerald-600'
                  : 'bg-linear-to-br from-slate-400 to-slate-500'"
              >
                <Server :size="22" />
                <!-- Ping indicator for running -->
                <span
                  v-if="svc.state === 'running'"
                  class="absolute -top-1 -right-1 flex h-3 w-3"
                >
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-[#1c1c1e]"></span>
                </span>
              </div>

              <!-- Name + image + badges -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap mb-0.5">
                  <span class="font-semibold text-slate-900 dark:text-white text-sm">{{ svc.service }}</span>
                  <span
                    class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border"
                    :class="svc.state === 'running'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'"
                  >{{ svc.state }}</span>
                  <span
                    v-if="svc.hasYantrLabel"
                    class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50"
                  >primary</span>
                </div>
                <div class="font-mono text-xs text-slate-500 dark:text-slate-400 truncate" :title="svc.image">{{ svc.image }}</div>
              </div>

              <!-- Uptime -->
              <div v-if="formatUptime(svc)" class="text-right shrink-0 hidden sm:block">
                <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Uptime</div>
                <div class="font-mono font-bold text-sm tabular-nums text-slate-700 dark:text-slate-200">{{ formatUptime(svc) }}</div>
              </div>
              <div v-else-if="svc.state !== 'running'" class="text-xs text-slate-400 italic hidden sm:block self-center">Stopped</div>
            </div>

            <!-- Bottom row: ports + logs button -->
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <!-- Ports -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <!-- Published ports -->
                <template v-if="svc.rawPorts.filter(p => p.PublicPort).length > 0">
                  <span
                    v-for="p in [...new Map(svc.rawPorts.filter(rp => rp.PublicPort).map(rp => [`${rp.PublicPort}:${rp.PrivatePort}:${rp.Type}`, rp])).values()]"
                    :key="`${p.PublicPort}-${p.Type}`"
                    class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                  >
                    <Network :size="9" />
                    :{{ p.PublicPort }} → {{ p.PrivatePort }}
                  </span>
                </template>
                <!-- Internal-only ports (not exposed to host) -->
                <template v-else-if="svc.rawPorts.length > 0">
                  <span
                    v-for="p in [...new Map(svc.rawPorts.map(rp => [`${rp.PrivatePort}:${rp.Type}`, rp])).values()]"
                    :key="`internal-${p.PrivatePort}-${p.Type}`"
                    class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    title="Internal port (not published to host)"
                  >
                    <Network :size="9" />
                    {{ p.PrivatePort }}/{{ p.Type }}
                  </span>
                </template>
              </div>

              <!-- Logs button -->
              <button
                @click="router.push(`/containers/${svc.id}`)"
                class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 transition-all shrink-0"
              >
                <Terminal :size="12" />
                Logs
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Configuration (Env Vars) ───────────────────────────────────────── -->
      <div v-if="stackEnvVars.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Settings2 :size="13" />
            Configuration
          </h2>
          <span class="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{{ stackEnvVars.length }}</span>
        </div>

        <div class="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800/50">
          <div
            v-for="v in stackEnvVars"
            :key="v.key"
            class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
          >
            <!-- Key -->
            <div class="w-56 shrink-0 min-w-0">
              <span class="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 truncate block" :title="v.key">{{ v.key }}</span>
              <span v-if="stackEnvVars.some(x => x.key === v.key && x.service !== v.service) || stack.services.length > 1"
                class="text-[10px] text-slate-400 dark:text-slate-500">{{ v.service }}</span>
            </div>

            <!-- Value -->
            <div class="flex-1 min-w-0">
              <span
                v-if="!isSensitive(v.key) || revealedVars.has(v.key)"
                class="font-mono text-xs text-slate-900 dark:text-slate-100 break-all select-all"
              >{{ v.value || '—' }}</span>
              <span v-else class="font-mono text-xs text-slate-400 dark:text-slate-500 tracking-widest select-none">••••••••</span>
            </div>

            <!-- Reveal toggle for sensitive vars -->
            <button
              v-if="isSensitive(v.key)"
              @click="toggleReveal(v.key)"
              class="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              :title="revealedVars.has(v.key) ? 'Hide' : 'Show'"
            >
              <EyeOff v-if="revealedVars.has(v.key)" :size="14" />
              <Eye v-else :size="14" />
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
