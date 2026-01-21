<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Layers, Trophy } from "lucide-vue-next";
import TreemapChart from "../charts/TreemapChart.vue";
import { computeCategoryStats, formatCategory } from "../../utils/metrics.js";

const props = defineProps({
  containers: { type: Array, default: () => [] },
});

const isDark = ref(false);
let themeObserver = null;

function syncTheme() {
  isDark.value = document.documentElement.classList.contains('dark');
}

onMounted(() => {
  syncTheme();
  themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', syncTheme);
});

onUnmounted(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.removeEventListener('change', syncTheme);
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
});

const categoryStats = computed(() => computeCategoryStats(props.containers));

const categoryTreemap = computed(() => {
  const rows = Array.isArray(categoryStats.value.all) ? categoryStats.value.all : [];
  if (rows.length === 0) return { data: [] };

  const sorted = [...rows].sort((a, b) => (Number(b?.[1]) || 0) - (Number(a?.[1]) || 0));
  const topN = 10;
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const otherCount = rest.reduce((sum, r) => sum + (Number(r?.[1]) || 0), 0);

  const data = top.map((r) => ({ x: formatCategory(r[0]), y: Number(r[1]) || 0 })).filter((d) => d.y > 0);

  if (otherCount > 0) data.push({ x: "Other", y: otherCount });

  return { data };
});

const topCategories = computed(() => {
  const rows = Array.isArray(categoryStats.value.all) ? categoryStats.value.all : [];
  if (rows.length === 0) return [];

  return [...rows]
    .sort((a, b) => (Number(b?.[1]) || 0) - (Number(a?.[1]) || 0))
    .slice(0, 4)
    .map((r) => ({ name: formatCategory(r?.[0]), count: Number(r?.[1]) || 0 }))
    .filter((r) => r.count > 0);
});
</script>

<template>
  <div v-if="categoryStats.appsCount > 0" class="relative h-full overflow-hidden group rounded-2xl transition-all duration-500 hover:-translate-y-1">
    <div class="absolute inset-0 bg-white dark:bg-gray-900">
      <div class="absolute inset-0 bg-linear-to-br from-emerald-200/60 via-green-200/30 to-white/80 dark:from-emerald-600/25 dark:via-green-600/10 dark:to-gray-900 z-10"></div>
      <div
        class="absolute top-0 right-0 w-64 h-64 bg-emerald-300/35 dark:bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-400/45 dark:group-hover:bg-emerald-500/30 transition-colors duration-700"
      ></div>
      <div
        class="absolute bottom-0 left-0 w-48 h-48 bg-green-300/30 dark:bg-green-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-green-400/40 dark:group-hover:bg-green-600/30 transition-colors duration-700"
      ></div>
    </div>

    <div
      class="relative z-20 h-full p-6 flex flex-col justify-between border border-slate-200/80 dark:border-slate-700/60 rounded-2xl backdrop-blur-sm group-hover:border-emerald-300/60 dark:group-hover:border-emerald-500/30 transition-none"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative">
            <div class="absolute inset-0 bg-emerald-400/25 dark:bg-emerald-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
            <div
              class="relative w-12 h-12 bg-linear-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500"
            >
              <Layers class="w-6 h-6 text-white" />
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-200 transition-colors">App Categories</h3>
            <p class="text-sm font-medium text-slate-600 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-300 transition-colors">Usage highlights</p>
          </div>
        </div>

        <div class="inline-flex items-center gap-2 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-slate-700/60 px-3 py-1.5">
          <span class="text-xs font-semibold text-slate-600 dark:text-gray-300">Apps</span>
          <span class="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">{{ categoryStats.appsCount }}</span>
        </div>
      </div>

      <div class="mt-5 space-y-4">
        <div class="rounded-2xl p-4 bg-white/60 dark:bg-transparent">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <div class="text-sm font-bold text-slate-900 dark:text-white">Category distribution</div>
              <div class="text-xs text-slate-500 dark:text-gray-400">Treemap by app count</div>
            </div>
            <div class="text-xs font-semibold text-slate-500 dark:text-gray-400">Hover tiles for exact</div>
          </div>

          <div v-if="categoryTreemap.data.length === 0" class="mt-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-white/5 px-4 py-6 text-center">
            <div class="text-sm font-semibold text-slate-700 dark:text-gray-200">No category data</div>
            <div class="text-xs text-slate-500 dark:text-gray-400 mt-1">Apps need categories to chart.</div>
          </div>

          <div v-else>
            <TreemapChart :data="categoryTreemap.data" :height="220" :theme="isDark ? 'dark' : 'light'" :value-formatter="(v) => `${v} app${v === 1 ? '' : 's'}`" />

            <div class="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-gray-400">
              <span>Top {{ Math.min(10, categoryStats.total) }} categories (plus “Other”)</span>
              <span v-if="categoryStats.total" class="inline-flex items-center gap-1.5">
                <Trophy class="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-300" />
                <span class="text-slate-600 dark:text-gray-300 font-semibold">{{ categoryStats.total }} total</span>
              </span>
            </div>

            <div v-if="topCategories.length > 0" class="mt-3 space-y-2">
              <div v-for="row in topCategories" :key="row.name" class="flex items-center justify-between gap-3 text-xs">
                <div class="min-w-0">
                  <div class="text-slate-700 dark:text-gray-200 font-semibold truncate" :title="row.name">{{ row.name }}</div>
                </div>
                <div class="shrink-0 font-bold tabular-nums text-emerald-600 dark:text-emerald-200">
                  {{ row.count }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
