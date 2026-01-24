<script setup>
import { computed } from 'vue'
import { RefreshCw, Clock, PauseCircle, AlertCircle } from 'lucide-vue-next'
import { formatDuration } from '../../utils/metrics.js'

const props = defineProps({
  containers: { type: Array, default: () => [] },
  currentTime: { type: Number, default: () => Date.now() },
  intervalHours: { type: Number, default: 3 }
})

const intervalMs = computed(() => {
  const hours = Number(props.intervalHours)
  if (!Number.isFinite(hours) || hours <= 0) return 3 * 60 * 60 * 1000
  return hours * 60 * 60 * 1000
})

const watchtowerContainer = computed(() => {
  const list = Array.isArray(props.containers) ? props.containers : []

  const matches = list.filter((c) => {
    const name = (c?.name || '').toString().toLowerCase()
    const names = Array.isArray(c?.Names) ? c.Names : []
    return name.includes('watchtower') || names.some((n) => (n || '').toString().toLowerCase().includes('watchtower'))
  })

  if (matches.length === 0) return null

  const running = matches.find((c) => c?.state === 'running')
  return running || matches[0]
})

const uptimeMs = computed(() => {
  const c = watchtowerContainer.value
  if (!c || c.state !== 'running' || !c.created) return null
  const createdMs = Number(c.created) * 1000
  if (!Number.isFinite(createdMs)) return null
  return Math.max(0, props.currentTime - createdMs)
})

const remainingMs = computed(() => {
  const up = uptimeMs.value
  if (!Number.isFinite(up)) return null
  const interval = intervalMs.value
  const mod = up % interval
  const remaining = interval - mod
  return remaining === 0 ? interval : remaining
})

const progressPct = computed(() => {
  const up = uptimeMs.value
  if (!Number.isFinite(up)) return 0
  const interval = intervalMs.value
  const mod = up % interval
  return Math.min(100, Math.max(0, (mod / interval) * 100))
})

const nextCheckTime = computed(() => {
  const remaining = remainingMs.value
  if (!Number.isFinite(remaining)) return null
  const dt = new Date(props.currentTime + remaining)
  return dt.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
})

const status = computed(() => {
  const c = watchtowerContainer.value
  if (!c) return { state: 'missing', label: 'Missing', icon: AlertCircle }
  if (c.state !== 'running') return { state: 'stopped', label: 'Paused', icon: PauseCircle }
  return { state: 'running', label: 'Active', icon: Clock }
})

const theme = computed(() => {
  const s = status.value.state
  if (s === 'running') {
    return {
      text: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      border: 'group-hover:border-emerald-500/30 dark:group-hover:border-emerald-400/30',
      ring: 'text-emerald-500 dark:text-emerald-400',
    }
  }
  if (s === 'stopped') {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      border: 'group-hover:border-amber-500/30 dark:group-hover:border-amber-400/30',
      ring: 'text-amber-500 dark:text-amber-400',
    }
  }
  return {
    text: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    border: 'group-hover:border-slate-500/30 dark:group-hover:border-slate-400/30',
    ring: 'text-slate-300 dark:text-slate-600',
  }
})

// Circular progress calculations
const radius = 36
const circumference = 2 * Math.PI * radius
const strokeDashoffset = computed(() => {
  return circumference - (progressPct.value / 100) * circumference
})
</script>

<template>
  <div
    class="relative h-full overflow-hidden group rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-900/50"
    :class="theme.border"
  >
    <!-- Background Texture -->
    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
         style="background-image: radial-gradient(circle at 1rem 1rem, currentColor 1px, transparent 0); background-size: 1rem 1rem;">
    </div>

    <div class="relative z-10 h-full p-6 flex flex-col justify-between">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl transition-colors duration-300" :class="theme.bg">
            <RefreshCw class="w-5 h-5 transition-transform duration-700 ease-in-out group-hover:rotate-180" :class="theme.text" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Watchtower</h3>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="relative flex h-2 w-2">
                <span v-if="status.state === 'running'" class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                <span class="relative inline-flex rounded-full h-2 w-2" :class="status.state === 'running' ? 'bg-emerald-500' : (status.state === 'stopped' ? 'bg-amber-500' : 'bg-slate-500')"></span>
              </span>
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ status.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content & Gauge -->
      <div class="flex items-end justify-between gap-4 mt-6">
        <!-- Big Timer -->
        <div class="flex-1 min-w-0">
           <div v-if="status.state === 'running'">
             <div class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Next Run In</div>
             <div class="text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
               {{ formatDuration(remainingMs) }}
             </div>
             <div class="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
               <Clock class="w-3.5 h-3.5" />
               <span>at {{ nextCheckTime }}</span>
             </div>
           </div>
           
           <div v-else>
              <div class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[14ch]">
                 {{ status.state === 'missing' ? 'Container missing' : 'Container stopped' }}
              </div>
              <div class="mt-2 text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 inline-block">
                 Interval: {{ intervalHours }}h
              </div>
           </div>
        </div>

        <!-- Circular Progress -->
        <div class="relative shrink-0 w-24 h-24 flex items-center justify-center">
          <!-- Track -->
          <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 88 88">
            <circle
              class="text-slate-100 dark:text-slate-800 transition-colors duration-300"
              stroke-width="6"
              stroke="currentColor"
              fill="transparent"
              :r="radius"
              cx="44"
              cy="44"
            />
            <!-- Progress -->
            <circle
              v-if="status.state === 'running'"
              class="transition-all duration-1000 ease-out"
              :class="theme.ring"
              stroke-width="6"
              stroke-linecap="round"
              stroke="currentColor"
              fill="transparent"
              :r="radius"
              cx="44"
              cy="44"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
            />
          </svg>
          
          <!-- Center Content -->
          <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-900 dark:text-white">
             <template v-if="status.state === 'running'">
                 <span class="text-lg font-bold tabular-nums leading-none">{{ Math.round(progressPct) }}<span class="text-xs align-top opacity-60">%</span></span>
             </template>
             <template v-else>
                 <component :is="status.icon" class="w-8 h-8 opacity-20" />
             </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
