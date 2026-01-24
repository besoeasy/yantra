<script setup>
import { computed, toRefs } from "vue";
import { Check, ChevronRight } from "lucide-vue-next";

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

const categories = computed(() => {
  const raw = app.value?.category ?? "";
  const parts = raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return {
    shown: parts.slice(0, 2),
    remaining: Math.max(0, parts.length - 2),
  };
});

const accent = computed(() => {
  const installed = Boolean(app.value?.isInstalled);
  if (installed) {
    return {
      ring: "focus:ring-emerald-500",
      glow: "bg-emerald-200 dark:bg-emerald-400/20",
      iconBg: "bg-emerald-900/10 dark:bg-emerald-900/30",
      iconHover: "group-hover:bg-emerald-900/15 dark:group-hover:bg-emerald-800/40",
      textHover: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
      check: "text-emerald-500 dark:text-emerald-400",
      arrow: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
    };
  }

  return {
    ring: "focus:ring-sky-500",
    glow: "bg-sky-200 dark:bg-sky-400/20",
    iconBg: "bg-slate-900/5 dark:bg-slate-900/30",
    iconHover: "group-hover:bg-slate-900/10 dark:group-hover:bg-slate-800/40",
    textHover: "group-hover:text-sky-700 dark:group-hover:text-sky-300",
    check: "text-sky-600 dark:text-sky-300",
    arrow: "text-sky-700 dark:text-sky-300",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  };
});
</script>

<template>
  <button
    type="button"
    class="group relative w-full text-left overflow-hidden bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 focus:outline-none focus:ring-4"
    :class="accent.ring"
    :aria-label="`Open ${app?.name ?? 'app'} details`"
  >
    <!-- Gradient Glow -->
    <div
      class="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-70 transition-opacity duration-500"
      :class="accent.glow"
    ></div>

    <div class="relative z-10">
      <!-- Icon -->
      <div
        class="flex items-center justify-center w-20 h-20 rounded-2xl mb-5 transition-all duration-300 group-hover:scale-110"
        :class="[accent.iconBg, accent.iconHover]"
      >
        <img v-if="app?.logo" :src="app.logo" :alt="app.name" class="w-12 h-12 object-contain" loading="lazy" />
        <div v-else class="text-2xl font-bold text-slate-900 dark:text-white">
          {{ (app?.name ?? "?").slice(0, 1).toUpperCase() }}
        </div>
      </div>

      <!-- Title + badges -->
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-1 transition-colors" :class="accent.textHover">
          {{ app.name }}
        </h3>

        <div class="flex items-center gap-2 pt-0.5">
          <span v-if="app?.isInstalled" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" :class="accent.badge"> Installed </span>
          <span
            v-if="instanceCount > 0"
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            :title="`${instanceCount} running`"
          >
            {{ instanceCount }}
          </span>
        </div>
      </div>

      <p class="text-slate-600 dark:text-gray-300 leading-relaxed line-clamp-2 mb-5">
        {{ app.description || "No description available" }}
      </p>

      <!-- “Features” (categories) -->
      <ul v-if="categories.shown.length" class="space-y-2 text-sm text-slate-500 dark:text-gray-400">
        <li v-for="cat in categories.shown" :key="cat" class="flex items-center gap-2">
          <Check :size="16" :class="accent.check" />
          <span class="capitalize">{{ cat }}</span>
        </li>
        <li v-if="categories.remaining" class="flex items-center gap-2">
          <Check :size="16" :class="accent.check" />
          <span>+{{ categories.remaining }} more</span>
        </li>
      </ul>

      <!-- Arrow -->
      <div class="mt-6 flex items-center font-semibold text-sm group-hover:translate-x-2 transition-transform" :class="accent.arrow">
        Install <ChevronRight :size="16" class="ml-1" />
      </div>
    </div>
  </button>
</template>
