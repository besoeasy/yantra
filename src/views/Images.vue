<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

const imagesData = ref({})
const loading = ref(false)
const deletingImage = ref(null)
const deletingAllImages = ref(false)
const apiUrl = ref('')

async function fetchImages() {
  loading.value = true
  try {
    const response = await fetch(`${apiUrl.value}/api/images`)
    const data = await response.json()
    if (data.success) {
      imagesData.value = data
    }
  } catch (error) {
    console.error('Failed to fetch images:', error)
  } finally {
    loading.value = false
  }
}

async function deleteImage(imageId, imageName) {
  if (!confirm(`Delete image ${imageName}?\n\nThis will permanently remove the image from your system.`)) return

  deletingImage.value = imageId
  try {
    const response = await fetch(`${apiUrl.value}/api/images/${imageId}`, {
      method: 'DELETE'
    })
    const data = await response.json()

    if (data.success) {
      toast.success(`Image deleted successfully!`)
      await fetchImages()
    } else {
      toast.error(`Deletion failed: ${data.error}\n${data.message}`)
    }
  } catch (error) {
    toast.error(`Deletion failed: ${error.message}`)
  } finally {
    deletingImage.value = null
  }
}

async function deleteAllUnusedImages() {
  const count = imagesData.value.unusedImages?.length || 0
  if (!count) return
  
  if (!confirm(`Delete all ${count} unused images?\n\nThis will free up ${imagesData.value.unusedSize} MB of disk space.\n\nThis action cannot be undone.`)) return

  deletingAllImages.value = true
  let deleted = 0
  let failed = 0

  try {
    for (const image of imagesData.value.unusedImages) {
      try {
        const response = await fetch(`${apiUrl.value}/api/images/${image.id}`, {
          method: 'DELETE'
        })
        const data = await response.json()
        
        if (data.success) {
          deleted++
        } else {
          failed++
        }
      } catch (error) {
        failed++
      }
    }

    if (deleted > 0) {
      toast.success(`Successfully deleted ${deleted} unused image${deleted > 1 ? 's' : ''}!${failed > 0 ? `\n${failed} failed.` : ''}`)
      await fetchImages()
    } else {
      toast.error(`Failed to delete images`)
    }
  } catch (error) {
    toast.error(`Deletion failed: ${error.message}`)
  } finally {
    deletingAllImages.value = false
  }
}

onMounted(() => {
  fetchImages()
})
</script>

<template>
  <div class="p-4 sm:p-6 md:p-10 lg:p-12">
    <h2 class="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:mb-12 text-gray-900 tracking-tight">Images</h2>
    
    <div v-if="loading" class="text-center py-16">
      <div class="text-gray-500 font-medium">Loading images...</div>
    </div>
    <div v-else>
      <!-- Summary Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-12">
        <div class="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 smooth-shadow border border-gray-200">
          <div class="text-gray-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-1 sm:mb-2">Total Images</div>
          <div class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">{{ imagesData.total || 0 }}</div>
        </div>
        <div class="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 smooth-shadow border border-gray-200">
          <div class="text-gray-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-1 sm:mb-2">Used Images</div>
          <div class="text-2xl sm:text-3xl font-bold text-green-600">{{ imagesData.used || 0 }}</div>
        </div>
        <div class="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 smooth-shadow">
          <div class="text-gray-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-1 sm:mb-2">Unused Images</div>
          <div class="text-2xl sm:text-3xl font-bold text-orange-600">{{ imagesData.unused || 0 }}</div>
        </div>
        <div class="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 smooth-shadow">
          <div class="text-gray-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-1 sm:mb-2">Unused Space</div>
          <div class="text-xl sm:text-2xl md:text-3xl font-bold text-red-600">{{ imagesData.unusedSize || 0 }} <span class="text-sm sm:text-base md:text-lg">MB</span></div>
        </div>
      </div>

      <!-- Unused Images Section -->
      <div v-if="imagesData.unusedImages && imagesData.unusedImages.length > 0" class="mb-6 md:mb-8">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 class="text-lg sm:text-xl font-bold text-orange-600 flex items-center gap-2">
            <span>🗑️</span>
            <span>Unused Images</span>
          </h3>
          <button @click="deleteAllUnusedImages"
            :disabled="deletingAllImages"
            class="w-full sm:w-auto px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all smooth-shadow active:scale-95 touch-manipulation">
            {{ deletingAllImages ? 'Deleting All...' : '🗑️ Delete All Unused' }}
          </button>
        </div>
        <div class="space-y-3">
          <div v-for="image in imagesData.unusedImages" :key="image.id"
            class="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 card-hover smooth-shadow">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex-1 w-full sm:w-auto">
                <div class="flex items-center gap-2.5 sm:gap-3 mb-2">
                  <span class="text-xl sm:text-2xl">🖼️</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-gray-900 text-sm sm:text-base break-all">{{ image.tags.join(', ') }}</div>
                    <div class="text-xs sm:text-sm text-gray-500 font-mono">{{ image.shortId }}</div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div class="text-left sm:text-right flex-1 sm:flex-initial">
                  <div class="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide">Size</div>
                  <div class="font-bold text-gray-900 text-sm sm:text-base">{{ image.size }} MB</div>
                </div>
                <button @click="deleteImage(image.id, image.tags[0])"
                  :disabled="deletingImage === image.id"
                  class="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-semibold transition-all smooth-shadow active:scale-95 touch-manipulation whitespace-nowrap"
                  title="Delete this image">
                  {{ deletingImage === image.id ? 'Deleting...' : '🗑️ Delete' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Used Images Section -->
      <div v-if="imagesData.usedImages && imagesData.usedImages.length > 0">
        <h3 class="text-lg sm:text-xl font-bold mb-4 text-green-600 flex items-center gap-2">
          <span>✅</span>
          <span>Images in Use</span>
        </h3>
        <div class="space-y-3">
          <div v-for="image in imagesData.usedImages" :key="image.id"
            class="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 smooth-shadow">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex-1 w-full sm:w-auto">
                <div class="flex items-center gap-2.5 sm:gap-3 mb-2">
                  <span class="text-xl sm:text-2xl">🖼️</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-gray-900 text-sm sm:text-base break-all">{{ image.tags.join(', ') }}</div>
                    <div class="text-xs sm:text-sm text-gray-500 font-mono">{{ image.shortId }}</div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div class="text-left sm:text-right flex-1 sm:flex-initial">
                  <div class="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide">Size</div>
                  <div class="font-bold text-gray-900 text-sm sm:text-base">{{ image.size }} MB</div>
                </div>
                <div class="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap">
                  In Use
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!imagesData.unusedImages || (imagesData.unusedImages.length === 0 && imagesData.usedImages.length === 0)"
        class="text-center py-16">
        <div class="text-5xl mb-4">🖼️</div>
        <div class="text-gray-500 font-medium">No images found</div>
      </div>
    </div>
  </div>
</template>
