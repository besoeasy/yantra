<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotification } from '../composables/useNotification'
import { useApiUrl } from '../composables/useApiUrl'
import { ArrowLeft, ExternalLink, RefreshCw, Trash2, Network, FolderOpen, Terminal, Activity, Cpu, HardDrive, ShieldCheck, Share2, Globe, Database, Lock, Folder, Pause, Play, Download, Clock, AlertCircle } from 'lucide-vue-next'
import { formatBytes } from '../utils/metrics'

const route = useRoute()
const router = useRouter()
const toast = useNotification()
const { apiUrl } = useApiUrl()

const selectedContainer = ref(null)
const containerStats = ref(null)
const containerLogs = ref([])
const deleting = ref(false)
const refreshingLogs = ref(false)
const browsingVolume = ref({})
const showVolumeMenu = ref({})
let statsInterval = null
const autoScrollLogs = ref(true)
const currentTime = ref(Date.now())
const activeTab = ref('resources')
const showOnlyDescribedPorts = ref(true)

// Backup state
const s3Configured = ref(false)
const volumeBackups = ref({})
const backingUp = ref(false)
const showRestoreMenu = ref({})
const backupJobId = ref(null)

// Update current time every second for live countdown
let timeUpdateInterval = null

// Extract volume names from container mounts
const containerVolumes = computed(() => {
  if (!selectedContainer.value?.mounts) return []
  
  return selectedContainer.value.mounts
    .filter(mount => mount.Type === 'volume')
    .map(mount => ({
      name: mount.Name,
      destination: mount.Destination,
      rw: mount.RW
    }))
})

// Get all port mappings from the container with labels
const allPortMappings = computed(() => {
  if (!selectedContainer.value || !selectedContainer.value.ports) {
    return []
  }
  
  // Build port-number → {label, protocol} lookup from info.json ports array
  const portLabels = {}
  for (const p of (selectedContainer.value.app?.ports || [])) {
    if (p.port != null) {
      portLabels[String(p.port)] = {
        protocol: (p.protocol || '').toLowerCase(),
        label: p.label || null,
      }
    }
  }
  
  const mappings = []
  const portKeys = Object.keys(selectedContainer.value.ports)
  
  portKeys.forEach(key => {
    const [privatePort, type] = key.split('/')
    const bindings = selectedContainer.value.ports[key]
    
    if (bindings && bindings.length > 0) {
      // Deduplicate by HostPort — Docker reports both 0.0.0.0 and :: bindings for the same port
      const seenHostPorts = new Set()
      bindings.forEach(binding => {
        if (binding.HostPort && !seenHostPorts.has(binding.HostPort)) {
          seenHostPorts.add(binding.HostPort)
          const label = portLabels[privatePort] || portLabels[binding.HostPort]
          mappings.push({
            containerPort: privatePort,
            hostPort: binding.HostPort,
            hostIp: binding.HostIp || '0.0.0.0',
            protocol: type,
            label: label?.label || null,
            labeledProtocol: label?.protocol || null
          })
        }
      })
    } else {
      // Port exposed but not bound to host
      const label = portLabels[privatePort]
      mappings.push({
        containerPort: privatePort,
        hostPort: null,
        hostIp: null,
        protocol: type,
        label: label?.label || null,
        labeledProtocol: label?.protocol || null
      })
    }
  })
  
  // Sort by host port, then by container port
  return mappings.sort((a, b) => {
    if (a.hostPort && b.hostPort) {
      return parseInt(a.hostPort) - parseInt(b.hostPort)
    }
    if (a.hostPort && !b.hostPort) return -1
    if (!a.hostPort && b.hostPort) return 1
    return parseInt(a.containerPort) - parseInt(b.containerPort)
  })
})

// Filtered port mappings based on description availability
const hasDescribedPorts = computed(() => allPortMappings.value.some(m => m.label))

const filteredPortMappings = computed(() => {
  // If no ports have labels at all, always show everything regardless of toggle
  if (!hasDescribedPorts.value) {
    return allPortMappings.value
  }
  if (!showOnlyDescribedPorts.value) {
    return allPortMappings.value
  }
  return allPortMappings.value.filter(mapping => mapping.label)
})

// Check if container has expiration
const expirationInfo = computed(() => {
  if (!selectedContainer.value?.expireAt) return null
  
  const expireAtTimestamp = parseInt(selectedContainer.value.expireAt, 10)
  if (isNaN(expireAtTimestamp)) return null
  
  const expireAtMs = expireAtTimestamp * 1000
  const timeLeftMs = expireAtMs - currentTime.value
  
  if (timeLeftMs <= 0) {
    return {
      expired: true,
      timeLeft: 'Expired',
      urgency: 'critical',
      percentage: 0
    }
  }
  
  const totalMinutes = Math.floor(timeLeftMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const days = Math.floor(hours / 24)
  const minutes = totalMinutes % 60
  
  // Calculate percentage (assuming max lifetime is from creation to expiration)
  // For now, we'll calculate based on the remaining time
  const oneDayMs = 86400000
  const percentage = Math.min(100, Math.max(0, (timeLeftMs / oneDayMs) * 100))
  
  let timeLeft = ''
  let urgency = 'normal'
  
  if (days > 0) {
    timeLeft = `${days} ${days === 1 ? 'day' : 'days'}${hours % 24 > 0 ? `, ${hours % 24} ${hours % 24 === 1 ? 'hour' : 'hours'}` : ''}`
    urgency = days < 1 ? 'warning' : 'normal'
  } else if (hours > 0) {
    timeLeft = `${hours} ${hours === 1 ? 'hour' : 'hours'}${minutes > 0 ? `, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : ''}`
    urgency = hours < 2 ? 'critical' : 'warning'
  } else if (totalMinutes > 0) {
    timeLeft = `${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'}`
    urgency = 'critical'
  } else {
    timeLeft = 'Less than a minute'
    urgency = 'critical'
  }
  
  return {
    expired: false,
    timeLeft,
    urgency,
    percentage,
    expireAt: new Date(expireAtMs).toLocaleString(),
    totalMinutes
  }
})

function appUrl(port, protocol = 'http') {
  const normalizedProtocol = protocol.replace('://', '').replace(':', '')
  let host = window.location.hostname || 'localhost'

  if (host.includes(':') && !host.startsWith('[')) {
    host = `[${host}]`
  }

  const portString = String(port ?? '').trim()
  const portMatch = portString.match(/\d+/)
  if (!portMatch) {
    return `${normalizedProtocol}://${host}`
  }

  return `${normalizedProtocol}://${host}:${portMatch[0]}`
}

async function fetchContainerDetail() {
  try {
    const response = await fetch(`${apiUrl.value}/api/containers/${route.params.id}`)
    const data = await response.json()
    
    if (data.success) {
      selectedContainer.value = data.container
    } else {
      toast.error('Container not found')
      router.push('/')
    }
  } catch (error) {
    console.error('Failed to fetch container details:', error)
    toast.error('Failed to load container details')
  }
}

async function fetchContainerStats() {
  if (!selectedContainer.value) return
  
  try {
    const response = await fetch(`${apiUrl.value}/api/containers/${selectedContainer.value.id}/stats`)
    const data = await response.json()
    
    if (data.success) {
      containerStats.value = data.stats
    }
  } catch (error) {
    console.error('Failed to fetch container stats:', error)
  }
}

async function fetchContainerLogs() {
  if (!selectedContainer.value) return
  
  refreshingLogs.value = true
  try {
    const response = await fetch(`${apiUrl.value}/api/containers/${selectedContainer.value.id}/logs?tail=200`)
    const data = await response.json()
    
    if (data.success) {
      containerLogs.value = data.logs
      if (autoScrollLogs.value) {
        scrollToBottom()
      }
    }
  } catch (error) {
    console.error('Failed to fetch container logs:', error)
  } finally {
    setTimeout(() => {
      refreshingLogs.value = false
    }, 300)
  }
}

const scrollToBottom = () => {
    setTimeout(() => {
        const el = document.getElementById('terminal-logs')
        if (el) el.scrollTop = el.scrollHeight
    }, 100)
}

async function deleteContainer() {
  if (!confirm(`Delete ${selectedContainer.value.name}?\n\nThis will remove the container and all its volumes permanently.`)) return

  deleting.value = true
  try {
    const response = await fetch(`${apiUrl.value}/api/containers/${selectedContainer.value.id}`, {
      method: 'DELETE'
    })
    const data = await response.json()

    if (data.success) {
      let message = `${selectedContainer.value.name} deleted successfully!`
      if (data.volumesRemoved.length > 0) {
        message += `\n\nVolumes removed: ${data.volumesRemoved.join(', ')}`
      }
      toast.success(message)
      router.push('/home')
    } else {
      toast.error(`Deletion failed: ${data.error}`)
    }
  } catch (error) {
    toast.error(`Deletion failed: ${error.message}`)
  } finally {
    deleting.value = false
  }
}

async function browseVolume(volumeName, expiryMinutes = 60) {
  browsingVolume.value[volumeName] = volumeName
  showVolumeMenu.value[volumeName] = false
  try {
    const response = await fetch(`${apiUrl.value}/api/volumes/${volumeName}/browse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiryMinutes }),
    })
    const data = await response.json()
    if (data.success) {
      const expiryText = expiryMinutes > 0 ? ` (expires in ${expiryMinutes}m)` : ' (no expiry)'
      toast.success(`Volume browser started on port ${data.port}${expiryText}`)

      // Open browser in new tab
      if (data.port) {
        const host = window.location.hostname || 'localhost'
        const url = `http://${host}:${data.port}`
        window.open(url, '_blank')
      }
    }
  } catch (error) {
    toast.error('Failed to start volume browser')
    console.error(error)
  } finally {
    delete browsingVolume.value[volumeName]
  }
}

// Check S3 configuration
async function checkS3Config() {
  try {
    const response = await fetch(`${apiUrl.value}/api/backup/config`)
    const data = await response.json()
    s3Configured.value = data.configured
  } catch (error) {
    console.error('Failed to check S3 config:', error)
  }
}

// Fetch backups for container volumes
async function fetchVolumeBackups() {
  if (!selectedContainer.value) return

  try {
    const response = await fetch(
      `${apiUrl.value}/api/containers/${selectedContainer.value.id}/backups`
    )
    const data = await response.json()

    if (data.success) {
      volumeBackups.value = data.backups
      s3Configured.value = data.configured !== false
    }
  } catch (error) {
    console.error('Failed to fetch backups:', error)
  }
}

// Backup all volumes
async function backupAllVolumes() {
  if (!selectedContainer.value) return

  backingUp.value = true
  try {
    const response = await fetch(
      `${apiUrl.value}/api/containers/${selectedContainer.value.id}/backup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    )
    const data = await response.json()

    if (data.success) {
      toast.success('Backup started for all volumes')
      backupJobId.value = data.jobId
      pollBackupJob(data.jobId)
    } else {
      toast.error(data.error || 'Failed to start backup')
    }
  } catch (error) {
    toast.error('Failed to start backup')
  } finally {
    backingUp.value = false
  }
}

// Poll backup job status
async function pollBackupJob(jobId) {
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${apiUrl.value}/api/backup/jobs/${jobId}`)
      const data = await response.json()

      if (data.success && data.job) {
        if (data.job.status === 'completed') {
          clearInterval(pollInterval)
          toast.success('Backup completed successfully')
          await fetchVolumeBackups()
        } else if (data.job.status === 'failed') {
          clearInterval(pollInterval)
          toast.error(`Backup failed: ${data.job.error}`)
        }
      }
    } catch (error) {
      clearInterval(pollInterval)
      console.error('Failed to poll backup job:', error)
    }
  }, 2000)
}

// Restore backup
async function restoreBackup(volumeName, backupKey) {
  if (!confirm(`Restore ${volumeName} from backup?\n\nThis will overwrite current data.`)) return

  try {
    const response = await fetch(
      `${apiUrl.value}/api/volumes/${volumeName}/restore`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupKey, overwrite: true })
      }
    )
    const data = await response.json()

    if (data.success) {
      toast.success('Restore started')
      pollRestoreJob(data.jobId)
    } else {
      toast.error(data.error || 'Failed to start restore')
    }
  } catch (error) {
    toast.error('Failed to start restore')
  }

  showRestoreMenu.value[volumeName] = false
}

// Poll restore job status
async function pollRestoreJob(jobId) {
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${apiUrl.value}/api/restore/jobs/${jobId}`)
      const data = await response.json()

      if (data.success && data.job) {
        if (data.job.status === 'completed') {
          clearInterval(pollInterval)
          toast.success('Restore completed successfully')
        } else if (data.job.status === 'failed') {
          clearInterval(pollInterval)
          toast.error(`Restore failed: ${data.job.error}`)
        }
      }
    } catch (error) {
      clearInterval(pollInterval)
      console.error('Failed to poll restore job:', error)
    }
  }, 2000)
}

// Delete backup
async function deleteBackupFile(volumeName, backupKey) {
  const timestamp = backupKey.split('/')[1].replace('.tar', '')

  if (!confirm('Delete this backup?')) return

  try {
    const response = await fetch(
      `${apiUrl.value}/api/volumes/${volumeName}/backup/${timestamp}`,
      { method: 'DELETE' }
    )
    const data = await response.json()

    if (data.success) {
      toast.success('Backup deleted')
      await fetchVolumeBackups()
    } else {
      toast.error(data.error || 'Failed to delete backup')
    }
  } catch (error) {
    toast.error('Failed to delete backup')
  }
}

// Toggle restore menu
function toggleRestoreMenu(volumeName) {
  showRestoreMenu.value[volumeName] = !showRestoreMenu.value[volumeName]
}

// Check if volume has backups
function hasBackups(volumeName) {
  return volumeBackups.value[volumeName]?.length > 0
}

// Get latest backup age
function getLatestBackupAge(volumeName) {
  const backups = volumeBackups.value[volumeName]
  if (!backups || backups.length === 0) return 'Never'

  const latest = backups[0]
  const date = new Date(latest.timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}

// Format backup date
function formatBackupDate(timestamp) {
  return new Date(timestamp).toLocaleString()
}

onMounted(async () => {
  await fetchContainerDetail()
  await Promise.all([
    fetchContainerStats(),
    fetchContainerLogs(),
    checkS3Config(),
    fetchVolumeBackups()
  ])
  
  // Start polling stats every 2 seconds
  statsInterval = setInterval(() => {
    fetchContainerStats()
  }, 2000)
  
  // Update current time every second for expiration countdown
  timeUpdateInterval = setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
  }
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval)
  }
})
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-zinc-100 font-sans selection:bg-blue-500/30">
     <!-- Header -->
     <header class="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-30">
       <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
         <div class="flex items-center gap-2 sm:gap-4 min-w-0">
           <router-link to="/" class="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-900 transition-all text-gray-500 dark:text-zinc-400 group shrink-0">
             <ArrowLeft :size="16" class="group-hover:-translate-x-0.5 transition-transform" />
           </router-link>
           
           <div class="h-4 w-px bg-gray-300 dark:bg-zinc-800 shrink-0"></div>

           <div class="flex items-center gap-1.5 sm:gap-2.5 text-sm min-w-0">
             <span class="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Containers</span>
             <span class="hidden sm:inline text-gray-300 dark:text-zinc-700">/</span>
             <span class="font-semibold tracking-tight text-gray-900 dark:text-white truncate" v-if="selectedContainer">{{ selectedContainer.name }}</span>
             <span v-else class="w-32 h-4 bg-gray-200 dark:bg-zinc-800 animate-pulse rounded"></span>
           </div>
         </div>

        <div v-if="selectedContainer" class="flex items-center gap-2">
          <!-- Expiration Badge -->
          <div v-if="expirationInfo" 
               class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider"
               :class="{
                 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400': expirationInfo.urgency === 'critical',
                 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400': expirationInfo.urgency === 'warning',
                 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400': expirationInfo.urgency === 'normal'
               }"
               :title="`Expires at: ${expirationInfo.expireAt}`">
            <Clock :size="12" :class="expirationInfo.urgency === 'critical' ? 'animate-pulse' : ''" />
            <span>{{ expirationInfo.timeLeft }}</span>
          </div>
          
          <!-- Running State Badge -->
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider"
            :class="selectedContainer.state === 'running' 
              ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400' 
              : 'bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400'">
            <div class="w-1.5 h-1.5 rounded-full" :class="selectedContainer.state === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"></div>
            <span>{{ selectedContainer.state }}</span>
          </div>
        </div>
      </div>
    </header>

    <div v-if="!selectedContainer" class="max-w-7xl mx-auto p-8 flex justify-center py-32">
       <div class="w-8 h-8 border-[3px] border-gray-200 dark:border-zinc-800 border-t-blue-500 dark:border-t-blue-500 rounded-full animate-spin"></div>
    </div>

    <main v-else class="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        <!-- Info Card -->
        <div class="group relative bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row gap-6 hover:border-gray-300 dark:hover:border-zinc-700 transition-all duration-300">
           <!-- Glow Accent -->
           <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

           <div class="w-20 h-20 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl flex items-center justify-center p-4 shrink-0 shadow-sm transition-transform group-hover:scale-105 duration-500">
              <img v-if="selectedContainer.app.logo" :src="selectedContainer.app.logo" loading="lazy" class="w-full h-full object-contain filter dark:brightness-90 group-hover:brightness-100 transition-all" />
              <Package v-else :size="32" class="text-gray-400 dark:text-zinc-600" />
           </div>
           
           <div class="flex-1 space-y-3">
              <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{{ selectedContainer.name }}</h1>
              <p class="text-gray-500 dark:text-zinc-400 text-sm leading-relaxed max-w-2xl">
                 {{ selectedContainer.app.description || "Container usage description not available." }}
              </p>
              <div class="pt-2 flex flex-wrap gap-2">
                 <div class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 text-[10px] font-bold tracking-widest text-gray-600 dark:text-zinc-400 rounded-md uppercase">
                    <Database :size="10" />
                    {{ selectedContainer.image }}
                 </div>
                 <div class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 text-[10px] font-bold tracking-widest text-gray-600 dark:text-zinc-400 rounded-md uppercase">
                    <span class="opacity-60">ID:</span> {{ selectedContainer.id.substring(0, 12) }}
                 </div>
              </div>
           </div>
        </div>

        <!-- Network Access -->
        <div v-if="allPortMappings.length > 0" class="space-y-4">
           <div class="flex items-center justify-between">
             <h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">Network Access</h3>
             <div v-if="hasDescribedPorts" class="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-zinc-900 p-1">
               <button
                 @click="showOnlyDescribedPorts = false"
                 :class="!showOnlyDescribedPorts ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300'"
                 class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all"
               >
                 All Ports
               </button>
               <button
                 @click="showOnlyDescribedPorts = true"
                 :class="showOnlyDescribedPorts ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300'"
                 class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all"
               >
                 Described
               </button>
             </div>
           </div>
           <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             <div v-for="(mapping, i) in filteredPortMappings" :key="i" 
                  class="group bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-zinc-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-zinc-600 transition-all duration-300">
               
               <div class="flex items-start justify-between mb-4">
                 <div class="flex items-start gap-3.5 flex-1 min-w-0">
                   <div class="w-10 h-10 rounded-lg bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-600 dark:text-zinc-400 shrink-0 shadow-sm group-hover:text-blue-500 transition-colors">
                     <Network :size="18" />
                   </div>
                   <div class="min-w-0 flex-1">
                     <div class="flex items-center gap-2 mb-1.5">
                       <span class="font-mono text-[10px] font-bold uppercase text-gray-900 dark:text-white">{{ mapping.protocol }}</span>
                       <span v-if="mapping.labeledProtocol" class="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-md uppercase font-bold tracking-widest border border-gray-200 dark:border-zinc-700">{{ mapping.labeledProtocol }}</span>
                     </div>
                     <div class="text-[11px] text-gray-500 dark:text-zinc-400 truncate" :title="mapping.label">
                       {{ mapping.label || 'Network Port' }}
                     </div>
                   </div>
                 </div>
               </div>

               <div class="space-y-2 mb-5">
                 <div class="flex items-center justify-between text-[11px]">
                   <span class="text-gray-500 dark:text-zinc-500 uppercase font-bold tracking-wider">Host Port</span>
                   <span v-if="mapping.hostPort" class="font-mono font-bold text-gray-900 dark:text-white">{{ mapping.hostPort }}</span>
                   <span v-else class="text-gray-400 italic">Internal</span>
                 </div>
                 <div class="flex items-center justify-between text-[11px]">
                   <span class="text-gray-500 dark:text-zinc-500 uppercase font-bold tracking-wider">Container Port</span>
                   <span class="font-mono font-medium text-gray-700 dark:text-zinc-300">{{ mapping.containerPort }}</span>
                 </div>
               </div>

               <a v-if="mapping.hostPort && mapping.protocol === 'tcp'"
                  :href="appUrl(mapping.hostPort, mapping.labeledProtocol || 'http')"
                  target="_blank"
                  class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all text-[11px] font-bold uppercase tracking-wider"
               >
                  <ExternalLink :size="12" />
                  Open
               </a>
               <div v-else class="w-full flex items-center justify-center px-3 py-2 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 text-gray-400 dark:text-zinc-500 rounded-lg text-[11px] font-bold uppercase tracking-wider">
                 Internal Only
               </div>
             </div>
           </div>
        </div>

        <!-- Storage (Attached + Backups) -->
        <div v-if="containerVolumes.length > 0" class="space-y-4">
           <div class="flex items-center justify-between">
             <h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">Storage Volumes</h3>
             <button
               v-if="s3Configured"
               @click="backupAllVolumes"
               :disabled="backingUp"
               class="text-[10px] uppercase tracking-wider px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold"
             >
               {{ backingUp ? 'Backing up...' : 'Backup All' }}
             </button>
           </div>

           <div v-if="!s3Configured" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
             <div class="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5">
               <AlertCircle :size="14" />
             </div>
             <p class="text-xs text-amber-900 dark:text-amber-200">
               <span class="font-bold">S3 storage not configured.</span>
               <router-link to="/minioconfig" class="underline hover:text-amber-700 font-semibold ml-1">Configure now</router-link> to enable backups.
             </p>
           </div>

           <div class="grid gap-4">
               <div v-for="volume in containerVolumes" :key="volume.name" 
                  class="group bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-zinc-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-zinc-600 transition-all duration-300">
                   
                 <div class="flex items-start justify-between gap-4 mb-5">
                  <div class="flex items-start gap-4 min-w-0 flex-1">
                    <div class="w-10 h-10 rounded-lg bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-500 dark:text-zinc-400 shrink-0 shadow-sm group-hover:text-blue-500 transition-colors">
                      <HardDrive :size="18" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="font-bold text-sm text-gray-900 dark:text-white truncate tracking-tight" :title="volume.name">{{ volume.name }}</div>
                      <div class="text-[11px] text-gray-500 dark:text-zinc-400 font-mono truncate mt-1">{{ volume.destination }}</div>
                      <div class="text-[10px] text-gray-400 dark:text-zinc-500 mt-2 font-bold uppercase tracking-wider">
                        Latest backup: <span class="text-gray-600 dark:text-zinc-300">{{ getLatestBackupAge(volume.name) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap pt-4 border-t border-gray-100 dark:border-zinc-800">
                  <div v-if="browsingVolume[volume.name]" class="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 animate-pulse px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                    Starting WebDAV server...
                  </div>
                  
                  <button 
                    v-else-if="!showVolumeMenu[volume.name]"
                    @click="showVolumeMenu[volume.name] = true"
                    class="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                  >
                    Browse Files
                  </button>
                       
                  <div v-else class="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                    <button @click="browseVolume(volume.name, 60)" class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all" title="1 Hour Access">
                      1H
                    </button>
                    <button @click="browseVolume(volume.name, 0)" class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-700 transition-all" title="Permanent Access">
                      Perm
                    </button>
                  </div>

                  <button
                    @click="backupAllVolumes"
                    :disabled="backingUp || !s3Configured"
                    class="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Backup this volume"
                  >
                    Backup
                  </button>
                  <button
                    @click="toggleRestoreMenu(volume.name)"
                    :disabled="!hasBackups(volume.name) || !s3Configured"
                    class="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Restore
                  </button>
                </div>

                <div
                  v-if="showRestoreMenu[volume.name] && hasBackups(volume.name)"
                  class="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800"
                >
                  <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3">Available Backups</div>
                  <div class="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                    <div
                      v-for="backup in volumeBackups[volume.name]"
                      :key="backup.key"
                      class="flex items-center justify-between py-2.5 px-3 bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 transition-all"
                    >
                      <div class="flex-1 min-w-0">
                        <div class="font-mono text-[11px] font-medium text-gray-900 dark:text-white">{{ formatBackupDate(backup.timestamp) }}</div>
                        <div class="text-gray-500 dark:text-zinc-400 text-[10px] mt-0.5 font-bold uppercase tracking-wider">{{ formatBytes(backup.size) }}</div>
                      </div>
                      <div class="flex gap-2 ml-3">
                        <button
                          @click="restoreBackup(volume.name, backup.key)"
                          class="px-2.5 py-1.5 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-[#0A0A0A] rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all text-[10px] font-bold uppercase tracking-wider"
                        >
                          Restore
                        </button>
                        <button
                          @click="deleteBackupFile(volume.name, backup.key)"
                          class="px-2.5 py-1.5 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10 rounded-md hover:bg-red-100 dark:hover:bg-red-500/20 transition-all text-[10px] font-bold uppercase tracking-wider"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
             </div>
        </div>

        <!-- System Panel (Tabs) -->
        <div class="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
            <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">
              <ShieldCheck :size="14" />
              System Diagnostics
            </div>
            <div class="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-zinc-900 p-1">
              <button
                @click="activeTab = 'resources'"
                :class="activeTab === 'resources' ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300'"
                class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all"
              >
                Resources
              </button>
              <button
                @click="activeTab = 'output'"
                :class="activeTab === 'output' ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300'"
                class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all"
              >
                Output
              </button>
              <button
                @click="activeTab = 'env'"
                :class="activeTab === 'env' ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300'"
                class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all"
              >
                Env
              </button>
            </div>
          </div>

          <div class="p-6">
            <!-- Resources Tab -->
            <div v-if="activeTab === 'resources'">
              <div v-if="containerStats" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 p-5 rounded-xl">
                  <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-3">
                    <Cpu :size="12" /> CPU
                  </div>
                  <div class="text-3xl font-mono font-bold tracking-tighter text-gray-900 dark:text-white">
                    {{ containerStats.cpu.percent }}%
                  </div>
                </div>
                
                <div class="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 p-5 rounded-xl">
                  <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-3">
                    <Activity :size="12" /> RAM
                  </div>
                  <div class="text-3xl font-mono font-bold tracking-tighter text-gray-900 dark:text-white">
                    {{ containerStats.memory.percent }}%
                  </div>
                </div>
                
                <div class="md:col-span-2 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 p-5 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-1.5">Network I/O</div>
                    <div class="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                      <span class="text-green-600 dark:text-green-500">↓ {{ formatBytes(containerStats.network.rx) }}</span>
                      <span class="text-gray-300 dark:text-zinc-700 mx-3">|</span>
                      <span class="text-blue-600 dark:text-blue-500">↑ {{ formatBytes(containerStats.network.tx) }}</span>
                    </div>
                  </div>
                  <div class="sm:text-right">
                    <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-1.5">Block I/O</div>
                    <div class="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                      {{ formatBytes(containerStats.blockIO.read) }} / {{ formatBytes(containerStats.blockIO.write) }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">No resource data available.</div>
            </div>

            <!-- Output Tab -->
            <div v-else-if="activeTab === 'output'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">
                  <Terminal :size="12" /> Output Console
                </div>
                <div class="flex items-center gap-2">
                  <button @click="autoScrollLogs = !autoScrollLogs" class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors" :title="autoScrollLogs ? 'Pause Auto-Scroll' : 'Enable Auto-Scroll'">
                    <component :is="autoScrollLogs ? Pause : Play" :size="14" />
                  </button>
                  <button @click="fetchContainerLogs" class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors" :title="refreshingLogs ? 'Refreshing...' : 'Refresh'">
                    <RefreshCw :size="14" :class="{ 'animate-spin': refreshingLogs }" />
                  </button>
                </div>
              </div>
              
              <div 
                id="terminal-logs"
                class="h-96 overflow-y-auto p-4 font-mono text-[11px] leading-5 text-gray-800 dark:text-gray-300 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-zinc-800 rounded-xl scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent"
              >
                <div v-if="containerLogs.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-zinc-600">
                  <div class="mb-2 text-[10px] font-bold uppercase tracking-widest">No output logs found</div>
                </div>
                <div v-else class="space-y-0.5">
                  <div v-for="(log, i) in containerLogs" :key="i" class="break-all whitespace-pre-wrap hover:bg-gray-100 dark:hover:bg-zinc-900 px-1 -mx-1 rounded-sm">
                    <span class="text-gray-400 dark:text-zinc-600 select-none mr-3 w-6 inline-block text-right">{{ i + 1 }}</span>{{ log }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Environment Tab -->
            <div v-else class="space-y-4">
              <div class="flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">
                <Lock :size="12" /> Environment Variables
              </div>
              <div v-if="selectedContainer.env && selectedContainer.env.length > 0" class="bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-zinc-800 rounded-xl p-5 max-h-80 overflow-y-auto custom-scrollbar">
                <div v-for="(envVar, i) in selectedContainer.env" :key="i" class="font-mono text-[11px] mb-3 last:mb-0 break-all flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <div class="text-gray-500 dark:text-zinc-500 font-bold shrink-0 sm:w-1/3">{{ envVar.split('=')[0] }}</div>
                  <div class="text-gray-900 dark:text-zinc-300 flex-1">{{ envVar.split('=').slice(1).join('=') }}</div>
                </div>
              </div>
              <div v-else class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">No environment variables available.</div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
           <h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">Control</h3>
           
           <button 
              @click="deleteContainer"
              :disabled="deleting"
              class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-[#0A0A0A] border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all font-bold text-[11px] uppercase tracking-wider"
           >
              <Trash2 :size="14" />
              {{ deleting ? 'Terminating...' : 'Terminate Container' }}
           </button>
           
           <p class="text-[10px] text-gray-500 dark:text-zinc-500 text-center px-4 leading-relaxed font-medium">
              Warning: This action is irreversible. All associated volumes and data will be permanently destroyed.
           </p>
        </div>

    </main>
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 3px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #4f4f4f;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
</style>
