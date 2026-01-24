<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Boxes, HardDrive, Database, RefreshCw } from "lucide-vue-next";
import { formatBytes } from "../../utils/metrics.js";

const props = defineProps({
  images: { type: Array, default: () => [] },
  volumes: { type: Array, default: () => [] },
  intervalMs: { type: Number, default: 10_000 },
  hoverCooldownMs: { type: Number, default: 3_000 },
});

const isDark = ref(false); // Legacy ref, kept if needed for heavy charts, but we use tailwind classes now
function syncTheme() {
  isDark.value = document.documentElement.classList.contains('dark');
}

const hovered = ref(false);
const active = ref("images"); // 'images' | 'volumes'
const lastHoverFlipAt = ref(0);
let intervalHandle = null;

const hasImages = computed(() => Array.isArray(props.images) && props.images.length > 0);
const hasVolumes = computed(() => Array.isArray(props.volumes) && props.volumes.length > 0);

const availableModes = computed(() => {
  const modes = [];
  if (hasImages.value) modes.push("images");
  if (hasVolumes.value) modes.push("volumes");
  return modes;
});

function pickInitialMode() {
  if (hasImages.value) return "images";
  if (hasVolumes.value) return "volumes";
  return "images";
}

function getOtherMode(mode) {
  if (mode === "images") return hasVolumes.value ? "volumes" : "images";
  return hasImages.value ? "images" : "volumes";
}

function flip() {
  if (availableModes.value.length < 2) return;
  active.value = getOtherMode(active.value);
}

function flipOnHoverIfAllowed() {
  if (availableModes.value.length < 2) return;
  const now = Date.now();
  const cooldown = Math.max(0, Number(props.hoverCooldownMs) || 0);
  if (cooldown > 0 && now - lastHoverFlipAt.value < cooldown) return;
  lastHoverFlipAt.value = now;
  flip();
}

function startInterval() {
  stopInterval();
  if (availableModes.value.length < 2) return;
  intervalHandle = setInterval(() => {
    if (!hovered.value) flip();
  }, Math.max(1000, Number(props.intervalMs) || 10_000));
}

function stopInterval() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

function onEnter() {
  hovered.value = true;
  stopInterval();
  flipOnHoverIfAllowed();
}

function onLeave() {
  hovered.value = false;
  startInterval();
}

watch(
  () => [hasImages.value, hasVolumes.value],
  () => {
    const initial = pickInitialMode();
    if (!availableModes.value.includes(active.value)) active.value = initial;
    startInterval();
  },
  { immediate: true },
);

onMounted(() => {
  active.value = pickInitialMode();
  startInterval();
});

onUnmounted(() => {
  stopInterval();
});

const metrics = computed(() => {
  if (active.value === "images") {
    const total = props.images.reduce((sum, img) => sum + (img?.sizeBytes || 0), 0);
    const unused = props.images.filter((img) => !img?.isUsed).reduce((sum, img) => sum + (img?.sizeBytes || 0), 0);
    const used = total - unused;
    return { total, used, unused };
  }

  const total = props.volumes.reduce((sum, vol) => sum + (vol?.sizeBytes || 0), 0);
  const unused = props.volumes.filter((vol) => !vol?.isUsed).reduce((sum, vol) => sum + (vol?.sizeBytes || 0), 0);
  const used = total - unused;
  return { total, used, unused };
});

const usageStats = computed(() => {
  const { total, used } = metrics.value;
  if (!total) return { percent: 0, label: '0%' };
  const pct = Math.min(100, Math.round((used / total) * 100));
  return { percent: pct, label: `${pct}%` };
});

const theme = computed(() => {
  const isImages = active.value === "images";
  if (isImages) {
    return {
      text: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
      border: 'group-hover:border-blue-500/30 dark:group-hover:border-blue-400/30',
      progress: 'bg-blue-500 dark:bg-blue-400',
      icon: Boxes,
      label: 'Docker Images'
    };
  }
  return {
    text: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    border: 'group-hover:border-violet-500/30 dark:group-hover:border-violet-400/30',
    progress: 'bg-violet-500 dark:bg-violet-400',
    icon: Database,
    label: 'Data Volumes'
  };
});
</script>

<template>
  <div
    class="relative h-full overflow-hidden group rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-900/50"
    :class="theme.border"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <!-- Background Texture -->
    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
         style="background-image: radial-gradient(circle at 1rem 1rem, currentColor 1px, transparent 0); background-size: 1rem 1rem;">
    </div>

    <!-- Rotation Progress Bar (Top) -->
    <div v-if="availableModes.length > 1 && !hovered" class="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
       <div class="h-full bg-slate-300 dark:bg-slate-600 animate-progress origin-left" 
            :style="{ animationDuration: `${intervalMs}ms` }"></div>
    </div>

    <div class="relative z-10 h-full p-6 flex flex-col justify-between">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl transition-colors duration-300" :class="theme.bg">
            <component :is="theme.icon" class="w-5 h-5 transition-transform duration-500 ease-out group-hover:scale-110" :class="theme.text" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Storage</h3>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors duration-300">
                {{ theme.label }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400"
             :class="hovered ? 'opacity-100' : 'opacity-0'"
             title="Click/Hover to toggle">
          <RefreshCw class="w-4 h-4" />
        </div>
      </div>

      <!-- Main Content with Flip Transition -->
      <transition 
          mode="out-in"
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform translate-y-2 opacity-0"
          enter-to-class="transform translate-y-0 opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform translate-y-0 opacity-100"
          leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div :key="active" class="flex flex-col gap-5 mt-4">
          <!-- Big Metric -->
          <div>
             <div class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1 flex justify-between">
               <span>Used Space</span>
               <span class="tabular-nums font-mono text-slate-600 dark:text-slate-400">{{ formatBytes(metrics.used) }}</span>
             </div>
             
             <div class="flex items-end gap-3">
                <div class="text-4xl sm:text-5xl font-black tracking-tighter leading-none text-slate-900 dark:text-white tabular-nums">
                  {{ usageStats.percent }}<span class="text-2xl text-slate-400 dark:text-slate-600 font-bold ml-0.5">%</span>
                </div>
             </div>
          </div>

          <!-- Progress Bar -->
          <div class="space-y-2">
            <div class="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
               <div class="h-full rounded-full transition-all duration-700 ease-out" 
                    :class="theme.progress"
                    :style="{ width: `${usageStats.percent}%` }">
               </div>
            </div>
            
            <div class="flex justify-between items-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span>0%</span>
              <span class="flex items-center gap-1.5">
                 Total: <span class="text-slate-800 dark:text-slate-200">{{ formatBytes(metrics.total) }}</span>
              </span>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
@keyframes progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.animate-progress {
  animation-name: progress;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
</style>
