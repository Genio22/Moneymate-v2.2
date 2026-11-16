import { format, parseISO, isValid } from 'date-fns'

export function formatDate(value) {
  if (!value) return '—'
  try {
    const d = typeof value === 'string' ? parseISO(value) : value
    return isValid(d) ? format(d, 'dd MMM yyyy') : '—'
  } catch {
    return '—'
  }
}

export function formatDateTime(value) {
  if (!value) return '—'
  try {
    const d = typeof value === 'string' ? parseISO(value) : value
    return isValid(d) ? format(d, 'dd MMM yyyy, h:mm a') : '—'
  } catch {
    return '—'
  }
}

export function timeAgo(value) {
  if (!value) return ''
  const d = typeof value === 'string' ? parseISO(value) : value
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(value)
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function titleCase(s = '') {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Download an array of objects as CSV (with BOM for Excel). */
export function downloadCsv(filename, rows) {
  if (!rows || !rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
