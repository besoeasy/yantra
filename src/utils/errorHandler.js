import { useNotification } from '../composables/useNotification'

export function handleFetchError(error, customMessage = null) {
  const toast = useNotification()
  console.error(error)
  toast.error(customMessage || `Request failed: ${error.message}`)
}

export function createFetchErrorHandler(context) {
  return (error) => {
    console.error(`${context}:`, error)
    const toast = useNotification()
    toast.error(`Failed to ${context}: ${error.message}`)
  }
}
