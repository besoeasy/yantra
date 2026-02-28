<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotification } from '../composables/useNotification'
import { useApiUrl } from '../composables/useApiUrl'
import {
  ArrowLeft, Clock, Plus, Trash2, Play, RefreshCw,
  HardDrive, CheckCircle, AlertCircle, Calendar
} from 'lucide-vue-next'

const router = useRouter()
const toast = useNotification()
const { apiUrl } = useApiUrl()

// ─── State ────────────────────────────────────────────────────────────────────
const loading = ref(true)
const s3Configured = ref(false)
const schedules = ref([])
const volumes = ref([])
const runningVolumes = ref(new Set())

// New schedule form
const showForm = ref(false)
const saving = ref(false)
const form = ref({
  volumeName: '',
  intervalHours: 24,
  keepCount: 7,
  enabled: true,
})

const INTERVAL_OPTIONS = [
  { label: 'Every 6 hours',  value: 6   },
  { label: 'Every 12 hours', value: 12  },
  { label: 'Every 24 hours', value: 24  },
  { label: 'Every 3 days',   value: 72  },
  { label: 'Every week',     value: 168 },
]

const KEEP_OPTIONS = [3, 5, 7, 10, 14, 30]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelative(isoStr) {
  if (!isoStr) return '—'
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatNext(isoStr) {
  if (!isoStr) return '—'
  const diff = new Date(isoStr).getTime() - Date.now()
  if (diff <= 0) return 'soon'
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60)  return `in ${mins}m`
  if (hours < 24) return `in ${hours}h`
  return `in ${days}d`
}

function intervalLabel(hours) {
  const opt = INTERVAL_OPTIONS.find(o => o.value === hours)
  return opt ? opt.label : `Every ${hours}h`
}

const scheduledVolumeNames = computed(() => new Set(schedules.value.map(s => s.volumeName)))
const availableVolumes = computed(() =>
  volumes.value.filter(v => !scheduledVolumeNames.value.has(v.name))
)

// ─── Data fetching ────────────────────────────────────────────────────────────
async function fetchAll() {
  loading.value = true
  try {
    const [cfgRes, schRes, volRes] = await Promise.all([
      fetch(`${apiUrl.value}/api/backup/config`),
      fetch(`${apiUrl.value}/api/backup/schedules`),
      fetch(`${apiUrl.value}/api/volumes`),
    ])

    const cfg = await cfgRes.json()
    s3Configured.value = cfg.configured === true

    const sch = await schRes.json()
    schedules.value = sch.schedules || []

    const vol = await volRes.json()
    volumes.value = (vol.volumes || [])
  } catch (err) {
    toast.error('Failed to load data')
  } finally {
    loading.value = false
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────
function openForm() {
  form.value = {
    volumeName: availableVolumes.value[0]?.name || '',
    intervalHours: 24,
    keepCount: 7,
    enabled: true,
  }
  showForm.value = true
}

async function saveSchedule() {
  if (!form.value.volumeName) {
    toast.error('Select a volume')
    return
  }
  saving.value = true
  try {
    const res = await fetch(`${apiUrl.value}/api/backup/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Save failed')
    toast.success(`Schedule saved for ${form.value.volumeName}`)
    showForm.value = false
    await fetchAll()
  } catch (err) {
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

async function deleteSchedule(volumeName) {
  try {
    const res = await fetch(`${apiUrl.value}/api/backup/schedules/${encodeURIComponent(volumeName)}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Delete failed')
    toast.success(`Schedule removed for ${volumeName}`)
    await fetchAll()
  } catch (err) {
    toast.error(err.message)
  }
}

async function runNow(volumeName) {
  runningVolumes.value = new Set([...runningVolumes.value, volumeName])
  try {
    const res = await fetch(`${apiUrl.value}/api/backup/schedules/${encodeURIComponent(volumeName)}/run`, {
      method: 'POST',
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Run failed')
    toast.success(`Backup started for ${volumeName}`)
    // Refresh after a moment so lastRunAt updates
    setTimeout(fetchAll, 3000)
  } catch (err) {
    toast.error(err.message)
  } finally {
    runningVolumes.value = new Set([...runningVolumes.value].filter(v => v !== volumeName))
  }
}

onMounted(fetchAll)
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white font-sans">

    <!-- Header -->
    <header class="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <router-link
            to="/"
            class="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-gray-500 dark:text-zinc-400 group"
          >
            <ArrowLeft :size="18" class="group-hover:-translate-x-0.5 transition-transform" />
          </router-link>

          <div class="h-4 w-px bg-gray-200 dark:bg-zinc-800"></div>

          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center">
              <Clock :size="16" class="text-gray-700 dark:text-zinc-300" />
            </div>
            <div>
              <h1 class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">Backup Schedules</h1>
              <p class="text-xs font-medium text-gray-500 dark:text-zinc-500">Automatic volume backups with retention</p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- S3 not configured warning -->
          <router-link
            v-if="!loading && !s3Configured"
            to="/minioconfig"
            class="px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-500 flex items-center gap-1.5 hover:border-amber-400 transition-colors"
          >
            <AlertCircle :size="12" />
            Configure S3 first
          </router-link>

          <button
            v-if="s3Configured"
            @click="openForm"
            class="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
          >
            <Plus :size="14" />
            Add Schedule
          </button>
        </div>
      </div>
    </header>

    <!-- Main -->
    <main class="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-6">

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <RefreshCw :size="24" class="animate-spin text-blue-500" />
        <span class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">Loading...</span>
      </div>

      <template v-else>

        <!-- S3 not configured banner -->
        <div
          v-if="!s3Configured"
          class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-5 flex gap-4 items-start"
        >
          <AlertCircle :size="20" class="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-semibold text-amber-900 dark:text-amber-400 tracking-tight mb-1">S3 storage not configured</p>
            <p class="text-amber-700 dark:text-amber-300/80 font-medium leading-relaxed">
              Scheduled backups require S3/MinIO storage.
              <router-link to="/minioconfig" class="underline hover:text-amber-900 dark:hover:text-amber-300 transition-colors">Configure S3 settings</router-link>
              before adding schedules.
            </p>
          </div>
        </div>

        <!-- Add schedule form -->
        <transition name="slide-fade">
          <div
            v-if="showForm"
            class="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 p-6 space-y-5 shadow-sm"
          >
            <h2 class="text-sm font-semibold tracking-tight">New Backup Schedule</h2>

            <!-- Volume -->
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                Volume <span class="text-red-500">*</span>
              </label>
              <div v-if="availableVolumes.length === 0" class="text-xs text-gray-500 dark:text-zinc-500">
                All volumes already have schedules.
              </div>
              <select
                v-else
                v-model="form.volumeName"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white"
              >
                <option v-for="vol in availableVolumes" :key="vol.name" :value="vol.name">
                  {{ vol.name }}
                </option>
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <!-- Interval -->
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                  Backup Interval
                </label>
                <select
                  v-model.number="form.intervalHours"
                  class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white"
                >
                  <option v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <!-- Keep count -->
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-2">
                  Keep last N backups
                </label>
                <select
                  v-model.number="form.keepCount"
                  class="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white"
                >
                  <option v-for="n in KEEP_OPTIONS" :key="n" :value="n">{{ n }} backups</option>
                </select>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <button
                @click="saveSchedule"
                :disabled="saving || !form.volumeName"
                class="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw v-if="saving" :size="14" class="animate-spin" />
                <CheckCircle v-else :size="14" />
                {{ saving ? 'Saving...' : 'Save Schedule' }}
              </button>
              <button
                @click="showForm = false"
                class="px-5 py-2.5 bg-gray-50 dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 rounded-lg border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 transition-all text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          </div>
        </transition>

        <!-- Empty state -->
        <div
          v-if="schedules.length === 0 && !showForm"
          class="flex flex-col items-center justify-center py-24 gap-4 text-center"
        >
          <div class="w-12 h-12 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center">
            <Calendar :size="22" class="text-gray-400 dark:text-zinc-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">No schedules yet</p>
            <p class="text-xs font-medium text-gray-500 dark:text-zinc-500 mt-1">
              Add a schedule to automatically back up a Docker volume.
            </p>
          </div>
          <button
            v-if="s3Configured"
            @click="openForm"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-100 transition-all mt-2"
          >
            <Plus :size="14" />
            Add first schedule
          </button>
        </div>

        <!-- Schedules list -->
        <div v-else-if="schedules.length > 0" class="space-y-3">
          <div
            v-for="sched in schedules"
            :key="sched.volumeName"
            class="group bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 transition-all p-5"
          >
            <!-- Top gradient line on hover -->
            <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl pointer-events-none"></div>

            <div class="flex items-start justify-between gap-4">
              <!-- Left: volume info -->
              <div class="flex items-start gap-3 min-w-0">
                <div class="w-8 h-8 rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center shrink-0 mt-0.5">
                  <HardDrive :size="14" class="text-gray-600 dark:text-zinc-400" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white truncate">
                    {{ sched.volumeName }}
                  </p>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    <span class="text-[11px] font-medium text-gray-500 dark:text-zinc-500 flex items-center gap-1">
                      <Clock :size="11" />
                      {{ intervalLabel(sched.intervalHours) }}
                    </span>
                    <span class="text-[11px] font-medium text-gray-500 dark:text-zinc-500">
                      Keep last {{ sched.keepCount }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right: actions -->
              <div class="flex items-center gap-2 shrink-0">
                <button
                  @click="runNow(sched.volumeName)"
                  :disabled="runningVolumes.has(sched.volumeName)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 rounded-lg text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title="Run backup now"
                >
                  <RefreshCw
                    :size="12"
                    :class="{ 'animate-spin': runningVolumes.has(sched.volumeName) }"
                  />
                  {{ runningVolumes.has(sched.volumeName) ? 'Running' : 'Run now' }}
                </button>

                <button
                  @click="deleteSchedule(sched.volumeName)"
                  class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-900/50 hover:text-red-600 dark:hover:text-red-400 text-gray-400 dark:text-zinc-600 transition-all"
                  title="Delete schedule"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <!-- Bottom: timestamps -->
            <div class="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800/60 flex flex-wrap gap-x-6 gap-y-1">
              <span class="text-[11px] font-medium text-gray-400 dark:text-zinc-600">
                Last run: <span class="text-gray-600 dark:text-zinc-400 font-semibold">{{ formatRelative(sched.lastRunAt) }}</span>
              </span>
              <span class="text-[11px] font-medium text-gray-400 dark:text-zinc-600">
                Next run: <span class="text-gray-600 dark:text-zinc-400 font-semibold">{{ formatNext(sched.nextRunAt) }}</span>
              </span>
              <span
                v-if="sched.enabled"
                class="text-[11px] font-bold uppercase tracking-[0.15em] text-green-600 dark:text-green-500 flex items-center gap-1"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
                Active
              </span>
              <span
                v-else
                class="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-600"
              >
                Paused
              </span>
            </div>
          </div>
        </div>

      </template>
    </main>
  </div>
</template>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
