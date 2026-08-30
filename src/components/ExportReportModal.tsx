import { useState } from 'react'
import { FileSpreadsheet, Calendar, X, Download, Clock } from 'lucide-react'
import { today, monthStart, yearStart, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'

interface ExportReportModalProps {
  title: string
  description?: string
  defaultDateFrom?: string
  defaultDateTo?: string
  onClose: () => void
  onExport: (dateFrom: string, dateTo: string) => Promise<boolean>
}

export default function ExportReportModal({
  title,
  description = 'اختر الفترة الزمنية المطلوبة لتوليد التقرير متضمناً كافة التفاصيل والإجماليات',
  defaultDateFrom = monthStart(),
  defaultDateTo = today(),
  onClose,
  onExport
}: ExportReportModalProps) {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [loading, setLoading] = useState(false)

  const handleQuickFilter = (type: 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'year') => {
    const now = new Date()
    if (type === 'today') {
      setDateFrom(today())
      setDateTo(today())
    } else if (type === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const yStr = y.toISOString().split('T')[0]
      setDateFrom(yStr)
      setDateTo(yStr)
    } else if (type === 'week') {
      const w = new Date(now)
      w.setDate(w.getDate() - 7)
      setDateFrom(w.toISOString().split('T')[0])
      setDateTo(today())
    } else if (type === 'month') {
      setDateFrom(monthStart())
      setDateTo(today())
    } else if (type === 'last_month') {
      const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      setDateFrom(lmStart.toISOString().split('T')[0])
      setDateTo(lmEnd.toISOString().split('T')[0])
    } else if (type === 'year') {
      setDateFrom(yearStart())
      setDateTo(today())
    }
  }

  const handleConfirm = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('يرجى تحديد تاريخ البداية والنهاية')
      return
    }
    if (dateFrom > dateTo) {
      toast.error('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية')
      return
    }

    setLoading(true)
    const t = toast.loading('جاري تجهيز التقرير وفتح نافذة الحفظ...')
    try {
      const saved = await onExport(dateFrom, dateTo)
      if (saved) {
        toast.success('تم تصدير وحفظ التقرير بنجاح!', { id: t })
        onClose()
      } else {
        toast.dismiss(t)
      }
    } catch (e: any) {
      console.error(e)
      toast.error('فشل استخراج التقرير', { id: t })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content animate-scale-in"
        style={{ width: '92vw', maxWidth: '640px', padding: '24px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--clr-text)]">{title}</h3>
              <p className="text-xs text-[var(--clr-muted)]">{description}</p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Quick Range Selection */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--clr-text-2)] mb-1.5 flex items-center gap-1">
              <Clock size={13} /> فترات سريعة:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFilter('today')}
                className={`badge py-1.5 text-xs font-bold cursor-pointer transition-all ${
                  dateFrom === today() && dateTo === today() ? 'badge-primary' : 'badge-muted'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('yesterday')}
                className="badge badge-muted py-1.5 text-xs font-bold cursor-pointer transition-all hover:badge-primary"
              >
                أمس
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('week')}
                className="badge badge-muted py-1.5 text-xs font-bold cursor-pointer transition-all hover:badge-primary"
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('month')}
                className={`badge py-1.5 text-xs font-bold cursor-pointer transition-all ${
                  dateFrom === monthStart() && dateTo === today() ? 'badge-primary' : 'badge-muted'
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('last_month')}
                className="badge badge-muted py-1.5 text-xs font-bold cursor-pointer transition-all hover:badge-primary"
              >
                الشهر السابق
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('year')}
                className="badge badge-muted py-1.5 text-xs font-bold cursor-pointer transition-all hover:badge-primary"
              >
                هذا العام
              </button>
            </div>
          </div>

          {/* Custom Date Inputs */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--clr-surface-2)] border" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <label className="block text-xs font-bold text-[var(--clr-muted)] mb-1">
                من تاريخ:
              </label>
              <input
                type="date"
                className="input w-full py-1.5 px-2.5 text-xs font-mono font-bold"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--clr-muted)] mb-1">
                إلى تاريخ:
              </label>
              <input
                type="date"
                className="input w-full py-1.5 px-2.5 text-xs font-mono font-bold"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Selected Period Preview */}
          <div className="p-2.5 rounded-lg bg-[var(--clr-surface-3)] text-center text-xs text-[var(--clr-text-2)] font-medium">
            الفترة المحددة: من <span className="font-bold font-mono text-[var(--clr-primary)]">{dateFrom}</span> إلى <span className="font-bold font-mono text-[var(--clr-primary)]">{dateTo}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-2 border-t" style={{ borderColor: 'var(--clr-border)' }}>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="btn-primary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
            >
              <Download size={16} />
              {loading ? 'جاري الاستخراج...' : 'استخراج وتحميل تقرير Excel'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary py-2.5 px-4 text-xs font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
