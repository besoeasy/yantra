<script setup>
import { computed } from 'vue'
import { Sparkles, Activity } from 'lucide-vue-next'

const props = defineProps({
  runningApps: { type: Number, default: 0 },
  totalVolumes: { type: Number, default: 0 }
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})
</script>

<template>
  <div class="relative h-full overflow-hidden group rounded-2xl transition-all duration-500 hover:-translate-y-1">
    <!-- Background Mesh -->
    <div class="absolute inset-0 bg-white dark:bg-gray-900">
      <div class="absolute inset-0 bg-linear-to-br from-blue-200/60 via-purple-200/30 to-white/80 dark:from-blue-600/25 dark:via-purple-600/10 dark:to-gray-900 z-10"></div>

      <!-- Orbs -->
      <div
        class="absolute top-0 right-0 w-64 h-64 bg-blue-300/35 dark:bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-400/45 dark:group-hover:bg-blue-500/30 transition-colors duration-700"
      ></div>
      <div
        class="absolute bottom-0 left-0 w-48 h-48 bg-purple-300/30 dark:bg-purple-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-purple-400/40 dark:group-hover:bg-purple-600/30 transition-colors duration-700"
      ></div>
    </div>

    <!-- Content Container -->
    <div class="relative z-20 h-full p-6 flex flex-col justify-between border border-slate-200/80 dark:border-slate-700/60 rounded-2xl backdrop-blur-sm group-hover:border-blue-500/30 transition-none">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <!-- Icon Container -->
          <div class="relative">
            <div class="absolute inset-0 bg-blue-400/25 dark:bg-blue-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
            <div
              class="relative w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500"
            >
              <Sparkles class="w-6 h-6 text-white" />
            </div>
          </div>

          <div>
            <h1 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-200 transition-colors">
              {{ greeting }}
            </h1>
            <p class="text-sm font-medium text-slate-600 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-300 transition-colors">
              Here's what's happening with your system today.
            </p>
          </div>
        </div>

        <!-- Status Dot -->
        <span class="relative flex h-3 w-3 mt-1">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-3">
        <div class="rounded-2xl px-4 py-3">
          <div class="text-3xl font-extrabold text-slate-900 dark:text-white leading-none tabular-nums">{{ props.runningApps }}</div>
          <div class="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mt-1">Running Apps</div>
        </div>
        <div class="rounded-2xl px-4 py-3">
          <div class="text-3xl font-extrabold text-slate-900 dark:text-white leading-none tabular-nums">{{ props.totalVolumes }}</div>
          <div class="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mt-1">Volumes</div>
        </div>
      </div>

      <div class="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between group-hover:border-blue-200/70 dark:group-hover:border-slate-600/70 transition-colors">
        <div class="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-300 uppercase tracking-wider">
          <Activity class="w-3.5 h-3.5" />
          <span>Overview</span>
        </div>
        <div class="text-sm font-bold text-slate-800 dark:text-white/90 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
          Dashboard
        </div>
      </div>
    </div>
  </div>
</template>
