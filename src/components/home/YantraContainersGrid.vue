<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Box, Layers } from "lucide-vue-next";

const props = defineProps({
  containers: { type: Array, default: () => [] },
  formatUptime: { type: Function, required: true },
  isTemporary: { type: Function, required: true },
  getExpirationInfo: { type: Function, required: true },
});

const router = useRouter();

// Group individual containers into app stacks by app.id
const appGroups = computed(() => {
  const map = new Map();
  for (const c of props.containers) {
    const appId = c.app?.id;
    if (!appId) continue;
    if (!map.has(appId)) {
      map.set(appId, {
        appId,
        name: c.app?.name || appId,
        logo: c.app?.logo || null,
        containers: [],
      });
    }
    map.get(appId).containers.push(c);
  }
  return [...map.values()];
});

function primaryContainer(group) {
  return group.containers.find((c) => c.state === "running") || group.containers[0];
}

function groupState(group) {
  const states = group.containers.map((c) => c.state);
  if (states.every((s) => s === "running")) return "running";
  if (states.some((s) => s === "running")) return "partial";
  return "stopped";
}

function hasTemporary(group) {
  return group.containers.some((c) => props.isTemporary(c));
}

function navigate(group) {
  // Always go to app overview which shows stacks + link to detail page
  router.push(`/app/${group.appId}`);
}
</script>

<template>
  <div style="display: contents">
    <div
      v-for="(group, index) in appGroups"
      :key="group.appId"
      :style="{ animationDelay: `${index * 50}ms` }"
      @click="navigate(group)"
      @keydown.enter.prevent="navigate(group)"
      @keydown.space.prevent="navigate(group)"
      role="button"
      tabindex="0"
      class="group relative h-full overflow-hidden bg-white dark:bg-slate-900 rounded-none border border-slate-200 dark:border-slate-800 hover:shadow-xl dark:hover:shadow-slate-900/50 hover:-translate-y-1 transition-all duration-300 animate-fadeIn cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/20"
    >
      <!-- Background Texture -->
      <div
        class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none transition-opacity duration-300 group-hover:opacity-[0.06] dark:group-hover:opacity-[0.08]"
        style="background-image: radial-gradient(circle at 1rem 1rem, currentColor 1px, transparent 0); background-size: 1rem 1rem;"
      ></div>

      <!-- Hover Glow -->
      <div class="absolute top-0 right-0 w-32 h-32 bg-blue-100 dark:bg-blue-900/40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

      <div class="relative z-10 h-full flex flex-col justify-between p-6">
        <div>
          <div class="flex items-start justify-between mb-3">
            <div class="min-w-0 flex-1">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 mb-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {{ group.name }}
              </h3>

              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border"
                  :class="groupState(group) === 'running'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : groupState(group) === 'partial'
                      ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'"
                >{{ groupState(group) === 'partial' ? 'partial' : groupState(group) }}</span>

                <span
                  v-if="group.containers.length > 1"
                  class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 flex items-center gap-1"
                >
                  <Layers :size="9" />
                  {{ group.containers.length }} services
                </span>

                <span
                  v-if="hasTemporary(group)"
                  class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                >Temp</span>
              </div>
            </div>

            <!-- Status Dot -->
            <div class="relative flex h-3 w-3 mt-1.5 shrink-0">
              <span
                v-if="groupState(group) === 'running'"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-3 w-3"
                :class="groupState(group) === 'running'
                  ? 'bg-emerald-500'
                  : groupState(group) === 'partial'
                    ? 'bg-amber-500'
                    : 'bg-slate-300 dark:bg-slate-600'"
              ></span>
            </div>
          </div>

          <!-- Service name pills -->
          <div class="flex flex-wrap gap-1 mb-4">
            <span
              v-for="c in group.containers"
              :key="c.id"
              class="text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1"
              :class="c.state === 'running'
                ? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800'"
            >
              <span
                class="inline-block w-1.5 h-1.5 rounded-full"
                :class="c.state === 'running' ? 'bg-emerald-500' : 'bg-slate-400'"
              ></span>
              {{ c.app?.service || c.name }}
            </span>
          </div>

          <!-- Bottom Row: Uptime + Logo -->
          <div class="flex items-end justify-between gap-4">
            <div class="flex-1 space-y-2 min-w-0">
              <div v-if="groupState(group) !== 'stopped'" class="flex flex-col gap-0.5">
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Uptime</span>
                <span class="font-mono font-bold text-base tabular-nums text-slate-700 dark:text-slate-200">{{ formatUptime(primaryContainer(group)) }}</span>
              </div>
              <div v-else class="flex flex-col gap-0.5">
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</span>
                <span class="font-medium text-sm text-slate-500 dark:text-slate-400 italic">Not running</span>
              </div>

              <div v-if="hasTemporary(group)" class="pt-1">
                <span class="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500/80 block mb-0.5">Expires In</span>
                <span
                  class="font-mono text-sm font-bold tabular-nums"
                  :class="getExpirationInfo(primaryContainer(group))?.timeRemaining === 'Expired'
                    ? 'text-rose-600 dark:text-rose-400'
                    : getExpirationInfo(primaryContainer(group))?.isExpiringSoon
                      ? 'text-amber-600 dark:text-amber-400 animate-pulse underline'
                      : 'text-amber-800 dark:text-amber-300'"
                >{{ getExpirationInfo(primaryContainer(group))?.timeRemaining }}</span>
              </div>
            </div>

            <!-- Logo -->
            <div class="relative shrink-0">
              <div class="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-md transition-all duration-500 ease-out overflow-hidden">
                <img
                  v-if="group.logo"
                  :src="group.logo"
                  :alt="group.name"
                  class="w-10 h-10 object-contain drop-shadow-sm"
                />
                <Box v-else class="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
