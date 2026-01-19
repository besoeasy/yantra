<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  height: {
    type: [Number, String],
    default: 210
  },
  colors: {
    type: Array,
    default: () => ['#22c55e', '#10b981', '#0ea5e9', '#6366f1', '#a855f7', '#f59e0b', '#ef4444', '#94a3b8']
  },
  valueFormatter: {
    type: Function,
    default: null
  }
})

const series = computed(() => [{ data: props.data }])

const chartOptions = computed(() => {
  const formatValue = (val) => {
    if (typeof props.valueFormatter === 'function') return props.valueFormatter(val)
    return `${val}`
  }

  return {
    chart: {
      type: 'treemap',
      sparkline: { enabled: true }
    },
    colors: props.colors,
    legend: { show: false },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '11px',
        fontWeight: 700
      },
      formatter: (text, opts) => {
        const value = opts?.value
        const safeText = String(text || '').trim()
        if (!safeText) return ''
        return safeText.length > 18 ? `${safeText.slice(0, 18)}…` : safeText
      },
      dropShadow: { enabled: false }
    },
    plotOptions: {
      treemap: {
        distributed: true,
        enableShades: true,
        shadeIntensity: 0.35,
        reverseNegativeShade: true
      }
    },
    tooltip: {
      y: {
        formatter: (val) => formatValue(val)
      }
    }
  }
})
</script>

<template>
  <VueApexCharts type="treemap" :height="height" :options="chartOptions" :series="series" />
</template>
