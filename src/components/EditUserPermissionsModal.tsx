import { useState, useEffect } from 'react'
import { PERMISSIONS_LIST, PermissionDefinition, User } from '../store/authStore'
import { updateUserPermissions } from '../lib/commands'
import { X, ShieldCheck, ShieldAlert, Check, Lock, Phone, User as UserIcon, BellRing, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface EditUserPermissionsModalProps {
  user: User
  onClose: () => void
  onUpdated: () => void
}

export default function EditUserPermissionsModal({
  user,
  onClose,
  onUpdated,
}: EditUserPermissionsModalProps) {
  const [displayName, setDisplayName] = useState(user.display_name)
  const [jobTitle, setJobTitle] = useState(user.job_title || '')
  const [role, setRole] = useState<'admin' | 'staff'>(user.role as any)
  const [isActive, setIsActive] = useState(user.is_active)
  const [phone, setPhone] = useState(user.phone || '')
  const [newPassword, setNewPassword] = useState('')
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let perms: string[] = []
    if (Array.isArray(user.permissions)) {
      perms = user.permissions
    } else if (typeof user.permissions === 'string') {
      try {
        perms = JSON.parse(user.permissions)
      } catch {
        perms = []
      }
    }
    setSelectedPerms(perms)
  }, [user])

  const togglePerm = (key: string) => {
    setSelectedPerms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectAll = () => {
    setSelectedPerms(PERMISSIONS_LIST.map(p => p.key))
  }

  const clearAll = () => {
    setSelectedPerms([])
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateUserPermissions({
        user_id: user.id,
        display_name: displayName.trim() || user.display_name,
        role,
        is_active: isActive,
        phone: phone.trim() || null,
        permissions: role === 'admin' ? PERMISSIONS_LIST.map(p => p.key) : selectedPerms,
        new_password: newPassword.trim() ? newPassword.trim() : null,
        job_title: jobTitle.trim() || null,
      })
      toast.success('تم تحديث بيانات وصلاحيات والمسمى الوظيفي للمستخدم بنجاح!')
      onUpdated()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('فشل تحديث الصلاحيات')
    } finally {
      setSaving(false)
    }
  }

  // Group permissions by category
  const categories = Array.from(new Set(PERMISSIONS_LIST.map(p => p.category)))

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--clr-primary)]/10 text-[var(--clr-primary)] flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[var(--clr-text)]">
                تعديل صلاحيات وبيانات المستخدم
              </h3>
              <p className="text-xs text-[var(--clr-muted)]">
                المستخدم: <strong className="text-[var(--clr-text)]">{user.username}</strong> ({user.display_name})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon p-1 text-[var(--clr-muted)] hover:text-[var(--clr-text)]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {/* Basic User Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-[var(--clr-surface-2)] border" style={{ borderColor: 'var(--clr-border)' }}>
            <div>
              <label className="label text-xs font-bold mb-1">الاسم الظاهر للمستخدم</label>
              <input
                type="text"
                className="input w-full text-xs font-bold"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label text-xs font-bold mb-1 flex items-center gap-1">
                <UserIcon size={13} className="text-blue-400" />
                المسمى الوظيفي (Designation / Job Title)
              </label>
              <input
                type="text"
                className="input w-full text-xs font-bold"
                placeholder="مثال: مدير مبيعات، محاسب رئيسي، فني صيانة..."
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="label text-xs font-bold mb-1 flex items-center gap-1.5">
                <Phone size={13} className="text-emerald-400" />
                رقم الهاتف (لإرسال كود الواتساب OTP)
              </label>
              <input
                type="text"
                dir="ltr"
                className="input w-full text-xs font-mono text-left"
                placeholder="010XXXXXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">الدور الوظيفي (Role)</label>
              <select
                className="input w-full text-xs font-bold"
                value={role}
                onChange={e => setRole(e.target.value as any)}
              >
                <option value="admin">مدير الحسابات والمالية المسؤول (Super Admin - كامل الصلاحيات)</option>
                <option value="staff">موظف (محدد الصلاحيات)</option>
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold mb-1 flex items-center gap-1">
                <Lock size={13} className="text-amber-400" />
                تغيير كلمة المرور (اختياري)
              </label>
              <input
                type="password"
                className="input w-full text-xs font-bold"
                placeholder="اتركه فارغاً للإبقاء على الحالية"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <span className="text-xs font-bold text-[var(--clr-text)]">حالة الحساب (نشط / معطل)</span>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`badge px-3 py-1 text-xs font-bold cursor-pointer transition-all ${
                  isActive ? 'badge-success' : 'badge-danger'
                }`}
              >
                {isActive ? 'حساب نشط ومفعل ✅' : 'حساب معطل وموقوف ⛔'}
              </button>
            </div>
          </div>

          {/* Granular Permissions Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-sm text-[var(--clr-text)] flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[var(--clr-primary)]" />
                  مصفوفة الصلاحيات التفصيلية
                </h4>
                <p className="text-[11px] text-[var(--clr-muted)] mt-0.5">
                  حدد العمليات المسموح للمستخدم القيام بها داخل النظام
                </p>
              </div>

              {role === 'staff' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="btn-secondary text-[11px] py-1 px-2.5 font-bold"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="btn-secondary text-[11px] py-1 px-2.5 font-bold text-red-400"
                  >
                    إلغاء الكل
                  </button>
                </div>
              )}
            </div>

            {role === 'admin' ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <Sparkles size={24} className="text-emerald-400 flex-shrink-0" />
                <div className="text-xs text-emerald-300">
                  <strong>مدير الحسابات والمالية المسؤول (Super Admin):</strong> يمتلك وصولاً كاملاً وغير مقيد لكافة وظائف وشاشات النظام والتقارير المالية وإدارة المستخدمين تلقائياً.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {categories.map(cat => {
                  const catPerms = PERMISSIONS_LIST.filter(p => p.category === cat)
                  return (
                    <div
                      key={cat}
                      className="p-3.5 rounded-2xl bg-[var(--clr-surface-2)] border"
                      style={{ borderColor: 'var(--clr-border)' }}
                    >
                      <div className="font-bold text-xs text-[var(--clr-primary)] mb-2.5 pb-1 border-b" style={{ borderColor: 'var(--clr-border)' }}>
                        {cat}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {catPerms.map(p => {
                          const isChecked = selectedPerms.includes(p.key)
                          return (
                            <div
                              key={p.key}
                              onClick={() => togglePerm(p.key)}
                              className={`p-2.5 rounded-xl border flex items-start justify-between cursor-pointer transition-all duration-150 select-none ${
                                isChecked
                                  ? 'bg-[var(--clr-primary)]/10 border-[var(--clr-primary)] shadow-sm'
                                  : 'bg-[var(--clr-surface-3)] border-[var(--clr-border)] opacity-75 hover:opacity-100'
                              }`}
                            >
                              <div className="flex-1 pr-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold ${isChecked ? 'text-[var(--clr-primary)]' : 'text-[var(--clr-text)]'}`}>
                                    {p.labelAr}
                                  </span>
                                  {p.isSensitive && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      title="عملية حساسة: تولد إشعاراً آلياً لمدير المبيعات عند قيام الموظف بها"
                                    >
                                      <BellRing size={9} />
                                      إشعار للمدير 🔔
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[var(--clr-muted)] mt-0.5 leading-tight">
                                  {p.description}
                                </div>
                              </div>

                              {/* Toggle switch visual */}
                              <div
                                className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 mt-0.5 ${
                                  isChecked ? 'bg-[var(--clr-primary)]' : 'bg-gray-600/40'
                                }`}
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.25 ${
                                    isChecked ? 'right-4' : 'right-0.5'
                                  }`}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
              disabled={saving}
              className="btn-primary flex-1 py-2.5 font-bold text-xs shadow-lg flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات والصلاحيات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
