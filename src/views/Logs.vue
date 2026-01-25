<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { FileText, AlertCircle, Info, RefreshCw, Terminal, Pause, Play, Trash2, Search, ArrowDown } from 'lucide-vue-next'

const logsData = ref({})
const logFilter = ref('all')
const loading = ref(false)
const apiUrl = ref('')
const autoRefresh = ref(true)
const searchQuery = ref('')
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
  if (!logsData.value.logs) loading.value = true
  
  try {
    const level = logFilter.value === 'all' ? '' : logFilter.value
    const url = level ? `${apiUrl.value}/api/logs?level=${level}` : `${apiUrl.value}/api/logs`
    const response = await fetch(url)
    const data = await response.json()
    
    // Only update if changes detected (naive check) or initial load
    if (data.success) {
      const currentLen = logsData.value.logs?.length || 0
      if (!logsData.value.logs || data.logs.length !== currentLen || (data.logs.length > 0 && data.logs[0].timestamp !== logsData.value.logs[0].timestamp)) {
        logsData.value = data
        if (autoRefresh.value) {
            scrollToBottom()
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch logs:', error)
  } finally {
    loading.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

function clearLogs() {
  logsData.value = { ...logsData.value, logs: [], count: 0 }
}

onMounted(() => {
  fetchLogs()
  refreshInterval = setInterval(() => {
    if (autoRefresh.value) {
      fetchLogs()
    }
  }, 2000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="h-screen flex flex-col bg-[#1e1e1e] text-gray-300 font-mono text-[13px] overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#333333] shrink-0">
       <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 text-blue-400">
             <Terminal class="w-4 h-4" />
             <span class="font-bold text-gray-100 uppercase tracking-wide text-xs">Output</span>
          </div>
          <div class="h-4 w-px bg-[#333333]"></div>
          
          <div class="flex bg-[#1e1e1e] rounded border border-[#3c3c3c] overflow-hidden">
             <button @click="logFilter = 'all'; fetchLogs()" 
                :class="logFilter === 'all' ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:text-gray-200'"
                class="px-3 py-1 text-xs transition-colors">
                All
             </button>
             <div class="w-px bg-[#3c3c3c]"></div>
             <button @click="logFilter = 'info'; fetchLogs()" 
                :class="logFilter === 'info' ? 'bg-[#37373d] text-blue-400' : 'text-gray-400 hover:text-blue-300'"
                class="px-3 py-1 text-xs transition-colors">
                Info
             </button>
             <div class="w-px bg-[#3c3c3c]"></div>
             <button @click="logFilter = 'error'; fetchLogs()" 
                :class="logFilter === 'error' ? 'bg-[#37373d] text-red-400' : 'text-gray-400 hover:text-red-300'"
                class="px-3 py-1 text-xs transition-colors">
                Errors
             </button>
          </div>
       </div>

       <div class="flex items-center gap-2">
          <div class="relative group">
             <input v-model="searchQuery" type="text" placeholder="Filter..." class="bg-[#1e1e1e] border border-[#3c3c3c] text-gray-300 px-2 py-1 rounded text-xs w-32 focus:w-48 focus:border-blue-500 outline-none transition-all placeholder-gray-600" />
          </div>
          
          <div class="h-4 w-px bg-[#333333] mx-1"></div>

          <button @click="autoRefresh = !autoRefresh" 
             :class="autoRefresh ? 'text-green-400 bg-green-500/10' : 'text-gray-400 hover:text-gray-200'"
             class="p-1.5 rounded transition-colors" 
             :title="autoRefresh ? 'Pause Auto-scroll' : 'Resume Auto-scroll'">
             <Pause v-if="autoRefresh" class="w-4 h-4" />
             <Play v-else class="w-4 h-4" />
          </button>
          
          <button @click="clearLogs" class="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#333] rounded transition-colors" title="Clear Console">
             <Trash2 class="w-4 h-4" />
          </button>
       </div>
    </div>

    <!-- Log Viewer -->
    <div ref="logContainer" class="flex-1 overflow-y-auto p-2 scrollbar-thin">
       <div v-if="loading && !logsData.logs" class="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
          <RefreshCw class="w-6 h-6 animate-spin" />
          <span>Connecting...</span>
       </div>

       <div v-else-if="!logsData.logs || logsData.logs.length === 0" class="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
          <Terminal class="w-8 h-8 opacity-20" />
          <span class="opacity-50">No output to display</span>
       </div>

       <div v-else class="font-mono">
          <div v-for="(log, idx) in logsData.logs" :key="idx" 
             v-show="!searchQuery || log.message.toLowerCase().includes(searchQuery.toLowerCase())"
             class="flex gap-3 px-2 py-[2px] hover:bg-[#2a2d2e] rounded-sm group selection:bg-blue-500/30">
             
             <!-- Line Num -->
             <div class="select-none text-gray-600 w-8 text-right opacity-50 text-[11px] pt-[2px]">{{ idx + 1 }}</div>
             
             <!-- Time -->
             <div class="select-none text-[#569cd6] w-24 shrink-0 text-[11px] pt-[2px] opacity-80">{{ formatTimestamp(log.timestamp) }}</div>
             
             <!-- Level -->
             <div class="select-none w-[3px] rounded-full shrink-0 my-0.5" :class="log.level === 'error' ? 'bg-red-500' : 'bg-blue-500/50'"></div>

             <!-- Content -->
             <div class="flex-1 break-all whitespace-pre-wrap text-gray-300 leading-relaxed">
                <span :class="log.level === 'error' ? 'text-red-300' : ''">{{ log.message }}</span>
                <span v-if="log.args && log.args.length" class="text-gray-500 pl-2 text-xs italic opacity-80">{{ log.args.join(' ') }}</span>
             </div>
          </div>
       </div>
    </div>
    
    <!-- Status Bar Footer -->
    <div class="bg-[#007acc] text-white px-3 py-1 text-[11px] flex justify-between items-center shrink-0">
       <div class="flex gap-4">
          <span>Ln {{ logsData.count || 0 }}, Col 1</span>
          <span>UTF-8</span>
       </div>
       <div class="flex gap-2 opacity-80 hover:opacity-100 cursor-pointer" @click="scrollToBottom">
          <ArrowDown class="w-3 h-3" />
       </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: #1e1e1e;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 0;
  border: 2px solid #1e1e1e;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #4f4f4f;
}
.scrollbar-thin::-webkit-scrollbar-corner {
  background: #1e1e1e;
}
</style>