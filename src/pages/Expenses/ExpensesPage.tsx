import { useState, useEffect } from 'react'
import {
  Plus, DollarSign, Calendar, Wallet, Calculator,
  TrendingDown, AlertCircle, Clock, CheckCircle2, Trash2, Filter,
  Edit, Printer, FileSpreadsheet, Layers, ArrowUpRight, ArrowDownRight, Eye
} from 'lucide-react'
import {
  getExpenses, getExpenseCategories, createExpense, updateExpense, deleteExpense,
  getFinancialAccounts, getLiabilities, createLiability, payLiability, deleteLiability,
  getLiabilityLedger, Liability, LiabilityLedgerEntry
} from '../../lib/commands'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { formatEGP, formatDate, monthStart, yearStart, today } from '../../lib/utils'
import { exportExpensesExcel, exportLiabilitiesExcel } from '../../lib/excel'
import toast from 'react-hot-toast'

export default function ExpensesPage() {
  const { hasPermission, user } = useAuthStore()
  const { storeName, storeLogo } = useSettingsStore()

  const canCreate = hasPermission('expenses_create') || hasPermission('expenses_edit_delete') || hasPermission('manage_liabilities') || user?.role === 'admin'
  const canEditDelete = hasPermission('expenses_edit_delete') || hasPermission('manage_liabilities') || user?.role === 'admin'

  // Date range filters
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [recurrenceFilter, setRecurrenceFilter] = useState<'all' | 'recurring' | 'casual'>('all')

  // Data states
  const [expenses, setExpenses] = useState<any[]>([])
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Active view tab
  const [viewTab, setViewTab] = useState<'all' | 'liabilities'>('all')

  // Expense Modals
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)

  // Liability Modals
  const [showAddLiabilityModal, setShowAddLiabilityModal] = useState(false)
  const [showPayLiabilityModal, setShowPayLiabilityModal] = useState<Liability | null>(null)
  const [selectedLedgerLiability, setSelectedLedgerLiability] = useState<Liability | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LiabilityLedgerEntry[]>([])
  const [loadingLedger, setLoadingLedger] = useState(false)

  // Form states - Expense
  const [expDate, setExpDate] = useState(today())
  const [expCatId, setExpCatId] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDesc, setExpDesc] = useState('')
  const [expIsRecurring, setExpIsRecurring] = useState(false)
  const [expRecurrence, setExpRecurrence] = useState<'monthly' | 'weekly' | 'yearly'>('monthly')
  const [expFinancialAccount, setExpFinancialAccount] = useState('cash_drawer')

  // Form states - New Liability (تسجيل التزام جديد وقيد مزدوج)
  const [liabTitle, setLiabTitle] = useState('')
  const [liabAmount, setLiabAmount] = useState('')
  const [liabCreditor, setLiabCreditor] = useState('')
  const [liabDebitType, setLiabDebitType] = useState<'accrued_expense' | 'fixed_asset' | 'current_asset' | 'cash_advance'>('accrued_expense')
  const [liabDueDate, setLiabDueDate] = useState(today())
  const [liabNotes, setLiabNotes] = useState('')

  // Form states - Pay Liability
  const [payAmount, setPayAmount] = useState('')
  const [payAccount, setPayAccount] = useState('cash_drawer')
  const [payNotes, setPayNotes] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [expRes, catRes, accRes, liabRes] = await Promise.all([
        getExpenses({ date_from: dateFrom, date_to: dateTo }),
        getExpenseCategories(),
        getFinancialAccounts(),
        getLiabilities('all'),
      ])
      setExpenses(expRes || [])
      setCategories(catRes || [])
      setAccounts(accRes || [])
      setLiabilities(liabRes || [])

      if (catRes && catRes.length > 0 && !expCatId) {
        setExpCatId(catRes[0].id.toString())
      }
      if (accRes && accRes.length > 0 && !expFinancialAccount) {
        setExpFinancialAccount(accRes[0].id)
        setPayAccount(accRes[0].id)
      }
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تحميل بيانات المصروفات والالتزامات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateFrom, dateTo])

  const openAddModal = () => {
    if (!canCreate) {
      return toast.error('عذراً، ليس لديك صلاحية إدخال وتسجيل المصروفات!')
    }
    setEditingExpense(null)
    setExpDate(today())
    setExpAmount('')
    setExpDesc('')
    setExpIsRecurring(false)
    setShowAddExpenseModal(true)
  }

  const openEditModal = (exp: any) => {
    if (!canEditDelete) {
      return toast.error('عذراً، ليس لديك صلاحية تعديل أو حذف المصروفات!')
    }
    setEditingExpense(exp)
    setExpDate(exp.expense_date || today())
    setExpCatId(exp.category_id.toString())
    setExpAmount(exp.amount.toString())
    setExpDesc(exp.description || '')
    setExpIsRecurring(!!exp.is_recurring)
    setExpRecurrence(exp.recurrence || 'monthly')
    setExpFinancialAccount(exp.financial_account_id || 'cash_drawer')
    setShowAddExpenseModal(true)
  }

  // Submit Expense (Create / Edit)
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(expAmount)
    if (!amt || amt <= 0) return toast.error('يرجى إدخال مبلغ صحيح أكبر من صفر')
    if (!expCatId) return toast.error('يرجى اختيار تصنيف المصروف')

    try {
      if (editingExpense) {
        await updateExpense({
          id: editingExpense.id,
          expense_date: expDate,
          category_id: parseInt(expCatId),
          amount: amt,
          description: expDesc || undefined,
          is_recurring: expIsRecurring,
          recurrence: expIsRecurring ? expRecurrence : undefined,
          financial_account_id: expFinancialAccount,
        })
        toast.success('تم تعديل المصروف بنجاح!')
      } else {
        await createExpense({
          expense_date: expDate,
          category_id: parseInt(expCatId),
          amount: amt,
          description: expDesc || undefined,
          is_recurring: expIsRecurring,
          recurrence: expIsRecurring ? expRecurrence : undefined,
          financial_account_id: expFinancialAccount,
          user_id: user?.id,
        })
        toast.success('تم تسجيل المصروف النقدي بنجاح!')
      }
      setShowAddExpenseModal(false)
      loadData()
    } catch (err: any) {
      toast.error('حدث خطأ أثناء حفظ المصروف: ' + err.toString())
    }
  }

  // Delete Expense
  const handleDeleteExpense = async (id: any) => {
    if (!canEditDelete) {
      return toast.error('عذراً، ليس لديك صلاحية حذف المصروفات!')
    }
    if (!window.confirm('هل أنت تأكد من إغلاق وحذف هذا المصروف النقدي؟')) return
    try {
      await deleteExpense(id)
      toast.success('تم حذف المصروف بنجاح')
      loadData()
    } catch (err: any) {
      toast.error('فشل حذف المصروف: ' + err.toString())
    }
  }

  // Submit New Liability (تسجيل التزام جديد بالقيد المزدوج)
  const handleCreateLiability = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(liabAmount)
    if (!amt || amt <= 0) return toast.error('يرجى إدخال مبلغ التزام صحيح')
    if (!liabTitle.trim()) return toast.error('يرجى إدخال اسم البيان / الالتزام')
    if (!liabCreditor.trim()) return toast.error('يرجى إدخال اسم الجهة الدائنة / المستحق له')

    try {
      await createLiability({
        title: liabTitle.trim(),
        amount: amt,
        creditor_name: liabCreditor.trim(),
        debit_counterpart_type: liabDebitType,
        due_date: liabDueDate,
        notes: liabNotes.trim() || undefined,
        created_by: user?.display_name || user?.username,
      })
      toast.success('تم تسجيل الالتزام المالي وتوجيه الحساب المدين المقابل بالميزانية بنجاح!')
      setShowAddLiabilityModal(false)
      setLiabTitle('')
      setLiabAmount('')
      setLiabCreditor('')
      setLiabNotes('')
      loadData()
    } catch (err: any) {
      toast.error('فشل تسجيل الالتزام: ' + err.toString())
    }
  }

  // Submit Pay Liability
  const handlePayLiability = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showPayLiabilityModal) return
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) return toast.error('يرجى إدخال مبلغ سداد صحيح')
    if (amt > showPayLiabilityModal.remaining_amount + 0.01) {
      return toast.error(`مبلغ السداد (${formatEGP(amt)}) أكبر من الرصيد المتبقي على الالتزام (${formatEGP(showPayLiabilityModal.remaining_amount)})`)
    }

    try {
      await payLiability({
        liability_id: showPayLiabilityModal.id,
        amount: amt,
        financial_account_id: payAccount,
        notes: payNotes.trim() || undefined,
        paid_by: user?.display_name || user?.username,
      })
      toast.success('تم سداد الدفعة بنجاح وخصم المبلغ من الحساب النقدي وتحديث الالتزام!')
      setShowPayLiabilityModal(null)
      setPayAmount('')
      setPayNotes('')
      loadData()
    } catch (err: any) {
      toast.error('فشل عملية السداد: ' + err.toString())
    }
  }

  // Delete Liability
  const handleDeleteLiability = async (id: string) => {
    if (!canEditDelete) {
      return toast.error('عذراً، ليس لديك صلاحية حذف الالتزامات!')
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا الالتزام المالي بالكامل؟')) return
    try {
      await deleteLiability(id)
      toast.success('تم حذف الالتزام المالي بنجاح')
      loadData()
    } catch (err: any) {
      toast.error('فشل حذف الالتزام: ' + err.toString())
    }
  }

  // View Ledger of Liability
  const handleViewLedger = async (liab: Liability) => {
    setSelectedLedgerLiability(liab)
    setLoadingLedger(true)
    try {
      const entries = await getLiabilityLedger(liab.id)
      setLedgerEntries(entries || [])
    } catch (err: any) {
      toast.error('فشل تحميل دفتر الأستاذ للالتزام')
    } finally {
      setLoadingLedger(false)
    }
  }

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
    setDateFrom(f)
    setDateTo(targetTo)
  }

  // Filtered expenses list
  const filteredExpenses = expenses.filter(exp => {
    if (exp.expense_date) {
      if (dateFrom && exp.expense_date < dateFrom) return false
      if (dateTo && exp.expense_date > dateTo) return false
    }
    if (categoryFilter !== 'all' && exp.category_id.toString() !== categoryFilter) return false
    if (recurrenceFilter === 'recurring' && !exp.is_recurring) return false
    if (recurrenceFilter === 'casual' && exp.is_recurring) return false
    return true
  })

  // Liabilities Calculations
  const totalLiabilitiesAmount = liabilities.reduce((sum, l) => sum + (l.amount || 0), 0)
  const totalLiabilitiesPaid = liabilities.reduce((sum, l) => sum + (l.paid_amount || 0), 0)
  const totalLiabilitiesRemaining = liabilities.reduce((sum, l) => sum + (l.remaining_amount || 0), 0)
  const unpaidCount = liabilities.filter(l => l.status !== 'paid').length

  const totalCashExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
  const recurringCount = filteredExpenses.filter(exp => exp.is_recurring).length

  // Export Expenses to Excel
  const handleExportExpensesExcel = async () => {
    const t = toast.loading('جاري فتح وتوليد ملف Excel للمصروفات...')
    try {
      await exportExpensesExcel(filteredExpenses, [], dateFrom, dateTo)
      toast.success('تم تصدير تقرير المصروفات لـ Excel بنجاح!', { id: t })
    } catch (err: any) {
      toast.error('فشل تصدير التقرير: ' + err.toString(), { id: t })
    }
  }

  // Export Liabilities to Excel
  const handleExportLiabilitiesExcel = async () => {
    const t = toast.loading('جاري فتح وتوليد ملف Excel لدفتر أستاذ الالتزامات...')
    try {
      await exportLiabilitiesExcel(liabilities)
      toast.success('تم تصدير دفتر أستاذ الالتزامات لـ Excel بنجاح!', { id: t })
    } catch (err: any) {
      toast.error('فشل تصدير تقرير الالتزامات: ' + err.toString(), { id: t })
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      {/* Top Header */}
      <div className="page-header flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Wallet size={28} style={{ color: 'var(--clr-primary)' }} />
            المصروفات والالتزامات المالية الموحدة
          </h1>
          <p className="page-subtitle">إدارة المصروفات النقدية والالتزامات والاستحقاقات المالية طبقاً لمعايير المحاسبة</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {viewTab === 'all' ? (
            <>
              <button
                className="btn-secondary flex items-center gap-2 font-bold text-xs cursor-pointer"
                style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
                onClick={handleExportExpensesExcel}
                title="تصدير جميع المصروفات النقدية لملف Excel"
              >
                <FileSpreadsheet size={16} />
                تصدير المصروفات Excel
              </button>
              <button className="btn-primary flex items-center gap-2 font-bold text-xs cursor-pointer" onClick={openAddModal}>
                <Plus size={18} />
                تسجيل مصروف جديد
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-secondary flex items-center gap-2 font-bold text-xs cursor-pointer"
                style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
                onClick={handleExportLiabilitiesExcel}
                title="تصدير سجل ودفتر أستاذ الالتزامات لملف Excel"
              >
                <FileSpreadsheet size={16} />
                تصدير دفتر الأستاذ Excel
              </button>
              <button className="btn-primary flex items-center gap-2 font-bold text-xs cursor-pointer" onClick={() => setShowAddLiabilityModal(true)}>
                <Plus size={18} />
                تسجيل التزام جديد
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between border-r-4 border-red-500">
          <div>
            <div className="text-xs text-[var(--clr-muted)] font-bold">المصروفات النقدية للفترة</div>
            <div className="text-xl font-black font-mono text-red-400 mt-1">{formatEGP(totalCashExpenses)}</div>
            <div className="text-[10px] text-[var(--clr-muted)] mt-0.5">{filteredExpenses.length} مصروف مسدد</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
            <TrendingDown size={22} />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between border-r-4 border-amber-500">
          <div>
            <div className="text-xs text-[var(--clr-muted)] font-bold">إجمالي الالتزامات غير المسددة</div>
            <div className="text-xl font-black font-mono text-amber-400 mt-1">{formatEGP(totalLiabilitiesRemaining)}</div>
            <div className="text-[10px] text-amber-400 font-bold mt-0.5">{unpaidCount} التزام واجب السداد</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between border-r-4 border-emerald-500">
          <div>
            <div className="text-xs text-[var(--clr-muted)] font-bold">إجمالي الالتزامات المسددة</div>
            <div className="text-xl font-black font-mono text-emerald-400 mt-1">{formatEGP(totalLiabilitiesPaid)}</div>
            <div className="text-[10px] text-[var(--clr-muted)] mt-0.5">تم سدادها من الخزائن</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between border-r-4 border-indigo-500">
          <div>
            <div className="text-xs text-[var(--clr-muted)] font-bold">إجمالي قيمة الالتزامات الإجمالية</div>
            <div className="text-xl font-black font-mono text-indigo-400 mt-1">{formatEGP(totalLiabilitiesAmount)}</div>
            <div className="text-[10px] text-[var(--clr-muted)] mt-0.5">{liabilities.length} سجل محاسبي</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
            <Layers size={22} />
          </div>
        </div>
      </div>

      {/* Tabs & Filters Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            className={`btn-tab ${viewTab === 'all' ? 'active' : ''}`}
            onClick={() => setViewTab('all')}
          >
            المصروفات النقدية ({filteredExpenses.length})
          </button>
          <button
            className={`btn-tab ${viewTab === 'liabilities' ? 'active' : ''}`}
            onClick={() => setViewTab('liabilities')}
          >
            الالتزامات والاستحقاقات المالية ({liabilities.length})
          </button>
        </div>

        {/* Date & Category Filters */}
        {viewTab === 'all' && (
          <div className="flex flex-wrap items-center gap-3">
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

            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>
              <span>من:</span>
              <input type="date" className="input py-1 px-2.5 text-xs font-mono font-bold" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>
              <span>إلى:</span>
              <input type="date" className="input py-1 px-2.5 text-xs font-mono font-bold" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            <select
              className="input py-1 px-2 text-xs font-bold"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="all">كل التصنيفات</option>
              {categories.map(c => (
                <option key={c.id} value={c.id.toString()}>{c.name_ar}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Table Content */}
      {viewTab === 'all' ? (
        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className="font-bold text-lg border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
            سجل المصروفات النقدية
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                  <th className="py-3 px-2 font-bold">التاريخ</th>
                  <th className="py-3 px-2 font-bold">التصنيف</th>
                  <th className="py-3 px-2 font-bold">البيان / الوصف</th>
                  <th className="py-3 px-2 font-bold">المبلغ</th>
                  <th className="py-3 px-2 font-bold">طبيعة المصروف</th>
                  <th className="py-3 px-2 font-bold">الحساب النقدي الخصم</th>
                  <th className="py-3 px-2 font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>
                      لا يوجد مصروفات نقدية مسجلة للفترة المحددة
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 font-mono text-xs">{formatDate(exp.expense_date)}</td>
                      <td className="py-3 px-2 font-bold">{exp.category_name}</td>
                      <td className="py-3 px-2 text-xs">{exp.description || '—'}</td>
                      <td className="py-3 px-2 font-mono font-bold text-red-400">{formatEGP(exp.amount)}</td>
                      <td className="py-3 px-2">
                        <span className={`badge ${exp.is_recurring ? 'badge-primary' : 'badge-neutral'}`}>
                          {exp.is_recurring ? `دوري (${exp.recurrence || 'monthly'})` : 'عارض'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-xs" style={{ color: 'var(--clr-accent)' }}>
                        {exp.financial_account_name || 'الخزينة الرئيسية'}
                      </td>
                      <td className="py-3 px-2 flex items-center gap-1.5">
                        {canEditDelete && (
                          <button
                            className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                            onClick={() => openEditModal(exp)}
                            title="تعديل المصروف"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canEditDelete && (
                          <button
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="حذف المصروف"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Unified Liabilities View */
        <div className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
                <Clock size={20} />
                سجل الالتزامات والاستحقاقات المالية الموحد
              </h3>
              <p className="text-xs text-[var(--clr-muted)] mt-0.5">
                تدرج الالتزامات كخصوم متداولة بالميزانية مع إمكانية توجيه الطرف المدين (مصروف، أصل ثابت، أصل متداول، سلفة)
              </p>
            </div>
            <button
              className="btn-secondary text-xs flex items-center gap-1.5 font-bold cursor-pointer"
              onClick={handleExportLiabilitiesExcel}
            >
              <FileSpreadsheet size={15} className="text-emerald-400" />
              تصدير دفتر الأستاذ لـ Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                  <th className="py-3 px-2 font-bold">البيان / الالتزام</th>
                  <th className="py-3 px-2 font-bold">الجهة الدائنة</th>
                  <th className="py-3 px-2 font-bold">الحساب المدين المقابل</th>
                  <th className="py-3 px-2 font-bold">القيمة الإجمالية</th>
                  <th className="py-3 px-2 font-bold">المسدد</th>
                  <th className="py-3 px-2 font-bold">المتبقي</th>
                  <th className="py-3 px-2 font-bold">تاريخ الاستحقاق</th>
                  <th className="py-3 px-2 font-bold">الحالة</th>
                  <th className="py-3 px-2 font-bold">الإجراءات ودفتر الأستاذ</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {liabilities.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>
                      لا توجد التزامات مالية مسجلة بالنظام حتى الآن
                    </td>
                  </tr>
                ) : (
                  liabilities.map(liab => {
                    let debitLabel = 'مصروف مؤجل / مستحق'
                    if (liab.debit_counterpart_type === 'fixed_asset') debitLabel = 'أصل ثابت (معدات/أجهزة)'
                    else if (liab.debit_counterpart_type === 'current_asset') debitLabel = 'أصل متداول (مخزون)'
                    else if (liab.debit_counterpart_type === 'cash_advance') debitLabel = 'سلفة نقدية / ذمم مدنية'

                    return (
                      <tr key={liab.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2 font-bold">{liab.title}</td>
                        <td className="py-3 px-2 text-xs font-semibold text-amber-300">{liab.creditor_name}</td>
                        <td className="py-3 px-2 text-xs">
                          <span className="badge badge-neutral text-[11px]">{debitLabel}</span>
                        </td>
                        <td className="py-3 px-2 font-mono font-bold">{formatEGP(liab.amount)}</td>
                        <td className="py-3 px-2 font-mono font-bold text-emerald-400">{formatEGP(liab.paid_amount)}</td>
                        <td className="py-3 px-2 font-mono font-bold text-red-400">{formatEGP(liab.remaining_amount)}</td>
                        <td className="py-3 px-2 font-mono text-xs">{formatDate(liab.due_date)}</td>
                        <td className="py-3 px-2">
                          <span className={`badge ${liab.status === 'paid' ? 'badge-success' : liab.status === 'partially_paid' ? 'badge-warning' : 'badge-danger'}`}>
                            {liab.status === 'paid' ? 'مسدد بالكامل' : liab.status === 'partially_paid' ? 'سداد جزئي' : 'غير مسدد'}
                          </span>
                        </td>
                        <td className="py-3 px-2 flex items-center gap-1.5">
                          <button
                            className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                            onClick={() => handleViewLedger(liab)}
                            title="عرض دفتر الأستاذ والتفاصيل"
                          >
                            <Eye size={14} className="text-indigo-400" />
                            دفتر الأستاذ
                          </button>
                          {liab.status !== 'paid' && (
                            <button
                              className="btn-primary py-1 px-2.5 text-xs font-bold"
                              onClick={() => {
                                setShowPayLiabilityModal(liab)
                                setPayAmount(liab.remaining_amount.toString())
                              }}
                            >
                              سداد دفعة
                            </button>
                          )}
                          {canEditDelete && (
                            <button
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                              onClick={() => handleDeleteLiability(liab.id)}
                              title="حذف الالتزام"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
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

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="modal-overlay">
          <form onSubmit={handleCreateExpense} className="modal-content p-6 flex flex-col gap-4 max-w-lg">
            <h3 className="font-bold text-lg border-b pb-2 flex items-center gap-2">
              <Plus size={20} style={{ color: 'var(--clr-primary)' }} />
              تسجيل مصروف نقدي جديد
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">تاريخ المصروف:</label>
                <input type="date" className="input w-full" value={expDate} onChange={e => setExpDate(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">تصنيف المصروف:</label>
                <select className="input w-full" value={expCatId} onChange={e => setExpCatId(e.target.value)} required>
                  {categories.map(c => (
                    <option key={c.id} value={c.id.toString()}>{c.name_ar}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">المبلغ (ج.م):</label>
              <input type="number" step="any" className="input w-full font-mono text-lg font-bold" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0.00" required />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">البيان / التفاصيل:</label>
              <input className="input w-full" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="مثال: فاتورة كهرباء شهر أغسطس / مصاريف نثرية" />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">اختر الحساب النقدي الخصم منه:</label>
              <select className="input w-full text-xs" value={expFinancialAccount} onChange={e => setExpFinancialAccount(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name_ar} (الرصيد: {formatEGP(a.balance)})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddExpenseModal(false)}>إلغاء</button>
              <button type="submit" className="btn-primary">حفظ المصروف النقدي</button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Liability Modal (تسجيل التزام جديد بالقيد المزدوج) */}
      {showAddLiabilityModal && (
        <div className="modal-overlay">
          <form onSubmit={handleCreateLiability} className="modal-content p-6 flex flex-col gap-4 max-w-xl">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
                <Clock size={22} />
                <span>تسجيل التزام مالي جديد (قيد مزدوج)</span>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowAddLiabilityModal(false)}>✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">اسم الالتزام / البيان:</label>
                <input className="input w-full" value={liabTitle} onChange={e => setLiabTitle(e.target.value)} placeholder="مثال: شراء أجهزة بالآجل / إيجارات مستحقة" required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">اسم الجهة الدائنة (المستحق له):</label>
                <input className="input w-full" value={liabCreditor} onChange={e => setLiabCreditor(e.target.value)} placeholder="مثال: شركة الأجهزة / المالك" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">مبلغ الالتزام الإجمالي (ج.م):</label>
                <input type="number" step="any" className="input w-full font-mono text-base font-bold text-amber-400" value={liabAmount} onChange={e => setLiabAmount(e.target.value)} placeholder="0.00" required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">تاريخ الاستحقاق الواجب السداد فيه:</label>
                <input type="date" className="input w-full font-mono text-xs" value={liabDueDate} onChange={e => setLiabDueDate(e.target.value)} required />
              </div>
            </div>

            {/* Double-Entry Debit Counterpart Type */}
            <div className="p-3.5 rounded-xl border bg-black/20 flex flex-col gap-2" style={{ borderColor: 'var(--clr-border)' }}>
              <label className="text-xs font-bold text-indigo-300 block">
                ⚖️ الطرف المدين المقابل بالميزانية (Accounting Counterpart Debit):
              </label>
              <div className="grid grid-cols-1 gap-2 text-xs font-bold">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white/5 hover:bg-white/10">
                  <input type="radio" name="debit_type" checked={liabDebitType === 'accrued_expense'} onChange={() => setLiabDebitType('accrued_expense')} />
                  <span>مصروف مؤجل / مستحق (يندرج في قائمة الدخل وتكلفة الفترة)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white/5 hover:bg-white/10">
                  <input type="radio" name="debit_type" checked={liabDebitType === 'fixed_asset'} onChange={() => setLiabDebitType('fixed_asset')} />
                  <span>أصل ثابت (زيادة أصول ثابته: معدات / أجهزة / أثاث بالميزانية)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white/5 hover:bg-white/10">
                  <input type="radio" name="debit_type" checked={liabDebitType === 'current_asset'} onChange={() => setLiabDebitType('current_asset')} />
                  <span>أصل متداول / مخزون (زيادة المخزون والبضاعة بالميزانية)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white/5 hover:bg-white/10">
                  <input type="radio" name="debit_type" checked={liabDebitType === 'cash_advance'} onChange={() => setLiabDebitType('cash_advance')} />
                  <span>سلفة نقدية / ذمم مدنية أخرى (زيادة الأصول المتداولة المدينة)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">ملاحظات وشروط السداد:</label>
              <input className="input w-full text-xs" value={liabNotes} onChange={e => setLiabNotes(e.target.value)} placeholder="ملاحظات اختيارية..." />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddLiabilityModal(false)}>إلغاء</button>
              <button type="submit" className="btn-primary">تأكيد وتسجيل الالتزام المالي</button>
            </div>
          </form>
        </div>
      )}

      {/* Pay Liability Modal */}
      {showPayLiabilityModal && (
        <div className="modal-overlay">
          <form onSubmit={handlePayLiability} className="modal-content p-6 flex flex-col gap-4 max-w-md">
            <h3 className="font-bold text-lg border-b pb-2 text-amber-400">
              سداد دفعة للالتزام ({showPayLiabilityModal.title})
            </h3>

            <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <span className="text-xs font-bold block text-[var(--clr-muted)]">إجمالي الالتزام:</span>
                <span className="font-mono text-sm font-bold">{formatEGP(showPayLiabilityModal.amount)}</span>
              </div>
              <div className="text-left">
                <span className="text-xs font-bold block text-[var(--clr-muted)]">المتبقي واجب السداد:</span>
                <span className="font-mono text-base font-black text-red-400">{formatEGP(showPayLiabilityModal.remaining_amount)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">المبلغ المسدد الآن (ج.م):</label>
              <input type="number" step="any" className="input w-full font-mono text-lg font-black text-emerald-400" value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">اختر الحساب النقدي للخصم السداد منه:</label>
              <select className="input w-full text-xs font-bold" value={payAccount} onChange={e => setPayAccount(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name_ar} (الرصيد المتاح: {formatEGP(a.balance)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">ملاحظات ورقم السند:</label>
              <input className="input w-full text-xs" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="مثال: سداد دفعة عن طريق تحويل بنكي..." />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowPayLiabilityModal(null)}>إلغاء</button>
              <button type="submit" className="btn-primary">تأكيد السداد والخصم من الحساب</button>
            </div>
          </form>
        </div>
      )}

      {/* Liability General Ledger Modal */}
      {selectedLedgerLiability && (
        <div className="modal-overlay">
          <div className="modal-content p-6 flex flex-col gap-4 max-w-3xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <h3 className="font-bold text-lg text-indigo-300 flex items-center gap-2">
                  <FileSpreadsheet size={20} />
                  دفتر أستاذ الالتزام: {selectedLedgerLiability.title}
                </h3>
                <p className="text-xs text-[var(--clr-muted)] mt-0.5">
                  الدائن: <strong className="text-amber-400">{selectedLedgerLiability.creditor_name}</strong> | إجمالي الدين: <strong className="font-mono">{formatEGP(selectedLedgerLiability.amount)}</strong>
                </p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelectedLedgerLiability(null)}>✕</button>
            </div>

            {loadingLedger ? (
              <div className="text-center py-8 text-xs text-[var(--clr-muted)]">جاري تحميل حركات دفتر الأستاذ...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b text-[var(--clr-muted)] font-semibold" style={{ borderColor: 'var(--clr-border)' }}>
                      <th className="py-2 px-2">التاريخ</th>
                      <th className="py-2 px-2">البيان والحركة المحاسبية</th>
                      <th className="py-2 px-2">دائن (نشوء الالتزام)</th>
                      <th className="py-2 px-2">مدين (سداد الحساب)</th>
                      <th className="py-2 px-2">الرصيد المتبقي بعد الحركة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {ledgerEntries.map(e => (
                      <tr key={e.id} className="hover:bg-white/5">
                        <td className="py-2.5 px-2 font-mono text-[11px]">{formatDate(e.tx_date)}</td>
                        <td className="py-2.5 px-2 font-bold">{e.description}</td>
                        <td className="py-2.5 px-2 font-mono font-bold text-amber-400">{e.credit_amount > 0 ? formatEGP(e.credit_amount) : '-'}</td>
                        <td className="py-2.5 px-2 font-mono font-bold text-emerald-400">{e.debit_amount > 0 ? formatEGP(e.debit_amount) : '-'}</td>
                        <td className="py-2.5 px-2 font-mono font-black text-red-400">{formatEGP(e.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary text-xs" onClick={() => setSelectedLedgerLiability(null)}>إغلاق النافذة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
