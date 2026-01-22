<script setup>
import { ArrowRight } from "lucide-vue-next";

const { containers, isTemporary, getExpirationInfo } = defineProps({
  containers: { type: Array, default: () => [] },
  isTemporary: { type: Function, required: true },
  getExpirationInfo: { type: Function, required: true },
});

const emit = defineEmits(["select"]);
</script>

<template>
  <div style="display: contents">
    <div
      v-for="(container, index) in containers"
      :key="container.id"
      :style="{ animationDelay: `${index * 50}ms` }"
      @click="emit('select', container)"
      class="relative h-full overflow-hidden group rounded-2xl cursor-pointer transition-all duration-500 hover:-translate-y-1 animate-fadeIn"
    >
      <div class="absolute inset-0 bg-white dark:bg-black"></div>

      <div
        class="relative z-20 h-full p-5 flex flex-col justify-between border border-black/10 dark:border-white/10 rounded-2xl backdrop-blur-sm group-hover:border-black/20 dark:group-hover:border-white/20 transition-none"
      >
        <div class="flex items-center gap-4 mb-4">
          <div class="relative shrink-0">
            <div class="absolute inset-0 bg-black/10 dark:bg-white/5 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
            <div
              class="relative w-14 h-14 rounded-2xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500"
            >
              <span class="text-2xl">📂</span>
            </div>
          </div>

          <div class="min-w-0">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 mb-1 group-hover:text-black dark:group-hover:text-white transition-colors">
              {{ container.labels?.["yantra.volume-browser"] || container.name }}
            </h3>
            <span
              class="text-xs font-semibold px-2.5 py-1 rounded-lg border bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
            >
              Active
            </span>
          </div>
        </div>

        <div v-if="isTemporary(container)" class="mb-4 px-1">
          <div class="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg border border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/5">
            <span class="font-medium text-black/70 dark:text-white/70">Expires in</span>
            <span
              :class="getExpirationInfo(container).isExpiringSoon ? 'animate-pulse underline underline-offset-2 font-bold' : 'font-semibold'"
              class="font-mono tabular-nums text-black dark:text-white"
            >
              {{ getExpirationInfo(container).timeRemaining }}
            </span>
          </div>
        </div>

        <div class="mt-auto pt-3 flex items-center justify-between text-sm border-t border-slate-200/70 dark:border-slate-700/60 group-hover:border-black/15 dark:group-hover:border-white/15 transition-colors">
          <span class="text-slate-500 dark:text-gray-400 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">Manage Files</span>
          <ArrowRight
            :size="16"
            class="text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white transform group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
    </div>
  </div>
</template>
