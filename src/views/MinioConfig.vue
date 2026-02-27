<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotification } from '../composables/useNotification'
import { useApiUrl } from '../composables/useApiUrl'
import { ArrowLeft, Cloud, Save, RefreshCw } from 'lucide-vue-next'

const router = useRouter()
const toast = useNotification()
const { apiUrl } = useApiUrl()

const loading = ref(false)
const saving = ref(false)
const configured = ref(false)

// Form fields
const provider = ref('Other')
const endpoint = ref('')
const bucket = ref('')
const accessKey = ref('')
const secretKey = ref('')
const region = ref('us-east-1')

// Fetch existing configuration
async function fetchConfig() {
  loading.value = true
  try {
    const response = await fetch(`${apiUrl.value}/api/backup/config`)
    const data = await response.json()

    if (data.success && data.configured) {
      configured.value = true
      provider.value = data.config.provider || 'Other'
      endpoint.value = data.config.endpoint || ''
      bucket.value = data.config.bucket || ''
      region.value = data.config.region || 'us-east-1'
      // Don't populate access/secret keys for security
    }
  } catch (error) {
    console.error('Failed to fetch config:', error)
    toast.error('Failed to load configuration')
  } finally {
    loading.value = false
  }
}

// Save configuration
async function saveConfig() {
  // Validation
  if (!bucket.value || !accessKey.value || !secretKey.value) {
    toast.error('Bucket, Access Key, and Secret Key are required')
    return
  }

  if (provider.value === 'Other' && !endpoint.value) {
    toast.error('Endpoint is required for custom S3 providers')
    return
  }

  saving.value = true
  try {
    const response = await fetch(`${apiUrl.value}/api/backup/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider.value,
        endpoint: endpoint.value,
        bucket: bucket.value,
        accessKey: accessKey.value,
        secretKey: secretKey.value,
        region: region.value
      })
    })

    const data = await response.json()

    if (data.success) {
      toast.success('S3 configuration saved successfully')
      configured.value = true
      // Clear sensitive fields after save
      accessKey.value = ''
      secretKey.value = ''
    } else {
      toast.error(data.error || 'Failed to save configuration')
    }
  } catch (error) {
    console.error('Failed to save config:', error)
    toast.error('Failed to save configuration')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchConfig()
})
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white font-sans">
    <!-- Header -->
    <header class="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <router-link to="/" class="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-gray-500 dark:text-zinc-400 group">
            <ArrowLeft :size="18" class="group-hover:-translate-x-0.5 transition-transform" />
          </router-link>

          <div class="h-4 w-px bg-gray-200 dark:bg-zinc-800"></div>

          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center">
              <Cloud :size="16" class="text-gray-700 dark:text-zinc-300" />
            </div>
            <div>
              <h1 class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">MinIO / S3 Configuration</h1>
              <p class="text-xs font-medium text-gray-500 dark:text-zinc-500">Configure object storage for volume backups</p>
            </div>
          </div>
        </div>

        <transition name="fade">
          <div v-if="configured" class="px-3 py-1 rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 text-[10px] font-bold uppercase tracking-[0.2em] text-green-700 dark:text-green-500 flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            Configured
          </div>
        </transition>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-2xl mx-auto px-4 py-12">

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw :size="24" class="animate-spin text-blue-500" />
        <span class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">Loading Configuration...</span>
      </div>

      <!-- Configuration Form -->
      <transition name="fade" mode="out-in">
        <div v-if="!loading" class="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 p-8 space-y-8 shadow-sm">

          <!-- Info Banner -->
          <div class="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg p-5">
            <div class="flex gap-4">
              <Cloud :size="20" class="text-blue-600 dark:text-blue-500 shrink-0 mt-0.5" />
              <div class="text-sm">
                <p class="font-semibold text-blue-900 dark:text-blue-400 tracking-tight mb-1.5">About S3 / MinIO Storage</p>
                <p class="text-blue-700 dark:text-blue-300/80 leading-relaxed font-medium">
                  Configure S3-compatible object storage (AWS S3, MinIO, or other providers) to enable automatic volume backups.
                  Backups are stored securely and can be restored from any container detail page.
                </p>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <!-- Provider Selection -->
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                Provider
              </label>
              <select
                v-model="provider"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white"
              >
                <option value="AWS">AWS S3</option>
                <option value="Other">MinIO / Other S3-Compatible</option>
              </select>
            </div>

            <!-- Endpoint (for non-AWS) -->
            <transition name="fade">
              <div v-if="provider === 'Other'">
                <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                  Endpoint <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="endpoint"
                  type="text"
                  placeholder="https://s3.example.com or https://minio.example.com:9000"
                  class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600"
                />
                <p class="mt-2 text-[11px] font-medium text-gray-500 dark:text-zinc-500">Full URL including protocol (http:// or https://)</p>
              </div>
            </transition>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <!-- Bucket -->
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                  Bucket Name <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="bucket"
                  type="text"
                  placeholder="yantr"
                  class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600"
                />
                <p class="mt-2 text-[11px] font-medium text-gray-500 dark:text-zinc-500">The bucket must exist before saving configuration</p>
              </div>

              <!-- Region -->
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                  Region
                </label>
                <input
                  v-model="region"
                  type="text"
                  placeholder="us-east-1"
                  class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600"
                />
                <p class="mt-2 text-[11px] font-medium text-gray-500 dark:text-zinc-500">Default: us-east-1</p>
              </div>
            </div>

            <!-- Access Key -->
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                Access Key <span class="text-red-500">*</span>
              </label>
              <input
                v-model="accessKey"
                type="text"
                :placeholder="configured ? '••••••••••••' : 'Enter access key'"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600"
              />
            </div>

            <!-- Secret Key -->
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                Secret Key <span class="text-red-500">*</span>
              </label>
              <input
                v-model="secretKey"
                type="password"
                :placeholder="configured ? '••••••••••••' : 'Enter secret key'"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600"
              />
              <p class="mt-2 text-[11px] font-medium text-gray-500 dark:text-zinc-500">Required to update configuration</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="pt-6 flex gap-4 border-t border-gray-200 dark:border-zinc-800">
            <button
              @click="saveConfig"
              :disabled="saving"
              class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-xs uppercase tracking-wider"
            >
              <Save :size="16" v-if="!saving" />
              <RefreshCw :size="16" class="animate-spin" v-else />
              {{ saving ? 'Saving...' : 'Save Configuration' }}
            </button>

            <button
              @click="router.push('/')"
              class="px-6 py-3 bg-gray-50 dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 rounded-lg border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 transition-all font-bold text-xs uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>

          <!-- Security Note -->
          <div class="mt-8 pt-6">
            <p class="text-[11px] font-medium leading-relaxed text-gray-500 dark:text-zinc-500">
              <span class="font-bold text-gray-700 dark:text-zinc-300">Security Note:</span> Credentials are stored in <span class="font-mono bg-gray-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-800">backup-config.json</span> on the server.
              Ensure your server is properly secured and credentials have minimal required permissions.
            </p>
          </div>
        </div>
      </transition>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
