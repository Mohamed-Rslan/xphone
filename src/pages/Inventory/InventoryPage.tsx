import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Edit2, Upload, Download, History, ClipboardCheck, Trash2, AlertOctagon, FileSpreadsheet, Lock } from 'lucide-react'
import {
  getProducts, getBrands, getCategories, createProduct, updateProduct,
  getStockMovements, recordDamagedGoods, createInventoryAudit, getInventoryAudits
} from '../../lib/commands'
import { formatEGP, formatDateTime, formatDate } from '../../lib/utils'
import { downloadProductImportTemplate, importProductsFromExcel, exportInventoryExcel } from '../../lib/excel'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

import RecordDamagedGoodsModal from '../../components/RecordDamagedGoodsModal'

export default function InventoryPage() {
  const { hasPermission } = useAuthStore()
  const canEdit = hasPermission('inventory_edit')
  const canDamage = hasPermission('inventory_damaged')
  const [products, setProducts] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'products' | 'movements' | 'audits'>('products')
  const [movements, setMovements] = useState<any[]>([])
  const [audits, setAudits] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Audit modal state
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [auditTitle, setAuditTitle] = useState(`جرد مخزون - ${formatDate(new Date().toISOString())}`)
  const [auditNotes, setAuditNotes] = useState('')
  const [auditCounts, setAuditCounts] = useState<{ [productId: string]: number }>({})

  // Damaged goods modal state
  const [showDamagedModal, setShowDamagedModal] = useState(false)
  const [damagedProductId, setDamagedProductId] = useState<string | undefined>(undefined)

  const load = async () => {
    const [p, b, c] = await Promise.all([getProducts(), getBrands(), getCategories()])
    setProducts(p); setBrands(b); setCategories(c)
  }

  const loadMovements = async () => {
    try {
      const list = await getStockMovements()
      setMovements(list)
    } catch (e) {
      console.error(e)
    }
  }

  const loadAudits = async () => {
    try {
      const list = await getInventoryAudits()
      setAudits(list)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    load().catch(console.error)
  }, [])

  useEffect(() => {
    if (activeTab === 'movements') {
      loadMovements()
    } else if (activeTab === 'audits') {
      loadAudits()
    }
  }, [activeTab])

  // Barcode scanner listener
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (e.key === 'Enter') return
      }

      const currentTime = Date.now()
      if (currentTime - lastKeyTime > 50) {
        buffer = ''
      }
      lastKeyTime = currentTime

      if (e.key === 'Enter') {
        if (buffer.trim().length >= 4) {
          e.preventDefault()
          handleScannedBarcode(buffer.trim())
          buffer = ''
        }
      } else if (e.key.length === 1) {
        buffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [products])

  const handleScannedBarcode = (code: string) => {
    setSearch(code)
    const exactMatch = products.find(p => p.sku === code || p.barcode === code)
    if (exactMatch) {
      toast.success(`تم العثور على: ${exactMatch.name_ar}`)
    } else {
      toast('لم يتم العثور على تطابق تام، تم تصفية الجدول', { icon: '🔍' })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const t = toast.loading("جاري قراءة ملف Excel واستيراد المنتجات...")
    try {
      const count = await importProductsFromExcel(file)
      toast.success(`تم استيراد ${count} منتج بنجاح!`, { id: t })
      load()
    } catch (err) {
      toast.error("فشل استيراد المنتجات، يرجى التحقق من صحة الملف", { id: t })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    const items = products.map(p => ({
      product_id: p.id,
      actual_qty: auditCounts[p.id] !== undefined ? auditCounts[p.id] : p.stock_qty,
      notes: undefined,
    }))

    try {
      await createInventoryAudit({
        title: auditTitle,
        notes: auditNotes || undefined,
        items,
      })
      toast.success('تم حفظ جلسة مطابقة وجرد المخزون بنجاح')
      setShowAuditModal(false)
      setActiveTab('audits')
      loadAudits()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  const filtered = products.filter(p =>
    p.name_ar?.includes(search) || p.sku?.includes(search) ||
    p.brand_name?.toLowerCase().includes(search.toLowerCase())
  )

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'sale': return 'عملية بيع'
      case 'purchase': return 'شراء طلبيات'
      case 'return': return 'مرتجع'
      case 'adjustment': return 'تعديل / هالك'
      case 'repair_use': return 'قطع غيار صيانة'
      default: return type
    }
  }

  const getMovementTypeClass = (type: string) => {
    switch (type) {
      case 'sale':
      case 'repair_use':
        return 'badge-danger'
      case 'purchase':
      case 'return':
        return 'badge-success'
      default:
        return 'badge-muted'
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <div className="page-header flex-wrap">
        <h1 className="page-title flex items-center gap-3">
          المخزون وجودة المستودع
        </h1>
        {activeTab === 'products' && (
          <div className="flex gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls"
              className="hidden"
            />
            {/* Damaged Goods Button */}
            {canDamage && (
              <button
                onClick={() => setShowDamagedModal(true)}
                className="btn-secondary flex items-center gap-2 font-bold text-red-400 border-red-500/40 hover:bg-red-500/10 cursor-pointer shadow-sm"
                title="تسجيل بضاعة تالفة أو هالكة واستبعادها من المخزون"
              >
                <Trash2 size={16} />
                تسجيل بضاعة هالك
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => {
                  const initialCounts: { [id: string]: number } = {}
                  products.forEach(p => { initialCounts[p.id] = p.stock_qty })
                  setAuditCounts(initialCounts)
                  setShowAuditModal(true)
                }}
                className="btn-secondary flex items-center gap-2 font-bold"
                style={{ borderColor: 'var(--clr-accent)', color: 'var(--clr-accent)' }}
              >
                <ClipboardCheck size={16} />
                جرد المخزون المقارن
              </button>
            )}
            <button
              onClick={async () => {
                const t = toast.loading('جاري فتح نافذة حفظ التقرير...')
                try {
                  const saved = await exportInventoryExcel(products, brands, categories)
                  if (saved) {
                    toast.success('تم حفظ تقرير المخزون بنجاح!', { id: t })
                  } else {
                    toast.dismiss(t)
                  }
                } catch {
                  toast.error('فشل تصدير التقرير', { id: t })
                }
              }}
              className="btn-secondary flex items-center gap-2 font-bold cursor-pointer"
              title="تصدير بيانات المخزون لملف Excel"
            >
              <FileSpreadsheet size={16} className="text-emerald-400" />
              تصدير المخزون لـ Excel
            </button>
            {canEdit && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-2"
              >
                <Upload size={16} />
                استيراد من Excel
              </button>
            )}
            <button
              onClick={async () => {
                const t = toast.loading('جاري تحميل القالب...')
                try {
                  const saved = await downloadProductImportTemplate()
                  if (saved) toast.success('تم تحميل القالب بنجاح!', { id: t })
                  else toast.dismiss(t)
                } catch {
                  toast.error('فشل تحميل القالب', { id: t })
                }
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <Download size={16} />
              تحميل القالب
            </button>
            {canEdit && (
              <button id="add-product-btn" className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
                <Plus size={16} /> إضافة منتج
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`badge cursor-pointer px-4 py-2 text-sm font-semibold transition-all duration-200 border-0 ${
            activeTab === 'products' ? 'badge-primary' : 'badge-muted'
          }`}
        >
          قائمة المنتجات والمخزون
        </button>
        <button
          onClick={() => setActiveTab('audits')}
          className={`badge cursor-pointer px-4 py-2 text-sm font-semibold transition-all duration-200 border-0 ${
            activeTab === 'audits' ? 'badge-primary' : 'badge-muted'
          }`}
        >
          تقارير جرد المخزون والمطابقة
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`badge cursor-pointer px-4 py-2 text-sm font-semibold transition-all duration-200 border-0 ${
            activeTab === 'movements' ? 'badge-primary' : 'badge-muted'
          }`}
        >
          حركة المخزون اللوجستية
        </button>
      </div>

      {activeTab === 'products' && (
        <>
          <div className="glass-surface p-4 text-sm flex items-center gap-3" style={{ borderColor: 'rgba(124, 107, 255, 0.25)', color: 'var(--clr-text-2)' }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <span>
              <strong>نظام الباركود الذكي مفعّل:</strong> يمكنك مسح الباركود الخاص بأي منتج مباشرة بواسطة جهاز القارئ للبحث عنه وتعديله فوراً، أو لإضافته كمنتج جديد تلقائياً في ثانية واحدة!
            </span>
          </div>

          <div className="relative">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4" style={{ color: 'var(--clr-muted)' }} />
            <input className="input" style={{ paddingRight: 44 }} placeholder="بحث بالاسم أو الكود أو الماركة..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="glass-card overflow-hidden">
            <table className="data-table">
              <thead><tr>
                <th>الاسم</th><th>الماركة</th><th>الفئة</th><th>سعر التكلفة</th>
                <th>سعر البيع</th><th>الكمية</th><th>الحالة</th><th>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium">{p.name_ar}</div>
                      {p.sku && <div className="text-xs" style={{ color: 'var(--clr-muted)' }}>{p.sku}</div>}
                    </td>
                    <td><span dir="ltr">{p.brand_name ?? '—'}</span></td>
                    <td>{p.category_name}</td>
                    <td className="font-mono">{formatEGP(p.cost_price)}</td>
                    <td className="font-bold font-mono" style={{ color: 'var(--clr-primary)' }}>{formatEGP(p.sell_price)}</td>
                    <td>
                      <span className={`badge ${p.stock_qty <= 0 ? 'badge-danger' : p.stock_qty <= p.reorder_level ? 'badge-warning' : 'badge-success'}`}>
                        {p.stock_qty}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {p.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2 items-center">
                        <button
                          className={`btn-icon ${canEdit ? '' : 'opacity-30 cursor-not-allowed'}`}
                          title={canEdit ? 'تعديل المنتج' : '🔒 لا تملك صلاحية تعديل المخزون'}
                          onClick={() => {
                            if (!canEdit) {
                              toast.error('ليس لديك صلاحية تعديل بيانات المخزون')
                              return
                            }
                            setEditing(p)
                            setShowModal(true)
                          }}
                        >
                          {canEdit ? <Edit2 size={14} /> : <Lock size={14} />}
                        </button>
                        <button
                          className={`btn-icon ${canDamage ? 'hover:text-red-400' : 'opacity-30 cursor-not-allowed'}`}
                          title={canDamage ? 'تسجيل تالف / هالك' : '🔒 لا تملك صلاحية تسجيل الهالك'}
                          onClick={() => {
                            if (!canDamage) {
                              toast.error('ليس لديك صلاحية تسجيل البضاعة الهالكة')
                              return
                            }
                            setDamagedProductId(p.id)
                            setShowDamagedModal(true)
                          }}
                        >
                          <AlertOctagon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--clr-muted)' }}>
                    لا توجد منتجات
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Audits Tab */}
      {activeTab === 'audits' && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">سجل جلسات جرد ومطابقة المخزون</h3>
              <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                تقارير مقارنة العد الفعلي مع رصيد النظام لإظهار الفروقات والعجز دون التعديل على البيانات الداخلية
              </p>
            </div>
            <button
              onClick={() => {
                const initialCounts: { [id: string]: number } = {}
                products.forEach(p => { initialCounts[p.id] = p.stock_qty })
                setAuditCounts(initialCounts)
                setShowAuditModal(true)
              }}
              className="btn-primary flex items-center gap-2"
            >
              <ClipboardCheck size={16} />
              بدء جلسة جرد ومطابقة جديدة
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {audits.map(audit => (
              <div key={audit.id} className="glass-card p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
                  <div>
                    <h4 className="font-bold text-base">{audit.title}</h4>
                    <span className="text-xs font-mono" style={{ color: 'var(--clr-muted)' }}>{formatDateTime(audit.audit_date)}</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="text-right">
                      <div className="text-xs" style={{ color: 'var(--clr-muted)' }}>فرق الكميات:</div>
                      <div className={`font-bold font-mono ${audit.total_variance_qty < 0 ? 'text-red-400' : audit.total_variance_qty > 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                        {audit.total_variance_qty > 0 ? `+${audit.total_variance_qty}` : audit.total_variance_qty}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs" style={{ color: 'var(--clr-muted)' }}>القيمة المالية للفرق:</div>
                      <div className={`font-bold font-mono ${audit.total_variance_cost < 0 ? 'text-red-400' : audit.total_variance_cost > 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                        {formatEGP(audit.total_variance_cost)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                        <th className="py-2 px-2 font-bold">المنتج</th>
                        <th className="py-2 px-2 font-bold">رصيد النظام</th>
                        <th className="py-2 px-2 font-bold">العد الفعلي</th>
                        <th className="py-2 px-2 font-bold">الفارق (عجز/زيادة)</th>
                        <th className="py-2 px-2 font-bold">سعر التكلفة</th>
                        <th className="py-2 px-2 font-bold">قيمة الفارق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      {audit.items.map((it: any, idx: number) => (
                        <tr key={idx} className={it.variance_qty !== 0 ? 'bg-red-500/5' : ''}>
                          <td className="py-2 px-2 font-medium">{it.product_name}</td>
                          <td className="py-2 px-2 font-mono">{it.system_qty}</td>
                          <td className="py-2 px-2 font-mono font-bold text-white">{it.actual_qty}</td>
                          <td className={`py-2 px-2 font-mono font-bold ${it.variance_qty < 0 ? 'text-red-400' : it.variance_qty > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {it.variance_qty > 0 ? `+${it.variance_qty}` : it.variance_qty}
                          </td>
                          <td className="py-2 px-2 font-mono">{formatEGP(it.unit_cost)}</td>
                          <td className={`py-2 px-2 font-mono font-bold ${it.variance_cost < 0 ? 'text-red-400' : it.variance_cost > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {formatEGP(it.variance_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {audits.length === 0 && (
              <div className="glass-card p-12 text-center text-sm" style={{ color: 'var(--clr-muted)' }}>
                لم يتم تسجيل جلسات جرد سابقة
              </div>
            )}
          </div>
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم المنتج</th>
                <th>نوع الحركة</th>
                <th>الكمية المتغيرة</th>
                <th>الكمية السابقة</th>
                <th>الكمية الجديدة</th>
                <th>التفاصيل/المرجع</th>
                <th>التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(mv => (
                <tr key={mv.id}>
                  <td className="font-semibold">{mv.product_name}</td>
                  <td>
                    <span className={`badge ${getMovementTypeClass(mv.type_)}`}>
                      {getMovementTypeLabel(mv.type_)}
                    </span>
                  </td>
                  <td className={`font-bold ${mv.qty_change > 0 ? 'text-[var(--clr-success)]' : 'text-[var(--clr-danger)]'}`}>
                    {mv.qty_change > 0 ? `+${mv.qty_change}` : mv.qty_change}
                  </td>
                  <td>{mv.qty_before}</td>
                  <td className="font-semibold text-[var(--clr-primary)]">{mv.qty_after}</td>
                  <td className="text-xs text-[var(--clr-muted)]">{mv.ref_id || 'تعديل مستودع'} {mv.user_display_name ? `(بواسطة ${mv.user_display_name})` : ''}</td>
                  <td className="text-sm">{formatDateTime(mv.created_at)}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--clr-muted)]">
                    لا توجد حركات مخزون مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Modal */}
      {showModal && canEdit && (
        <ProductModal brands={brands} categories={categories} editing={editing}
          onClose={() => setShowModal(false)}
          onSave={async (data: any) => {
            if (!canEdit) {
              toast.error('ليس لديك صلاحية تعديل بيانات المخزون')
              return
            }
            try {
              if (editing && editing.id) { await updateProduct(editing.id, data) } else { await createProduct(data) }
              toast.success(editing && editing.id ? 'تم التحديث' : 'تمت الإضافة')
              await load(); setShowModal(false)
            } catch (e: any) { toast.error(typeof e === 'string' ? e : 'فشل الحفظ') }
          }} />
      )}

      {/* Damaged Goods Modal */}
      {showDamagedModal && (
        <RecordDamagedGoodsModal
          initialProductId={damagedProductId}
          onClose={() => {
            setShowDamagedModal(false)
            setDamagedProductId(undefined)
          }}
          onSuccess={() => {
            load()
            loadMovements()
          }}
        />
      )}

      {/* Stock Audit Reconciliation Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleSaveAudit} className="glass-card p-6 w-full max-w-4xl max-h-[90vh] flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: 'var(--clr-accent)' }}>
                  <ClipboardCheck size={22} />
                  جرد المخزون الفعلي ومطابقته مع رصيد النظام
                </h3>
                <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                  أدخل الكميات الفعلية المحصورة يدوياً. سيقوم النظام بحساب الفروقات والعجز والقيمة المالية للمطابقة فقط دون التعديل على أرصدة النظام.
                </p>
              </div>
              <button type="button" className="btn-icon font-bold text-sm" onClick={() => setShowAuditModal(false)}>✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold block mb-1">عنوان جلسة الجرد:</label>
                <input className="input w-full" value={auditTitle} onChange={e => setAuditTitle(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">ملاحظات الجرد:</label>
                <input className="input w-full" placeholder="ملاحظات المشرف أو لجنة الجرد..." value={auditNotes} onChange={e => setAuditNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[50vh] border rounded-xl" style={{ borderColor: 'var(--clr-border)' }}>
              <table className="w-full text-right text-sm">
                <thead className="sticky top-0 bg-[var(--clr-surface-2)] z-10">
                  <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                    <th className="py-2.5 px-3 font-bold">المنتج</th>
                    <th className="py-2.5 px-3 font-bold">رصيد النظام</th>
                    <th className="py-2.5 px-3 font-bold">العد الفعلي الحقيقي</th>
                    <th className="py-2.5 px-3 font-bold">الفارق</th>
                    <th className="py-2.5 px-3 font-bold">قيمة الفارق</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {products.map(p => {
                    const actual = auditCounts[p.id] !== undefined ? auditCounts[p.id] : p.stock_qty
                    const diff = actual - p.stock_qty
                    const diffCost = diff * p.cost_price

                    return (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2 px-3 font-medium">
                          <div>{p.name_ar}</div>
                          {p.sku && <div className="text-xs text-[var(--clr-muted)]">{p.sku}</div>}
                        </td>
                        <td className="py-2 px-3 font-mono">{p.stock_qty}</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="any"
                            className="input py-1 px-2 w-28 font-bold text-center font-mono"
                            value={actual}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0
                              setAuditCounts(prev => ({ ...prev, [p.id]: val }))
                            }}
                          />
                        </td>
                        <td className={`py-2 px-3 font-mono font-bold ${diff < 0 ? 'text-red-400' : diff > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className={`py-2 px-3 font-mono font-bold ${diffCost < 0 ? 'text-red-400' : diffCost > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {formatEGP(diffCost)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                * لن يتم تعديل أرصدة المستودع الفعلية بل سيتم حفظ تقرير المطابقة للمراجعة الإدارية.
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowAuditModal(false)}>إلغاء</button>
                <button type="submit" className="btn-primary">حفظ تقرير الجرد والمطابقة</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function ProductModal({ brands, categories, editing, onClose, onSave }: any) {
  const isEdit = editing && editing.id
  const [form, setForm] = useState({
    name_ar: isEdit ? (editing?.name_ar ?? '') : '',
    name_en: isEdit ? (editing?.name_en ?? '') : '',
    brand_id: isEdit ? (editing?.brand_id ?? null) : null,
    category_id: isEdit ? (editing?.category_id ?? '') : '',
    sku: editing?.sku ?? '',
    variant_color: isEdit ? (editing?.variant_color ?? '') : '',
    variant_storage: isEdit ? (editing?.variant_storage ?? '') : '',
    variant_ram: isEdit ? (editing?.variant_ram ?? '') : '',
    cost_price: isEdit ? (editing?.cost_price ?? 0) : 0,
    sell_price: isEdit ? (editing?.sell_price ?? 0) : 0,
    stock_qty: isEdit ? (editing?.stock_qty ?? 0) : 0,
    reorder_level: isEdit ? (editing?.reorder_level ?? 5) : 5,
    notes: isEdit ? (editing?.notes ?? '') : '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" style={{ maxWidth: 640 }}>
        <h3 className="text-xl font-bold mb-6">{isEdit ? 'تعديل منتج' : 'إضافة منتج'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">اسم المنتج *</label>
            <input className="input" value={form.name_ar} onChange={e => set('name_ar', e.target.value)} />
          </div>
          <div>
            <label className="label">الماركة</label>
            <select className="input" value={form.brand_id ?? ''} onChange={e => set('brand_id', Number(e.target.value) || null)}>
              <option value="">—</option>
              {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">الفئة *</label>
            <select className="input" value={form.category_id} onChange={e => set('category_id', Number(e.target.value))}>
              <option value="">اختر...</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
          <div><label className="label">كود المنتج (SKU)</label><input className="input" value={form.sku} onChange={e => set('sku', e.target.value)} /></div>
          <div><label className="label">اللون</label><input className="input" value={form.variant_color} onChange={e => set('variant_color', e.target.value)} /></div>
          <div><label className="label">السعة</label><input className="input" value={form.variant_storage} onChange={e => set('variant_storage', e.target.value)} /></div>
          <div><label className="label">الرام</label><input className="input" value={form.variant_ram} onChange={e => set('variant_ram', e.target.value)} /></div>
          <div><label className="label">سعر التكلفة</label><input type="number" step="any" className="input" value={form.cost_price} onChange={e => set('cost_price', parseFloat(e.target.value) || 0)} /></div>
          <div><label className="label">سعر البيع</label><input type="number" step="any" className="input" value={form.sell_price} onChange={e => set('sell_price', parseFloat(e.target.value) || 0)} /></div>
          <div><label className="label">الكمية</label><input type="number" step="any" className="input" value={form.stock_qty} onChange={e => set('stock_qty', parseFloat(e.target.value) || 0)} /></div>
          <div><label className="label">حد الطلب</label><input type="number" step="any" className="input" value={form.reorder_level} onChange={e => set('reorder_level', parseFloat(e.target.value) || 0)} /></div>
          <div className="col-span-2">
            <label className="label">ملاحظات</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" onClick={() => onSave(form)}>حفظ</button>
          <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}
