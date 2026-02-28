<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApiUrl } from '../composables/useApiUrl'
import { useNotification } from '../composables/useNotification'
import {
  ArrowLeft, HardDrive, RefreshCw, Database, Clock,
  AlertCircle, ExternalLink, Trash2
} from 'lucide-vue-next'

const router = useRouter()
const { apiUrl } = useApiUrl()
const toast = useNotification()

const loading = ref(true)
const volumes = ref([])
const s3Configured = ref(true)

// Track which volumes have their snapshot list open
const expanded = ref(new Set())
// Track which snapshots are currently being restored
const restoringSnapshots = ref(new Set())

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

function formatDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleString()
}

function toggleExpanded(volumeName) {
  const next = new Set(expanded.value)
  next.has(volumeName) ? next.delete(volumeName) : next.add(volumeName)
  expanded.value = next
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

    // Auto-expand all volumes
    expanded.value = new Set((vol.volumes || []).map(v => v.volumeName))
  } catch {
    toast.error('Failed to load backup volumes')
  } finally {
    loading.value = false
  }
}

async function restoreBackup(volumeName, snapshotId) {
  if (!confirm(`Restore ${volumeName} from this snapshot?\n\nThis will overwrite current data.`)) return

  const key = `${volumeName}:${snapshotId}`
  restoringSnapshots.value = new Set([...restoringSnapshots.value, key])

  try {
    const res = await fetch(`${apiUrl.value}/api/volumes/${encodeURIComponent(volumeName)}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshotId, overwrite: true }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to start restore')

    toast.success('Restore started')
    pollRestoreJob(data.jobId, key)
  } catch (err) {
    toast.error(err.message)
    restoringSnapshots.value = new Set([...restoringSnapshots.value].filter(k => k !== key))
  }
}

function pollRestoreJob(jobId, key) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${apiUrl.value}/api/restore/jobs/${jobId}`)
      const data = await res.json()
      if (data.success && data.job) {
        if (data.job.status === 'completed') {
          clearInterval(interval)
          restoringSnapshots.value = new Set([...restoringSnapshots.value].filter(k => k !== key))
          toast.success('Restore completed')
        } else if (data.job.status === 'failed') {
          clearInterval(interval)
          restoringSnapshots.value = new Set([...restoringSnapshots.value].filter(k => k !== key))
          toast.error(`Restore failed: ${data.job.error}`)
        }
      }
    } catch {
      clearInterval(interval)
      restoringSnapshots.value = new Set([...restoringSnapshots.value].filter(k => k !== key))
    }
  }, 2000)
}

async function deleteBackup(volumeName, snapshotId) {
  if (!confirm('Delete this snapshot? This cannot be undone.')) return

  try {
    const res = await fetch(
      `${apiUrl.value}/api/volumes/${encodeURIComponent(volumeName)}/backup/${snapshotId}`,
      { method: 'DELETE' }
    )
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to delete')
    toast.success('Snapshot deleted')
    await fetchVolumes()
  } catch (err) {
    toast.error(err.message)
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
              <p class="text-xs font-medium text-gray-500 dark:text-zinc-500">Snapshot history per volume</p>
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
    <main class="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-4">

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
        <div v-else class="space-y-4">
          <div
            v-for="vol in volumes"
            :key="vol.volumeName"
            class="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden"
          >
            <!-- Volume header row -->
            <div
              class="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors select-none"
              @click="toggleExpanded(vol.volumeName)"
            >
              <div class="w-8 h-8 rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center shrink-0">
                <HardDrive :size="14" class="text-gray-600 dark:text-zinc-400" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white truncate">
                    {{ vol.volumeName }}
                  </p>
                  <!-- Running container badge -->
                  <span
                    v-if="vol.container"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-900/30 text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-500"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
                    running
                  </span>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  <span class="text-[11px] font-medium text-gray-500 dark:text-zinc-500">
                    {{ vol.snapshotCount }} {{ vol.snapshotCount === 1 ? 'snapshot' : 'snapshots' }}
                  </span>
                  <span class="text-[11px] font-medium text-gray-400 dark:text-zinc-600">
                    Latest: <span class="text-gray-600 dark:text-zinc-400 font-semibold">{{ formatRelative(vol.latestAt) }}</span>
                  </span>
                </div>
              </div>

              <!-- Container link button -->
              <button
                v-if="vol.container"
                @click.stop="router.push(`/containers/${vol.container.id}`)"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 transition-all shrink-0"
                :title="`Open container: ${vol.container.name}`"
              >
                <ExternalLink :size="11" />
                {{ vol.container.name }}
              </button>

              <!-- Expand chevron -->
              <span class="text-gray-400 dark:text-zinc-600 shrink-0 transition-transform duration-200" :class="{ 'rotate-180': expanded.has(vol.volumeName) }">
                <ArrowLeft :size="14" class="-rotate-90" />
              </span>
            </div>

            <!-- Snapshot list (expanded) -->
            <div v-if="expanded.has(vol.volumeName)" class="border-t border-gray-100 dark:border-zinc-800/60 px-5 py-3">
              <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3">Snapshots</div>

              <div class="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                <div
                  v-for="snap in vol.snapshots"
                  :key="snap.snapshotId"
                  class="flex items-center justify-between py-2.5 px-3 bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 transition-all"
                >
                  <div class="flex-1 min-w-0">
                    <div class="font-mono text-[11px] font-medium text-gray-900 dark:text-white">{{ formatDate(snap.timestamp) }}</div>
                    <div class="text-[10px] mt-0.5 font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                      <span v-if="snap.sizeMB != null">{{ snap.sizeMB }} MB&ensp;·&ensp;</span>
                      <span class="font-mono">{{ snap.snapshotId }}</span>
                    </div>
                  </div>
                  <div class="flex gap-2 ml-3 shrink-0">
                    <button
                      @click="restoreBackup(vol.volumeName, snap.snapshotId)"
                      :disabled="restoringSnapshots.has(`${vol.volumeName}:${snap.snapshotId}`)"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-[#0A0A0A] rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-[10px] font-bold uppercase tracking-wider"
                    >
                      <RefreshCw
                        :size="10"
                        :class="{ 'animate-spin': restoringSnapshots.has(`${vol.volumeName}:${snap.snapshotId}`) }"
                      />
                      {{ restoringSnapshots.has(`${vol.volumeName}:${snap.snapshotId}`) ? 'Restoring' : 'Restore' }}
                    </button>
                    <button
                      @click="deleteBackup(vol.volumeName, snap.snapshotId)"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10 rounded-md hover:bg-red-100 dark:hover:bg-red-500/20 transition-all text-[10px] font-bold uppercase tracking-wider"
                    >
                      <Trash2 :size="10" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </template>
    </main>
  </div>
</template>
