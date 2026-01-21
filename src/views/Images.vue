<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { HardDrive, Trash2, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-vue-next'

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
    <div class="mb-6 md:mb-8">
      <div class="flex items-center gap-3 mb-2">
        <HardDrive class="w-8 h-8 text-blue-600" />
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Docker Images</h2>
      </div>
      <p class="text-sm sm:text-base text-gray-600 dark:text-slate-400">Manage your Docker images and free up disk space</p>
    </div>
    
    <div v-if="loading" class="text-center py-16">
      <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent dark:border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <div class="text-gray-500 dark:text-slate-400 font-medium">Loading images...</div>
    </div>
    <div v-else>
      <!-- Summary Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-8 md:mb-10">
        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/15 dark:to-indigo-500/10 rounded-2xl p-5 sm:p-6 smooth-shadow border border-blue-100 dark:border-blue-500/20 transition-all hover:shadow-lg hover:-translate-y-0.5">
          <div class="flex items-center gap-2 mb-3">
            <ImageIcon class="w-4 h-4 text-blue-600 dark:text-blue-300" />
            <div class="text-blue-700 dark:text-blue-200 text-xs font-bold uppercase tracking-wider">Total</div>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-blue-900 dark:text-white">{{ imagesData.total || 0 }}</div>
        </div>
        <div class="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-500/15 dark:to-green-500/10 rounded-2xl p-5 sm:p-6 smooth-shadow border border-green-100 dark:border-emerald-500/20 transition-all hover:shadow-lg hover:-translate-y-0.5">
          <div class="flex items-center gap-2 mb-3">
            <CheckCircle2 class="w-4 h-4 text-green-600 dark:text-emerald-300" />
            <div class="text-green-700 dark:text-emerald-200 text-xs font-bold uppercase tracking-wider">In Use</div>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-green-900 dark:text-white">{{ imagesData.used || 0 }}</div>
        </div>
        <div class="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/15 dark:to-amber-500/10 rounded-2xl p-5 sm:p-6 smooth-shadow border border-orange-100 dark:border-orange-500/20 transition-all hover:shadow-lg hover:-translate-y-0.5">
          <div class="flex items-center gap-2 mb-3">
            <AlertCircle class="w-4 h-4 text-orange-600 dark:text-orange-300" />
            <div class="text-orange-700 dark:text-orange-200 text-xs font-bold uppercase tracking-wider">Unused</div>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-orange-900 dark:text-white">{{ imagesData.unused || 0 }}</div>
        </div>
        <div class="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-500/15 dark:to-rose-500/10 rounded-2xl p-5 sm:p-6 smooth-shadow border border-red-100 dark:border-red-500/20 transition-all hover:shadow-lg hover:-translate-y-0.5">
          <div class="flex items-center gap-2 mb-3">
            <HardDrive class="w-4 h-4 text-red-600 dark:text-red-300" />
            <div class="text-red-700 dark:text-red-200 text-xs font-bold uppercase tracking-wider">Space</div>
          </div>
          <div class="text-2xl sm:text-3xl font-bold text-red-900 dark:text-white">{{ imagesData.unusedSize || 0 }} <span class="text-base sm:text-lg font-semibold">MB</span></div>
        </div>
      </div>

      <!-- Unused Images Section -->
      <div v-if="imagesData.unusedImages && imagesData.unusedImages.length > 0" class="mb-8 md:mb-10">
        <div class="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-500/15 dark:to-red-500/10 rounded-2xl p-4 sm:p-5 mb-5 border border-orange-200 dark:border-orange-500/30">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2.5 mb-1">
                <AlertCircle class="w-5 h-5 text-orange-600 dark:text-orange-300" />
                <h3 class="text-lg sm:text-xl font-bold text-orange-900 dark:text-orange-100">Unused Images</h3>
              </div>
              <p class="text-xs sm:text-sm text-orange-700 dark:text-orange-200">These images are not used by any containers and can be safely deleted</p>
            </div>
            <button @click="deleteAllUnusedImages"
              :disabled="deletingAllImages"
              class="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all smooth-shadow active:scale-95 touch-manipulation flex items-center justify-center gap-2 whitespace-nowrap">
              <Trash2 class="w-4 h-4" />
              <span>{{ deletingAllImages ? 'Deleting...' : 'Delete All' }}</span>
            </button>
          </div>
        </div>
        <div class="space-y-3">
          <div v-for="image in imagesData.unusedImages" :key="image.id"
            class="bg-white dark:bg-slate-900/70 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-400 transition-all smooth-shadow hover:shadow-lg">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex-1 w-full sm:w-auto">
                <div class="flex items-center gap-3 mb-2">
                  <div class="p-2 bg-orange-100 dark:bg-orange-500/15 rounded-lg">
                    <ImageIcon class="w-5 h-5 text-orange-600 dark:text-orange-300" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-gray-900 dark:text-white text-sm sm:text-base break-all">{{ image.tags.join(', ') }}</div>
                    <div class="text-xs text-gray-500 dark:text-slate-400 font-mono mt-0.5">{{ image.shortId }}</div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div class="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg">
                  <div class="text-xs text-gray-500 dark:text-slate-400 font-semibold mb-0.5">Size</div>
                  <div class="font-bold text-gray-900 dark:text-white text-sm">{{ image.size }} MB</div>
                </div>
                <button @click="deleteImage(image.id, image.tags[0])"
                  :disabled="deletingImage === image.id"
                  class="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all smooth-shadow active:scale-95 touch-manipulation flex items-center gap-2 whitespace-nowrap"
                  title="Delete this image">
                  <Trash2 class="w-4 h-4" />
                  <span>{{ deletingImage === image.id ? 'Deleting...' : 'Delete' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Used Images Section -->
      <div v-if="imagesData.usedImages && imagesData.usedImages.length > 0">
        <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-emerald-500/15 dark:to-green-500/10 rounded-2xl p-4 sm:p-5 mb-5 border border-green-200 dark:border-emerald-500/30">
          <div class="flex items-center gap-2.5">
            <CheckCircle2 class="w-5 h-5 text-green-600 dark:text-emerald-300" />
            <h3 class="text-lg sm:text-xl font-bold text-green-900 dark:text-emerald-100">Images in Use</h3>
          </div>
          <p class="text-xs sm:text-sm text-green-700 dark:text-emerald-200 mt-1 ml-7">These images are actively used by running containers</p>
        </div>
        <div class="space-y-3">
          <div v-for="image in imagesData.usedImages" :key="image.id"
            class="bg-white dark:bg-slate-900/70 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-slate-800 hover:border-green-300 dark:hover:border-emerald-400 transition-all smooth-shadow hover:shadow-lg">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex-1 w-full sm:w-auto">
                <div class="flex items-center gap-3 mb-2">
                  <div class="p-2 bg-green-100 dark:bg-emerald-500/15 rounded-lg">
                    <ImageIcon class="w-5 h-5 text-green-600 dark:text-emerald-300" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-gray-900 dark:text-white text-sm sm:text-base break-all">{{ image.tags.join(', ') }}</div>
                    <div class="text-xs text-gray-500 dark:text-slate-400 font-mono mt-0.5">{{ image.shortId }}</div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div class="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg">
                  <div class="text-xs text-gray-500 dark:text-slate-400 font-semibold mb-0.5">Size</div>
                  <div class="font-bold text-gray-900 dark:text-white text-sm">{{ image.size }} MB</div>
                </div>
                <div class="px-4 py-2.5 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-emerald-500/20 dark:to-green-500/10 border border-green-200 dark:border-emerald-500/30 text-green-700 dark:text-emerald-200 rounded-xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap">
                  <CheckCircle2 class="w-4 h-4" />
                  <span>In Use</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!imagesData.unusedImages || (imagesData.unusedImages.length === 0 && imagesData.usedImages.length === 0)"
        class="text-center py-16 sm:py-20">
        <div class="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ImageIcon class="w-8 h-8 text-gray-400 dark:text-slate-500" />
        </div>
        <div class="text-gray-900 dark:text-white font-bold text-xl mb-2">No Images Found</div>
        <div class="text-gray-500 dark:text-slate-400 text-sm">Docker images will appear here once you install apps</div>
      </div>
    </div>
  </div>
</template>
