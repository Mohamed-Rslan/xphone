import { useState, useEffect } from 'react'
import { Plus, Search, User, CreditCard } from 'lucide-react'
import { getCustomers, createCustomer, updateCustomer, getCustomerHistory } from '../../lib/commands'
import { formatEGP, formatDate } from '../../lib/utils'
import SettleCustomerInvoicesModal from '../../components/SettleCustomerInvoicesModal'
import toast from 'react-hot-toast'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [history, setHistory] = useState<any>(null)
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [settleCustomerId, setSettleCustomerId] = useState<string | undefined>(undefined)

  const load = (q?: string) => getCustomers(q).then(setCustomers).catch(console.error)
  useEffect(() => { load() }, [])

  const handleSearchChange = (q: string) => { setSearch(q); load(q || undefined) }

  const handleViewHistory = async (c: any) => {
    setSelected(c)
    const h = await getCustomerHistory(c.id)
    setHistory(h)
  }

  const handleOpenSettleModal = (customerId?: string) => {
    setSettleCustomerId(customerId)
    setShowSettleModal(true)
  }

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">إدارة العملاء</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary flex items-center gap-2 text-xs py-2 px-3.5 font-bold cursor-pointer shadow-sm hover:scale-[1.01] transition-transform"
            style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
            onClick={() => handleOpenSettleModal(undefined)}
            title="سداد وتحصيل مديونيات فواتير المبيعات الآجلة للعملاء"
          >
            <CreditCard size={15} className="text-emerald-400" />
            سداد / تحصيل مديونيات العملاء
          </button>
          <button id="add-customer-btn" className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus size={16} /> إضافة عميل
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4" style={{ color: 'var(--clr-muted)' }} />
        <input className="input" style={{ paddingRight: 44 }} placeholder="بحث بالاسم أو رقم الهاتف..."
          value={search} onChange={e => handleSearchChange(e.target.value)} />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="data-table">
          <thead><tr>
            <th>الاسم</th>
            <th>رقم الهاتف</th>
            <th>إجمالي المشتريات</th>
            <th>المديونية المستحقة</th>
            <th>عدد الفواتير</th>
            <th>تاريخ الإضافة</th>
            <th className="text-center">إجراءات</th>
          </tr></thead>
          <tbody>
            {customers.map(c => {
              const hasDebt = (c.balance || 0) > 0.001
              return (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center rounded-full w-8 h-8 flex-shrink-0"
                        style={{ background: 'var(--clr-primary-dim)' }}>
                        <User size={14} style={{ color: 'var(--clr-primary)' }} />
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td dir="ltr" className="text-sm">{c.phone ?? '—'}</td>
                  <td style={{ color: 'var(--clr-accent)', fontWeight: 'bold' }}>{formatEGP(c.total_spent ?? 0)}</td>
                  <td>
                    {hasDebt ? (
                      <span className="badge badge-danger text-xs font-mono font-bold">
                        {formatEGP(c.balance)}
                      </span>
                    ) : (
                      <span className="badge badge-success text-[11px]">
                        خالص
                      </span>
                    )}
                  </td>
                  <td>{c.purchase_count ?? 0}</td>
                  <td className="text-sm">{formatDate(c.created_at)}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs px-2.5 py-1 font-bold flex items-center gap-1 cursor-pointer"
                        style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
                        onClick={() => handleOpenSettleModal(c.id)}
                        title="سداد وتحصيل مديونية هذا العميل"
                      >
                        <CreditCard size={13} /> سداد
                      </button>
                      <button className="btn-secondary text-xs px-2.5 py-1" onClick={() => handleViewHistory(c)}>سجل</button>
                      <button className="btn-icon" onClick={() => { setEditing(c); setShowModal(true) }}>
                        ✏️
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {customers.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--clr-muted)' }}>لا يوجد عملاء</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CustomerModal editing={editing} onClose={() => setShowModal(false)}
          onSave={async (data: any) => {
            try {
              if (editing) { await updateCustomer(editing.id, data) }
              else { await createCustomer(data) }
              toast.success(editing ? 'تم التحديث' : 'تمت الإضافة')
              setShowModal(false); load()
            } catch (e: any) { toast.error(typeof e === 'string' ? e : 'فشل الحفظ') }
          }} />
      )}

      {selected && history && (
        <CustomerHistoryModal customer={selected} history={history} onClose={() => { setSelected(null); setHistory(null) }} />
      )}

      {showSettleModal && (
        <SettleCustomerInvoicesModal
          initialCustomerId={settleCustomerId}
          onClose={() => setShowSettleModal(false)}
          onSuccess={() => load(search || undefined)}
        />
      )}
    </div>
  )
}

function CustomerModal({ editing, onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: editing?.name ?? '', phone: editing?.phone ?? '',
    phone2: editing?.phone2 ?? '', address: editing?.address ?? '',
    notes: editing?.notes ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content">
        <h3 className="text-xl font-bold mb-6">{editing ? 'تعديل عميل' : 'إضافة عميل'}</h3>
        <div className="flex flex-col gap-4">
          <div><label className="label">الاسم *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">رقم الهاتف</label><input className="input" dir="ltr" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="label">رقم إضافي</label><input className="input" dir="ltr" value={form.phone2} onChange={e => set('phone2', e.target.value)} /></div>
          </div>
          <div><label className="label">العنوان</label><input className="input" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div><label className="label">ملاحظات</label><textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" onClick={() => onSave(form)}>حفظ</button>
          <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}

function CustomerHistoryModal({ customer, history, onClose }: any) {
  const [tab, setTab] = useState<'sales' | 'repairs' | 'monetary'>('sales')
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" style={{ maxWidth: 700 }}>
        <h3 className="text-xl font-bold mb-1">سجل العميل</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--clr-muted)' }}>{customer.name} · {customer.phone}</p>
        <div className="flex gap-2 mb-4">
          {(['sales', 'repairs', 'monetary'] as const).map(t => (
            <button key={t} className={`badge cursor-pointer px-3 py-1.5 ${tab === t ? 'badge-primary' : 'badge-muted'}`} onClick={() => setTab(t)}>
              {{ sales: 'المبيعات', repairs: 'الصيانة', monetary: 'الخدمات المالية' }[t]}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
          {tab === 'sales' && history.sales.map((s: any) => (
            <div key={s.id} className="glass-surface p-3 mb-2 flex justify-between items-center">
              <div><div className="font-mono text-sm" style={{ color: 'var(--clr-primary)' }}>{s.invoice_no}</div><div className="text-xs" style={{ color: 'var(--clr-muted)' }}>{formatDate(s.created_at)}</div></div>
              <span className="font-bold">{formatEGP(s.total)}</span>
            </div>
          ))}
          {tab === 'repairs' && history.repairs.map((r: any) => (
            <div key={r.id} className="glass-surface p-3 mb-2 flex justify-between items-center">
              <div><div className="font-mono text-sm" style={{ color: 'var(--clr-primary)' }}>{r.job_no}</div><div className="text-xs" style={{ color: 'var(--clr-muted)' }}>{r.device_model}</div></div>
              <span className="font-bold">{formatEGP(r.total_cost)}</span>
            </div>
          ))}
          {tab === 'monetary' && history.monetary.map((m: any) => (
            <div key={m.id} className="glass-surface p-3 mb-2 flex justify-between items-center">
              <div><div className="text-sm font-medium">{m.service_name}</div><div className="text-xs" style={{ color: 'var(--clr-muted)' }}>{formatDate(m.created_at)}</div></div>
              <div className="text-left"><div className="font-bold">{formatEGP(m.amount)}</div><div className="text-xs" style={{ color: 'var(--clr-success)' }}>+{formatEGP(m.commission)}</div></div>
            </div>
          ))}
          {history[tab]?.length === 0 && <div className="text-center py-8" style={{ color: 'var(--clr-muted)' }}>لا توجد بيانات</div>}
        </div>
        <button className="btn-secondary w-full mt-4" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  )
}
