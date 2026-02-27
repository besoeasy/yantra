<script setup>
import { toRefs, computed } from "vue";
import { 
  Bot, 
  ArrowRight, 
  Tag, 
  Activity, 
  Box,
  Layers
} from "lucide-vue-next";

const props = defineProps({
  app: {
    type: Object,
    required: true,
  },
  instanceCount: {
    type: Number,
    default: 0,
  },
});

const { app, instanceCount } = toRefs(props);

// Determine the state for UI color-coding
const appState = computed(() => {
  if (instanceCount.value > 0) return 'running';
  if (app.value?.isInstalled) return 'installed';
  return 'available';
});
</script>

<template>
  <div
    class="group relative flex flex-col h-full bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-zinc-800 rounded-xl p-5 cursor-pointer overflow-hidden transition-all duration-400 hover:shadow-2xl hover:shadow-black/5 dark:hover:shadow-black/40 hover:-translate-y-1 hover:border-gray-300 dark:hover:border-zinc-600"
    role="button"
    tabindex="0"
    :aria-label="`Open ${app?.name ?? 'app'} details`"
  >
    <!-- Subtle Top Accent Line that reveals on hover -->
    <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

    <!-- Background Pattern (Subtle grid that animates on hover) -->
    <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTUwLCAxNTAsIDE1MCwgMC4xKSIvPjwvc3ZnPg==')] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>

    <!-- Top row: Logo & Status -->
    <div class="relative z-10 flex items-start justify-between mb-5">
      <!-- Minimalist Logo Container -->
      <div class="w-12 h-12 rounded-lg bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center justify-center p-2.5 shrink-0 transition-all duration-500 group-hover:scale-105 group-hover:shadow-md">
        <img
          v-if="app?.logo"
          :src="app.logo"
          :alt="app.name"
          class="w-full h-full object-contain filter group-hover:brightness-110 transition-all"
          loading="lazy"
        />
        <Bot v-else :size="24" class="text-gray-400 dark:text-zinc-500 group-hover:text-blue-500 transition-colors" />
      </div>

      <!-- Animated Status Indicator (Expands on hover) -->
      <div class="flex items-center justify-end h-8">
        <!-- Running -->
        <div v-if="appState === 'running'" class="relative flex items-center justify-end group/status">
          <div class="flex items-center gap-2 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20 px-2 py-1.5 rounded-full overflow-hidden transition-all duration-300 w-8 group-hover:w-[100px]">
            <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0 ml-0.5"></div>
            <span class="text-[11px] font-bold tracking-wide uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
              Active ({{ instanceCount }})
            </span>
          </div>
        </div>
        
        <!-- Installed / Ready -->
        <div v-else-if="appState === 'installed'" class="relative flex items-center justify-end group/status">
          <div class="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-500/20 px-2 py-1.5 rounded-full overflow-hidden transition-all duration-300 w-8 group-hover:w-[85px]">
            <div class="w-2 h-2 rounded-full bg-yellow-500 shrink-0 ml-0.5"></div>
            <span class="text-[11px] font-bold tracking-wide uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
              Ready
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="relative z-10 flex-1 flex flex-col">
      <!-- Clean Typography -->
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1.5 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
        {{ app?.name || 'Unknown App' }}
      </h3>

      <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-6 font-medium">
        {{ app?.description || 'No description available. Click to view configuration and details.' }}
      </p>

      <div class="mt-auto pt-4 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between overflow-hidden">
        <!-- Category tag -->
        <div class="flex items-center gap-1.5 text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors duration-300">
          <Layers :size="14" />
          <span class="text-[11px] font-semibold uppercase tracking-wider">
            {{ app?.tags?.[0] || 'Application' }}
          </span>
        </div>
        
        <!-- Slick Action Button -->
        <div class="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold text-xs transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)">
          <span>Manage</span>
          <ArrowRight :size="14" class="group-hover:translate-x-1 transition-transform duration-300" />
        </div>
      </div>
    </div>
  </div>
</template>
