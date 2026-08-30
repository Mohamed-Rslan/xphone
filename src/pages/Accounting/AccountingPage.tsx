import { useState, useEffect } from 'react'
import {
  Plus, TrendingUp, TrendingDown, DollarSign, FileSpreadsheet,
  Building2, Users, AlertTriangle, ArrowRightLeft, ShieldCheck,
  Scale, Calculator, Clock, CheckCircle2, RotateCcw, Box, ArrowDownRight, ArrowUpRight, Eye
} from 'lucide-react'
import {
  getExpenses, getExpenseCategories, createExpense, deleteExpense,
  getProfitLoss, getSales, getSale, getLedger, getFinancialAccounts,
  createFinancialAccount, deleteFinancialAccount, transferFinancialAmount,
  adjustFinancialAccountBalance, getBeginningBalance, getFixedAssets, createFixedAsset, recordDepreciation,
  deleteFixedAsset, getDamagedGoods, recordDamagedGoods, getAccruedExpenses,
  createAccruedExpense, payAccruedExpense, deleteAccruedExpense,
  getCustomerAdvances, createCustomerAdvance, getShareholders,
  createShareholder, createEquityTransaction, getEquityTransactions,
  calculateProfitDistribution, getBalanceSheet, updateFinancialAccountLimits,
  getSalesDetailedMetrics, processSaleReturn, processSalePartialReturn,
  getShareholderLedger
} from '../../lib/commands'
import { useAuthStore } from '../../store/authStore'
import { formatEGP, formatDate, formatDateTime, monthStart, today, yearStart } from '../../lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { exportFullAccountingExcel, exportShareholderLedgerExcel } from '../../lib/excel'
import toast from 'react-hot-toast'
import CashAccountMovementsModal from '../../components/CashAccountMovementsModal'

const COLORS = ['#7c6bff', '#00d4aa', '#ffab3e', '#ff5c7c', '#44e887', '#a78bfa', '#34d399']

export default function AccountingPage() {
  const [tab, setTab] = useState<'balance_sheet' | 'pl' | 'profit_distribution' | 'ledger' | 'shareholders' | 'shareholders_ledger' | 'fixed_assets' | 'accrued' | 'advances' | 'accounts' | 'sales_detailed' | 'expenses'>('balance_sheet')
  
  // Date range filters
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())
  
  // Core state
  const [balanceSheet, setBalanceSheet] = useState<any>(null)
  const [pl, setPL] = useState<any>(null)
  const [ledgerList, setLedgerList] = useState<any[]>([])
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('all')
  const [shareholderLedgerList, setShareholderLedgerList] = useState<any[]>([])
  const [selectedLedgerShareholderId, setSelectedLedgerShareholderId] = useState<string>('all')
  const [accountsList, setAccountsList] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  const [shareholders, setShareholders] = useState<any[]>([])
  const [profitDistReport, setProfitDistReport] = useState<any>(null)
  const [profitDistMethod, setProfitDistMethod] = useState<'method_1' | 'method_2'>('method_1')
  const [distHistory, setDistHistory] = useState<any[]>([])
  const [confirmingDist, setConfirmingDist] = useState(false)
  const [distFinancialAccId, setDistFinancialAccId] = useState('cash_drawer')
  const [accruedList, setAccruedList] = useState<any[]>([])
  const [advancesList, setAdvancesList] = useState<any[]>([])
  const [salesMetrics, setSalesMetrics] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  // Modal states
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [showAccountLimitModal, setShowAccountLimitModal] = useState<any>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showAddAssetModal, setShowAddAssetModal] = useState(false)
  const [showDepreciationModal, setShowDepreciationModal] = useState<any>(null)
  const [showAddShareholderModal, setShowAddShareholderModal] = useState(false)
  const [showEquityTxModal, setShowEquityTxModal] = useState<any>(null)
  const [showAddAccruedModal, setShowAddAccruedModal] = useState(false)
  const [showPayAccruedModal, setShowPayAccruedModal] = useState<any>(null)
  const [showAddAdvanceModal, setShowAddAdvanceModal] = useState(false)
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState<any>(null)
  const [returnItemsQty, setReturnItemsQty] = useState<{ [itemId: string]: number }>({})
  const [returnReason, setReturnReason] = useState('')
  const [returnMethod, setReturnMethod] = useState('cash')
  const [exporting, setExporting] = useState(false)

  const openReturnModalForSale = async (inv: any) => {
    try {
      let fullSale = inv
      if (!inv.items || inv.items.length === 0) {
        // If sale id exists or fetch by id
        const salesList = await getSales({ limit: 100 })
        const found = salesList.find(s => s.invoice_no === inv.invoice_no || s.id === inv.id)
        if (found) {
          fullSale = await getSale(found.id)
        }
      }
      setShowReturnModal(fullSale)
      const initialQtys: { [id: string]: number } = {}
      fullSale.items?.forEach((it: any) => {
        initialQtys[it.id] = it.qty
      })
      setReturnItemsQty(initialQtys)
    } catch (e: any) {
      toast.error('فشل تحميل تفاصيل الفاتورة')
    }
  }

  // Handle Sale Return
  const handleProcessSaleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showReturnModal) return
    
    const itemsToReturn = showReturnModal.items?.map((it: any) => ({
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
        sale_id: showReturnModal.id,
        items: itemsToReturn,
        reason: returnReason || 'مرتجع فاتورة مبيعات',
        refund_method: returnMethod,
      })
      toast.success('تم إرجاع المنتجات المحددة وإعادتها للمخزون وتسوية الحساب بنجاح')
      setShowReturnModal(null)
      setReturnReason('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Form inputs
  const [newAccName, setNewAccName] = useState('')
  const [newAccMin, setNewAccMin] = useState('')
  const [newAccMax, setNewAccMax] = useState('')

  const [transferFrom, setTransferFrom] = useState('cash_drawer')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNotes, setTransferNotes] = useState('')

  const [assetName, setAssetName] = useState('')
  const [assetCost, setAssetCost] = useState('')
  const [assetRate, setAssetRate] = useState('10')
  const [assetDate, setAssetDate] = useState(today())
  const [assetAcc, setAssetAcc] = useState('cash_drawer')
  const [assetNotes, setAssetNotes] = useState('')

  const [deprAmount, setDeprAmount] = useState('')
  const [deprDate, setDeprDate] = useState(today())
  const [deprNotes, setDeprNotes] = useState('')

  const { user } = useAuthStore()
  const [showAdjustBalanceModal, setShowAdjustBalanceModal] = useState<any>(null)
  const [adjustNewBalance, setAdjustNewBalance] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [selectedAccountForMovements, setSelectedAccountForMovements] = useState<any>(null)
  const [shortTermHistory, setShortTermHistory] = useState<any[]>([])

  const [shName, setShName] = useState('')
  const [shPhone, setShPhone] = useState('')
  const [shCapital, setShCapital] = useState('')
  const [shPct, setShPct] = useState('')
  const [shAcc, setShAcc] = useState('cash_drawer')
  const [shNotes, setShNotes] = useState('')

  const [eqTxType, setEqTxType] = useState('short_term_contribution')
  const [eqTxAmount, setEqTxAmount] = useState('')
  const [eqTxCounterpart, setEqTxCounterpart] = useState('cash')
  const [eqTxAcc, setEqTxAcc] = useState('cash_drawer')
  const [eqTxDesc, setEqTxDesc] = useState('')

  const [accruedTitle, setAccruedTitle] = useState('')
  const [accruedAmount, setAccruedAmount] = useState('')
  const [accruedCatId, setAccruedCatId] = useState('')
  const [accruedDue, setAccruedDue] = useState('')
  const [accruedNotes, setAccruedNotes] = useState('')

  const [payAccruedAcc, setPayAccruedAcc] = useState('cash_drawer')

  const [advCustomerId, setAdvCustomerId] = useState('')
  const [advAmount, setAdvAmount] = useState('')
  const [advAcc, setAdvAcc] = useState('cash_drawer')
  const [advNotes, setAdvNotes] = useState('')

  const [expAmount, setExpAmount] = useState('')
  const [expCatId, setExpCatId] = useState('')
  const [expDesc, setExpDesc] = useState('')
  const [expAcc, setExpAcc] = useState('cash_drawer')
  const [expDate, setExpDate] = useState(today())

  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        getBalanceSheet(dateTo),
        getProfitLoss(dateFrom, dateTo),
        getLedger(dateFrom, dateTo, ledgerCategoryFilter),
        getFinancialAccounts(),
        getFixedAssets(),
        getShareholders(),
        calculateProfitDistribution(dateFrom, dateTo, profitDistMethod),
        getAccruedExpenses(),
        getCustomerAdvances(),
        getSalesDetailedMetrics(),
        getExpenses({ date_from: dateFrom, date_to: dateTo }),
        getExpenseCategories(),
        getShareholderLedger(selectedLedgerShareholderId, dateFrom, dateTo)
      ])

      if (results[0].status === 'fulfilled') setBalanceSheet(results[0].value)
      if (results[1].status === 'fulfilled') setPL(results[1].value)
      if (results[2].status === 'fulfilled') setLedgerList(results[2].value || [])
      if (results[3].status === 'fulfilled') setAccountsList(results[3].value || [])
      if (results[4].status === 'fulfilled') setFixedAssets(results[4].value || [])
      if (results[5].status === 'fulfilled') setShareholders(results[5].value || [])
      if (results[6].status === 'fulfilled') setProfitDistReport(results[6].value)
      if (results[7].status === 'fulfilled') setAccruedList(results[7].value || [])
      if (results[8].status === 'fulfilled') setAdvancesList(results[8].value || [])
      if (results[9].status === 'fulfilled') setSalesMetrics(results[9].value)
      if (results[10].status === 'fulfilled') setExpenses(results[10].value || [])
      if (results[11].status === 'fulfilled') setCategories(results[11].value || [])
      if (results[12].status === 'fulfilled') setShareholderLedgerList(results[12].value || [])
      // Load profit distribution & short-term contributions history
      try {
        const allTxs = await Promise.all(
          (results[5].status === 'fulfilled' ? results[5].value || [] : []).map((sh: any) =>
            getEquityTransactions(sh.id).then((txs: any[]) =>
              txs.map(t => ({ ...t, shareholder_name: sh.name }))
            )
          )
        )
        const flatTxs = allTxs.flat().sort((a, b) => b.tx_date.localeCompare(a.tx_date))
        setDistHistory(flatTxs.filter(t => t.tx_type === 'profit_distribution'))
        setShortTermHistory(flatTxs.filter(t => t.tx_type === 'short_term_contribution' || t.tx_type === 'short_term_withdrawal'))
      } catch { /* non-critical */ }
    } catch (err: any) {
      console.error('Error loading accounting data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateFrom, dateTo, ledgerCategoryFilter, profitDistMethod, selectedLedgerShareholderId])

  const handleExportExcel = async () => {
    setExporting(true)
    const t = toast.loading('جاري توليد ملف Excel وفتح نافذة الحفظ...')
    try {
      const saved = await exportFullAccountingExcel(dateFrom, dateTo)
      if (saved) {
        toast.success('تم تصدير وحفظ ملف الحسابات الشامل بنجاح!', { id: t })
      } else {
        toast.dismiss(t)
      }
    } catch (e) {
      toast.error('فشل تصدير ملف Excel', { id: t })
    } finally {
      setExporting(false)
    }
  }

  // Handle Adding Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccName) return toast.error('يرجى كتابة اسم الحساب')
    try {
      await createFinancialAccount({
        name_ar: newAccName,
        min_balance_limit: newAccMin ? parseFloat(newAccMin) : null,
        max_balance_limit: newAccMax ? parseFloat(newAccMax) : null,
      })
      toast.success('تم إنشاء الحساب المالي بنجاح')
      setShowAddAccountModal(false)
      setNewAccName('')
      setNewAccMin('')
      setNewAccMax('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Updating Account Limits
  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showAccountLimitModal) return
    try {
      await updateFinancialAccountLimits({
        id: showAccountLimitModal.id,
        min_balance_limit: newAccMin ? parseFloat(newAccMin) : null,
        max_balance_limit: newAccMax ? parseFloat(newAccMax) : null,
      })
      toast.success('تم حفظ حدود الحساب والتنبيهات')
      setShowAccountLimitModal(null)
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(transferAmount)
    if (!amt || amt <= 0) return toast.error('يرجى كتابة مبلغ صحيح')
    if (!transferTo) return toast.error('يرجى اختيار الحساب المحول إليه')
    try {
      await transferFinancialAmount({
        from_account_id: transferFrom,
        to_account_id: transferTo,
        amount: amt,
        notes: transferNotes || undefined,
      })
      toast.success('تم التحويل بين الحسابات بنجاح')
      setShowTransferModal(false)
      setTransferAmount('')
      setTransferNotes('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Add Fixed Asset
  const handleCreateFixedAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    const cost = parseFloat(assetCost)
    const rate = parseFloat(assetRate)
    if (!assetName || !cost) return toast.error('يرجى إدخال اسم الأصل وتكلفة الشراء')
    try {
      await createFixedAsset({
        name: assetName,
        purchase_date: assetDate,
        purchase_cost: cost,
        depreciation_rate: rate,
        financial_account_id: assetAcc,
        notes: assetNotes || undefined,
      })
      toast.success('تم إضافة الأصل الثابت بنجاح')
      setShowAddAssetModal(false)
      setAssetName('')
      setAssetCost('')
      setAssetNotes('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Record Depreciation
  const handleRecordDepreciation = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(deprAmount)
    if (!amt || amt <= 0) return toast.error('يرجى إدخال قسط إهلاك صحيح')
    try {
      await recordDepreciation({
        asset_id: showDepreciationModal.id,
        amount: amt,
        period_date: deprDate,
        notes: deprNotes || undefined,
      })
      toast.success('تم تسجيل قسط الإهلاك وتحديث القيمة الدفترية')
      setShowDepreciationModal(null)
      setDeprAmount('')
      setDeprNotes('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Add Shareholder
  const handleCreateShareholder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shName) return toast.error('يرجى كتابة اسم الشريك / المساهم')
    const cap = parseFloat(shCapital) || 0
    try {
      await createShareholder({
        name: shName,
        phone: shPhone || undefined,
        initial_capital: cap,
        ownership_percentage: parseFloat(shPct) || 0,
        financial_account_id: cap > 0 ? shAcc : undefined,
        notes: shNotes || undefined,
        user_id: user?.id,
      })
      toast.success('تم إضافة الشريك وتسجيل رصيد تأسيس النقدية بنجاح')
      setShowAddShareholderModal(false)
      setShName('')
      setShPhone('')
      setShCapital('')
      setShPct('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Adjust Financial Account Balance by sadmin
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showAdjustBalanceModal) return
    const newBal = parseFloat(adjustNewBalance)
    if (isNaN(newBal)) return toast.error('يرجى كتابة رصيد الحساب الجديد')

    if (user?.role !== 'admin') {
      return toast.error('تعديل أرصدة الخزائن والنقدية متاح حصرياً لمدراء النظام (Admin Role)')
    }

    try {
      await adjustFinancialAccountBalance({
        financial_account_id: showAdjustBalanceModal.id,
        new_balance: newBal,
        reason: adjustReason || undefined,
        user_id: user?.id,
        username: user?.username || 'admin',
      })
      toast.success('تم تسوية وتعديل رصيد الحساب وتوليد إشعار نظام بالعملية بنجاح')
      setShowAdjustBalanceModal(null)
      setAdjustNewBalance('')
      setAdjustReason('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Equity Transaction
  const handleCreateEquityTx = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(eqTxAmount)
    if (!amt || amt <= 0) return toast.error('يرجى كتابة مبلغ صحيح')
    try {
      await createEquityTransaction({
        shareholder_id: showEquityTxModal.id,
        tx_type: eqTxType,
        amount: amt,
        financial_account_id: eqTxCounterpart === 'cash' ? eqTxAcc : undefined,
        counterpart_type: eqTxCounterpart,
        description: eqTxDesc || undefined,
        tx_date: today(),
      })
      toast.success('تم تسجيل حركة حقوق الملكية بنجاح')
      setShowEquityTxModal(null)
      setEqTxAmount('')
      setEqTxDesc('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Add Accrued Expense
  const handleCreateAccrued = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(accruedAmount)
    if (!accruedTitle || !amt) return toast.error('يرجى إدخال عنوان المصروف والمبلغ')
    try {
      await createAccruedExpense({
        title: accruedTitle,
        amount: amt,
        category_id: accruedCatId ? parseInt(accruedCatId) : undefined,
        due_date: accruedDue || undefined,
        notes: accruedNotes || undefined,
      })
      toast.success('تم تسجيل المصروف المستحق بنجاح')
      setShowAddAccruedModal(false)
      setAccruedTitle('')
      setAccruedAmount('')
      setAccruedNotes('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Pay Accrued
  const handlePayAccrued = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showPayAccruedModal) return
    try {
      await payAccruedExpense({
        id: showPayAccruedModal.id,
        financial_account_id: payAccruedAcc,
      })
      toast.success('تم سداد المصروف المستحق وخصمه من الحساب المالي')
      setShowPayAccruedModal(null)
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Add Customer Advance
  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(advAmount)
    if (!advCustomerId || !amt) return toast.error('يرجى اختيار العميل والمبلغ')
    try {
      await createCustomerAdvance({
        customer_id: advCustomerId,
        amount: amt,
        financial_account_id: advAcc,
        notes: advNotes || undefined,
      })
      toast.success('تم تسجيل الدفعة المقدمة وإضافتها للخزينة')
      setShowAddAdvanceModal(false)
      setAdvAmount('')
      setAdvNotes('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Add Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(expAmount)
    if (!amt || !expCatId) return toast.error('يرجى إدخال المبلغ وتصنيف المصروف')
    try {
      await createExpense({
        category_id: parseInt(expCatId),
        amount: amt,
        description: expDesc || undefined,
        is_recurring: false,
        expense_date: expDate,
        financial_account_id: expAcc,
      })
      toast.success('تم تسجيل المصروف بنجاح')
      setShowAddExpenseModal(false)
      setExpAmount('')
      setExpDesc('')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      {/* Top Header */}
      <div className="page-header flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Scale size={28} style={{ color: 'var(--clr-primary)' }} />
            النظام المحاسبي المتكامل
          </h1>
          <p className="text-sm" style={{ color: 'var(--clr-muted)' }}>
            دفاتر أستاذ وفق المعايير المالية • المركز المالي • قائمة الدخل • توزيع أرباح الشركاء
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="date"
            className="input"
            style={{ width: 150 }}
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
          <span style={{ color: 'var(--clr-muted)' }}>—</span>
          <input
            type="date"
            className="input"
            style={{ width: 150 }}
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => { setDateFrom(monthStart()); setDateTo(today()) }}>هذا الشهر</button>
          <button className="btn-secondary" onClick={() => { setDateFrom(yearStart()); setDateTo(today()) }}>هذا العام</button>
          <button className="btn-primary flex items-center gap-2" onClick={handleExportExcel} disabled={exporting}>
            <FileSpreadsheet size={16} />
            تصدير تقرير Excel الشامل
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b" style={{ borderColor: 'var(--clr-border)' }}>
        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'balance_sheet' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('balance_sheet')}
        >
          <Scale size={16} />
          قائمة المركز المالي (الميزانية)
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'pl' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('pl')}
        >
          <TrendingUp size={16} />
          قائمة الدخل (الأرباح والخسائر)
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'profit_distribution' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('profit_distribution')}
        >
          <ArrowRightLeft size={16} />
          توزيع الأرباح على المساهمين
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'ledger' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('ledger')}
        >
          <Clock size={16} />
          دفاتر الأستاذ العام
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'shareholders' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('shareholders')}
        >
          <Users size={16} />
          المساهمين وتوزيع الأرباح
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'shareholders_ledger' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('shareholders_ledger')}
        >
          <Users size={16} />
          دفتر أستاذ الشركاء بالرصيد الجاري
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'fixed_assets' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('fixed_assets')}
        >
          <Building2 size={16} />
          الأصول الثابتة والإهلاك
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'accrued' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('accrued')}
        >
          <AlertTriangle size={16} />
          المصروفات المستحقة
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'advances' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('advances')}
        >
          <DollarSign size={16} />
          الدفعات المقدمة
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'accounts' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('accounts')}
        >
          <ArrowRightLeft size={16} />
          الحسابات والسيولة والحدود
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 flex items-center gap-2 font-bold ${tab === 'sales_detailed' ? 'badge-primary shadow-lg' : 'badge-muted'}`}
          onClick={() => setTab('sales_detailed')}
        >
          <CheckCircle2 size={16} />
          تفاصيل مبيعات اليوم والشهر
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 1. BALANCE SHEET TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'balance_sheet' && !balanceSheet && (
        <div className="glass-card p-12 text-center text-[var(--clr-muted)] space-y-3">
          <Scale size={36} className="mx-auto text-[var(--clr-primary)] animate-pulse" />
          <p className="font-bold text-base text-[var(--clr-text)]">
            {loading ? 'جاري إعداد واحتساب قائمة المركز المالي (الميزانية العمومية)...' : 'لا تتوفر بيانات للميزانية حالياً'}
          </p>
          <button type="button" onClick={loadData} className="btn-secondary text-xs px-4 py-2 font-bold inline-flex items-center gap-1.5">
            <RotateCcw size={14} /> إعادة تحميل التقرير
          </button>
        </div>
      )}

      {tab === 'balance_sheet' && balanceSheet && (
        <div className="flex flex-col gap-6">
          {/* Balance Indicator Alert */}
          <div
            className="glass-card p-4 flex items-center justify-between"
            style={{
              borderColor: balanceSheet.is_balanced ? 'rgba(68,232,135,0.4)' : 'rgba(255,92,124,0.4)',
              background: balanceSheet.is_balanced ? 'rgba(68,232,135,0.05)' : 'rgba(255,92,124,0.05)'
            }}
          >
            <div className="flex items-center gap-3">
              {balanceSheet.is_balanced ? (
                <ShieldCheck size={28} style={{ color: 'var(--clr-success)' }} />
              ) : (
                <AlertTriangle size={28} style={{ color: 'var(--clr-danger)' }} />
              )}
              <div>
                <h4 className="font-bold text-base">
                  {balanceSheet.is_balanced ? 'الميزانية متزنة تماماً وفقاً للمعايير المحاسبية' : 'تنبيه: يوجد فرق في اتزان الميزانية'}
                </h4>
                <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                  إجمالي الأصول ({formatEGP(balanceSheet.total_assets)}) = إجمالي الالتزامات ({formatEGP(balanceSheet.total_liabilities)}) + حقوق الملكية ({formatEGP(balanceSheet.total_equity)})
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className={`badge ${balanceSheet.is_balanced ? 'badge-success' : 'badge-danger'}`}>
                {balanceSheet.is_balanced ? 'متزنة (Balanced)' : `الفرق: ${formatEGP(balanceSheet.discrepancy)}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: ASSETS (الأصول) */}
            <div className="glass-card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
                <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
                  <Building2 size={20} />
                  الأصول (Assets)
                </h3>
                <span className="font-black text-xl" style={{ color: 'var(--clr-primary)' }}>
                  {formatEGP(balanceSheet.total_assets)}
                </span>
              </div>

              {/* Current Assets */}
              <div className="flex flex-col gap-2">
                <h4 className="font-bold text-sm" style={{ color: 'var(--clr-accent)' }}>1. الأصول المتداولة (Current Assets)</h4>
                
                <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                  <span className="text-sm font-medium">النقدية والبنوك والمحافظ (Cash & Banks)</span>
                  <span className="font-bold">{formatEGP(balanceSheet.cash_and_banks)}</span>
                </div>

                <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                  <span className="text-sm font-medium">العملاء والمدينون - البيع الآجل (Accounts Receivable)</span>
                  <span className="font-bold">{formatEGP(balanceSheet.accounts_receivable)}</span>
                </div>

                <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                  <span className="text-sm font-medium">المخزون السلعي (Inventory at Cost)</span>
                  <span className="font-bold">{formatEGP(balanceSheet.inventory_value)}</span>
                </div>

                <div className="flex justify-between items-center py-2 px-3 border-t font-bold" style={{ borderColor: 'var(--clr-border)' }}>
                  <span>إجمالي الأصول المتداولة:</span>
                  <span style={{ color: 'var(--clr-accent)' }}>{formatEGP(balanceSheet.total_current_assets)}</span>
                </div>
              </div>

              {/* Fixed Assets */}
              <div className="flex flex-col gap-2 mt-4">
                <h4 className="font-bold text-sm" style={{ color: 'var(--clr-accent)' }}>2. الأصول الثابتة (Fixed Assets)</h4>
                
                <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                  <span className="text-sm font-medium">تكلفة الأصول الثابتة (Gross Fixed Assets)</span>
                  <span className="font-bold">{formatEGP(balanceSheet.fixed_assets_gross)}</span>
                </div>

                <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                  <span className="text-sm font-medium">يطرح: مجمع الإهلاك (Accumulated Depreciation)</span>
                  <span className="font-bold" style={{ color: 'var(--clr-danger)' }}>-{formatEGP(balanceSheet.accumulated_depreciation)}</span>
                </div>

                <div className="flex justify-between items-center py-2 px-3 border-t font-bold" style={{ borderColor: 'var(--clr-border)' }}>
                  <span>صافي الأصول الثابتة (Net Book Value):</span>
                  <span style={{ color: 'var(--clr-accent)' }}>{formatEGP(balanceSheet.fixed_assets_net)}</span>
                </div>
              </div>
            </div>

            {/* Right Column: LIABILITIES & EQUITY (الالتزامات وحقوق الملكية) */}
            <div className="flex flex-col gap-6">
              {/* Liabilities */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
                  <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: 'var(--clr-warning)' }}>
                    <AlertTriangle size={20} />
                    الالتزامات والخصوم (Liabilities)
                  </h3>
                  <span className="font-black text-xl" style={{ color: 'var(--clr-warning)' }}>
                    {formatEGP(balanceSheet.total_liabilities)}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                    <span className="text-sm font-medium">الموردون والدائنون - مشتريات آجلة (Accounts Payable)</span>
                    <span className="font-bold">{formatEGP(balanceSheet.accounts_payable)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                    <span className="text-sm font-medium">الالتزامات والاستحقاقات المالية الموحدة (Liabilities & Accrued Obligations)</span>
                    <span className="font-bold text-amber-400">{formatEGP(balanceSheet.accrued_expenses)}</span>
                  </div>
                </div>
              </div>

              {/* Equity */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
                  <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: 'var(--clr-success)' }}>
                    <Users size={20} />
                    حقوق الملكية (Equity)
                  </h3>
                  <span className="font-black text-xl" style={{ color: 'var(--clr-success)' }}>
                    {formatEGP(balanceSheet.total_equity)}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                    <span className="text-sm font-medium">رأس المال الأساسي (Share Capital)</span>
                    <span className="font-bold">{formatEGP(balanceSheet.capital)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                    <span className="text-sm font-medium">المساهمات قصيرة الأجل (Short-term Contributions)</span>
                    <span className="font-bold">{formatEGP(balanceSheet.short_term_contributions)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                    <span className="text-sm font-medium">يطرح: مسحوبات الشركاء (Drawings)</span>
                    <span className="font-bold" style={{ color: 'var(--clr-danger)' }}>-{formatEGP(balanceSheet.drawings)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ background: 'var(--clr-surface-2)' }}>
                    <span className="text-sm font-medium">الأرباح المحتجزة / صافي أرباح الفترة (Net Earnings)</span>
                    <span className="font-bold font-mono" style={{ color: balanceSheet.retained_and_current_earnings >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                      {formatEGP(balanceSheet.retained_and_current_earnings)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 2.5. PROFIT DISTRIBUTION TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'profit_distribution' && (
        <div className="flex flex-col gap-6 animate-slide-up">

          {/* ── Summary Banner ── */}
          {profitDistReport && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-5 flex flex-col gap-1">
                <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>صافي الربح / الخسارة للفترة</span>
                <span className={`text-3xl font-black font-mono ${profitDistReport.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatEGP(profitDistReport.net_profit)}
                </span>
                <span className="text-xs" style={{ color: 'var(--clr-muted)' }}>{dateFrom} → {dateTo}</span>
              </div>
              <div className="glass-card p-5 flex flex-col gap-1">
                <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>إجمالي عمولات الخدمات المالية</span>
                <span className="text-3xl font-black font-mono text-amber-400">
                  {formatEGP(profitDistReport.monetary_commissions ?? 0)}
                </span>
                <span className="text-xs" style={{ color: 'var(--clr-muted)' }}>تُوزَّع 50% منها على مقدمي المساهمات قصيرة الأجل (الطريقة 1)</span>
              </div>
              <div className="glass-card p-5 flex flex-col gap-1">
                <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>عدد المساهمين</span>
                <span className="text-3xl font-black font-mono" style={{ color: 'var(--clr-primary)' }}>
                  {profitDistReport.shareholders?.length ?? 0}
                </span>
                <span className="text-xs" style={{ color: 'var(--clr-muted)' }}>شريك / مساهم مسجل في النظام</span>
              </div>
            </div>
          )}

          {/* ── Profit Distribution Calculator ── */}
          <div className="glass-card p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <Calculator size={20} style={{ color: 'var(--clr-accent)' }} />
                  حاسبة توزيع الأرباح والخسائر على المساهمين
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--clr-muted)' }}>
                  وفق المعايير المحاسبية الدولية (IFRS / GAAP) — التوزيع النسبي بحسب حقوق الملكية
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>طريقة الحساب:</span>
                  <select
                    className="input py-1.5 text-sm font-bold"
                    value={profitDistMethod}
                    onChange={e => setProfitDistMethod(e.target.value as any)}
                  >
                    <option value="method_1">الطريقة 1 — النسبة الأساسية + 50% من عمولات الخدمات المالية للمساهمة قصيرة الأجل</option>
                    <option value="method_2">الطريقة 2 — المتوسط الموزون بإجمالي حقوق الملكية (رأس المال + المساهمة قصيرة الأجل)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Method explanation card */}
            <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(124,107,255,0.08)', border: '1px solid rgba(124,107,255,0.2)' }}>
              {profitDistMethod === 'method_1' ? (
                <div className="flex flex-col gap-1">
                  <span className="font-bold" style={{ color: 'var(--clr-primary)' }}>📐 الطريقة الأولى — الأساس + العمولات:</span>
                  <span style={{ color: 'var(--clr-muted)' }}>• نصيب الشريك من صافي الربح = <strong>نسبة ملكيته × صافي الربح الكلي</strong></span>
                  <span style={{ color: 'var(--clr-muted)' }}>• نصيب إضافي من العمولات = <strong>50% من إجمالي العمولات × (مساهمته قصيرة الأجل ÷ إجمالي المساهمات قصيرة الأجل)</strong></span>
                  <span style={{ color: 'var(--clr-muted)' }}>• الإجمالي = <strong>الجزء الأول + الجزء الإضافي</strong> — تُعكَس كقيد: مدين حقوق الملكية / دائن النقدية</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="font-bold" style={{ color: 'var(--clr-primary)' }}>📐 الطريقة الثانية — المتوسط الموزون الكلي:</span>
                  <span style={{ color: 'var(--clr-muted)' }}>• حصة الشريك = <strong>(رأس ماله + مساهمته قصيرة الأجل) ÷ إجمالي حقوق الملكية</strong></span>
                  <span style={{ color: 'var(--clr-muted)' }}>• النصيب = <strong>هذه النسبة × (صافي الربح + إجمالي العمولات)</strong></span>
                  <span style={{ color: 'var(--clr-muted)' }}>• الإجمالي — قيد: مدين الأرباح المحتجزة (Retained Earnings) / دائن حسابات الشركاء (Partners' Current)</span>
                </div>
              )}
            </div>

            {profitDistReport && profitDistReport.shareholders?.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                        <th className="py-3 px-3 font-bold">اسم الشريك / المساهم</th>
                        <th className="py-3 px-3 font-bold">رأس المال الأساسي</th>
                        <th className="py-3 px-3 font-bold">المساهمة قصيرة الأجل</th>
                        <th className="py-3 px-3 font-bold">نسبة الملكية</th>
                        <th className="py-3 px-3 font-bold">نصيبه من الربح الأساسي</th>
                        <th className="py-3 px-3 font-bold">نصيبه من العمولات</th>
                        <th className="py-3 px-3 font-bold text-lg" style={{ color: 'var(--clr-success)' }}>إجمالي نصيبه 💰</th>
                        <th className="py-3 px-3 font-bold">النسبة الفعلية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      {profitDistReport.shareholders.map((s: any) => (
                        <tr key={s.shareholder_id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 font-bold text-base">{s.shareholder_name}</td>
                          <td className="py-3 px-3 font-mono">{formatEGP(s.base_capital)}</td>
                          <td className="py-3 px-3 font-mono text-emerald-400">{formatEGP(s.short_term_contribution)}</td>
                          <td className="py-3 px-3">
                            <span className="badge badge-primary font-bold">{s.base_equity_pct?.toFixed(1)}%</span>
                          </td>
                          <td className="py-3 px-3 font-mono">{formatEGP(s.profit_from_base_capital)}</td>
                          <td className="py-3 px-3 font-mono text-amber-400">{formatEGP(s.profit_from_monetary_commissions)}</td>
                          <td className="py-3 px-3 font-black font-mono text-lg" style={{ color: s.total_profit_share >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                            {formatEGP(s.total_profit_share)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="badge badge-muted text-xs">{s.effective_pct?.toFixed(2)}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2" style={{ borderColor: 'var(--clr-primary)' }}>
                        <td colSpan={6} className="py-3 px-3 font-black text-right" style={{ color: 'var(--clr-primary)' }}>إجمالي الأرباح الموزعة:</td>
                        <td className="py-3 px-3 font-black font-mono text-xl" style={{ color: 'var(--clr-success)' }}>
                          {formatEGP(profitDistReport.shareholders.reduce((sum: number, s: any) => sum + s.total_profit_share, 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Booking Section */}
                {profitDistReport.net_profit > 0 && (
                  <div className="rounded-xl p-5 flex flex-col gap-4" style={{ background: 'var(--clr-surface-2)', border: '1px solid rgba(0,212,170,0.25)' }}>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-bold text-base">تثبيت التوزيع في السجلات المحاسبية</h4>
                        <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                          يُسجَّل توزيع الأرباح كقيود في equity_transactions بنوع profit_distribution مع تسوية النقدية من الحساب المحدد. وفق المعيار IAS 1 و IFRS يُدرج في حقوق الملكية (Retained Earnings → Partners' Current Account).
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>حساب الدفع المنسحب منه:</label>
                        <select
                          className="input py-1.5 text-sm"
                          value={distFinancialAccId}
                          onChange={e => setDistFinancialAccId(e.target.value)}
                        >
                          {accountsList.map((acc: any) => (
                            <option key={acc.id} value={acc.id}>{acc.name} — {formatEGP(acc.balance)}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="btn-primary flex items-center gap-2 font-bold"
                        disabled={confirmingDist}
                        onClick={async () => {
                          if (!profitDistReport || !profitDistReport.shareholders?.length) return
                          setConfirmingDist(true)
                          try {
                            // Book a profit_distribution equity transaction for each shareholder
                            await Promise.all(
                              profitDistReport.shareholders.map((s: any) =>
                                createEquityTransaction({
                                  shareholder_id: s.shareholder_id,
                                  tx_type: 'profit_distribution',
                                  amount: s.total_profit_share,
                                  financial_account_id: distFinancialAccId,
                                  counterpart_type: 'cash',
                                  description: `توزيع أرباح الفترة ${dateFrom} — ${dateTo} — ${profitDistMethod === 'method_1' ? 'الطريقة الأولى (الأساس + العمولات)' : 'الطريقة الثانية (المتوسط الموزون)'}`,
                                })
                              )
                            )
                            toast.success('✅ تم تثبيت توزيع الأرباح بنجاح في السجلات المحاسبية!')
                            loadData()
                          } catch (e: any) {
                            toast.error('فشل تثبيت التوزيع: ' + e.toString())
                          } finally {
                            setConfirmingDist(false)
                          }
                        }}
                      >
                        <CheckCircle2 size={16} />
                        {confirmingDist ? 'جاري التثبيت...' : 'تثبيت التوزيع في السجلات'}
                      </button>
                    </div>
                  </div>
                )}

                {profitDistReport.net_profit < 0 && (
                  <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,80,100,0.08)', border: '1px solid rgba(255,80,100,0.25)' }}>
                    <AlertTriangle size={20} className="text-red-400 shrink-0" />
                    <div className="text-sm">
                      <span className="font-bold text-red-400">تنبيه: النتيجة خسارة للفترة المحددة.</span>
                      <span className="ms-2" style={{ color: 'var(--clr-muted)' }}>وفق المعايير المحاسبية، الخسائر تُحمَّل على الأرباح المحتجزة أو تُوزَّع على الشركاء بنفس النسب ويُسجَّل كسحب سلبي. يُنصح باستشارة المحاسب قبل التثبيت.</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10" style={{ color: 'var(--clr-muted)' }}>
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p>لم يتم إضافة مساهمين بعد — أضفهم من تبويب <strong>المساهمين وحقوق الملكية</strong></p>
              </div>
            )}
          </div>

          {/* ── Distribution History ── */}
          {distHistory.length > 0 && (
            <div className="glass-card p-6 flex flex-col gap-4">
              <h3 className="font-bold text-lg flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
                <Clock size={18} style={{ color: 'var(--clr-accent)' }} />
                سجل التوزيعات المثبتة السابقة
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                      <th className="py-2 px-3 font-bold">التاريخ</th>
                      <th className="py-2 px-3 font-bold">اسم الشريك</th>
                      <th className="py-2 px-3 font-bold">المبلغ الموزع</th>
                      <th className="py-2 px-3 font-bold">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {distHistory.map((d: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-xs">{d.tx_date}</td>
                        <td className="py-2.5 px-3 font-bold">{d.shareholder_name}</td>
                        <td className="py-2.5 px-3 font-black font-mono" style={{ color: 'var(--clr-success)' }}>{formatEGP(d.amount)}</td>
                        <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--clr-muted)' }}>{d.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 2. INCOME STATEMENT (P&L) TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'pl' && pl && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-6">
            {/* 1. Revenues */}
            <div className="glass-card p-6 flex flex-col gap-3">
              <h3 className="font-bold text-lg border-b pb-2 flex items-center justify-between" style={{ borderColor: 'var(--clr-border)' }}>
                <span>1. إجمالي الإيرادات (Revenues)</span>
                <span className="font-black text-xl" style={{ color: 'var(--clr-primary)' }}>{formatEGP(pl.total_revenue)}</span>
              </h3>
              <div className="flex justify-between py-1 text-sm">
                <span>إيرادات مبيعات المنتجات</span>
                <span className="font-bold">{formatEGP(pl.sales_revenue)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span>إيرادات خدمات الصيانة</span>
                <span className="font-bold">{formatEGP(pl.repair_revenue)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span>عمولات الخدمات المالية والمحافظ</span>
                <span className="font-bold">{formatEGP(pl.monetary_revenue)}</span>
              </div>
            </div>

            {/* 2. Direct Costs & Gross Profit */}
            <div className="glass-card p-6 flex flex-col gap-3">
              <h3 className="font-bold text-lg border-b pb-2 flex items-center justify-between" style={{ borderColor: 'var(--clr-border)' }}>
                <span>2. المصروفات والتكاليف المباشرة (Direct Costs)</span>
                <span className="font-black text-xl" style={{ color: 'var(--clr-danger)' }}>-{formatEGP(pl.total_direct_costs)}</span>
              </h3>
              <div className="flex justify-between py-1 text-sm">
                <span>تكلفة البضاعة المباعة (COGS)</span>
                <span className="font-bold text-red-400">-{formatEGP(pl.cogs)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span>تكلفة بضاعة الهالك والتالف (Damaged Stock)</span>
                <span className="font-bold text-red-400">-{formatEGP(pl.damaged_goods_cost)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span>تكلفة قطع الصيانة المباشرة (Parts Cost)</span>
                <span className="font-bold text-red-400">-{formatEGP(pl.repair_parts_cost)}</span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl border mt-2 font-black text-lg" style={{ background: 'rgba(68,232,135,0.08)', borderColor: 'rgba(68,232,135,0.3)' }}>
                <span>إجمالي الربح (Gross Profit):</span>
                <span style={{ color: 'var(--clr-success)' }}>{formatEGP(pl.gross_profit)}</span>
              </div>
            </div>

            {/* 3. Operating & Indirect Expenses */}
            <div className="glass-card p-6 flex flex-col gap-3">
              <h3 className="font-bold text-lg border-b pb-2 flex items-center justify-between" style={{ borderColor: 'var(--clr-border)' }}>
                <span>3. المصروفات التشغيلية وغير المباشرة والإهلاك</span>
                <span className="font-black text-xl" style={{ color: 'var(--clr-warning)' }}>-{formatEGP(pl.total_expenses)}</span>
              </h3>
              {pl.expense_breakdown.map((e: any, idx: number) => (
                <div key={idx} className="flex justify-between py-1 text-sm">
                  <span>{e.category}</span>
                  <span className="font-bold" style={{ color: 'var(--clr-danger)' }}>-{formatEGP(e.amount)}</span>
                </div>
              ))}
            </div>

            {/* Net Profit Banner */}
            <div
              className="glass-card p-6 flex items-center justify-between shadow-2xl"
              style={{
                background: pl.net_profit >= 0 ? 'rgba(68,232,135,0.12)' : 'rgba(255,92,124,0.12)',
                borderColor: pl.net_profit >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)'
              }}
            >
              <div>
                <h3 className="font-bold text-xl">صافي الربح / الخسارة (Net Profit/Loss)</h3>
                <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>يُرحل تلقائياً إلى قائمة المركز المالي ضمن حقوق الملكية</p>
              </div>
              <div className="text-3xl font-black" style={{ color: pl.net_profit >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                {formatEGP(pl.net_profit)}
              </div>
            </div>
          </div>

          {/* Right Column: Chart */}
          <div className="flex flex-col gap-6">
            <div className="glass-card p-6 flex flex-col gap-4">
              <h3 className="font-bold text-base">توزيع المصروفات</h3>
              {pl.expense_breakdown.length > 0 ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pl.expense_breakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {pl.expense_breakdown.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatEGP(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--clr-muted)' }}>لا توجد بيانات مصروفات</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 3. GENERAL LEDGERS TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'ledger' && (
        <div className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <h3 className="font-bold text-lg">سجل دفاتر الأستاذ العام (General Ledger)</h3>
              <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>عرض كافة القيود والحركات المحاسبية مصنفة حسب بنود الأصول والخصوم وحقوق الملكية</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>تصنيف دفتر الأستاذ:</span>
              <select
                className="input py-1 text-sm font-bold"
                value={ledgerCategoryFilter}
                onChange={e => setLedgerCategoryFilter(e.target.value)}
              >
                <option value="all">جميع دفاتر الأستاذ</option>
                <option value="assets_cash">دفتر أستاذ النقدية والحسابات المالية</option>
                <option value="assets_inventory">دفتر أستاذ المخزون السلعي والهالك</option>
                <option value="assets_fixed">دفتر أستاذ الأصول الثابتة</option>
                <option value="assets_customers">دفتر أستاذ العملاء والمدينين</option>
                <option value="liabilities_suppliers">دفتر أستاذ الموردين والدائنين</option>
                <option value="equity">دفتر أستاذ حقوق الملكية والشركاء</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                  <th className="py-3 px-2 font-bold">التاريخ</th>
                  <th className="py-3 px-2 font-bold">نوع الحركة</th>
                  <th className="py-3 px-2 font-bold">البيان / الشرح</th>
                  <th className="py-3 px-2 font-bold">مدين (Debit)</th>
                  <th className="py-3 px-2 font-bold">دائن (Credit)</th>
                  <th className="py-3 px-2 font-bold">الحساب المالي</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {ledgerList.length > 0 ? (
                  ledgerList.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-2 text-xs font-mono">{formatDateTime(row.date)}</td>
                      <td className="py-2.5 px-2">
                        <span className="badge badge-primary text-xs">{row.tx_type}</span>
                      </td>
                      <td className="py-2.5 px-2 text-xs">{row.description}</td>
                      <td className="py-2.5 px-2 font-bold font-mono" style={{ color: row.debit > 0 ? 'var(--clr-success)' : 'var(--clr-muted)' }}>
                        {row.debit > 0 ? formatEGP(row.debit) : '—'}
                      </td>
                      <td className="py-2.5 px-2 font-bold font-mono" style={{ color: row.credit > 0 ? 'var(--clr-danger)' : 'var(--clr-muted)' }}>
                        {row.credit > 0 ? formatEGP(row.credit) : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-xs font-medium" style={{ color: 'var(--clr-accent)' }}>
                        {row.financial_account_name}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-sm" style={{ color: 'var(--clr-muted)' }}>
                      لا توجد قيود مسجلة لهذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SHAREHOLDERS' EQUITY LEDGER TAB (دفتر أستاذ الشركاء مع صافي القيمة بعد كل حركة) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'shareholders_ledger' && (
        <div className="glass-card p-6 flex flex-col gap-4 animate-slide-up">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users size={20} style={{ color: 'var(--clr-primary)' }} />
                دفتر أستاذ حقوق المساهمين والشركاء (Shareholders' Ledger)
              </h3>
              <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                كشف حساب تفصيلي بحركات وحقوق الشركاء متضمناً <strong>صافي القيمة / الرصيد الجاري للشريك بعد كل حركة</strong> لمطابقة معايير IFRS
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>اختر الشريك:</span>
                <select
                  className="input py-1 text-xs font-bold"
                  value={selectedLedgerShareholderId}
                  onChange={e => setSelectedLedgerShareholderId(e.target.value)}
                >
                  <option value="all">جميع الشركاء والمساهمين</option>
                  {shareholders.map((sh: any) => (
                    <option key={sh.id} value={sh.id}>{sh.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const shName = selectedLedgerShareholderId === 'all'
                    ? 'جميع الشركاء'
                    : shareholders.find((s: any) => s.id === selectedLedgerShareholderId)?.name || 'شريك'
                  const t = toast.loading('جاري استخراج ملف Excel كشف حساب الشريك...')
                  try {
                    await exportShareholderLedgerExcel(shareholderLedgerList, shName, dateFrom, dateTo)
                    toast.success('تم تصدير دفتر أستاذ الشركاء لـ Excel بنجاح!', { id: t })
                  } catch (e: any) {
                    toast.error('فشل تصدير الكشف: ' + e.toString(), { id: t })
                  }
                }}
                className="btn-secondary text-xs px-3 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
              >
                <FileSpreadsheet size={15} /> تصدير لـ Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                  <th className="py-3 px-2 font-bold">التاريخ والتوقيت</th>
                  <th className="py-3 px-2 font-bold">الشريك / المساهم</th>
                  <th className="py-3 px-2 font-bold">نوع الحركة</th>
                  <th className="py-3 px-2 font-bold">البيان والشرح المحاسبي</th>
                  <th className="py-3 px-2 font-bold text-emerald-400">إيداع / أرباح (+)</th>
                  <th className="py-3 px-2 font-bold text-red-400">مسحوبات (-)</th>
                  <th className="py-3 px-2 font-bold text-cyan-300">صافي القيمة (الرصيد الجاري) 💰</th>
                  <th className="py-3 px-2 font-bold">الحساب النقدي المقابل</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {shareholderLedgerList.length > 0 ? (
                  shareholderLedgerList.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-2 text-xs font-mono">{formatDateTime(row.tx_date)}</td>
                      <td className="py-2.5 px-2 font-bold text-xs">{row.shareholder_name}</td>
                      <td className="py-2.5 px-2">
                        <span className="badge badge-primary text-xs font-bold">{row.tx_type_label || row.tx_type}</span>
                      </td>
                      <td className="py-2.5 px-2 text-xs">{row.description}</td>
                      <td className="py-2.5 px-2 font-bold font-mono text-xs text-emerald-400">
                        {row.debit > 0 ? formatEGP(row.debit) : '—'}
                      </td>
                      <td className="py-2.5 px-2 font-bold font-mono text-xs text-red-400">
                        {row.credit > 0 ? formatEGP(row.credit) : '—'}
                      </td>
                      <td className="py-2.5 px-2 font-mono font-black text-sm text-cyan-300">
                        {formatEGP(row.running_balance)}
                      </td>
                      <td className="py-2.5 px-2 text-xs font-medium" style={{ color: 'var(--clr-accent)' }}>
                        {row.financial_account_name}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-sm" style={{ color: 'var(--clr-muted)' }}>
                      لا توجد حركات مسجلة لحسابات الشركاء لهذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 4. SHAREHOLDERS & PROFIT DISTRIBUTION TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'shareholders' && (
        <div className="flex flex-col gap-6">
          {/* Shareholders Summary Cards */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <h3 className="font-bold text-lg">قائمة الشركاء والمساهمين</h3>
                <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>تقسيم حقوق المساهمين إلى رأس مال أساسي ومساهمات قصيرة الأجل</p>
              </div>
              <button className="btn-primary flex items-center gap-2" onClick={() => setShowAddShareholderModal(true)}>
                <Plus size={16} />
                إضافة شريك جديد
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {shareholders.map(sh => (
                <div key={sh.id} className="p-4 rounded-xl border flex flex-col gap-3" style={{ background: 'var(--clr-surface-2)', borderColor: 'var(--clr-border)' }}>
                  <div className="flex items-center justify-between font-bold text-base">
                    <span>{sh.name}</span>
                    <span className="badge badge-primary">{sh.ownership_percentage}%</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--clr-muted)' }}>
                    <div className="flex justify-between">
                      <span>رأس المال الأساسي:</span>
                      <span className="font-bold font-mono text-white">{formatEGP(sh.initial_capital)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>المساهمة قصيرة الأجل:</span>
                      <span className="font-bold font-mono text-emerald-400">{formatEGP(sh.short_term_balance)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-bold text-white">
                      <span>إجمالي حقوق الشريك:</span>
                      <span className="font-mono text-indigo-400">{formatEGP(sh.total_equity)}</span>
                    </div>
                  </div>
                  <button
                    className="btn-secondary text-xs py-1.5 flex items-center justify-center gap-1 mt-1"
                    onClick={() => setShowEquityTxModal(sh)}
                  >
                    <Plus size={14} />
                    تسجيل حركة / مساهمة / سحب
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Profit Distribution Calculator */}
          {profitDistReport && (
            <div className="glass-card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Calculator size={20} style={{ color: 'var(--clr-accent)' }} />
                    حاسبة توزيع الأرباح على الشركاء
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                    صافي أرباح الفترة: {formatEGP(profitDistReport.net_profit)} • إجمالي عمولات الخدمات المالية: {formatEGP(profitDistReport.monetary_commissions)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>طريقة الحساب:</span>
                  <select
                    className="input py-1 text-sm font-bold"
                    value={profitDistMethod}
                    onChange={e => setProfitDistMethod(e.target.value as any)}
                  >
                    <option value="method_1">الطريقة 1: النسبة الأساسية + 50% من عمولات الخدمات المالية للمساهمة قصيرة الأجل</option>
                    <option value="method_2">الطريقة 2: متوسط النصيب من إجمالي حقوق الملكية (رأس المال + المساهمة قصيرة الأجل)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                      <th className="py-3 px-2 font-bold">اسم الشريك</th>
                      <th className="py-3 px-2 font-bold">رأس المال الأساسي</th>
                      <th className="py-3 px-2 font-bold">المساهمة قصيرة الأجل</th>
                      <th className="py-3 px-2 font-bold">نسبة الملكية</th>
                      <th className="py-3 px-2 font-bold">الربح من رأس المال</th>
                      <th className="py-3 px-2 font-bold">الربح من العمولات</th>
                      <th className="py-3 px-2 font-bold">إجمالي نصيب الربح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {profitDistReport.shareholders.map((s: any) => (
                      <tr key={s.shareholder_id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2 font-bold">{s.shareholder_name}</td>
                        <td className="py-3 px-2 font-mono">{formatEGP(s.base_capital)}</td>
                        <td className="py-3 px-2 font-mono text-emerald-400">{formatEGP(s.short_term_contribution)}</td>
                        <td className="py-3 px-2 font-bold">{s.base_equity_pct}%</td>
                        <td className="py-3 px-2 font-mono">{formatEGP(s.profit_from_base_capital)}</td>
                        <td className="py-3 px-2 font-mono text-amber-400">{formatEGP(s.profit_from_monetary_commissions)}</td>
                        <td className="py-3 px-2 font-black font-mono text-base" style={{ color: 'var(--clr-success)' }}>
                          {formatEGP(s.total_profit_share)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Short-Term Contributions Breakdown Card */}
          <div className="glass-card p-6 flex flex-col gap-6 border border-amber-500/30">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
                  <Scale size={20} />
                  بند تفصيلي: أرباح المساهمات قصيرة الأجل وعمولات الخدمات المالية المحسوبة يومياً
                </h3>
                <p className="text-xs text-[var(--clr-muted)]">
                  يتم احتساب نصيب الشريك في 50% من عمولات الخدمات المالية بشكل يومي حسب نسبته كل يوم على حدة وتراكمها للفترة المختارة نظرًا لتغير المساهمة مع الوقت فور كل إيداع أو سحب.
                </p>
              </div>
              <div className="text-left font-mono text-xs">
                <span className="text-[var(--clr-muted)] block">إجمالي المساهمات قصيرة الأجل الحالية:</span>
                <span className="text-emerald-400 font-bold text-base">
                  {formatEGP(shareholders.reduce((sum, s) => sum + (s.short_term_balance || 0), 0))}
                </span>
              </div>
            </div>

            {/* Sub-table 1: Profit share breakdown from profitDistReport */}
            <div>
              <h4 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
                <span>1. تجميع الأرباح اليومية المستحقة لكل شريك من عمولات الخدمات المالية:</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>اسم الشريك</th>
                      <th>رصيد المساهمة قصيرة الأجل الحالية</th>
                      <th>النسبة من إجمالي المساهمات (%)</th>
                      <th>النصيب التراكمي المحسوب يومياً (من 50% عمولات)</th>
                      <th>إجمالي حقوق الشريك</th>
                      <th className="text-center">إجراءات سحب / إيداع المساهمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totalST = shareholders.reduce((sum, s) => sum + (s.short_term_balance || 0), 0)

                      return shareholders.map(sh => {
                        const stBal = sh.short_term_balance || 0
                        const stRatio = totalST > 0 ? (stBal / totalST) : 0
                        // Get daily accumulated commission share from server profitDistReport
                        const repItem = profitDistReport?.shareholders?.find((s: any) => s.shareholder_id === sh.id)
                        const commShare = repItem ? repItem.profit_from_monetary_commissions : 0

                        return (
                          <tr key={sh.id} className="hover:bg-white/5 transition-colors">
                            <td className="font-bold text-sm text-white">{sh.name}</td>
                            <td className="font-mono font-bold text-emerald-400">{formatEGP(stBal)}</td>
                            <td className="font-bold text-amber-300">
                              {totalST > 0 ? `${(stRatio * 100).toFixed(1)}%` : '0%'}
                            </td>
                            <td className="font-mono font-bold text-indigo-300">{formatEGP(commShare)}</td>
                            <td className="font-mono font-bold text-white">{formatEGP(sh.total_equity)}</td>
                            <td className="text-center flex justify-center gap-1">
                              <button
                                className="btn-secondary text-[11px] py-1 px-2.5 font-bold cursor-pointer text-emerald-400 hover:border-emerald-400"
                                onClick={() => {
                                  setEqTxType('short_term_contribution')
                                  setShowEquityTxModal(sh)
                                }}
                              >
                                + إيداع مساهمة
                              </button>
                              <button
                                className="btn-secondary text-[11px] py-1 px-2.5 font-bold cursor-pointer text-rose-400 hover:border-rose-400"
                                onClick={() => {
                                  setEqTxType('short_term_withdrawal')
                                  setShowEquityTxModal(sh)
                                }}
                              >
                                - سحب من المساهمة
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-table 2: Detailed History Log of Short-Term Deposits & Withdrawals with exact dates */}
            <div className="border-t pt-4" style={{ borderColor: 'var(--clr-border)' }}>
              <h4 className="font-bold text-sm text-white mb-2 flex items-center justify-between">
                <span>2. سجل وتواريخ إيداعات وسحوبات المساهمات قصيرة الأجل (تفاصيل التواريخ والمبالغ):</span>
                <span className="text-xs text-[var(--clr-muted)] font-normal">عدد الحركات: {shortTermHistory.length}</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>تاريخ الحركة</th>
                      <th>اسم الشريك</th>
                      <th>نوع الحركة</th>
                      <th>المبلغ (ج.م)</th>
                      <th>الحساب النقدي المقابل</th>
                      <th>البيان والتفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortTermHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-gray-400">
                          لا توجد حركات إيداع أو سحب مساهمات قصيرة الأجل مسجلة بعد
                        </td>
                      </tr>
                    ) : (
                      shortTermHistory.map((tx: any) => {
                        const isDeposit = tx.tx_type === 'short_term_contribution'
                        return (
                          <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                            <td className="font-mono text-gray-300" dir="ltr">{formatDate(tx.tx_date)}</td>
                            <td className="font-bold text-white">{tx.shareholder_name || 'الشريك'}</td>
                            <td>
                              <span className={`badge font-bold text-[10px] ${isDeposit ? 'badge-success' : 'badge-danger'}`}>
                                {isDeposit ? 'إيداع مساهمة قصيرة الأجل' : 'سحب من المساهمة قصيرة الأجل'}
                              </span>
                            </td>
                            <td className={`font-mono font-bold ${isDeposit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isDeposit ? `+${formatEGP(tx.amount)}` : `-${formatEGP(tx.amount)}`}
                            </td>
                            <td className="text-cyan-300 text-xs">
                              {tx.financial_account_name || tx.financial_account_id || 'الخزينة الرئيسية'}
                            </td>
                            <td className="text-gray-300 text-xs">
                              {tx.description || '—'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 5. FIXED ASSETS TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'fixed_assets' && (
        <div className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <h3 className="font-bold text-lg">سجل الأصول الثابتة وإهلاكها</h3>
              <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>متابعة تكلفة الشراء، نسب الإهلاك السنوي، مجمع الإهلاك والقيمة الدفترية الحالية</p>
            </div>
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowAddAssetModal(true)}>
              <Plus size={16} />
              إضافة أصل ثابت جديد
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                  <th className="py-3 px-2 font-bold">اسم الأصل</th>
                  <th className="py-3 px-2 font-bold">تاريخ الشراء</th>
                  <th className="py-3 px-2 font-bold">تكلفة الشراء</th>
                  <th className="py-3 px-2 font-bold">نسبة الإهلاك</th>
                  <th className="py-3 px-2 font-bold">مجمع الإهلاك</th>
                  <th className="py-3 px-2 font-bold">القيمة الدفترية</th>
                  <th className="py-3 px-2 font-bold">حساب الشراء</th>
                  <th className="py-3 px-2 font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {fixedAssets.map(fa => (
                  <tr key={fa.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2 font-bold">{fa.name}</td>
                    <td className="py-3 px-2 font-mono text-xs">{fa.purchase_date}</td>
                    <td className="py-3 px-2 font-mono font-bold">{formatEGP(fa.purchase_cost)}</td>
                    <td className="py-3 px-2 font-mono">{fa.depreciation_rate}%</td>
                    <td className="py-3 px-2 font-mono text-red-400">{formatEGP(fa.accumulated_depreciation)}</td>
                    <td className="py-3 px-2 font-mono font-bold text-emerald-400">{formatEGP(fa.book_value)}</td>
                    <td className="py-3 px-2 text-xs" style={{ color: 'var(--clr-accent)' }}>{fa.financial_account_name || 'الخزينة'}</td>
                    <td className="py-3 px-2 flex gap-2">
                      <button
                        className="btn-secondary text-xs py-1"
                        onClick={() => setShowDepreciationModal(fa)}
                      >
                        تسجيل قسط إهلاك
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 6. ACCRUED EXPENSES TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'accrued' && (
        <div className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <h3 className="font-bold text-lg">المصروفات المستحقة واجبة السداد</h3>
              <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>مصروفات مدرجة بقائمة الدخل والتزام بقائمة المركز المالي حتى سدادها</p>
            </div>
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowAddAccruedModal(true)}>
              <Plus size={16} />
              تسجيل مصروف مستحق جديد
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                  <th className="py-3 px-2 font-bold">المصروف</th>
                  <th className="py-3 px-2 font-bold">المبلغ</th>
                  <th className="py-3 px-2 font-bold">التصنيف</th>
                  <th className="py-3 px-2 font-bold">تاريخ الاستحقاق</th>
                  <th className="py-3 px-2 font-bold">الحالة</th>
                  <th className="py-3 px-2 font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {accruedList.map(item => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2 font-bold">{item.title}</td>
                    <td className="py-3 px-2 font-mono font-bold text-red-400">{formatEGP(item.amount)}</td>
                    <td className="py-3 px-2 text-xs">{item.category_name || 'عام'}</td>
                    <td className="py-3 px-2 text-xs font-mono">{item.due_date || 'غير محدد'}</td>
                    <td className="py-3 px-2">
                      <span className={`badge ${item.status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                        {item.status === 'paid' ? 'مسدد' : 'مستحق وغير مسدد'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {item.status === 'unpaid' && (
                        <button
                          className="btn-primary text-xs py-1"
                          onClick={() => setShowPayAccruedModal(item)}
                        >
                          سداد الآن
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 7. CUSTOMER ADVANCES TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'advances' && (
        <div className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <h3 className="font-bold text-lg">الدفعات المقدمة من العملاء</h3>
              <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>مبالغ مقدمة لخدمات صيانة أو مشتريات تسجل كالتزام متداول حتى تسليمها</p>
            </div>
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowAddAdvanceModal(true)}>
              <Plus size={16} />
              استلام دفعة مقدمة
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                  <th className="py-3 px-2 font-bold">اسم العميل</th>
                  <th className="py-3 px-2 font-bold">إجمالي الدفعة</th>
                  <th className="py-3 px-2 font-bold">المستخدم منها</th>
                  <th className="py-3 px-2 font-bold">المتبقي كالتزام</th>
                  <th className="py-3 px-2 font-bold">الحساب المستلم</th>
                  <th className="py-3 px-2 font-bold">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {advancesList.map(item => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2 font-bold">{item.customer_name}</td>
                    <td className="py-3 px-2 font-mono">{formatEGP(item.amount)}</td>
                    <td className="py-3 px-2 font-mono text-amber-400">{formatEGP(item.used_amount)}</td>
                    <td className="py-3 px-2 font-mono font-bold text-emerald-400">{formatEGP(item.remaining_amount)}</td>
                    <td className="py-3 px-2 text-xs" style={{ color: 'var(--clr-accent)' }}>{item.financial_account_name}</td>
                    <td className="py-3 px-2 font-mono text-xs">{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 8. FINANCIAL ACCOUNTS & CASHFLOW TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'accounts' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-xl">الحسابات المالية والسيولة والحدود</h3>
              <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>إدارة الخزائن، المحافظ، الحسابات البنكية ومراقبة التدفق الشهري وتنبيهات الحدود</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex items-center gap-2" onClick={() => setShowTransferModal(true)}>
                <ArrowRightLeft size={16} />
                تحويل بين الحسابات
              </button>
              <button className="btn-primary flex items-center gap-2" onClick={() => setShowAddAccountModal(true)}>
                <Plus size={16} />
                إضافة حساب جديد
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {accountsList.map(acc => (
              <div key={acc.id} className="glass-card p-5 flex flex-col gap-3 relative overflow-hidden">
                {acc.alert_status !== 'normal' && (
                  <div
                    className="absolute top-0 left-0 right-0 py-1 text-center text-xs font-bold animate-pulse"
                    style={{
                      background: acc.alert_status.includes('min') ? 'rgba(255,92,124,0.9)' : 'rgba(255,171,62,0.9)',
                      color: '#fff'
                    }}
                  >
                    {acc.alert_status === 'below_min' ? '⚠️ وصل للحد الأدنى المسموح!' :
                     acc.alert_status === 'near_min' ? '⚠️ يقترب من الحد الأدنى!' :
                     acc.alert_status === 'above_max' ? '⚠️ تجاوز الحد الأقصى!' : '⚠️ يقترب من الحد الأقصى!'}
                  </div>
                )}

                <div className="flex items-center justify-between font-bold text-lg mt-2">
                  <span>{acc.name_ar}</span>
                  <span className="font-mono text-xl" style={{ color: 'var(--clr-primary)' }}>
                    {formatEGP(acc.balance)}
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-xs border-t pt-2" style={{ borderColor: 'var(--clr-border)', color: 'var(--clr-muted)' }}>
                  <div className="flex justify-between">
                    <span>التدفق الوارد هذا الشهر:</span>
                    <span className="font-mono text-emerald-400">+{formatEGP(acc.monthly_inflow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>التدفق الصادر هذا الشهر:</span>
                    <span className="font-mono text-red-400">-{formatEGP(acc.monthly_outflow)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white border-t pt-1">
                    <span>صافي حركة الشهر:</span>
                    <span className="font-mono" style={{ color: acc.net_monthly_flow >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                      {formatEGP(acc.net_monthly_flow)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t flex-wrap gap-2" style={{ borderColor: 'var(--clr-border)' }}>
                  <span style={{ color: 'var(--clr-muted)' }}>
                    الحدود: {acc.min_balance_limit ? `أدنى: ${formatEGP(acc.min_balance_limit)}` : 'لا يوجد'}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      className="btn-secondary text-xs py-1 px-2.5 font-bold flex items-center gap-1 cursor-pointer text-amber-300 hover:border-amber-400"
                      onClick={() => setSelectedAccountForMovements(acc)}
                    >
                      <Eye size={13} />
                      عرض حركات الحساب
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        className="btn-primary text-xs py-1 px-2"
                        style={{ background: 'linear-gradient(135deg, #ff5c7c, #ffab3e)' }}
                        onClick={() => {
                          setShowAdjustBalanceModal(acc)
                          setAdjustNewBalance(acc.balance.toString())
                          setAdjustReason('')
                        }}
                      >
                        ⚙️ تعديل الرصيد (المدير)
                      </button>
                    )}
                    <button
                      className="btn-secondary text-xs py-1"
                      onClick={() => {
                        setShowAccountLimitModal(acc)
                        setNewAccMin(acc.min_balance_limit ? acc.min_balance_limit.toString() : '')
                        setNewAccMax(acc.max_balance_limit ? acc.max_balance_limit.toString() : '')
                      }}
                    >
                      ضبط الحدود والتنبيه
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 9. SALES DETAILED METRICS & TODAY SALES TAB */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'sales_detailed' && salesMetrics && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Today Sales Card */}
            <div className="glass-card p-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>مبيعات اليوم ({salesMetrics.today_date})</span>
                <span className="badge badge-primary">{salesMetrics.today_sales_count} فاتورة</span>
              </div>
              <div className="text-3xl font-black font-mono" style={{ color: 'var(--clr-success)' }}>
                {formatEGP(salesMetrics.today_sales_total)}
              </div>
            </div>

            {/* Month Sales Card */}
            <div className="glass-card p-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>إجمالي مبيعات الشهر</span>
                <span className="badge badge-primary">{salesMetrics.month_sales_count} فاتورة</span>
              </div>
              <div className="text-3xl font-black font-mono" style={{ color: 'var(--clr-primary)' }}>
                {formatEGP(salesMetrics.month_sales_total)}
              </div>
            </div>

            {/* Month Repairs Card */}
            <div className="glass-card p-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>إجمالي حركة صيانة الشهر</span>
                <span className="badge badge-accent">{salesMetrics.month_repairs_delivered_count} جهاز تم تسليمه</span>
              </div>
              <div className="text-3xl font-black font-mono" style={{ color: 'var(--clr-accent)' }}>
                {formatEGP(salesMetrics.month_repairs_total)}
              </div>
            </div>
          </div>

          {/* Today's Sales Table with Return capability */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="font-bold text-lg">تفاصيل فواتير مبيعات اليوم</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                    <th className="py-3 px-2 font-bold">رقم الفاتورة</th>
                    <th className="py-3 px-2 font-bold">العميل</th>
                    <th className="py-3 px-2 font-bold">إجمالي الفاتورة</th>
                    <th className="py-3 px-2 font-bold">طريقة السداد</th>
                    <th className="py-3 px-2 font-bold">الوقت</th>
                    <th className="py-3 px-2 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {salesMetrics.today_sales_list.map((inv: any) => (
                    <tr key={inv.invoice_no} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 font-mono font-bold">{inv.invoice_no}</td>
                      <td className="py-3 px-2">{inv.customer_name || 'عميل نقدي'}</td>
                      <td className="py-3 px-2 font-bold font-mono text-emerald-400">{formatEGP(inv.total)}</td>
                      <td className="py-3 px-2"><span className="badge badge-muted text-xs">{inv.payment_method}</span></td>
                      <td className="py-3 px-2 text-xs font-mono">{formatDateTime(inv.created_at)}</td>
                      <td className="py-3 px-2">
                        <button
                          className="btn-secondary text-xs py-1 flex items-center gap-1 text-red-400 hover:text-red-300"
                          onClick={() => openReturnModalForSale(inv)}
                        >
                          <RotateCcw size={12} />
                          إرجاع الفاتورة (كامل أو جزئي)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODALS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}

      {/* Add Fixed Asset Modal */}
      {showAddAssetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleCreateFixedAsset} className="glass-card p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="font-bold text-lg border-b pb-2">إضافة أصل ثابت جديد</h3>
            <div>
              <label className="text-xs font-bold block mb-1">اسم الأصل (معدات / سيارة / عقار / ديكور):</label>
              <input className="input w-full" value={assetName} onChange={e => setAssetName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">تكلفة الشراء (ج.م):</label>
                <input type="number" step="any" className="input w-full" value={assetCost} onChange={e => setAssetCost(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">نسبة الإهلاك السنوي (%):</label>
                <input type="number" step="any" className="input w-full" value={assetRate} onChange={e => setAssetRate(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">تاريخ الشراء:</label>
                <input type="date" className="input w-full" value={assetDate} onChange={e => setAssetDate(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">خصم الشراء من حساب:</label>
                <select className="input w-full" value={assetAcc} onChange={e => setAssetAcc(e.target.value)}>
                  {accountsList.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">ملاحظات:</label>
              <textarea className="input w-full" rows={2} value={assetNotes} onChange={e => setAssetNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" className="btn-secondary" onClick={() => setShowAddAssetModal(false)}>إلغاء</button>
              <button type="submit" className="btn-primary">حفظ الأصل الثابت</button>
            </div>
          </form>
        </div>
      )}

      {/* Record Depreciation Modal */}
      {showDepreciationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleRecordDepreciation} className="glass-card p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="font-bold text-lg border-b pb-2">تسجيل قسط إهلاك للأصل ({showDepreciationModal.name})</h3>
            <div>
              <label className="text-xs font-bold block mb-1">مبلغ قسط الإهلاك (ج.م):</label>
              <input type="number" step="any" className="input w-full" value={deprAmount} onChange={e => setDeprAmount(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">تاريخ الإهلاك:</label>
              <input type="date" className="input w-full" value={deprDate} onChange={e => setDeprDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">ملاحظات:</label>
              <textarea className="input w-full" rows={2} value={deprNotes} onChange={e => setDeprNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" className="btn-secondary" onClick={() => setShowDepreciationModal(null)}>إلغاء</button>
              <button type="submit" className="btn-primary">تسجيل الإهلاك في الدخل</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Shareholder Modal */}
      {showAddShareholderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleCreateShareholder} className="glass-card p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="font-bold text-lg border-b pb-2">إضافة شريك / مساهم جديد</h3>
            <div>
              <label className="text-xs font-bold block mb-1">اسم الشريك:</label>
              <input className="input w-full" value={shName} onChange={e => setShName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">رأس المال الأساسي (ج.م):</label>
                <input type="number" step="any" className="input w-full" value={shCapital} onChange={e => setShCapital(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">نسبة الملكية (%):</label>
                <input type="number" step="any" className="input w-full" value={shPct} onChange={e => setShPct(e.target.value)} required />
              </div>
            </div>
            {parseFloat(shCapital) > 0 && (
              <div>
                <label className="text-xs font-bold block mb-1">الحساب النقدي الإيداع فيه (ترحيل النقدية):</label>
                <select className="input w-full" value={shAcc} onChange={e => setShAcc(e.target.value)}>
                  {accountsList.map(a => <option key={a.id} value={a.id}>{a.name_ar} (الرصيد: {formatEGP(a.balance)})</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-bold block mb-1">رقم الهاتف:</label>
              <input className="input w-full" value={shPhone} onChange={e => setShPhone(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" className="btn-secondary" onClick={() => setShowAddShareholderModal(false)}>إلغاء</button>
              <button type="submit" className="btn-primary">حفظ الشريك وترحيل النقدية</button>
            </div>
          </form>
        </div>
      )}

      {/* Adjust Balance Modal for sadmin */}
      {showAdjustBalanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleAdjustBalance} className="glass-card p-6 w-full max-w-md flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b pb-2 text-rose-400">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-lg">تعديل رصيد الخزينة / الحساب النقدي (مدير النظام)</h3>
            </div>

            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-bold text-red-300">
              تنبيه: تعديل الرصيد عملية حساسة تقتصر فقط على مدراء النظام (Admin Role). سيتم توليد وتوثيق إشعار نظام بالعملية موضحاً فيه الفارق المالي.
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">اسم الحساب النقدي:</label>
              <input className="input w-full font-bold text-white" value={showAdjustBalanceModal.name_ar} disabled />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">الرصيد المحسوب الحالي:</label>
              <input className="input w-full font-mono font-bold text-amber-400" value={formatEGP(showAdjustBalanceModal.balance)} disabled />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">الرصيد الفعلي الجديد المراد اعتماده (ج.م):</label>
              <input type="number" step="any" className="input w-full font-mono font-bold text-emerald-400 text-lg" value={adjustNewBalance} onChange={e => setAdjustNewBalance(e.target.value)} required />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">السبب / بيان التسوية:</label>
              <input className="input w-full" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="مثال: تسوية جرد نقدية أو تصحيح رصيد افتتاحي" required />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" className="btn-secondary" onClick={() => setShowAdjustBalanceModal(null)}>إلغاء</button>
              <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #ff5c7c, #ffab3e)' }}>تأكيد اعتماد الرصيد الجديد</button>
            </div>
          </form>
        </div>
      )}

      {/* Equity Transaction Modal */}
      {showEquityTxModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleCreateEquityTx} className="glass-card p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="font-bold text-lg border-b pb-2">تسجيل حركة للشريك ({showEquityTxModal.name})</h3>
            <div>
              <label className="text-xs font-bold block mb-1">نوع الحركة:</label>
              <select className="input w-full" value={eqTxType} onChange={e => setEqTxType(e.target.value)}>
                <option value="short_term_contribution">مساهمة قصيرة الأجل (Short-term contribution)</option>
                <option value="short_term_withdrawal">سحب من المساهمة قصيرة الأجل (Short-term withdrawal)</option>
                <option value="capital_increase">زيادة رأس مال (Capital increase)</option>
                <option value="withdrawal">مسحوبات شريك عامة (Drawings)</option>
                <option value="profit_distribution">توزيع / استلام أرباح (Profit distribution)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">المبلغ (ج.م):</label>
                <input type="number" step="any" className="input w-full" value={eqTxAmount} onChange={e => setEqTxAmount(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">المقابل المحاسبي:</label>
                <select className="input w-full" value={eqTxCounterpart} onChange={e => setEqTxCounterpart(e.target.value)}>
                  <option value="cash">نقدي / حساب مالي</option>
                  <option value="inventory">بضاعة مخزون</option>
                  <option value="liability_settlement">سداد التزام</option>
                </select>
              </div>
            </div>
            {eqTxCounterpart === 'cash' && (
              <div>
                <label className="text-xs font-bold block mb-1">الحساب المالي المتأثر:</label>
                <select className="input w-full" value={eqTxAcc} onChange={e => setEqTxAcc(e.target.value)}>
                  {accountsList.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-bold block mb-1">الشرح / البيان:</label>
              <input className="input w-full" value={eqTxDesc} onChange={e => setEqTxDesc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" className="btn-secondary" onClick={() => setShowEquityTxModal(null)}>إلغاء</button>
              <button type="submit" className="btn-primary">حفظ الحركة المحاسبية</button>
            </div>
          </form>
        </div>
      )}

      {/* Account Limit Modal */}
      {showAccountLimitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleUpdateLimits} className="glass-card p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="font-bold text-lg border-b pb-2">ضبط حدود الحساب ({showAccountLimitModal.name_ar}) والتنبيهات</h3>
            <div>
              <label className="text-xs font-bold block mb-1">الحد الأدنى للرصيد (ج.م) للتنبيه:</label>
              <input type="number" step="any" className="input w-full" placeholder="مثال: 5000" value={newAccMin} onChange={e => setNewAccMin(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">الحد الأقصى للرصيد (ج.م) للتنبيه:</label>
              <input type="number" step="any" className="input w-full" placeholder="مثال: 500000" value={newAccMax} onChange={e => setNewAccMax(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" className="btn-secondary" onClick={() => setShowAccountLimitModal(null)}>إلغاء</button>
              <button type="submit" className="btn-primary">حفظ الحدود والتنبيه</button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleTransfer} className="glass-card p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="font-bold text-lg border-b pb-2">تحويل أموال بين الحسابات والمحافظ</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">من حساب:</label>
                <select className="input w-full" value={transferFrom} onChange={e => setTransferFrom(e.target.value)}>
                  {accountsList.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">إلى حساب:</label>
                <select className="input w-full" value={transferTo} onChange={e => setTransferTo(e.target.value)} required>
                  <option value="">اختر الحساب المستلم</option>
                  {accountsList.filter(a => a.id !== transferFrom).map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">مبلغ التحويل (ج.م):</label>
              <input type="number" step="any" className="input w-full" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">ملاحظات / سبب التحويل:</label>
              <input className="input w-full" value={transferNotes} onChange={e => setTransferNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" className="btn-secondary" onClick={() => setShowTransferModal(false)}>إلغاء</button>
              <button type="submit" className="btn-primary">تنفيذ التحويل</button>
            </div>
          </form>
        </div>
      )}

      {/* Sale Return Modal (Full & Partial Return) */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleProcessSaleReturn} className="glass-card p-6 w-full max-w-2xl max-h-[90vh] flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <h3 className="font-bold text-xl flex items-center gap-2 text-red-400">
                  <RotateCcw size={20} />
                  استرجاع فاتورة مبيعات ({showReturnModal.invoice_no})
                </h3>
                <p className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                  يمكنك إرجاع الفاتورة بالكامل أو تحديد أصناف وكميات معينة لإرجاعها جزئياً.
                </p>
              </div>
              <button type="button" className="btn-icon font-bold text-sm" onClick={() => setShowReturnModal(null)}>✕</button>
            </div>

            {/* Items list */}
            {showReturnModal.items && showReturnModal.items.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>الأصناف في الفاتورة:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        const allQtys: { [id: string]: number } = {}
                        showReturnModal.items.forEach((it: any) => { allQtys[it.id] = it.qty })
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

                <div className="max-h-56 overflow-y-auto border rounded-xl" style={{ borderColor: 'var(--clr-border)' }}>
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
                      {showReturnModal.items.map((it: any) => {
                        const retQty = returnItemsQty[it.id] || 0
                        const retVal = retQty * it.unit_price

                        return (
                          <tr key={it.id} className={retQty > 0 ? 'bg-red-500/5' : ''}>
                            <td className="py-2.5 px-3 font-medium">{it.product_name || it.name_ar || it.product_id}</td>
                            <td className="py-2.5 px-3 font-mono">{it.qty}</td>
                            <td className="py-2.5 px-3 font-mono">{formatEGP(it.unit_price)}</td>
                            <td className="py-2.5 px-3 text-center">
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
                            <td className="py-2.5 px-3 font-bold font-mono text-left text-red-400">
                              {formatEGP(retVal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-500/10 rounded-xl text-xs">
                سيتم إرجاع الفاتورة بالكامل بقيمة {formatEGP(showReturnModal.total)}
              </div>
            )}

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
                    showReturnModal.items?.reduce((sum: number, it: any) => sum + ((returnItemsQty[it.id] || 0) * it.unit_price), 0) || showReturnModal.total
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowReturnModal(null)}>إلغاء</button>
                <button type="submit" className="btn-danger">تأكيد عملية الإرجاع</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Cash Account Movements Sub-window Modal */}
      {selectedAccountForMovements && (
        <CashAccountMovementsModal
          account={selectedAccountForMovements}
          onClose={() => setSelectedAccountForMovements(null)}
        />
      )}
    </div>
  )
}
