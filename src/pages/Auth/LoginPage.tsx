import { useState } from 'react'
import { Smartphone, Eye, EyeOff, Loader2, KeyRound, MessageSquare } from 'lucide-react'
import { login as loginCmd } from '../../lib/commands'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import ResetPasswordOtpModal from '../../components/ResetPasswordOtpModal'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showOtpModal, setShowOtpModal] = useState(false)

  const { login } = useAuthStore()
  const { storeLogo, storeName } = useSettingsStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { toast.error('أدخل اسم المستخدم وكلمة المرور'); return }
    setLoading(true)
    try {
      const result = await loginCmd(username, password)
      login(result.user, result.session_id)
      toast.success(`مرحباً، ${result.user.display_name}!`)
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'اسم المستخدم أو كلمة المرور غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--clr-bg)' }}
    >
      {/* Animated background orbs */}
      <div
        className="absolute rounded-full pointer-events-none animate-pulse-glow"
        style={{
          width: 500, height: 500, top: -100, right: -100,
          background: 'radial-gradient(circle, rgba(124,107,255,0.12) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 400, height: 400, bottom: -80, left: -80,
          background: 'radial-gradient(circle, rgba(0,212,170,0.10) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-md mx-4 animate-slide-up" style={{ zIndex: 1 }}>
        {/* Card */}
        <div className="glass-card p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center rounded-3xl mb-4 overflow-hidden"
              style={{
                width: 96, height: 96,
                background: storeLogo ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, var(--clr-primary), var(--clr-accent))',
                boxShadow: '0 8px 36px var(--clr-primary-glow)',
                border: storeLogo ? '2px solid var(--clr-border)' : 'none',
              }}
            >
              {storeLogo ? (
                <img src={storeLogo} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <Smartphone size={46} color="white" />
              )}
            </div>
            <h1 className="text-3xl font-black tracking-wide" style={{ color: 'var(--clr-text)' }}>
              {storeName || 'XPhone'}
            </h1>
            <p className="text-sm mt-1.5 font-bold text-amber-400">نظام إدارة المبيعات والمخزون والمحاسبة والخدمات المالية</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="label text-xs font-bold">اسم المستخدم</label>
              <input
                id="username-input"
                className="input text-sm font-bold"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label text-xs font-bold mb-0">كلمة المرور</label>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(true)}
                  className="text-[11px] text-[var(--clr-primary)] hover:underline font-bold cursor-pointer"
                >
                  استعادة عبر WhatsApp OTP؟
                </button>
              </div>
              <div className="relative">
                <input
                  id="password-input"
                  className="input text-sm font-bold"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingLeft: 44 }}
                />
                <button
                  type="button"
                  className="absolute top-1/2 left-3 -translate-y-1/2 btn-icon border-0 p-1 cursor-pointer"
                  style={{ background: 'none' }}
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff size={16} style={{ color: 'var(--clr-muted)' }} />
                    : <Eye size={16} style={{ color: 'var(--clr-muted)' }} />
                  }
                </button>
              </div>
            </div>

            <button
              id="login-btn"
              type="submit"
              className="btn-primary w-full py-3 text-base font-bold mt-2 shadow-xl cursor-pointer"
              disabled={loading}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          {/* Quick WhatsApp Reset Button */}
          <div className="mt-5 pt-4 border-t text-center flex flex-col gap-2" style={{ borderColor: 'var(--clr-border)' }}>
            <button
              type="button"
              onClick={() => setShowOtpModal(true)}
              className="btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-2 font-bold cursor-pointer text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <MessageSquare size={14} />
              استعادة / تغيير كلمة السر بكود الواتساب
            </button>
          </div>
        </div>
      </div>

      {/* OTP Reset Password Modal */}
      {showOtpModal && (
        <ResetPasswordOtpModal
          onClose={() => setShowOtpModal(false)}
          onSuccess={(newUsername) => {
            setUsername(newUsername)
            setPassword('')
            setShowOtpModal(false)
          }}
        />
      )}
    </div>
  )
}

