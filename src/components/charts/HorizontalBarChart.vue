<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
  values: {
    type: Array,
    default: () => []
  },
  categories: {
    type: Array,
    default: () => []
  },
  height: {
    type: [Number, String],
    default: 165
  },
  colors: {
    type: Array,
    default: () => undefined
  },
  valueFormatter: {
    type: Function,
    default: null
  }
})

const series = computed(() => [{ data: props.values.map((v) => Number(v) || 0) }])

const chartOptions = computed(() => {
  const formatValue = (val) => {
    if (typeof props.valueFormatter === 'function') return props.valueFormatter(val)
    return `${Math.round(val)}`
  }

  return {
    chart: {
      type: 'bar',
      sparkline: { enabled: true }
    },
    colors: props.colors,
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '60%',
        distributed: true,
        borderRadius: 6
      }
    },
    stroke: { width: 0 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: props.categories,
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { show: false }
    },
    grid: {
      show: false,
      padding: { left: 0, right: 0, top: 0, bottom: 0 }
    },
    tooltip: {
      x: { show: true },
      y: {
        formatter: (val) => formatValue(val)
      }
    }
  }
})
</script>

<template>
  <VueApexCharts type="bar" :height="height" :options="chartOptions" :series="series" />
</template>
