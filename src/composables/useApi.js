import { ref } from 'vue'
import { useToast } from 'vue-toastification'

// Simple cache with TTL
const cache = new Map()
const pendingRequests = new Map()

export function useApi() {
  const toast = useToast()
  const loading = ref(false)
  const error = ref(null)

  // Clear expired cache entries
  const clearExpiredCache = () => {
    const now = Date.now()
    for (const [key, value] of cache.entries()) {
      if (now > value.expiresAt) {
        cache.delete(key)
      }
    }
  }

  const get = async (url, options = {}) => {
    const { ttl = 30000, skipCache = false, showError = true } = options
    
    clearExpiredCache()
    
    // Check cache
    if (!skipCache && cache.has(url)) {
      const cached = cache.get(url)
      if (Date.now() < cached.expiresAt) {
        return cached.data
      }
    }

    // Deduplicate concurrent requests
    if (pendingRequests.has(url)) {
      return pendingRequests.get(url)
    }

    loading.value = true
    error.value = null

    const request = fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const data = await response.json()
        
        // Cache successful response
        if (!skipCache) {
          cache.set(url, {
            data,
            expiresAt: Date.now() + ttl
          })
        }
        
        return data
      })
      .catch((err) => {
        error.value = err.message
        if (showError) {
          toast.error(`Request failed: ${err.message}`)
        }
        throw err
      })
      .finally(() => {
        loading.value = false
        pendingRequests.delete(url)
      })

    pendingRequests.set(url, request)
    return request
  }

  const post = async (url, body, options = {}) => {
    const { showError = true, timeout = 300000 } = options

    loading.value = true
    error.value = null

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (err) {
      error.value = err.message
      if (showError && err.name !== 'AbortError') {
        toast.error(`Request failed: ${err.message}`)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  const clearCache = (url) => {
    if (url) {
      cache.delete(url)
    } else {
      cache.clear()
    }
  }

  return {
    get,
    post,
    clearCache,
    loading,
    error
  }
}
