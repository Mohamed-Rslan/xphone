import { useState, useEffect } from 'react'
import {
  Plus, Search, Truck, Eye, Edit, FileText,
  RotateCcw, DollarSign, PackagePlus, AlertCircle,
  TrendingDown, CheckCircle2, Building2, Wallet, X,
  ArrowDownRight, ArrowUpRight, PlusCircle, Tag, ShoppingBag, Sparkles, FileSpreadsheet
} from 'lucide-react'
import {
  getSuppliers, createSupplier, updateSupplier,
  getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder,
  getProducts, createProduct, getBrands, getCategories,
  getPurchaseOrderItems, recordPurchaseInvoice,
  recordPurchaseReturn, getPurchaseReturns, getFinancialAccounts
} from '../../lib/commands'
import { formatEGP, formatDate, formatDateTime, today } from '../../lib/utils'
import { exportPeriodPurchasesReport } from '../../lib/excel'
import ExportReportModal from '../../components/ExportReportModal'
import SettleSupplierInvoicesModal from '../../components/SettleSupplierInvoicesModal'
import toast from 'react-hot-toast'

export default function SuppliersPage() {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'invoices' | 'returns' | 'orders'>('suppliers')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showExportPurchasesModal, setShowExportPurchasesModal] = useState(false)
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [settleSupplierId, setSettleSupplierId] = useState<string | undefined>(undefined)
  const [showDetailsModal, setShowDetailsModal] = useState<any>(null)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [selectedPO, setSelectedPO] = useState<any>(null)
  const [poDetailsItems, setPoDetailsItems] = useState<any[]>([])

  const loadData = async () => {
    try {
      const sup = await getSuppliers().catch(() => [])
      setSuppliers(sup || [])
    } catch (e) {}

    try {
      const po = await getPurchaseOrders().catch(() => [])
      setPurchaseOrders(po || [])
    } catch (e) {}

    try {
      const ret = await getPurchaseReturns().catch(() => [])
      setPurchaseReturns(ret || [])
    } catch (e) {}

    try {
      const prod = await getProducts().catch(() => [])
      setProducts(prod || [])
    } catch (e) {}

    try {
      const acc = await getFinancialAccounts().catch(() => [])
      setFinancialAccounts(acc || [])
    } catch (e) {}

    try {
      const cat = await getCategories().catch(() => [])
      setCategories(cat || [])
    } catch (e) {}

    try {
      const br = await getBrands().catch(() => [])
      setBrands(br || [])
    } catch (e) {}
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenPODetails = async (po: any) => {
    try {
      setSelectedPO(po)
      const items = await getPurchaseOrderItems(po.id)
      setPoDetailsItems(items)
      setShowDetailsModal(true)
    } catch (e) {
      toast.error('فشل تحميل تفاصيل الفاتورة')
    }
  }

  const handleSaveSupplier = async (supplierData: any) => {
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, supplierData)
        toast.success('تم تعديل بيانات المورد بنجاح')
      } else {
        await createSupplier(supplierData)
        toast.success('تمت إضافة المورد بنجاح')
      }
      setShowSupplierModal(false)
      setEditingSupplier(null)
      loadData()
    } catch (e: any) {
      toast.error('حدث خطأ أثناء الحفظ')
    }
  }

  const totalSupplierDebts = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0)
  const totalInvoicesValue = purchaseOrders.reduce((sum, p) => sum + (p.total_cost || 0), 0)
  const totalReturnsValue = purchaseReturns.reduce((sum, r) => sum + (r.total_amount || 0), 0)

  const filteredSuppliers = suppliers.filter(
    s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
         (s.phone && s.phone.includes(searchQuery))
  )

  const filteredInvoices = purchaseOrders.filter(
    p => p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         (p.invoice_no && p.invoice_no.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredReturns = purchaseReturns.filter(
    r => r.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         (r.reason && r.reason.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      {/* Header */}
      <div className="page-header flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Truck className="text-[var(--clr-primary)]" size={28} />
            إدارة الموردين والمشتريات
          </h1>
          <p className="text-sm text-[var(--clr-muted)]">
            تسجيل فواتير الشراء بنظام LIFO • تسوية المخزون • حسابات الموردين والخزينة • مرتجعات الشراء
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSettleSupplierId(undefined)
              setShowSettleModal(true)
            }}
            className="btn-secondary flex items-center gap-2 font-bold cursor-pointer text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/10 shadow-sm"
            title="سداد وتسوية مستحقات وفواتير المشتريات الآجلة للموردين"
          >
            <Wallet size={16} />
            سداد مستحقات الموردين
          </button>

          <button
            type="button"
            onClick={() => setShowExportPurchasesModal(true)}
            className="btn-secondary flex items-center gap-2 font-bold cursor-pointer text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 shadow-sm"
            title="استخراج تقرير إكسيل بفواتير وتوريدات المشتريات لفترة محددة مع الإجماليات"
          >
            <FileSpreadsheet size={16} />
            تصدير تقرير المشتريات لـ Excel
          </button>

          <button
            id="add-purchase-invoice-btn"
            onClick={() => setShowInvoiceModal(true)}
            className="btn-primary flex items-center gap-2 font-bold shadow-lg"
          >
            <PackagePlus size={18} /> إضافة فاتورة شراء
          </button>

          <button
            id="add-purchase-return-btn"
            onClick={() => setShowReturnModal(true)}
            className="btn-secondary flex items-center gap-2 font-bold border-[var(--clr-warning)]/40 text-[var(--clr-warning)] hover:bg-[var(--clr-warning)]/10"
          >
            <RotateCcw size={18} /> تسجيل مرتجع شراء
          </button>

          <button
            id="add-supplier-btn"
            onClick={() => {
              setEditingSupplier(null)
              setShowSupplierModal(true)
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus size={16} /> إضافة مورد
          </button>
        </div>
      </div>

      {showExportPurchasesModal && (
        <ExportReportModal
          title="استخراج تقرير فواتير المشتريات لـ Excel"
          description="حدد الفترة الزمنية لتوليد تقرير تفصيلي بفواتير المشتريات وتوريدات الموردين والمسدد والآجل مع الإجماليات"
          onClose={() => setShowExportPurchasesModal(false)}
          onExport={exportPeriodPurchasesReport}
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-label">مستحقات الموردين (التزامات متداولة)</div>
          <div className="kpi-value text-[var(--clr-danger)]" style={{ fontSize: '1.6rem' }}>
            {formatEGP(totalSupplierDebts)}
          </div>
          <div className="text-xs text-[var(--clr-muted)] mt-1">{suppliers.length} مورد مسجل</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">إجمالي فواتير المشتريات</div>
          <div className="kpi-value text-[var(--clr-primary)]" style={{ fontSize: '1.6rem' }}>
            {formatEGP(totalInvoicesValue)}
          </div>
          <div className="text-xs text-[var(--clr-muted)] mt-1">{purchaseOrders.length} فاتورة مسجلة</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">إجمالي مرتجعات الشراء</div>
          <div className="kpi-value text-[var(--clr-warning)]" style={{ fontSize: '1.6rem' }}>
            {formatEGP(totalReturnsValue)}
          </div>
          <div className="text-xs text-[var(--clr-muted)] mt-1">{purchaseReturns.length} عملية إرجاع</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">طريقة تقييم المخزون</div>
          <div className="kpi-value text-emerald-400" style={{ fontSize: '1.3rem' }}>
            نظام LIFO نشط
          </div>
          <div className="text-xs text-[var(--clr-muted)] mt-1">تحديث سعر الصنف بآخر شراء</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-2" style={{ borderColor: 'var(--clr-border)' }}>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`badge cursor-pointer px-4 py-2.5 text-sm font-bold transition-all border-0 ${
            activeTab === 'suppliers' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <Building2 size={16} className="inline ml-1.5" />
          قائمة الموردين والمستحقات ({suppliers.length})
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`badge cursor-pointer px-4 py-2.5 text-sm font-bold transition-all border-0 ${
            activeTab === 'invoices' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <FileText size={16} className="inline ml-1.5" />
          فواتير المشتريات ({purchaseOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('returns')}
          className={`badge cursor-pointer px-4 py-2.5 text-sm font-bold transition-all border-0 ${
            activeTab === 'returns' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <RotateCcw size={16} className="inline ml-1.5" />
          مرتجعات الشراء ({purchaseReturns.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400" />
        <input
          className="input w-full"
          style={{ paddingRight: 44 }}
          placeholder={
            activeTab === 'suppliers' ? "بحث باسم المورد أو رقم الهاتف..." :
            activeTab === 'invoices' ? "بحث برقم الفاتورة أو اسم المورد..." : "بحث باسم المورد أو سبب الإرجاع..."
          }
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tab 1: Suppliers List */}
      {activeTab === 'suppliers' && (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم المورد</th>
                <th>الهاتف</th>
                <th>العنوان</th>
                <th>مستحقات المورد (دائن / له)</th>
                <th>تاريخ الإضافة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="font-bold text-[var(--clr-text)]">{s.name}</div>
                    {s.notes && <div className="text-xs text-[var(--clr-muted)]">{s.notes}</div>}
                  </td>
                  <td dir="ltr" className="text-sm font-mono text-[var(--clr-text-2)]">{s.phone || '—'}</td>
                  <td>{s.address || '—'}</td>
                  <td className="font-bold font-mono text-base text-[var(--clr-danger)]">{formatEGP(s.balance)}</td>
                  <td className="text-sm font-mono">{formatDate(s.created_at)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs px-2.5 py-1 font-bold flex items-center gap-1 cursor-pointer text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/10"
                        onClick={() => {
                          setSettleSupplierId(s.id)
                          setShowSettleModal(true)
                        }}
                        title="سداد وتسوية مستحقات هذا المورد"
                      >
                        <Wallet size={13} /> سداد مستحقات
                      </button>
                      <button
                        className="btn-icon text-xs px-2.5 py-1"
                        onClick={() => {
                          setEditingSupplier(s)
                          setShowSupplierModal(true)
                        }}
                      >
                        <Edit size={14} /> تعديل
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--clr-muted)]">
                    لا يوجد موردين مطابقين للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Purchase Invoices */}
      {activeTab === 'invoices' && (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>المورد</th>
                <th>إجمالي الفاتورة</th>
                <th>المدفوع نقداً</th>
                <th>المتبقي على الحساب (آجل)</th>
                <th>الحساب المالي المستخدم</th>
                <th>تاريخ الفاتورة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(po => {
                const unpaid = Math.max(0, po.total_cost - (po.amount_paid || 0))
                return (
                  <tr key={po.id}>
                    <td>
                      <span className="badge badge-primary font-mono font-bold">
                        {po.invoice_no || `PINV-${po.id.substring(0, 6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="font-bold">{po.supplier_name}</td>
                    <td className="font-bold font-mono text-base text-[var(--clr-primary)]">{formatEGP(po.total_cost)}</td>
                    <td className="font-mono text-[var(--clr-success)] font-semibold">{formatEGP(po.amount_paid)}</td>
                    <td className="font-mono text-[var(--clr-danger)] font-semibold">
                      {unpaid > 0 ? formatEGP(unpaid) : <span className="text-emerald-400">مسددة بالكامل</span>}
                    </td>
                    <td>
                      <span className="badge badge-muted text-xs">
                        {po.financial_account_name || 'الخزينة الرئيسية'}
                      </span>
                    </td>
                    <td className="text-xs font-mono text-[var(--clr-muted)]">
                      {formatDateTime(po.received_at || po.created_at)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {unpaid > 0 && (
                          <button
                            type="button"
                            className="btn-secondary text-xs px-2 py-1 font-bold flex items-center gap-1 cursor-pointer text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/10"
                            onClick={() => {
                              setSettleSupplierId(po.supplier_id)
                              setShowSettleModal(true)
                            }}
                            title="سداد هذه الفاتورة"
                          >
                            <Wallet size={12} /> سداد
                          </button>
                        )}
                        <button
                          className="btn-icon text-xs px-2.5 py-1 flex items-center gap-1"
                          onClick={() => handleOpenPODetails(po)}
                        >
                          <Eye size={14} /> عرض البنود
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[var(--clr-muted)]">
                    لا توجد فواتير مشتريات مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Purchase Returns */}
      {activeTab === 'returns' && (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم المرتجع</th>
                <th>المورد</th>
                <th>إجمالي قيمة المرتجع</th>
                <th>طريقة التسوية</th>
                <th>الحساب المالي المسترد إليه</th>
                <th>تاريخ المرتجع</th>
                <th>السبب</th>
              </tr>
            </thead>
            <tbody>
              {purchaseReturns.map(ret => (
                <tr key={ret.id}>
                  <td>
                    <span className="badge badge-warning font-mono font-bold">
                      PRET-{ret.id.substring(0, 6).toUpperCase()}
                    </span>
                  </td>
                  <td className="font-bold">{ret.supplier_name}</td>
                  <td className="font-bold font-mono text-base text-[var(--clr-warning)]">
                    {formatEGP(ret.total_amount)}
                  </td>
                  <td>
                    <span className={`badge ${ret.refund_type === 'cash' ? 'badge-success' : 'badge-primary'} text-xs font-semibold`}>
                      {ret.refund_type === 'cash' ? 'استرداد نقدي' : 'تخفيض مديونية المورد'}
                    </span>
                  </td>
                  <td className="text-xs">
                    {ret.financial_account_name || (ret.refund_type === 'cash' ? 'الخزينة' : 'خصم من الحساب')}
                  </td>
                  <td className="text-xs font-mono text-[var(--clr-muted)]">
                    {formatDateTime(ret.created_at)}
                  </td>
                  <td className="text-xs text-[var(--clr-muted)]">{ret.reason || '—'}</td>
                </tr>
              ))}
              {purchaseReturns.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--clr-muted)]">
                    لا توجد مرتجعات مشتريات مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Purchase Orders Legacy List */}
      {activeTab === 'orders' && (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>المورد</th>
                <th>الحالة</th>
                <th>إجمالي التكلفة</th>
                <th>تاريخ الطلب</th>
                <th>تاريخ الاستلام</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map(po => (
                <tr key={po.id}>
                  <td className="font-bold">{po.supplier_name}</td>
                  <td>
                    <span className={`badge ${
                      po.status === 'received' ? 'badge-success' :
                      po.status === 'ordered' ? 'badge-primary' : 'badge-muted'
                    }`}>
                      {po.status === 'received' ? 'تم الاستلام' : po.status === 'ordered' ? 'مطلوب' : po.status}
                    </span>
                  </td>
                  <td className="font-mono font-bold">{formatEGP(po.total_cost)}</td>
                  <td className="text-xs font-mono">{formatDate(po.ordered_at || po.created_at)}</td>
                  <td className="text-xs font-mono">{po.received_at ? formatDate(po.received_at) : '—'}</td>
                  <td>
                    <button
                      className="btn-icon text-xs px-2.5 py-1 flex items-center gap-1"
                      onClick={() => handleOpenPODetails(po)}
                    >
                      <Eye size={14} /> عرض
                    </button>
                  </td>
                </tr>
              ))}
              {purchaseOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--clr-muted)]">
                    لا توجد أوامر شراء مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── MODAL: Add Purchase Invoice ─── */}
      {showInvoiceModal && (
        <PurchaseInvoiceModal
          initialSuppliers={suppliers}
          initialProducts={products}
          initialCategories={categories}
          initialBrands={brands}
          initialFinancialAccounts={financialAccounts}
          onClose={() => setShowInvoiceModal(false)}
          onSuccess={() => {
            setShowInvoiceModal(false)
            loadData()
          }}
        />
      )}

      {/* ─── MODAL: Record Purchase Return ─── */}
      {showReturnModal && (
        <PurchaseReturnModal
          initialSuppliers={suppliers}
          initialProducts={products}
          initialFinancialAccounts={financialAccounts}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            setShowReturnModal(false)
            loadData()
          }}
        />
      )}

      {/* ─── MODAL: Supplier Edit/Create ─── */}
      {showSupplierModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => {
            setShowSupplierModal(false)
            setEditingSupplier(null)
          }}
          onSave={handleSaveSupplier}
        />
      )}

      {/* ─── MODAL: View Invoice Items ─── */}
      {showDetailsModal && selectedPO && (
        <InvoiceDetailsModal
          po={selectedPO}
          items={poDetailsItems}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedPO(null)
          }}
        />
      )}

      {/* ─── MODAL: Settle Supplier Invoices ─── */}
      {showSettleModal && (
        <SettleSupplierInvoicesModal
          initialSupplierId={settleSupplierId}
          onClose={() => setShowSettleModal(false)}
          onSuccess={() => loadData()}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Purchase Invoice Modal (إضافة فاتورة شراء متطورة LIFO مع تحميل ذاتي مضمون)
// ─────────────────────────────────────────────────────────────────────────────

function PurchaseInvoiceModal({
  initialSuppliers, initialProducts, initialCategories, initialBrands, initialFinancialAccounts,
  onClose, onSuccess, onReloadParent
}: any) {
  const [suppliers, setSuppliers] = useState<any[]>(initialSuppliers || [])
  const [products, setProducts] = useState<any[]>(initialProducts || [])
  const [categories, setCategories] = useState<any[]>(initialCategories || [])
  const [brands, setBrands] = useState<any[]>(initialBrands || [])
  const [financialAccounts, setFinancialAccounts] = useState<any[]>(initialFinancialAccounts || [])

  const [supplierId, setSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'split'>('cash')
  const [financialAccountId, setFinancialAccountId] = useState('cash_drawer')
  const [paidAmountInput, setPaidAmountInput] = useState('')
  const [notes, setNotes] = useState('')

  // Sub-modal triggers
  const [showQuickProductModal, setShowQuickProductModal] = useState(false)
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [targetRowForNewProduct, setTargetRowForNewProduct] = useState<number | null>(null)

  // Items table state
  const [items, setItems] = useState<Array<{ product_id: string; qty: number; unit_cost: number }>>([])

  // Self-loading guarantee: Fetch latest data directly inside modal on mount
  const refreshModalData = async () => {
    try {
      const [p, s, acc, c, b] = await Promise.all([
        getProducts().catch(() => []),
        getSuppliers().catch(() => []),
        getFinancialAccounts().catch(() => []),
        getCategories().catch(() => []),
        getBrands().catch(() => []),
      ])

      if (p && p.length > 0) setProducts(p)
      if (s && s.length > 0) {
        setSuppliers(s)
        if (!supplierId) setSupplierId(s[0].id)
      }
      if (acc && acc.length > 0) {
        setFinancialAccounts(acc)
        if (!financialAccountId) setFinancialAccountId(acc[0].id)
      }
      if (c && c.length > 0) setCategories(c)
      if (b && b.length > 0) setBrands(b)

      // Initialize first item row if items are empty
      if (items.length === 0 && p && p.length > 0) {
        setItems([{ product_id: p[0].id, qty: 1, unit_cost: p[0].cost_price || 0 }])
      }
    } catch (err) {
      console.error('Error refreshing modal data:', err)
    }
  }

  useEffect(() => {
    refreshModalData()
  }, [])

  // Sync state if props change
  useEffect(() => {
    if (initialSuppliers?.length > 0 && suppliers.length === 0) {
      setSuppliers(initialSuppliers)
      if (!supplierId) setSupplierId(initialSuppliers[0].id)
    }
    if (initialProducts?.length > 0 && products.length === 0) {
      setProducts(initialProducts)
      if (items.length === 0) {
        setItems([{ product_id: initialProducts[0].id, qty: 1, unit_cost: initialProducts[0].cost_price || 0 }])
      }
    }
    if (initialFinancialAccounts?.length > 0 && financialAccounts.length === 0) {
      setFinancialAccounts(initialFinancialAccounts)
      if (!financialAccountId) setFinancialAccountId(initialFinancialAccounts[0].id)
    }
  }, [initialSuppliers, initialProducts, initialFinancialAccounts])

  const totalInvoiceCost = items.reduce((sum, it) => sum + ((it.qty || 0) * (it.unit_cost || 0)), 0)
  const totalItemsCount = items.length
  const totalQtyCount = items.reduce((sum, it) => sum + (it.qty || 0), 0)

  // Auto adjust paid amount based on payment type
  const actualPaidAmount = paymentType === 'cash'
    ? totalInvoiceCost
    : paymentType === 'credit'
    ? 0
    : (parseFloat(paidAmountInput) || 0)

  const remainingCreditAmount = Math.max(0, totalInvoiceCost - actualPaidAmount)

  const selectedSupplier = suppliers.find((s: any) => s.id === supplierId)
  const selectedAccount = financialAccounts.find((a: any) => a.id === financialAccountId)

  const handleAddItem = () => {
    const defaultProd = products[0]
    setItems(prev => [
      ...prev,
      { product_id: defaultProd?.id || '', qty: 1, unit_cost: defaultProd?.cost_price || 0 }
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const copy = [...prev]
      if (field === 'product_id') {
        const prod = products.find((p: any) => p.id === value)
        copy[index] = {
          ...copy[index],
          product_id: value,
          unit_cost: prod ? (prod.cost_price || 0) : copy[index].unit_cost
        }
      } else {
        copy[index] = { ...copy[index], [field]: value }
      }
      return copy
    })
  }

  // When quick product is created
  const handleQuickProductCreated = async (newProduct: any) => {
    await refreshModalData()
    await onReloadParent()
    if (targetRowForNewProduct !== null && targetRowForNewProduct < items.length) {
      handleItemChange(targetRowForNewProduct, 'product_id', newProduct.id)
      handleItemChange(targetRowForNewProduct, 'unit_cost', newProduct.cost_price || 0)
    } else {
      setItems(prev => [
        ...prev,
        { product_id: newProduct.id, qty: 1, unit_cost: newProduct.cost_price || 0 }
      ])
    }
    setShowQuickProductModal(false)
    setTargetRowForNewProduct(null)
  }

  // When quick supplier is created
  const handleQuickSupplierCreated = async (newSupplier: any) => {
    await refreshModalData()
    await onReloadParent()
    setSupplierId(newSupplier.id)
    setShowQuickSupplierModal(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId) return toast.error('يرجى اختيار المورد أو إضافة مورد جديد')
    if (items.length === 0) return toast.error('يرجى إضافة صنف واحد على الأقل')

    const invalidItem = items.find(it => !it.product_id || it.qty <= 0 || it.unit_cost < 0)
    if (invalidItem) return toast.error('يرجى التأكد من اختيار صنف وتحديد كمية وسعر شراء صحيح لكل بند')

    const t = toast.loading('جاري حفظ فاتورة الشراء وتحديث المخزون والحسابات...')
    try {
      await recordPurchaseInvoice({
        supplier_id: supplierId,
        invoice_no: invoiceNo || undefined,
        items,
        payment_type: paymentType,
        paid_amount: actualPaidAmount,
        financial_account_id: actualPaidAmount > 0 ? financialAccountId : undefined,
        notes: notes || undefined,
        invoice_date: invoiceDate || undefined,
      })
      toast.success('تم تسجيل فاتورة الشراء وزيادة المخزون وتحديث أسعار التكلفة بنجاح!', { id: t })
      onSuccess()
    } catch (err: any) {
      toast.error(err.toString(), { id: t })
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowExitConfirm(true) }}>
        <div className="modal-content max-w-4xl max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
                <PackagePlus size={24} />
                تسجيل فاتورة شراء بضاعة (نظام LIFO)
              </h3>
              <p className="text-xs text-[var(--clr-muted)] mt-0.5">
                تحديث رصيد المخزون وتسعير التكلفة بآخر شراء وتسوية حسابات النقدية والموردين
              </p>
            </div>
            <button type="button" className="btn-icon" onClick={() => setShowExitConfirm(true)}>✕</button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Top Row: Supplier & Invoice Meta */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label m-0 font-bold">المورد *</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickSupplierModal(true)}
                    className="text-xs text-[var(--clr-primary)] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <PlusCircle size={13} /> + مورد جديد
                  </button>
                </div>
                <select
                  className="input w-full font-bold"
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  required
                >
                  {suppliers.length === 0 ? (
                    <option value="">لا يوجد موردين - اضغط + مورد جديد</option>
                  ) : (
                    suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (مستحقاته: {formatEGP(s.balance)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="label">رقم فاتورة المورد (اختياري)</label>
                <input
                  className="input w-full font-mono"
                  placeholder="مثال: INV-2026-948"
                  value={invoiceNo}
                  onChange={e => setInvoiceNo(e.target.value)}
                />
              </div>

              <div>
                <label className="label">تاريخ الفاتورة *</label>
                <input
                  type="date"
                  className="input w-full font-mono font-bold"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Items Table with Quick Add Product Button */}
            <div className="border rounded-xl p-4 bg-[var(--clr-surface-2)] flex flex-col gap-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-[var(--clr-text)] flex items-center gap-2">
                    <ShoppingBag size={16} className="text-[var(--clr-primary)]" />
                    أصناف وبنود الفاتورة قيد الشراء
                  </span>
                  <span className="badge badge-muted text-xs font-bold">
                    {totalItemsCount} أصناف • {totalQtyCount} قطعة
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetRowForNewProduct(items.length)
                      setShowQuickProductModal(true)
                    }}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-[var(--clr-primary)] border-[var(--clr-primary)]/40 hover:bg-[var(--clr-primary)]/10 font-bold cursor-pointer"
                  >
                    <PlusCircle size={14} /> + تعريف منتج جديد
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Plus size={14} /> إضافة سطر صنف
                  </button>
                </div>
              </div>

              {products.length === 0 ? (
                <div className="p-6 text-center border border-dashed rounded-xl bg-[var(--clr-surface-3)] space-y-3">
                  <p className="text-sm text-[var(--clr-muted)]">
                    لا توجد منتجات مسجلة بالمخزن بعد. يمكنك تعريف منتج جديد فورياً وإدراجه في الفاتورة:
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowQuickProductModal(true)}
                    className="btn-primary inline-flex items-center gap-2 font-bold"
                  >
                    <PlusCircle size={16} /> + تعريف أول منتج الآن
                  </button>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>الصنف بالمخزن</th>
                      <th style={{ width: '20%' }}>الكمية المشتراة</th>
                      <th style={{ width: '20%' }}>سعر شراء الوحدة (LIFO)</th>
                      <th style={{ width: '15%' }}>إجمالي البند</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const lineTotal = (it.qty || 0) * (it.unit_cost || 0)
                      return (
                        <tr key={idx}>
                          <td>
                            <select
                              className="input w-full text-xs font-bold"
                              value={it.product_id}
                              onChange={e => handleItemChange(idx, 'product_id', e.target.value)}
                              required
                            >
                              {products.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.name_ar} (المخزون الحالي: {p.stock_qty} • التكلفة السابقة: {formatEGP(p.cost_price)})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              className="input w-full font-bold font-mono text-center text-sm"
                              value={it.qty || ''}
                              placeholder="الكمية"
                              onChange={e => handleItemChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="input w-full font-bold font-mono text-center text-sm text-[var(--clr-primary)]"
                              value={it.unit_cost || ''}
                              placeholder="سعر الشراء"
                              onChange={e => handleItemChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                              required
                            />
                          </td>
                          <td className="font-bold font-mono text-sm text-[var(--clr-primary)]">
                            {formatEGP(lineTotal)}
                          </td>
                          <td>
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="btn-icon text-red-400 hover:text-red-300"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Payment & Accounting Settlement */}
            <div className="grid grid-cols-2 gap-4 border rounded-xl p-4 bg-gradient-to-br from-[var(--clr-surface-2)] to-[var(--clr-surface-1)]" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex flex-col gap-3">
                <label className="label font-bold text-sm">طريقة السداد والتسوية المحاسبية *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('cash')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      paymentType === 'cash'
                        ? 'bg-[var(--clr-primary)] text-white border-[var(--clr-primary)] shadow-md'
                        : 'bg-[var(--clr-surface-2)] border-[var(--clr-border)] opacity-70'
                    }`}
                  >
                    💵 نقدي كامل
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('credit')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      paymentType === 'credit'
                        ? 'bg-[var(--clr-primary)] text-white border-[var(--clr-primary)] shadow-md'
                        : 'bg-[var(--clr-surface-2)] border-[var(--clr-border)] opacity-70'
                    }`}
                  >
                    📋 آجل (على المورد)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('split')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      paymentType === 'split'
                        ? 'bg-[var(--clr-primary)] text-white border-[var(--clr-primary)] shadow-md'
                        : 'bg-[var(--clr-surface-2)] border-[var(--clr-border)] opacity-70'
                    }`}
                  >
                    ⚖️ سداد جزئي
                  </button>
                </div>

                {paymentType !== 'credit' && (
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div>
                      <label className="label font-bold">الحساب المالي المخصوم منه *</label>
                      <select
                        className="input w-full text-xs font-bold"
                        value={financialAccountId}
                        onChange={e => setFinancialAccountId(e.target.value)}
                      >
                        {financialAccounts.map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.name_ar} (رصيده: {formatEGP(a.balance)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {paymentType === 'split' && (
                      <div>
                        <label className="label font-bold">المبلغ المسدد نقداً *</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={totalInvoiceCost}
                          className="input w-full font-bold font-mono text-sm"
                          placeholder="0.00"
                          value={paidAmountInput}
                          onChange={e => setPaidAmountInput(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Accounting Breakdown Banner */}
              <div className="flex flex-col justify-between p-3 rounded-lg border bg-[var(--clr-surface-3)]/60 text-xs" style={{ borderColor: 'var(--clr-border)' }}>
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-sm border-b pb-1.5" style={{ borderColor: 'var(--clr-border)' }}>
                    <span>إجمالي قيمة الفاتورة:</span>
                    <span className="font-mono text-base text-[var(--clr-primary)]">{formatEGP(totalInvoiceCost)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>المخصوم نقداً من ({selectedAccount?.name_ar || 'الخزينة'}):</span>
                    <span className="font-mono">-{formatEGP(actualPaidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-red-400 font-semibold">
                    <span>المضاف لمستحقات المورد ({selectedSupplier?.name || 'المورد'}):</span>
                    <span className="font-mono">+{formatEGP(remainingCreditAmount)}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t text-[11px] text-[var(--clr-muted)] space-y-1" style={{ borderColor: 'var(--clr-border)' }}>
                  <div>• يضاف <strong>{totalItemsCount} أصناف ({totalQtyCount} قطعة)</strong> للأصول المتداولة (المخزون السلعي).</div>
                  <div>• يتم تحديث سعر تكلفة الأصناف تلقائياً وفقاً لمعيار <strong>LIFO</strong>.</div>
                </div>
              </div>
            </div>

            <div>
              <label className="label">ملاحظات الفاتورة</label>
              <input
                className="input w-full"
                placeholder="ملاحظات اختيارية عن الشحنة أو المورد..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowExitConfirm(true)}>إلغاء</button>
              <button type="submit" className="btn-primary font-bold px-8 shadow-lg">
                حفظ وترحيل الفاتورة للمخزن والحسابات
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ─── Exit Confirmation Dialog ─── */}
      {showExitConfirm && (
        <div className="modal-overlay z-[70]" onClick={e => { if (e.target === e.currentTarget) setShowExitConfirm(false) }}>
          <div className="modal-content max-w-md p-6 text-center space-y-4 shadow-2xl border border-[var(--clr-border)] bg-[var(--clr-surface-1)]">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--clr-text)]">تأكيد الخروج من الفاتورة</h3>
              <p className="text-sm text-[var(--clr-muted)] mt-1.5 leading-relaxed">
                هل أنت متأكد من الخروج وعدم تسجيل الفاتورة؟
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false)
                  onClose()
                }}
                className="btn-secondary text-red-400 border-red-500/30 hover:bg-red-500/10 font-bold px-5 py-2.5"
              >
                نعم، أغلق الفاتورة
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="btn-primary font-bold px-6 py-2.5 shadow-lg"
                autoFocus
              >
                لا، استكمال التسجيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Quick Add Product Sub-Modal ─── */}
      {showQuickProductModal && (
        <QuickProductSubModal
          categories={categories}
          brands={brands}
          onClose={() => setShowQuickProductModal(false)}
          onProductCreated={handleQuickProductCreated}
        />
      )}

      {/* ─── Quick Add Supplier Sub-Modal ─── */}
      {showQuickSupplierModal && (
        <SupplierModal
          supplier={null}
          onClose={() => setShowQuickSupplierModal(false)}
          onSave={async (supData: any) => {
            try {
              const created = await createSupplier(supData)
              toast.success('تمت إضافة المورد بنجاح!')
              handleQuickSupplierCreated(created)
            } catch (err: any) {
              toast.error('فشل إضافة المورد')
            }
          }}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Quick Add Product Sub-Modal (نافذة فرعية لإضافة صنف جديد فورياً)
// ─────────────────────────────────────────────────────────────────────────────

function QuickProductSubModal({ categories, brands, onClose, onProductCreated }: any) {
  const [form, setForm] = useState({
    name_ar: '',
    category_id: categories[0]?.id || 1,
    brand_id: brands[0]?.id || null,
    sku: '',
    cost_price: '',
    sell_price: '',
    stock_qty: 0,
    reorder_level: 5,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name_ar.trim()) return toast.error('يرجى كتابة اسم المنتج بالعربية')

    const t = toast.loading('جاري إضافة المنتج للمخزن...')
    try {
      const created = await createProduct({
        name_ar: form.name_ar,
        category_id: Number(form.category_id),
        brand_id: form.brand_id ? Number(form.brand_id) : undefined,
        sku: form.sku || undefined,
        cost_price: parseFloat(form.cost_price) || 0,
        sell_price: parseFloat(form.sell_price) || (parseFloat(form.cost_price) || 0) * 1.2,
        stock_qty: 0,
        reorder_level: Number(form.reorder_level) || 5,
      })
      toast.success('تمت إضافة المنتج بنجاح وإدراجه في الفاتورة!', { id: t })
      onProductCreated(created)
    } catch (err: any) {
      toast.error(err.toString(), { id: t })
    }
  }

  return (
    <div className="modal-overlay z-50" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-lg">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--clr-primary)]">
            <PlusCircle size={20} />
            إضافة منتج جديد للمخزن
          </h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="label">اسم المنتج بالعربية *</label>
            <input
              className="input w-full"
              placeholder="مثال: شاشة سامسونج A52 أصلية أو جراب..."
              value={form.name_ar}
              onChange={e => setForm({ ...form, name_ar: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">التصنيف / الفئة *</label>
              <select
                className="input w-full"
                value={form.category_id}
                onChange={e => setForm({ ...form, category_id: Number(e.target.value) })}
              >
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name_ar}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">الماركة (اختياري)</label>
              <select
                className="input w-full"
                value={form.brand_id || ''}
                onChange={e => setForm({ ...form, brand_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">بدون ماركة محددة</option>
                {brands.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">سعر الشراء المبدئي (LIFO Unit Cost)</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input w-full font-bold font-mono text-[var(--clr-primary)]"
                placeholder="0.00"
                value={form.cost_price}
                onChange={e => setForm({ ...form, cost_price: e.target.value })}
              />
            </div>

            <div>
              <label className="label">سعر البيع المقترح للمستهلك</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input w-full font-bold font-mono text-[var(--clr-success)]"
                placeholder="0.00"
                value={form.sell_price}
                onChange={e => setForm({ ...form, sell_price: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">الباركود / SKU (اختياري)</label>
            <input
              className="input w-full font-mono"
              placeholder="مثال: 6221234567890"
              value={form.sku}
              onChange={e => setForm({ ...form, sku: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t mt-2" style={{ borderColor: 'var(--clr-border)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn-primary font-bold">
              حفظ وإدراج بالفاتورة
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Purchase Return Modal (تسجيل مرتجع شراء وتسوية الموردين والمخزون)
// ─────────────────────────────────────────────────────────────────────────────

function PurchaseReturnModal({ initialSuppliers, initialProducts, initialFinancialAccounts, onClose, onSuccess }: any) {
  const [suppliers, setSuppliers] = useState<any[]>(initialSuppliers || [])
  const [products, setProducts] = useState<any[]>(initialProducts || [])
  const [financialAccounts, setFinancialAccounts] = useState<any[]>(initialFinancialAccounts || [])

  const [supplierId, setSupplierId] = useState(initialSuppliers?.[0]?.id || '')
  const [refundType, setRefundType] = useState<'credit_reduction' | 'cash'>('credit_reduction')
  const [financialAccountId, setFinancialAccountId] = useState(initialFinancialAccounts?.[0]?.id || 'cash_drawer')
  const [reason, setReason] = useState('')

  const [items, setItems] = useState<Array<{ product_id: string; qty: number; unit_cost: number }>>([])

  useEffect(() => {
    const load = async () => {
      const [s, p, acc] = await Promise.all([
        getSuppliers().catch(() => []),
        getProducts().catch(() => []),
        getFinancialAccounts().catch(() => [])
      ])
      if (s?.length) { setSuppliers(s); if (!supplierId) setSupplierId(s[0].id) }
      if (p?.length) {
        setProducts(p)
        if (items.length === 0) setItems([{ product_id: p[0].id, qty: 1, unit_cost: p[0].cost_price || 0 }])
      }
      if (acc?.length) { setFinancialAccounts(acc); if (!financialAccountId) setFinancialAccountId(acc[0].id) }
    }
    load()
  }, [])

  const totalReturnAmount = items.reduce((sum, it) => sum + ((it.qty || 0) * (it.unit_cost || 0)), 0)

  const handleAddItem = () => {
    const defaultProd = products[0]
    setItems(prev => [
      ...prev,
      { product_id: defaultProd?.id || '', qty: 1, unit_cost: defaultProd?.cost_price || 0 }
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const copy = [...prev]
      if (field === 'product_id') {
        const prod = products.find((p: any) => p.id === value)
        copy[index] = {
          ...copy[index],
          product_id: value,
          unit_cost: prod ? (prod.cost_price || 0) : copy[index].unit_cost
        }
      } else {
        copy[index] = { ...copy[index], [field]: value }
      }
      return copy
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId) return toast.error('يرجى اختيار المورد')
    if (items.length === 0) return toast.error('يرجى اختيار صنف واحد على الأقل للإرجاع')

    const invalid = items.find(it => !it.product_id || it.qty <= 0 || it.unit_cost < 0)
    if (invalid) return toast.error('يرجى التأكد من تحديد كميات وأسعار صحيحة لجميع الأصناف المرتجعة')

    const t = toast.loading('جاري تسجيل مرتجع الشراء وتحديث المخزون والحسابات...')
    try {
      await recordPurchaseReturn({
        supplier_id: supplierId,
        items,
        refund_type: refundType,
        refund_amount: totalReturnAmount,
        financial_account_id: refundType === 'cash' ? financialAccountId : undefined,
        reason: reason || undefined,
      })
      toast.success('تم تسجيل مرتجع الشراء وخصم المخزون وتسوية الحساب بنجاح!', { id: t })
      onSuccess()
    } catch (err: any) {
      toast.error(err.toString(), { id: t })
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <h3 className="text-xl font-bold flex items-center gap-2 text-[var(--clr-warning)]">
            <RotateCcw size={22} />
            تسجيل مرتجع مشتريات لمورد
          </h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">المورد المستلم للمرتجع *</label>
              <select className="input w-full font-bold" value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (مستحقاته الحالية: {formatEGP(s.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">طريقة التسوية المحاسبية للمرتجع *</label>
              <select className="input w-full font-bold" value={refundType} onChange={e => setRefundType(e.target.value as any)}>
                <option value="credit_reduction">خصم من مديونية ومستحقات المورد (تخفيض التزامات)</option>
                <option value="cash">استرداد نقدي (إيداع نقدية في الخزينة أو الحساب المالي)</option>
              </select>
            </div>
          </div>

          {refundType === 'cash' && (
            <div>
              <label className="label">الحساب المالي المستلم للنقدية المستردة *</label>
              <select className="input w-full font-bold" value={financialAccountId} onChange={e => setFinancialAccountId(e.target.value)}>
                {financialAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name_ar} (رصيده: {formatEGP(a.balance)})</option>
                ))}
              </select>
            </div>
          )}

          {/* Returned Items */}
          <div className="border rounded-xl p-4 bg-[var(--clr-surface-2)] flex flex-col gap-3" style={{ borderColor: 'var(--clr-border)' }}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[var(--clr-text)]">الأصناف المرتجعة</span>
              <button type="button" onClick={handleAddItem} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                <Plus size={14} /> إضافة صنف
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>الصنف</th>
                  <th style={{ width: '25%' }}>الكمية المرتجعة</th>
                  <th style={{ width: '20%' }}>سعر الإرجاع للوحدة</th>
                  <th style={{ width: '10%' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        className="input w-full text-xs font-bold"
                        value={it.product_id}
                        onChange={e => handleItemChange(idx, 'product_id', e.target.value)}
                        required
                      >
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name_ar} (المخزون الحالي: {p.stock_qty})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        className="input w-full font-bold font-mono text-center text-sm"
                        value={it.qty || ''}
                        onChange={e => handleItemChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="input w-full font-bold font-mono text-center text-sm text-[var(--clr-warning)]"
                        value={it.unit_cost || ''}
                        onChange={e => handleItemChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="btn-icon text-red-400"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center font-bold text-sm pt-2 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <span>إجمالي قيمة المرتجع المسترد:</span>
              <span className="font-mono text-base text-[var(--clr-warning)]">{formatEGP(totalReturnAmount)}</span>
            </div>
          </div>

          <div>
            <label className="label">سبب المرتجع</label>
            <input
              className="input w-full"
              placeholder="مثال: عيوب بالصناعة، بضاعة زائدة عن الحاجة..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn-primary font-bold px-6 bg-[var(--clr-warning)] text-black hover:opacity-90">
              تأكيد المرتجع وخصم المخزون
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Supplier Create/Edit Modal
// ─────────────────────────────────────────────────────────────────────────────

function SupplierModal({ supplier, onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    notes: supplier?.notes || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('يرجى إدخال اسم المورد')
    onSave(form)
  }

  return (
    <div className="modal-overlay z-50" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-md">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Building2 size={20} className="text-[var(--clr-primary)]" />
            {supplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
          </h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label font-bold">اسم المورد / الشركة *</label>
            <input
              className="input w-full"
              placeholder="مثال: شركة التوحيد للاستيراد"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">رقم الهاتف</label>
            <input
              className="input w-full font-mono"
              dir="ltr"
              placeholder="010xxxxxxxx"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="label">العنوان</label>
            <input
              className="input w-full"
              placeholder="العنوان أو المحافظة..."
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div>
            <label className="label">ملاحظات إضافية</label>
            <input
              className="input w-full"
              placeholder="ملاحظات اختيارية..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn-primary font-bold">حفظ المورد</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Invoice Details Modal
// ─────────────────────────────────────────────────────────────────────────────

function InvoiceDetailsModal({ po, items, onClose }: any) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-2xl">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FileText size={20} className="text-[var(--clr-primary)]" />
            تفاصيل فاتورة الشراء: {po.invoice_no || `PINV-${po.id.substring(0, 6)}`}
          </h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--clr-surface-2)] rounded-xl text-xs mb-4">
          <div>
            <span className="text-[var(--clr-muted)] block">المورد:</span>
            <span className="font-bold text-sm">{po.supplier_name}</span>
          </div>
          <div>
            <span className="text-[var(--clr-muted)] block">إجمالي الفاتورة:</span>
            <span className="font-bold text-sm font-mono text-[var(--clr-primary)]">{formatEGP(po.total_cost)}</span>
          </div>
          <div>
            <span className="text-[var(--clr-muted)] block">المدفوع نقداً:</span>
            <span className="font-bold text-sm font-mono text-[var(--clr-success)]">{formatEGP(po.amount_paid)}</span>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية المستلمة</th>
              <th>سعر الشراء للوحدة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id}>
                <td className="font-bold">{it.product_name}</td>
                <td className="font-mono text-center">{it.qty_received || it.qty_ordered}</td>
                <td className="font-mono font-bold text-[var(--clr-primary)]">{formatEGP(it.unit_cost)}</td>
                <td className="font-mono font-bold">{formatEGP((it.qty_received || it.qty_ordered) * it.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end pt-4 border-t mt-4" style={{ borderColor: 'var(--clr-border)' }}>
          <button className="btn-secondary" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}
