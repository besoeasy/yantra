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
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="-translate-y-full"
    leave-active-class="transition-transform duration-300 ease-in"
    leave-to-class="-translate-y-full"
  >
    <div
      v-if="notificationState"
      :class="[
        'fixed top-0 left-0 right-0 md:left-20 z-9999',
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
