<script setup>
import { computed } from 'vue'
import { HardDrive } from 'lucide-vue-next'
import DonutChart from '../charts/DonutChart.vue'
import { formatBytes } from '../../utils/metrics.js'

const props = defineProps({
  images: { type: Array, default: () => [] },
  volumes: { type: Array, default: () => [] }
})

const diskMetrics = computed(() => {
  const totalImagesSize = props.images.reduce((sum, img) => sum + (img.sizeBytes || 0), 0)
  const unusedImagesSize = props.images
    .filter(img => !img.isUsed)
    .reduce((sum, img) => sum + (img.sizeBytes || 0), 0)
  const usedImagesSize = totalImagesSize - unusedImagesSize

  const totalVolumesSize = props.volumes.reduce((sum, vol) => sum + (vol.sizeBytes || 0), 0)
  const unusedVolumesSize = props.volumes
    .filter(vol => !vol.isUsed)
    .reduce((sum, vol) => sum + (vol.sizeBytes || 0), 0)
  const usedVolumesSize = totalVolumesSize - unusedVolumesSize

  return {
    images: {
      total: totalImagesSize,
      used: usedImagesSize,
      unused: unusedImagesSize
    },
    volumes: {
      total: totalVolumesSize,
      used: usedVolumesSize,
      unused: unusedVolumesSize
    }
  }
})

const donuts = computed(() => {
  const images = diskMetrics.value.images
  const volumes = diskMetrics.value.volumes

  return {
    images: {
      total: images.total,
      used: images.used,
      unused: images.unused,
      series: [images.used, images.unused],
      labels: ['Used', 'Unused'],
      colors: ['#3b82f6', '#fdba74']
    },
    volumes: {
      total: volumes.total,
      used: volumes.used,
      unused: volumes.unused,
      series: [volumes.used, volumes.unused],
      labels: ['Used', 'Unused'],
      colors: ['#6366f1', '#fdba74']
    }
  }
})

const totalAll = computed(() => donuts.value.images.total + donuts.value.volumes.total)
</script>

<template>
  <div class="relative h-full overflow-hidden group rounded-2xl transition-all duration-500 hover:-translate-y-1">
    <div class="absolute inset-0 bg-gray-900">
      <div class="absolute inset-0 bg-linear-to-br from-blue-600/25 via-indigo-600/10 to-gray-900 z-10"></div>
      <div class="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/30 transition-colors duration-700"></div>
      <div class="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-indigo-600/30 transition-colors duration-700"></div>
    </div>

    <div class="relative z-20 h-full p-6 flex flex-col justify-between border border-white/5 rounded-2xl backdrop-blur-sm group-hover:border-blue-500/30 transition-colors duration-500">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative">
            <div class="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
            <div class="relative w-12 h-12 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
              <HardDrive class="w-6 h-6 text-white" />
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold text-white mb-1 group-hover:text-blue-200 transition-colors">Disk Usage</h3>
            <p class="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Used vs unused</p>
          </div>
        </div>

        <div class="text-right">
          <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</div>
          <div class="text-lg font-extrabold text-white tabular-nums">{{ formatBytes(totalAll) }}</div>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm font-bold text-white">Images</div>
            <div class="text-xs font-semibold text-gray-300 tabular-nums">{{ formatBytes(donuts.images.total) }}</div>
          </div>

          <div v-if="donuts.images.total === 0" class="mt-3 rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center">
            <div class="text-sm font-semibold text-gray-200">No image data</div>
            <div class="text-xs text-gray-400 mt-1">Nothing to visualize yet.</div>
          </div>

          <div v-else class="mt-3">
            <DonutChart
              :series="donuts.images.series"
              :labels="donuts.images.labels"
              :colors="donuts.images.colors"
              :height="185"
              donut-label="Images"
              theme="dark"
              :value-formatter="formatBytes"
              :total-formatter="() => formatBytes(donuts.images.total)"
            />

            <div class="mt-2 flex items-center justify-between text-xs text-gray-300">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: donuts.images.colors[0] }"></span>
                Used <span class="font-semibold tabular-nums">{{ formatBytes(donuts.images.used) }}</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: donuts.images.colors[1] }"></span>
                Unused <span class="font-semibold tabular-nums">{{ formatBytes(donuts.images.unused) }}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm font-bold text-white">Volumes</div>
            <div class="text-xs font-semibold text-gray-300 tabular-nums">{{ formatBytes(donuts.volumes.total) }}</div>
          </div>

          <div v-if="donuts.volumes.total === 0" class="mt-3 rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center">
            <div class="text-sm font-semibold text-gray-200">No volume data</div>
            <div class="text-xs text-gray-400 mt-1">Nothing to visualize yet.</div>
          </div>

          <div v-else class="mt-3">
            <DonutChart
              :series="donuts.volumes.series"
              :labels="donuts.volumes.labels"
              :colors="donuts.volumes.colors"
              :height="185"
              donut-label="Volumes"
              theme="dark"
              :value-formatter="formatBytes"
              :total-formatter="() => formatBytes(donuts.volumes.total)"
            />

            <div class="mt-2 flex items-center justify-between text-xs text-gray-300">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: donuts.volumes.colors[0] }"></span>
                Used <span class="font-semibold tabular-nums">{{ formatBytes(donuts.volumes.used) }}</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: donuts.volumes.colors[1] }"></span>
                Unused <span class="font-semibold tabular-nums">{{ formatBytes(donuts.volumes.unused) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
