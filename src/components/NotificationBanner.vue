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

const bgMap = {
  success: 'bg-emerald-600 dark:bg-emerald-700',
  error:   'bg-red-600 dark:bg-red-700',
  warning: 'bg-amber-500 dark:bg-amber-600',
  info:    'bg-blue-600 dark:bg-blue-700',
}
</script>

<template>
  <Transition name="banner">
    <div
      v-if="notificationState"
      :class="[
        'sticky top-0 w-full md:pl-20 z-50',
        'flex items-center justify-between px-4 py-3 text-white shadow-lg',
        bgMap[notificationState.type]
      ]"
    >
      <div class="flex items-center gap-3 min-w-0">
        <component :is="iconMap[notificationState.type]" :size="18" class="shrink-0" />
        <span class="text-sm font-medium truncate">{{ notificationState.message }}</span>
      </div>
      <button
        @click="dismiss"
        class="ml-4 shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <X :size="16" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active,
.banner-leave-active {
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.3s ease;
}
.banner-enter-from,
.banner-leave-to {
  max-height: 0;
  opacity: 0;
}
.banner-enter-to,
.banner-leave-from {
  max-height: 80px;
  opacity: 1;
}
</style>
