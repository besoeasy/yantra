export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(value) / Math.log(k))
  return `${(value / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function formatDuration(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value)) return 'N/A'
  if (value <= 0) return 'Expired'

  const totalMinutes = Math.floor(value / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatMinutesAsDuration(minutes) {
  const value = Number(minutes)
  if (!Number.isFinite(value)) return 'N/A'
  return formatDuration(value * 60000)
}
