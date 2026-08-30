import { useState, useEffect } from 'react'
import { Plus, Search, ChevronLeft, ChevronRight, FileSpreadsheet, Calendar, Wrench } from 'lucide-react'
import { getRepairJobs, createRepairJob, updateRepairStatus, getBrands, getCustomers, getFinancialAccounts } from '../../lib/commands'
import { formatEGP, formatDate, statusLabel, statusClass, monthStart, today } from '../../lib/utils'
import { exportPeriodRepairsReport } from '../../lib/excel'
import ExportReportModal from '../../components/ExportReportModal'
import toast from 'react-hot-toast'
import QuickAddCustomerModal from '../../components/QuickAddCustomerModal'
import { shareRepairTicketWhatsApp } from '../../lib/whatsapp'

const STATUSES = ['received', 'in_progress', 'ready', 'delivered', 'cancelled']

export default function RepairsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false)
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())

  const load = async (from = dateFrom, to = dateTo) => {
    const [j, c, b, accs] = await Promise.all([
      getRepairJobs({
        status: statusFilter || undefined,
        search: search || undefined,
        date_from: from || undefined,
        date_to: to || undefined
      }),
      getCustomers(), getBrands(), getFinancialAccounts()
    ])
    setJobs(j); setCustomers(c); setBrands(b); setFinancialAccounts(accs)
  }

  useEffect(() => { load().catch(console.error) }, [statusFilter, search])

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <div className="page-header flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Wrench size={28} style={{ color: 'var(--clr-primary)' }} />
            خدمات وعمليات الصيانة
          </h1>
          <p className="text-sm" style={{ color: 'var(--clr-muted)' }}>
            متابعة تذاكر الإصلاح، قطع الغيار، ومصنعيات الصيانة المربوطة محاسبياً
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="btn-secondary flex items-center gap-2 font-bold cursor-pointer text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 shadow-sm"
            title="استخراج تقرير إكسيل بعمليات وتذاكر الصيانة لفترة يحددها المستخدم"
          >
            <FileSpreadsheet size={16} />
            استخراج إكسيل صيانة
          </button>
          <button id="add-repair-btn" className="btn-primary" onClick={() => { setSelected(null); setShowModal(true) }}>
            <Plus size={16} /> طلب صيانة جديد
          </button>
        </div>
      </div>

      {showExportModal && (
        <ExportReportModal
          title="استخراج تقرير عمليات الصيانة لـ Excel"
          description="حدد الفترة الزمنية لتوليد تقرير تفصيلي بتذاكر الصيانة، قطع الغيار، المصنعيات، وصافي الأرباح"
          onClose={() => setShowExportModal(false)}
          onExport={exportPeriodRepairsReport}
        />
      )}

      {/* Date Filter & Search Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--clr-surface-2)] border flex-wrap" style={{ borderColor: 'var(--clr-border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
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
          إجمالي الأجهزة: <span className="font-bold font-mono text-[var(--clr-text)]">{jobs.length}</span>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        <button className={`badge cursor-pointer px-3 py-1.5 ${!statusFilter ? 'badge-primary' : 'badge-muted'}`}
          onClick={() => setStatusFilter('')}>الكل</button>
        {STATUSES.map(s => (
          <button key={s} className={`badge cursor-pointer px-3 py-1.5 ${statusFilter === s ? 'badge-primary' : 'badge-muted'}`}
            onClick={() => setStatusFilter(s)}>{statusLabel(s)}</button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4" style={{ color: 'var(--clr-muted)' }} />
        <input className="input" style={{ paddingRight: 44 }} placeholder="بحث بالعميل أو رقم الطلب أو الجهاز..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="data-table">
          <thead><tr>
            <th>رقم الطلب</th><th>العميل</th><th>الجهاز</th><th>العطل</th>
            <th>الإجمالي</th><th>الحالة</th><th>تاريخ الاستلام</th><th>إجراءات</th>
          </tr></thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id}>
                <td><span className="font-mono text-sm" style={{ color: 'var(--clr-primary)' }}>{j.job_no}</span></td>
                <td><div>{j.customer_name}</div><div className="text-xs" style={{ color: 'var(--clr-muted)' }}>{j.customer_phone}</div></td>
                <td>
                  <span dir="ltr">{j.device_brand_name}</span>
                  {j.device_brand_name && ' '}{j.device_model}
                </td>
                <td><div className="max-w-[160px] truncate text-sm">{j.fault_desc}</div></td>
                <td style={{ color: 'var(--clr-primary)', fontWeight: 'bold' }}>{formatEGP(j.total_cost)}</td>
                <td><span className={statusClass(j.status)}>{statusLabel(j.status)}</span></td>
                <td className="text-sm">{formatDate(j.received_at)}</td>
                <td className="flex gap-1">
                  <button className="btn-secondary text-xs px-2 py-1" onClick={() => setSelected(j)}>تفاصيل</button>
                  <button
                    type="button"
                    className="btn-secondary text-xs px-2 py-1 font-bold cursor-pointer"
                    style={{ background: 'rgba(37,211,102,0.18)', color: '#25d366', border: '1px solid rgba(37,211,102,0.3)' }}
                    onClick={() => shareRepairTicketWhatsApp(j, 'متجر XPhone', j.customer_phone)}
                    title="إرسال كارت/تحديث حالة الصيانة عبر WhatsApp للعميل"
                  >
                    💬
                  </button>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--clr-muted)' }}>لا توجد طلبات صيانة</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <NewRepairModal 
          customers={customers} 
          brands={brands} 
          onClose={() => setShowModal(false)}
          onAddCustomerClick={() => setShowQuickCustomerModal(true)}
          onNewCustomerAdded={(newCust: any) => setCustomers(prev => [...prev, newCust])}
          onSave={async (data: any) => {
            try {
              await createRepairJob(data)
              toast.success('تم إنشاء طلب الصيانة')
              setShowModal(false); load()
            } catch (e: any) { toast.error(typeof e === 'string' ? e : 'فشل الحفظ') }
          }} 
        />
      )}

      {selected && (
        <RepairDetailModal job={selected} financialAccounts={financialAccounts} onClose={() => { setSelected(null); load() }} />
      )}

      {showQuickCustomerModal && (
        <QuickAddCustomerModal
          onClose={() => setShowQuickCustomerModal(false)}
          onSuccess={(newCust) => {
            setCustomers(prev => [...prev, newCust])
          }}
        />
      )}
    </div>
  )
}

function NewRepairModal({ customers, brands, onClose, onSave, onNewCustomerAdded }: any) {
  const [form, setForm] = useState({
    customer_id: '', device_brand_id: null as number | null,
    device_model: '', device_color: '', device_condition: '',
    fault_desc: '', labor_cost: 0, user_id: null as string | null,
  })
  const [showQuickCust, setShowQuickCust] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content">
        <h3 className="text-xl font-bold mb-6">طلب صيانة جديد</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">العميل *</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
                <option value="">اختر عميل...</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
              <button
                type="button"
                className="btn-primary px-3 flex items-center justify-center"
                style={{ width: 42, height: 42 }}
                onClick={() => setShowQuickCust(true)}
                title="إضافة عميل سريعاً"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">الماركة</label>
              <select className="input" value={form.device_brand_id ?? ''} onChange={e => set('device_brand_id', Number(e.target.value) || null)}>
                <option value="">—</option>
                {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الموديل *</label>
              <input className="input" placeholder="مثال: Galaxy S24" value={form.device_model} onChange={e => set('device_model', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">اللون</label><input className="input" value={form.device_color} onChange={e => set('device_color', e.target.value)} /></div>
            <div><label className="label">حالة الجهاز</label><input className="input" placeholder="خدوش، شاشة مكسورة..." value={form.device_condition} onChange={e => set('device_condition', e.target.value)} /></div>
          </div>
          <div>
            <label className="label">وصف العطل *</label>
            <textarea className="input" rows={3} value={form.fault_desc} onChange={e => set('fault_desc', e.target.value)} />
          </div>
          <div>
            <label className="label">أجر الصيانة (ج.م)</label>
            <input type="number" className="input" value={form.labor_cost} onChange={e => set('labor_cost', Number(e.target.value))} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" onClick={() => onSave(form)}>حفظ</button>
          <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </div>
      {showQuickCust && (
        <QuickAddCustomerModal
          onClose={() => setShowQuickCust(false)}
          onSuccess={(newCust) => {
            onNewCustomerAdded(newCust)
            set('customer_id', newCust.id)
          }}
        />
      )}
    </div>
  )
}

function RepairDetailModal({ job, financialAccounts, onClose }: any) {
  const [status, setStatus] = useState(job.status)
  const [notes, setNotes] = useState(job.technician_notes ?? '')
  const [amountPaid, setAmountPaid] = useState(job.amount_paid)
  const [laborCost, setLaborCost] = useState(job.labor_cost)
  const [selectedAccountId, setSelectedAccountId] = useState(job.financial_account_id || 'cash_drawer')

  const handleSave = async () => {
    try {
      await updateRepairStatus(job.id, status, notes, amountPaid, laborCost, selectedAccountId)
      toast.success('تم التحديث'); onClose()
    } catch (e: any) { toast.error(typeof e === 'string' ? e : 'فشل التحديث') }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content">
        <h3 className="text-xl font-bold mb-2">طلب صيانة — <span style={{ color: 'var(--clr-primary)' }}>{job.job_no}</span></h3>
        <div className="text-sm mb-6" style={{ color: 'var(--clr-muted)' }}>{job.customer_name} · {job.device_model}</div>
        <div className="glass-surface p-4 mb-4 text-sm">
          <div className="font-medium mb-1">وصف العطل</div>
          <div style={{ color: 'var(--clr-text-2)' }}>{job.fault_desc}</div>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">الحالة</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              {['received', 'in_progress', 'ready', 'delivered', 'cancelled'].map(s =>
                <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">ملاحظات الفني</label>
            <textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="label">أجر الصيانة (ج.م)</label>
              <input type="number" className="input" value={laborCost} onChange={e => setLaborCost(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">تكلفة قطع الغيار (ج.م)</label>
              <input type="number" className="input bg-[rgba(255,255,255,0.02)] cursor-not-allowed" value={job.parts_cost} disabled />
            </div>
          </div>
          <div className="glass-surface p-3 text-center text-sm">
            <div style={{ color: 'var(--clr-muted)' }}>الإجمالي النهائي</div>
            <div className="font-bold text-lg" style={{ color: 'var(--clr-primary)' }}>{formatEGP(laborCost + job.parts_cost)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">المبلغ المدفوع</label>
              <input type="number" className="input" value={amountPaid} onChange={e => setAmountPaid(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">الحساب المالي المستلم</label>
              <select
                className="input"
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
              >
                {financialAccounts?.map((fa: any) => (
                  <option key={fa.id} value={fa.id}>{fa.name_ar}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button className="btn-primary flex-1" onClick={handleSave}>حفظ التغييرات</button>
          <button
            type="button"
            className="btn-secondary font-bold text-xs"
            style={{ background: 'rgba(37,211,102,0.18)', color: '#25d366', border: '1px solid rgba(37,211,102,0.3)' }}
            onClick={() => shareRepairTicketWhatsApp(job, 'متجر XPhone', job.customer_phone)}
          >
            إرسال إيصال الصيانة عبر WhatsApp 💬
          </button>
          <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}
