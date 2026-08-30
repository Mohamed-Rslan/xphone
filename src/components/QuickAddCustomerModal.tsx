import { useState } from 'react'
import { X, UserPlus, Phone, User, MapPin, FileText } from 'lucide-react'
import { createCustomer } from '../lib/commands'
import toast from 'react-hot-toast'

interface QuickAddCustomerModalProps {
  onClose: () => void
  onSuccess: (newCustomer: any) => void
}

export default function QuickAddCustomerModal({ onClose, onSuccess }: QuickAddCustomerModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم العميل')
      return
    }
    setLoading(true)
    const t = toast.loading('جاري إضافة العميل...')
    try {
      const result = await createCustomer({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      })
      toast.success('تمت إضافة العميل بنجاح واختياره في الفاتورة!', { id: t })
      onSuccess(result)
      onClose()
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'فشل إضافة العميل', { id: t })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-overlay z-[100]"
      style={{ zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-content max-w-md bg-[var(--clr-surface-1)] border border-[var(--clr-border)] shadow-2xl p-6 rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[var(--clr-primary)]/15 text-[var(--clr-primary)] flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-[var(--clr-text)]">إضافة عميل جديد</h4>
              <p className="text-xs text-[var(--clr-muted)]">إضافة العميل ومتابعة تسجيل الفاتورة</p>
            </div>
          </div>
          <button className="btn-icon" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-3.5">
          <div>
            <label className="label font-bold text-xs flex items-center gap-1">
              <User size={13} className="text-[var(--clr-primary)]" />
              اسم العميل *
            </label>
            <input
              type="text"
              className="input w-full font-bold"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: محمد أحمد"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label font-bold text-xs flex items-center gap-1">
              <Phone size={13} className="text-[var(--clr-primary)]" />
              رقم الهاتف
            </label>
            <input
              type="text"
              className="input w-full font-mono text-left"
              dir="ltr"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="010xxxxxxxx"
            />
          </div>

          <div>
            <label className="label font-bold text-xs flex items-center gap-1">
              <MapPin size={13} className="text-[var(--clr-primary)]" />
              العنوان (اختياري)
            </label>
            <input
              type="text"
              className="input w-full text-xs"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="العنوان أو المنطقة..."
            />
          </div>

          <div>
            <label className="label font-bold text-xs flex items-center gap-1">
              <FileText size={13} className="text-[var(--clr-primary)]" />
              ملاحظات (اختياري)
            </label>
            <input
              type="text"
              className="input w-full text-xs"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية عن العميل..."
            />
          </div>

          <div className="flex gap-2.5 mt-2 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
            <button type="button" className="btn-secondary flex-1 py-2.5 font-bold" onClick={onClose} disabled={loading}>
              إلغاء
            </button>
            <button type="submit" className="btn-primary flex-1 py-2.5 font-bold shadow-lg" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ واختيار العميل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
