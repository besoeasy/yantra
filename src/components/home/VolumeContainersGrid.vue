<script setup>
import { useCurrentTime } from "../../composables/useCurrentTime";
import { useRouter } from "vue-router";
import { FolderOpen, ArrowRight, ExternalLink } from "lucide-vue-next";

const { containers } = defineProps({
  containers: { type: Array, default: () => [] },
});

const router = useRouter();
const { currentTime } = useCurrentTime();

function openBrowser(e, container) {
  e.stopPropagation();
  const pub = container.ports?.find((p) => p.PublicPort)?.PublicPort;
  if (pub) {
    window.open(`http://${window.location.hostname}:${pub}`, "_blank");
  }
}

function isTemporary(container) {
  return container?.labels?.["yantr.expireAt"];
}

function formatTimeRemaining(expireAt) {
  const remaining = parseInt(expireAt, 10) * 1000 - currentTime.value;
  if (remaining <= 0) return 'Expired';
  const totalSeconds = Math.floor(remaining / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getExpirationInfo(container) {
  if (!isTemporary(container)) return null;
  const expireAt = container.labels["yantr.expireAt"];
  return {
    expireAt,
    timeRemaining: formatTimeRemaining(expireAt),
    isExpiringSoon: parseInt(expireAt, 10) * 1000 - currentTime.value < 60 * 60 * 1000,
  };
}
</script>

<template>
  <div style="display: contents">
    <div
      v-for="(container, index) in containers"
      :key="container.id"
      :style="{ animationDelay: `${index * 50}ms` }"
      @click="router.push(`/containers/${container.id}`)"
      @keydown.enter.prevent="router.push(`/containers/${container.id}`)"
      @keydown.space.prevent="router.push(`/containers/${container.id}`)"
      role="button"
      tabindex="0"
      class="group relative h-full flex flex-col bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden transition-all duration-400 hover:shadow-2xl hover:shadow-black/5 dark:hover:shadow-black/40 hover:-translate-y-1 hover:border-gray-300 dark:hover:border-zinc-600 cursor-pointer animate-fadeIn focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      <!-- Hover Accents -->
      <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTUwLCAxNTAsIDE1MCwgMC4xKSIvPjwvc3ZnPg==')] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>

      <div class="relative z-10 flex flex-col h-full p-5">
        <div class="flex items-start justify-between mb-4">
          <div class="min-w-0 pr-4">
             <h3 class="font-semibold text-base text-gray-900 dark:text-white line-clamp-1 mb-2 tracking-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" :title="container.labels?.['yantr.volume-browser'] || container.name">
               {{ container.labels?.["yantr.volume-browser"] || container.name }}
             </h3>
         
             <div class="flex items-center gap-2 flex-wrap">
                <button
                  @click="openBrowser($event, container)"
                  class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-50/50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 hover:bg-violet-100/50 dark:hover:bg-violet-500/20 transition-colors"
                >
                  <ExternalLink :size="10" />
                  Browse
                </button>
                
                <span v-if="isTemporary(container)" 
                      class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50/50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500">
                  Temp
                </span>
             </div>
          </div>
          
          <!-- Logo Container -->
          <div class="w-12 h-12 rounded-lg bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-zinc-700 transition-all duration-500 relative">
             <FolderOpen class="w-6 h-6 text-gray-400 dark:text-zinc-500 group-hover:text-violet-500 transition-colors" />
             
             <!-- Status Dot -->
             <div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0A0A0A] bg-green-500 animate-pulse"></div>
          </div>
        </div>

        <div v-if="isTemporary(container)" class="mb-4">
           <div class="flex items-baseline gap-1.5">
             <span class="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-500">Expires In:</span>
             <span class="font-mono text-sm font-semibold tracking-tighter"
                :class="[
                    getExpirationInfo(container).timeRemaining === 'Expired'
                      ? 'text-red-600 dark:text-red-500'
                      : getExpirationInfo(container).isExpiringSoon
                        ? 'text-amber-600 dark:text-amber-500 animate-pulse'
                        : 'text-gray-700 dark:text-gray-300',
                  ]"
              >{{ getExpirationInfo(container).timeRemaining }}</span>
           </div>
        </div>
        <div v-else class="mb-4">
           <div class="flex items-baseline gap-1.5">
             <span class="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-500">Status:</span>
             <span class="font-mono text-sm font-semibold tracking-tighter text-gray-700 dark:text-gray-300">Active</span>
           </div>
        </div>

        <div class="mt-auto pt-4 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between overflow-hidden">
          <div class="flex items-center gap-1.5 text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors duration-300">
            <span class="text-[10px] font-semibold uppercase tracking-[0.15em]">Details</span>
          </div>
          
          <div class="flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold text-xs transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)">
            <span>Inspect</span>
            <ArrowRight :size="14" class="group-hover:translate-x-1 transition-transform duration-300" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
