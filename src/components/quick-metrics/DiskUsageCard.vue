<script setup>
import ImageDiskUsageCard from './ImageDiskUsageCard.vue'
import VolumeDiskUsageCard from './VolumeDiskUsageCard.vue'

const props = defineProps({
  images: { type: Array, default: () => [] },
  volumes: { type: Array, default: () => [] }
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <ImageDiskUsageCard :images="props.images" />
    <VolumeDiskUsageCard :volumes="props.volumes" />
  </div>
</template>
