<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApiUrl } from "../composables/useApiUrl";
import { useCurrentTime } from "../composables/useCurrentTime";
import { formatDuration } from "../utils/metrics";
import {
  ArrowLeft, Layers, Server, Activity, Package, ExternalLink, Play, Clock,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const { apiUrl } = useApiUrl();
const { currentTime } = useCurrentTime();

const appId = computed(() => route.params.appId);

const app = ref(null);
const containers = ref([]);
const loading = ref(true);

// Group containers for this app by compose project
const runningStacks = computed(() => {
  const appContainers = containers.value.filter((c) => c.app?.id === appId.value);
  const map = new Map();
  for (const c of appContainers) {
    const key = c.app?.projectId || c.id;
    if (!map.has(key)) map.set(key, { projectId: key, services: [] });
    map.get(key).services.push(c);
  }
  return [...map.values()];
});

function stackState(stack) {
  const states = stack.services.map((s) => s.state);
  if (states.every((s) => s === "running")) return "running";
  if (states.some((s) => s === "running")) return "partial";
  return "stopped";
}

function stackUptime(stack) {
  const running = stack.services.filter((s) => s.state === "running" && s.created);
  if (!running.length) return null;
  const oldest = Math.min(...running.map((s) => s.created * 1000));
  const delta = currentTime.value - oldest;
  if (delta <= 0) return "Just started";
  return formatDuration(delta);
}

function stackExpiry(stack) {
  // Find first temporary container in the stack
  for (const svc of stack.services) {
    const expireAt = svc.labels?.["yantr.expireAt"];
    if (expireAt) {
      const remaining = parseInt(expireAt, 10) * 1000 - currentTime.value;
      if (remaining <= 0) return { label: 'Expired', expired: true, soon: false };
      const totalSeconds = Math.floor(remaining / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const seconds = totalSeconds % 60;
      const label = hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      return { label, expired: false, soon: remaining < 60 * 60 * 1000 };
    }
  }
  return null;
}

async function fetchData() {
  try {
    const [appsRes, containersRes] = await Promise.all([
      fetch(`${apiUrl.value}/api/apps`),
      fetch(`${apiUrl.value}/api/containers`),
    ]);
    const appsData = await appsRes.json();
    const containersData = await containersRes.json();
    app.value = (appsData.apps || appsData).find((a) => a.id === appId.value) || null;
    containers.value = containersData.containers || containersData || [];

    // Auto-redirect when there is exactly one running instance
    if (loading.value && runningStacks.value.length === 1) {
      router.replace(`/stacks/${runningStacks.value[0].projectId}`);
      return;
    }
  } catch (e) {
    console.error("AppOverview fetch error", e);
  } finally {
    loading.value = false;
  }
}

let interval = null;
onMounted(() => {
  fetchData();
  interval = setInterval(fetchData, 8000);
});
onUnmounted(() => clearInterval(interval));
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] px-4 py-6 sm:px-6 lg:px-8">

    <!-- Header -->
    <div class="max-w-5xl mx-auto mb-8">
      <button
        @click="router.back()"
        class="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors mb-6"
      >
        <ArrowLeft :size="16" />
        Back
      </button>

      <!-- Loading skeleton -->
      <div v-if="loading" class="flex items-center gap-4 animate-pulse">
        <div class="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0"></div>
        <div class="space-y-2">
          <div class="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div class="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
      </div>

      <!-- App identity -->
      <div v-else-if="app" class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
          <img v-if="app.logo" :src="app.logo" :alt="app.name" class="w-10 h-10 object-contain" />
          <Package v-else :size="28" class="text-slate-400" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ app.name }}</h1>
          <p v-if="app.short_description" class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{{ app.short_description }}</p>
          <div v-if="app.tags?.length" class="flex flex-wrap gap-1.5 mt-2">
            <span
              v-for="tag in app.tags.slice(0, 6)"
              :key="tag"
              class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            >{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-5xl mx-auto space-y-8">

      <!-- ── Row 1: Running Instances ─────────────────────────────────────── -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <Activity :size="15" class="text-slate-400" />
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">Running Instances</h2>
          <span
            v-if="runningStacks.length"
            class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
          >{{ runningStacks.length }}</span>
        </div>

        <!-- No stacks -->
        <div
          v-if="!loading && runningStacks.length === 0"
          class="flex items-center gap-3 px-5 py-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-sm"
        >
          <Server :size="16" />
          No running instances — deploy from the app page below.
        </div>

        <!-- Stack cards -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="(stack, idx) in runningStacks"
            :key="stack.projectId"
            @click="router.push(`/stacks/${stack.projectId}`)"
            role="button"
            tabindex="0"
            @keydown.enter.prevent="router.push(`/stacks/${stack.projectId}`)"
            class="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <!-- State indicator bar -->
            <div
              class="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl transition-all"
              :class="{
                'bg-emerald-500': stackState(stack) === 'running',
                'bg-amber-400': stackState(stack) === 'partial',
                'bg-slate-300 dark:bg-slate-700': stackState(stack) === 'stopped',
              }"
            ></div>

            <div class="flex items-start justify-between gap-2 mb-4">
              <div class="flex items-center gap-2 min-w-0">
                <Layers :size="15" class="text-slate-400 shrink-0" />
                <span class="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">{{ stack.projectId }}</span>
              </div>
              <!-- Multiple instances badge -->
              <span
                v-if="runningStacks.length > 1"
                class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0"
              >#{{ idx + 1 }}</span>
            </div>

            <!-- Services list -->
            <div class="space-y-1.5 mb-4">
              <div
                v-for="svc in stack.services"
                :key="svc.id"
                class="flex items-center gap-2"
              >
                <div class="relative flex h-2 w-2 shrink-0">
                  <span
                    v-if="svc.state === 'running'"
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
                  ></span>
                  <span
                    class="relative inline-flex rounded-full h-2 w-2"
                    :class="svc.state === 'running' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"
                  ></span>
                </div>
                <span class="text-xs text-slate-700 dark:text-slate-300 truncate">{{ svc.app?.service || svc.name }}</span>
                <span
                  class="ml-auto text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0"
                  :class="svc.state === 'running'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'"
                >{{ svc.state }}</span>
              </div>
            </div>

            <!-- Footer: uptime + expiry + service count -->
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div class="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{{ stack.services.length }} service{{ stack.services.length !== 1 ? 's' : '' }}</span>
                <span v-if="stackUptime(stack)" class="flex items-center gap-1">
                  <Clock :size="10" />
                  {{ stackUptime(stack) }}
                </span>
              </div>
              <!-- Expiry timer -->
              <div v-if="stackExpiry(stack)" class="flex items-center justify-between">
                <span class="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500">Expires in</span>
                <span
                  class="text-[11px] font-mono font-bold tabular-nums"
                  :class="stackExpiry(stack).expired
                    ? 'text-rose-600 dark:text-rose-400'
                    : stackExpiry(stack).soon
                      ? 'text-amber-500 dark:text-amber-400 animate-pulse'
                      : 'text-amber-700 dark:text-amber-300'"
                >{{ stackExpiry(stack).label }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Row 2: App Detail link ────────────────────────────────────────── -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <Package :size="15" class="text-slate-400" />
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">Application</h2>
        </div>

        <div
          @click="router.push(`/apps/${appId}`)"
          role="button"
          tabindex="0"
          @keydown.enter.prevent="router.push(`/apps/${appId}`)"
          class="group flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-6 py-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
              <img v-if="app?.logo" :src="app.logo" :alt="app?.name" class="w-6 h-6 object-contain" />
              <Package v-else :size="18" class="text-slate-400" />
            </div>
            <div>
              <div class="text-sm font-semibold text-slate-900 dark:text-white">App Details &amp; Installation</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Docs, environment variables, port requirements, deploy options</div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
              <Play :size="12" />
              Deploy
            </span>
            <ExternalLink :size="16" class="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          </div>
        </div>
      </section>

    </div>
  </div>
</template>
