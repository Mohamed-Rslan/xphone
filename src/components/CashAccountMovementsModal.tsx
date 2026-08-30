import { useState, useEffect } from 'react'
import { X, Search, Calendar, ArrowUpLeft, ArrowDownRight, RefreshCw, Landmark, Filter } from 'lucide-react'
import { getLedger } from '../lib/commands'
import { formatEGP, formatDate, today, monthStart } from '../lib/utils'

interface CashAccountMovementsModalProps {
  account: {
    id: string
    name_ar: string
    balance: number
  }
  onClose: () => void
}

export default function CashAccountMovementsModal({ account, onClose }: CashAccountMovementsModalProps) {
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [movements, setMovements] = useState<any[]>([])

  const loadMovements = async () => {
    setLoading(true)
    try {
      const allRows = await getLedger(dateFrom, dateTo, 'all')
      // Filter rows belonging to this account name or ID
      const filtered = (allRows || []).filter((r: any) => {
        if (r.financial_account_id && r.financial_account_id === account.id) return true
        if (r.financial_account_name && r.financial_account_name.trim() === account.name_ar.trim()) return true
        // Default drawer match
        if (account.id === 'cash_drawer' && r.financial_account_name.includes('الخزينة الرئيسية')) return true
        return false
      })
      setMovements(filtered)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMovements()
  }, [dateFrom, dateTo])

  const filteredMovements = movements.filter((m: any) => {
    const matchesSearch =
      m.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.tx_type?.toLowerCase().includes(searchTerm.toLowerCase())
    if (typeFilter === 'inflow') return matchesSearch && m.debit > 0
    if (typeFilter === 'outflow') return matchesSearch && m.credit > 0
    return matchesSearch
  })

  const totalInflow = filteredMovements.reduce((acc, m) => acc + (m.debit || 0), 0)
  const totalOutflow = filteredMovements.reduce((acc, m) => acc + (m.credit || 0), 0)
  const netFlow = totalInflow - totalOutflow

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/20">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between bg-black/30" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Landmark size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                كشف حركات الحساب النقدي: <span className="text-amber-400 font-extrabold">{account.name_ar}</span>
              </h2>
              <p className="text-xs text-[var(--clr-muted)]">
                الرصيد المحسوب الحالي: <span className="font-mono font-bold text-emerald-400">{formatEGP(account.balance)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="p-4 bg-[var(--clr-surface-2)] border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/10">
              <Calendar size={14} className="text-amber-400" />
              <span>من:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
              />
              <span>إلى:</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
              />
            </div>

            <div className="relative">
              <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="بحث في البيان أو نوع الحركة..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input text-xs pr-8 py-1.5 w-52"
              />
            </div>

            <div className="flex gap-1 border border-white/10 p-1 rounded-xl bg-black/30">
              <button
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${typeFilter === 'all' ? 'btn-primary' : 'text-gray-400'}`}
                onClick={() => setTypeFilter('all')}
              >
                الكل ({movements.length})
              </button>
              <button
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${typeFilter === 'inflow' ? 'bg-emerald-500 text-white' : 'text-gray-400'}`}
                onClick={() => setTypeFilter('inflow')}
              >
                المقبوضات (وارد)
              </button>
              <button
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${typeFilter === 'outflow' ? 'bg-rose-500 text-white' : 'text-gray-400'}`}
                onClick={() => setTypeFilter('outflow')}
              >
                المدفوعات (صادر)
              </button>
            </div>
          </div>

          <button
            onClick={loadMovements}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 font-bold"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-black/20 border-b" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-400">إجمالي الوارد (المقبوضات)</div>
              <div className="text-sm font-mono font-bold text-emerald-300">{formatEGP(totalInflow)}</div>
            </div>
            <ArrowDownRight size={20} className="text-emerald-400" />
          </div>

          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-rose-400">إجمالي الصادر (المدفوعات)</div>
              <div className="text-sm font-mono font-bold text-rose-300">{formatEGP(totalOutflow)}</div>
            </div>
            <ArrowUpLeft size={20} className="text-rose-400" />
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-400">صافي الحركة للفترة</div>
              <div className={`text-sm font-mono font-bold ${netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatEGP(netFlow)}
              </div>
            </div>
            <Filter size={18} className="text-amber-400" />
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm font-bold">
              جاري جلب واستعراض حركات الحساب...
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Landmark size={32} className="opacity-40" />
              <div className="text-sm font-bold">لا توجد حركات نقدية مسجلة لهذا الحساب خلال الفترة المحددة</div>
            </div>
          ) : (
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>نوع الحركة</th>
                  <th>البيان والتفاصيل</th>
                  <th className="text-left">الوارد (+)</th>
                  <th className="text-left">الصادر (-)</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m: any, idx: number) => {
                  const isInflow = m.debit > 0
                  return (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="font-mono text-[11px] text-gray-400" dir="ltr">
                        {formatDate(m.date)}
                      </td>
                      <td>
                        <span className={`badge font-bold text-[10px] ${isInflow ? 'badge-success' : 'badge-danger'}`}>
                          {m.tx_type}
                        </span>
                      </td>
                      <td className="font-bold text-gray-200">
                        {m.description}
                      </td>
                      <td className="font-mono font-bold text-emerald-400 text-left">
                        {m.debit > 0 ? formatEGP(m.debit) : '—'}
                      </td>
                      <td className="font-mono font-bold text-rose-400 text-left">
                        {m.credit > 0 ? formatEGP(m.credit) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-black/40 flex justify-between items-center text-xs text-gray-400" style={{ borderColor: 'var(--clr-border)' }}>
          <div>عدد الحركات المستعرضة: <span className="font-bold text-white">{filteredMovements.length}</span> حركة</div>
          <button onClick={onClose} className="btn-secondary px-5 py-2 font-bold text-xs">
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  )
}
