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
  },
  theme: {
    type: String,
    default: 'light'
  }
})

const series = computed(() => [{ data: props.data }])

const chartOptions = computed(() => {
  const formatValue = (val) => {
    if (typeof props.valueFormatter === 'function') return props.valueFormatter(val)
    return `${val}`
  }

  const isDark = String(props.theme).toLowerCase() === 'dark'

  return {
    chart: {
      type: 'treemap',
      sparkline: { enabled: true }
    },
    theme: { mode: isDark ? 'dark' : 'light' },
    colors: props.colors,
    legend: { show: false },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '11px',
        fontWeight: 700,
        colors: [isDark ? '#ffffff' : '#111827']
      },
      formatter: (text, opts) => {
        const value = opts?.value
        const safeText = String(text || '').trim()
        if (!safeText) return ''
        return safeText.length > 18 ? `${safeText.slice(0, 18)}…` : safeText
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 0,
        blur: 2,
        opacity: 0.35
      }
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
      theme: isDark ? 'dark' : 'light',
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
