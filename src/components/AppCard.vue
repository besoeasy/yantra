<script setup>
import { toRefs } from "vue";
import { Check, Bot, Play } from "lucide-vue-next";

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
</script>

<template>
  <div
    class="group relative flex flex-col bg-white dark:bg-[#0c0c0e] border border-gray-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:border-gray-900 dark:hover:border-slate-400 hover:shadow-xl hover:-translate-y-1 will-change-transform"
    role="button"
    tabindex="0"
    :aria-label="`Open ${app?.name ?? 'app'} details`"
  >
    <!-- Top row: logo + installed badge -->
    <div class="flex items-start justify-between mb-3">
      <div class="w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center p-2 shrink-0 transition-transform duration-300 group-hover:scale-105">
        <img
          v-if="app?.logo"
          :src="app.logo"
          :alt="app.name"
          class="w-full h-full object-contain"
          loading="lazy"
        />
        <Bot v-else :size="22" class="text-slate-400" />
      </div>

      <div class="flex items-center gap-1.5 mt-0.5">
        <!-- Running instances badge -->
        <span
          v-if="instanceCount > 0"
          class="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-1.5 py-0.5 rounded-full"
          title="Running instances"
        >
          <Play :size="8" class="fill-current" />
          {{ instanceCount }}
        </span>
        <!-- Installed checkmark -->
        <div
          v-else-if="app?.isInstalled"
          class="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"
          title="Installed"
        >
          <Check :size="11" stroke-width="3" />
        </div>
      </div>
    </div>

    <!-- App name -->
    <h3 class="text-sm font-bold text-gray-900 dark:text-slate-100 truncate mb-1 group-hover:text-black dark:group-hover:text-white transition-colors">
      {{ app?.name || 'Unknown App' }}
    </h3>

    <!-- Description -->
    <p class="text-xs text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1">
      {{ app?.description || 'No description available' }}
    </p>

    <!-- Category tag -->
    <div class="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
      <span class="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wide truncate block">
        {{ app?.tags?.[0] || '' }}
      </span>
    </div>
  </div>
</template>
