import { useState, useEffect } from 'react'
import {
  Plus, DollarSign, Calendar, Wallet, Calculator,
  TrendingDown, AlertCircle, Clock, CheckCircle2, Trash2, Filter,
  Edit, Printer, FileSpreadsheet
} from 'lucide-react'
import {
  getExpenses, getExpenseCategories, createExpense, updateExpense, deleteExpense,
  getAccruedExpenses, createAccruedExpense, payAccruedExpense, deleteAccruedExpense,
  getFinancialAccounts
} from '../../lib/commands'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { formatEGP, formatDate, monthStart, today } from '../../lib/utils'
import { exportExpensesExcel } from '../../lib/excel'
import toast from 'react-hot-toast'

export default function ExpensesPage() {
  const { hasPermission, user } = useAuthStore()
  const { storeName, storeLogo } = useSettingsStore()

  const canCreate = hasPermission('expenses_create') || hasPermission('expenses_edit_delete') || user?.role === 'admin'
  const canEditDelete = hasPermission('expenses_edit_delete') || user?.role === 'admin'

  // Date range filters
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [recurrenceFilter, setRecurrenceFilter] = useState<'all' | 'recurring' | 'casual'>('all')

  // Data states
  const [expenses, setExpenses] = useState<any[]>([])
  const [accruedExpenses, setAccruedExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Active view tab
  const [viewTab, setViewTab] = useState<'all' | 'accrued'>('all')

  // Modal states
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [showPayAccruedModal, setShowPayAccruedModal] = useState<any>(null)

  // Form states
  const [expDate, setExpDate] = useState(today())
  const [expCatId, setExpCatId] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDesc, setExpDesc] = useState('')
  const [expIsRecurring, setExpIsRecurring] = useState(false)
  const [expRecurrence, setExpRecurrence] = useState<'monthly' | 'weekly' | 'yearly'>('monthly')
  const [expPaymentType, setExpPaymentType] = useState<'cash' | 'accrued'>('cash')
  const [expFinancialAccount, setExpFinancialAccount] = useState('cash_drawer')
  const [expDueDate, setExpDueDate] = useState(today())

  // Pay Accrued Form
  const [payAccount, setPayAccount] = useState('cash_drawer')

  const loadData = async () => {
    setLoading(true)
    try {
      const [expRes, catRes, accRes, accrRes] = await Promise.all([
        getExpenses({ date_from: dateFrom, date_to: dateTo }),
        getExpenseCategories(),
        getFinancialAccounts(),
        getAccruedExpenses(),
      ])
      setExpenses(expRes || [])
      setCategories(catRes || [])
      setAccounts(accRes || [])
      setAccruedExpenses(accrRes || [])

      if (catRes && catRes.length > 0 && !expCatId) {
        setExpCatId(catRes[0].id.toString())
      }
      if (accRes && accRes.length > 0 && !expFinancialAccount) {
        setExpFinancialAccount(accRes[0].id)
      }
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تحميل بيانات المصروفات')
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
    setExpPaymentType('cash')
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
    setExpPaymentType('cash')
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
          category_id: parseInt(expCatId),
          amount: amt,
          description: expDesc || undefined,
          is_recurring: expIsRecurring,
          recurrence: expIsRecurring ? expRecurrence : undefined,
          expense_date: expDate,
          financial_account_id: expFinancialAccount,
          user_id: user?.id || undefined,
          username: user?.display_name || undefined,
        })
        toast.success('تم تعديل المصروف بنجاح!')
      } else {
        if (expPaymentType === 'cash') {
          await createExpense({
            category_id: parseInt(expCatId),
            amount: amt,
            description: expDesc || undefined,
            is_recurring: expIsRecurring,
            recurrence: expIsRecurring ? expRecurrence : undefined,
            expense_date: expDate,
            financial_account_id: expFinancialAccount,
          })
          toast.success('تم تسجيل المصروف خصماً من الحساب النقدي بنجاح')
        } else {
          const catObj = categories.find(c => c.id.toString() === expCatId)
          const catName = catObj ? catObj.name_ar : 'مصروف'
          const title = expDesc ? `${catName}: ${expDesc}` : catName

          await createAccruedExpense({
            category_id: parseInt(expCatId),
            title,
            amount: amt,
            due_date: expDueDate || undefined,
            notes: expDesc || undefined,
          })
          toast.success('تم تسجيل المصروف كمصروف مستحق للالتزامات بنجاح')
        }
      }

      setShowAddExpenseModal(false)
      setEditingExpense(null)
      setExpAmount('')
      setExpDesc('')
      setExpIsRecurring(false)
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
        financial_account_id: payAccount,
      })
      toast.success('تم سداد المصروف المستحق وخصمه من الحساب النقدي')
      setShowPayAccruedModal(null)
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!canEditDelete) {
      return toast.error('عذراً، ليس لديك صلاحية تعديل أو حذف المصروفات!')
    }
    if (!confirm('هل أنت تأكد من رغبتك في حذف هذا المصروف؟')) return
    try {
      await deleteExpense(id, user?.id, user?.display_name)
      toast.success('تم حذف المصروف بنجاح')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Handle Delete Accrued Expense
  const handleDeleteAccrued = async (id: string) => {
    if (!canEditDelete) {
      return toast.error('عذراً، ليس لديك صلاحية تعديل أو حذف المصروفات!')
    }
    if (!confirm('هل أنت تأكد من حذف المصروف المستحق؟')) return
    try {
      await deleteAccruedExpense(id)
      toast.success('تم حذف المصروف المستحق')
      loadData()
    } catch (err: any) {
      toast.error(err.toString())
    }
  }

  // Print Expenses Report
  const handlePrintReport = () => {
    const totalCash = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0)
    const unpaidAccrued = accruedExpenses.filter(a => a.status === 'unpaid').reduce((sum, a) => sum + a.amount, 0)

    const win = window.open('', '', 'width=900,height=750')
    if (!win) return

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>تقرير المصروفات - ${storeName || 'XPhone'}</title>
          <style>
            @media print {
              body { font-family: 'Cairo', system-ui, sans-serif; padding: 20px; color: #000; background: #fff; }
              .no-print { display: none !important; }
            }
            body { font-family: 'Cairo', system-ui, sans-serif; direction: rtl; padding: 25px; color: #1e293b; background: #fff; line-height: 1.5; }
            .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: bold; color: #0f172a; margin: 0; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
            .period-badge { background: #f1f5f9; padding: 6px 12px; border-radius: 8px; font-weight: bold; font-size: 12px; color: #334155; display: inline-block; margin-bottom: 16px; }
            .summary-cards { display: flex; gap: 12px; margin-bottom: 20px; }
            .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; background: #f8fafc; }
            .card-title { font-size: 11px; color: #64748b; font-weight: bold; }
            .card-amount { font-size: 16px; font-weight: 800; margin-top: 4px; font-family: monospace; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background: #0f172a; color: #fff; padding: 8px 6px; text-align: right; font-weight: bold; }
            td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: right; }
            tr:nth-child(even) { background: #f8fafc; }
            .amount { font-family: monospace; font-weight: bold; color: #dc2626; }
            .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <table className="header-table">
            <tr>
              <td>
                <h1 className="title">تقرير المصروفات النقدية والمستحقة التفصيلي</h1>
                <div className="subtitle">المتجر: ${storeName || 'XPhone'} — تم الاستخراج بواسطة: ${user?.display_name || 'المدير'}</div>
              </td>
            </tr>
          </table>

          <div className="period-badge">
            📅 الفترة الزمنية المحددة للتقرير: من ${formatDate(dateFrom)} إلى ${formatDate(dateTo)}
          </div>

          <div className="summary-cards">
            <div className="card">
              <div className="card-title">إجمالي المصروفات النقدية الخزنية</div>
              <div className="card-amount" style="color: #dc2626;">${formatEGP(totalCash)}</div>
            </div>
            <div className="card">
              <div className="card-title">إجمالي المصروفات المستحقة (التزامات)</div>
              <div className="card-amount" style="color: #d97706;">${formatEGP(unpaidAccrued)}</div>
            </div>
            <div className="card">
              <div className="card-title">إجمالي الالتزامات الكلية للفترة</div>
              <div className="card-amount">${formatEGP(totalCash + unpaidAccrued)}</div>
            </div>
          </div>

          <h3 style="font-size: 14px; margin-bottom: 8px;">سجل بنود المصروفات النقدية المسجلة:</h3>
          <table>
            <thead>
              <tr>
                <th>تاريخ المصروف</th>
                <th>تصنيف المصروف</th>
                <th>البيان / الوصف</th>
                <th>المبلغ</th>
                <th>طبيعة المصروف</th>
                <th>حساب الخصم النقدي</th>
              </tr>
            </thead>
            <tbody>
              ${filteredExpenses.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 20px;">لا توجد مصروفات نقدية مسجلة لهذه الفترة</td></tr>' : 
                filteredExpenses.map(exp => `
                  <tr>
                    <td style="font-family: monospace;">${exp.expense_date}</td>
                    <td><strong>${exp.category_name}</strong></td>
                    <td>${exp.description || '—'}</td>
                    <td className="amount">${formatEGP(exp.amount)}</td>
                    <td>${exp.is_recurring ? `دوري (${exp.recurrence || 'monthly'})` : 'عارض'}</td>
                    <td>${exp.financial_account_name || 'الخزينة الرئيسية'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>

          <div className="footer">
            <div>تاريخ واستخراج التقرير: ${new Date().toLocaleString('ar-EG')}</div>
            <div>توقيع المحاسب / المدير المسؤول: ..............................</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `)
    win.document.close()
  }

  // Export Expenses to Excel
  const handleExportExcel = async () => {
    const t = toast.loading('جاري فتح وتوليد ملف Excel للمصروفات...')
    try {
      await exportExpensesExcel(filteredExpenses, accruedExpenses, dateFrom, dateTo)
      toast.success('تم تصدير تقرير المصروفات لـ Excel بنجاح!', { id: t })
    } catch (err: any) {
      toast.error('فشل تصدير التقرير: ' + err.toString(), { id: t })
    }
  }

  // Filtered expenses list
  const filteredExpenses = expenses.filter(exp => {
    if (categoryFilter !== 'all' && exp.category_id.toString() !== categoryFilter) return false
    if (recurrenceFilter === 'recurring' && !exp.is_recurring) return false
    if (recurrenceFilter === 'casual' && exp.is_recurring) return false
    return true
  })

  // Calculations
  const totalCashExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0)
  const unpaidAccruedTotal = accruedExpenses.filter(a => a.status === 'unpaid').reduce((sum, a) => sum + a.amount, 0)
  const recurringCount = filteredExpenses.filter(exp => exp.is_recurring).length

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      {/* Top Header */}
      <div className="page-header flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Wallet size={28} style={{ color: 'var(--clr-primary)' }} />
            إدارة المصروفات والتزامات النقدية
          </h1>
          <p className="page-subtitle">تسجيل وإدارة المصروفات النقدية والمستحقة والدورية وفق معايير المحاسبة</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-2 font-bold text-xs cursor-pointer"
            style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
            onClick={handleExportExcel}
            title="تصدير جميع المصروفات والالتزامات لملف Excel"
          >
            <FileSpreadsheet size={16} />
            تصدير لـ Excel
          </button>
          <button className="btn-secondary flex items-center gap-2 font-bold text-xs cursor-pointer" onClick={handlePrintReport}>
            <Printer size={16} />
            طباعة تقرير المصروفات
          </button>
          <button className="btn-primary flex items-center gap-2 font-bold text-xs cursor-pointer" onClick={openAddModal}>
            <Plus size={18} />
            تسجيل مصروف جديد
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,107,255,0.12)', color: 'var(--clr-primary)' }}>
            <TrendingDown size={24} />
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>إجمالي المصروفات النقدية</div>
            <div className="text-xl font-black font-mono mt-1 text-red-400">{formatEGP(totalCashExpenses)}</div>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,171,62,0.12)', color: '#ffab3e' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>مصروفات مستحقة (التزامات)</div>
            <div className="text-xl font-black font-mono mt-1 text-amber-400">{formatEGP(unpaidAccruedTotal)}</div>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,212,170,0.12)', color: 'var(--clr-accent)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>مصروفات دورية</div>
            <div className="text-xl font-black font-mono mt-1 text-emerald-400">{recurringCount} بند</div>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
            <Calculator size={24} />
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>إجمالي الالتزامات الكلية</div>
            <div className="text-xl font-black font-mono mt-1 text-white">{formatEGP(totalCashExpenses + unpaidAccruedTotal)}</div>
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
            className={`btn-tab ${viewTab === 'accrued' ? 'active' : ''}`}
            onClick={() => setViewTab('accrued')}
          >
            المصروفات المستحقة ({accruedExpenses.length})
          </button>
        </div>

        {/* Date & Category Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>
            <span>من:</span>
            <input type="date" className="input py-1 px-2 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>
            <span>إلى:</span>
            <input type="date" className="input py-1 px-2 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
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

          <select
            className="input py-1 px-2 text-xs font-bold"
            value={recurrenceFilter}
            onChange={e => setRecurrenceFilter(e.target.value as any)}
          >
            <option value="all">الكل (دوري وعارض)</option>
            <option value="recurring">دوري فقط</option>
            <option value="casual">عارض فقط</option>
          </select>
        </div>
      </div>

      {/* Main Expenses Table */}
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
                      <td className="py-3 px-2 font-mono text-xs">{exp.expense_date}</td>
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
                        {!canEditDelete && (
                          <span className="text-[11px] text-[var(--clr-muted)] italic">
                            صلاحية محددة 🔒
                          </span>
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
        /* Accrued Expenses View */
        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className="font-bold text-lg border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
            سجل المصروفات المستحقة (الالتزامات واجبة السداد)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--clr-border)' }}>
                  <th className="py-3 px-2 font-bold">عنوان / بيان المصروف</th>
                  <th className="py-3 px-2 font-bold">المبلغ المستحق</th>
                  <th className="py-3 px-2 font-bold">التصنيف</th>
                  <th className="py-3 px-2 font-bold">تاريخ الاستحقاق</th>
                  <th className="py-3 px-2 font-bold">الحالة</th>
                  <th className="py-3 px-2 font-bold">الحساب المسدد منه</th>
                  <th className="py-3 px-2 font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {accruedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs font-bold" style={{ color: 'var(--clr-muted)' }}>
                      لا يوجد مصروفات مستحقة مسجلة
                    </td>
                  </tr>
                ) : (
                  accruedExpenses.map(accr => (
                    <tr key={accr.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 font-bold">{accr.title}</td>
                      <td className="py-3 px-2 font-mono font-bold text-amber-400">{formatEGP(accr.amount)}</td>
                      <td className="py-3 px-2 text-xs">{accr.category_name || 'عام'}</td>
                      <td className="py-3 px-2 font-mono text-xs">{accr.due_date || 'غير محدد'}</td>
                      <td className="py-3 px-2">
                        <span className={`badge ${accr.status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                          {accr.status === 'paid' ? 'مسدد' : 'مستحق كالتزام'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-xs" style={{ color: 'var(--clr-accent)' }}>
                        {accr.financial_account_name || '—'}
                      </td>
                      <td className="py-3 px-2 flex items-center gap-2">
                        {accr.status === 'unpaid' && (
                          <button
                            className="btn-primary text-xs py-1 px-3"
                            onClick={() => {
                              setShowPayAccruedModal(accr)
                              if (accounts.length > 0) setPayAccount(accounts[0].id)
                            }}
                          >
                            سداد الآن
                          </button>
                        )}
                        <button
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={() => handleDeleteAccrued(accr.id)}
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleCreateExpense} className="glass-card p-6 w-full max-w-lg flex flex-col gap-4">
            <h3 className="font-bold text-lg border-b pb-2 flex items-center gap-2">
              <Plus size={20} style={{ color: 'var(--clr-primary)' }} />
              تسجيل مصروف جديد وفق المعايير المحاسبية
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
              <input className="input w-full" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="مثال: فاتورة كهرباء شهر أغسطس / إيجار المقر" />
            </div>

            {/* Recurrence Selection */}
            <div className="glass-card p-3 flex flex-col gap-2 bg-white/5">
              <label className="text-xs font-bold block">طبيعة المصروف:</label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="radio" name="rec_type" checked={!expIsRecurring} onChange={() => setExpIsRecurring(false)} />
                  مصروف عارض (مرة واحدة)
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="radio" name="rec_type" checked={expIsRecurring} onChange={() => setExpIsRecurring(true)} />
                  مصروف دوري متكرر
                </label>
              </div>
              {expIsRecurring && (
                <div className="mt-2">
                  <label className="text-xs font-bold block mb-1">معدل التكرار الدوري:</label>
                  <select className="input w-full text-xs" value={expRecurrence} onChange={e => setExpRecurrence(e.target.value as any)}>
                    <option value="monthly">شهرياً (Monthly)</option>
                    <option value="weekly">أسبوعياً (Weekly)</option>
                    <option value="yearly">سنوياً (Yearly)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Payment Method / Settlement Method */}
            <div className="glass-card p-3 flex flex-col gap-3 bg-white/5">
              <label className="text-xs font-bold block text-indigo-300">طريقة المعالجة والسداد المحاسبي:</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="radio" name="pay_type" checked={expPaymentType === 'cash'} onChange={() => setExpPaymentType('cash')} />
                  خصم نقدي مباشر من أحد حسابات النقدية (خزينة / بنك / محفظة)
                </label>
                {expPaymentType === 'cash' && (
                  <div className="mr-6">
                    <label className="text-xs font-bold block mb-1">اختر الحساب النقدي:</label>
                    <select className="input w-full text-xs" value={expFinancialAccount} onChange={e => setExpFinancialAccount(e.target.value)}>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name_ar} (الرصيد: {formatEGP(a.balance)})</option>
                      ))}
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="radio" name="pay_type" checked={expPaymentType === 'accrued'} onChange={() => setExpPaymentType('accrued')} />
                  تسجيل كمصروف مستحق للالتزامات (Accrued Expense Liability)
                </label>
                {expPaymentType === 'accrued' && (
                  <div className="mr-6">
                    <label className="text-xs font-bold block mb-1">تاريخ الاستحقاق الواجب السداد فيه:</label>
                    <input type="date" className="input w-full text-xs" value={expDueDate} onChange={e => setExpDueDate(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddExpenseModal(false)}>إلغاء</button>
              <button type="submit" className="btn-primary">حفظ المصروف المحاسبي</button>
            </div>
          </form>
        </div>
      )}

      {/* Pay Accrued Modal */}
      {showPayAccruedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handlePayAccrued} className="glass-card p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="font-bold text-lg border-b pb-2">
              سداد المصروف المستحق ({showPayAccruedModal.title})
            </h3>

            <div className="text-sm">
              <span className="text-xs font-bold block text-muted">المبلغ المستحق:</span>
              <span className="font-mono text-xl font-black text-amber-400">{formatEGP(showPayAccruedModal.amount)}</span>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">اختر الحساب النقدي الخصم منه:</label>
              <select className="input w-full" value={payAccount} onChange={e => setPayAccount(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name_ar} (الرصيد الحالي: {formatEGP(a.balance)})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowPayAccruedModal(null)}>إلغاء</button>
              <button type="submit" className="btn-primary">تأكيد السداد والخصم النقدي</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
