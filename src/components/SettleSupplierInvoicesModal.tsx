import { useState, useEffect } from 'react'
import { Landmark, CheckSquare, Square, CheckCircle2, X } from 'lucide-react'
import { getSuppliers, getUnpaidSupplierInvoices, settleSupplierInvoices, getFinancialAccounts } from '../lib/commands'
import { formatEGP, formatDateTime } from '../lib/utils'
import toast from 'react-hot-toast'

interface SettleSupplierInvoicesModalProps {
  initialSupplierId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function SettleSupplierInvoicesModal({
  initialSupplierId,
  onClose,
  onSuccess
}: SettleSupplierInvoicesModalProps) {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId || '')
  const [accounts, setAccounts] = useState<any[]>([])
  const [financialAccountId, setFinancialAccountId] = useState<string>('cash_drawer')
  
  const [invoices, setInvoices] = useState<any[]>([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<{ [id: string]: boolean }>({})
  const [settlementAmounts, setSettlementAmounts] = useState<{ [id: string]: number }>({})
  const [notes, setNotes] = useState('')
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load Suppliers & Financial Accounts
  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(console.error)
    getFinancialAccounts().then(accs => {
      setAccounts(accs || [])
      if (accs && accs.length > 0 && !financialAccountId) {
        setFinancialAccountId(accs[0].id)
      }
    }).catch(console.error)
  }, [])

  // Load Unpaid Supplier Invoices when supplier changes
  useEffect(() => {
    if (!selectedSupplierId) {
      setInvoices([])
      setSelectedInvoiceIds({})
      setSettlementAmounts({})
      return
    }

    setLoadingInvoices(true)
    getUnpaidSupplierInvoices(selectedSupplierId)
      .then(invs => {
        setInvoices(invs || [])
        // By default, pre-select all unpaid purchase orders
        const initSelect: { [id: string]: boolean } = {}
        const initAmounts: { [id: string]: number } = {}
        ;(invs || []).forEach(inv => {
          initSelect[inv.purchase_order_id] = true
          initAmounts[inv.purchase_order_id] = inv.remaining_amount
        })
        setSelectedInvoiceIds(initSelect)
        setSettlementAmounts(initAmounts)
      })
      .catch(err => {
        console.error(err)
        toast.error('فشل تحميل فواتير المشتريات الآجلة للمورد')
      })
      .finally(() => setLoadingInvoices(false))
  }, [selectedSupplierId])

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)
  const selectedAccount = accounts.find(a => a.id === financialAccountId)

  // Toggle invoice selection
  const toggleSelectInvoice = (id: string, remaining: number) => {
    setSelectedInvoiceIds(prev => {
      const next = { ...prev, [id]: !prev[id] }
      if (next[id] && (settlementAmounts[id] === undefined || settlementAmounts[id] <= 0)) {
        setSettlementAmounts(a => ({ ...a, [id]: remaining }))
      }
      return next
    })
  }

  // Toggle select all
  const toggleSelectAll = () => {
    const allSelected = invoices.every(inv => selectedInvoiceIds[inv.purchase_order_id])
    const nextSelect: { [id: string]: boolean } = {}
    const nextAmounts: { [id: string]: number } = { ...settlementAmounts }

    invoices.forEach(inv => {
      nextSelect[inv.purchase_order_id] = !allSelected
      if (!allSelected) {
        nextAmounts[inv.purchase_order_id] = inv.remaining_amount
      }
    })
    setSelectedInvoiceIds(nextSelect)
    setSettlementAmounts(nextAmounts)
  }

  // Handle manual amount edit per invoice
  const handleAmountChange = (id: string, val: string, max: number) => {
    const num = parseFloat(val)
    if (isNaN(num)) {
      setSettlementAmounts(prev => ({ ...prev, [id]: 0 }))
    } else {
      const clamped = Math.min(Math.max(0, num), max)
      setSettlementAmounts(prev => ({ ...prev, [id]: clamped }))
    }
  }

  // Calculations
  const totalSelectedRemaining = invoices
    .filter(inv => selectedInvoiceIds[inv.purchase_order_id])
    .reduce((sum, inv) => sum + inv.remaining_amount, 0)

  const totalPayingAmount = invoices
    .filter(inv => selectedInvoiceIds[inv.purchase_order_id])
    .reduce((sum, inv) => sum + (settlementAmounts[inv.purchase_order_id] || 0), 0)

  const supplierTotalBalance = invoices.reduce((sum, inv) => sum + inv.remaining_amount, 0)
  const remainingDebtAfterSettlement = Math.max(0, supplierTotalBalance - totalPayingAmount)

  const isAccountBalanceLow = selectedAccount ? selectedAccount.balance < totalPayingAmount : false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSupplierId) {
      return toast.error('يرجى اختيار المورد أولاً')
    }
    if (!financialAccountId) {
      return toast.error('يرجى اختيار حساب النقدية المسدد منه')
    }

    const settlements = invoices
      .filter(inv => selectedInvoiceIds[inv.purchase_order_id] && (settlementAmounts[inv.purchase_order_id] || 0) > 0)
      .map(inv => ({
        invoice_id: inv.purchase_order_id,
        amount: settlementAmounts[inv.purchase_order_id]
      }))

    if (settlements.length === 0 || totalPayingAmount <= 0) {
      return toast.error('يرجى تحديد فاتورة واحدة على الأقل وتحديد مبلغ سداد أكبر من صفر')
    }

    if (isAccountBalanceLow) {
      return toast.error(`رصيد الحساب المالي المحدد (${formatEGP(selectedAccount.balance)}) لا يكفي لسداد ${formatEGP(totalPayingAmount)}`)
    }

    setSubmitting(true)
    const t = toast.loading('جاري تسجيل سداد مستحقات المورد وتحديث الحسابات والأرصدة...')
    try {
      const res = await settleSupplierInvoices({
        supplier_id: selectedSupplierId,
        settlements,
        financial_account_id: financialAccountId,
        notes: notes.trim() || null,
        user_id: null,
      })

      toast.success(
        `تم سداد ${formatEGP(res.total_settled)} للمورد ${res.supplier_name} وخصمها من ${res.financial_account_name} بنجاح!`,
        { id: t, duration: 4000 }
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(typeof err === 'string' ? err : 'فشل تسجيل سداد المورد', { id: t })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay z-50" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="modal-content p-6 overflow-y-auto"
        style={{ width: '95%', maxWidth: '1100px', maxHeight: '92vh', margin: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3.5 mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--clr-primary)]/15 border border-[var(--clr-primary)]/30 text-[var(--clr-primary)] flex items-center justify-center">
              <Landmark size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--clr-text)]">
                سداد مستحقات وفواتير الموردين (تسوية الالتزامات المتداولة)
              </h3>
              <p className="text-xs text-[var(--clr-muted)] mt-0.5">
                تحديد فاتورة مشتريات أو أكثر لسدادها كلياً أو جزئياً وتحديث رصيد المورد وحساب النقدية المقابل
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Top Controls: Supplier & Paying Financial Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--clr-surface-2)] border" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <label className="label text-xs font-bold mb-1">المورد المطلوب سداد مستحقاته *</label>
              <select
                className="input text-xs w-full font-bold"
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                disabled={!!initialSupplierId}
                required
              >
                <option value="">-- اختر المورد --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ''} {s.balance > 0 ? `[مستحقات: ${formatEGP(s.balance)}]` : ''}
                  </option>
                ))}
              </select>
              {selectedSupplier && (
                <div className="text-[11px] text-[var(--clr-muted)] mt-1 flex items-center gap-2">
                  <span>الهاتف: <b className="font-mono text-[var(--clr-text)]">{selectedSupplier.phone || '—'}</b></span>
                  <span>•</span>
                  <span>إجمالي المستحقات القائمة: <b className="font-mono text-red-400">{formatEGP(supplierTotalBalance)}</b></span>
                </div>
              )}
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">الحساب المالي المسدد منه (النقدية) *</label>
              <select
                className="input text-xs w-full font-bold"
                value={financialAccountId}
                onChange={e => setFinancialAccountId(e.target.value)}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name_ar} (الرصيد المتوفر: {formatEGP(a.balance)})
                  </option>
                ))}
              </select>
              {selectedAccount && (
                <div className="text-[11px] text-[var(--clr-muted)] mt-1 flex items-center justify-between">
                  <span>الرصيد المتوفر بالحساب: <b className={`font-mono ${isAccountBalanceLow ? 'text-red-400' : 'text-emerald-400'}`}>{formatEGP(selectedAccount.balance)}</b></span>
                  {isAccountBalanceLow && <span className="text-red-400 font-bold">⚠️ الرصيد غير كافٍ</span>}
                </div>
              )}
            </div>
          </div>

          {/* Invoices List */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--clr-text)]">فواتير المشتريات الآجلة غير المسددة للمورد:</span>
                <span className="badge badge-muted text-xs font-mono">{invoices.length} فواتير</span>
              </div>

              {invoices.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="btn-secondary text-xs px-2.5 py-1 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {invoices.every(inv => selectedInvoiceIds[inv.purchase_order_id]) ? <Square size={13} /> : <CheckSquare size={13} />}
                  {invoices.every(inv => selectedInvoiceIds[inv.purchase_order_id]) ? 'إلغاء تحديد الكل' : 'تحديد كافة الفواتير'}
                </button>
              )}
            </div>

            <div className="glass-card overflow-hidden border rounded-xl" style={{ borderColor: 'var(--clr-border)' }}>
              <table className="data-table text-xs">
                <thead>
                  <tr style={{ background: 'var(--clr-surface-3)' }}>
                    <th style={{ width: '40px' }} className="text-center">اختيار</th>
                    <th>رقم/بيان الفاتورة</th>
                    <th>تاريخ الشراء</th>
                    <th>الأصناف الموردة</th>
                    <th>إجمالي الفاتورة</th>
                    <th>المسدد سابقاً</th>
                    <th>المتبقي المستحق</th>
                    <th style={{ width: '180px' }}>المبلغ المراد سداده</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInvoices ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-[var(--clr-muted)] font-bold">
                        جاري تحميل فواتير المشتريات الآجلة...
                      </td>
                    </tr>
                  ) : !selectedSupplierId ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-[var(--clr-muted)]">
                        يرجى اختيار المورد من القائمة أعلاه لعرض فواتيره الآجلة
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-emerald-400 font-bold">
                        <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-400" />
                        هذا المورد ليس له أي فواتير آجلة أو مستحقات متبقية!
                      </td>
                    </tr>
                  ) : (
                    invoices.map(inv => {
                      const isChecked = !!selectedInvoiceIds[inv.purchase_order_id]
                      const curAmt = settlementAmounts[inv.purchase_order_id] !== undefined ? settlementAmounts[inv.purchase_order_id] : inv.remaining_amount
                      const isFull = curAmt >= inv.remaining_amount

                      return (
                        <tr
                          key={inv.purchase_order_id}
                          className={`transition-colors ${isChecked ? 'bg-primary/5' : 'opacity-75'}`}
                        >
                          <td className="text-center">
                            <input
                              type="checkbox"
                              className="checkbox cursor-pointer"
                              checked={isChecked}
                              onChange={() => toggleSelectInvoice(inv.purchase_order_id, inv.remaining_amount)}
                            />
                          </td>
                          <td className="font-mono font-bold text-[var(--clr-primary)]">
                            {inv.order_no || 'فاتورة مشتريات'}
                          </td>
                          <td className="font-mono text-[11px] text-[var(--clr-muted)]">
                            {formatDateTime(inv.created_at)}
                          </td>
                          <td className="max-w-xs truncate text-[11px]" title={inv.items_summary}>
                            {inv.items_summary}
                          </td>
                          <td className="font-mono font-bold">
                            {formatEGP(inv.total_cost)}
                          </td>
                          <td className="font-mono text-emerald-400">
                            {formatEGP(inv.amount_paid)}
                          </td>
                          <td className="font-mono font-bold text-red-400">
                            {formatEGP(inv.remaining_amount)}
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={inv.remaining_amount}
                                disabled={!isChecked}
                                className="input py-1 px-2 text-xs font-mono font-bold text-left w-28 disabled:opacity-40"
                                value={curAmt}
                                onChange={e => handleAmountChange(inv.purchase_order_id, e.target.value, inv.remaining_amount)}
                              />
                              <button
                                type="button"
                                disabled={!isChecked}
                                onClick={() => handleAmountChange(inv.purchase_order_id, inv.remaining_amount.toString(), inv.remaining_amount)}
                                className={`badge text-[10px] py-1 px-1.5 font-bold cursor-pointer transition-all ${
                                  isFull ? 'badge-primary' : 'badge-muted hover:badge-primary'
                                }`}
                                title="سداد كامل المبلغ المستحق"
                              >
                                كامل
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
          </div>

          {/* Settlement Live Summary Strip */}
          {invoices.length > 0 && (
            <div className="rounded-xl border overflow-hidden p-3 bg-[var(--clr-surface-2)]" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-2 rounded-lg bg-[var(--clr-surface-3)] border" style={{ borderColor: 'var(--clr-border)' }}>
                  <div className="text-[var(--clr-muted)] text-[11px]">إجمالي الفواتير المحددة</div>
                  <div className="text-sm font-bold font-mono text-[var(--clr-text)] mt-0.5">
                    {formatEGP(totalSelectedRemaining)}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[var(--clr-primary)]/10 border border-[var(--clr-primary)]/30">
                  <div className="text-[var(--clr-primary)] text-[11px] font-bold">إجمالي المبلغ المسدد للمورد (-)</div>
                  <div className="text-base font-bold font-mono text-[var(--clr-primary)] mt-0.5">
                    {formatEGP(totalPayingAmount)}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[var(--clr-surface-3)] border" style={{ borderColor: 'var(--clr-border)' }}>
                  <div className="text-[var(--clr-muted)] text-[11px]">مستحقات المورد المتبقية</div>
                  <div className={`text-sm font-bold font-mono mt-0.5 ${remainingDebtAfterSettlement > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatEGP(remainingDebtAfterSettlement)}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[var(--clr-surface-3)] border" style={{ borderColor: 'var(--clr-border)' }}>
                  <div className="text-[var(--clr-muted)] text-[11px]">الحساب المالي المسدد منه</div>
                  <div className="text-xs font-bold text-emerald-400 mt-1 truncate">
                    {selectedAccount?.name_ar || 'الخزينة'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label text-xs font-bold mb-1">ملاحظات وبيان عملية السداد (اختياري)</label>
            <input
              type="text"
              className="input text-xs w-full"
              placeholder="مثال: سداد نقدي للمندوب / تحويل بنكي / شيك..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t mt-2" style={{ borderColor: 'var(--clr-border)' }}>
            <button
              type="button"
              className="btn-secondary text-xs py-2 px-4"
              onClick={onClose}
              disabled={submitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || invoices.length === 0 || totalPayingAmount <= 0 || isAccountBalanceLow}
              className="btn-primary text-xs py-2 px-6 font-bold flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              {submitting ? 'جاري السداد...' : `تأكيد سداد ${formatEGP(totalPayingAmount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
