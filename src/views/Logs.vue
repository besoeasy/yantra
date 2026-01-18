<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { FileText, AlertCircle, Info, RefreshCw, Terminal } from 'lucide-vue-next'

const logsData = ref({})
const logFilter = ref('all')
const loading = ref(false)
const apiUrl = ref('')
const autoRefresh = ref(true)
let refreshInterval = null

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
    const level = logFilter.value === 'all' ? '' : logFilter.value
    const url = level ? `${apiUrl.value}/api/logs?level=${level}` : `${apiUrl.value}/api/logs`
    const response = await fetch(url)
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
  // Auto-refresh logs every 5 seconds
  refreshInterval = setInterval(() => {
    if (autoRefresh.value) {
      fetchLogs()
    }
  }, 5000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="h-screen flex flex-col p-4 sm:p-6 md:p-10 lg:p-12">
    <div class="mb-6 md:mb-8">
      <div class="flex items-center gap-3 mb-2">
        <Terminal class="w-8 h-8 text-blue-600" />
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900">Application Logs</h2>
      </div>
      <p class="text-sm sm:text-base text-gray-600">Monitor system events and troubleshoot issues</p>
    </div>
    
    <div v-if="loading" class="flex-1 flex items-center justify-center text-center">
      <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <div class="text-gray-500 font-medium">Loading logs...</div>
    </div>
    <div v-else class="flex-1 min-h-0 flex flex-col">
      <!-- Controls -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 smooth-shadow mb-5">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button @click="logFilter = 'all'; fetchLogs()"
              :class="logFilter === 'all' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white smooth-shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-all whitespace-nowrap touch-manipulation flex items-center gap-2">
              <FileText class="w-4 h-4" />
              <span>All ({{ logsData.count || 0 }})</span>
            </button>
            <button @click="logFilter = 'info'; fetchLogs()"
              :class="logFilter === 'info' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white smooth-shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-all whitespace-nowrap touch-manipulation flex items-center gap-2">
              <Info class="w-4 h-4" />
              <span>Info</span>
            </button>
            <button @click="logFilter = 'error'; fetchLogs()"
              :class="logFilter === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white smooth-shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-all whitespace-nowrap touch-manipulation flex items-center gap-2">
              <AlertCircle class="w-4 h-4" />
              <span>Errors</span>
            </button>
          </div>
          <div class="flex gap-2">
            <button @click="autoRefresh = !autoRefresh"
              :class="autoRefresh ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 touch-manipulation flex items-center gap-2 border whitespace-nowrap"
              :title="autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'">
              <div :class="autoRefresh ? 'animate-spin' : ''"><RefreshCw class="w-4 h-4" /></div>
              <span class="hidden sm:inline">{{ autoRefresh ? 'Live' : 'Paused' }}</span>
            </button>
            <button @click="fetchLogs()"
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 touch-manipulation flex items-center gap-2 smooth-shadow">
              <RefreshCw class="w-4 h-4" />
              <span class="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Logs List -->
      <div class="bg-gray-900 rounded-2xl overflow-hidden smooth-shadow border border-gray-800 flex flex-col flex-1 min-h-0">
        <div class="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700 flex items-center gap-2">
          <Terminal class="w-4 h-4 text-gray-400" />
          <span class="text-sm font-semibold text-gray-300">Console Output</span>
          <span class="text-xs text-gray-500 ml-auto">{{ logsData.count || 0 }} entries</span>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto font-mono text-xs sm:text-sm bg-gray-950">
          <div v-if="!logsData.logs || logsData.logs.length === 0" class="p-8 sm:p-12 text-center">
            <div class="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText class="w-8 h-8 text-gray-600" />
            </div>
            <div class="text-gray-400 font-medium text-sm sm:text-base">No logs available</div>
            <div class="text-gray-600 text-xs mt-1">Logs will appear here as events occur</div>
          </div>
          <div v-for="(logEntry, index) in logsData.logs" :key="index"
            :class="logEntry.level === 'error' ? 'bg-red-950/30 border-l-4 border-red-500' : 'border-b border-gray-800/50'"
            class="px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-gray-900/50 transition-colors">
            <div class="flex items-start gap-2.5 sm:gap-3">
              <span class="text-gray-500 text-[10px] sm:text-xs whitespace-nowrap pt-0.5 font-medium">
                {{ formatTimestamp(logEntry.timestamp) }}
              </span>
              <div class="flex items-center gap-1.5">
                <component :is="logEntry.level === 'error' ? AlertCircle : Info"
                  :class="logEntry.level === 'error' ? 'text-red-400' : 'text-blue-400'"
                  class="w-3.5 h-3.5" />
                <span :class="logEntry.level === 'error' ? 'text-red-400' : 'text-blue-400'"
                  class="text-[10px] sm:text-xs font-bold uppercase whitespace-nowrap">
                  {{ logEntry.level }}
                </span>
              </div>
              <span class="text-gray-300 flex-1 break-all text-xs sm:text-sm leading-relaxed">
                {{ logEntry.message }}
                <span v-if="logEntry.args" class="text-gray-500">
                  {{ logEntry.args.join(' ') }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
