import { ref } from 'vue'

const isDark = ref(false)

const updateDOM = () => {
  console.log('updateDOM called, isDark:', isDark.value)
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    console.log('Added dark class')
  } else {
    document.documentElement.classList.remove('dark')
    console.log('Removed dark class')
  }
}

export function useDarkMode() {
  const toggleDarkMode = () => {
    console.log('toggleDarkMode called, before:', isDark.value)
    isDark.value = !isDark.value
    console.log('toggleDarkMode called, after:', isDark.value)
    updateDOM()
    localStorage.setItem('darkMode', isDark.value ? 'dark' : 'light')
  }

  const initDarkMode = () => {
    // Check localStorage first, then fall back to system preference
    const stored = localStorage.getItem('darkMode')
    console.log('initDarkMode - stored:', stored)
    if (stored) {
      isDark.value = stored === 'dark'
    } else {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    console.log('initDarkMode - isDark:', isDark.value)
    updateDOM()
  }

  return {
    isDark,
    toggleDarkMode,
    initDarkMode
  }
}
