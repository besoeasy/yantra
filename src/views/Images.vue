<script setup>
import { ref, onMounted, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { HardDrive, Trash2, Check, AlertTriangle, Box, Database, Layers } from 'lucide-vue-next'
import VueApexCharts from 'vue3-apexcharts'

const toast = useToast()

const imagesData = ref({})
const loading = ref(false)
const deletingImage = ref(null)
const deletingAllImages = ref(false)
const apiUrl = ref('')

// Chart Data Configuration
const treemapOptions = computed(() => ({
  chart: {
    type: 'treemap',
    fontFamily: 'monospace',
    toolbar: { show: false },
    background: 'transparent',
    animations: { enabled: true }
  },
  colors: ['#0ea5e9', '#ef4444', '#10b981', '#f59e0b'],
  states: {
    hover: {
      filter: {
        type: 'darken',
        value: 0.1,
      }
    }
  },
  plotOptions: {
    treemap: {
      distributed: true,
      enableShades: false,
      useFillColorAsStroke: false,
      strokeWidth: 0,
    }
  },
  dataLabels: {
    enabled: true,
    style: {
      fontSize: '10px',
      fontFamily: 'monospace',
      fontWeight: 'bold',
      colors: ['#000000', '#ffffff'] // Dark text? Or light? Depends on background.
    },
    formatter: function(text, op) {
      return [text, op.value + ' MB']
    },
    offsetY: -4
  },
  title: { text: undefined },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'monospace' },
    y: {
      formatter: function(val) {
        return val + " MB"
      }
    }
  },
  stroke: { show: true, width: 2, colors: ['#0c0c0e'] }
}))

// We need a separate reactivity system for chart refreshing to avoid issues
const treemapSeries = computed(() => {
  if (!imagesData.value.usedImages && !imagesData.value.unusedImages) return []
  
  const allImages = []
  
  // Add used images
  if (imagesData.value.usedImages) {
    imagesData.value.usedImages.forEach(img => {
      const sizeVal = parseFloat(img.size)
      // Only show significant items
      if (sizeVal > 1) {
        allImages.push({
          x: img.tags[0] !== '<none>:<none>' ? img.tags[0].split(':')[0] : img.shortId,
          y: sizeVal,
          fillColor: '#10b981'
        })
      }
    })
  }
  
  // Add unused images
  if (imagesData.value.unusedImages) {
    imagesData.value.unusedImages.forEach(img => {
      const sizeVal = parseFloat(img.size)
      if (sizeVal > 1) {
        allImages.push({
          x: img.tags[0] !== '<none>:<none>' ? img.tags[0].split(':')[0] : img.shortId,
          y: sizeVal,
          fillColor: '#ef4444'
        })
      }
    })
  }

  // Sort by size and take top 30
  const sortedData = allImages.sort((a, b) => b.y - a.y).slice(0, 30)
  
  return [{ data: sortedData }]
})

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
  <div class="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-200 font-sans pb-20">
    <!-- Header -->
    <div class="bg-white dark:bg-[#0c0c0e] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
             <div class="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
               <Layers :size="24" class="text-indigo-600 dark:text-indigo-400" />
             </div>
             <div>
                <h1 class="text-2xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">Docker Images</h1>
                <p class="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest">Repository & Storage Management</p>
             </div>
          </div>
          
          <div class="flex items-center gap-3">
             <button @click="fetchImages" class="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                <div :class="{ 'animate-spin': loading }">
                   <database :size="18" />
                </div>
             </button>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden group">
             <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Box :size="48" />
             </div>
             <div class="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Total Images</div>
             <div class="text-2xl font-mono font-bold text-slate-900 dark:text-white">{{ imagesData.total || 0 }}</div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden group">
             <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Check :size="48" />
             </div>
             <div class="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Active / Used</div>
             <div class="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-300">{{ imagesData.used || 0 }}</div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden group">
             <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <AlertTriangle :size="48" />
             </div>
             <div class="text-[10px] uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-1">Dangling / Unused</div>
             <div class="text-2xl font-mono font-bold text-orange-700 dark:text-orange-300">{{ imagesData.unused || 0 }}</div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden group">
             <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <HardDrive :size="48" />
             </div>
             <div class="text-[10px] uppercase tracking-widest text-pink-600 dark:text-pink-400 mb-1">Reclaimable Space</div>
             <div class="text-2xl font-mono font-bold text-pink-700 dark:text-pink-300">{{ imagesData.unusedSize || 0 }} <span class="text-sm font-normal text-slate-500">MB</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      <!-- Visualization -->
      <div v-if="treemapSeries.length > 0" class="bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-slate-800 p-1">
         <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">Storage Distribution (Top 30 Largest)</h3>
         </div>
         <div class="p-4">
            <VueApexCharts :options="treemapOptions" :series="treemapSeries" height="280" />
         </div>
      </div>

      <!-- Unused Images Table -->
      <div v-if="imagesData.unusedImages && imagesData.unusedImages.length > 0" class="space-y-4">
         <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b-2 border-orange-500">
            <div>
               <h3 class="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <AlertTriangle :size="20" class="text-orange-500" />
                  Unused Images
               </h3>
               <p class="text-xs font-mono text-slate-500 mt-1">Candidates for deletion ({{ imagesData.unusedImages.length }} items)</p>
            </div>
            
            <button @click="deleteAllUnusedImages"
              :disabled="deletingAllImages"
              class="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
              <Trash2 :size="14" />
              <span>{{ deletingAllImages ? 'Cleaning...' : 'Purge All Unused' }}</span>
            </button>
         </div>

         <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0c0e]">
            <table class="w-full text-left border-collapse">
               <thead>
                  <tr class="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase text-slate-500 font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                     <th class="p-3 font-mono">ID</th>
                     <th class="p-3 font-mono">Tag / Repository</th>
                     <th class="p-3 font-mono">Size</th>
                     <th class="p-3 font-mono">Created</th>
                     <th class="p-3 text-right font-mono">Action</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50 font-mono text-xs">
                  <tr v-for="image in imagesData.unusedImages" :key="image.id" class="hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors group">
                     <td class="p-3 text-slate-500 truncate max-w-[80px]" :title="image.id">{{ image.shortId }}</td>
                     <td class="p-3 font-bold text-slate-700 dark:text-slate-300 break-all">
                        <span v-for="tag in image.tags" :key="tag" class="block">{{ tag }}</span>
                     </td>
                     <td class="p-3 text-slate-600 dark:text-slate-400">{{ image.size }} MB</td>
                     <td class="p-3 text-slate-500">{{ image.created }}</td>
                     <td class="p-3 text-right">
                        <button @click="deleteImage(image.id, image.tags[0])" 
                           class="bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 border border-slate-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 text-slate-500 dark:text-slate-400 p-1.5 transition-all">
                           <Trash2 :size="14" />
                        </button>
                     </td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>

      <!-- Used Images Table -->
      <div v-if="imagesData.usedImages && imagesData.usedImages.length > 0" class="space-y-4">
         <div class="flex items-center gap-2 pb-2 border-b-2 border-emerald-500">
             <Check :size="20" class="text-emerald-500" />
             <h3 class="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Active Images</h3>
         </div>
         
         <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0c0e]">
            <table class="w-full text-left border-collapse">
               <thead>
                  <tr class="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase text-slate-500 font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                     <th class="p-3 font-mono">ID</th>
                     <th class="p-3 font-mono">Tag / Repository</th>
                     <th class="p-3 font-mono">Size</th>
                     <th class="p-3 font-mono">Created</th>
                     <th class="p-3 text-right font-mono">Status</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50 font-mono text-xs">
                  <tr v-for="image in imagesData.usedImages" :key="image.id" class="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                     <td class="p-3 text-slate-500 truncate max-w-[80px]" :title="image.id">{{ image.shortId }}</td>
                     <td class="p-3 font-bold text-slate-700 dark:text-slate-300 break-all">
                        <span v-for="tag in image.tags" :key="tag" class="block">{{ tag }}</span>
                     </td>
                     <td class="p-3 text-slate-600 dark:text-slate-400">{{ image.size }} MB</td>
                     <td class="p-3 text-slate-500">{{ image.created }}</td>
                     <td class="p-3 text-right">
                        <span class="inline-block px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
                           In Use
                        </span>
                     </td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>

    </div>
  </div>
</template>
