import { useState, useEffect } from 'react'
import {
  Wallet, Landmark, Plus, ArrowRightLeft, AlertTriangle, ShieldCheck,
  RotateCcw, Settings2, ArrowDownLeft, ArrowUpRight, TrendingUp,
  CheckCircle2, DollarSign, CreditCard, Sparkles, Building2, HelpCircle,
  ClipboardCheck, Eye, FileText, Calendar, Clock, Check, FileSpreadsheet
} from 'lucide-react'
import {
  getFinancialAccounts, createFinancialAccount, updateFinancialAccountLimits,
  transferFinancialAmount, getAccountAlerts, createCashAudit, getCashAudits
} from '../../lib/commands'
import { formatEGP, formatDateTime, formatDate, formatTime, today, monthStart, monthEnd } from '../../lib/utils'
import { exportCashAuditExcel, exportPeriodCashMovementsExcel } from '../../lib/excel'
import ExportReportModal from '../../components/ExportReportModal'
import CashAccountMovementsModal from '../../components/CashAccountMovementsModal'
import toast from 'react-hot-toast'

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'audits'>('accounts')
  const [accounts, setAccounts] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [selectedAccountForMovements, setSelectedAccountForMovements] = useState<any>(null)
  const [cashAudits, setCashAudits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState<any>(null)
  const [showTransferModal, setShowTransferModal] = useState<any>(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<any>(null)

  // Add Account Form State
  const [newAccNameAr, setNewAccNameAr] = useState('')
  const [newAccNameEn, setNewAccNameEn] = useState('')
  const [newAccMinLimit, setNewAccMinLimit] = useState('')
  const [newAccMaxLimit, setNewAccMaxLimit] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)

  // Limit Form State
  const [limitType, setLimitType] = useState<'min_max' | 'debit_limit'>('min_max')
  const [limitMin, setLimitMin] = useState('')
  const [limitMax, setLimitMax] = useState('')
  const [debitLimitAmount, setDebitLimitAmount] = useState('')
  const [debitLimitDays, setDebitLimitDays] = useState('30')
  const [debitLimitStartDate, setDebitLimitStartDate] = useState('')
  const [debitLimitEndDate, setDebitLimitEndDate] = useState('')
  const [warningThresholdPct, setWarningThresholdPct] = useState('75')
  const [savingLimit, setSavingLimit] = useState(false)

  // Transfer Form State
  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferFee, setTransferFee] = useState('')
  const [transferNotes, setTransferNotes] = useState('')
  const [savingTransfer, setSavingTransfer] = useState(false)

  // Cash Audit Form State
  const [auditTitle, setAuditTitle] = useState(`جرد ومطابقة السيولة النقدية - ${today()}`)
  const [auditNotes, setAuditNotes] = useState('')
  const [actualBalances, setActualBalances] = useState<{ [accId: string]: number }>({})
  const [savingAudit, setSavingAudit] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [accs, alrts, auds] = await Promise.allSettled([
        getFinancialAccounts(),
        getAccountAlerts(),
        getCashAudits()
      ])
      if (accs.status === 'fulfilled') setAccounts(accs.value || [])
      if (alrts.status === 'fulfilled') setAlerts(alrts.value || [])
      if (auds.status === 'fulfilled') setCashAudits(auds.value || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Totals
  const totalLiquidity = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
  const mainCashDrawer = accounts.find(a => a.id === 'cash_drawer')
  const totalWalletsAndBanks = accounts
    .filter(a => a.id !== 'cash_drawer')
    .reduce((sum, a) => sum + (a.balance || 0), 0)
  const alertAccountsCount = accounts.filter(a => a.alert_status && a.alert_status !== 'normal').length

  // Handlers
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccNameAr.trim()) {
      return toast.error('يرجى إدخال اسم الحساب بالعربية')
    }
    setSavingAccount(true)
    const t = toast.loading('جاري إضافة الحساب المالي...')
    try {
      await createFinancialAccount({
        name_ar: newAccNameAr.trim(),
        name_en: newAccNameEn.trim() || null,
        min_balance_limit: newAccMinLimit ? parseFloat(newAccMinLimit) : null,
        max_balance_limit: newAccMaxLimit ? parseFloat(newAccMaxLimit) : null,
      })
      toast.success('تمت إضافة الحساب المالي بنجاح!', { id: t })
      setShowAddModal(false)
      setNewAccNameAr('')
      setNewAccNameEn('')
      setNewAccMinLimit('')
      setNewAccMaxLimit('')
      loadData()
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'فشل إضافة الحساب', { id: t })
    } finally {
      setSavingAccount(false)
    }
  }

  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showLimitModal) return
    setSavingLimit(true)
    const t = toast.loading('جاري حفظ حدود الحساب والضوابط الإشعارية...')
    try {
      await updateFinancialAccountLimits({
        id: showLimitModal.id,
        limit_type: limitType,
        min_balance_limit: limitMin ? parseFloat(limitMin) : null,
        max_balance_limit: limitMax ? parseFloat(limitMax) : null,
        debit_limit_amount: debitLimitAmount ? parseFloat(debitLimitAmount) : null,
        debit_limit_days: debitLimitDays ? parseInt(debitLimitDays) : 30,
        debit_limit_start_date: debitLimitStartDate.trim() || null,
        debit_limit_end_date: debitLimitEndDate.trim() || null,
        warning_threshold_pct: warningThresholdPct ? parseFloat(warningThresholdPct) : 75.0,
      })
      toast.success('تم تحديث ضوابط وحدود الحساب النقدي بنجاح!', { id: t })
      setShowLimitModal(null)
      loadData()
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'فشل تحديث الحدود', { id: t })
    } finally {
      setSavingLimit(false)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(transferAmount)
    const fee = transferFee ? parseFloat(transferFee) : 0
    if (!transferFrom || !transferTo) {
      return toast.error('يرجى اختيار الحساب المحول منه والمحول إليه')
    }
    if (transferFrom === transferTo) {
      return toast.error('لا يمكن التحويل لنفس الحساب')
    }
    if (!amt || amt <= 0) {
      return toast.error('يرجى إدخال مبلغ صحيح للتحويل')
    }
    if (fee < 0) {
      return toast.error('لا يمكن أن تكون عمولة التحويل سالبة')
    }

    const totalRequired = amt + fee
    const sourceAcc = accounts.find(a => a.id === transferFrom)
    if (sourceAcc && sourceAcc.balance < totalRequired) {
      return toast.error(`رصيد الحساب المحول منه (${formatEGP(sourceAcc.balance)}) لا يكفي للمبلغ والعمولة (${formatEGP(totalRequired)})`)
    }

    setSavingTransfer(true)
    const t = toast.loading('جاري تنفيذ التحويل المالي وقيد العمولة بالمصروفات...')
    try {
      await transferFinancialAmount({
        from_account_id: transferFrom,
        to_account_id: transferTo,
        amount: amt,
        fee: fee > 0 ? fee : null,
        notes: transferNotes.trim() || null,
        user_id: null,
      })
      toast.success(fee > 0 ? 'تم تنفيذ التحويل وقيد عمولة التحويل بالمصروفات بنجاح!' : 'تم تنفيذ التحويل وتحديث الأرصدة بنجاح!', { id: t })
      setShowTransferModal(false)
      setTransferAmount('')
      setTransferFee('')
      setTransferNotes('')
      loadData()
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'فشل التحويل المالي', { id: t })
    } finally {
      setSavingTransfer(false)
    }
  }

  const handleOpenAuditModal = () => {
    const initBalances: { [accId: string]: number } = {}
    accounts.forEach(a => {
      initBalances[a.id] = a.balance
    })
    setActualBalances(initBalances)
    setAuditTitle(`جرد ومطابقة السيولة النقدية - ${today()}`)
    setAuditNotes('')
    setShowAuditModal(true)
  }

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auditTitle.trim()) {
      return toast.error('يرجى إدخال عنوان تقرير الجرد')
    }

    const auditItems = accounts.map(a => ({
      financial_account_id: a.id,
      actual_balance: actualBalances[a.id] !== undefined ? actualBalances[a.id] : a.balance,
      notes: null
    }))

    setSavingAudit(true)
    const t = toast.loading('جاري حفظ تقرير جرد ومطابقة السيولة...')
    try {
      await createCashAudit({
        title: auditTitle.trim(),
        notes: auditNotes.trim() || null,
        items: auditItems,
        user_id: null,
      })
      toast.success('تم حفظ تقرير جرد ومطابقة النقدية بنجاح!', { id: t })
      setShowAuditModal(false)
      loadData()
      setActiveTab('audits')
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'فشل حفظ تقرير الجرد', { id: t })
    } finally {
      setSavingAudit(false)
    }
  }

  const openLimitModalForAccount = (acc: any) => {
    setShowLimitModal(acc)
    setLimitType(acc.limit_type || 'min_max')
    setLimitMin(acc.min_balance_limit != null ? acc.min_balance_limit.toString() : '')
    setLimitMax(acc.max_balance_limit != null ? acc.max_balance_limit.toString() : '')
    setDebitLimitAmount(acc.debit_limit_amount != null ? acc.debit_limit_amount.toString() : '')
    setDebitLimitStartDate(acc.debit_limit_start_date || monthStart())
    setDebitLimitEndDate(acc.debit_limit_end_date || monthEnd())
    setWarningThresholdPct(acc.warning_threshold_pct != null ? acc.warning_threshold_pct.toString() : '75')
  }

  const openTransferModalForAccount = (acc: any, mode: 'from' | 'to' = 'from') => {
    if (mode === 'from') {
      setTransferFrom(acc.id)
      const other = accounts.find(a => a.id !== acc.id)
      setTransferTo(other ? other.id : '')
    } else {
      setTransferTo(acc.id)
      const other = accounts.find(a => a.id !== acc.id)
      setTransferFrom(other ? other.id : '')
    }
    setTransferAmount('')
    setTransferFee('')
    setTransferNotes('')
    setShowTransferModal(true)
  }

  // Live Audit totals in modal
  const auditTotalSys = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
  const auditTotalActual = accounts.reduce((sum, a) => {
    const act = actualBalances[a.id] !== undefined ? actualBalances[a.id] : (a.balance || 0)
    return sum + act
  }, 0)
  const auditTotalVar = auditTotalActual - auditTotalSys

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3 text-2xl">
            <Landmark size={28} className="text-[var(--clr-primary)]" />
            الحسابات والسيولة والحدود
          </h1>
          <p className="text-xs text-[var(--clr-muted)] mt-1">
            إدارة ومتابعة أرصدة الخزينة، المحافظ الإلكترونية، الحسابات البنكية، وضبط حدود السيولة والتحويلات والجرد المقارن
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Excel Cash Movement Export Button */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="btn-secondary flex items-center gap-2 text-xs py-2 px-3.5 font-bold cursor-pointer shadow-sm hover:scale-[1.01] transition-transform"
            style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
            title="تصدير سجل حركات النقدية والأرصدة والعمولات وتغيرات الحدود لملف Excel"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" />
            تصدير حركة الحسابات والسيولة لـ Excel
          </button>

          {/* Compare Cash Audit Button */}
          <button
            type="button"
            onClick={handleOpenAuditModal}
            className="px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 flex items-center gap-2 shadow-lg cursor-pointer hover:scale-[1.02]"
            style={{
              borderColor: '#10b981',
              borderWidth: '1.5px',
              borderStyle: 'solid',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
            }}
          >
            <ClipboardCheck size={16} className="text-emerald-400" />
            جرد ومطابقة السيولة المقارن
          </button>

          <button
            type="button"
            className="btn-secondary flex items-center gap-2 text-xs py-2 px-3.5 font-bold cursor-pointer"
            style={{ borderColor: 'rgba(124, 107, 255, 0.4)', color: 'var(--clr-primary)' }}
            onClick={() => {
              if (accounts.length >= 2) {
                setTransferFrom(accounts[0].id)
                setTransferTo(accounts[1].id)
                setShowTransferModal(true)
              } else {
                toast.error('يجب توفر حسابين على الأقل للتحويل بينهما')
              }
            }}
          >
            <ArrowRightLeft size={14} />
            تحويل بين الحسابات
          </button>

          <button
            type="button"
            className="btn-primary flex items-center gap-2 text-xs py-2 px-4 font-bold shadow-lg cursor-pointer"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            إضافة حساب مالي جديد
          </button>

          <button
            type="button"
            className="btn-secondary flex items-center gap-2 text-xs py-2 px-3.5 font-bold cursor-pointer"
            onClick={loadData}
            title="تحديث الأرصدة"
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`badge cursor-pointer px-4 py-2.5 text-sm font-bold transition-all duration-200 border-0 flex items-center gap-2 ${
            activeTab === 'accounts' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <Landmark size={16} />
          أرصدة الحسابات والحدود
        </button>
        <button
          onClick={() => setActiveTab('audits')}
          className={`badge cursor-pointer px-4 py-2.5 text-sm font-bold transition-all duration-200 border-0 flex items-center gap-2 ${
            activeTab === 'audits' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
        >
          <ClipboardCheck size={16} />
          تقارير جرد ومطابقة السيولة ({cashAudits.length})
        </button>
      </div>

      {activeTab === 'accounts' && (
        <>
          {/* Top Summary Table Strip (تنظيم الإجماليات في جدول واضح ومريح قليل التشتت البصري) */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--clr-border)', background: 'var(--clr-surface-2)' }}>
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="border-b text-[var(--clr-muted)] font-semibold" style={{ borderColor: 'var(--clr-border)', background: 'var(--clr-surface-3)' }}>
                  <th className="py-2.5 px-3">إجمالي السيولة النقدية المتاحة</th>
                  <th className="py-2.5 px-3">النقدية السائلة (الخزينة)</th>
                  <th className="py-2.5 px-3">أرصدة المحافظ والبنوك</th>
                  <th className="py-2.5 px-3">تنبيهات حدود السيولة</th>
                  <th className="py-2.5 px-3">عدد الحسابات النشطة</th>
                </tr>
              </thead>
              <tbody>
                <tr className="divide-x divide-x-reverse font-mono font-bold" style={{ borderColor: 'var(--clr-border)' }}>
                  <td className="py-3 px-3 text-sm text-[var(--clr-primary)]">{formatEGP(totalLiquidity)}</td>
                  <td className="py-3 px-3 text-sm text-emerald-400">{formatEGP(mainCashDrawer ? mainCashDrawer.balance : 0)}</td>
                  <td className="py-3 px-3 text-sm text-cyan-400">{formatEGP(totalWalletsAndBanks)}</td>
                  <td className="py-3 px-3 text-sm" style={{ color: alertAccountsCount > 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                    {alertAccountsCount > 0 ? `${alertAccountsCount} حساب يتطلب متابعة` : 'السيولة في الحدود الآمنة'}
                  </td>
                  <td className="py-3 px-3 text-sm text-[var(--clr-text)]">{accounts.length} حسابات</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Active Alerts Banner if any */}
          {alerts.length > 0 && (
            <div className="p-4 rounded-xl border space-y-2" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <div className="flex items-center gap-2 font-bold text-sm text-red-400">
                <AlertTriangle size={18} />
                تنبيهات السيولة والحدود المالية الحرجة:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {alerts.map((al, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-black/40 border border-red-500/20 text-xs flex items-center justify-between">
                    <span className="text-[var(--clr-text)]">{al.message}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const matchedAcc = accounts.find(a => a.id === al.account_id)
                        if (matchedAcc) openTransferModalForAccount(matchedAcc, al.alert_type.includes('min') ? 'to' : 'from')
                      }}
                      className="badge badge-primary text-[10px] cursor-pointer py-1 px-2 shrink-0 mr-2"
                    >
                      {al.alert_type.includes('min') ? 'تحويل سيولة للحساب' : 'تحويل الفائض للخزينة'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map(acc => {
              const isAlert = acc.alert_status && acc.alert_status !== 'normal'
              const isMin = acc.alert_status?.includes('min')
              const isCashDrawer = acc.id === 'cash_drawer'

              return (
                <div
                  key={acc.id}
                  className={`glass-card p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:border-[var(--clr-primary)]/50 ${
                    isAlert ? 'border-amber-500/50 shadow-lg' : ''
                  }`}
                >
                  {/* Alert Ribbon if any */}
                  {isAlert && (
                    <div
                      className="py-1.5 px-3 text-center text-xs font-bold text-white mb-2 rounded-md animate-pulse shadow-md"
                      style={{
                        background: acc.alert_status.includes('100') || acc.alert_status.includes('below') || acc.alert_status.includes('above')
                          ? 'rgba(239, 68, 68, 0.95)'
                          : 'rgba(245, 158, 11, 0.95)',
                      }}
                    >
                      {acc.alert_message || '⚠️ تنبيه ضوابط الحساب النقدي!'}
                    </div>
                  )}

                  {/* Account Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isCashDrawer ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--clr-primary)]/15 text-[var(--clr-primary)]'
                      }`}>
                        {isCashDrawer ? <Wallet size={20} /> : <Landmark size={20} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-[var(--clr-text)]">{acc.name_ar}</h3>
                        <p className="text-[11px] text-[var(--clr-muted)] font-mono">
                          {acc.name_en || (isCashDrawer ? 'Main Cash Drawer' : 'Financial Account')}
                        </p>
                      </div>
                    </div>

                    <span className={`badge text-[10px] font-bold ${acc.is_active ? 'badge-success' : 'badge-muted'}`}>
                      {acc.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                  </div>

                  {/* Balance Amount */}
                  <div className="my-3 p-3.5 rounded-xl bg-[var(--clr-surface-2)] border" style={{ borderColor: 'var(--clr-border)' }}>
                    <div className="text-xs text-[var(--clr-muted)] font-medium mb-1">الرصيد الفعلي الحالي:</div>
                    <div className="text-2xl font-black font-mono text-[var(--clr-primary)]">
                      {formatEGP(acc.balance)}
                    </div>
                  </div>

                  {/* Monthly Cashflows */}
                  <div className="space-y-1.5 text-xs border-t pt-3 mb-3" style={{ borderColor: 'var(--clr-border)' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--clr-muted)] flex items-center gap-1">
                        <ArrowDownLeft size={13} className="text-emerald-400" /> وارد الشهر:
                      </span>
                      <span className="font-mono font-bold text-emerald-400">+{formatEGP(acc.monthly_inflow || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--clr-muted)] flex items-center gap-1">
                        <ArrowUpRight size={13} className="text-red-400" /> صادر الشهر:
                      </span>
                      <span className="font-mono font-bold text-red-400">-{formatEGP(acc.monthly_outflow || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold border-t pt-1.5 text-[var(--clr-text)]" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <span>صافي حركة الشهر:</span>
                      <span className={`font-mono ${acc.net_monthly_flow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatEGP(acc.net_monthly_flow || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Limits Information */}
                  <div className="p-2.5 rounded-lg bg-[var(--clr-surface-3)] border text-[11px] space-y-1 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
                    <div className="flex justify-between items-center text-[var(--clr-primary)] font-bold mb-1 border-b pb-1">
                      <span>ضوابط الحساب:</span>
                      <span>{acc.limit_type === 'debit_limit' ? '2️⃣ سقف مسحوبات' : '1️⃣ حدود رصيد'}</span>
                    </div>
                    {acc.limit_type === 'debit_limit' ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[var(--clr-muted)]">سقف حركات المدفوعات:</span>
                          <span className="font-mono font-bold text-red-400">
                            {acc.debit_limit_amount != null ? formatEGP(acc.debit_limit_amount) : 'غير محدد'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--clr-muted)]">المدفوعات الفعلية للفترة:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {formatEGP(acc.current_period_debit || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--clr-muted)]">المتبقي بالشهر الحالي:</span>
                          <span className="font-mono font-bold text-cyan-400">
                            {acc.days_remaining_in_period ?? 0} يوم
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--clr-muted)]">نسبة حد التنبيه الإشعاري:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {acc.warning_threshold_pct || 75}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[var(--clr-muted)]">الحد الأدنى:</span>
                          <span className="font-mono font-bold">
                            {acc.min_balance_limit != null ? formatEGP(acc.min_balance_limit) : 'غير محدد'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--clr-muted)]">الحد الأقصى:</span>
                          <span className="font-mono font-bold">
                            {acc.max_balance_limit != null ? formatEGP(acc.max_balance_limit) : 'غير محدد'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Card Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t" style={{ borderColor: 'var(--clr-border)' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedAccountForMovements(acc)}
                      className="btn-secondary text-[11px] py-1.5 flex items-center justify-center gap-1 font-bold cursor-pointer text-amber-300 hover:border-amber-400"
                    >
                      <Eye size={13} />
                      عرض الحركات
                    </button>

                    <button
                      type="button"
                      onClick={() => openLimitModalForAccount(acc)}
                      className="btn-secondary text-[11px] py-1.5 flex items-center justify-center gap-1 font-bold cursor-pointer"
                    >
                      <Settings2 size={13} />
                      ضبط الحدود
                    </button>

                    <button
                      type="button"
                      onClick={() => openTransferModalForAccount(acc, 'from')}
                      className="btn-primary text-[11px] py-1.5 flex items-center justify-center gap-1 font-bold cursor-pointer"
                    >
                      <ArrowRightLeft size={13} />
                      تحويل منه
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: CASH AUDITS LOGS & COMPARISON SESSIONS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'audits' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">سجل جلسات جرد ومطابقة السيولة النقدية</h3>
            <button
              type="button"
              onClick={handleOpenAuditModal}
              className="btn-primary text-xs flex items-center gap-2 font-bold shadow-md cursor-pointer"
            >
              <ClipboardCheck size={15} />
              بدء جلسة جرد جديدة
            </button>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>تاريخ وتوقيت الجرد</th>
                  <th>عنوان الجلسة</th>
                  <th>الرصيد الدفتري المسجل</th>
                  <th>الرصيد الفعلي المجرود</th>
                  <th>صافي الفارق (عجز / زيادة)</th>
                  <th>الحالة</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {cashAudits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[var(--clr-muted)]">
                      لا توجد جلسات جرد ومطابقة نقدية مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  cashAudits.map((aud: any) => {
                    const isZero = Math.abs(aud.total_variance || 0) < 0.01
                    const isShortage = aud.total_variance < -0.01

                    return (
                      <tr key={aud.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="font-mono text-xs">
                          <div className="font-bold text-[var(--clr-text)]">{formatDate(aud.audit_date)}</div>
                          <div className="text-[11px] text-[var(--clr-muted)] flex items-center gap-1 mt-0.5">
                            <Clock size={11} className="text-gray-400" />
                            {formatTime(aud.audit_date)}
                          </div>
                        </td>

                        <td className="font-bold text-sm text-[var(--clr-text)]">
                          {aud.title}
                          {aud.notes && <div className="text-xs text-[var(--clr-muted)] font-normal">{aud.notes}</div>}
                        </td>

                        <td className="font-mono font-bold text-sm text-[var(--clr-primary)]">
                          {formatEGP(aud.total_system_balance)}
                        </td>

                        <td className="font-mono font-bold text-sm text-emerald-400">
                          {formatEGP(aud.total_actual_balance)}
                        </td>

                        <td className={`font-mono font-bold text-sm ${isZero ? 'text-gray-400' : isShortage ? 'text-red-400' : 'text-cyan-400'}`}>
                          {isZero ? '0.00 ج.م' : (aud.total_variance > 0 ? `+${formatEGP(aud.total_variance)}` : formatEGP(aud.total_variance))}
                        </td>

                        <td>
                          {isZero ? (
                            <span className="badge badge-success text-[10px]">متطابق تماماً</span>
                          ) : isShortage ? (
                            <span className="badge badge-danger text-[10px]">يوجد عجز نقدي</span>
                          ) : (
                            <span className="badge badge-warning text-[10px]">يوجد فائض نقدي</span>
                          )}
                        </td>

                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditDetail(aud)}
                            className="btn-icon text-xs px-2.5 py-1 inline-flex items-center gap-1 font-bold cursor-pointer"
                            title="عرض تفاصيل الجرد بالبنود"
                          >
                            <Eye size={14} className="text-[var(--clr-primary)]" />
                            تفاصيل
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: ADD FINANCIAL ACCOUNT */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="modal-overlay z-50" onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div className="modal-content max-w-md bg-[var(--clr-surface-1)] border shadow-2xl p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2">
                <Landmark size={20} className="text-[var(--clr-primary)]" />
                <h3 className="font-bold text-lg">إضافة حساب مالي / محفظة جديدة</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateAccount} className="flex flex-col gap-3.5">
              <div>
                <label className="label font-bold text-xs">اسم الحساب بالعربية *</label>
                <input
                  type="text"
                  className="input w-full font-bold"
                  value={newAccNameAr}
                  onChange={e => setNewAccNameAr(e.target.value)}
                  placeholder="مثال: محفظة فودافون كاش 2، حساب بنك مصر، خزينة المعرض"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label font-bold text-xs">اسم الحساب بالإنجليزية (اختياري)</label>
                <input
                  type="text"
                  className="input w-full font-mono text-left"
                  dir="ltr"
                  value={newAccNameEn}
                  onChange={e => setNewAccNameEn(e.target.value)}
                  placeholder="e.g. Vodafone Cash 2, CIB Account"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold text-xs">الحد الأدنى للرصيد (ج.م):</label>
                  <input
                    type="number"
                    step="any"
                    className="input w-full font-mono"
                    value={newAccMinLimit}
                    onChange={e => setNewAccMinLimit(e.target.value)}
                    placeholder="مثال: 2000"
                  />
                </div>
                <div>
                  <label className="label font-bold text-xs">الحد الأقصى للرصيد (ج.م):</label>
                  <input
                    type="number"
                    step="any"
                    className="input w-full font-mono"
                    value={newAccMaxLimit}
                    onChange={e => setNewAccMaxLimit(e.target.value)}
                    placeholder="مثال: 50000"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[var(--clr-muted)] bg-[var(--clr-surface-2)] p-2.5 rounded-lg border" style={{ borderColor: 'var(--clr-border)' }}>
                💡 تنبيه: يساعدك تحديد الحدود في تلقي إشعارات فورية عند انخفاض الرصيد عن الحد الأدنى لتغذيته، أو زيادته عن الحد الأقصى لتوريده للخزينة.
              </p>

              <div className="flex gap-2.5 pt-3 border-t mt-1" style={{ borderColor: 'var(--clr-border)' }}>
                <button type="button" className="btn-secondary flex-1 py-2.5 font-bold" onClick={() => setShowAddModal(false)} disabled={savingAccount}>
                  إلغاء
                </button>
                <button type="submit" className="btn-primary flex-1 py-2.5 font-bold shadow-lg" disabled={savingAccount}>
                  {savingAccount ? 'جاري الحفظ...' : 'حفظ الحساب المالي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: ADJUST ACCOUNT LIMITS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showLimitModal && (
        <div className="modal-overlay z-50" onClick={e => { if (e.target === e.currentTarget) setShowLimitModal(null) }}>
          <div className="modal-content max-w-md bg-[var(--clr-surface-1)] border shadow-2xl p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2">
                <Settings2 size={20} className="text-[var(--clr-primary)]" />
                <h3 className="font-bold text-lg">ضبط حدود رصيد: {showLimitModal.name_ar}</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowLimitModal(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdateLimits} className="flex flex-col gap-3.5">
              <div className="p-3 bg-[var(--clr-surface-2)] rounded-xl border text-xs" style={{ borderColor: 'var(--clr-border)' }}>
                <span className="text-[var(--clr-muted)] block">الرصيد الفعلي الحالي:</span>
                <span className="text-lg font-black font-mono text-[var(--clr-primary)]">{formatEGP(showLimitModal.balance)}</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="label font-bold text-xs">طريقة حساب الحدود والتنبيهات لهذا الحساب:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      limitType === 'min_max'
                        ? 'bg-[var(--clr-primary)]/15 border-[var(--clr-primary)] text-[var(--clr-primary)]'
                        : 'bg-[var(--clr-surface-2)] border-[var(--clr-border)] text-[var(--clr-muted)]'
                    }`}
                    onClick={() => setLimitType('min_max')}
                  >
                    1️⃣ الحد الأدنى والأقصى للرصيد
                  </button>
                  <button
                    type="button"
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      limitType === 'debit_limit'
                        ? 'bg-[var(--clr-primary)]/15 border-[var(--clr-primary)] text-[var(--clr-primary)]'
                        : 'bg-[var(--clr-surface-2)] border-[var(--clr-border)] text-[var(--clr-muted)]'
                    }`}
                    onClick={() => setLimitType('debit_limit')}
                  >
                    2️⃣ سقف المسحوبات لفترة
                  </button>
                </div>
              </div>

              {limitType === 'min_max' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label font-bold text-xs">الحد الأدنى للرصيد (ج.م):</label>
                    <input
                      type="number"
                      step="any"
                      className="input w-full font-mono font-bold"
                      value={limitMin}
                      onChange={e => setLimitMin(e.target.value)}
                      placeholder="مثال: 5000"
                    />
                  </div>
                  <div>
                    <label className="label font-bold text-xs">الحد الأقصى للرصيد (ج.م):</label>
                    <input
                      type="number"
                      step="any"
                      className="input w-full font-mono font-bold"
                      value={limitMax}
                      onChange={e => setLimitMax(e.target.value)}
                      placeholder="مثال: 50000"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label font-bold text-xs">إجمالي حد الحركات المدينة الخارجة (ج.م):</label>
                    <input
                      type="number"
                      step="any"
                      className="input w-full font-mono font-bold text-red-400"
                      value={debitLimitAmount}
                      onChange={e => setDebitLimitAmount(e.target.value)}
                      placeholder="مثال: 100000"
                    />
                    <span className="text-[10px] text-[var(--clr-muted)] mt-1 block">
                      يشمل المصروفات والسحوبات وسداد الموردين والتحويلات الخارجة من الحساب.
                    </span>
                  </div>

                  <div>
                    <label className="label font-bold text-xs">تاريخ بداية الفترة المخصصة:</label>
                    <input
                      type="date"
                      className="input w-full font-mono text-xs"
                      value={debitLimitStartDate}
                      onChange={e => setDebitLimitStartDate(e.target.value)}
                    />
                    <span className="text-[10px] text-[var(--clr-muted)] mt-0.5 block">
                      اتركه فارغاً للاحتساب من 01 بالشهر الحالي.
                    </span>
                  </div>

                  <div>
                    <label className="label font-bold text-xs">تاريخ نهاية الفترة المخصصة:</label>
                    <input
                      type="date"
                      className="input w-full font-mono text-xs"
                      value={debitLimitEndDate}
                      onChange={e => setDebitLimitEndDate(e.target.value)}
                    />
                    <span className="text-[10px] text-[var(--clr-muted)] mt-0.5 block">
                      اتركه فارغاً للاحتساب لنهاية الشهر الحالي.
                    </span>
                  </div>

                  <div className="col-span-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                    💡 <b>المدفوعات التلقائية للشهر:</b> عند ترك التواريخ فارغة، يتم احتساب المسحوبات من 1 بالشهر إلى آخره حسب عدد أيامه مع حساب عدد الأيام المتبقية للشهر (حسب تاريخ اليوم).
                  </div>
                </div>
              )}

              <div>
                <label className="label font-bold text-xs">نسبة حد التنبيه الإشعاري (%):</label>
                <input
                  type="number"
                  step="any"
                  className="input w-full font-mono font-bold"
                  value={warningThresholdPct}
                  onChange={e => setWarningThresholdPct(e.target.value)}
                  placeholder="75%"
                />
                <span className="text-[10px] text-[var(--clr-muted)] mt-1 block">
                  سيتم إرسال إشعار للمستخدم والمدير عند الوصول لـ {warningThresholdPct || '75'}% وتنبيه مشدد عند 100%.
                </span>
              </div>

              <div className="flex gap-2.5 pt-3 border-t mt-1" style={{ borderColor: 'var(--clr-border)' }}>
                <button type="button" className="btn-secondary flex-1 py-2.5 font-bold" onClick={() => setShowLimitModal(null)} disabled={savingLimit}>
                  إلغاء
                </button>
                <button type="submit" className="btn-primary flex-1 py-2.5 font-bold shadow-lg" disabled={savingLimit}>
                  {savingLimit ? 'جاري الحفظ...' : 'حفظ الحدود'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: INTERNAL TRANSFER BETWEEN ACCOUNTS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showTransferModal && (
        <div className="modal-overlay z-50" onClick={e => { if (e.target === e.currentTarget) setShowTransferModal(null) }}>
          <div className="modal-content max-w-md bg-[var(--clr-surface-1)] border shadow-2xl p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={20} className="text-[var(--clr-primary)]" />
                <h3 className="font-bold text-lg">تحويل نقدية بين الحسابات</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowTransferModal(null)}>✕</button>
            </div>

            <form onSubmit={handleTransfer} className="flex flex-col gap-3.5">
              <div>
                <label className="label font-bold text-xs">تحويل من حساب (المصدر):</label>
                <select
                  className="input w-full font-bold"
                  value={transferFrom}
                  onChange={e => setTransferFrom(e.target.value)}
                  required
                >
                  <option value="">-- اختر الحساب المحول منه --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name_ar} (رصيده: {formatEGP(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label font-bold text-xs">تحويل إلى حساب (المستلم):</label>
                <select
                  className="input w-full font-bold"
                  value={transferTo}
                  onChange={e => setTransferTo(e.target.value)}
                  required
                >
                  <option value="">-- اختر الحساب المستلم --</option>
                  {accounts.filter(a => a.id !== transferFrom).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name_ar} (رصيده الحالي: {formatEGP(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold text-xs">المبلغ المراد تحويله (ج.م) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.5"
                    className="input w-full font-mono font-bold text-lg text-emerald-400"
                    value={transferAmount}
                    onChange={e => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="label font-bold text-xs flex items-center justify-between">
                    <span>عمولة التحويل / مصاريف بنكية:</span>
                    <span className="text-[10px] text-amber-400 font-bold">(تُسجل كمصروف)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input w-full font-mono font-bold text-lg text-amber-400"
                    value={transferFee}
                    onChange={e => setTransferFee(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Live Financial Breakdown Summary */}
              {parseFloat(transferAmount) > 0 && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-[var(--clr-muted)]">
                    <span>المبلغ المستلم بالحساب الهدف:</span>
                    <span className="font-mono font-bold text-emerald-400">+{formatEGP(parseFloat(transferAmount) || 0)}</span>
                  </div>
                  {parseFloat(transferFee) > 0 && (
                    <div className="flex justify-between items-center text-amber-300">
                      <span>عمولة التحويل (مصروف بنكي مباشر):</span>
                      <span className="font-mono font-bold">-{formatEGP(parseFloat(transferFee) || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5 border-t border-white/10 font-bold text-[var(--clr-text)]">
                    <span>إجمالي الخصم من الحساب المصدر:</span>
                    <span className="font-mono font-black text-red-400">
                      -{formatEGP((parseFloat(transferAmount) || 0) + (parseFloat(transferFee) || 0))}
                    </span>
                  </div>
                  {parseFloat(transferFee) > 0 && (
                    <p className="text-[10px] text-cyan-300 pt-1">
                      💡 سيتم ترحيل العمولة تلقائياً كقيد مصروفات إلى <b>قائمة المصروفات</b> و<b>دفتر أستاذ المصروفات</b>.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="label font-bold text-xs">ملاحظات وبيان التحويل:</label>
                <input
                  type="text"
                  className="input w-full text-xs"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  placeholder="مثال: تحويل تغذية رصيد المحفظة من الخزينة الرئيسية"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t mt-1" style={{ borderColor: 'var(--clr-border)' }}>
                <button type="button" className="btn-secondary flex-1 py-2.5 font-bold cursor-pointer" onClick={() => setShowTransferModal(null)} disabled={savingTransfer}>
                  إلغاء
                </button>
                <button type="submit" className="btn-primary flex-1 py-2.5 font-bold shadow-lg cursor-pointer" disabled={savingTransfer}>
                  {savingTransfer ? 'جاري التحويل...' : 'تأكيد عملية التحويل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: CASH & LIQUIDITY AUDIT / COMPARISON (جرد النقدية المقارن) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showAuditModal && (
        <div className="modal-overlay z-50" onClick={e => { if (e.target === e.currentTarget) setShowAuditModal(false) }}>
          <div className="modal-content max-w-3xl max-h-[85vh] overflow-y-auto bg-[var(--clr-surface-1)] border shadow-2xl p-5 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 border-b pb-2.5" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2">
                <ClipboardCheck size={20} className="text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base">جرد ومطابقة السيولة النقدية والخزن والمحافظ (المقارن)</h3>
                  <p className="text-xs text-[var(--clr-muted)]">مقارنة الرصيد الدفتري المسجل بالرصيد الفعلي بعد العد</p>
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowAuditModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveAudit} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="label font-bold text-xs">عنوان جلسة الجرد *</label>
                  <input
                    type="text"
                    className="input w-full font-bold text-xs"
                    value={auditTitle}
                    onChange={e => setAuditTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label font-bold text-xs">ملاحظات عامة عن الجرد:</label>
                  <input
                    type="text"
                    className="input w-full text-xs"
                    value={auditNotes}
                    onChange={e => setAuditNotes(e.target.value)}
                    placeholder="مثال: جرد نهاية الدوام / جرد دوري"
                  />
                </div>
              </div>

              {/* Accounts Comparison Table */}
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--clr-border)' }}>
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>الحساب المالي / الخزينة</th>
                      <th>الرصيد الدفتري</th>
                      <th>الرصيد الفعلي بعد العد (ج.م)</th>
                      <th>الفارق</th>
                      <th>حالة المطابقة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(acc => {
                      const actual = actualBalances[acc.id] !== undefined ? actualBalances[acc.id] : acc.balance
                      const variance = actual - acc.balance
                      const isZero = Math.abs(variance) < 0.01
                      const isShortage = variance < -0.01

                      return (
                        <tr key={acc.id} className="hover:bg-white/[0.02]">
                          <td>
                            <div className="font-bold text-xs text-[var(--clr-text)]">{acc.name_ar}</div>
                            <div className="text-[10px] text-[var(--clr-muted)]">{acc.name_en || 'حساب مالي'}</div>
                          </td>

                          <td className="font-mono font-bold text-xs text-[var(--clr-primary)]">
                            {formatEGP(acc.balance)}
                          </td>

                          <td>
                            <input
                              type="number"
                              step="any"
                              className="input py-1 px-2.5 w-32 font-bold text-center font-mono text-sm border-emerald-500/40"
                              value={actual}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0
                                setActualBalances(prev => ({ ...prev, [acc.id]: val }))
                              }}
                            />
                          </td>

                          <td className={`font-mono font-bold text-xs ${isZero ? 'text-gray-400' : isShortage ? 'text-red-400' : 'text-cyan-400'}`}>
                            {isZero ? '0.00 ج.م' : (variance > 0 ? `+${formatEGP(variance)}` : formatEGP(variance))}
                          </td>

                          <td>
                            {isZero ? (
                              <span className="badge badge-success text-[10px] py-0.5 px-1.5">متطابق</span>
                            ) : isShortage ? (
                              <span className="badge badge-danger text-[10px] py-0.5 px-1.5">عجز نقدي</span>
                            ) : (
                              <span className="badge badge-warning text-[10px] py-0.5 px-1.5">فائض نقدي</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Audit Summary */}
              <div className="grid grid-cols-3 gap-2.5 p-3 bg-[var(--clr-surface-2)] rounded-xl border" style={{ borderColor: 'var(--clr-border)' }}>
                <div>
                  <span className="text-[11px] text-[var(--clr-muted)] block mb-0.5">إجمالي الرصيد الدفتري:</span>
                  <span className="text-base font-mono font-black text-[var(--clr-primary)]">{formatEGP(auditTotalSys)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--clr-muted)] block mb-0.5">إجمالي الرصيد الفعلي:</span>
                  <span className="text-base font-mono font-black text-emerald-400">{formatEGP(auditTotalActual)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--clr-muted)] block mb-0.5">صافي الفارق الكلي:</span>
                  <span className={`text-base font-mono font-black ${
                    Math.abs(auditTotalVar) < 0.01 ? 'text-gray-300' : auditTotalVar < 0 ? 'text-red-400' : 'text-cyan-400'
                  }`}>
                    {Math.abs(auditTotalVar) < 0.01 ? '0.00 ج.م (متطابق)' : auditTotalVar > 0 ? `+${formatEGP(auditTotalVar)} (فائض)` : `${formatEGP(auditTotalVar)} (عجز)`}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t mt-1" style={{ borderColor: 'var(--clr-border)' }}>
                <span className="text-[11px] text-[var(--clr-muted)]">
                  * يتم حفظ تقرير الجرد والمطابقة للتدقيق الإداري.
                </span>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary font-bold px-3 py-1.5 text-xs" onClick={() => setShowAuditModal(false)} disabled={savingAudit}>
                    إلغاء
                  </button>
                  <button type="submit" className="btn-primary font-bold px-4 py-1.5 text-xs shadow-lg" disabled={savingAudit}>
                    {savingAudit ? 'جاري الحفظ...' : 'حفظ تقرير الجرد والمطابقة'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: VIEW HISTORICAL CASH AUDIT DETAILS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {selectedAuditDetail && (
        <div className="modal-overlay z-[60]" onClick={e => { if (e.target === e.currentTarget) setSelectedAuditDetail(null) }}>
          <div className="modal-content max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--clr-surface-1)] border shadow-2xl p-5 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 border-b pb-2.5" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2">
                <ClipboardCheck size={20} className="text-emerald-400" />
                <h3 className="font-bold text-base">{selectedAuditDetail.title}</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelectedAuditDetail(null)}>✕</button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 p-3 bg-[var(--clr-surface-2)] rounded-xl border mb-3 text-xs" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <span className="text-[var(--clr-muted)] block mb-0.5">تاريخ الجلسة:</span>
                <span className="font-bold font-mono text-xs">{formatDateTime(selectedAuditDetail.audit_date)}</span>
              </div>
              <div>
                <span className="text-[var(--clr-muted)] block mb-0.5">الرصيد الدفتري:</span>
                <span className="font-bold font-mono text-xs text-[var(--clr-primary)]">{formatEGP(selectedAuditDetail.total_system_balance)}</span>
              </div>
              <div>
                <span className="text-[var(--clr-muted)] block mb-0.5">الرصيد الفعلي:</span>
                <span className="font-bold font-mono text-xs text-emerald-400">{formatEGP(selectedAuditDetail.total_actual_balance)}</span>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden mb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th>الحساب المالي</th>
                    <th>الرصيد الدفتري</th>
                    <th>الرصيد الفعلي</th>
                    <th>الفارق</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAuditDetail.items?.map((it: any, idx: number) => {
                    const isZero = Math.abs(it.variance || 0) < 0.01
                    const isShortage = it.variance < -0.01

                    return (
                      <tr key={idx}>
                        <td className="font-bold text-xs">{it.account_name}</td>
                        <td className="font-mono text-xs text-[var(--clr-primary)]">{formatEGP(it.system_balance)}</td>
                        <td className="font-mono text-xs text-emerald-400 font-bold">{formatEGP(it.actual_balance)}</td>
                        <td className={`font-mono text-xs font-bold ${isZero ? 'text-gray-400' : isShortage ? 'text-red-400' : 'text-cyan-400'}`}>
                          {isZero ? '0.00 ج.م' : (it.variance > 0 ? `+${formatEGP(it.variance)}` : formatEGP(it.variance))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button
                type="button"
                onClick={async () => {
                  const t = toast.loading('جاري فتح نافذة حفظ التقرير...')
                  try {
                    const saved = await exportCashAuditExcel(selectedAuditDetail)
                    if (saved) toast.success('تم حفظ تقرير جرد ومطابقة السيولة بنجاح!', { id: t })
                    else toast.dismiss(t)
                  } catch {
                    toast.error('فشل تصدير التقرير', { id: t })
                  }
                }}
                className="btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer text-emerald-400 border-emerald-500/30"
              >
                <FileSpreadsheet size={15} /> تصدير لـ Excel
              </button>
              <button type="button" className="btn-secondary text-xs py-1.5 px-4" onClick={() => setSelectedAuditDetail(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Cash Movements Period Modal */}
      {showExportModal && (
        <ExportReportModal
          title="تصدير حركة الحسابات والسيولة والحدود لـ Excel"
          description="اختر الفترة الزمنية المطلوبة لتوليد وتصدير سجل حركات النقدية والأرصدة والعمولات وتغيرات الحدود المتبقية"
          onClose={() => setShowExportModal(false)}
          onExport={async (dateFrom, dateTo) => {
            return await exportPeriodCashMovementsExcel(dateFrom, dateTo)
          }}
        />
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
