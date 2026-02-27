<script setup>
import { useRouter } from 'vue-router'
import { ShieldAlert, ArrowRight, Zap } from 'lucide-vue-next'

const router = useRouter()
</script>

<template>
  <div
    @click="router.push('/apps/watchtower')"
    class="relative h-full group flex flex-col bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-zinc-800 rounded-xl p-6 cursor-pointer overflow-hidden transition-all duration-400 hover:shadow-2xl hover:shadow-black/5 dark:hover:shadow-black/40 hover:-translate-y-1 hover:border-gray-300 dark:hover:border-zinc-600"
  >
    <!-- Hover Accents -->
    <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTUwLCAxNTAsIDE1MCwgMC4xKSIvPjwvc3ZnPg==')] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>

    <div class="relative z-10 flex items-start justify-between mb-5">
      <div class="flex items-center gap-4">
        <!-- Icon Container -->
        <div class="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-all duration-500">
          <ShieldAlert class="w-5 h-5 text-amber-600 dark:text-amber-500" />
        </div>
        
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white tracking-tight group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
            Security Update
          </h3>
          <div class="flex items-center gap-2 mt-1">
             <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
             <span class="text-[11px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
               Watchtower Missing
             </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="relative z-10 flex-1 flex flex-col justify-center">
      <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed font-medium mb-6">
        Automate your container updates to keep your system secure and up-to-date.
      </p>

      <div class="mt-auto pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between overflow-hidden">
        <div class="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 transition-colors duration-300">
          <Zap class="w-3.5 h-3.5" />
          <span class="text-[11px] font-bold uppercase tracking-wider">
            Recommended
          </span>
        </div>
        
        <div class="flex items-center gap-1 text-gray-900 dark:text-white font-semibold text-xs transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)">
          <span>Install Now</span>
          <ArrowRight class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
        </div>
      </div>
    </div>
  </div>
</template>
