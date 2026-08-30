import { useState, useEffect, useRef } from 'react'
import { getSettings, getUsers, createUser } from '../../lib/commands'
import { Plus, Palette, Check, Sparkles, User, Store, Upload, Image as ImageIcon, Trash2, Camera, ShieldCheck, Type, ZoomIn } from 'lucide-react'
import { useThemeStore, THEMES } from '../../store/themeStore'
import { useSettingsStore } from '../../store/settingsStore'
import toast from 'react-hot-toast'

import EditUserPermissionsModal from '../../components/EditUserPermissionsModal'

interface SettingsPageProps {
  scale?: number
  setScale?: (scale: number | ((prev: number) => number)) => void
}

export default function SettingsPage({ scale = 0.9, setScale }: SettingsPageProps) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<any[]>([])
  const [tab, setTab] = useState<'general' | 'users' | 'themes'>('general')
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { currentTheme, setTheme } = useThemeStore()
  const { storeLogo, storeName, saveStoreSettings, loadSettings } = useSettingsStore()

  const load = async () => {
    const [s, u] = await Promise.all([getSettings(), getUsers()])
    const map: Record<string, string> = {}
    s.forEach((item: any) => { map[item.key] = item.value })
    setSettings(map)
    setUsers(u)
  }

  useEffect(() => { load().catch(console.error) }, [])

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP)')
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 3 ميجابايت')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      if (base64) {
        setSettings(s => ({ ...s, store_logo: base64 }))
        toast.success('تم تحميل اللوجو للمعاينة! اضغط حفظ لاعتماده')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setSettings(s => ({ ...s, store_logo: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
    toast.success('تمت إزالة اللوجو')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveStoreSettings({
        name: settings.store_name ?? 'XPhone',
        logo: settings.store_logo ?? '',
        address: settings.store_address ?? '',
        phone: settings.store_phone ?? '',
      })
      await loadSettings()
      toast.success('تم حفظ إعدادات وبيانات المتجر بنجاح!')
    } catch (e: any) {
      console.error(e)
      toast.error('فشل حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      <div className="page-header">
        <h1 className="page-title">الإعدادات</h1>
        <p className="text-xs text-[var(--clr-muted)] mt-0.5">
          إدارة إعدادات المتجر، حسابات المستخدمين، ومظهر وثيمات التطبيق
        </p>
      </div>

      <div className="flex gap-2">
        <button
          className={`badge cursor-pointer px-4 py-2.5 text-sm font-bold flex items-center gap-1.5 transition-all ${
            tab === 'general' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
          onClick={() => setTab('general')}
        >
          <Store size={15} />
          معلومات المتجر واللوجو
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 text-sm font-bold flex items-center gap-1.5 transition-all ${
            tab === 'users' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
          onClick={() => setTab('users')}
        >
          <User size={15} />
          المستخدمون والصلاحيات ({users.length})
        </button>

        <button
          className={`badge cursor-pointer px-4 py-2.5 text-sm font-bold flex items-center gap-1.5 transition-all ${
            tab === 'themes' ? 'badge-primary shadow-lg' : 'badge-muted'
          }`}
          onClick={() => setTab('themes')}
        >
          <Palette size={15} />
          المظهر والثيمات الألوان ({THEMES.length})
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 1. GENERAL STORE SETTINGS & LOGO */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Details Form */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2 text-[var(--clr-text)]">
              <Store size={18} className="text-[var(--clr-primary)]" />
              معلومات وهوية المتجر
            </h3>

            <div>
              <label className="label font-bold text-xs">اسم المتجر / الشركة *</label>
              <input
                className="input w-full font-bold text-sm"
                placeholder="مثال: متجر XPhone للأجهزة الذكية"
                value={settings.store_name ?? ''}
                onChange={e => setSettings(s => ({ ...s, store_name: e.target.value }))}
              />
            </div>

            <div>
              <label className="label font-bold text-xs">عنوان المتجر / الفرع</label>
              <input
                className="input w-full text-xs"
                placeholder="مثال: القاهرة - فرع وسط البلد"
                value={settings.store_address ?? ''}
                onChange={e => setSettings(s => ({ ...s, store_address: e.target.value }))}
              />
            </div>

            <div>
              <label className="label font-bold text-xs">رقم هاتف المتجر للتواصل</label>
              <input
                className="input w-full font-mono text-left text-xs"
                dir="ltr"
                placeholder="010XXXXXXXX"
                value={settings.store_phone ?? ''}
                onChange={e => setSettings(s => ({ ...s, store_phone: e.target.value }))}
              />
            </div>

            <div className="pt-3 border-t mt-2 flex justify-end" style={{ borderColor: 'var(--clr-border)' }}>
              <button
                className="btn-primary font-bold px-7 py-2.5 shadow-lg cursor-pointer flex items-center gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                <Check size={16} />
                {saving ? 'جاري الحفظ...' : 'حفظ بيانات المتجر واللوجو'}
              </button>
            </div>
          </div>

          {/* Company Logo Upload & Live Preview Card */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2 text-[var(--clr-text)]">
              <Camera size={18} className="text-[var(--clr-accent)]" />
              شعار / لوجو الشركة (أيقونة النظام)
            </h3>
            <p className="text-xs text-[var(--clr-muted)]">
              يتم عرض اللوجو كأيقونة رئيسية للبرنامج بأعلى الشاشة، وفي الشريط الجانبي، وعلى فواتير البيع والإيصالات المطبوعة.
            </p>

            {/* Upload Area */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoFileChange}
            />

            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-colors text-center"
              style={{
                borderColor: settings.store_logo ? 'var(--clr-primary)' : 'var(--clr-border)',
                background: 'var(--clr-surface-2)'
              }}
            >
              {settings.store_logo ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group">
                    <img
                      src={settings.store_logo}
                      alt="Company Logo"
                      className="w-24 h-24 object-contain rounded-2xl p-2 bg-black/20 border shadow-lg"
                      style={{ borderColor: 'var(--clr-border-2)' }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md cursor-pointer transition-transform hover:scale-110"
                      title="حذف اللوجو"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="text-xs font-bold text-emerald-400">
                    تم اختيار اللوجو بنجاح
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={13} />
                      تغيير الصورة
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1.5 px-3 font-bold text-red-400 border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 size={13} />
                      إزالة
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-14 h-14 rounded-2xl bg-[var(--clr-primary)]/10 text-[var(--clr-primary)] flex items-center justify-center mb-1">
                    <Upload size={26} />
                  </div>
                  <div className="text-sm font-bold text-[var(--clr-text)]">
                    انقر هنا لاختيار صورة اللوجو
                  </div>
                  <div className="text-[11px] text-[var(--clr-muted)]">
                    يدعم صيغ PNG, JPG, SVG, WebP (الحجم الموصى به: مربع أو دائري)
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs mt-2 py-1.5 px-4 font-bold"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                  >
                    استعراض الملفات...
                  </button>
                </div>
              )}
            </div>

            {/* Live Visual Appearance Preview */}
            <div className="p-3.5 rounded-xl bg-[var(--clr-surface-3)] border" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="text-[11px] font-bold text-[var(--clr-muted)] mb-2">
                معاينة حية لشكل الأيقونة بالأعلى:
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--clr-border)]">
                {settings.store_logo ? (
                  <img
                    src={settings.store_logo}
                    alt="Logo preview"
                    className="w-9 h-9 object-contain rounded-xl shadow-sm border border-[var(--clr-border)]"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg, var(--clr-primary), var(--clr-accent))' }}
                  >
                    {(settings.store_name || 'X')[0]}
                  </div>
                )}
                <div>
                  <div className="font-bold text-sm text-[var(--clr-text)]">
                    {settings.store_name || 'اسم المتجر / الشركة'}
                  </div>
                  <div className="text-[10px] text-[var(--clr-muted)]">
                    أيقونة النظام الرئيسية
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 2. USERS MANAGEMENT & GRANULAR PERMISSIONS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-base text-[var(--clr-text)]">
                إدارة المستخدمين وصلاحيات الأدوار
              </h3>
              <p className="text-xs text-[var(--clr-muted)]">
                يمكن لمدير المبيعات المسؤول تحديد الصلاحيات التفصيلية لكل موظف وتعيين رقم هاتف الواتساب
              </p>
            </div>

            <button
              id="add-user-btn"
              className="btn-primary font-bold flex items-center gap-1.5 cursor-pointer shadow-lg px-4 py-2.5"
              onClick={() => setShowUserModal(true)}
            >
              <Plus size={16} /> إضافة مستخدم جديد
            </button>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم المستخدم</th>
                  <th>الاسم الكامل</th>
                  <th>الدور والوظيفة</th>
                  <th>رقم الهاتف (WhatsApp)</th>
                  <th>الصلاحيات الممنوحة</th>
                  <th>الحالة</th>
                  <th className="text-center">إدارة الصلاحيات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  let permsCount = 0
                  if (Array.isArray(u.permissions)) permsCount = u.permissions.length
                  else if (typeof u.permissions === 'string') {
                    try { permsCount = JSON.parse(u.permissions).length } catch {}
                  }

                  return (
                    <tr key={u.id} className="hover:bg-[var(--clr-surface-2)] transition-colors">
                      <td dir="ltr" className="font-mono font-bold text-xs text-[var(--clr-primary)]">
                        {u.username}
                      </td>
                      <td className="font-bold text-sm text-[var(--clr-text)]">
                        {u.display_name}
                      </td>
                      <td>
                        <span className={`badge font-bold text-xs ${u.role === 'admin' ? 'badge-primary shadow-sm' : 'badge-muted'}`}>
                          {u.role === 'admin' ? '👑 مدير المبيعات المسؤول' : '👤 موظف / كاشير'}
                        </span>
                      </td>
                      <td dir="ltr" className="font-mono text-xs text-[var(--clr-muted)]">
                        {u.phone || '—'}
                      </td>
                      <td>
                        {u.role === 'admin' ? (
                          <span className="badge badge-success text-[11px] font-bold">
                            كامل الصلاحيات (غير مقيد) ⭐
                          </span>
                        ) : (
                          <span className="badge badge-muted text-[11px] font-bold">
                            {permsCount} صلاحية مفعلة
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge text-xs font-bold ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {u.is_active ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="btn-secondary text-xs py-1.5 px-3 font-bold flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-sm hover:border-[var(--clr-primary)]"
                        >
                          <ShieldCheck size={14} className="text-[var(--clr-primary)]" />
                          تعديل الصلاحيات والمستخدم
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Edit User Permissions Modal */}
          {editingUser && (
            <EditUserPermissionsModal
              user={editingUser}
              onClose={() => setEditingUser(null)}
              onUpdated={() => {
                load()
                setEditingUser(null)
              }}
            />
          )}

          {/* Add User Modal */}
          {showUserModal && (
            <AddUserModal
              onClose={() => setShowUserModal(false)}
              onSave={async (data: any) => {
                try {
                  await createUser(data)
                  toast.success('تمت إضافة المستخدم بنجاح')
                  setShowUserModal(false)
                  load()
                } catch (e: any) {
                  toast.error(typeof e === 'string' ? e : 'فشل الحفظ')
                }
              }}
            />
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 3. THEMES & COLOR PALETTES & FONT SIZE */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {tab === 'themes' && (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="font-bold text-lg">اختر الثيم والمظهر وحجم الخط المفضل لك</h3>
            <p className="text-xs text-[var(--clr-muted)]">
              يحتوي النظام على 8 ثيمات جرافيكية فائقة الوضوح + إمكانية تكبير وتصغير حجم الخط بما يناسب شاشتك
            </p>
          </div>

          {/* Font Size & Scale Control Card */}
          <div className="glass-card p-5 border border-[var(--clr-primary)]/30 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--clr-primary)]/20 text-[var(--clr-primary)] flex items-center justify-center font-bold">
                  <Type size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--clr-text)]">التحكم في حجم خط الشاشة والنصوص (Font Size / Scale)</h4>
                  <p className="text-[11px] text-[var(--clr-muted)]">اختر الحجم الأنسب لعينيك ورؤية شاشتك. يتم حفظ الخيار تلقائياً</p>
                </div>
              </div>
              <div className="text-xs font-mono font-bold text-amber-400">
                الحالي: {Math.round(scale * 100)}%
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'خط صغير (85%)', value: 0.85, desc: 'عرض كمية معلومات أكثر' },
                { label: 'خط قياسي (95%)', value: 0.95, desc: 'الحجم الافتراضي المتوازن' },
                { label: 'خط كبير (110%)', value: 1.10, desc: 'قراءة مريحة وواضحة' },
                { label: 'خط ضخم (125%)', value: 1.25, desc: 'أقصى درجات الوضوح والتباين' },
              ].map(opt => {
                const isSelected = Math.abs(scale - opt.value) < 0.04
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (setScale) setScale(opt.value)
                      toast.success(`تم تغيير حجم الخط إلى: ${opt.label}`)
                    }}
                    className={`p-3 rounded-xl border text-right transition-all duration-200 cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'border-[var(--clr-primary)] bg-[var(--clr-primary)]/15 shadow-lg ring-2 ring-[var(--clr-primary)]/40'
                        : 'hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span className={isSelected ? 'text-[var(--clr-primary)]' : 'text-white'}>{opt.label}</span>
                      {isSelected && <Check size={14} className="text-[var(--clr-primary)]" />}
                    </div>
                    <div className="text-[10px] text-[var(--clr-muted)]">{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 1: Day Themes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-400 border-b pb-2" style={{ borderColor: 'var(--clr-border)' }}>
              <span>☀️ الثيمات النهارية (4 ثيمات فائقة الوضوح والتباين):</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {THEMES.filter(t => !t.isDark).map((th) => {
                const isSelected = currentTheme === th.id

                return (
                  <div
                    key={th.id}
                    onClick={() => {
                      setTheme(th.id)
                      toast.success(`تم تفعيل: ${th.nameAr}`)
                    }}
                    className={`glass-card p-4 rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between relative overflow-hidden hover:scale-[1.02] ${
                      isSelected
                        ? 'border-[var(--clr-primary)] ring-2 ring-[var(--clr-primary)]/40 shadow-xl bg-[var(--clr-primary)]/10'
                        : 'hover:border-white/20'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 left-2">
                        <span className="badge badge-primary text-[10px] py-0.5 px-2 font-bold flex items-center gap-1 shadow-md">
                          <Check size={11} /> مُفعّل
                        </span>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div
                          className="w-8 h-8 rounded-lg border border-black/10 shadow-sm flex items-center justify-center shrink-0"
                          style={{ background: th.primaryColor }}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: th.accentColor }}
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-[var(--clr-text)]">{th.nameAr}</h4>
                          <span className="text-[10px] text-[var(--clr-muted)] font-mono">{th.nameEn}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[var(--clr-muted)] mb-3 leading-relaxed">
                        {th.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={`w-full py-1.5 text-xs font-bold rounded-lg transition-all ${
                        isSelected ? 'btn-primary shadow-md' : 'btn-secondary'
                      }`}
                    >
                      {isSelected ? '✓ مُفعّل حالياً' : 'تطبيق الثيم'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 2: Night Themes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-bold text-sky-300 border-b pb-2" style={{ borderColor: 'var(--clr-border)' }}>
              <span>🌙 الثيمات الليلية (4 ثيمات داكنة ومريحة للعين):</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {THEMES.filter(t => t.isDark).map((th) => {
                const isSelected = currentTheme === th.id

                return (
                  <div
                    key={th.id}
                    onClick={() => {
                      setTheme(th.id)
                      toast.success(`تم تفعيل: ${th.nameAr}`)
                    }}
                    className={`glass-card p-4 rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between relative overflow-hidden hover:scale-[1.02] ${
                      isSelected
                        ? 'border-[var(--clr-primary)] ring-2 ring-[var(--clr-primary)]/40 shadow-xl bg-[var(--clr-primary)]/10'
                        : 'hover:border-white/20'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 left-2">
                        <span className="badge badge-primary text-[10px] py-0.5 px-2 font-bold flex items-center gap-1 shadow-md">
                          <Check size={11} /> مُفعّل
                        </span>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div
                          className="w-8 h-8 rounded-lg border border-white/20 shadow-sm flex items-center justify-center shrink-0"
                          style={{ background: th.primaryColor }}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: th.accentColor }}
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-[var(--clr-text)]">{th.nameAr}</h4>
                          <span className="text-[10px] text-[var(--clr-muted)] font-mono">{th.nameEn}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[var(--clr-muted)] mb-3 leading-relaxed">
                        {th.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={`w-full py-1.5 text-xs font-bold rounded-lg transition-all ${
                        isSelected ? 'btn-primary shadow-md' : 'btn-secondary'
                      }`}
                    >
                      {isSelected ? '✓ مُفعّل حالياً' : 'تطبيق الثيم'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddUserModal({ onClose, onSave }: any) {
  const [form, setForm] = useState({ username: '', display_name: '', password: '', role: 'staff', phone: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content max-w-md">
        <h3 className="text-xl font-bold mb-6">إضافة مستخدم جديد</h3>
        <div className="flex flex-col gap-4">
          <div><label className="label text-xs font-bold">اسم المستخدم *</label><input className="input text-sm font-bold" dir="ltr" value={form.username} onChange={e => set('username', e.target.value)} required /></div>
          <div><label className="label text-xs font-bold">الاسم الكامل *</label><input className="input text-sm font-bold" value={form.display_name} onChange={e => set('display_name', e.target.value)} required /></div>
          <div><label className="label text-xs font-bold">رقم الهاتف (لإرسال كود الواتساب OTP)</label><input className="input text-xs font-mono text-left" dir="ltr" placeholder="010XXXXXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="label text-xs font-bold">كلمة المرور *</label><input type="password" className="input text-sm font-bold" value={form.password} onChange={e => set('password', e.target.value)} required /></div>
          <div>
            <label className="label text-xs font-bold">الدور الوظيفي</label>
            <select className="input text-xs font-bold" value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="staff">موظف (محدد الصلاحيات)</option>
              <option value="admin">مدير المبيعات المسؤول (Super Admin - كامل الصلاحيات)</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1 py-2.5 font-bold cursor-pointer" onClick={() => onSave(form)}>حفظ المستخدم</button>
          <button className="btn-secondary py-2.5 font-bold cursor-pointer" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}
