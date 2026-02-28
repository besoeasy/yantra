<script setup>
import { ref, onMounted } from 'vue'
import { useApiUrl } from '../composables/useApiUrl'
import { useNotification } from '../composables/useNotification'
import { ArrowLeft, HardDrive, RefreshCw, Database, Clock, AlertCircle } from 'lucide-vue-next'

const { apiUrl } = useApiUrl()
const toast = useNotification()

const loading = ref(true)
const volumes = ref([])
const s3Configured = ref(true)

function formatRelative(isoStr) {
  if (!isoStr) return '—'
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

async function fetchVolumes() {
  loading.value = true
  try {
    const [cfgRes, volRes] = await Promise.all([
      fetch(`${apiUrl.value}/api/backup/config`),
      fetch(`${apiUrl.value}/api/backup/volumes`),
    ])
    const cfg = await cfgRes.json()
    s3Configured.value = cfg.configured === true

    const vol = await volRes.json()
    volumes.value = vol.volumes || []
  } catch {
    toast.error('Failed to load backup volumes')
  } finally {
    loading.value = false
  }
}

onMounted(fetchVolumes)
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white font-sans">

    <!-- Header -->
    <header class="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <router-link
            to="/backup-config"
            class="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-gray-500 dark:text-zinc-400 group"
          >
            <ArrowLeft :size="18" class="group-hover:-translate-x-0.5 transition-transform" />
          </router-link>

          <div class="h-4 w-px bg-gray-200 dark:bg-zinc-800"></div>

          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center">
              <Database :size="16" class="text-gray-700 dark:text-zinc-300" />
            </div>
            <div>
              <h1 class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">Backed-up Volumes</h1>
              <p class="text-xs font-medium text-gray-500 dark:text-zinc-500">Snapshot history for each backed-up volume</p>
            </div>
          </div>
        </div>

        <button
          @click="fetchVolumes"
          :disabled="loading"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-gray-500 dark:text-zinc-400 disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw :size="15" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </header>

    <!-- Main -->
    <main class="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-6">

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <RefreshCw :size="24" class="animate-spin text-blue-500" />
        <span class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">Querying restic repository...</span>
      </div>

      <template v-else>

        <!-- S3 not configured -->
        <div
          v-if="!s3Configured"
          class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-5 flex gap-4 items-start"
        >
          <AlertCircle :size="20" class="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-semibold text-amber-900 dark:text-amber-400 tracking-tight mb-1">S3 storage not configured</p>
            <p class="text-amber-700 dark:text-amber-300/80 font-medium leading-relaxed">
              <router-link to="/backup-config" class="underline hover:text-amber-900 dark:hover:text-amber-300 transition-colors">Configure S3 settings</router-link>
              to start backing up volumes.
            </p>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="volumes.length === 0"
          class="flex flex-col items-center justify-center py-24 gap-4 text-center"
        >
          <div class="w-12 h-12 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center">
            <Database :size="22" class="text-gray-400 dark:text-zinc-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">No backups found</p>
            <p class="text-xs font-medium text-gray-500 dark:text-zinc-500 mt-1">
              Snapshots will appear here once a backup has run.
            </p>
          </div>
          <router-link
            to="/backup-schedules"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-100 transition-all mt-2"
          >
            <Clock :size="14" />
            Set up a schedule
          </router-link>
        </div>

        <!-- Volume list -->
        <div v-else class="space-y-3">
          <div
            v-for="vol in volumes"
            :key="vol.volumeName"
            class="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 transition-all p-5"
          >
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center shrink-0 mt-0.5">
                <HardDrive :size="14" class="text-gray-600 dark:text-zinc-400" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <p class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white truncate">
                    {{ vol.volumeName }}
                  </p>
                  <span class="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-[11px] font-bold text-gray-600 dark:text-zinc-400 shrink-0">
                    {{ vol.snapshotCount }} {{ vol.snapshotCount === 1 ? 'snapshot' : 'snapshots' }}
                  </span>
                </div>

                <div class="flex flex-wrap gap-x-6 gap-y-1 mt-2.5">
                  <span class="text-[11px] font-medium text-gray-400 dark:text-zinc-600 flex items-center gap-1">
                    <Clock :size="11" />
                    Latest: <span class="text-gray-700 dark:text-zinc-300 font-semibold ml-1">{{ formatRelative(vol.latestAt) }}</span>
                  </span>
                  <span class="text-[11px] font-medium text-gray-400 dark:text-zinc-600">
                    Oldest: <span class="text-gray-700 dark:text-zinc-300 font-semibold ml-1">{{ formatRelative(vol.oldestAt) }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </template>
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
