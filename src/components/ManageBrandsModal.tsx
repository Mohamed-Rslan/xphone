import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Check, X, Tag, Building2 } from 'lucide-react'
import { getBrands, createBrand, updateBrand, deleteBrand } from '../lib/commands'
import toast from 'react-hot-toast'

interface ManageBrandsModalProps {
  onClose: () => void
  onBrandsUpdated?: () => void
}

export default function ManageBrandsModal({ onClose, onBrandsUpdated }: ManageBrandsModalProps) {
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newBrandName, setNewBrandName] = useState('')
  const [adding, setAdding] = useState(false)

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const list = await getBrands()
      setBrands(list)
    } catch (e) {
      console.error(e)
      toast.error('فشل جلب قائمة الماركات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBrandName.trim()) {
      toast.error('أدخل اسم الماركة أو الشركة')
      return
    }
    setAdding(true)
    try {
      const created = await createBrand(newBrandName.trim())
      toast.success(`تم إضافة الماركة "${created.name}" بنجاح!`)
      setNewBrandName('')
      await load()
      if (onBrandsUpdated) onBrandsUpdated()
    } catch (err: any) {
      toast.error(err.toString() || 'فشل إضافة الماركة')
    } finally {
      setAdding(false)
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) {
      toast.error('اسم الماركة لا يمكن أن يكون فارغاً')
      return
    }
    setUpdating(true)
    try {
      await updateBrand(id, editingName.trim())
      toast.success('تم تعديل اسم الماركة بنجاح')
      setEditingId(null)
      setEditingName('')
      await load()
      if (onBrandsUpdated) onBrandsUpdated()
    } catch (err: any) {
      toast.error(err.toString() || 'فشل تعديل الماركة')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteBrand = async (id: number, name: string) => {
    if (!window.confirm(`هل أنت تأكد من حذف أو إلغاء تفعيل الماركة "${name}"؟`)) return
    try {
      await deleteBrand(id)
      toast.success(`تم حذف/إلغاء تفعيل الماركة "${name}"`)
      await load()
      if (onBrandsUpdated) onBrandsUpdated()
    } catch (err: any) {
      toast.error(err.toString() || 'فشل حذف الماركة')
    }
  }

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase().trim())
  )

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" style={{ maxWidth: 540 }}>
        <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-2">
            <Building2 className="text-[var(--clr-primary)]" size={20} />
            <div>
              <h3 className="font-bold text-lg">إدارة الماركات والشركات المصنعة</h3>
              <p className="text-xs text-[var(--clr-muted)]">إضافة وتعديل أسماء الشركاء والماركات (هواتف، إكسسوارات، صيانة)</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Form to Add New Brand */}
        <form onSubmit={handleAddBrand} className="glass-card p-3 mb-4 flex gap-2 items-center">
          <input
            className="input text-xs font-bold flex-1"
            placeholder="اسم الماركة أو الشركة الجديدة (مثال: Anker, Joyroom, Baseus...)"
            value={newBrandName}
            onChange={e => setNewBrandName(e.target.value)}
            disabled={adding}
          />
          <button
            type="submit"
            className="btn-primary text-xs py-2 px-3 flex items-center gap-1 font-bold whitespace-nowrap"
            disabled={adding}
          >
            <Plus size={15} />
            {adding ? 'جاري الإضافة...' : 'إضافة الماركة'}
          </button>
        </form>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-[var(--clr-muted)]" />
          <input
            className="input text-xs py-2 pr-9 w-full"
            placeholder="بحث في الماركات المسجلة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Brands List Table */}
        <div className="max-h-[300px] overflow-y-auto border rounded-xl" style={{ borderColor: 'var(--clr-border)' }}>
          <table className="w-full text-right text-xs">
            <thead className="sticky top-0 bg-[var(--clr-surface-2)] border-b" style={{ borderColor: 'var(--clr-border)' }}>
              <tr>
                <th className="py-2.5 px-3 font-bold">اسم الماركة / الشركة</th>
                <th className="py-2.5 px-3 font-bold text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredBrands.map(b => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3 font-bold">
                    {editingId === b.id ? (
                      <input
                        className="input py-1 px-2 text-xs font-bold w-full"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span className="font-mono text-sm text-[var(--clr-text)]" dir="ltr">{b.name}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-left">
                    {editingId === b.id ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          className="btn-icon text-emerald-400 hover:bg-emerald-500/20"
                          onClick={() => handleSaveEdit(b.id)}
                          disabled={updating}
                          title="حفظ التعديل"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon text-gray-400 hover:bg-gray-500/20"
                          onClick={() => { setEditingId(null); setEditingName('') }}
                          title="إلغاء"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          className="btn-icon text-blue-400 hover:bg-blue-500/20"
                          onClick={() => { setEditingId(b.id); setEditingName(b.name) }}
                          title="تعديل اسم الماركة"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon text-rose-400 hover:bg-rose-500/20"
                          onClick={() => handleDeleteBrand(b.id, b.name)}
                          title="حذف / إلغاء التفعيل"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredBrands.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center py-8 text-[var(--clr-muted)] text-xs">
                    {loading ? 'جاري تحميل الماركات...' : 'لا توجد ماركات مسجلة تطابق البحث'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4 border-t pt-3" style={{ borderColor: 'var(--clr-border)' }}>
          <span className="text-xs text-[var(--clr-muted)] font-mono font-bold">إجمالي الماركات: {brands.length}</span>
          <button type="button" className="btn-secondary text-xs" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}
