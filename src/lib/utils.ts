import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEGP(amount: number): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount as any) || 0
  return (
    new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num) + ' ج.م'
  )
}

export function formatNumber(n: number): string {
  const num = typeof n === 'number' ? n : parseFloat(n as any) || 0
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    let hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const period = hours >= 12 ? 'م' : 'ص'
    hours = hours % 12 || 12
    const hoursStr = String(hours).padStart(2, '0')
    return `${day}/${month}/${year} ${hoursStr}:${minutes} ${period}`
  } catch {
    return dateStr
  }
}

export function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    let hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const period = hours >= 12 ? 'م' : 'ص'
    hours = hours % 12 || 12
    const hoursStr = String(hours).padStart(2, '0')
    return `${hoursStr}:${minutes} ${period}`
  } catch {
    return dateStr
  }
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function monthStart(): string {
  const d = new Date()
  return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
}

export function yearStart(): string {
  return format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    received: 'تم الاستلام',
    in_progress: 'قيد التنفيذ',
    ready: 'جاهز',
    delivered: 'تم التسليم',
    cancelled: 'ملغي',
    completed: 'مكتمل',
    returned: 'مرتجع',
    draft: 'مسودة',
    ordered: 'تم الطلب',
    partial: 'استلام جزئي',
  }
  return map[status] ?? status
}

export function statusClass(status: string): string {
  const map: Record<string, string> = {
    received: 'badge badge-muted',
    in_progress: 'badge badge-warning',
    ready: 'badge badge-primary',
    delivered: 'badge badge-success',
    cancelled: 'badge badge-danger',
    completed: 'badge badge-success',
    returned: 'badge badge-danger',
    draft: 'badge badge-muted',
    ordered: 'badge badge-warning',
    partial: 'badge badge-warning',
  }
  return map[status] ?? 'badge badge-muted'
}
