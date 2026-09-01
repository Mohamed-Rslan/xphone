import { useState, useEffect, useRef } from 'react'
import {
  Plus, Search, Edit2, Upload, Download, History, ClipboardCheck, Trash2,
  AlertOctagon, FileSpreadsheet, Lock, BookOpen, Filter, SlidersHorizontal,
  Calendar, RefreshCw, AlertTriangle, Layers, Tag, ArrowDownUp, CheckCircle, Package, Building2
} from 'lucide-react'
import {
  getProducts, getBrands, getCategories, createProduct, updateProduct,
  getStockMovements, recordDamagedGoods, createInventoryAudit, getInventoryAudits,
  getInventoryLedger
} from '../../lib/commands'
import { formatEGP, formatDateTime, formatDate } from '../../lib/utils'
import {
  downloadProductImportTemplate, importProductsFromExcel, exportInventoryExcel,
  exportInventoryLedgerExcel
} from '../../lib/excel'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

import RecordDamagedGoodsModal from '../../components/RecordDamagedGoodsModal'
import ManageBrandsModal from '../../components/ManageBrandsModal'
import ExportReportModal from '../../components/ExportReportModal'

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
  const [activeTab, setActiveTab] = useState<'products' | 'ledger' | 'movements' | 'audits'>('products')
  const [movements, setMovements] = useState<any[]>([])
  const [audits, setAudits] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showBrandsModal, setShowBrandsModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportModalConfig, setExportModalConfig] = useState<{ title: string; description?: string; onExport: (df: string, dt: string) => Promise<boolean> } | null>(null)

  // Advanced Inventory Filter state
  const [reorderStatusFilter, setReorderStatusFilter] = useState<'all' | 'reorder' | 'out_of_stock' | 'in_stock' | 'low_critical'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedBrand, setSelectedBrand] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'stock_asc' | 'stock_desc' | 'cost_desc' | 'valuation_desc'>('name')

  // Inventory General Ledger state
  const [ledgerReport, setLedgerReport] = useState<any>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerProductId, setLedgerProductId] = useState<string>('all')
  const [ledgerDateFrom, setLedgerDateFrom] = useState<string>('')
  const [ledgerDateTo, setLedgerDateTo] = useState<string>('')

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

  const loadLedger = async () => {
    setLedgerLoading(true)
    try {
      const data = await getInventoryLedger({
        productId: ledgerProductId !== 'all' ? ledgerProductId : undefined,
        date_from: ledgerDateFrom || undefined,
        date_to: ledgerDateTo || undefined,
      })
      setLedgerReport(data)
    } catch (e) {
      toast.error('فشل جلب بيانات دفتر أستاذ المخزون')
    } finally {
      setLedgerLoading(false)
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
    } else if (activeTab === 'ledger') {
      loadLedger()
    }
  }, [activeTab, ledgerProductId, ledgerDateFrom, ledgerDateTo])

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

  // Filter & Sort Products
  const filteredProducts = products.filter(p => {
    const q = search.toLowerCase().trim()
    const matchesSearch = !q ||
      p.name_ar?.toLowerCase().includes(q) ||
      p.name_en?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.brand_name?.toLowerCase().includes(q) ||
      p.category_name?.toLowerCase().includes(q)

    const minLevel = p.reorder_level || 5
    let matchesReorder = true
    if (reorderStatusFilter === 'reorder') {
      matchesReorder = p.stock_qty <= minLevel && p.stock_qty > 0
    } else if (reorderStatusFilter === 'out_of_stock') {
      matchesReorder = p.stock_qty <= 0
    } else if (reorderStatusFilter === 'in_stock') {
      matchesReorder = p.stock_qty > minLevel
    } else if (reorderStatusFilter === 'low_critical') {
      matchesReorder = p.stock_qty <= 2
    }

    let matchesCategory = true
    if (selectedCategory !== 'all') {
      matchesCategory = String(p.category_id) === String(selectedCategory)
    }

    let matchesBrand = true
    if (selectedBrand !== 'all') {
      matchesBrand = String(p.brand_id) === String(selectedBrand)
    }

    return matchesSearch && matchesReorder && matchesCategory && matchesBrand
  }).sort((a, b) => {
    if (sortBy === 'stock_asc') return a.stock_qty - b.stock_qty
    if (sortBy === 'stock_desc') return b.stock_qty - a.stock_qty
    if (sortBy === 'cost_desc') return b.cost_price - a.cost_price
    if (sortBy === 'valuation_desc') return (b.stock_qty * b.cost_price) - (a.stock_qty * a.cost_price)
    return a.name_ar.localeCompare(b.name_ar, 'ar')
  })

  // Stock KPI Summary
  const totalStockQty = products.reduce((sum, p) => sum + (p.stock_qty > 0 ? p.stock_qty : 0), 0)
  const totalStockValuation = products.reduce((sum, p) => sum + (p.stock_qty > 0 ? p.stock_qty * p.cost_price : 0), 0)
  const reorderCount = products.filter(p => p.stock_qty <= (p.reorder_level || 5) && p.stock_qty > 0).length
  const outOfStockCount = products.filter(p => p.stock_qty <= 0).length

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
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      <div className="page-header flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-3">
            المخزون وجودة المستودع
          </h1>
          <p className="text-xs text-[var(--clr-muted)] mt-0.5">
            إدارة أصناف المخزون السلعي، التقييم المحاسبي، ودفتر أستاذ حركة الأصناف المعتمد
          </p>
        </div>
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
                className="btn-secondary flex items-center gap-2 font-bold text-red-400 border-red-500/40 hover:bg-red-500/10 cursor-pointer shadow-sm text-xs py-2"
                title="تسجيل بضاعة تالفة أو هالكة واستبعادها من المخزون"
              >
                <Trash2 size={15} />
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
                className="btn-secondary flex items-center gap-2 font-bold text-xs py-2"
                style={{ borderColor: 'var(--clr-accent)', color: 'var(--clr-accent)' }}
              >
                <ClipboardCheck size={15} />
                جرد المخزون المقارن
              </button>
            )}
            <button
              onClick={() => {
                setExportModalConfig({
                  title: 'تصدير تقرير قائمة المخزون والأصناف السلعية لـ Excel',
                  description: 'اختر الفترة الزمنية لتوليد تقرير الأصناف، الكميات بالمخزن، حد الطلب، والتقييم السلعي التراكمي',
                  onExport: async () => {
                    return await exportInventoryExcel(products, brands, categories)
                  }
                })
                setShowExportModal(true)
              }}
              className="btn-secondary flex items-center gap-2 font-bold cursor-pointer text-xs py-2"
              title="تصدير بيانات المخزون لملف Excel"
            >
              <FileSpreadsheet size={15} className="text-emerald-400" />
              تصدير لـ Excel
            </button>
            {canEdit && (
              <button
                onClick={() => setShowBrandsModal(true)}
                className="btn-secondary flex items-center gap-2 font-bold text-xs py-2"
                style={{ borderColor: 'var(--clr-primary)', color: 'var(--clr-primary)' }}
                title="إضافة وتعديل وإدارة الماركات والشركات المصنعة"
              >
                <Building2 size={15} />
                إدارة الماركات والشركات
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-2 text-xs py-2"
              >
                <Upload size={15} />
                استيراد Excel
              </button>
            )}
            {canEdit && (
              <button id="add-product-btn" className="btn-primary text-xs py-2" onClick={() => { setEditing(null); setShowModal(true) }}>
                <Plus size={15} /> إضافة منتج جديد
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-2 flex-wrap" style={{ borderColor: 'var(--clr-border)' }}>
        <button
          onClick={() => setActiveTab('products')}
          className={`badge cursor-pointer px-4 py-2.5 text-xs font-bold transition-all duration-200 border-0 flex items-center gap-2 ${
            activeTab === 'products' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <Package size={15} />
          قائمة المنتجات والفلترة المتقدمة ({filteredProducts.length})
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`badge cursor-pointer px-4 py-2.5 text-xs font-bold transition-all duration-200 border-0 flex items-center gap-2 ${
            activeTab === 'ledger' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <BookOpen size={15} className="text-amber-400" />
          دفتر أستاذ المخزون (المعايير المحاسبية)
        </button>

        <button
          onClick={() => setActiveTab('audits')}
          className={`badge cursor-pointer px-4 py-2.5 text-xs font-bold transition-all duration-200 border-0 flex items-center gap-2 ${
            activeTab === 'audits' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <ClipboardCheck size={15} />
          تقارير الجرد والمطابقة ({audits.length})
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`badge cursor-pointer px-4 py-2.5 text-xs font-bold transition-all duration-200 border-0 flex items-center gap-2 ${
            activeTab === 'movements' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <History size={15} />
          سجّلات حركة المخزن التفصيلية
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: PRODUCTS LIST & ADVANCED FILTERING */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <>
          {/* Inventory KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card px-3 py-1.5 flex flex-col justify-between border-r-4 border-r-indigo-500 h-[56px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--clr-muted)] flex items-center gap-1">
                  <Package size={13} className="text-indigo-400" /> إجمالي المنتجات والكمية
                </span>
                <span className="text-[10px] font-bold font-mono text-indigo-300">{totalStockQty} قطعة</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold font-mono text-[var(--clr-text)]">{products.length} صنف</span>
              </div>
            </div>

            <div
              className={`glass-card px-3 py-1.5 flex flex-col justify-between border-r-4 border-r-amber-500 cursor-pointer transition-transform hover:scale-[1.01] h-[56px] ${
                reorderStatusFilter === 'reorder' ? 'ring-2 ring-amber-500' : ''
              }`}
              onClick={() => setReorderStatusFilter(prev => prev === 'reorder' ? 'all' : 'reorder')}
              title="انقر لتصفية المنتجات التي تحتاج لإعادة طلب"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={13} /> بحاجة لطلب (نواقص)
                </span>
                <span className="text-[10px] underline text-amber-300/80 font-bold">تصفية ⚠️</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold font-mono text-amber-400">{reorderCount} صنف</span>
              </div>
            </div>

            <div
              className={`glass-card px-3 py-1.5 flex flex-col justify-between border-r-4 border-r-rose-500 cursor-pointer transition-transform hover:scale-[1.01] h-[56px] ${
                reorderStatusFilter === 'out_of_stock' ? 'ring-2 ring-rose-500' : ''
              }`}
              onClick={() => setReorderStatusFilter(prev => prev === 'out_of_stock' ? 'all' : 'out_of_stock')}
              title="انقر لتصفية المنتجات المنتهية تماماً من المخزن"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                  <AlertOctagon size={13} /> نفد من المخزن (0)
                </span>
                <span className="text-[10px] underline text-rose-300/80 font-bold">تصفية 🔴</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold font-mono text-rose-400">{outOfStockCount} صنف</span>
              </div>
            </div>

            <div className="glass-card px-3 py-1.5 flex flex-col justify-between border-r-4 border-r-emerald-500 h-[56px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <FileSpreadsheet size={13} /> تقييم المخزون (التكلفة)
                </span>
                <span className="text-[10px] font-bold text-emerald-300/80">إجمالي</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold font-mono text-emerald-400">{formatEGP(totalStockValuation)}</span>
              </div>
            </div>
          </div>

          {/* Advanced Filter Bar */}
          <div className="glass-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: 'var(--clr-border)' }}>
              <span className="font-bold text-xs flex items-center gap-2 text-[var(--clr-text)]">
                <SlidersHorizontal size={15} className="text-[var(--clr-primary)]" />
                نظام فلترة وتصنيف المخزون المتقدم
              </span>
              {(reorderStatusFilter !== 'all' || selectedCategory !== 'all' || selectedBrand !== 'all' || search !== '' || sortBy !== 'name') && (
                <button
                  type="button"
                  className="text-xs text-rose-400 hover:underline font-bold cursor-pointer flex items-center gap-1"
                  onClick={() => {
                    setSearch('')
                    setReorderStatusFilter('all')
                    setSelectedCategory('all')
                    setSelectedBrand('all')
                    setSortBy('name')
                  }}
                >
                  <RefreshCw size={12} /> إلغاء الفلاتر
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
                <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-[var(--clr-muted)]" />
                <input
                  className="input text-xs py-2 pr-9 w-full"
                  placeholder="اسم الصنف / SKU / الباركود..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Reorder / Stock Status */}
              <div>
                <select
                  className="input text-xs py-2 font-bold w-full"
                  value={reorderStatusFilter}
                  onChange={e => setReorderStatusFilter(e.target.value as any)}
                >
                  <option value="all">📦 كل حالات الطلب والكمية</option>
                  <option value="reorder">⚠️ بحاجة لإعادة الطلب (نواقص)</option>
                  <option value="out_of_stock">🔴 نفد من المخزن (0 قطعة)</option>
                  <option value="in_stock">🟢 متوفر بكمية كافية</option>
                  <option value="low_critical">📉 كمية منخفضة جداً (≤ 2)</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <select
                  className="input text-xs py-2 font-bold w-full"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="all">🏷️ كل التصنيفات والفئات</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name_ar}</option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div>
                <select
                  className="input text-xs py-2 font-bold w-full"
                  value={selectedBrand}
                  onChange={e => setSelectedBrand(e.target.value)}
                >
                  <option value="all">📱 كل الماركات والشركات</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Sorting */}
              <div>
                <select
                  className="input text-xs py-2 font-bold w-full"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                >
                  <option value="name">🔤 ترتيب: اسم الصنف</option>
                  <option value="stock_asc">⬆️ الكمية: من الأقل للأعلى</option>
                  <option value="stock_desc">⬇️ الكمية: من الأعلى للأقل</option>
                  <option value="cost_desc">🏷️ التكلفة: الأكثر ارتفاعاً</option>
                  <option value="valuation_desc">💰 تقييم المخزون (الأعلى قيمة)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Products Data Table */}
          <div className="glass-card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم الصنف والرمز</th>
                  <th>الماركة</th>
                  <th>الفئة</th>
                  <th>سعر التكلفة</th>
                  <th>سعر البيع</th>
                  <th>الكمية بالمخزن</th>
                  <th>تقييم الصنف (التكلفة)</th>
                  <th>حالة الطلب</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => {
                  const minLevel = p.reorder_level || 5
                  const isOutOfStock = p.stock_qty <= 0
                  const isReorderNeeded = p.stock_qty <= minLevel && p.stock_qty > 0
                  const totalLineValuation = Math.max(0, p.stock_qty) * p.cost_price

                  return (
                    <tr key={p.id} className={isOutOfStock ? 'bg-rose-500/5' : isReorderNeeded ? 'bg-amber-500/5' : ''}>
                      <td>
                        <div className="font-bold text-sm text-[var(--clr-text)]">{p.name_ar}</div>
                        {p.sku && <div className="text-xs font-mono text-[var(--clr-muted)]">{p.sku}</div>}
                      </td>
                      <td><span dir="ltr" className="text-xs font-semibold">{p.brand_name ?? '—'}</span></td>
                      <td><span className="text-xs">{p.category_name}</span></td>
                      <td className="font-mono text-xs">{formatEGP(p.cost_price)}</td>
                      <td className="font-bold font-mono text-xs" style={{ color: 'var(--clr-primary)' }}>{formatEGP(p.sell_price)}</td>
                      <td>
                        <span className={`badge font-mono font-bold ${isOutOfStock ? 'badge-danger' : isReorderNeeded ? 'badge-warning' : 'badge-success'}`}>
                          {p.stock_qty} قطعة
                        </span>
                      </td>
                      <td className="font-mono text-xs font-bold text-emerald-400">
                        {formatEGP(totalLineValuation)}
                      </td>
                      <td>
                        {isOutOfStock ? (
                          <span className="badge badge-danger text-[10px] font-bold">🔴 نفد من المخزن</span>
                        ) : isReorderNeeded ? (
                          <span className="badge badge-warning text-[10px] font-bold">⚠️ بحاجة لطلب</span>
                        ) : (
                          <span className="badge badge-success text-[10px] font-bold">🟢 متوفر بكثرة</span>
                        )}
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
                  )
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[var(--clr-muted)] text-sm">
                      لا توجد منتجات تطابق شروط الفلترة المحددة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: INVENTORY GENERAL LEDGER (دفتر أستاذ المخزون حسب المعايير المحاسبية) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'ledger' && (
        <div className="flex flex-col gap-6">
          {/* Ledger Filter Options Bar */}
          <div className="glass-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2 text-[var(--clr-text)]">
                  <BookOpen size={20} className="text-amber-400" />
                  دفتر أستاذ المخزون السلعي (Inventory General Ledger - IAS 2)
                </h3>
                <p className="text-xs text-[var(--clr-muted)] mt-0.5">
                  سجل محاسبي كامل لتتبع حركات الإضافة والصرف المخزني، التكلفة، وإجمالي التقييم المخزني التراكمي
                </p>
              </div>
              <button
                type="button"
                className="btn-primary text-xs py-2 px-4 font-bold flex items-center gap-2 cursor-pointer shadow-md"
                onClick={() => {
                  setExportModalConfig({
                    title: 'تصدير دفتر أستاذ المخزون المحاسبي (IAS 2 Ledger) لـ Excel',
                    description: 'اختر الفترة الزمنية لتفريق سجل حركات الصرف والتوريد والتكلفة ورصيد التقييم التراكمي',
                    onExport: async (df, dt) => {
                      const selectedProd = products.find(p => p.id === ledgerProductId)
                      const prodName = selectedProd ? selectedProd.name_ar : 'جميع الأصناف'
                      const ledgerData = await getInventoryLedger({
                        productId: ledgerProductId !== 'all' ? ledgerProductId : undefined,
                        date_from: df,
                        date_to: dt,
                      })
                      return await exportInventoryLedgerExcel(ledgerData, prodName, df, dt)
                    }
                  })
                  setShowExportModal(true)
                }}
              >
                <FileSpreadsheet size={16} /> تصدير دفتر الأستاذ لـ Excel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="label font-bold text-xs">تحديد الصنف / المنتج:</label>
                <select
                  className="input text-xs py-2 font-bold w-full"
                  value={ledgerProductId}
                  onChange={e => setLedgerProductId(e.target.value)}
                >
                  <option value="all">📦 جميع الأصناف والمنتجات</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name_ar} {p.sku ? `(${p.sku})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label font-bold text-xs">من تاريخ:</label>
                <input
                  type="date"
                  className="input text-xs py-2 w-full font-bold"
                  value={ledgerDateFrom}
                  onChange={e => setLedgerDateFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="label font-bold text-xs">إلى تاريخ:</label>
                <input
                  type="date"
                  className="input text-xs py-2 w-full font-bold"
                  value={ledgerDateTo}
                  onChange={e => setLedgerDateTo(e.target.value)}
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs py-2.5 px-4 font-bold flex-1 cursor-pointer flex items-center justify-center gap-1.5"
                  onClick={loadLedger}
                >
                  <RefreshCw size={14} className={ledgerLoading ? 'animate-spin' : ''} />
                  تحديث البيانات
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs py-2.5 px-3 font-bold cursor-pointer text-rose-400 border-rose-500/30"
                  onClick={() => {
                    setLedgerProductId('all')
                    setLedgerDateFrom('')
                    setLedgerDateTo('')
                  }}
                  title="مسح خيارات البحث"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>

          {/* IAS 2 Valuation Summary Cards */}
          {ledgerReport && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card px-3 py-1.5 flex flex-col justify-between border-r-4 border-r-blue-500 h-[56px]">
                <span className="text-[11px] font-bold text-[var(--clr-muted)]">إجمالي تقييم المخزون (التكلفة)</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold font-mono text-blue-400">
                    {formatEGP(ledgerReport.summary.total_inventory_valuation)}
                  </span>
                  <span className="text-[10px] text-[var(--clr-muted)] font-mono font-bold">
                    {ledgerReport.summary.total_inventory_qty} قطعة
                  </span>
                </div>
              </div>

              <div className="glass-card px-3 py-1.5 flex flex-col justify-between border-r-4 border-r-emerald-500 h-[56px]">
                <span className="text-[11px] font-bold text-[var(--clr-muted)]">إجمالي الوارد بالفترة (+)</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    +{ledgerReport.summary.period_in_qty} قطعة
                  </span>
                  <span className="text-[10px] text-emerald-300 font-mono font-bold">
                    {formatEGP(ledgerReport.summary.period_in_val)}
                  </span>
                </div>
              </div>

              <div className="glass-card px-3 py-1.5 flex flex-col justify-between border-r-4 border-r-rose-500 h-[56px]">
                <span className="text-[11px] font-bold text-[var(--clr-muted)]">إجمالي المنصرف بالفترة (-)</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold font-mono text-rose-400">
                    -{ledgerReport.summary.period_out_qty} قطعة
                  </span>
                  <span className="text-[10px] text-rose-300 font-mono font-bold">
                    {formatEGP(ledgerReport.summary.period_out_val)}
                  </span>
                </div>
              </div>

              <div className="glass-card px-3 py-1.5 flex flex-col justify-between border-r-4 border-r-amber-500 h-[56px]">
                <span className="text-[11px] font-bold text-[var(--clr-muted)]">الأصناف المحتاجة لطلب</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold font-mono text-amber-400">
                    {ledgerReport.summary.reorder_needed_count} صنف
                  </span>
                  <span className="text-[10px] text-rose-400 font-mono font-bold">
                    {ledgerReport.summary.out_of_stock_count} نفد
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b font-bold text-sm flex items-center justify-between" style={{ borderColor: 'var(--clr-border)' }}>
              <span>جدول حركات دفتر أستاذ المخزون المحاسبي</span>
              {ledgerReport && <span className="text-xs font-mono text-[var(--clr-muted)]">عدد الحركات: {ledgerReport.items.length}</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th>التاريخ والوقت</th>
                    <th>اسم الصنف</th>
                    <th>نوع الحركة المحاسبية</th>
                    <th>المرجع/الفاتورة</th>
                    <th>البيان والسبب</th>
                    <th>سعر التكلفة</th>
                    <th>الكمية الواردة (+)</th>
                    <th>قيمة الوارد</th>
                    <th>الكمية المنصرفة (-)</th>
                    <th>قيمة المنصرف</th>
                    <th>رصيد الكمية</th>
                    <th>التقييم المخزني التراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerReport && ledgerReport.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="font-mono text-[11px] text-[var(--clr-muted)]">{formatDateTime(item.created_at)}</td>
                      <td>
                        <div className="font-bold text-xs text-[var(--clr-text)]">{item.product_name}</div>
                        {item.sku && <div className="text-[10px] font-mono text-[var(--clr-muted)]">{item.sku}</div>}
                      </td>
                      <td>
                        <span className={`badge ${item.qty_in > 0 ? 'badge-success' : 'badge-danger'}`}>
                          {item.movement_type_ar}
                        </span>
                      </td>
                      <td className="font-mono">{item.ref_id || '—'}</td>
                      <td><span className="text-[11px] text-[var(--clr-muted)]">{item.reason || '—'}</span></td>
                      <td className="font-mono">{formatEGP(item.unit_cost)}</td>
                      <td className="font-mono font-bold text-emerald-400">
                        {item.qty_in > 0 ? `+${item.qty_in}` : '—'}
                      </td>
                      <td className="font-mono text-emerald-400">
                        {item.val_in > 0 ? formatEGP(item.val_in) : '—'}
                      </td>
                      <td className="font-mono font-bold text-rose-400">
                        {item.qty_out > 0 ? `-${item.qty_out}` : '—'}
                      </td>
                      <td className="font-mono text-rose-400">
                        {item.val_out > 0 ? formatEGP(item.val_out) : '—'}
                      </td>
                      <td className="font-mono font-bold text-indigo-400">
                        {item.qty_balance}
                      </td>
                      <td className="font-mono font-bold text-amber-400">
                        {formatEGP(item.total_valuation_balance)}
                      </td>
                    </tr>
                  ))}
                  {(!ledgerReport || ledgerReport.items.length === 0) && (
                    <tr>
                      <td colSpan={12} className="text-center py-12 text-[var(--clr-muted)] text-sm">
                        {ledgerLoading ? 'جاري تحميل دفتر أستاذ المخزون...' : 'لا توجد حركات مخزنية مسجلة للفترة المحددة'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: INVENTORY AUDITS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
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
              className="btn-primary flex items-center gap-2 text-xs py-2"
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
                    <tbody>
                      {audit.items?.map((item: any) => (
                        <tr key={item.id} className="border-b border-white/5">
                          <td className="py-2 px-2 font-medium">{item.product_name}</td>
                          <td className="py-2 px-2 font-mono">{item.system_qty}</td>
                          <td className="py-2 px-2 font-mono font-bold">{item.actual_qty}</td>
                          <td className={`py-2 px-2 font-mono font-bold ${item.variance_qty < 0 ? 'text-red-400' : item.variance_qty > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {item.variance_qty > 0 ? `+${item.variance_qty}` : item.variance_qty}
                          </td>
                          <td className="py-2 px-2 font-mono">{formatEGP(item.unit_cost)}</td>
                          <td className={`py-2 px-2 font-mono font-bold ${item.variance_cost < 0 ? 'text-red-400' : item.variance_cost > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {formatEGP(item.variance_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {audits.length === 0 && (
              <div className="glass-card text-center py-12 text-[var(--clr-muted)] text-sm">
                لا توجد جلسات جرد ومطابقة سابقة
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: MOVEMENTS LOG */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'movements' && (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>اسم المنتج</th>
                <th>نوع الحركة</th>
                <th>تغيير الكمية</th>
                <th>الكمية قبل</th>
                <th>الكمية بعد</th>
                <th>البيان / السبب</th>
                <th>المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id}>
                  <td className="font-mono text-xs">{formatDateTime(m.created_at)}</td>
                  <td className="font-semibold text-xs">{m.product_name}</td>
                  <td>
                    <span className={`badge ${getMovementTypeClass(m.type)}`}>
                      {getMovementTypeLabel(m.type)}
                    </span>
                  </td>
                  <td className={`font-mono font-bold ${m.qty_change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                  </td>
                  <td className="font-mono text-xs">{m.qty_before}</td>
                  <td className="font-mono font-bold text-xs text-indigo-400">{m.qty_after}</td>
                  <td className="text-xs text-[var(--clr-muted)]">{m.reason || '—'}</td>
                  <td className="text-xs">{m.user_display_name || '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[var(--clr-muted)] text-sm">
                    لا توجد سجلات حركة مخزنية
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
            if (activeTab === 'movements') loadMovements()
            if (activeTab === 'ledger') loadLedger()
          }}
        />
      )}

      {/* Export Sub-Modal */}
      {showExportModal && exportModalConfig && (
        <ExportReportModal
          title={exportModalConfig.title}
          description={exportModalConfig.description}
          onClose={() => {
            setShowExportModal(false)
            setExportModalConfig(null)
          }}
          onExport={exportModalConfig.onExport}
        />
      )}

      {/* Manage Brands Modal */}
      {showBrandsModal && (
        <ManageBrandsModal
          onClose={() => setShowBrandsModal(false)}
          onBrandsUpdated={async () => {
            const b = await getBrands()
            setBrands(b)
          }}
        />
      )}

      {/* Product Add/Edit Modal & Audit Modal JSX */}
      {showModal && (
        <ProductModal
          product={editing}
          brands={brands}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            load()
          }}
          onManageBrands={() => setShowBrandsModal(true)}
        />
      )}

      {showAuditModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAuditModal(false) }}>
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <h3 className="font-bold text-lg">بدء جلسة جرد ومطابقة المخزون</h3>
              <button className="btn-icon" onClick={() => setShowAuditModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveAudit} className="flex flex-col gap-4">
              <div>
                <label className="label font-bold text-xs">عنوان أو معرف الجلسة *</label>
                <input
                  className="input font-bold"
                  value={auditTitle}
                  onChange={e => setAuditTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label font-bold text-xs">ملاحظات وقرارات الجلسة</label>
                <input
                  className="input text-xs"
                  placeholder="مثال: جرد نهاية الشهر لمستودع الهواتف والإكسسوارات"
                  value={auditNotes}
                  onChange={e => setAuditNotes(e.target.value)}
                />
              </div>

              <div className="max-h-[350px] overflow-y-auto border rounded-xl" style={{ borderColor: 'var(--clr-border)' }}>
                <table className="w-full text-right text-xs">
                  <thead className="sticky top-0 bg-[var(--clr-surface-2)] border-b" style={{ borderColor: 'var(--clr-border)' }}>
                    <tr>
                      <th className="py-2.5 px-3 font-bold">اسم المنتج</th>
                      <th className="py-2.5 px-3 font-bold">رصيد النظام</th>
                      <th className="py-2.5 px-3 font-bold">العد الفعلي المخزني</th>
                      <th className="py-2.5 px-3 font-bold">الفارق الحسابي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const actual = auditCounts[p.id] !== undefined ? auditCounts[p.id] : p.stock_qty
                      const diff = actual - p.stock_qty
                      return (
                        <tr key={p.id} className="border-b border-white/5">
                          <td className="py-2 px-3">
                            <div className="font-bold">{p.name_ar}</div>
                            {p.sku && <div className="text-[10px] text-[var(--clr-muted)]">{p.sku}</div>}
                          </td>
                          <td className="py-2 px-3 font-mono">{p.stock_qty}</td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              className="input py-1 px-2 font-mono text-xs font-bold text-center w-24"
                              value={actual}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 0
                                setAuditCounts(prev => ({ ...prev, [p.id]: val }))
                              }}
                            />
                          </td>
                          <td className={`py-2 px-3 font-mono font-bold ${diff < 0 ? 'text-red-400' : diff > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: 'var(--clr-border)' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAuditModal(false)}>إلغاء</button>
                <button type="submit" className="btn-primary">حفظ تقرير مطابقة الجرد 💾</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductModal({ product, brands, categories, onClose, onSuccess, onManageBrands }: any) {
  const [form, setForm] = useState({
    sku: product?.sku || '',
    name_ar: product?.name_ar || '',
    name_en: product?.name_en || '',
    brand_id: product?.brand_id || '',
    category_id: product?.category_id || categories[0]?.id || 1,
    cost_price: product?.cost_price || 0,
    sell_price: product?.sell_price || 0,
    stock_qty: product?.stock_qty || 0,
    reorder_level: product?.reorder_level || 5,
    notes: product?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name_ar) { toast.error('أدخل اسم المنتج'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        brand_id: form.brand_id ? Number(form.brand_id) : undefined,
        category_id: Number(form.category_id),
        cost_price: Number(form.cost_price),
        sell_price: Number(form.sell_price),
        stock_qty: Number(form.stock_qty),
        reorder_level: form.reorder_level ? Number(form.reorder_level) : undefined,
      }
      if (product) {
        await updateProduct(product.id, payload)
        toast.success('تم تحديث بيانات المنتج بنجاح')
      } else {
        await createProduct(payload)
        toast.success('تم إضافة المنتج بنجاح')
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.toString())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
          <h3 className="font-bold text-lg">{product ? 'تعديل بيانات صنف' : 'إضافة صنف جديد للمخزون'}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label font-bold text-xs">اسم المنتج (بالعربية) *</label>
            <input
              className="input font-bold"
              value={form.name_ar}
              onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold text-xs">الكود / الباركود SKU</label>
              <input
                className="input font-mono text-xs"
                placeholder="أدخل أو امسح الباركود..."
                value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
              />
            </div>
            <div>
              <label className="label font-bold text-xs">الفئة / التصنيف *</label>
              <select
                className="input text-xs font-bold"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: Number(e.target.value) }))}
              >
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name_ar}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label font-bold text-xs mb-0">الماركة / الشركة المصنعة</label>
                {onManageBrands && (
                  <button
                    type="button"
                    className="text-[11px] text-[var(--clr-primary)] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    onClick={onManageBrands}
                  >
                    <Plus size={12} /> إدارة الماركات
                  </button>
                )}
              </div>
              <select
                className="input text-xs font-bold"
                value={form.brand_id}
                onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}
              >
                <option value="">بدون تحديد</option>
                {brands.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label font-bold text-xs">حد إعادة الطلب (النواقص)</label>
              <input
                type="number"
                className="input font-mono text-xs"
                value={form.reorder_level}
                onChange={e => setForm(f => ({ ...f, reorder_level: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label font-bold text-xs">سعر التكلفة (ج.م) *</label>
              <input
                type="number"
                className="input font-mono font-bold text-xs"
                value={form.cost_price}
                onChange={e => setForm(f => ({ ...f, cost_price: Number(e.target.value) }))}
                required
              />
            </div>
            <div>
              <label className="label font-bold text-xs">سعر البيع (ج.م) *</label>
              <input
                type="number"
                className="input font-mono font-bold text-xs text-[var(--clr-primary)]"
                value={form.sell_price}
                onChange={e => setForm(f => ({ ...f, sell_price: Number(e.target.value) }))}
                required
              />
            </div>
            <div>
              <label className="label font-bold text-xs">الكمية الأولية بالسلة</label>
              <input
                type="number"
                className="input font-mono font-bold text-xs text-emerald-400"
                value={form.stock_qty}
                onChange={e => setForm(f => ({ ...f, stock_qty: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div>
            <label className="label font-bold text-xs">ملاحظات ومواصفات الصنف</label>
            <input
              className="input text-xs"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--clr-border)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ المنتج'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
