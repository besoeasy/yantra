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
      sparkline: { enabled: true }
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
                const sum = (props.series || []).reduce((s, n) => s + (Number(n) || 0), 0)
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
  <VueApexCharts type="donut" :height="height" :options="chartOptions" :series="series" />
</template>
