import { useState, useEffect, useRef } from 'react'
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote, X, Check,
  ChevronDown, RotateCcw, FileText, Eye, Printer, Calendar, ShoppingBag, TrendingUp, User, Clock, FileSpreadsheet, Wallet, Edit3, AlertCircle
} from 'lucide-react'
import {
  getProducts, createSale, getCustomers, getSettings, getFinancialAccounts,
  getSales, getSale, processSalePartialReturn
} from '../../lib/commands'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import { formatEGP, formatDate, formatDateTime, formatTime, today, monthStart, yearStart } from '../../lib/utils'
import { exportPeriodSalesReport } from '../../lib/excel'
import toast from 'react-hot-toast'
import { openUrl } from '@tauri-apps/plugin-opener'
import QuickAddCustomerModal from '../../components/QuickAddCustomerModal'
import ExportReportModal from '../../components/ExportReportModal'
import { shareSaleReceiptWhatsApp } from '../../lib/whatsapp'

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [storeSettings, setStoreSettings] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [cashAmount, setCashAmount] = useState(0)
  const [cardAmount, setCardAmount] = useState(0)
  const [lastSale, setLastSale] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptSale, setReceiptSale] = useState<any>(null)
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false)
  const [showExportSalesModal, setShowExportSalesModal] = useState(false)
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('cash_drawer')
  const searchRef = useRef<HTMLInputElement>(null)

  // Quantity Edit Modal State
  const [editingCartItem, setEditingCartItem] = useState<any | null>(null)
  const [editQtyValue, setEditQtyValue] = useState<number>(1)

  // Sales History modal state
  const [showSalesHistoryModal, setShowSalesHistoryModal] = useState(false)
  const [salesHistoryFrom, setSalesHistoryFrom] = useState(today())
  const [salesHistoryTo, setSalesHistoryTo] = useState(today())
  const [salesHistoryList, setSalesHistoryList] = useState<any[]>([])
  const [salesHistorySearch, setSalesHistorySearch] = useState('')
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any>(null)
  const [showSaleDetailModal, setShowSaleDetailModal] = useState(false)

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnSearchQuery, setReturnSearchQuery] = useState('')
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [selectedReturnSale, setSelectedReturnSale] = useState<any>(null)
  const [returnItemsQty, setReturnItemsQty] = useState<{ [itemId: string]: number }>({})
  const [returnReason, setReturnReason] = useState('')
  const [returnMethod, setReturnMethod] = useState('cash')

  const cart = useCartStore()
  const { user } = useAuthStore()

  const loadSalesHistory = async (from = salesHistoryFrom, to = salesHistoryTo) => {
    setSalesHistoryLoading(true)
    try {
      const list = await getSales({ date_from: from, date_to: to, limit: 300 })
      setSalesHistoryList(list || [])
    } catch (e) {
      toast.error('فشل جلب حركة المبيعات')
    } finally {
      setSalesHistoryLoading(false)
    }
  }

  const handleOpenSaleDetail = async (sale: any) => {
    try {
      const full = await getSale(sale.id)
      setSelectedSaleDetail(full)
      setShowSaleDetailModal(true)
    } catch (e) {
      toast.error('فشل جلب تفاصيل الفاتورة')
    }
  }

  const loadRecentSalesForReturn = async () => {
    try {
      const list = await getSales({ limit: 30 })
      setRecentSales(list)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSelectSaleForReturn = async (sale: any) => {
    try {
      const full = await getSale(sale.id)
      setSelectedReturnSale(full)
      const initialQtys: { [id: string]: number } = {}
      full.items?.forEach((it: any) => {
        initialQtys[it.id] = it.qty
      })
      setReturnItemsQty(initialQtys)
    } catch (e: any) {
      toast.error('فشل جلب تفاصيل الفاتورة')
    }
  }

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReturnSale) return

    const itemsToReturn = selectedReturnSale.items?.map((it: any) => ({
      sale_item_id: it.id,
      product_id: it.product_id,
      return_qty: returnItemsQty[it.id] || 0,
      unit_price: it.unit_price,
    })).filter((it: any) => it.return_qty > 0) || []

    if (itemsToReturn.length === 0) {
      return toast.error('يرجى تحديد كمية صنف واحد على الأقل للإرجاع')
    }

    try {
      await processSalePartialReturn({
        sale_id: selectedReturnSale.id,
        items: itemsToReturn,
        reason: returnReason || 'مرتجع نقطة بيع',
        refund_method: returnMethod,
      })
      toast.success('تمت عملية الإرجاع واستعادة المنتجات للمخزون وتسوية الحساب بنجاح!')
      setShowReturnModal(false)
      setSelectedReturnSale(null)
      setReturnReason('')
      // Reload products to refresh stock count
      getProducts({ is_active: true, limit: 500 }).then(setProducts).catch(console.error)
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  useEffect(() => {
    getProducts({ is_active: true, limit: 500 }).then(setProducts).catch(console.error)
    getCustomers().then(setCustomers).catch(console.error)
    getFinancialAccounts().then(setFinancialAccounts).catch(console.error)
    getSettings().then(s => {
      const map: Record<string, string> = {}
      s.forEach((item: any) => { map[item.key] = item.value })
      setStoreSettings(map)
    }).catch(console.error)
    searchRef.current?.focus()
  }, [])

  // Barcode scanner listener
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return
      }

      const currentTime = Date.now()
      if (currentTime - lastKeyTime > 150) {
        buffer = ''
      }
      lastKeyTime = currentTime

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          const barcode = buffer.trim()
          const prod = products.find(p => p.sku && p.sku.toLowerCase() === barcode.toLowerCase())
          if (prod) {
            if (prod.stock_qty <= 0) {
              toast.error(`المنتج ${prod.name_ar} غير متوفر في المخزون`)
            } else {
              cart.addItem({
                product_id: prod.id,
                name_ar: prod.name_ar,
                brand_name: prod.brand_name,
                unit_price: prod.sell_price,
                unit_cost: prod.cost_price
              })
              toast.success(`تم مسح وإضافة: ${prod.name_ar}`)
            }
          } else {
            toast.error(`لم يتم العثور على منتج بالكود: ${barcode}`)
          }
          buffer = ''
        }
      } else if (e.key.length === 1) {
        buffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [products, cart])

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    return p.name_ar?.includes(q) || p.sku?.toLowerCase().includes(q) || p.brand_name?.toLowerCase().includes(q)
  })

  const totalPaid = cashAmount + cardAmount
  const change = totalPaid - cart.total()

  const handleCheckout = async () => {
    if (cart.items.length === 0) { toast.error('السلة فارغة'); return }
    
    const remainingCredit = cart.total() - totalPaid
    if (remainingCredit > 0) {
      if (!cart.customerId) {
        toast.error('يجب اختيار عميل لتسجيل المبلغ الآجل على حسابه في الأصول المتداولة');
        return
      }
    }

    setLoading(true)
    try {
      const sale = await createSale({
        customer_id: cart.customerId ?? null,
        items: cart.items.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          unit_price: i.unit_price,
          unit_cost: i.unit_cost,
          discount: i.discount,
        })),
        discount: cart.cartDiscount,
        cash_amount: cashAmount,
        card_amount: cardAmount,
        notes: null,
        user_id: user?.id ?? null,
        financial_account_id: selectedAccountId,
      })
      setLastSale(sale)
      setReceiptSale({
        ...sale,
        // Since backend might return simplified model, we can reconstruct list from cart items for preview
        items: cart.items.map(i => ({ ...i }))
      })
      setShowReceipt(true)
      cart.clear()
      setShowCheckout(false)
      setCashAmount(0); setCardAmount(0)
      if (remainingCredit > 0) {
        toast.success(`تم البيع الآجل — فاتورة ${sale.invoice_no} وتسجيل ${formatEGP(remainingCredit)} على العميل`);
      } else {
        toast.success(`تم البيع — فاتورة ${sale.invoice_no}`);
      }
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'فشل إتمام البيع')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-print-area')
    if (!printContent) return
    const win = window.open('', '', 'width=800,height=600')
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>طباعة الفاتورة - XPhone</title>
            <style>
              body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; color: #000; }
              .header { text-align: center; margin-bottom: 20px; }
              .header h2 { margin: 0; font-size: 22px; }
              .header p { margin: 4px 0; font-size: 14px; }
              .meta { font-size: 13px; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
              .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
              th, td { padding: 6px 4px; font-size: 13px; text-align: right; }
              th { border-bottom: 1px solid #000; }
              .totals { border-top: 1px dashed #000; padding-top: 10px; font-size: 13px; }
              .totals-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
              .totals-row.bold { font-weight: bold; font-size: 15px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; border-top: 1px solid #000; padding-top: 10px; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `)
      win.document.close()
    }
  }

  const handleWhatsAppShare = () => {
    if (!receiptSale) return
    const customer = customers.find(c => c.id === receiptSale.customer_id)
    const phone = customer?.phone || receiptSale.phone || ''
    shareSaleReceiptWhatsApp(receiptSale, storeSettings?.store_name || 'متجر XPhone', phone)
  }


  return (
    <div className="flex gap-4 h-full" style={{ height: 'calc(100vh - var(--topbar-height) - 48px)' }}>
      {/* Products Grid */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="page-header mb-0 flex items-center justify-between">
          <h1 className="page-title">نقطة البيع</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 text-xs py-1.5 font-bold cursor-pointer text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 shadow-sm"
              onClick={() => setShowExportSalesModal(true)}
              title="استخراج تقرير إكسيل تفصيلي بالمبيعات لفترة محددة مع الإجماليات"
            >
              <FileSpreadsheet size={15} />
              استخراج إكسيل مبيعات فترة
            </button>

            <button
              id="pos-sales-history-btn"
              className="btn-primary flex items-center gap-2 text-xs py-1.5 font-bold shadow-md cursor-pointer"
              onClick={() => {
                setShowSalesHistoryModal(true)
                loadSalesHistory()
              }}
            >
              <FileText size={18} />
              حركة المبيعات والفواتير
            </button>

            <button
              className="btn-secondary flex items-center gap-2 text-xs py-1.5 font-bold cursor-pointer"
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
              onClick={() => {
                setShowReturnModal(true)
                loadRecentSalesForReturn()
              }}
            >
              <RotateCcw size={14} />
              استرجاع فاتورة (كامل / جزئي)
            </button>
          </div>
        </div>

        {showExportSalesModal && (
          <ExportReportModal
            title="استخراج تقرير مبيعات فترة لـ Excel"
            description="حدد الفترة الزمنية لتوليد تقرير تفصيلي بفواتير المبيعات والأصناف المباعة والإجماليات"
            onClose={() => setShowExportSalesModal(false)}
            onExport={exportPeriodSalesReport}
          />
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4" style={{ color: 'var(--clr-muted)' }} />
          <input
            ref={searchRef}
            id="pos-search"
            className="input"
            style={{ paddingRight: 44 }}
            placeholder="ابحث عن منتج بالاسم أو الكود أو الماركة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            {filtered.slice(0, 60).map(p => (
              <button
                key={p.id}
                onClick={() => {
                  if (p.stock_qty <= 0) { toast.error('المنتج غير متوفر في المخزون'); return }
                  cart.addItem({ product_id: p.id, name_ar: p.name_ar, brand_name: p.brand_name, unit_price: p.sell_price, unit_cost: p.cost_price })
                }}
                className="glass-card text-right p-3 cursor-pointer border-0 transition-all duration-200 hover:scale-[1.02]"
                style={{ outline: 'none' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`badge text-xs ${p.stock_qty <= 0 ? 'badge-danger' : p.stock_qty <= p.reorder_level ? 'badge-warning' : 'badge-success'}`}>
                    {p.stock_qty} قطعة
                  </span>
                  {p.brand_name && <span dir="ltr" className="text-xs font-medium" style={{ color: 'var(--clr-muted)' }}>{p.brand_name}</span>}
                </div>
                <div className="text-sm font-semibold mb-1" style={{ color: 'var(--clr-text)' }}>{p.name_ar}</div>
                {(p.variant_storage || p.variant_color) && (
                  <div className="text-xs mb-2" style={{ color: 'var(--clr-muted)' }}>
                    {[p.variant_storage, p.variant_color].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="text-base font-bold" style={{ color: 'var(--clr-primary)' }}>
                  {formatEGP(p.sell_price)}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-16" style={{ color: 'var(--clr-muted)' }}>
                لا توجد منتجات مطابقة
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart */}
      <div className="glass-card flex flex-col" style={{ width: 340, minWidth: 300 }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--clr-border)' }}>
          <h2 className="font-bold text-lg">سلة المشتريات</h2>
          <button className="btn-icon text-xs" onClick={cart.clear}>مسح</button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {cart.items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-2 py-12">
              <ShoppingCartEmpty />
              <p style={{ color: 'var(--clr-muted)' }} className="text-sm">السلة فارغة</p>
            </div>
          ) : cart.items.map(item => (
            <CartItemRow
              key={item.product_id}
              item={item}
              onEditQty={it => { setEditingCartItem(it); setEditQtyValue(it.qty); }}
            />
          ))}
        </div>

        {/* Totals */}
        <div className="p-4 border-t flex flex-col gap-3" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex justify-between text-sm" style={{ color: 'var(--clr-text-2)' }}>
            <span>المجموع</span>
            <span>{formatEGP(cart.subtotal())}</span>
          </div>
          {cart.cartDiscount > 0 && (
            <div className="flex justify-between text-sm" style={{ color: 'var(--clr-danger)' }}>
              <span>خصم</span>
              <span>- {formatEGP(cart.cartDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-xl">
            <span>الإجمالي</span>
            <span style={{ color: 'var(--clr-primary)' }}>{formatEGP(cart.total())}</span>
          </div>
          <button
            id="checkout-btn"
            className="btn-primary w-full py-3 text-base"
            onClick={() => { setShowCheckout(true); setCashAmount(cart.total()); setCardAmount(0) }}
            disabled={cart.items.length === 0}
          >
            إتمام البيع
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCheckout(false) }}>
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--clr-primary)]/20 flex items-center justify-center text-[var(--clr-primary)]">
                  <ShoppingBag size={18} />
                </div>
                <h3 className="text-lg font-bold text-[var(--clr-text)]">إتمام وتأكيد عملية البيع</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowCheckout(false)}><X size={16} /></button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Customer Selection Card */}
              <div className="p-3.5 rounded-xl bg-[var(--clr-surface-2)] border" style={{ borderColor: 'var(--clr-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="label m-0 font-bold text-xs flex items-center gap-1.5 text-[var(--clr-text)]">
                    <User size={14} className="text-[var(--clr-primary)]" />
                    اختيار العميل (اختياري)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomerModal(true)}
                    className="text-xs text-[var(--clr-primary)] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Plus size={13} /> + عميل جديد
                  </button>
                </div>
                <select
                  className="input w-full font-bold"
                  value={cart.customerId ?? ''}
                  onChange={e => cart.setCustomer(e.target.value || null)}
                >
                  <option value="">عميل نقدي افتراضي (بدون حساب)</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} {c.balance > 0 ? `• رصيد متبقي عليه: ${formatEGP(c.balance)}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Financial Account */}
              <div>
                <label className="label font-bold text-xs mb-1.5 flex items-center gap-1 text-[var(--clr-text)]">
                  <Wallet size={14} className="text-emerald-400" />
                  الحساب المالي المستلم للإيراد
                </label>
                <select
                  className="input w-full font-bold"
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                >
                  {financialAccounts.map(fa => (
                    <option key={fa.id} value={fa.id}>{fa.name_ar}</option>
                  ))}
                </select>
              </div>

              {/* Payment Mode Presets */}
              <div>
                <label className="label font-bold text-xs mb-1.5 text-[var(--clr-text)]">طريقة السداد السريعة:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      cashAmount >= cart.total()
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm'
                        : 'bg-[var(--clr-surface-2)] text-[var(--clr-muted)] border-[var(--clr-border)] hover:text-white'
                    }`}
                    onClick={() => { setCashAmount(cart.total()); setCardAmount(0); }}
                  >
                    💵 سداد الفاتورة بالكامل
                  </button>
                  <button
                    type="button"
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      cashAmount === 0
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                        : 'bg-[var(--clr-surface-2)] text-[var(--clr-muted)] border-[var(--clr-border)] hover:text-white'
                    }`}
                    onClick={() => { setCashAmount(0); setCardAmount(0); }}
                  >
                    📝 بيع آجل بالكامل (على الحساب)
                  </button>
                </div>
              </div>

              {/* Payment Amount */}
              <div className="p-3 rounded-xl bg-[var(--clr-surface-2)] border" style={{ borderColor: 'var(--clr-border)' }}>
                <label className="label font-bold text-xs mb-1.5 flex items-center gap-1.5 text-emerald-400">
                  <Banknote size={15} /> المبلغ المدفوع الآن (ج.م)
                </label>
                <input
                  type="number"
                  className="input w-full font-mono font-bold text-lg text-emerald-400"
                  value={cashAmount}
                  onChange={e => { setCashAmount(Number(e.target.value)); setCardAmount(0); }}
                  min={0}
                  step={0.5}
                />
              </div>

              {/* Deferred Sale Accounting Notice */}
              {totalPaid < cart.total() && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-amber-400 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={15} />
                      تسجيل بيع آجل (على حساب العميل)
                    </span>
                    <span className="font-mono text-sm">{formatEGP(cart.total() - totalPaid)}</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed m-0">
                    سيتم ترحيل مبلغ <strong className="text-amber-300">{formatEGP(cart.total() - totalPaid)}</strong> آلياً كدين على حساب العميل، ويضاف إلى قائمة المركز المالي تحت بند <strong>(العملاء والمدينون - الأصول المتداولة)</strong> حسب معايير المحاسبة.
                  </p>
                  {!cart.customerId && (
                    <div className="mt-1 p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                      <AlertCircle size={15} className="shrink-0 text-rose-400" />
                      <span>تنبيه: يجب اختيار عميل مسجل أعلى الشاشة لتأكيد البيع الآجل!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Summary Card */}
              <div className="glass-surface p-4 rounded-xl border flex flex-col gap-2.5 text-sm" style={{ borderColor: 'var(--clr-border)' }}>
                <div className="flex justify-between items-center text-xs text-[var(--clr-muted)]">
                  <span>إجمالي المشتريات:</span>
                  <span className="font-bold font-mono text-sm text-[var(--clr-text)]">{formatEGP(cart.total())}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-[var(--clr-muted)]">
                  <span>إجمالي المدفوع الآن:</span>
                  <span className="font-bold font-mono text-sm text-emerald-400">{formatEGP(totalPaid)}</span>
                </div>
                <div className="flex justify-between items-center text-base font-bold border-t pt-2 mt-1" style={{ borderColor: 'var(--clr-border)' }}>
                  <span>{totalPaid < cart.total() ? 'المتبقي كـ بيع آجل:' : 'المتبقي للعميل (الباقي):'}</span>
                  <span className="font-mono text-lg" style={{ color: totalPaid < cart.total() ? 'var(--clr-warning)' : change >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                    {totalPaid < cart.total() ? formatEGP(cart.total() - totalPaid) : formatEGP(Math.max(0, change))}
                  </span>
                </div>
              </div>

              <button
                id="confirm-sale-btn"
                className={`w-full py-3.5 text-base font-bold shadow-xl cursor-pointer rounded-xl transition-all ${
                  totalPaid < cart.total()
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white'
                    : 'btn-primary'
                }`}
                onClick={handleCheckout}
                disabled={loading || (totalPaid < cart.total() && !cart.customerId)}
              >
                {loading ? (
                  'جاري الحفظ والترحيل...'
                ) : totalPaid < cart.total() ? (
                  <><Check size={20} /> تأكيد وإتمام البيع الآجل على العميل 🚀</>
                ) : (
                  <><Check size={20} /> تأكيد وإتمام العملية 🚀</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptSale && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowReceipt(false) }}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <h3 className="text-lg font-bold">معاينة فاتورة البيع</h3>
              <button className="btn-icon" onClick={() => setShowReceipt(false)}><X size={16} /></button>
            </div>

            {/* Receipt Print Container */}
            <div
              id="receipt-print-area"
              className="bg-white text-black p-4 rounded-lg shadow-inner font-sans text-right"
              style={{ direction: 'rtl' }}
            >
              <div className="text-center border-b border-gray-300 pb-3 mb-3">
                <h2 className="text-xl font-bold text-gray-800">{storeSettings.store_name || 'متجر XPhone'}</h2>
                <p className="text-xs text-gray-600">للهواتف المحمولة والإكسسوارات والصيانة</p>
                {storeSettings.store_address && <p className="text-xs text-gray-500">العنوان: {storeSettings.store_address}</p>}
                {storeSettings.store_phone && <p className="text-xs text-gray-500">الهاتف: {storeSettings.store_phone}</p>}
              </div>

              <div className="text-xs text-gray-700 space-y-1 mb-3 border-b border-dashed border-gray-300 pb-2">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-mono font-bold">{receiptSale.invoice_no}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ:</span>
                  <span>{formatDateTime(receiptSale.created_at || new Date().toISOString())}</span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span>{receiptSale.customer_name || 'عميل نقدي'}</span>
                </div>
                <div className="flex justify-between">
                  <span>البائع:</span>
                  <span>{user?.display_name || 'المدير'}</span>
                </div>
              </div>

              <table className="w-full text-xs text-right border-b border-gray-300 mb-3">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-1 text-right">المنتج</th>
                    <th className="pb-1 text-center">الكمية</th>
                    <th className="pb-1 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptSale.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1.5 text-right font-medium">
                        {item.name_ar} {item.brand_name ? `(${item.brand_name})` : ''}
                      </td>
                      <td className="py-1.5 text-center">{item.qty}</td>
                      <td className="py-1.5 text-left">{formatEGP(item.unit_price * item.qty - item.discount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-xs text-gray-800 space-y-1.5">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{formatEGP(receiptSale.total + (receiptSale.discount || 0))}</span>
                </div>
                {receiptSale.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>خصم الفاتورة:</span>
                    <span>- {formatEGP(receiptSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t pt-1 border-gray-200">
                  <span>الإجمالي النهائي (شامل الضريبة):</span>
                  <span>{formatEGP(receiptSale.total)}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-xs">
                  <span>المدفوع نقداً:</span>
                  <span>{formatEGP(receiptSale.cash_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-xs pb-1 border-b border-gray-200">
                  <span>المدفوع إلكترونياً:</span>
                  <span>{formatEGP(receiptSale.card_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-green-700">
                  <span>المتبقي (الباقي):</span>
                  <span>{formatEGP(Math.max(0, (receiptSale.cash_amount || 0) + (receiptSale.card_amount || 0) - receiptSale.total))}</span>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 mt-4 pt-3 border-t border-dashed border-gray-300">
                شكراً لتعاملكم معنا!
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button className="btn-primary flex-1" onClick={handlePrint}>
                طباعة الفاتورة 🖨️
              </button>
              <button className="btn-secondary" onClick={handleWhatsAppShare} style={{ background: 'rgba(37,211,102,0.15)', color: '#25d366', border: '1px solid rgba(37,211,102,0.3)' }}>
                إرسال عبر WhatsApp 💬
              </button>
              <button className="btn-secondary" onClick={() => setShowReceipt(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quantity Modal */}
      {editingCartItem && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditingCartItem(null) }}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--clr-primary)]/20 flex items-center justify-center text-[var(--clr-primary)]">
                  <Edit3 size={18} />
                </div>
                <h3 className="text-lg font-bold text-[var(--clr-text)]">تعديل العدد / الكمية للمنتج</h3>
              </div>
              <button className="btn-icon" onClick={() => setEditingCartItem(null)}><X size={16} /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[var(--clr-surface-2)] border flex flex-col gap-1.5" style={{ borderColor: 'var(--clr-border)' }}>
                <span className="font-bold text-base text-[var(--clr-text)]">{editingCartItem.name_ar}</span>
                {editingCartItem.brand_name && <span className="text-xs text-[var(--clr-muted)]">{editingCartItem.brand_name}</span>}
                <div className="flex justify-between items-center text-xs text-[var(--clr-muted)] mt-2 pt-2 border-t" style={{ borderColor: 'var(--clr-border)' }}>
                  <span>سعر الوحدة: <strong className="text-[var(--clr-primary)] font-mono text-sm">{formatEGP(editingCartItem.unit_price)}</strong></span>
                  <span>العدد بالسلة حالياً: <strong className="font-mono text-white text-sm">{editingCartItem.qty}</strong></span>
                </div>
              </div>

              <div>
                <label className="label font-bold text-xs mb-2 text-[var(--clr-text)]">إدخال العدد الجديد المطلوب:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2 text-xl font-bold rounded-xl cursor-pointer"
                    onClick={() => setEditQtyValue(prev => Math.max(1, prev - 1))}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="input w-full text-center font-mono font-bold text-2xl text-[var(--clr-primary)] py-2 rounded-xl"
                    value={editQtyValue}
                    onChange={e => setEditQtyValue(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2 text-xl font-bold rounded-xl cursor-pointer"
                    onClick={() => setEditQtyValue(prev => prev + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="label font-bold text-xs mb-1.5 text-[var(--clr-muted)]">خيارات سريعة للعدد:</label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 5, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        editQtyValue === n
                          ? 'bg-[var(--clr-primary)] text-white border-[var(--clr-primary)] shadow-md'
                          : 'bg-[var(--clr-surface-2)] text-[var(--clr-text)] border-[var(--clr-border)] hover:bg-[var(--clr-surface-1)]'
                      }`}
                      onClick={() => setEditQtyValue(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-surface p-3.5 rounded-xl flex justify-between items-center text-sm font-bold border" style={{ borderColor: 'var(--clr-border)' }}>
                <span>إجمالي الصنف بالعدد الجديد:</span>
                <span className="font-mono text-emerald-400 text-lg">
                  {formatEGP(editingCartItem.unit_price * editQtyValue - (editingCartItem.discount || 0))}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="btn-primary flex-1 py-3 text-base font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  onClick={() => {
                    if (editQtyValue <= 0) {
                      toast.error('الكمية يجب أن تكون 1 أو أكثر');
                      return;
                    }
                    cart.updateQty(editingCartItem.product_id, editQtyValue);
                    setEditingCartItem(null);
                    toast.success(`تم تحديث العدد إلى ${editQtyValue}`);
                  }}
                >
                  <Check size={18} /> حفظ وتحديث العدد
                </button>
                <button
                  type="button"
                  className="btn-secondary py-3 px-5 font-bold cursor-pointer"
                  onClick={() => setEditingCartItem(null)}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Last sale notification */}
      {lastSale && (
        <div
          className="fixed bottom-6 left-6 glass-card p-4 flex items-center gap-3 animate-slide-up"
          style={{ zIndex: 100, border: '1px solid rgba(68,232,135,0.3)', maxWidth: 300 }}
        >
          <div className="rounded-full p-2" style={{ background: 'var(--clr-success-dim)' }}>
            <Check size={16} style={{ color: 'var(--clr-success)' }} />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--clr-success)' }}>تم البيع بنجاح</div>
            <div className="text-xs" style={{ color: 'var(--clr-muted)' }}>فاتورة {lastSale.invoice_no} — {formatEGP(lastSale.total)}</div>
          </div>
          <button className="btn-icon mr-auto p-1 border-0" style={{ background: 'none' }} onClick={() => setLastSale(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {/* POS Order Return Modal (Full and Partial Returns) */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card p-6 w-full max-w-2xl max-h-[90vh] flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <h3 className="font-bold text-xl flex items-center gap-2 text-red-400">
                  <RotateCcw size={20} />
                  استرجاع فاتورة مبيعات (كامل / جزئي)
                </h3>
                <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                  ابحث عن الفاتورة برقم الفاتورة أو اسم العميل، ثم حدد الأصناف والكميات المراد إرجاعها
                </p>
              </div>
              <button type="button" className="btn-icon font-bold text-sm" onClick={() => { setShowReturnModal(false); setSelectedReturnSale(null); }}>✕</button>
            </div>

            {!selectedReturnSale ? (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" />
                  <input
                    className="input w-full pr-10"
                    placeholder="ابحث برقم الفاتورة أو اسم العميل..."
                    value={returnSearchQuery}
                    onChange={e => setReturnSearchQuery(e.target.value)}
                  />
                </div>

                <div className="max-h-72 overflow-y-auto border rounded-xl" style={{ borderColor: 'var(--clr-border)' }}>
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[var(--clr-surface-2)] sticky top-0">
                      <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                        <th className="py-2.5 px-3 font-bold">رقم الفاتورة</th>
                        <th className="py-2.5 px-3 font-bold">العميل</th>
                        <th className="py-2.5 px-3 font-bold">الإجمالي</th>
                        <th className="py-2.5 px-3 font-bold">التاريخ</th>
                        <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      {recentSales
                        .filter(s =>
                          s.status !== 'returned' &&
                          (!returnSearchQuery ||
                            s.invoice_no?.toLowerCase().includes(returnSearchQuery.toLowerCase()) ||
                            s.customer_name?.toLowerCase().includes(returnSearchQuery.toLowerCase()))
                        )
                        .map(s => (
                          <tr key={s.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold">{s.invoice_no}</td>
                            <td className="py-2.5 px-3">{s.customer_name || 'عميل نقدي'}</td>
                            <td className="py-2.5 px-3 font-bold font-mono text-emerald-400">{formatEGP(s.total)}</td>
                            <td className="py-2.5 px-3 font-mono text-gray-400">{formatDate(s.created_at)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                className="btn-primary text-xs py-1 px-3"
                                onClick={() => handleSelectSaleForReturn(s)}
                              >
                                اختيار الفاتورة
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProcessReturn} className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                  <div>
                    <span className="text-xs text-gray-400 block">الفاتورة المحددة:</span>
                    <span className="font-bold text-base font-mono">{selectedReturnSale.invoice_no}</span>
                    <span className="text-xs text-gray-400 mr-2">({selectedReturnSale.customer_name || 'عميل نقدي'})</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs py-1"
                    onClick={() => setSelectedReturnSale(null)}
                  >
                    تغيير الفاتورة ↩
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>حدد الأصناف والكميات المراد استرجاعها:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          const allQtys: { [id: string]: number } = {}
                          selectedReturnSale.items?.forEach((it: any) => { allQtys[it.id] = it.qty })
                          setReturnItemsQty(allQtys)
                        }}
                      >
                        تحديد الكل (إرجاع كامل)
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        className="text-gray-400 hover:underline"
                        onClick={() => setReturnItemsQty({})}
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto border rounded-xl" style={{ borderColor: 'var(--clr-border)' }}>
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[var(--clr-surface-2)] sticky top-0">
                        <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                          <th className="py-2 px-3 font-bold">الصنف</th>
                          <th className="py-2 px-3 font-bold">الكمية المباعة</th>
                          <th className="py-2 px-3 font-bold">سعر الوحدة</th>
                          <th className="py-2 px-3 font-bold text-center">الكمية المرتجعة</th>
                          <th className="py-2 px-3 font-bold text-left">قيمة الاسترداد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        {selectedReturnSale.items?.map((it: any) => {
                          const retQty = returnItemsQty[it.id] || 0
                          const retVal = retQty * it.unit_price

                          return (
                            <tr key={it.id} className={retQty > 0 ? 'bg-red-500/5' : ''}>
                              <td className="py-2 px-3 font-medium">{it.product_name || it.name_ar}</td>
                              <td className="py-2 px-3 font-mono">{it.qty}</td>
                              <td className="py-2 px-3 font-mono">{formatEGP(it.unit_price)}</td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={it.qty}
                                  className="input py-1 px-2 w-20 text-center font-bold font-mono"
                                  value={retQty}
                                  onChange={e => {
                                    const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), it.qty)
                                    setReturnItemsQty(prev => ({ ...prev, [it.id]: val }))
                                  }}
                                />
                              </td>
                              <td className="py-2 px-3 font-bold font-mono text-left text-red-400">
                                {formatEGP(retVal)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold block mb-1">طريقة رد المبلغ المسترد:</label>
                    <select className="input w-full" value={returnMethod} onChange={e => setReturnMethod(e.target.value)}>
                      <option value="cash">استرداد نقدي من الخزينة للعميل</option>
                      <option value="credit">تخفيض / تسوية مديونية العميل (حساب آجل)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">سبب الإرجاع:</label>
                    <input className="input w-full" placeholder="مثال: استبدال، عيب صناعة، رغبة العميل..." value={returnReason} onChange={e => setReturnReason(e.target.value)} required />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
                  <div className="text-sm font-bold">
                    إجمالي قيمة الاسترداد:{' '}
                    <span className="text-red-400 font-mono text-lg">
                      {formatEGP(
                        selectedReturnSale.items?.reduce((sum: number, it: any) => sum + ((returnItemsQty[it.id] || 0) * it.unit_price), 0) || 0
                      )}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setSelectedReturnSale(null)}>رجوع</button>
                    <button type="submit" className="btn-danger">تأكيد عملية الإرجاع</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Sales History Modal */}
      {showSalesHistoryModal && (
        <SalesHistoryModal
          sales={salesHistoryList}
          loading={salesHistoryLoading}
          dateFrom={salesHistoryFrom}
          dateTo={salesHistoryTo}
          onDateFromChange={(d: string) => setSalesHistoryFrom(d)}
          onDateToChange={(d: string) => setSalesHistoryTo(d)}
          onRefresh={(f: string, t: string) => loadSalesHistory(f, t)}
          onOpenDetail={(sale: any) => handleOpenSaleDetail(sale)}
          onClose={() => setShowSalesHistoryModal(false)}
        />
      )}

      {/* Sale Detail Modal */}
      {showSaleDetailModal && selectedSaleDetail && (
        <SaleDetailModal
          sale={selectedSaleDetail}
          storeSettings={storeSettings}
          onClose={() => {
            setShowSaleDetailModal(false)
            setSelectedSaleDetail(null)
          }}
          onPrintReceipt={(sale: any) => {
            setReceiptSale(sale)
            setShowReceipt(true)
          }}
        />
      )}

      {/* Quick Add Customer Modal */}
      {showQuickCustomerModal && (
        <QuickAddCustomerModal
          onClose={() => setShowQuickCustomerModal(false)}
          onSuccess={(newCust) => {
            setCustomers(prev => [...prev, newCust])
            cart.setCustomer(newCust.id)
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Sales History Modal (حركة المبيعات وفواتير اليوم والفترة)
// ─────────────────────────────────────────────────────────────────────────────

function SalesHistoryModal({
  sales, loading, dateFrom, dateTo, onDateFromChange, onDateToChange,
  onRefresh, onOpenDetail, onClose
}: any) {
  const [search, setSearch] = useState('')

  const filteredSales = sales.filter((s: any) => {
    if (s.created_at) {
      const d = new Date(s.created_at)
      let sDate = s.created_at.slice(0, 10)
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        sDate = `${year}-${month}-${day}`
      }
      if (dateFrom && sDate < dateFrom) return false
      if (dateTo && sDate > dateTo) return false
    }

    const q = search.toLowerCase()
    const invMatch = s.invoice_no?.toLowerCase().includes(q)
    const custMatch = s.customer_name?.toLowerCase().includes(q)
    const itemMatch = s.items?.some((it: any) => it.product_name?.toLowerCase().includes(q))
    return !search || invMatch || custMatch || itemMatch
  })

  const totalSalesAmount = filteredSales.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
  const totalInvoicesCount = filteredSales.length
  const totalPiecesSold = filteredSales.reduce((sum: number, s: any) => {
    const saleQty = s.items?.reduce((iSum: number, it: any) => iSum + (it.qty || 0), 0) || 0
    return sum + saleQty
  }, 0)
  const totalCash = filteredSales.reduce((sum: number, s: any) => sum + (s.cash_amount || 0), 0)
  const totalCard = filteredSales.reduce((sum: number, s: any) => sum + (s.card_amount || 0), 0)

  const getYesterdayStr = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getWeekAgoStr = () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleQuickFilter = (type: 'today' | 'yesterday' | 'week' | 'month' | 'year') => {
    const t = today()
    let f = t
    let targetTo = t
    if (type === 'today') {
      f = t
    } else if (type === 'yesterday') {
      f = getYesterdayStr()
      targetTo = f
    } else if (type === 'week') {
      f = getWeekAgoStr()
    } else if (type === 'month') {
      f = monthStart()
    } else if (type === 'year') {
      f = yearStart()
    }
    onDateFromChange(f)
    onDateToChange(targetTo)
    onRefresh(f, targetTo)
  }

  return (
    <div className="modal-overlay z-50" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="modal-content p-6 overflow-y-auto"
        style={{ width: '95%', maxWidth: '1300px', maxHeight: '92vh', margin: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 mb-3" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--clr-primary)]/15 text-[var(--clr-primary)] flex items-center justify-center">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--clr-text)]">
                حركة المبيعات والفواتير
              </h3>
              <p className="text-xs text-[var(--clr-muted)] mt-0.5">
                استعراض فواتير البيع ومجموعات الإيراد للمدة الزمنية المحددة تلقائياً
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Date Filter & Search Bar */}
        <div className="flex flex-col gap-3 mb-3 p-3 rounded-xl bg-[var(--clr-surface-2)] border" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Quick date buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleQuickFilter('today')}
                className={`badge px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                  dateFrom === today() && dateTo === today() ? 'badge-primary' : 'badge-muted'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('yesterday')}
                className={`badge px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                  dateFrom === getYesterdayStr() && dateTo === getYesterdayStr() ? 'badge-primary' : 'badge-muted'
                }`}
              >
                أمس
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('week')}
                className={`badge px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                  dateFrom === getWeekAgoStr() && dateTo === today() ? 'badge-primary' : 'badge-muted'
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('month')}
                className={`badge px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                  dateFrom === monthStart() && dateTo === today() ? 'badge-primary' : 'badge-muted'
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => handleQuickFilter('year')}
                className={`badge px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                  dateFrom === yearStart() && dateTo === today() ? 'badge-primary' : 'badge-muted'
                }`}
              >
                خلال السنة
              </button>
            </div>

            {/* Custom Date Inputs */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--clr-muted)] font-bold">من:</span>
              <input
                type="date"
                className="input py-1 px-2.5 text-xs font-mono font-bold"
                value={dateFrom}
                onChange={e => {
                  const newFrom = e.target.value
                  onDateFromChange(newFrom)
                  onRefresh(newFrom, dateTo)
                }}
              />
              <span className="text-xs text-[var(--clr-muted)] font-bold">إلى:</span>
              <input
                type="date"
                className="input py-1 px-2.5 text-xs font-mono font-bold"
                value={dateTo}
                onChange={e => {
                  const newTo = e.target.value
                  onDateToChange(newTo)
                  onRefresh(dateFrom, newTo)
                }}
              />
              <button
                type="button"
                onClick={() => onRefresh(dateFrom, dateTo)}
                className="btn-primary text-xs px-3 py-1.5 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Search size={14} /> بحث وتحديث
              </button>

              <button
                type="button"
                onClick={async () => {
                  const t = toast.loading('جاري فتح نافذة حفظ التقرير...')
                  try {
                    const saved = await exportPeriodSalesReport(dateFrom, dateTo)
                    if (saved) toast.success('تم تصدير وحفظ تقرير المبيعات بنجاح!', { id: t })
                    else toast.dismiss(t)
                  } catch {
                    toast.error('فشل تصدير التقرير', { id: t })
                  }
                }}
                className="btn-secondary text-xs px-3 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
                title="تصدير فواتير المبيعات المحددة لملف Excel"
              >
                <FileSpreadsheet size={15} /> تصدير لـ Excel
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3.5 text-gray-400" />
            <input
              className="input w-full text-xs"
              style={{ paddingRight: 40 }}
              placeholder="بحث برقم الفاتورة، اسم العميل، أو اسم المنتج المباع..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Automatic Period Summary Table (جدول يوضح تلقائياً إجمالي مبيعات المدة المحددة) */}
        <div className="rounded-xl border overflow-hidden mb-3.5" style={{ borderColor: 'var(--clr-border)', background: 'var(--clr-surface-2)' }}>
          <div className="px-3.5 py-2 border-b flex items-center justify-between text-xs font-bold text-[var(--clr-primary)]" style={{ borderColor: 'var(--clr-border)', background: 'var(--clr-surface-3)' }}>
            <span>📊 ملخص إجماليات مبيعات الفترة المحددة تلقائياً:</span>
            <span className="font-mono text-[var(--clr-text)]">
              من {formatDate(dateFrom)} إلى {formatDate(dateTo)}
            </span>
          </div>
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr className="border-b text-[var(--clr-muted)] font-semibold" style={{ borderColor: 'var(--clr-border)' }}>
                <th className="py-2 px-3">إجمالي مبيعات الفترة</th>
                <th className="py-2 px-3">عدد الفواتير</th>
                <th className="py-2 px-3">القطع المباعة</th>
                <th className="py-2 px-3">التحصيل النقدي (كاش)</th>
                <th className="py-2 px-3">تحصيل المحافظ والبطاقات</th>
                <th className="py-2 px-3">متوسط الفاتورة</th>
              </tr>
            </thead>
            <tbody>
              <tr className="divide-x divide-x-reverse font-mono font-bold" style={{ borderColor: 'var(--clr-border)' }}>
                <td className="py-2.5 px-3 text-base text-[var(--clr-primary)]">{formatEGP(totalSalesAmount)}</td>
                <td className="py-2.5 px-3 text-sm text-[var(--clr-text)]">{totalInvoicesCount} فاتورة</td>
                <td className="py-2.5 px-3 text-sm text-emerald-400">{totalPiecesSold} قطعة</td>
                <td className="py-2.5 px-3 text-sm text-[var(--clr-success)]">{formatEGP(totalCash)}</td>
                <td className="py-2.5 px-3 text-sm text-amber-400">{formatEGP(totalCard)}</td>
                <td className="py-2.5 px-3 text-sm text-cyan-400">
                  {formatEGP(totalInvoicesCount > 0 ? totalSalesAmount / totalInvoicesCount : 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Invoices Table */}
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>العميل</th>
                <th>المنتجات المباعة (الأصناف والكميات)</th>
                <th>إجمالي المبلغ</th>
                <th>طريقة الدفع</th>
                <th>الوقت والتاريخ</th>
                <th className="text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--clr-muted)] font-bold">
                    جاري تحميل حركة المبيعات...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--clr-muted)]">
                    لا توجد فواتير مبيعات مسجلة في هذه الفترة
                  </td>
                </tr>
              ) : (
                filteredSales.map((s: any) => {
                  const isReturned = s.status === 'returned'
                  const isPartial = s.status === 'partial_return'
                  const itemsCount = s.items?.length || 0

                  return (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[var(--clr-primary)]">
                              {s.invoice_no}
                            </span>
                            {isReturned ? (
                              <span className="badge badge-danger text-[10px] py-0.5 px-1.5 font-bold">مرتجع كامل</span>
                            ) : isPartial ? (
                              <span className="badge badge-warning text-[10px] py-0.5 px-1.5 font-bold">مرتجع جزئي</span>
                            ) : null}
                          </div>
                          <div className="text-[11px] font-mono text-[var(--clr-text)] font-semibold flex items-center gap-1.5">
                            <span>{formatDate(s.created_at)}</span>
                            <span className="text-[10px] text-[var(--clr-muted)] flex items-center gap-0.5 font-normal">
                              <Clock size={10} className="inline text-gray-400" />
                              {formatTime(s.created_at) || formatDateTime(s.created_at).split(' ')[1]}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="font-semibold text-xs text-[var(--clr-text)]">
                        {s.customer_name || 'عميل نقدي'}
                      </td>

                      {/* Products Sold Column */}
                      <td>
                        {s.items && s.items.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {s.items.map((it: any, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[var(--clr-surface-3)] text-[var(--clr-text)] border border-[var(--clr-border)] font-medium"
                              >
                                <span className="font-bold text-[var(--clr-primary)] font-mono">{it.qty}×</span>
                                <span>{it.product_name}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--clr-muted)]">بنود الفاتورة</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="font-bold font-mono text-sm text-[var(--clr-primary)]">
                        {formatEGP(s.total)}
                      </td>

                      {/* Payment */}
                      <td className="text-xs">
                        {s.card_amount > 0 && s.cash_amount > 0 ? (
                          <span className="badge badge-muted text-[10px]">كاش + بطاقة</span>
                        ) : s.card_amount > 0 ? (
                          <span className="badge badge-muted text-[10px] text-amber-400">بطاقة / محفظة</span>
                        ) : (
                          <span className="badge badge-muted text-[10px] text-emerald-400">نقدي</span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="text-xs font-mono">
                        <div className="font-bold text-[var(--clr-text)]">
                          {formatDate(s.created_at)}
                        </div>
                        <div className="text-[11px] text-[var(--clr-muted)] flex items-center gap-1 mt-0.5 font-normal">
                          <Clock size={11} className="inline text-gray-400" />
                          <span>{formatTime(s.created_at) || formatDateTime(s.created_at).split(' ')[1]}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(s)}
                            className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1 font-bold cursor-pointer"
                            title="عرض تفاصيل الفاتورة كاملة"
                          >
                            <Eye size={14} className="text-[var(--clr-primary)]" />
                            تفاصيل
                          </button>
                          <button
                            type="button"
                            className="btn-secondary text-xs px-2.5 py-1 font-bold cursor-pointer flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            onClick={() => shareSaleReceiptWhatsApp(s, 'متجر XPhone', s.customer_phone)}
                            title="إرسال وتعديل فاتورة البيع المحددة للعميل عبر نافذة الواتساب الجانبية المنبثقة"
                          >
                            💬 واتساب
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4 border-t mt-4" style={{ borderColor: 'var(--clr-border)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Sale Detail Modal (عرض تفاصيل الفاتورة كاملة مع الأصناف والطباعة)
// ─────────────────────────────────────────────────────────────────────────────

function SaleDetailModal({ sale, storeSettings, onClose, onPrintReceipt }: any) {
  const items = sale.items || []
  const isReturned = sale.status === 'returned'
  const isPartial = sale.status === 'partial_return'

  return (
    <div className="modal-overlay z-[60]" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-2xl max-h-[85vh] p-5 overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3 mb-3" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-2">
            <FileText size={22} className="text-[var(--clr-primary)]" />
            <h3 className="text-lg font-bold">
              تفاصيل فاتورة البيع: <span className="font-mono text-[var(--clr-primary)]">{sale.invoice_no}</span>
            </h3>
            {isReturned ? (
              <span className="badge badge-danger text-xs">مرتجع كامل</span>
            ) : isPartial ? (
              <span className="badge badge-warning text-xs">مرتجع جزئي</span>
            ) : (
              <span className="badge badge-success text-xs">مكتملة</span>
            )}
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Invoice Info Grid */}
        <div className="grid grid-cols-3 gap-3 p-3.5 bg-[var(--clr-surface-2)] rounded-xl border mb-4 text-xs" style={{ borderColor: 'var(--clr-border)' }}>
          <div>
            <span className="text-[var(--clr-muted)] block mb-0.5">العميل:</span>
            <span className="font-bold text-sm text-[var(--clr-text)]">{sale.customer_name || 'عميل نقدي'}</span>
          </div>
          <div>
            <span className="text-[var(--clr-muted)] block mb-0.5">تاريخ وتوقيت الفاتورة:</span>
            <div className="font-bold font-mono text-sm text-[var(--clr-text)]">
              {formatDate(sale.created_at)}
            </div>
            <div className="text-xs font-mono text-[var(--clr-muted)] flex items-center gap-1 mt-0.5 font-normal">
              <Clock size={11} className="inline text-gray-400" />
              <span>{formatTime(sale.created_at)}</span>
            </div>
          </div>
          <div>
            <span className="text-[var(--clr-muted)] block mb-0.5">إجمالي الفاتورة:</span>
            <span className="font-bold font-mono text-base text-[var(--clr-primary)]">{formatEGP(sale.total)}</span>
          </div>
        </div>

        {/* Items Table */}
        <div className="border rounded-xl overflow-hidden mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>الصنف والمنتج المباع</th>
                <th className="text-center">الكمية</th>
                <th className="text-center">سعر الوحدة</th>
                <th className="text-center">الخصم</th>
                <th>إجمالي السطر</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={it.id || idx}>
                  <td>
                    <div className="font-bold text-sm text-[var(--clr-text)]">{it.product_name}</div>
                    {it.brand_name && <div className="text-[11px] text-[var(--clr-muted)]">{it.brand_name}</div>}
                  </td>
                  <td className="text-center font-bold font-mono text-sm">{it.qty}</td>
                  <td className="text-center font-mono text-xs">{formatEGP(it.unit_price)}</td>
                  <td className="text-center font-mono text-xs text-[var(--clr-muted)]">
                    {it.discount > 0 ? formatEGP(it.discount) : '—'}
                  </td>
                  <td className="font-bold font-mono text-sm text-[var(--clr-primary)]">
                    {formatEGP(it.line_total || (it.qty * it.unit_price - (it.discount || 0)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Breakdown */}
        <div className="p-3.5 bg-[var(--clr-surface-2)] rounded-xl border text-xs space-y-2 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex justify-between">
            <span className="text-[var(--clr-muted)]">المجموع الفرعي:</span>
            <span className="font-mono font-bold">{formatEGP(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-red-400">
              <span>خصم إضافي:</span>
              <span className="font-mono font-bold">-{formatEGP(sale.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t pt-2" style={{ borderColor: 'var(--clr-border)' }}>
            <span>الصافي الإجمالي:</span>
            <span className="font-mono text-base text-[var(--clr-primary)]">{formatEGP(sale.total)}</span>
          </div>
          <div className="flex justify-between text-emerald-400 pt-1">
            <span>المدفوع نقداً:</span>
            <span className="font-mono font-bold">{formatEGP(sale.cash_amount)}</span>
          </div>
          {sale.card_amount > 0 && (
            <div className="flex justify-between text-amber-400">
              <span>المدفوع بطاقة / محفظة:</span>
              <span className="font-mono font-bold">{formatEGP(sale.card_amount)}</span>
            </div>
          )}
          {sale.change_amount > 0 && (
            <div className="flex justify-between text-[var(--clr-muted)]">
              <span>المتبقي للعميل (باقي):</span>
              <span className="font-mono font-bold">{formatEGP(sale.change_amount)}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrintReceipt(sale)}
              className="btn-primary flex items-center gap-2 font-bold px-4 py-2 cursor-pointer"
            >
              <Printer size={16} /> طباعة إيصال الفاتورة
            </button>
            <button
              type="button"
              className="btn-secondary text-xs px-3.5 py-2 font-bold cursor-pointer flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => shareSaleReceiptWhatsApp(sale, 'متجر XPhone', sale.customer_phone)}
              title="إرسال إيصال الفاتورة للعميل عبر نافذة الواتساب الجانبية"
            >
              💬 إرسال عبر WhatsApp
            </button>
          </div>

          <button type="button" className="btn-secondary" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}

function ShoppingCartEmpty() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(240,240,250,0.2)" strokeWidth="1.5">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  )
}

function CartItemRow({ item, onEditQty }: { item: any; onEditQty: (item: any) => void }) {
  const cart = useCartStore()
  return (
    <div className="glass-surface p-3 flex flex-col gap-2 rounded-xl border" style={{ borderColor: 'var(--clr-border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{item.name_ar}</div>
          {item.brand_name && <span dir="ltr" className="text-xs" style={{ color: 'var(--clr-muted)' }}>{item.brand_name}</span>}
        </div>
        <button
          className="btn-icon p-1 border-0 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
          style={{ background: 'none', color: 'var(--clr-danger)' }}
          onClick={() => cart.removeItem(item.product_id)}
          title="حذف من السلة"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Quantity & Unit Price Row */}
      <div className="flex items-center justify-between gap-2 border-t pt-2 mt-1" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {/* Quantity adjustment buttons + modal opener */}
        <div className="flex items-center gap-1 bg-[var(--clr-surface-2)] p-0.5 rounded-lg border border-[var(--clr-border)]">
          <button
            type="button"
            className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-[var(--clr-surface-1)] hover:bg-[var(--clr-primary)] hover:text-white transition-colors cursor-pointer"
            onClick={() => cart.updateQty(item.product_id, item.qty - 1)}
            title="تقليل العدد"
          >
            -
          </button>
          <button
            type="button"
            className="px-2 py-0.5 text-xs font-bold font-mono text-[var(--clr-primary)] hover:underline flex items-center gap-1 cursor-pointer"
            onClick={() => onEditQty(item)}
            title="انقر لتعديل العدد عبر نافذة مخصصة"
          >
            <span className="text-[var(--clr-muted)] text-[10px]">العدد:</span>
            <span>{item.qty}</span>
            <Edit3 size={11} className="opacity-75" />
          </button>
          <button
            type="button"
            className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-[var(--clr-surface-1)] hover:bg-[var(--clr-primary)] hover:text-white transition-colors cursor-pointer"
            onClick={() => cart.updateQty(item.product_id, item.qty + 1)}
            title="زيادة العدد"
          >
            +
          </button>
        </div>

        {/* Unit Price input */}
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: 'var(--clr-muted)' }}>السعر:</span>
          <input
            type="number"
            className="input py-0.5 px-2 text-xs font-bold text-center"
            style={{ width: 75, height: 26, background: 'rgba(255,255,255,0.03)', color: 'var(--clr-primary)' }}
            value={item.unit_price}
            onChange={e => {
              const val = Number(e.target.value)
              if (val < item.unit_cost) {
                toast.error(`السعر لا يمكن أن يقل عن سعر التكلفة (${item.unit_cost} ج.م)`);
                cart.updatePrice(item.product_id, item.unit_cost);
              } else {
                cart.updatePrice(item.product_id, val);
              }
            }}
            min={item.unit_cost}
            step={1}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <span style={{ color: 'var(--clr-muted)' }}>إجمالي الصنف:</span>
        <span className="font-bold text-sm font-mono" style={{ color: 'var(--clr-primary)' }}>
          {formatEGP(item.unit_price * item.qty - item.discount)}
        </span>
      </div>
    </div>
  )
}
