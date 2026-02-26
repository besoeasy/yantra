<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApiUrl } from "../composables/useApiUrl";
import { useCurrentTime } from "../composables/useCurrentTime";
import { useNotification } from "../composables/useNotification";
import { formatDuration } from "../utils/metrics";
import {
  ArrowLeft, Globe, ExternalLink, Bot, Activity, Layers,
  Terminal, Server, Network, Trash2, RefreshCw, HardDrive,
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

// Parse described ports from info.json port string, e.g. "3333 (HTTP - Web UI), 3334 (TCP - DHT)"
function parsePortLabels(portStr) {
  const labels = {};
  if (!portStr) return labels;
  const regex = /(\d+)\s*\(([^-)]+)\s*-\s*([^)]+)\)/g;
  let m;
  while ((m = regex.exec(portStr)) !== null) {
    labels[m[1]] = { protocol: m[2].trim().toLowerCase(), label: m[3].trim() };
  }
  return labels;
}

// Merge published ports with described labels from info.json
const enrichedPorts = computed(() => {
  if (!stack.value) return [];
  const portLabels = parsePortLabels(stack.value.app?.port);
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

// Collect all unique mounts across all services
const allMounts = computed(() => {
  if (!stack.value) return [];
  const seen = new Set();
  const result = [];
  for (const svc of stack.value.services) {
    for (const m of (svc.mounts || [])) {
      const key = `${m.type}:${m.source}:${m.destination}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ ...m, svcName: svc.service });
      }
    }
  }
  // Sort: named volumes first, then bind mounts, then tmpfs
  const order = { volume: 0, bind: 1, tmpfs: 2 };
  result.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
  return result;
});

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

onMounted(async () => {
  await fetchStack();
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

      <!-- ── Volume Mounts ──────────────────────────────────────────────────── -->
      <div v-if="allMounts.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <HardDrive :size="13" />
            Volume Mounts
          </h2>
          <span class="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{{ allMounts.length }}</span>
        </div>

        <div class="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-sm">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/50 dark:border-slate-800/50">
                <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Type</th>
                <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Source</th>
                <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Container Path</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
              <tr
                v-for="(m, i) in allMounts"
                :key="i"
                class="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
              >
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border"
                    :class="{
                      'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50': m.type === 'volume',
                      'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50': m.type === 'bind',
                      'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700': m.type === 'tmpfs',
                    }"
                  >{{ m.type }}</span>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300 break-all max-w-xs">
                  {{ m.name || m.source || '—' }}
                </td>
                <td class="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 break-all max-w-xs">
                  {{ m.destination }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Services ───────────────────────────────────────────────────────── -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Layers :size="13" />
            Services
          </h2>
          <span class="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            {{ stack.services.length }}
          </span>
        </div>

        <div class="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800/50">
          <div
            v-for="svc in stack.services"
            :key="svc.id"
            class="group flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
          >
            <!-- State indicator -->
            <div class="relative flex h-3 w-3 shrink-0">
              <span
                v-if="svc.state === 'running'"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-3 w-3"
                :class="svc.state === 'running' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"
              ></span>
            </div>

            <!-- Service info -->
            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-center gap-2.5 flex-wrap">
                <span class="font-semibold text-slate-800 dark:text-slate-100 text-sm">{{ svc.service }}</span>
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

              <div class="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                <span class="font-mono truncate max-w-65 sm:max-w-none">{{ svc.image }}</span>
                <span v-if="svc.info" class="hidden sm:block">·</span>
                <span v-if="svc.info" class="hidden sm:block truncate max-w-xs">{{ svc.info }}</span>
              </div>

              <!-- Per-service ports (deduplicated) -->
              <div v-if="svc.rawPorts.filter(p => p.PublicPort).length > 0" class="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span
                  v-for="p in [...new Map(svc.rawPorts.filter(rp => rp.PublicPort).map(rp => [`${rp.PublicPort}:${rp.PrivatePort}:${rp.Type}`, rp])).values()]"
                  :key="`${p.PublicPort}-${p.Type}`"
                  class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                >
                  <Network :size="9" />
                  :{{ p.PublicPort }} → {{ p.PrivatePort }}
                </span>
              </div>
            </div>

            <!-- Uptime -->
            <div class="text-right shrink-0 hidden sm:block">
              <div v-if="formatUptime(svc)" class="flex flex-col items-end gap-0.5">
                <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Uptime</span>
                <span class="font-mono font-bold text-sm tabular-nums text-slate-700 dark:text-slate-200">{{ formatUptime(svc) }}</span>
              </div>
              <div v-else-if="svc.state !== 'running'" class="text-xs text-slate-400 italic">Stopped</div>
            </div>

            <!-- Details button -->
            <button
              @click="router.push(`/containers/${svc.id}`)"
              class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Terminal :size="12" />
              Logs
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
