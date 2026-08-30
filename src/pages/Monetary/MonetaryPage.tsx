import { useState, useEffect } from 'react'
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet, DollarSign, Info, FileSpreadsheet, Calendar, Search } from 'lucide-react'
import {
  getMonetaryServiceTypes, createMonetaryTransaction, getMonetaryTransactions,
  getMonetarySummary, getFinancialAccounts
} from '../../lib/commands'
import { formatEGP, formatDateTime, monthStart, today } from '../../lib/utils'
import { exportPeriodMonetaryReport } from '../../lib/excel'
import ExportReportModal from '../../components/ExportReportModal'
import { shareMonetaryReceiptWhatsApp } from '../../lib/whatsapp'
import toast from 'react-hot-toast'

export const TX_TYPES = [
  {
    value: 'cash_in_transfer_out',
    label: 'استقبال نقدية وإرسال رصيد (كاش إن)',
    desc: 'العميل يدفع كاش في الخزينة والمحل يرسل رصيد من المحفظة/البنك',
    icon: ArrowDownLeft,
    color: '#00d4aa',
  },
  {
    value: 'transfer_in_cash_out',
    label: 'استقبال رصيد ودفع نقدية (كاش أوت)',
    desc: 'العميل يحول رصيد للمحفظة/البنك والمحل يسلمه كاش من الخزينة',
    icon: ArrowUpRight,
    color: '#ffab3e',
  },
]

export default function MonetaryPage() {
  const [serviceTypes, setServiceTypes] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedTxTypeFilter, setSelectedTxTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())

  const load = async (from = dateFrom, to = dateTo) => {
    try {
      const [st, txs, sum, accs] = await Promise.all([
        getMonetaryServiceTypes(),
        getMonetaryTransactions({ date_from: from, date_to: to }),
        getMonetarySummary({ date_from: from, date_to: to }),
        getFinancialAccounts(),
      ])
      setServiceTypes(st)
      setTransactions(txs)
      setSummary(sum)
      setFinancialAccounts(accs)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { load() }, [])

  const filteredTransactions = selectedTxTypeFilter === 'all'
    ? transactions
    : transactions.filter(t => t.tx_type === selectedTxTypeFilter)

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      <div className="page-header flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Wallet size={28} style={{ color: 'var(--clr-primary)' }} />
            الخدمات المالية والمحافظ الإلكترونية
          </h1>
          <p className="text-sm" style={{ color: 'var(--clr-muted)' }}>
            إدارة تحويلات الكاش إن والكاش أوت والعمولات المربوطة محاسبياً مع الخزينة والمحافظ
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="btn-secondary flex items-center gap-2 font-bold cursor-pointer text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 shadow-sm"
            title="استخراج تقرير إكسيل بالخدمات المالية والمحافظ لفترة يحددها المستخدم"
          >
            <FileSpreadsheet size={16} />
            استخراج إكسيل خدمات مالية
          </button>
          <button id="add-monetary-btn" className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={18} /> تسجيل معاملة جديدة
          </button>
        </div>
      </div>

      {showExportModal && (
        <ExportReportModal
          title="استخراج تقرير الخدمات المالية والمحافظ لـ Excel"
          description="حدد الفترة الزمنية لتوليد تقرير تفصيلي بمعاملات الكاش إن والكاش أوت والعمولات والأرباح"
          onClose={() => setShowExportModal(false)}
          onExport={exportPeriodMonetaryReport}
        />
      )}

      {/* Date Filter Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--clr-surface-2)] border flex-wrap" style={{ borderColor: 'var(--clr-border)' }}>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--clr-primary)]" />
          <span className="text-xs font-bold text-[var(--clr-text-2)]">تصفية الفترة:</span>
          <span className="text-xs text-[var(--clr-muted)]">من:</span>
          <input
            type="date"
            className="input py-1 px-2.5 text-xs font-mono font-bold"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
          <span className="text-xs text-[var(--clr-muted)]">إلى:</span>
          <input
            type="date"
            className="input py-1 px-2.5 text-xs font-mono font-bold"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
          <button
            type="button"
            onClick={() => load(dateFrom, dateTo)}
            className="btn-primary text-xs px-3 py-1 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Search size={14} /> بحث وتحديث
          </button>
        </div>

        <div className="text-xs text-[var(--clr-muted)]">
          إجمالي المعاملات: <span className="font-bold font-mono text-[var(--clr-text)]">{transactions.length}</span>
        </div>
      </div>

      {/* Summary KPI cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="kpi-card">
            <div className="kpi-label">إجمالي حجم التداول</div>
            <div className="kpi-value">{formatEGP(summary.total_volume)}</div>
            <div className="text-xs text-[var(--clr-muted)] mt-1">{transactions.length} معاملة هذا الشهر</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">إجمالي العمولات والأرباح</div>
            <div className="kpi-value text-[var(--clr-success)]" style={{ fontSize: '1.6rem' }}>
              {formatEGP(summary.total_commission)}
            </div>
            <div className="text-xs text-[var(--clr-success)] mt-1">تُرحّل تلقائياً لقائمة الدخل</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">استقبال نقدية (كاش إن)</div>
            <div className="kpi-value text-emerald-400" style={{ fontSize: '1.4rem' }}>
              {formatEGP(summary.total_cash_in_volume || 0)}
            </div>
            <div className="text-xs text-[var(--clr-muted)] mt-1">نقدية دخلت الخزينة</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">دفع نقدية (كاش أوت)</div>
            <div className="kpi-value text-amber-400" style={{ fontSize: '1.4rem' }}>
              {formatEGP(summary.total_cash_out_volume || 0)}
            </div>
            <div className="text-xs text-[var(--clr-muted)] mt-1">نقدية خرجت من الخزينة</div>
          </div>
        </div>
      )}

      {/* Type Filter Badges */}
      <div className="flex gap-2">
        <button
          className={`badge cursor-pointer px-4 py-2 text-xs font-bold transition-all border-0 ${selectedTxTypeFilter === 'all' ? 'badge-primary' : 'badge-muted'}`}
          onClick={() => setSelectedTxTypeFilter('all')}
        >
          جميع المعاملات ({transactions.length})
        </button>
        <button
          className={`badge cursor-pointer px-4 py-2 text-xs font-bold transition-all border-0 ${selectedTxTypeFilter === 'cash_in_transfer_out' ? 'badge-primary' : 'badge-muted'}`}
          onClick={() => setSelectedTxTypeFilter('cash_in_transfer_out')}
        >
          📥 استقبال نقدية وإرسال رصيد (كاش إن)
        </button>
        <button
          className={`badge cursor-pointer px-4 py-2 text-xs font-bold transition-all border-0 ${selectedTxTypeFilter === 'transfer_in_cash_out' ? 'badge-primary' : 'badge-muted'}`}
          onClick={() => setSelectedTxTypeFilter('transfer_in_cash_out')}
        >
          📤 استقبال رصيد ودفع نقدية (كاش أوت)
        </button>
      </div>

      {/* Transactions table */}
      <div className="glass-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>نوع المعاملة</th>
              <th>الخدمة</th>
              <th>المحفظة / الحساب البنكي</th>
              <th>العميل</th>
              <th>المبلغ المحول</th>
              <th>العمولة والأرباح</th>
              <th>التاريخ والوقت</th>
              <th className="text-center">إيصال WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(t => {
              const isCashIn = t.tx_type === 'cash_in_transfer_out'
              return (
                <tr key={t.id}>
                  <td>
                    <span className={`badge ${isCashIn ? 'badge-success' : 'badge-warning'} flex items-center gap-1.5 w-fit`}>
                      {isCashIn ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                      {isCashIn ? 'استقبال نقدية وإرسال رصيد' : 'استقبال رصيد ودفع نقدية'}
                    </span>
                  </td>
                  <td className="font-bold">{t.service_name}</td>
                  <td>
                    <span className="badge badge-muted font-medium text-xs">
                      {t.financial_account_name || 'محفظة رقمية'}
                    </span>
                  </td>
                  <td>{t.customer_name || 'عميل نقدي'}</td>
                  <td className="font-bold font-mono text-base">{formatEGP(t.amount)}</td>
                  <td className="font-bold font-mono text-[var(--clr-success)] text-base">
                    +{formatEGP(t.commission)}
                  </td>
                  <td className="text-xs font-mono text-[var(--clr-muted)]">{formatDateTime(t.created_at)}</td>
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => shareMonetaryReceiptWhatsApp(t, 'متجر XPhone')}
                      className="badge cursor-pointer py-1 px-2.5 font-bold transition-all duration-200 hover:scale-105 border-0"
                      style={{ background: 'rgba(37,211,102,0.18)', color: '#25d366' }}
                      title="إرسال إيصال المعاملة المالية الموثق عبر WhatsApp للعميل"
                    >
                      إيصال 💬
                    </button>
                  </td>
                </tr>
              )
            })}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-[var(--clr-muted)]">
                  لا توجد معاملات مسجلة ضمن هذا التصنيف
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <NewMonetaryModal
          serviceTypes={serviceTypes}
          financialAccounts={financialAccounts}
          onClose={() => setShowModal(false)}
          onSave={async (data: any) => {
            try {
              await createMonetaryTransaction(data)
              toast.success('تم تسجيل المعاملة وتحديث أرصدة الخزينة والمحفظة والأرباح بنجاح!')
              setShowModal(false)
              load()
            } catch (e: any) {
              toast.error(typeof e === 'string' ? e : 'فشل الحفظ')
            }
          }}
        />
      )}
    </div>
  )
}

function NewMonetaryModal({ serviceTypes, financialAccounts, onClose, onSave }: any) {
  // Filter digital accounts (all except cash drawer if multiple exist)
  const digitalAccounts = financialAccounts.filter((a: any) => a.id !== 'cash_drawer')
  const defaultDigitalAccId = digitalAccounts[0]?.id || 'cash_drawer'

  const [form, setForm] = useState({
    service_type_id: serviceTypes[0]?.id ?? 1,
    tx_type: 'cash_in_transfer_out',
    customer_name: '',
    amount: '',
    notes: '',
    financial_account_id: defaultDigitalAccId,
  })
  const [customCommission, setCustomCommission] = useState<string>('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const isCashIn = form.tx_type === 'cash_in_transfer_out'
  const expectedDirection = isCashIn ? 'cash_in' : 'cash_out'

  // Filter services by direction
  const filteredServices = serviceTypes.filter((s: any) => {
    if (!s.direction || s.direction === 'both') return true
    return s.direction === expectedDirection
  })

  // Auto update selected service when tx_type or filtered list changes
  useEffect(() => {
    if (filteredServices.length > 0) {
      const exists = filteredServices.some((s: any) => s.id === Number(form.service_type_id))
      if (!exists) {
        set('service_type_id', filteredServices[0].id)
      }
    }
  }, [form.tx_type, serviceTypes])

  const selectedType = serviceTypes.find((s: any) => s.id === Number(form.service_type_id)) || filteredServices[0]
  const numAmount = parseFloat(form.amount) || 0

  const calculatedCommission = selectedType
    ? (selectedType.commission_type === 'percentage'
      ? (numAmount * selectedType.commission_rate / 100)
      : selectedType.commission_rate)
    : 0

  useEffect(() => {
    setCustomCommission('')
  }, [form.service_type_id])

  const activeCommission = customCommission !== '' ? (parseFloat(customCommission) || 0) : calculatedCommission
  const selectedDigitalAcc = financialAccounts.find((a: any) => a.id === form.financial_account_id)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!numAmount || numAmount <= 0) return toast.error('يرجى كتابة مبلغ صحيح')

    onSave({
      service_type_id: Number(form.service_type_id),
      tx_type: form.tx_type,
      customer_name: form.customer_name || undefined,
      amount: numAmount,
      custom_commission: activeCommission,
      financial_account_id: form.financial_account_id,
      notes: form.notes || undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-xl">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
            <Wallet size={22} />
            تسجيل معاملة خدمات مالية
          </h3>
          <button className="btn-icon text-sm font-bold" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Transaction Type Choice */}
          <div>
            <label className="label">نوع المعاملة المالية *</label>
            <div className="grid grid-cols-2 gap-3">
              {TX_TYPES.map(t => {
                const isSelected = form.tx_type === t.value
                const Icon = t.icon
                return (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => set('tx_type', t.value)}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--clr-primary)]/15 border-[var(--clr-primary)] shadow-lg'
                        : 'bg-[var(--clr-surface-2)] border-[var(--clr-border)] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm" style={{ color: isSelected ? 'var(--clr-primary)' : 'inherit' }}>
                      <Icon size={18} />
                      {t.label}
                    </div>
                    <span className="text-[11px] text-[var(--clr-muted)]">{t.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">نوع الخدمة (المزود) *</label>
              <select className="input w-full" value={form.service_type_id} onChange={e => set('service_type_id', Number(e.target.value))}>
                {filteredServices.map((s: any) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
              </select>
            </div>

            <div>
              <label className="label">المحفظة / الحساب البنكي المستخدم *</label>
              <select className="input w-full" value={form.financial_account_id} onChange={e => set('financial_account_id', e.target.value)}>
                {financialAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name_ar} (الرصيد: {formatEGP(a.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">المبلغ المطلوب تحويله (ج.م) *</label>
              <input
                type="number"
                step="any"
                className="input w-full font-bold font-mono text-base"
                placeholder="0.00"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">
                العمولة والأرباح المحصلة (ج.م) *
                <span className="text-[11px] text-[var(--clr-muted)] mr-1">
                  (محسوبة تلقائياً: {formatEGP(calculatedCommission)})
                </span>
              </label>
              <input
                type="number"
                step="any"
                className="input w-full font-bold font-mono text-base text-[var(--clr-success)]"
                placeholder={calculatedCommission.toString()}
                value={customCommission !== '' ? customCommission : (numAmount ? calculatedCommission.toString() : '')}
                onChange={e => setCustomCommission(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">اسم أو رقم هاتف العميل (اختياري)</label>
            <input className="input w-full" placeholder="مثال: 01012345678 - أحمد" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
          </div>

          {/* Real-time Double-entry accounting explanation banner */}
          <div className="p-3.5 rounded-xl border bg-gradient-to-r from-blue-500/10 to-purple-500/10 flex flex-col gap-2" style={{ borderColor: 'rgba(124, 107, 255, 0.3)' }}>
            <div className="flex items-center gap-2 font-bold text-xs" style={{ color: 'var(--clr-primary)' }}>
              <Info size={16} />
              الأثر المالي والمحاسبي للمعاملة:
            </div>
            {isCashIn ? (
              <div className="text-xs space-y-1 text-gray-200">
                <div>• 📥 <strong>الخزينة الرئيسية:</strong> يدخل إليها نقداً <span className="text-emerald-400 font-bold font-mono">{formatEGP(numAmount + activeCommission)}</span> (المبلغ + العمولة).</div>
                <div>• 📤 <strong>{selectedDigitalAcc?.name_ar || 'المحفظة'}:</strong> يُخصم منها رصيد <span className="text-red-400 font-bold font-mono">{formatEGP(numAmount)}</span> (المبلغ المحول).</div>
                <div>• 📈 <strong>قائمة الدخل:</strong> يُسجل إيراد عمولات أرباح <span className="text-emerald-400 font-bold font-mono">+{formatEGP(activeCommission)}</span>.</div>
              </div>
            ) : (
              <div className="text-xs space-y-1 text-gray-200">
                <div>• 📥 <strong>{selectedDigitalAcc?.name_ar || 'المحفظة'}:</strong> تستقبل رصيداً <span className="text-emerald-400 font-bold font-mono">{formatEGP(numAmount + activeCommission)}</span> (المبلغ + العمولة).</div>
                <div>• 📤 <strong>الخزينة الرئيسية:</strong> يُصرف منها نقداً للعميل <span className="text-red-400 font-bold font-mono">{formatEGP(numAmount)}</span>.</div>
                <div>• 📈 <strong>قائمة الدخل:</strong> يُسجل إيراد عمولات أرباح <span className="text-emerald-400 font-bold font-mono">+{formatEGP(activeCommission)}</span>.</div>
              </div>
            )}
          </div>

          <div>
            <label className="label">ملاحظات إضافية</label>
            <input className="input w-full" placeholder="ملاحظات اختيارية..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn-primary font-bold">
              تأكيد وتسجيل المعاملة
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
