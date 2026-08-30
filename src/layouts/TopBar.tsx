import { useState, useEffect, useRef } from 'react'
import { Menu, LogOut, User, Bell, AlertTriangle, Palette, Check, Sparkles, Sun, Moon, FileSpreadsheet, Eye, Search, Filter, CheckCheck, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useThemeStore, THEMES } from '../store/themeStore'
import { useSettingsStore } from '../store/settingsStore'
import {
  logout as logoutCmd,
  getAccountAlerts,
  getSystemNotifications,
  markAllNotificationsAsRead,
  createBroadcastNotification,
  getBroadcastNotifications,
  deleteBroadcastNotification,
  SystemNotification,
  BroadcastNotification,
} from '../lib/commands'
import { exportNotificationsExcel } from '../lib/excel'
import toast from 'react-hot-toast'
import { formatDate, formatTime, formatDateTime, formatEGP } from '../lib/utils'

interface TopBarProps {
  scale: number
  setScale: React.Dispatch<React.SetStateAction<number>>
  onMenuToggle: () => void
}

export default function TopBar({ scale, setScale, onMenuToggle }: TopBarProps) {
  const { user, sessionId, logout } = useAuthStore()
  const { currentTheme, setTheme, toggleDayNight } = useThemeStore()
  const { storeLogo, storeName, loadSettings } = useSettingsStore()
  const [time, setTime] = useState(new Date())
  const [alerts, setAlerts] = useState<any[]>([])
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [broadcastNotifs, setBroadcastNotifs] = useState<BroadcastNotification[]>([])
  const [showNotifsModal, setShowNotifsModal] = useState(false)
  const [showCreateBroadcastModal, setShowCreateBroadcastModal] = useState(false)
  const [selectedNotifDetails, setSelectedNotifDetails] = useState<SystemNotification | null>(null)
  const [notifSearch, setNotifSearch] = useState('')
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'high' | 'medium'>('all')
  const themeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSettings().catch(console.error)
  }, [])

  const fetchNotifications = async () => {
    try {
      const [list, broadcasts] = await Promise.all([
        getSystemNotifications(50, false),
        getBroadcastNotifications(true),
      ])
      setNotifications(list || [])
      setBroadcastNotifs(broadcasts || [])
    } catch (e) {
      console.error(e)
    }
  }

  const handleMarkAllNotifsRead = async () => {
    try {
      await markAllNotificationsAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast.success('تم تحديد كافة الإشعارات كمقروءة')
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const checkAlerts = async () => {
    try {
      const data = await getAccountAlerts()
      const list = data || []
      setAlerts(list)
      // Trigger instant toast notification if critical alerts detected
      if (list.length > 0) {
        list.forEach(al => {
          if (al.alert_type === 'below_min' || al.alert_type === 'above_max') {
            toast.error(al.message, { id: `acc_alert_${al.account_id}`, duration: 5000 })
          }
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    checkAlerts()
    fetchNotifications()
    const interval = setInterval(() => {
      setTime(new Date())
      checkAlerts()
      fetchNotifications()
    }, 10000)
    return () => clearInterval(interval)
  }, [user])

  const unreadNotifsCount = notifications.filter(n => !n.is_read).length

  const adjustZoom = (delta: number) => {
    let nextScale = 0.9
    if (delta !== 0) {
      nextScale = Math.min(1.3, Math.max(0.7, scale + delta))
    }
    setScale(nextScale)
    window.dispatchEvent(new Event('resize'))
  }

  const handleLogout = async () => {
    try {
      if (sessionId) await logoutCmd(sessionId)
      logout()
    } catch {
      logout()
    }
    toast.success('تم تسجيل الخروج')
  }

  const hours = time.getHours()
  const minutes = String(time.getMinutes()).padStart(2, '0')
  const period = hours >= 12 ? 'م' : 'ص'
  const hours12 = String(hours % 12 || 12).padStart(2, '0')
  const timeStr = `${hours12}:${minutes} ${period}`
  const dateStr = formatDate(time.toISOString())

  const activeThemeObj = THEMES.find(t => t.id === currentTheme) || THEMES[0]

  return (
    <header
      className="flex items-center justify-between px-6 flex-shrink-0 relative"
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--clr-border)',
        zIndex: 30,
      }}
    >
      {/* Left: toggle & zoom & Company Brand Badge */}
      <div className="flex items-center gap-3">
        <button className="btn-icon" onClick={onMenuToggle} id="sidebar-toggle">
          <Menu size={18} />
        </button>

        {/* Company Logo & Store Name Badge */}
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-[var(--clr-surface-2)] border border-[var(--clr-border)] shadow-md">
          {storeLogo ? (
            <img
              src={storeLogo}
              alt="Logo"
              className="w-9 h-9 object-contain rounded-xl shadow-sm"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm"
              style={{ background: 'linear-gradient(135deg, var(--clr-primary), var(--clr-accent))' }}
            >
              {(storeName || 'X')[0]}
            </div>
          )}
          <div className="flex flex-col justify-center hidden sm:flex">
            <span className="font-black text-sm text-[var(--clr-text)] truncate max-w-[220px] leading-tight">
              {storeName || 'XPhone'}
            </span>
            <span className="text-[10px] font-bold text-amber-400">إدارة المتجر</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[rgba(255,255,255,0.02)] p-1 rounded-xl border border-[var(--clr-border)]" style={{ direction: 'ltr' }}>
          <button className="btn-icon p-0 text-xs font-bold" style={{ width: 26, height: 26 }} onClick={() => adjustZoom(-0.05)} title="تصغير (Ctrl + -)">−</button>
          <button className="btn-icon p-0 text-[10px] font-bold" style={{ width: 36, height: 26 }} onClick={() => adjustZoom(0)} title="الافتراضي (Ctrl + 0)">{Math.round(scale * 100)}%</button>
          <button className="btn-icon p-0 text-xs font-bold" style={{ width: 26, height: 26 }} onClick={() => adjustZoom(0.05)} title="تكبير (Ctrl + +)">+</button>
        </div>
      </div>

      {/* Center: date & time & Account Alerts Banner */}
      <div className="flex items-center gap-4">
        {alerts.length > 0 && (
          <button
            onClick={() => setShowAlertModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold animate-bounce cursor-pointer shadow-lg transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(245, 158, 11, 0.25))',
              border: '1.5px solid #ef4444',
              color: '#f87171',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
            }}
            title="انقر لاستعراض تفاصيل تنبيهات حدود السيولة النقدية للحسابات"
          >
            <AlertTriangle size={16} className="text-amber-400 animate-pulse" />
            <span>⚠️ تنبيه حرِج: {alerts.length} حساب اقترب/تجاوز حد السيولة!</span>
          </button>
        )}
        <div className="text-center">
          <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--clr-text)' }}>
            {timeStr}
          </div>
          <div className="text-xs" style={{ color: 'var(--clr-muted)' }}>{dateStr}</div>
        </div>
      </div>

      {/* Right: Day/Night Toggle + Theme picker & user info */}
      <div className="flex items-center gap-2.5">
        {/* Quick Day / Night Toggle */}
        <button
          type="button"
          onClick={() => {
            const isCurrentlyLight = currentTheme === 'light_crystal'
            toggleDayNight()
            toast.success(!isCurrentlyLight ? 'تم تفعيل الوضع النهاري ☀️' : 'تم تفعيل الوضع الليلي 🌙')
          }}
          className="btn-icon p-2 rounded-xl cursor-pointer hover:scale-105 transition-transform flex items-center gap-1.5"
          title={currentTheme === 'light_crystal' ? 'التبديل إلى الوضع الليلي 🌙' : 'التبديل إلى الوضع النهاري ☀️'}
          style={{
            background: 'var(--clr-surface-2)',
            borderColor: 'var(--clr-border)',
            color: currentTheme === 'light_crystal' ? '#f59e0b' : '#38bdf8',
          }}
        >
          {currentTheme === 'light_crystal' ? (
            <>
              <Sun size={16} className="text-amber-400" />
              <span className="text-xs font-bold hidden md:inline text-amber-500">نهاري</span>
            </>
          ) : (
            <>
              <Moon size={16} className="text-sky-300" />
              <span className="text-xs font-bold hidden md:inline text-sky-300">ليلي</span>
            </>
          )}
        </button>

        {/* Theme Picker Dropdown */}
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm"
            style={{
              background: 'var(--clr-surface-2)',
              borderColor: 'var(--clr-border)',
              color: 'var(--clr-text)',
            }}
            title="تغيير ثيم ومظهر البرنامج"
          >
            <div
              className="w-3.5 h-3.5 rounded-full shadow-sm"
              style={{ background: activeThemeObj.primaryColor }}
            />
            <Palette size={15} style={{ color: 'var(--clr-primary)' }} />
            <span className="text-xs font-bold hidden sm:inline">{activeThemeObj.nameAr}</span>
          </button>

          {showThemeMenu && (
            <div
              className="absolute left-0 mt-2 w-64 glass-card p-2 rounded-2xl shadow-2xl z-50 border animate-slide-up"
              style={{
                borderColor: 'var(--clr-border-2)',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(30px)',
              }}
            >
              <div className="text-xs font-bold px-3 py-2 border-b flex items-center gap-1.5" style={{ borderColor: 'var(--clr-border)', color: 'var(--clr-muted)' }}>
                <Sparkles size={13} className="text-[var(--clr-primary)]" />
                اختر ثيم ومظهر البرنامج:
              </div>

              <div className="flex flex-col gap-1 mt-1 max-h-72 overflow-y-auto p-1">
                {THEMES.map((th) => {
                  const isSelected = currentTheme === th.id
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        setTheme(th.id)
                        setShowThemeMenu(false)
                        toast.success(`تم تفعيل: ${th.nameAr}`)
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-right cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--clr-primary)]/15 text-[var(--clr-primary)] border border-[var(--clr-primary)]/40 shadow-sm'
                          : 'hover:bg-white/[0.05] text-[var(--clr-text)] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded-full border border-white/20 shadow-inner flex items-center justify-center shrink-0"
                          style={{ background: th.primaryColor }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: th.accentColor }}
                          />
                        </div>
                        <div>
                          <div>{th.nameAr}</div>
                          <div className="text-[10px] font-normal text-[var(--clr-muted)]">{th.nameEn}</div>
                        </div>
                      </div>
                      {isSelected && <Check size={14} className="text-[var(--clr-primary)]" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* System Activity Notifications Bell (For ALL Users) */}
        {user && (
          <div>
            <button
              type="button"
              onClick={() => setShowNotifsModal(true)}
              className="btn-icon p-2 rounded-xl cursor-pointer hover:scale-105 transition-transform relative flex items-center justify-center"
              style={{
                background: 'var(--clr-surface-2)',
                borderColor: 'var(--clr-border)',
                color: unreadNotifsCount > 0 ? '#f59e0b' : 'var(--clr-text)',
              }}
              title="إشعارات وسجل التنبيهات والعمليات"
            >
              <Bell size={17} />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-md">
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* User Info */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: 'var(--clr-surface-2)', border: '1px solid var(--clr-border)' }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 28, height: 28, background: 'var(--clr-primary-dim)' }}
          >
            <User size={14} style={{ color: 'var(--clr-primary)' }} />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none" style={{ color: 'var(--clr-text)' }}>
              {user?.display_name}
            </div>
            <div className="text-xs" style={{ color: 'var(--clr-muted)' }}>
              {user?.role === 'admin' ? 'مدير المبيعات' : 'موظف'}
            </div>
          </div>
        </div>
        <button className="btn-icon cursor-pointer" onClick={handleLogout} title="تسجيل الخروج" id="logout-btn">
          <LogOut size={16} style={{ color: 'var(--clr-danger)' }} />
        </button>
      </div>

      {/* Account Alerts Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2" style={{ color: 'var(--clr-danger)' }}>
                <AlertTriangle size={20} />
                <h3 className="font-bold text-lg">تنبيهات حدود الحسابات المالية</h3>
              </div>
              <button className="btn-icon text-sm font-bold" onClick={() => setShowAlertModal(false)}>✕</button>
            </div>

            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {alerts.map((al, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border flex flex-col gap-1"
                  style={{
                    background: 'rgba(255,92,124,0.08)',
                    borderColor: 'rgba(255,92,124,0.3)'
                  }}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{al.account_name}</span>
                    <span style={{ color: 'var(--clr-danger)' }}>{formatEGP(al.balance)}</span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--clr-muted)' }}>
                    {al.message}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button className="btn-secondary" onClick={() => setShowAlertModal(false)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Sub-Window Modal for Notifications (نافذة فرعية مركزية للإشعارات) */}
      {showNotifsModal && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-3xl w-full max-h-[85vh] flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[var(--clr-text)] flex items-center gap-2">
                    <span>مركز التنبيهات وإشعارات النظام الحساسة</span>
                    {unreadNotifsCount > 0 && (
                      <span className="badge badge-warning text-xs font-mono">{unreadNotifsCount} جديد</span>
                    )}
                  </h3>
                  <p className="text-xs text-[var(--clr-muted)] mt-0.5">
                    سجل كامل لكافة التنبيهات، حدود الحسابات، ومرتجعات ومشتريات ومسحوبات النظام
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setShowCreateBroadcastModal(true)}
                    className="btn-primary text-xs font-bold py-1.5 px-3 flex items-center gap-1.5 shadow-md cursor-pointer"
                    title="إضافة وبث تنبيه جديد مخصص لكافة المستخدمين مع إطار زمني وأسكريبت"
                  >
                    <Sparkles size={15} />
                    📢 بث تنبيه جديد للمستخدمين
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    const t = toast.loading('جاري تصدير سجل التنبيهات لـ Excel...')
                    try {
                      await exportNotificationsExcel(notifications)
                      toast.success('تم تصدير سجل التنبيهات لـ Excel بنجاح!', { id: t })
                    } catch (e: any) {
                      toast.error('فشل التصدير: ' + e.toString(), { id: t })
                    }
                  }}
                  className="btn-secondary text-xs font-bold py-1.5 px-3 flex items-center gap-1.5 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                  title="تصدير جميع التنبيهات والإشعارات المسجلة لملف Excel"
                >
                  <FileSpreadsheet size={15} />
                  تصدير سجل التنبيهات Excel
                </button>

                {unreadNotifsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotifsRead}
                    className="btn-secondary text-xs font-bold py-1.5 px-3 flex items-center gap-1.5 text-blue-400 border-blue-500/40 hover:bg-blue-500/10"
                  >
                    <CheckCheck size={15} />
                    تحديد الكل كمقروء
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNotifsModal(false)}
                  className="btn-icon p-1.5 text-[var(--clr-muted)] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-black/20 p-2.5 rounded-xl border" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--clr-muted)]" />
                <input
                  type="text"
                  className="input w-full pr-9 py-1.5 text-xs"
                  placeholder="بحث في سجل التنبيهات بالإسم أو البيان..."
                  value={notifSearch}
                  onChange={e => setNotifSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${notifFilter === 'all' ? 'bg-amber-500 text-white' : 'bg-white/5 text-[var(--clr-muted)] hover:text-white'}`}
                  onClick={() => setNotifFilter('all')}
                >
                  الكل ({notifications.length})
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${notifFilter === 'unread' ? 'bg-amber-500 text-white' : 'bg-white/5 text-[var(--clr-muted)] hover:text-white'}`}
                  onClick={() => setNotifFilter('unread')}
                >
                  غير مقروء ({unreadNotifsCount})
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${notifFilter === 'high' ? 'bg-red-500 text-white' : 'bg-white/5 text-[var(--clr-muted)] hover:text-white'}`}
                  onClick={() => setNotifFilter('high')}
                >
                  🔴 مشدد / خطورة عالية
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 max-h-[52vh]">
              {notifications
                .filter(n => {
                  if (notifFilter === 'unread' && n.is_read) return false
                  if (notifFilter === 'high' && !n.action_type?.includes('limit') && !n.action_type?.includes('damaged')) return false
                  if (notifSearch.trim()) {
                    const q = notifSearch.toLowerCase()
                    return n.title?.toLowerCase().includes(q) || n.details?.toLowerCase().includes(q) || n.user_name?.toLowerCase().includes(q)
                  }
                  return true
                })
                .map((notif) => {
                  let Icon = Bell
                  let iconColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  if (notif.action_type === 'sales_return') {
                    Icon = Sparkles
                    iconColor = 'text-red-400 bg-red-500/10 border-red-500/20'
                  } else if (notif.action_type === 'purchases_create') {
                    Icon = Bell
                    iconColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  } else if (notif.action_type === 'inventory_damaged' || notif.action_type?.includes('debit_limit')) {
                    Icon = AlertTriangle
                    iconColor = 'text-red-400 bg-red-500/10 border-red-500/20'
                  } else if (notif.action_type === 'equity_edit') {
                    Icon = User
                    iconColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                  }

                  return (
                    <div
                      key={notif.id}
                      onClick={() => setSelectedNotifDetails(notif)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 hover:scale-[1.005] ${
                        !notif.is_read
                          ? 'bg-[var(--clr-surface-2)] border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                          : 'bg-[var(--clr-surface-3)] border-[var(--clr-border)] opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-bold text-sm text-[var(--clr-text)] leading-snug break-words">
                            {notif.title}
                          </span>
                          <span className="text-xs text-[var(--clr-muted)] whitespace-nowrap shrink-0 font-mono">
                            {formatDateTime(notif.created_at)}
                          </span>
                        </div>
                        {notif.details && (
                          <p className="text-xs text-[var(--clr-text-2)] leading-relaxed break-words bg-black/20 p-2.5 rounded-xl border border-white/5 my-1.5">
                            {notif.details}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs mt-1 font-semibold">
                          <span className="text-[var(--clr-primary)]">القائم بالعملية: {notif.user_name}</span>
                          <span className="text-amber-400 hover:underline flex items-center gap-1">
                            <Eye size={13} /> اضغط لفتح التفاصيل الكاملة
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

              {notifications.length === 0 && (
                <div className="text-center py-12 text-xs text-[var(--clr-muted)] font-bold">
                  لا توجد إشعارات مسجلة بالنظام حتى الآن
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary text-xs font-bold" onClick={() => setShowNotifsModal(false)}>
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Details Item Sub-Modal (نافذة تفاصيل التنبيه المختار) */}
      {selectedNotifDetails && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-lg w-full flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Bell size={20} />
                <span>تفاصيل التنبيه الإشعاري</span>
              </div>
              <button type="button" className="btn-icon p-1 text-[var(--clr-muted)] hover:text-white" onClick={() => setSelectedNotifDetails(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-xl border bg-black/30 flex flex-col gap-3" style={{ borderColor: 'var(--clr-border)' }}>
              <h4 className="font-bold text-base text-[var(--clr-text)] border-b pb-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {selectedNotifDetails.title}
              </h4>

              {selectedNotifDetails.details && (
                <div>
                  <span className="text-xs text-[var(--clr-muted)] block font-bold mb-1">بيان التفاصيل الكاملة:</span>
                  <p className="text-xs leading-relaxed text-[var(--clr-text-2)] bg-black/40 p-3 rounded-xl border border-white/5 font-mono">
                    {selectedNotifDetails.details}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                <div>
                  <span className="text-[var(--clr-muted)] block font-bold">القائم بالعملية:</span>
                  <span className="font-bold text-[var(--clr-primary)]">{selectedNotifDetails.user_name}</span>
                </div>
                <div>
                  <span className="text-[var(--clr-muted)] block font-bold">التاريخ والوقت:</span>
                  <span className="font-mono">{formatDateTime(selectedNotifDetails.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--clr-border)' }}>
              <button type="button" className="btn-secondary text-xs font-bold" onClick={() => setSelectedNotifDetails(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Broadcast Notification Modal (نافذة إضافة وبث تنبيه مخصص للمستخدمين مع إطار زمني وأسكريبت) */}
      {showCreateBroadcastModal && (
        <CreateBroadcastModal
          onClose={() => setShowCreateBroadcastModal(false)}
          onCreated={() => {
            fetchNotifications()
          }}
        />
      )}
    </header>
  )
}

function CreateBroadcastModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuthStore()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [targetRole, setTargetRole] = useState<'all' | 'staff'>('all')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [scriptPayload, setScriptPayload] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      toast.error('يرجى كتابة عنوان التنبيه ونص الرسالة')
      return
    }

    setSaving(true)
    try {
      await createBroadcastNotification({
        sender_user_id: user?.id,
        sender_name: user?.display_name || 'المستخدم الرئيسي',
        target_role: targetRole,
        title: title.trim(),
        message: message.trim(),
        severity,
        start_time: startTime || null,
        end_time: endTime || null,
        script_payload: scriptPayload.trim() || null,
      })
      toast.success('تم إضافة وبث التنبيه لكافة المستخدمين بنجاح!')
      onCreated()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('فشل إرسال التنبيه: ' + err.toString())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6 max-w-lg w-full flex flex-col gap-4 animate-scale-up">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
            <Sparkles size={20} />
            <span>📢 إضافة وبث تنبيه جديد لكافة المستخدمين</span>
          </div>
          <button type="button" className="btn-icon p-1 text-[var(--clr-muted)] hover:text-white" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label text-xs font-bold mb-1">عنوان التنبيه *</label>
            <input
              type="text"
              className="input w-full text-xs font-bold"
              placeholder="مثال: تنبيه هام بشأن تعليمات الجرد الدوري أو المواعيد"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label text-xs font-bold mb-1">رسالة التنبيه والتفاصيل *</label>
            <textarea
              className="input w-full text-xs min-h-[90px] leading-relaxed"
              placeholder="اكتب نص الرسالة والتوجيهات التي تظهر لكافة الموظفين والمستخدمين..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold mb-1">مستوى الخطورة والأولوية</label>
              <select
                className="input w-full text-xs font-bold"
                value={severity}
                onChange={e => setSeverity(e.target.value as any)}
              >
                <option value="low">🟢 عادي (إشعار خفيف)</option>
                <option value="medium">🟡 متوسط (تحذير هام)</option>
                <option value="high">🔴 مشدد (أولوية قصوى واهتمام عالي)</option>
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">المستخدمون المستهدفون</label>
              <select
                className="input w-full text-xs font-bold"
                value={targetRole}
                onChange={e => setTargetRole(e.target.value as any)}
              >
                <option value="all">📢 كافة المستخدمين والموظفين</option>
                <option value="staff">👤 الموظفون وطاقم العمل فقط</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-black/20 flex flex-col gap-3" style={{ borderColor: 'var(--clr-border)' }}>
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <span>📅 الإطار الزمني لتفعيل التنبيه (اختياري)</span>
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-[11px] font-bold mb-1">تاريخ ووقت البداية</label>
                <input
                  type="datetime-local"
                  className="input w-full text-xs font-mono"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-[11px] font-bold mb-1">تاريخ ووقت انتهاء الصلاحية</label>
                <input
                  type="datetime-local"
                  className="input w-full text-xs font-mono"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label text-xs font-bold mb-1 flex items-center gap-1.5 text-blue-300">
              <span>💻 نص الأسكريبت أو التعليمات الإدارية البرمجية (اختياري)</span>
            </label>
            <input
              type="text"
              className="input w-full text-xs font-mono text-left dir-ltr"
              dir="ltr"
              placeholder="مثال: auto_audit_check, custom_action_code, payment_due_script..."
              value={scriptPayload}
              onChange={e => setScriptPayload(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--clr-border)' }}>
            <button type="button" className="btn-secondary text-xs font-bold" onClick={onClose}>
              إلغاء
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-xs font-bold px-6 shadow-lg">
              {saving ? 'جاري البث...' : '🚀 إرسال وبث التنبيه الآن'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
