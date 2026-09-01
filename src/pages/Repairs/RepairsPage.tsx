import { useState, useEffect } from 'react'
import { Plus, Search, FileSpreadsheet, Calendar, Wrench, UserCheck, DollarSign, Calculator, TrendingUp } from 'lucide-react'
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
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false)
  const [newlyAddedCustomer, setNewlyAddedCustomer] = useState<any>(null)
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())

  const load = async (from = dateFrom, to = dateTo) => {
    try {
      const [j, c, b, accs] = await Promise.all([
        getRepairJobs({
          status: statusFilter || undefined,
          search: search || undefined,
          technician_name: technicianFilter || undefined,
          date_from: from || undefined,
          date_to: to || undefined
        }),
        getCustomers(), getBrands(), getFinancialAccounts()
      ])
      setJobs(j || []); setCustomers(c || []); setBrands(b || []); setFinancialAccounts(accs || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { load().catch(console.error) }, [statusFilter, search, technicianFilter])

  // Summary Metrics
  const totalCustomerPriceSum = jobs.reduce((acc, j) => acc + (j.amount_paid || 0), 0)
  const totalCostSum = jobs.reduce((acc, j) => acc + (j.total_cost || 0), 0)
  const totalProfitSum = jobs.reduce((acc, j) => acc + (j.repair_profit !== undefined ? j.repair_profit : (j.amount_paid - j.total_cost)), 0)

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      {/* Header */}
      <div className="page-header flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Wrench size={28} style={{ color: 'var(--clr-primary)' }} />
            خدمات وحسابات عمليات الصيانة
          </h1>
          <p className="text-sm" style={{ color: 'var(--clr-muted)' }}>
            إدارة تذاكر الإصلاح، إجمالي تكلفة الفواتير (قطع الغيار، التوصيل، أجر الفني)، وصافي ربح الصيانة المطابق للمحاسبة
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="btn-secondary flex items-center gap-2 font-bold cursor-pointer text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 shadow-sm py-2.5 px-4"
            title="استخراج تقرير إكسيل تفصيلي بعمليات الصيانة شامل الفاتورة واسم الفني والتكلفة والربح"
          >
            <FileSpreadsheet size={17} />
            استخراج تقرير إكسيل الصيانة
          </button>
          <button
            id="add-repair-btn"
            className="btn-primary font-bold py-2.5 px-5 flex items-center gap-2 shadow-lg cursor-pointer"
            onClick={() => { setSelected(null); setShowModal(true) }}
          >
            <Plus size={18} /> طلب صيانة جديد
          </button>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-2xl border flex items-center justify-between" style={{ borderColor: 'var(--clr-border)' }}>
          <div>
            <div className="text-xs font-bold text-[var(--clr-muted)] mb-1">إجمالي سعر الصيانة (على العملاء)</div>
            <div className="text-xl font-mono font-black text-[var(--clr-primary)]">{formatEGP(totalCustomerPriceSum)}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--clr-primary)]/10 text-[var(--clr-primary)] flex items-center justify-center font-bold">
            <DollarSign size={22} />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border flex items-center justify-between" style={{ borderColor: 'var(--clr-border)' }}>
          <div>
            <div className="text-xs font-bold text-[var(--clr-muted)] mb-1">إجمالي تكلفة الصيانة (قطع + توصيل + فني)</div>
            <div className="text-xl font-mono font-black text-amber-400">{formatEGP(totalCostSum)}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <Calculator size={22} />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border flex items-center justify-between" style={{ borderColor: 'var(--clr-border)' }}>
          <div>
            <div className="text-xs font-bold text-[var(--clr-muted)] mb-1">صافي الأرباح المعتمدة من الصيانة</div>
            <div className="text-xl font-mono font-black text-emerald-400">{formatEGP(totalProfitSum)}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* Date Filter & Search & Technician Toolbar */}
      <div className="glass-card p-4 rounded-2xl border flex flex-col gap-3" style={{ borderColor: 'var(--clr-border)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar size={17} className="text-[var(--clr-primary)]" />
            <span className="text-xs font-bold text-[var(--clr-text)]">تصفية الفترة:</span>
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
              className="btn-primary text-xs px-3.5 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Search size={14} /> بحث وتحديث
            </button>
          </div>

          <div className="text-xs text-[var(--clr-muted)] font-bold">
            إجمالي التذاكر المعروضة: <span className="font-mono text-amber-400 text-sm">{jobs.length}</span> تذكرة
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 border-t pt-3" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="relative">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-[var(--clr-muted)]" />
            <input
              className="input w-full text-xs pr-9"
              placeholder="بحث باسم العميل، الهاتف، رقم الفاتورة، أو الموديل..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="relative">
            <UserCheck size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-emerald-400" />
            <input
              className="input w-full text-xs pr-9 font-bold"
              placeholder="تصفية باسم القائم بالصيانة (الفني)..."
              value={technicianFilter}
              onChange={e => setTechnicianFilter(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              className={`badge cursor-pointer px-2.5 py-1.5 text-xs font-bold transition-all ${!statusFilter ? 'badge-primary shadow-md' : 'badge-muted'}`}
              onClick={() => setStatusFilter('')}
            >
              الكل ({jobs.length})
            </button>
            {STATUSES.map(s => (
              <button
                key={s}
                className={`badge cursor-pointer px-2.5 py-1.5 text-xs font-bold transition-all ${statusFilter === s ? 'badge-primary shadow-md' : 'badge-muted'}`}
                onClick={() => setStatusFilter(s)}
              >
                {statusLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Jobs Table */}
      <div className="glass-card overflow-hidden rounded-2xl">
        <table className="data-table">
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>العميل ورقم الهاتف</th>
              <th>الجهاز والعطل</th>
              <th>القائم بالصيانة (الفني)</th>
              <th>سعر الصيانة (العميل)</th>
              <th>إجمالي التكلفة (المتجر)</th>
              <th>صافي الربح</th>
              <th>الحالة والتاريخ</th>
              <th className="text-center">إجراءات والتراسل</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => {
              const price = j.amount_paid || 0
              const cost = j.total_cost || 0
              const profit = j.repair_profit !== undefined ? j.repair_profit : (price - cost)

              return (
                <tr key={j.id} className="hover:bg-[var(--clr-surface-2)] transition-colors">
                  <td>
                    <span className="font-mono font-bold text-xs text-[var(--clr-primary)]">{j.job_no}</span>
                  </td>
                  <td>
                    <div className="font-bold text-sm text-[var(--clr-text)]">{j.customer_name}</div>
                    <div className="text-xs font-mono text-[var(--clr-muted)]">{j.customer_phone || '—'}</div>
                  </td>
                  <td>
                    <div className="font-bold text-xs" dir="ltr">
                      {j.device_brand_name} {j.device_model}
                    </div>
                    <div className="max-w-[180px] truncate text-[11px] text-[var(--clr-muted)]" title={j.fault_desc}>
                      {j.fault_desc}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-muted text-xs font-bold text-emerald-400">
                      👤 {j.technician_name || 'فني الصيانة'}
                    </span>
                  </td>
                  <td className="font-mono font-bold text-xs text-[var(--clr-primary)]">
                    {formatEGP(price)}
                  </td>
                  <td className="font-mono text-xs text-amber-400">
                    {formatEGP(cost)}
                  </td>
                  <td className="font-mono font-bold text-xs">
                    <span className={profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatEGP(profit)}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className={statusClass(j.status)}>{statusLabel(j.status)}</span>
                      <span className="text-[10px] text-[var(--clr-muted)] font-mono">
                        استلام: {formatDate(j.received_at)}
                      </span>
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        className="btn-secondary text-xs px-2.5 py-1 font-bold cursor-pointer"
                        onClick={() => setSelected(j)}
                      >
                        تفاصيل وتحديث
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs px-2.5 py-1 font-bold cursor-pointer flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => shareRepairTicketWhatsApp(j, 'متجر XPhone', j.customer_phone)}
                        title="إرسال وتعديل كارت الصيانة في نافذة الواتساب المنبثقة الجانبية"
                      >
                        💬 واتساب
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-xs font-bold text-[var(--clr-muted)]">
                  لا توجد طلبات صيانة مطابقة لخيارات البحث والتصفية
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportReportModal
          title="استخراج تقرير حركات وتكاليف وأرباح الصيانة لـ Excel"
          description="حدد الفترة لتوليد تقرير شامل يتضمن الفاتورة، تاريخ الاستلام والتسليم الفعلي، اسم العميل، اسم الفني، سعر الصيانة، إجمالي التكلفة، وصافي الربح"
          onClose={() => setShowExportModal(false)}
          onExport={exportPeriodRepairsReport}
        />
      )}

      {/* New Repair Modal */}
      {showModal && (
        <NewRepairModal 
          customers={customers} 
          brands={brands} 
          newlyAddedCustomer={newlyAddedCustomer}
          onClose={() => setShowModal(false)}
          onAddCustomerClick={() => setShowQuickCustomerModal(true)}
          onSave={async (data: any) => {
            try {
              await createRepairJob(data)
              toast.success('تم إنشاء طلب الصيانة بنجاح')
              setShowModal(false); load()
            } catch (e: any) { toast.error(typeof e === 'string' ? e : 'فشل الحفظ') }
          }} 
        />
      )}

      {/* Repair Detail / Status Edit Modal */}
      {selected && (
        <RepairDetailModal
          job={selected}
          financialAccounts={financialAccounts}
          onClose={() => { setSelected(null); load() }}
        />
      )}

      {/* Top-level Quick Add Customer Modal (z-index 99999) */}
      {showQuickCustomerModal && (
        <QuickAddCustomerModal
          onClose={() => setShowQuickCustomerModal(false)}
          onSuccess={(newCust) => {
            setCustomers(prev => [...prev, newCust])
            setNewlyAddedCustomer(newCust)
            setShowQuickCustomerModal(false)
            toast.success(`تم إنشاء واختيار العميل (${newCust.name}) تلقائياً في الفاتورة!`)
          }}
        />
      )}
    </div>
  )
}

function NewRepairModal({ customers, brands, newlyAddedCustomer, onClose, onSave, onAddCustomerClick }: any) {
  const [form, setForm] = useState({
    customer_id: newlyAddedCustomer?.id || '',
    device_brand_id: null as number | null,
    device_model: '',
    device_color: '',
    device_condition: '',
    fault_desc: '',
    labor_cost: 0,
    parts_cost: 0,
    delivery_cost: 0,
    amount_paid: 0, // سعر الصيانة على العميل
    technician_name: '',
    user_id: null as string | null,
  })

  useEffect(() => {
    if (newlyAddedCustomer?.id) {
      setForm(f => ({ ...f, customer_id: newlyAddedCustomer.id }))
    }
  }, [newlyAddedCustomer])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Live total cost & profit calculation
  const totalCost = (form.labor_cost || 0) + (form.parts_cost || 0) + (form.delivery_cost || 0)
  const estimatedProfit = (form.amount_paid || 0) - totalCost

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-xl bg-[var(--clr-surface)] border border-[var(--clr-border)] shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--clr-text)]">
            <Wrench size={20} className="text-[var(--clr-primary)]" />
            <span>تسجيل طلب و فاتورة صيانة جديدة</span>
          </h3>
          <button type="button" className="btn-icon p-1 text-[var(--clr-muted)] hover:text-[var(--clr-text)]" onClick={onClose}>✕</button>
        </div>

        <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Customer Selector with Quick Add Customer Button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label text-xs font-bold text-[var(--clr-text)] m-0">العميل المستهدف *</label>
              <button
                type="button"
                className="text-xs text-[var(--clr-primary)] hover:underline flex items-center gap-1 font-bold cursor-pointer bg-transparent border-0 p-0"
                onClick={onAddCustomerClick}
              >
                <Plus size={13} /> + عميل جديد
              </button>
            </div>
            <div className="flex gap-2">
              <select className="input flex-1 font-bold text-xs" value={form.customer_id} onChange={e => set('customer_id', e.target.value)} required>
                <option value="">اختر عميل من القائمة...</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
              </select>
              <button
                type="button"
                className="btn-primary text-xs font-bold px-3 flex items-center justify-center gap-1 cursor-pointer shrink-0"
                onClick={onAddCustomerClick}
                title="إضافة عميل جديد بنادفة منبثقة ممتازة"
              >
                <Plus size={15} /> عميل جديد
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">اسم القائم بالصيانة (الفني المسؤول)</label>
              <input
                className="input text-xs font-bold text-emerald-400"
                placeholder="مثال: المهندس أحمد علي"
                value={form.technician_name}
                onChange={e => set('technician_name', e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">الماركة / الشركة المصنعة</label>
              <select className="input text-xs" value={form.device_brand_id ?? ''} onChange={e => set('device_brand_id', Number(e.target.value) || null)}>
                <option value="">— اختر الماركة —</option>
                {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">الموديل والجهاز *</label>
              <input className="input text-xs font-bold" placeholder="مثال: iPhone 15 Pro" value={form.device_model} onChange={e => set('device_model', e.target.value)} required />
            </div>
            <div>
              <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">اللون</label>
              <input className="input text-xs" placeholder="أسود، أزرق..." value={form.device_color} onChange={e => set('device_color', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">حالة الجهاز الظاهرية</label>
              <input className="input text-xs" placeholder="خدوش بسيطة، شاشة مكسورة..." value={form.device_condition} onChange={e => set('device_condition', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">وصف العطل المطلوب إصلاحه *</label>
            <textarea className="input text-xs leading-relaxed" rows={2} placeholder="تغيير شاشة + فحص بطارية وكاميرا..." value={form.fault_desc} onChange={e => set('fault_desc', e.target.value)} required />
          </div>

          {/* High-Contrast Financial Breakdown Section */}
          <div className="p-4 rounded-2xl bg-[var(--clr-surface-2)] border border-[var(--clr-border)] flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--clr-border)' }}>
              <h4 className="text-xs font-bold text-[var(--clr-primary)] flex items-center gap-1.5">
                <Calculator size={16} />
                <span>مطابقة التكاليف وسعر الصيانة وأرباح الفاتورة</span>
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ✓ مطابقة محاسبية
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label text-[11px] font-bold text-[var(--clr-text)] mb-1">سعر الصيانة (العميل)</label>
                <input
                  type="number"
                  className="input text-xs font-mono font-bold text-cyan-400 border-cyan-500/40"
                  placeholder="0.00"
                  value={form.amount_paid || ''}
                  onChange={e => set('amount_paid', Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label text-[11px] font-bold text-[var(--clr-text)] mb-1">أجر الفني (مصنعية)</label>
                <input
                  type="number"
                  className="input text-xs font-mono font-bold"
                  placeholder="0.00"
                  value={form.labor_cost || ''}
                  onChange={e => set('labor_cost', Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label text-[11px] font-bold text-[var(--clr-text)] mb-1">تكلفة قطع الغيار</label>
                <input
                  type="number"
                  className="input text-xs font-mono font-bold text-amber-400 border-amber-500/40"
                  placeholder="0.00"
                  value={form.parts_cost || ''}
                  onChange={e => set('parts_cost', Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label text-[11px] font-bold text-[var(--clr-text)] mb-1">مصاريف التوصيل/النقل</label>
                <input
                  type="number"
                  className="input text-xs font-mono font-bold"
                  placeholder="0.00"
                  value={form.delivery_cost || ''}
                  onChange={e => set('delivery_cost', Number(e.target.value))}
                />
              </div>
            </div>

            {/* High-Contrast Calculated Summary Bar */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--clr-surface)] border border-[var(--clr-border)] text-xs">
              <div>
                <span className="text-[var(--clr-text-2)] font-bold block mb-0.5">إجمالي تكلفة الصيانة (المتجر):</span>
                <span className="font-mono font-bold text-amber-400 text-sm">{formatEGP(totalCost)}</span>
              </div>
              <div>
                <span className="text-[var(--clr-text-2)] font-bold block mb-0.5">صافي الربح من عملية الصيانة:</span>
                <span className={`font-mono font-bold text-sm ${estimatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatEGP(estimatedProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
          <button className="btn-primary flex-1 py-2.5 font-bold cursor-pointer" onClick={() => onSave(form)}>حفظ طلب الصيانة</button>
          <button className="btn-secondary py-2.5 font-bold cursor-pointer" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}

function RepairDetailModal({ job, financialAccounts, onClose }: any) {
  const [status, setStatus] = useState(job.status)
  const [notes, setNotes] = useState(job.technician_notes ?? '')
  const [technicianName, setTechnicianName] = useState(job.technician_name ?? '')
  const [amountPaid, setAmountPaid] = useState(job.amount_paid) // سعر الصيانة للعميل
  const [laborCost, setLaborCost] = useState(job.labor_cost) // أجر الفني
  const [partsCost, setPartsCost] = useState(job.parts_cost || 0) // ثمن قطع الغيار (قابل للتعديل)
  const [deliveryCost, setDeliveryCost] = useState(job.delivery_cost || 0) // مصاريف التوصيل
  const [selectedAccountId, setSelectedAccountId] = useState(job.financial_account_id || 'cash_drawer')

  // Live total cost calculation (Parts + Labor + Delivery)
  const totalCost = laborCost + partsCost + deliveryCost
  const netProfit = (amountPaid || 0) - totalCost

  const handleSave = async () => {
    try {
      await updateRepairStatus(
        job.id,
        status,
        notes,
        amountPaid,
        laborCost,
        partsCost,
        deliveryCost,
        technicianName,
        selectedAccountId
      )
      toast.success('تم تحديث بيانات وحالة وتكاليف الصيانة بنجاح!')
      onClose()
    } catch (e: any) { toast.error(typeof e === 'string' ? e : 'فشل التحديث') }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-2xl bg-[var(--clr-surface)] border border-[var(--clr-border)] shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <div>
            <h3 className="text-lg font-bold text-[var(--clr-text)] flex items-center gap-2">
              <span>تفاصيل وتحديث طلب صيانة</span>
              <span className="font-mono text-[var(--clr-primary)]">#{job.job_no}</span>
            </h3>
            <p className="text-xs text-[var(--clr-muted)] mt-0.5">
              العميل: {job.customer_name} ({job.customer_phone || 'بدون هاتف'}) · الجهاز: {job.device_brand_name} {job.device_model}
            </p>
          </div>
          <button type="button" className="btn-icon p-1 text-[var(--clr-muted)] hover:text-[var(--clr-text)]" onClick={onClose}>✕</button>
        </div>

        <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Status & Technician */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">حالة تذكرة الصيانة</label>
              <select className="input text-xs font-bold" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold text-emerald-400 mb-1">اسم القائم بالصيانة (الفني المسؤول)</label>
              <input
                type="text"
                className="input text-xs font-bold text-emerald-400"
                placeholder="اسم الفني القائم بالعملية..."
                value={technicianName}
                onChange={e => setTechnicianName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">ملاحظات وتشخيص الفني</label>
            <textarea className="input text-xs leading-relaxed" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات الصيانة والقطع المستبدلة..." />
          </div>

          {/* High-Contrast Financial Breakdown Card */}
          <div className="p-4 rounded-2xl bg-[var(--clr-surface-2)] border border-[var(--clr-border)] flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--clr-border)' }}>
              <h4 className="text-xs font-bold text-[var(--clr-primary)] flex items-center gap-1.5">
                <Calculator size={16} />
                <span>مطابقة التكاليف وسعر الصيانة وأرباح الفاتورة</span>
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ✓ مطابقة محاسبية
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label text-[11px] font-bold text-[var(--clr-text)] mb-1">سعر الصيانة (العميل)</label>
                <input
                  type="number"
                  className="input text-xs font-mono font-bold text-cyan-400 border-cyan-500/40"
                  value={amountPaid}
                  onChange={e => setAmountPaid(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label text-[11px] font-bold text-[var(--clr-text)] mb-1">أجر الفني (مصنعية)</label>
                <input
                  type="number"
                  className="input text-xs font-mono font-bold"
                  value={laborCost}
                  onChange={e => setLaborCost(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label text-[11px] font-bold text-[var(--clr-text)] mb-1">تكلفة قطع الغيار</label>
                <input
                  type="number"
                  className="input text-xs font-mono font-bold text-amber-400 border-amber-500/40"
                  value={partsCost}
                  onChange={e => setPartsCost(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label text-[11px] font-bold text-[var(--clr-text)] mb-1">مصاريف التوصيل/النقل</label>
                <input
                  type="number"
                  className="input text-xs font-mono font-bold"
                  value={deliveryCost}
                  onChange={e => setDeliveryCost(Number(e.target.value))}
                />
              </div>
            </div>

            {/* High-Contrast Calculated Summary Bar */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--clr-surface)] border border-[var(--clr-border)] text-xs">
              <div>
                <span className="text-[var(--clr-text-2)] font-bold block mb-0.5">إجمالي تكلفة الصيانة (المتجر):</span>
                <span className="font-mono font-bold text-amber-400 text-sm">{formatEGP(totalCost)}</span>
              </div>
              <div>
                <span className="text-[var(--clr-text-2)] font-bold block mb-0.5">صافي الربح من عملية الصيانة:</span>
                <span className={`font-mono font-bold text-sm ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatEGP(netProfit)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="label text-xs font-bold text-[var(--clr-text)] mb-1">الحساب المالي المستلم لإيراد الصيانة</label>
            <select
              className="input text-xs font-bold"
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
            >
              {financialAccounts?.map((fa: any) => (
                <option key={fa.id} value={fa.id}>{fa.name_ar}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
          <button className="btn-primary flex-1 font-bold py-2.5 cursor-pointer" onClick={handleSave}>حفظ التغييرات</button>
          <button
            type="button"
            className="btn-secondary font-bold text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 py-2.5 px-3 flex items-center justify-center gap-1.5 cursor-pointer"
            onClick={() => shareRepairTicketWhatsApp(job, 'متجر XPhone', job.customer_phone)}
          >
            💬 إرسال عبر WhatsApp
          </button>
          <button className="btn-secondary font-bold py-2.5 cursor-pointer" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}
