<script setup>
import { computed } from 'vue'

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
  <div class="group relative rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-300 hover:shadow-xl hover:shadow-gray-900/5">
    <div
      class="absolute inset-0 rounded-2xl bg-linear-to-br from-blue-50/0 to-purple-50/0 group-hover:from-blue-50/70 group-hover:to-purple-50/30 transition-all duration-300 pointer-events-none"
    ></div>

    <div class="relative z-10">
      <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
        {{ greeting }}
      </h1>
      <p class="text-sm sm:text-base text-gray-500 font-medium mt-1">Here's what's happening with your system today.</p>

      <div class="mt-5 grid grid-cols-2 gap-3">
        <div class="rounded-2xl border border-gray-100 bg-white/70 px-4 py-3">
          <div class="text-3xl font-extrabold text-gray-900 leading-none tabular-nums">{{ props.runningApps }}</div>
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Running Apps</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white/70 px-4 py-3">
          <div class="text-3xl font-extrabold text-gray-900 leading-none tabular-nums">{{ props.totalVolumes }}</div>
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Volumes</div>
        </div>
      </div>
    </div>
  </div>
</template>
