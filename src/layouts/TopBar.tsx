import { useState, useEffect, useRef } from 'react'
import { Menu, LogOut, User, Bell, AlertTriangle, Palette, Check, Sparkles, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useThemeStore, THEMES } from '../store/themeStore'
import { useSettingsStore } from '../store/settingsStore'
import {
  logout as logoutCmd,
  getAccountAlerts,
  getSystemNotifications,
  markAllNotificationsAsRead,
  SystemNotification,
} from '../lib/commands'
import toast from 'react-hot-toast'
import { formatDate, formatTime, formatEGP } from '../lib/utils'

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
  const [showNotifsMenu, setShowNotifsMenu] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const notifsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSettings().catch(console.error)
  }, [])

  const fetchNotifications = async () => {
    if (user?.role !== 'admin') return
    try {
      const list = await getSystemNotifications(40, false)
      setNotifications(list || [])
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
      if (notifsMenuRef.current && !notifsMenuRef.current.contains(event.target as Node)) {
        setShowNotifsMenu(false)
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

        {/* System Activity Notifications Bell (For Super Admin) */}
        {user?.role === 'admin' && (
          <div className="relative" ref={notifsMenuRef}>
            <button
              type="button"
              onClick={() => setShowNotifsMenu(!showNotifsMenu)}
              className="btn-icon p-2 rounded-xl cursor-pointer hover:scale-105 transition-transform relative flex items-center justify-center"
              style={{
                background: 'var(--clr-surface-2)',
                borderColor: 'var(--clr-border)',
                color: unreadNotifsCount > 0 ? '#f59e0b' : 'var(--clr-text)',
              }}
              title="إشعارات العمليات الحساسة"
            >
              <Bell size={17} />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-md">
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </span>
              )}
            </button>

            {showNotifsMenu && (
              <div
                className="absolute left-0 mt-2 w-80 md:w-96 glass-card p-3 rounded-2xl shadow-2xl z-50 border animate-slide-up"
                style={{
                  borderColor: 'var(--clr-border-2)',
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(30px)',
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b mb-2" style={{ borderColor: 'var(--clr-border)' }}>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--clr-text)]">
                    <Bell size={14} className="text-amber-400" />
                    <span>إشعارات العمليات الحساسة</span>
                    {unreadNotifsCount > 0 && (
                      <span className="badge badge-warning text-[10px] font-mono py-0 px-1.5">{unreadNotifsCount} جديد</span>
                    )}
                  </div>
                  {unreadNotifsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotifsRead}
                      className="text-[11px] text-[var(--clr-primary)] hover:underline font-bold cursor-pointer"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto p-0.5">
                  {notifications.map((notif) => {
                    let Icon = Bell
                    let iconColor = 'text-amber-400 bg-amber-500/10'
                    if (notif.action_type === 'sales_return') {
                      Icon = Sparkles
                      iconColor = 'text-red-400 bg-red-500/10'
                    } else if (notif.action_type === 'purchases_create') {
                      Icon = Bell
                      iconColor = 'text-emerald-400 bg-emerald-500/10'
                    } else if (notif.action_type === 'inventory_damaged') {
                      Icon = AlertTriangle
                      iconColor = 'text-red-400 bg-red-500/10'
                    } else if (notif.action_type === 'equity_edit') {
                      Icon = User
                      iconColor = 'text-purple-400 bg-purple-500/10'
                    }

                    return (
                      <div
                        key={notif.id}
                        className={`p-2.5 rounded-xl border transition-colors flex items-start gap-2.5 ${
                          !notif.is_read
                            ? 'bg-[var(--clr-surface-2)] border-amber-500/40 shadow-sm'
                            : 'bg-[var(--clr-surface-3)] border-[var(--clr-border)] opacity-80'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconColor}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-[var(--clr-text)] line-clamp-1">
                              {notif.title}
                            </span>
                            <span className="text-[10px] text-[var(--clr-muted)] whitespace-nowrap">
                              {formatTime(notif.created_at)}
                            </span>
                          </div>
                          {notif.details && (
                            <p className="text-[11px] text-[var(--clr-muted)] mt-0.5 leading-snug">
                              {notif.details}
                            </p>
                          )}
                          <div className="text-[10px] text-[var(--clr-primary)] font-bold mt-1">
                            القائم بالعملية: {notif.user_name}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {notifications.length === 0 && (
                    <div className="text-center py-8 text-xs text-[var(--clr-muted)]">
                      لا توجد إشعارات أو عمليات حساسة حالياً
                    </div>
                  )}
                </div>
              </div>
            )}
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
    </header>
  )
}
