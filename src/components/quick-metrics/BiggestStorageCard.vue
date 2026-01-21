<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { HardDrive } from 'lucide-vue-next'
import TreemapChart from '../charts/TreemapChart.vue'
import { formatBytes, pickImageDisplayName } from '../../utils/metrics.js'

const props = defineProps({
  images: { type: Array, default: () => [] }
})

const isDark = ref(false)
let themeObserver = null

function syncTheme() {
  isDark.value = document.documentElement.classList.contains('dark')
}

onMounted(() => {
  syncTheme()
  themeObserver = new MutationObserver(syncTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', syncTheme)
})

onUnmounted(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.removeEventListener('change', syncTheme)
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
})

const biggestImages = computed(() => {
  const rows = Array.isArray(props.images) ? props.images : []
  return [...rows]
    .filter((img) => (Number(img?.sizeBytes) || 0) > 0)
    .sort((a, b) => (Number(b?.sizeBytes) || 0) - (Number(a?.sizeBytes) || 0))
    .slice(0, 10)
})

const treemapData = computed(() => {
  if (biggestImages.value.length === 0) return []
  return biggestImages.value.map((img) => ({
    x: pickImageDisplayName(img),
    y: Math.max(1, Number(img?.sizeBytes) || 0)
  }))
})

const totalTop10Bytes = computed(() => biggestImages.value.reduce((sum, img) => sum + (Number(img?.sizeBytes) || 0), 0))
</script>

<template>
  <div class="relative h-full overflow-hidden group rounded-2xl transition-all duration-500 hover:-translate-y-1">
    <div class="absolute inset-0 bg-white dark:bg-gray-900">
      <div class="absolute inset-0 bg-linear-to-br from-indigo-200/60 via-slate-200/30 to-white/80 dark:from-indigo-600/25 dark:via-slate-600/10 dark:to-gray-900 z-10"></div>
      <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-300/35 dark:bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-400/45 dark:group-hover:bg-indigo-500/30 transition-colors duration-700"></div>
      <div class="absolute bottom-0 left-0 w-48 h-48 bg-slate-300/30 dark:bg-slate-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-slate-400/40 dark:group-hover:bg-slate-500/30 transition-colors duration-700"></div>
    </div>

    <div class="relative z-20 h-full p-6 flex flex-col justify-between border border-slate-200/80 dark:border-slate-700/60 rounded-2xl backdrop-blur-sm group-hover:border-indigo-300/60 dark:group-hover:border-indigo-500/30 transition-none">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative">
            <div class="absolute inset-0 bg-indigo-400/25 dark:bg-indigo-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
            <div class="relative w-12 h-12 bg-linear-to-br from-indigo-500 to-slate-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
              <HardDrive class="w-6 h-6 text-white" />
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-200 transition-colors">Biggest Storage</h3>
            <p class="text-sm font-medium text-slate-600 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-300 transition-colors">Top 10 largest images</p>
          </div>
        </div>

        <div class="text-right">
          <div class="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Top 10 total</div>
          <div class="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">{{ formatBytes(totalTop10Bytes) }}</div>
        </div>
      </div>

      <div class="mt-5">
        <div v-if="treemapData.length === 0" class="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-white/5 px-4 py-8 text-center">
          <div class="text-sm font-semibold text-slate-700 dark:text-gray-200">No image data</div>
          <div class="text-xs text-slate-500 dark:text-gray-400 mt-1">Start a container to pull images.</div>
        </div>

        <div v-else class="rounded-2xl p-4 bg-white/60 dark:bg-transparent">
          <TreemapChart :data="treemapData" :height="240" :theme="isDark ? 'dark' : 'light'" :value-formatter="formatBytes" />
          <div class="mt-2 text-[11px] text-slate-500 dark:text-gray-400">Sized by image bytes</div>
        </div>
      </div>
    </div>
  </div>
</template>
