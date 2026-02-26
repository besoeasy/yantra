<script setup>
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'
import { notificationState, useNotification } from '../composables/useNotification'

const { dismiss } = useNotification()

const iconMap = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
}

const colorMap = {
  success: {
    bar:  'bg-emerald-500',
    icon: 'text-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  error: {
    bar:  'bg-red-500',
    icon: 'text-red-500',
    border: 'border-red-200 dark:border-red-800',
  },
  warning: {
    bar:  'bg-amber-400',
    icon: 'text-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },
  info: {
    bar:  'bg-blue-500',
    icon: 'text-blue-500',
    border: 'border-blue-200 dark:border-blue-800',
  },
}
</script>

<template>
  <Transition name="banner">
    <div
      v-if="notificationState"
      class="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 md:top-4 z-[60] w-[calc(100%-2rem)] max-w-sm pointer-events-auto"
    >
      <div
        :class="[
          'relative flex items-start gap-3 rounded-xl px-4 py-3.5 shadow-xl border',
          'bg-white dark:bg-slate-900',
          colorMap[notificationState.type].border,
        ]"
      >
        <!-- Coloured left bar -->
        <div :class="['absolute left-0 top-3 bottom-3 w-1 rounded-full', colorMap[notificationState.type].bar]"></div>

        <!-- Icon -->
        <component
          :is="iconMap[notificationState.type]"
          :size="18"
          :class="['shrink-0 mt-0.5', colorMap[notificationState.type].icon]"
        />

        <!-- Message -->
        <span class="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
          {{ notificationState.message }}
        </span>

        <!-- Dismiss -->
        <button
          @click="dismiss"
          class="shrink-0 rounded-full p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Dismiss"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.97);
}
.banner-enter-to,
.banner-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
