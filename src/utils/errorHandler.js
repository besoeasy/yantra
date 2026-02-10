import { useToast } from 'vue-toastification'

export function handleFetchError(error, customMessage = null) {
  const toast = useToast()
  console.error(error)
  toast.error(customMessage || `Request failed: ${error.message}`)
}

export function createFetchErrorHandler(context) {
  return (error) => {
    console.error(`${context}:`, error)
    const toast = useToast()
    toast.error(`Failed to ${context}: ${error.message}`)
  }
}
