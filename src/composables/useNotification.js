import { ref } from 'vue'

// Module-level reactive state – works both inside and outside Vue components
export const notificationState = ref(null)

let autoCloseTimer = null

export function useNotification() {
  const show = (type, message) => {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer)
      autoCloseTimer = null
    }
    notificationState.value = { type, message }

    // Auto-dismiss success/info after 5 s; errors/warnings stay until closed
    if (type === 'success' || type === 'info') {
      autoCloseTimer = setTimeout(() => {
        notificationState.value = null
        autoCloseTimer = null
      }, 5000)
    }
  }

  const dismiss = () => {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer)
      autoCloseTimer = null
    }
    notificationState.value = null
  }

  return {
    success: (msg) => show('success', msg),
    error:   (msg) => show('error',   msg),
    warning: (msg) => show('warning', msg),
    info:    (msg) => show('info',    msg),
    dismiss,
  }
}
