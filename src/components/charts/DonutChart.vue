<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
  series: {
    type: Array,
    default: () => []
  },
  labels: {
    type: Array,
    default: () => []
  },
  height: {
    type: [Number, String],
    default: 190
  },
  colors: {
    type: Array,
    default: () => undefined
  },
  valueFormatter: {
    type: Function,
    default: null
  },
  totalFormatter: {
    type: Function,
    default: null
  },
  donutLabel: {
    type: String,
    default: ''
  },
  theme: {
    type: String,
    default: 'light'
  }
})

const safeSeries = computed(() => {
  const list = Array.isArray(props.series) ? props.series : []
  return list.map((n) => {
    const v = Number(n)
    if (!Number.isFinite(v)) return 0
    return v < 0 ? 0 : v
  })
})

const chartKey = computed(() => {
  const labels = Array.isArray(props.labels) ? props.labels : []
  const colors = Array.isArray(props.colors) ? props.colors : []
  return [
    String(props.theme || ''),
    String(props.donutLabel || ''),
    String(props.height || ''),
    labels.join('|'),
    safeSeries.value.join(','),
    colors.join(',')
  ].join('::')
})

const chartOptions = computed(() => {
  const formatValue = (val) => {
    if (typeof props.valueFormatter === 'function') return props.valueFormatter(val)
    return `${Math.round(val)}`
  }

  const isDark = String(props.theme).toLowerCase() === 'dark'
  const labelColor = isDark ? '#e5e7eb' : '#111827'
  const subLabelColor = isDark ? '#9ca3af' : '#6b7280'

  return {
    chart: {
      type: 'donut',
      sparkline: { enabled: true },
      background: 'transparent'
    },
    theme: { mode: isDark ? 'dark' : 'light' },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val) => formatValue(val)
      }
    },
    labels: props.labels,
    colors: props.colors,
    dataLabels: { enabled: false },
    legend: { show: false },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '12px',
              fontWeight: 700,
              offsetY: 18,
              color: subLabelColor
            },
            value: {
              show: true,
              fontSize: '14px',
              fontWeight: 800,
              offsetY: -2,
              color: labelColor,
              formatter: (val) => formatValue(val)
            },
            total: {
              show: true,
              label: props.donutLabel || 'Total',
              fontSize: '12px',
              fontWeight: 700,
              color: subLabelColor,
              formatter: () => {
                if (typeof props.totalFormatter === 'function') return props.totalFormatter()
                const sum = (safeSeries.value || []).reduce((s, n) => s + (Number(n) || 0), 0)
                return formatValue(sum)
              }
            }
          }
        }
      }
    }
  }
})
</script>

<template>
  <VueApexCharts :key="chartKey" type="donut" :height="height" :options="chartOptions" :series="safeSeries" />
</template>

<style scoped>
/* Ensure the chart container never paints its own background */
:deep(.apexcharts-canvas),
:deep(.apexcharts-svg) {
  background: transparent !important;
}
</style>
