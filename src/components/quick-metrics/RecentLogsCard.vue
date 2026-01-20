<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Terminal, AlertCircle, Info, ArrowRight } from 'lucide-vue-next'

const props = defineProps({
  apiUrl: { type: String, default: '' },
  limit: { type: Number, default: 7 },
  refreshMs: { type: Number, default: 10000 }
})

const router = useRouter()

const loading = ref(false)
const logsData = ref({ logs: [], count: 0 })
let refreshInterval = null

const recentLogs = computed(() => {
  const rows = Array.isArray(logsData.value?.logs) ? logsData.value.logs : []
  return rows.slice(0, props.limit)
})

function formatTimestamp(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

async function fetchLogs() {
  loading.value = true
  try {
    const response = await fetch(`${props.apiUrl}/api/logs`)
    const data = await response.json()
    if (data.success) {
      logsData.value = data
    }
  } catch (error) {
    console.error('Failed to fetch logs:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchLogs()
  refreshInterval = setInterval(fetchLogs, props.refreshMs)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div
    class="relative h-full overflow-hidden group rounded-2xl transition-all duration-500 hover:-translate-y-1 cursor-pointer"
    @click="router.push('/logs')"
    title="Open logs"
  >
    <div class="absolute inset-0 bg-gray-900">
      <div class="absolute inset-0 bg-linear-to-br from-slate-600/25 via-cyan-600/10 to-gray-900 z-10"></div>
      <div
        class="absolute top-0 right-0 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/25 transition-colors duration-700"
      ></div>
      <div
        class="absolute bottom-0 left-0 w-48 h-48 bg-slate-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-slate-500/30 transition-colors duration-700"
      ></div>
    </div>

    <div class="relative z-20 h-full p-6 flex flex-col justify-between border border-white/5 rounded-2xl backdrop-blur-sm group-hover:border-cyan-500/30 transition-colors duration-500">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative">
            <div class="absolute inset-0 bg-cyan-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
            <div class="relative w-12 h-12 bg-linear-to-br from-slate-700 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
              <Terminal class="w-6 h-6 text-white" />
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold text-white mb-1 group-hover:text-cyan-200 transition-colors">Recent Logs</h3>
            <p class="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Latest {{ limit }} entries</p>
          </div>
        </div>

        <div class="text-right">
          <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</div>
          <div class="text-lg font-extrabold text-white tabular-nums">{{ logsData.count || 0 }}</div>
        </div>
      </div>

      <div class="mt-5 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
          <div class="text-xs font-bold text-gray-300 uppercase tracking-wider">Console</div>
          <div class="text-xs text-gray-400">
            <span v-if="loading" class="inline-flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Refreshing
            </span>
            <span v-else>Live</span>
          </div>
        </div>

        <div v-if="recentLogs.length === 0" class="px-4 py-8 text-center">
          <div class="text-sm font-semibold text-gray-200">No logs available</div>
          <div class="text-xs text-gray-400 mt-1">Logs will appear here as events occur.</div>
        </div>

        <div v-else class="divide-y divide-white/5">
          <div
            v-for="(logEntry, index) in recentLogs"
            :key="index"
            class="px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div class="flex items-start gap-3">
              <div class="shrink-0 text-[10px] font-semibold text-gray-500 tabular-nums pt-0.5">
                {{ formatTimestamp(logEntry.timestamp) }}
              </div>

              <div class="shrink-0 flex items-center gap-1.5">
                <component
                  :is="logEntry.level === 'error' ? AlertCircle : Info"
                  :class="logEntry.level === 'error' ? 'text-red-300' : 'text-cyan-300'"
                  class="w-3.5 h-3.5"
                />
                <span
                  :class="logEntry.level === 'error' ? 'text-red-300' : 'text-cyan-300'"
                  class="text-[10px] font-bold uppercase"
                >
                  {{ logEntry.level || 'info' }}
                </span>
              </div>

              <div class="min-w-0 flex-1">
                <div class="text-[11px] sm:text-xs font-mono text-gray-200 wrap-break-word leading-relaxed">
                  {{ logEntry.message }}
                  <span v-if="logEntry.args" class="text-gray-500">{{ logEntry.args.join(' ') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-5 pt-4 border-t border-white/5 flex items-center justify-between group-hover:border-white/10 transition-colors">
        <div class="text-xs font-bold text-cyan-300 uppercase tracking-wider">Open full logs</div>
        <div class="flex items-center gap-2 text-sm font-bold text-white group-hover:translate-x-1 transition-transform duration-300">
          <span>View</span>
          <ArrowRight class="w-4 h-4" />
        </div>
      </div>
    </div>
  </div>
</template>
