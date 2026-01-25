<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Globe, MapPin, Network, RefreshCw, Server, ShieldCheck, AlertCircle } from "lucide-vue-next";

const props = defineProps({
  refreshMs: { type: Number, default: 5 * 60_000 },
});

const loading = ref(true);
const error = ref(null);
const identity = ref(null);
const isIpHovered = ref(false);
const isLocationHovered = ref(false);
let refreshHandle = null;

async function loadIdentity({ force } = { force: false }) {
  try {
    loading.value = true;
    error.value = null;

    const url = force ? "/api/network/identity?force=true" : "/api/network/identity";
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data?.success) {
      throw new Error(data?.error || "Failed to load network identity");
    }

    identity.value = data.identity || null;
  } catch (e) {
    error.value = e?.message || String(e);
    identity.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadIdentity();
  refreshHandle = setInterval(() => {
    loadIdentity();
  }, Math.max(30_000, Number(props.refreshMs) || 300_000));
});

onUnmounted(() => {
  if (refreshHandle) {
    clearInterval(refreshHandle);
    refreshHandle = null;
  }
});

const locationText = computed(() => {
  const v = identity.value;
  const parts = [v?.city, v?.region, v?.country].filter(Boolean);
  return parts.join(", ");
});

const ispText = computed(() => {
  const v = identity.value;
  return v?.isp || v?.org || "N/A";
});

const displayIp = computed(() => {
  if (!identity.value?.ip) return "—";
  if (isIpHovered.value) return identity.value.ip;
  // Make it look cool as requested 'XXX.XX'
  return "XXX.XX.XXX.XX"; 
});

const displayLocation = computed(() => {
  if (!locationText.value) return "—";
  if (isLocationHovered.value) return locationText.value;
  return "XXX, XX";
});

const theme = {
  text: 'text-indigo-600 dark:text-indigo-400',
  bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
  border: 'group-hover:border-indigo-500/30 dark:group-hover:border-indigo-400/30',
};
</script>

<template>
  <div class="relative h-full overflow-hidden group rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-900/50" :class="theme.border">
    <!-- Background Texture -->
    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
         style="background-image: radial-gradient(circle at 1rem 1rem, currentColor 1px, transparent 0); background-size: 1rem 1rem;">
    </div>

    <div class="relative z-10 h-full p-6 flex flex-col justify-between">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl transition-colors duration-300" :class="theme.bg">
            <Globe class="w-5 h-5 transition-transform duration-700 ease-in-out group-hover:rotate-12" :class="theme.text" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Identity</h3>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="relative flex h-2 w-2">
                <span v-if="!loading && !error" class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                <span class="relative inline-flex rounded-full h-2 w-2" :class="error ? 'bg-rose-500' : loading ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              </span>
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ loading ? 'Updating...' : error ? 'Offline' : 'Connected' }}
              </span>
            </div>
          </div>
        </div>
        
        <button 
           @click="loadIdentity({ force: true })"
           class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
           :class="{ 'animate-spin': loading }"
        >
           <RefreshCw class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Content -->
      <div class="flex flex-col gap-4 mt-4 h-full justify-end">
        
        <!-- Error State -->
        <div v-if="error" class="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-xl p-3 flex items-start gap-3">
          <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <div class="text-xs font-bold text-rose-600 dark:text-rose-400">Connection Failed</div>
            <div class="text-[10px] leading-tight text-rose-500/80 dark:text-rose-400/70 mt-1 line-clamp-2">{{ error }}</div>
          </div>
        </div>

        <!-- Success/Loading State -->
        <template v-else>
           <!-- IP Address -->
           <div class="relative group/ip" @mouseenter="isIpHovered = true" @mouseleave="isIpHovered = false">
             <div class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-2">
               Public Endpoint
               <ShieldCheck v-if="identity?.ip" class="w-3 h-3 text-emerald-500" />
             </div>
             
             <div v-if="loading && !identity" class="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
             <div v-else class="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white break-all transition-colors duration-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
               {{ displayIp }}
             </div>
           </div>

           <!-- Details Grid -->
           <div class="grid grid-cols-1 gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
             <div class="flex items-center gap-3 group/location" @mouseenter="isLocationHovered = true" @mouseleave="isLocationHovered = false">
                <MapPin class="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <div class="min-w-0">
                  <div class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-600">Location</div>
                  <div v-if="loading && !identity" class="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-1"></div>
                  <div v-else class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate transition-colors duration-300" :title="locationText">{{ displayLocation }}</div>
                </div>
             </div>
             
             <div class="flex items-center gap-3">
                <Server class="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <div class="min-w-0">
                  <div class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-600">Provider</div>
                  <div v-if="loading && !identity" class="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-1"></div>
                  <div v-else class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate" :title="ispText">{{ ispText }}</div>
                </div>
             </div>
           </div>
        </template>
        
      </div>
    </div>
  </div>
</template>
