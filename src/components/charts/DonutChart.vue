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
    colors.join(',')
  ].join('::')
})

const chartOptions = computed(() => {
  const formatValue = (val) => {
    if (typeof props.valueFormatter === 'function') return props.valueFormatter(val)
    return `${Math.round(val)}`
  }

  const isDark = String(props.theme).toLowerCase() === 'dark'
  const labelColor = isDark ? '#e5e7eb' : '#0f172a'
  const subLabelColor = isDark ? '#9ca3af' : '#475569'

  return {
    chart: {
      type: 'donut',
      sparkline: { enabled: true },
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 650,
        animateGradually: { enabled: true, delay: 120 },
        dynamicAnimation: { enabled: true, speed: 650 }
      }
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
    states: {
      hover: { filter: { type: 'none' } },
      active: { filter: { type: 'none' } }
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '72%',
          labels: {
            show: true,
            name: {
              show: false
            },
            value: {
              show: true,
              fontSize: '16px',
              fontWeight: 800,
              offsetY: -6,
              color: labelColor,
              formatter: (val) => formatValue(val)
            },
            total: {
              show: true,
              showAlways: true,
              label: props.donutLabel || 'Total',
              fontSize: '11px',
              fontWeight: 700,
              offsetY: 16,
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
  <VueApexCharts type="donut" :height="height" :options="chartOptions" :series="safeSeries" />
</template>

<style scoped>
/* Ensure the chart container never paints its own background */
:deep(.apexcharts-canvas),
:deep(.apexcharts-svg) {
  background: transparent !important;
}
</style>
