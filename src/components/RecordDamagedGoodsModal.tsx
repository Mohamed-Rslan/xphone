import { useState, useEffect } from 'react'
import { getProducts, recordDamagedGoods } from '../lib/commands'
import { useAuthStore } from '../store/authStore'
import { formatEGP, formatNumber } from '../lib/utils'
import { X, Trash2, AlertTriangle, Check, ShieldAlert, Package } from 'lucide-react'
import toast from 'react-hot-toast'

interface RecordDamagedGoodsModalProps {
  initialProductId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function RecordDamagedGoodsModal({
  initialProductId,
  onClose,
  onSuccess,
}: RecordDamagedGoodsModalProps) {
  const { user } = useAuthStore()
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState(initialProductId || '')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    getProducts()
      .then(prods => {
        setProducts(prods.filter((p: any) => p.is_active && p.stock_qty > 0))
        if (!selectedProductId && prods.length > 0) {
          const available = prods.find((p: any) => p.stock_qty > 0)
          if (available) setSelectedProductId(available.id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const selectedProduct = products.find(p => p.id === selectedProductId)
  const unitCost = selectedProduct?.cost_price || 0
  const maxStock = selectedProduct?.stock_qty || 0
  const totalCost = qty * unitCost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) {
      toast.error('يرجى اختيار الصنف التالف')
      return
    }
    if (qty <= 0) {
      toast.error('الكمية يجب أن تكون أكبر من صفر')
      return
    }
    if (qty > maxStock) {
      toast.error(`الكمية المحددة أكبر من رصيد المخزون الحالي (${maxStock} قطعة)`)
      return
    }

    setSubmitting(true)
    try {
      await recordDamagedGoods({
        product_id: selectedProductId,
        qty,
        reason: reason.trim() || 'بضاعة تالفة / هالك مخزن',
        user_id: user?.id,
      })
      toast.success('تم تسجيل البضاعة الهالكة بنجاح وخصمها من المخزون وقيد تكلفتها كمصروفات!')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.toString() || 'فشل تسجيل البضاعة الهالكة')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content p-6 max-w-lg w-full animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[var(--clr-text)]">
                تسجيل بضاعة هالك وتالف
              </h3>
              <p className="text-xs text-[var(--clr-muted)]">
                استبعاد الأصناف التالفة وتحميل تكلفتها على خسائر وهالك التشغيل
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon p-1 text-[var(--clr-muted)] hover:text-[var(--clr-text)]">
            <X size={18} />
          </button>
        </div>

        {/* Warning banner */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300 mb-4">
          <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
          <span>
            هذه العملية حساسة: سيتم <strong>خصم الكمية فوراً من المخزون</strong> وإدراج تكلفتها في <strong>قائمة الدخل كمصروفات</strong> وإرسال إشعار فوري لمدير المبيعات.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Product Picker */}
          <div>
            <label className="label text-xs font-bold mb-1">اختر الصنف التالف *</label>
            <select
              className="input w-full text-xs font-bold"
              value={selectedProductId}
              onChange={e => {
                setSelectedProductId(e.target.value)
                setQty(1)
              }}
              disabled={loading}
              required
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name_ar} (المتاح: {formatNumber(p.stock_qty)} قطعة | تكلفة: {formatEGP(p.cost_price)})
                </option>
              ))}
            </select>
          </div>

          {/* Product info pill */}
          {selectedProduct && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--clr-surface-2)] border" style={{ borderColor: 'var(--clr-border)' }}>
              <div>
                <span className="text-[11px] text-[var(--clr-muted)] block">الرصيد بالمخزن:</span>
                <span className="font-bold text-sm text-[var(--clr-text)] font-mono">
                  {formatNumber(selectedProduct.stock_qty)} قطعة
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[var(--clr-muted)] block">سعر تكلفة الوحدة:</span>
                <span className="font-bold text-sm text-[var(--clr-primary)] font-mono">
                  {formatEGP(selectedProduct.cost_price)}
                </span>
              </div>
            </div>
          )}

          {/* Damaged Quantity */}
          <div>
            <label className="label text-xs font-bold mb-1">الكمية التالفة / الهالكة *</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={maxStock}
                className="input w-full text-sm font-bold font-mono"
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
              <span className="text-xs font-bold text-[var(--clr-muted)] whitespace-nowrap">
                قطعة
              </span>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="label text-xs font-bold mb-1">سبب التلف / الاستبعاد *</label>
            <input
              type="text"
              className="input w-full text-xs font-bold"
              placeholder="مثال: كسر بالشاشة أثناء النقل / عيب مصنعي / تلف بالرطوبة..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            />
          </div>

          {/* Cost Summary Box */}
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-red-400 block">إجمالي تكلفة الخسارة (المصروف):</span>
              <span className="text-[10px] text-red-300/80">تُقيد كمصروف بضاعة تالفة في تقرير الأرباح</span>
            </div>
            <span className="text-xl font-bold font-mono text-red-400">
              {formatEGP(totalCost)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3 border-t mt-2" style={{ borderColor: 'var(--clr-border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5 font-bold text-xs"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedProduct}
              className="btn-primary flex-1 py-2.5 font-bold text-xs shadow-lg flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              <Check size={16} />
              {submitting ? 'جاري التسجيل...' : 'تأكيد تسجيل الهالك'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
