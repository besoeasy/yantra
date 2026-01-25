<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { FileText, AlertCircle, Info, RefreshCw, Terminal, Pause, Play, Trash2, Filter } from 'lucide-vue-next'

const logsData = ref({})
const logFilter = ref('all')
const loading = ref(false)
const apiUrl = ref('')
const autoRefresh = ref(true)
let refreshInterval = null
const logContainer = ref(null)

function formatTimestamp(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

async function fetchLogs() {
  // Don't show global loading spinner on refresh to avoid flicker
  if (!logsData.value.logs) loading.value = true
  
  try {
    const level = logFilter.value === 'all' ? '' : logFilter.value
    const url = level ? `${apiUrl.value}/api/logs?level=${level}` : `${apiUrl.value}/api/logs`
    const response = await fetch(url)
    const data = await response.json()
    if (data.success) {
      // Only update if logs changed to avoid DOM churn (simple check)
      if (!logsData.value.logs || data.logs.length !== logsData.value.logs.length || data.logs[0]?.timestamp !== logsData.value.logs[0]?.timestamp) {
          logsData.value = data
      }
    }
  } catch (error) {
    console.error('Failed to fetch logs:', error)
  } finally {
    loading.value = false
  }
}

function clearLogs() {
  logsData.value = { ...logsData.value, logs: [], count: 0 }
  // Ideally this would clear backend logs too if API supported it
}

onMounted(() => {
  fetchLogs()
  // Auto-refresh logs every 2 seconds for "live" feel
  refreshInterval = setInterval(() => {
    if (autoRefresh.value) {
      fetchLogs()
    }
  }, 2000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="h-[calc(100vh-64px)] flex flex-col bg-[#0c0c0e] text-slate-300 font-mono text-sm">
    <!-- Toolbar -->
    <div class="border-b border-slate-800 bg-[#0c0c0e] px-4 py-3 flex items-center justify-between shrink-0 z-20">
      <div class="flex items-center gap-4">
         <div class="flex items-center gap-2 text-indigo-400">
            <Terminal :size="18" />
            <h1 class="font-bold text-white uppercase tracking-wider text-sm">System Logs</h1>
         </div>
         <div class="h-4 w-px bg-slate-800 mx-2"></div>
         <!-- Filters -->
         <div class="flex items-center gap-1">
            <button @click="logFilter = 'all'; fetchLogs()" 
               :class="['px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors border', logFilter === 'all' ? 'bg-slate-800 text-white border-slate-600' : 'text-slate-500 border-transparent hover:text-slate-300']">
               All
            </button>
            <button @click="logFilter = 'info'; fetchLogs()" 
               :class="['px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors border', logFilter === 'info' ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'text-slate-500 border-transparent hover:text-blue-400']">
               Info
            </button>
            <button @click="logFilter = 'error'; fetchLogs()" 
               :class="['px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors border', logFilter === 'error' ? 'bg-red-900/30 text-red-500 border-red-800' : 'text-slate-500 border-transparent hover:text-red-500']">
               Errors
            </button>
         </div>
      </div>

      <div class="flex items-center gap-2">
         <span class="text-xs text-slate-500 mr-2">{{ logsData.count || 0 }} Events</span>
         <button @click="autoRefresh = !autoRefresh" 
            :class="['p-1.5 border transition-colors', autoRefresh ? 'bg-emerald-900/20 text-emerald-500 border-emerald-800' : 'text-slate-500 border-slate-800 hover:text-slate-300']"
            :title="autoRefresh ? 'Pause Auto-Scroll' : 'Resume Auto-Scroll'">
            <Pause v-if="autoRefresh" :size="16" />
            <Play v-else :size="16" />
         </button>
         <button @click="clearLogs" class="p-1.5 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-900 transition-colors" title="Clear Console">
            <Trash2 :size="16" />
         </button>
      </div>
    </div>

    <!-- Log Console -->
    <div class="flex-1 overflow-y-auto bg-[#09090b] p-2 custom-scrollbar" ref="logContainer">
       <div v-if="loading && !logsData.logs" class="flex items-center justify-center h-full text-slate-600 gap-2">
          <RefreshCw class="animate-spin" :size="16" />
          <span>Connecting to stream...</span>
       </div>
       
       <div v-else-if="!logsData.logs || logsData.logs.length === 0" class="flex flex-col items-center justify-center h-full text-slate-600 gap-2 opacity-50">
          <Terminal :size="32" />
          <span>No logs available</span>
       </div>

       <div v-else class="space-y-0.5">
          <div v-for="(log, idx) in logsData.logs" :key="idx" 
             class="group flex items-start hover:bg-slate-900/50 px-2 py-0.5 font-mono text-xs leading-5">
             
             <!-- Line Number (Virtual) -->
             <div class="w-8 text-slate-700 text-right select-none mr-3 shrink-0 opacity-50">{{ idx + 1 }}</div>
             
             <!-- Timestamp -->
             <div class="text-slate-500 mr-3 shrink-0 select-none opacity-70 w-24">{{ formatTimestamp(log.timestamp) }}</div>
             
             <!-- Level Marker -->
             <div class="mr-3 w-12 shrink-0">
                <span v-if="log.level === 'error'" class="text-red-500 font-bold">ERR</span>
                <span v-else class="text-blue-500 font-bold">INF</span>
             </div>
             
             <!-- Message -->
             <div class="break-all whitespace-pre-wrap flex-1" :class="log.level === 'error' ? 'text-red-400' : 'text-slate-300'">
                {{ log.message }}
                <span v-if="log.args" class="text-slate-500 opacity-75 ml-2">{{ log.args.join(' ') }}</span>
             </div>
          </div>
       </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 10px;
  background: #0c0c0e;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border: 2px solid #0c0c0e;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>