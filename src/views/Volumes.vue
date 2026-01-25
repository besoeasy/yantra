<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { HardDrive, Eye, EyeOff, ExternalLink, Loader2, RefreshCw, Trash2, AlertCircle, Box, Database, Layers, Check } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import VueApexCharts from 'vue3-apexcharts'

const toast = useToast()

const volumesData = ref({})
const loading = ref(false)
const actionLoading = ref({})
const volumePorts = ref({})
const deletingVolume = ref(null)
const deletingAllVolumes = ref(false)

// Chart Configuration
const treemapOptions = computed(() => ({
  chart: {
    type: 'treemap',
    fontFamily: 'monospace',
    toolbar: { show: false },
    background: 'transparent',
    animations: { enabled: true }
  },
  colors: ['#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444'],
  states: {
    hover: {
      filter: {
        type: 'darken',
        value: 0.1,
      }
    }
  },
  plotOptions: {
    treemap: {
      distributed: true,
      enableShades: false,
      useFillColorAsStroke: false,
      strokeWidth: 0,
    }
  },
  dataLabels: {
    enabled: true,
    style: {
      fontSize: '10px',
      fontFamily: 'monospace',
      fontWeight: 'bold',
      colors: ['#000000']
    },
    formatter: function(text, op) {
      if (op.value < 1) return [text, '< 1 MB']
      return [text, op.value + ' MB']
    },
    offsetY: -4
  },
  title: { text: undefined },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'monospace' },
    y: {
      formatter: function(val) {
        return val + " MB"
      }
    }
  },
  stroke: { show: true, width: 2, colors: ['#0c0c0e'] }
}))

const treemapSeries = computed(() => {
  if (!volumesData.value.usedVolumes && !volumesData.value.unusedVolumes) return []
  
  const allVolumes = []
  
  // Add used volume
  if (volumesData.value.usedVolumes) {
    volumesData.value.usedVolumes.forEach(vol => {
      // Mock random size if not available or very small for visualization demo if real size is 0
      // But let's trust the API. If size is 0 or null, we might skip it or show minimal
      let sizeVal = parseFloat(vol.size)
      if (isNaN(sizeVal)) sizeVal = 0
      
      allVolumes.push({
        x: vol.name.length > 20 ? vol.name.substring(0, 17) + '...' : vol.name,
        y: sizeVal > 0 ? sizeVal : 0.01,
        fillColor: '#8b5cf6' // Purple for used
      })
    })
  }

  // Add unused
  if (volumesData.value.unusedVolumes) {
    volumesData.value.unusedVolumes.forEach(vol => {
      let sizeVal = parseFloat(vol.size)
      if (isNaN(sizeVal)) sizeVal = 0
      
      allVolumes.push({
        x: vol.name.length > 20 ? vol.name.substring(0, 17) + '...' : vol.name,
        y: sizeVal > 0 ? sizeVal : 0.01,
        fillColor: '#ef4444' // Red unused
      })
    })
  }
  
  // Return top 30 largest
  const sortedData = allVolumes.sort((a, b) => b.y - a.y).slice(0, 30)
  
  return [{ data: sortedData }]
})

async function fetchVolumes() {
  loading.value = true
  try {
    const response = await fetch('/api/volumes')
    const data = await response.json()
    if (data.success) {
      volumesData.value = data
      
      // Fetch ports for browsing volumes
      const containers = await fetch('/api/containers')
      const containersData = await containers.json()
      if (containersData.success) {
        const newPorts = {}
        containersData.containers.forEach(container => {
          if (container.labels && container.labels['yantra.volume-browser']) {
            const volumeName = container.labels['yantra.volume-browser']
            const port = container.ports?.find(p => p.privatePort === 5000)?.publicPort
            if (port) {
              newPorts[volumeName] = port
            }
          }
        })
        volumePorts.value = newPorts
      }
    }
  } catch (error) {
    toast.error('Failed to fetch volumes')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function startBrowsing(volumeName) {
  actionLoading.value[volumeName] = true
  try {
    const response = await fetch(`/api/volumes/${volumeName}/browse`, {
      method: 'POST',
    })
    const data = await response.json()
    if (data.success) {
      toast.success(`Volume browser started on port ${data.port}`)
      
      // Store the port immediately
      if (data.port) {
        volumePorts.value[volumeName] = data.port
      }
      
      await fetchVolumes()
      
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
    delete actionLoading.value[volumeName]
  }
}

async function stopBrowsing(volumeName) {
  actionLoading.value[volumeName] = true
  try {
    const response = await fetch(`/api/volumes/${volumeName}/browse`, {
      method: 'DELETE',
    })
    const data = await response.json()
    if (data.success) {
      toast.success('Volume browser stopped')
      
      // Remove the port from storage
      delete volumePorts.value[volumeName]
      
      await fetchVolumes()
    }
  } catch (error) {
    toast.error('Failed to stop volume browser')
    console.error(error)
  } finally {
    delete actionLoading.value[volumeName]
  }
}

async function deleteVolume(volumeName) {
  if (!confirm(`Delete volume ${volumeName}?\n\nThis will permanently remove all data stored in this volume.\n\nThis action cannot be undone.`)) return

  deletingVolume.value = volumeName
  try {
    const response = await fetch(`/api/volumes/${volumeName}`, {
      method: 'DELETE'
    })
    const data = await response.json()

    if (data.success) {
      toast.success(`Volume deleted successfully!`)
      await fetchVolumes()
    } else {
      toast.error(`Deletion failed: ${data.error}\n${data.message}`)
    }
  } catch (error) {
    toast.error(`Deletion failed: ${error.message}`)
  } finally {
    deletingVolume.value = null
  }
}

async function deleteAllUnusedVolumes() {
  const count = volumesData.value.unusedVolumes?.length || 0
  if (!count) return
  
  if (!confirm(`Delete all ${count} unused volumes?\n\nThis will permanently remove all data stored in these volumes.\n\nThis action cannot be undone.`)) return

  deletingAllVolumes.value = true
  let deleted = 0
  let failed = 0

  try {
    for (const volume of volumesData.value.unusedVolumes) {
      try {
        const response = await fetch(`/api/volumes/${volume.name}`, {
          method: 'DELETE'
        })
        const data = await response.json()
        
        if (data.success) {
          deleted++
        } else {
          failed++
        }
      } catch (error) {
        failed++
      }
    }

    if (deleted > 0) {
      toast.success(`Successfully deleted ${deleted} unused volume${deleted > 1 ? 's' : ''}!${failed > 0 ? `\n${failed} failed.` : ''}`)
      await fetchVolumes()
    } else {
      toast.error(`Failed to delete volumes`)
    }
  } catch (error) {
    toast.error(`Deletion failed: ${error.message}`)
  } finally {
    deletingAllVolumes.value = false
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Auto-refresh every 10 seconds
let refreshInterval = null
onMounted(() => {
  fetchVolumes()
  refreshInterval = setInterval(fetchVolumes, 10000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-200 font-sans pb-20">
    <!-- Header -->
    <div class="bg-white dark:bg-[#0c0c0e] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 lg:px-8 py-6">
            <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <HardDrive :size="24" class="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                    <h1 class="text-2xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">Docker Volumes</h1>
                    <p class="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest">Data Persistence & Storage</p>
                </div>
            </div>
            
            <div class="flex items-center gap-3">
                <button @click="fetchVolumes" class="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                    <div :class="{ 'animate-spin': loading }">
                    <RefreshCw :size="18" />
                    </div>
                </button>
            </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Box :size="48" />
                </div>
                <div class="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Total Volumes</div>
                <div class="text-2xl font-mono font-bold text-slate-900 dark:text-white">{{ volumesData.total || 0 }}</div>
            </div>
            
            <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Check :size="48" />
                </div>
                <div class="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Mounted / In Use</div>
                <div class="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-300">{{ volumesData.used || 0 }}</div>
            </div>
            
            <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <AlertTriangle :size="48" />
                </div>
                <div class="text-[10px] uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-1">Unused / Reclaimable</div>
                <div class="text-2xl font-mono font-bold text-orange-700 dark:text-orange-300">{{ volumesData.unused || 0 }}</div>
            </div>
            
            <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Eye :size="48" />
                </div>
                <div class="text-[10px] uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-1">Active Browsers</div>
                <div class="text-2xl font-mono font-bold text-purple-700 dark:text-purple-300">{{ volumesData.volumes?.filter(v => v.isBrowsing).length || 0 }}</div>
            </div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">

      <!-- Visualization -->
      <div v-if="treemapSeries.length > 0 && treemapSeries[0].data.length > 0" class="bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-slate-800 p-1">
         <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">Volume Size Distribution (Top 30 Largest)</h3>
         </div>
         <div class="p-4">
            <VueApexCharts :options="treemapOptions" :series="treemapSeries" height="280" />
         </div>
      </div>
      
      <!-- Unused Volumes List -->
      <div v-if="volumesData.unusedVolumes && volumesData.unusedVolumes.length > 0" class="space-y-4">
         <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b-2 border-orange-500">
            <div>
               <h3 class="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <AlertTriangle :size="20" class="text-orange-500" />
                  Unused Volumes
               </h3>
               <p class="text-xs font-mono text-slate-500 mt-1">Orphaned data ({{ volumesData.unusedVolumes.length }} items)</p>
            </div>
            
            <button @click="deleteAllUnusedVolumes"
              :disabled="deletingAllVolumes"
              class="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
              <Trash2 :size="14" />
              <span>{{ deletingAllVolumes ? 'Purging...' : 'Purge All Unused' }}</span>
            </button>
         </div>

         <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0c0e]">
            <table class="w-full text-left border-collapse">
               <thead>
                  <tr class="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase text-slate-500 font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                     <th class="p-3 font-mono text-left">Volume Name</th>
                     <th class="p-3 font-mono">Driver</th>
                     <th class="p-3 font-mono">Created</th>
                     <th class="p-3 font-mono">Size</th>
                     <th class="p-3 text-right font-mono">Actions</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50 font-mono text-xs">
                  <tr v-for="volume in volumesData.unusedVolumes" :key="volume.name" class="hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors group">
                     <td class="p-3 font-bold text-slate-700 dark:text-slate-300 break-all max-w-[200px]">{{ volume.name }}</td>
                     <td class="p-3 text-slate-500">{{ volume.driver }}</td>
                     <td class="p-3 text-slate-500">{{ formatDate(volume.createdAt) }}</td>
                     <td class="p-3 text-slate-600 dark:text-slate-400">{{ volume.size }} MB</td>
                     <td class="p-3 text-right flex justify-end gap-2">
                        <button @click="startBrowsing(volume.name)"
                            :disabled="actionLoading[volume.name]"
                            class="bg-slate-100 dark:bg-slate-800 hover:bg-purple-500 hover:text-white border border-slate-200 dark:border-slate-700 p-1.5 transition-all text-slate-500"
                            title="Browse Files">
                            <Loader2 v-if="actionLoading[volume.name]" :size="14" class="animate-spin" />
                            <Eye v-else :size="14" />
                        </button>
                        <button @click="deleteVolume(volume.name)" 
                           class="bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white border border-slate-200 dark:border-slate-700 text-slate-500 p-1.5 transition-all"
                           title="Delete Volume">
                           <Trash2 :size="14" />
                        </button>
                     </td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>

      <!-- Active Browsing Sessions -->
      <div v-if="volumesData.volumes && volumesData.volumes.filter(v => v.isBrowsing).length > 0" class="space-y-4">
         <div class="flex items-center gap-2 pb-2 border-b-2 border-purple-500">
             <Eye :size="20" class="text-purple-500" />
             <h3 class="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Active File Browsers</h3>
         </div>
         
         <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="volume in volumesData.volumes.filter(v => v.isBrowsing)" :key="volume.name" 
                class="bg-white dark:bg-[#0c0c0e] border border-purple-500 dark:border-purple-500 p-4 relative group">
                <div class="flex justify-between items-start mb-4">
                    <HardDrive class="text-purple-500" :size="24" />
                    <div class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                        Browsing
                    </div>
                </div>
                <h4 class="font-mono font-bold text-sm text-slate-900 dark:text-white truncate mb-2" :title="volume.name">{{ volume.name }}</h4>
                <div class="flex gap-2 mt-4">
                     <a
                        v-if="volumePorts[volume.name]"
                        :href="`http://${window.location.hostname || 'localhost'}:${volumePorts[volume.name]}`"
                        target="_blank"
                        class="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider py-2 transition-colors">
                        <ExternalLink :size="14" />
                        <span>Open</span>
                    </a>
                    <button @click="stopBrowsing(volume.name)"
                        :disabled="actionLoading[volume.name]"
                        class="px-3 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors">
                        <Loader2 v-if="actionLoading[volume.name]" :size="14" class="animate-spin" />
                        <EyeOff v-else :size="14" />
                    </button>
                </div>
            </div>
         </div>
      </div>

      <!-- Used Volumes List -->
      <div v-if="volumesData.usedVolumes && volumesData.usedVolumes.filter(v => !v.isBrowsing).length > 0" class="space-y-4">
         <div class="flex items-center gap-2 pb-2 border-b-2 border-emerald-500">
             <Check :size="20" class="text-emerald-500" />
             <h3 class="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Active Volumes</h3>
         </div>
         
         <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0c0e]">
            <table class="w-full text-left border-collapse">
               <thead>
                  <tr class="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase text-slate-500 font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                     <th class="p-3 font-mono text-left">Volume Name</th>
                     <th class="p-3 font-mono">Driver</th>
                     <th class="p-3 font-mono">Created</th>
                     <th class="p-3 font-mono">Size</th>
                     <th class="p-3 text-right font-mono">Actions</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50 font-mono text-xs">
                  <tr v-for="volume in volumesData.usedVolumes.filter(v => !v.isBrowsing)" :key="volume.name" class="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                     <td class="p-3 font-bold text-slate-700 dark:text-slate-300 break-all max-w-[200px]">{{ volume.name }}</td>
                     <td class="p-3 text-slate-500">{{ volume.driver }}</td>
                     <td class="p-3 text-slate-500">{{ formatDate(volume.createdAt) }}</td>
                     <td class="p-3 text-slate-600 dark:text-slate-400">{{ volume.size }} MB</td>
                     <td class="p-3 text-right">
                        <button @click="startBrowsing(volume.name)"
                            :disabled="actionLoading[volume.name]"
                            class="bg-slate-100 dark:bg-slate-800 hover:bg-purple-500 hover:text-white border border-slate-200 dark:border-slate-700 p-1.5 transition-all text-slate-500 mr-2"
                            title="Browse Files">
                            <Loader2 v-if="actionLoading[volume.name]" :size="14" class="animate-spin" />
                            <Eye v-else :size="14" />
                        </button>
                     </td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>

    </div>
  </div>
</template>