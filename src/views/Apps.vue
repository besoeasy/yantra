<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { Globe, FileCode } from 'lucide-vue-next'

const toast = useToast()

// State
const apps = ref([])
const containers = ref([])
const loading = ref(false)
const deploying = ref(null)
const showEnvModal = ref(false)
const selectedApp = ref(null)
const envValues = ref({})
const appSearch = ref('')
const apiUrl = ref('')
const musthaveapps = ['dufs', 'watchtower']

// Computed
const installedAppIds = computed(() => {
  const ids = new Set(containers.value.map(c => c.app.id))
  return ids
})

const uninstalledApps = computed(() => {
  const uninstalled = apps.value.filter(app => !installedAppIds.value.has(app.id))
  return shuffleWithSeed(uninstalled).map(app => ({
    ...app,
    isInstalled: false
  }))
})

const allAppsCount = computed(() => uninstalledApps.value.length)

const combinedApps = computed(() => {
  let combined = [...uninstalledApps.value]
  
  if (appSearch.value) {
    const search = appSearch.value.toLowerCase()
    combined = combined.filter(app => {
      return app.name.toLowerCase().includes(search) ||
        app.category.toLowerCase().includes(search) ||
        (app.description && app.description.toLowerCase().includes(search))
    })
  }
  
  return combined
})

// Helper Functions
function getDateHourSeed() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  return `${year}-${month}-${day}-${hour}`
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function shuffleWithSeed(array) {
  const dateHourSeed = getDateHourSeed()
  let numericSeed = 0
  for (let i = 0; i < dateHourSeed.length; i++) {
    numericSeed += dateHourSeed.charCodeAt(i) * (i + 1)
  }
  
  const shuffled = [...array]
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(numericSeed + i) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  return shuffled
}

// API Functions
async function fetchApps() {
  try {
    const response = await fetch(`${apiUrl.value}/api/apps`)
    const data = await response.json()
    if (data.success) {
      apps.value = data.apps
    }
  } catch (error) {
    console.error('Failed to fetch apps:', error)
  }
}

async function fetchContainers() {
  try {
    const response = await fetch(`${apiUrl.value}/api/containers`)
    const data = await response.json()
    if (data.success) {
      containers.value = data.containers.filter(c => c.state === 'running')
    }
  } catch (error) {
    console.error('Failed to fetch containers:', error)
  }
}

async function deployApp(appId) {
  const app = apps.value.find(a => a.id === appId)

  if (!app) return

  if (app.environment && app.environment.length > 0) {
    selectedApp.value = app
    envValues.value = {}
    app.environment.forEach(env => {
      envValues.value[env.envVar] = env.default
    })
    showEnvModal.value = true
  } else {
    await confirmDeploy(appId, {})
  }
}

async function confirmDeploy(appId, environment) {
  showEnvModal.value = false
  deploying.value = appId
  
  toast.info(`Deploying ${appId}... This may take a few minutes.`)
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000)
    
    const response = await fetch(`${apiUrl.value}/api/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, environment }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    const data = await response.json()

    if (data.success) {
      toast.success(`${appId} deployed successfully!`)
      await fetchContainers()
    } else {
      toast.error(`Deployment failed: ${data.error}`)
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      toast.error(`Deployment timeout - ${appId} is taking longer than expected`)
    } else {
      toast.error(`Deployment failed: ${error.message}`)
    }
  } finally {
    deploying.value = null
    selectedApp.value = null
  }
}

function cancelDeploy() {
  showEnvModal.value = false
  selectedApp.value = null
  envValues.value = {}
}

// Lifecycle
onMounted(async () => {
  loading.value = true
  await Promise.all([fetchApps(), fetchContainers()])
  loading.value = false
  
  // Auto-refresh every 10 seconds
  setInterval(() => {
    fetchContainers()
  }, 10000)
})
</script>

<template>
  <div class="p-6 md:p-10 lg:p-12">
    <h2 class="text-5xl font-bold mb-12 text-gray-900 tracking-tight">App Store</h2>
    <p class="text-gray-600 mb-8 -mt-8">Browse and install apps</p>
    
    <!-- Search Bar -->
    <div class="mb-8">
      <div class="relative">
        <input v-model="appSearch" type="text"
          placeholder="Search apps by name, category, or description..."
          class="w-full px-5 py-4 pl-12 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
        <button v-if="appSearch" @click="appSearch = ''"
          class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Clear search">
          ✕
        </button>
      </div>
      <div v-if="combinedApps.length < allAppsCount" class="mt-2 text-sm text-gray-500">
        Showing {{ combinedApps.length }} of {{ allAppsCount }} apps
      </div>
    </div>

    <div v-if="loading" class="text-center py-16">
      <div class="text-gray-500 font-medium">Loading apps...</div>
    </div>
    <div v-else-if="combinedApps.length === 0" class="text-center py-16">
      <div class="text-5xl mb-4">🔍</div>
      <div class="text-gray-500 font-medium">No apps found</div>
      <div class="text-sm text-gray-400 mt-2">Try a different search term</div>
    </div>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-6">
      <div v-for="app in combinedApps" :key="app.id"
        :class="musthaveapps.includes(app.id) ? 'ring-2 ring-yellow-400 ring-opacity-50 shadow-lg shadow-yellow-200/50' : 'shadow-md'"
        class="group bg-white dark:bg-slate-800 rounded-2xl p-5 transition-all duration-300 ease-out hover:shadow-2xl hover:-translate-y-2 cursor-pointer flex flex-col relative overflow-hidden">
        <!-- Recommended Badge -->
        <div v-if="musthaveapps.includes(app.id)" class="absolute top-3 left-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-lg z-10">
          <span>⭐</span>
          <span>Recommended</span>
        </div>
        
        <!-- Subtle background gradient on hover -->
        <div class="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-purple-50/0 group-hover:from-blue-50/50 group-hover:to-purple-50/50 dark:from-blue-900/0 dark:to-purple-900/0 dark:group-hover:from-blue-900/20 dark:group-hover:to-purple-900/20 transition-all duration-300 pointer-events-none"></div>
        
        <div class="flex flex-col items-center mb-4 relative z-10">
          <div class="relative mb-4">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <img :src="app.logo" :alt="app.name"
              class="w-24 h-24 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl relative z-10 object-contain">
          </div>
          <h3 class="font-bold text-base text-gray-900 dark:text-white mb-2 text-center line-clamp-1 px-2">{{ app.name }}</h3>
          <div class="flex flex-wrap gap-1.5 justify-center">
            <span v-for="cat in app.category.split(',')" :key="cat"
              class="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium">
              {{ cat.trim() }}
            </span>
          </div>
        </div>

        <p class="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed flex-1 line-clamp-3 text-center px-1 relative z-10">{{ app.description || 'No description' }}</p>

        <div class="flex gap-2 relative z-10">
          <button @click="deployApp(app.id)" :disabled="deploying === app.id"
            class="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg">
            {{ deploying === app.id ? '...' : 'Install' }}
          </button>
          <a v-if="app.website" :href="app.website" target="_blank"
            class="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-600 hover:border-blue-400 dark:hover:border-blue-500 text-gray-600 dark:text-gray-300 rounded-xl transition-all duration-200 transform hover:scale-110 active:scale-95"
            title="Website">
            <Globe :size="16" />
          </a>
          <a :href="`https://github.com/besoeasy/yantra/blob/main/apps/${app.id}/compose.yml`"
            target="_blank"
            class="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-600 hover:border-blue-400 dark:hover:border-blue-500 text-gray-600 dark:text-gray-300 rounded-xl transition-all duration-200 transform hover:scale-110 active:scale-95"
            title="Compose File">
            <FileCode :size="16" />
          </a>
        </div>
      </div>
    </div>

    <!-- Environment Variables Modal -->
    <div v-if="showEnvModal"
      class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="cancelDeploy">
      <div class="glass-dark rounded-3xl p-8 max-w-md w-full mx-4 smooth-shadow-lg">
        <h2 class="text-2xl font-bold mb-2 text-gray-900">Configure {{ selectedApp?.name }}</h2>
        <p class="text-sm text-gray-600 mb-6">Set environment variables for deployment</p>

        <div class="space-y-4 mb-8">
          <div v-for="env in selectedApp?.environment" :key="env.envVar" class="space-y-2">
            <label class="block text-sm font-semibold text-gray-700">
              {{ env.name }}
              <span v-if="env.default" class="text-gray-400 text-xs font-normal ml-1">(default: {{ env.default }})</span>
            </label>
            <input v-model="envValues[env.envVar]" type="text" :placeholder="env.default"
              class="w-full px-4 py-3 glass rounded-xl text-gray-900 placeholder-gray-400 transition-all">
          </div>
        </div>

        <div class="flex gap-3">
          <button @click="confirmDeploy(selectedApp.id, envValues)"
            class="flex-1 px-5 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all smooth-shadow">
            Deploy
          </button>
          <button @click="cancelDeploy"
            class="px-5 py-3 glass hover:bg-white/90 text-gray-700 rounded-xl font-medium transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
