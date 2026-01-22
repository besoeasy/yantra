<script setup>
import { ArrowRight } from "lucide-vue-next";

const { containers, formatUptime, isTemporary, getExpirationInfo } = defineProps({
  containers: { type: Array, default: () => [] },
  formatUptime: { type: Function, required: true },
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
      class="relative h-full overflow-hidden group cursor-pointer transition-colors duration-300 animate-fadeIn"
    >
      <div class="absolute inset-0 bg-white dark:bg-black"></div>

      <div
        class="relative z-20 h-full p-5 flex flex-col justify-between border border-black/10 dark:border-white/10 rounded-2xl backdrop-blur-sm group-hover:border-black/20 dark:group-hover:border-white/20 transition-none"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-4 min-w-0">
            <div class="relative shrink-0">
              <div class="absolute inset-0 bg-black/10 dark:bg-white/5 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-500"></div>

              <div
                class="relative w-14 h-14 rounded-2xl bg-white/80 dark:bg-black/40 border border-black/10 dark:border-white/10 flex items-center justify-center overflow-hidden"
              >
                <img
                  v-if="container.app && container.app.logo"
                  :src="container.app.logo"
                  :alt="container.name"
                  class="w-12 h-12 object-contain filter group-hover:brightness-110 transition-all"
                />
                <div v-else class="text-2xl">🐳</div>
              </div>

              <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-white/90 dark:bg-black/90 border border-black/10 dark:border-white/10 rounded-full flex items-center justify-center">
                <div
                  :class="container.state === 'running' ? 'bg-black dark:bg-white' : 'bg-black/30 dark:bg-white/30'"
                  class="w-3 h-3 rounded-full"
                ></div>
              </div>
            </div>

            <div class="min-w-0">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-200 transition-colors">
                {{ container.app ? container.app.name : container.name.replace(/^\//, "") }}
              </h3>
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  class="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                  :class="
                    container.state === 'running'
                      ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                      : 'bg-white/70 text-black/70 border-black/10 dark:bg-white/5 dark:text-white/70 dark:border-white/10'
                  "
                >
                  {{ container.state }}
                </span>
                <span
                  v-if="isTemporary(container)"
                  class="text-xs font-semibold px-2.5 py-1 rounded-lg border border-dashed bg-white/70 text-black/70 border-black/15 dark:bg-white/5 dark:text-white/70 dark:border-white/15"
                >
                  Temp
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-3 mb-5 flex-1">
          <div
            v-if="container.state === 'running' && formatUptime(container)"
            class="flex items-center justify-between text-sm py-2 border-b border-slate-200/70 dark:border-slate-700/60 last:border-0 border-dashed"
          >
            <span class="text-slate-500 dark:text-gray-400 font-medium">Uptime</span>
            <span class="text-slate-700 dark:text-gray-200 font-semibold font-mono tabular-nums">{{ formatUptime(container) }}</span>
          </div>

          <div
            v-if="isTemporary(container)"
            class="flex items-center justify-between text-sm py-2 border-b border-slate-200/70 dark:border-slate-700/60 last:border-0 border-dashed"
          >
            <span class="text-slate-500 dark:text-gray-400 font-medium">Expires</span>
            <span
              :class="getExpirationInfo(container).isExpiringSoon ? 'animate-pulse underline underline-offset-2' : ''"
              class="font-bold font-mono tabular-nums text-black dark:text-white"
            >
              {{ getExpirationInfo(container).timeRemaining }}
            </span>
          </div>
        </div>

        <div class="mt-auto pt-4 flex items-center justify-between text-sm border-t border-slate-200/70 dark:border-slate-700/60 group-hover:border-black/15 dark:group-hover:border-white/15 transition-colors">
          <span class="text-slate-500 dark:text-gray-400 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">Manage App</span>
          <div
            class="w-9 h-9 rounded-full bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center text-black/80 dark:text-white group-hover:border-black/20 dark:group-hover:border-white/20 group-hover:bg-black/5 dark:group-hover:bg-white/10 transition-colors"
          >
            <ArrowRight :size="16" class="transform group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
