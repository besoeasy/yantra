<script setup>
import { computed } from "vue";
import { Layers, Database, Box, HardDrive, Cpu, Zap, Activity } from "lucide-vue-next";

const props = defineProps({
  runningApps: { type: Number, default: 0 },
  totalVolumes: { type: Number, default: 0 },
  temporaryCount: { type: Number, default: 0 },
  imagesCount: { type: Number, default: 0 },
});

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night coding?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
});
</script>

<template>
  <div class="relative group flex flex-col bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden transition-all duration-400 hover:shadow-2xl hover:shadow-black/5 dark:hover:shadow-black/40 hover:border-gray-300 dark:hover:border-zinc-600">
    
    <!-- Hover Accents -->
    <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTUwLCAxNTAsIDE1MCwgMC4xKSIvPjwvc3ZnPg==')] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>

    <div class="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row items-stretch gap-8">
      
      <!-- Hero Section (Left) -->
      <div class="flex-1 flex flex-col justify-center min-w-[200px]">
        <div class="flex items-center gap-2 mb-4">
           <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
           <span class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">System Online</span>
        </div>
        
        <h1 class="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-white tracking-tight mb-3 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {{ greeting }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-zinc-400 font-medium max-w-xs leading-relaxed">
          Your stack is running smoothly. Here is your live performance overview.
        </p>
        
        <div class="mt-8 flex items-center gap-3">
           <div class="px-3 py-1.5 rounded-md bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 flex items-center gap-2 group-hover:border-gray-300 dark:group-hover:border-zinc-700 transition-colors">
              <Cpu class="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
              <span class="text-[11px] font-semibold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">Healthy</span>
           </div>
           <div class="px-3 py-1.5 rounded-md bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center gap-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/20 transition-colors">
              <Zap class="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" />
              <span class="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Active</span>
           </div>
        </div>
      </div>

      <!-- Stats Grid (Right) -->
      <div class="flex-none w-full md:w-auto md:min-w-[400px] grid grid-cols-2 gap-4">
        
        <!-- Running Apps -->
        <div class="relative flex flex-col p-4 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800/50 transition-colors group-hover:border-gray-200 dark:group-hover:border-zinc-700/50">
           <div class="flex items-center gap-2 mb-3">
              <Layers class="w-4 h-4 text-blue-500" />
              <span class="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Apps</span>
           </div>
           <div class="text-4xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tighter">{{ props.runningApps }}</div>
        </div>

        <!-- Volumes -->
        <div class="relative flex flex-col p-4 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800/50 transition-colors group-hover:border-gray-200 dark:group-hover:border-zinc-700/50">
           <div class="flex items-center gap-2 mb-3">
              <HardDrive class="w-4 h-4 text-violet-500" />
              <span class="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Volumes</span>
           </div>
           <div class="text-4xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tighter">{{ props.totalVolumes }}</div>
        </div>

        <!-- Images -->
        <div class="relative flex flex-col p-4 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800/50 transition-colors group-hover:border-gray-200 dark:group-hover:border-zinc-700/50">
           <div class="flex items-center gap-2 mb-3">
              <Database class="w-4 h-4 text-green-500" />
              <span class="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Images</span>
           </div>
           <div class="text-4xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tighter">{{ props.imagesCount }}</div>
        </div>
        
        <!-- Temp -->
        <div class="relative flex flex-col p-4 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800/50 transition-colors group-hover:border-gray-200 dark:group-hover:border-zinc-700/50">
           <div class="flex items-center gap-2 mb-3">
              <Box class="w-4 h-4 text-amber-500" />
              <span class="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Temp</span>
           </div>
           <div class="text-4xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tighter">{{ props.temporaryCount }}</div>
        </div>

      </div>
    </div>
  </div>
</template>
