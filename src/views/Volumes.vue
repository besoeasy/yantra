<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { HardDrive, Eye, EyeOff, ExternalLink, Loader2, RefreshCw } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'

const toast = useToast()

const volumes = ref([])
const loading = ref(false)
const actionLoading = ref({})
const volumePorts = ref({})

async function fetchVolumes() {
  loading.value = true
  try {
    const response = await fetch('/api/volumes')
    const data = await response.json()
    if (data.success) {
      volumes.value = data.volumes.sort((a, b) => a.name.localeCompare(b.name))
      
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
        const url = `http://localhost:${data.port}`
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
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 md:p-10 lg:p-12">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 md:mb-8">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-md">
            <HardDrive class="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 class="text-3xl sm:text-4xl font-bold text-gray-900">Volumes</h1>
            <p class="text-sm sm:text-base text-gray-600">Browse and manage Docker volumes</p>
          </div>
        </div>
        <button
          @click="fetchVolumes"
          :disabled="loading"
          class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105 active:scale-95 disabled:transform-none"
        >
          <RefreshCw :class="['w-4 h-4', { 'animate-spin': loading }]" />
          Refresh
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading && volumes.length === 0" class="flex items-center justify-center py-20">
        <Loader2 class="w-8 h-8 text-purple-500 animate-spin" />
      </div>

      <!-- Empty State -->
      <div v-else-if="volumes.length === 0" class="text-center py-20">
        <HardDrive class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p class="text-gray-600 text-lg font-semibold">No volumes found</p>
      </div>

      <!-- Volumes Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div
          v-for="volume in volumes"
          :key="volume.name"
          class="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-200"
        >
          <!-- Volume Header -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-gray-900 truncate" :title="volume.name">
                {{ volume.name }}
              </h3>
              <p class="text-sm text-gray-600">{{ volume.driver }}</p>
            </div>
            <div
              v-if="volume.isBrowsing"
              class="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium ml-3 flex-shrink-0"
            >
              <Eye class="w-3 h-3" />
              Browsing
            </div>
          </div>

          <!-- Volume Info -->
          <div class="space-y-2 mb-4">
            <div class="text-xs text-gray-600">
              <span class="font-medium">Created:</span> {{ formatDate(volume.createdAt) }}
            </div>
            <div class="text-xs text-gray-600 truncate" :title="volume.mountpoint">
              <span class="font-medium">Path:</span> {{ volume.mountpoint }}
            </div>
          </div>

          <!-- Actions -->
          <div v-if="!volume.isBrowsing" class="flex gap-2">
            <button
              @click="startBrowsing(volume.name)"
              :disabled="actionLoading[volume.name]"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 disabled:transform-none"
            >
              <Loader2 v-if="actionLoading[volume.name]" class="w-4 h-4 animate-spin" />
              <Eye v-else class="w-4 h-4" />
              Browse
            </button>
          </div>
          <div v-else class="flex flex-col gap-2">
            <a
              v-if="volumePorts[volume.name]"
              :href="`http://localhost:${volumePorts[volume.name]}`"
              target="_blank"
              class="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
            >
              <ExternalLink class="w-4 h-4" />
              Open :{{ volumePorts[volume.name] }}
            </a>
            <button
              @click="stopBrowsing(volume.name)"
              :disabled="actionLoading[volume.name]"
              class="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 disabled:transform-none"
            >
              <Loader2 v-if="actionLoading[volume.name]" class="w-4 h-4 animate-spin" />
              <EyeOff v-else class="w-4 h-4" />
              Stop Browser
            </button>
          </div>
        </div>
      </div>

      <!-- Info Box -->
      <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p class="text-sm text-blue-800">
          <span class="font-semibold">💡 Tip:</span> Click "Browse" to start a temporary file browser for any volume. 
          The browser will open in a new tab and can be stopped when you're done.
        </p>
      </div>
    </div>
  </div>
</template>
