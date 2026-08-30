import { useState } from 'react'
import { requestWhatsappOtp, verifyOtpAndResetPassword } from '../lib/commands'
import { X, KeyRound, MessageSquare, Send, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface ResetPasswordOtpModalProps {
  onClose: () => void
  onSuccess: (username: string) => void
}

export default function ResetPasswordOtpModal({ onClose, onSuccess }: ResetPasswordOtpModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [username, setUsername] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phoneInfo, setPhoneInfo] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      toast.error('يرجى إدخال اسم المستخدم')
      return
    }

    setLoading(true)
    try {
      const res = await requestWhatsappOtp(username.trim())
      setPhoneInfo(res.phone)
      setWhatsappUrl(res.whatsapp_url)
      setStep(2)
      toast.success('تم توليد كود التحقق بنجاح! يرجى فتح الواتساب لاستلام الكود.')
      
      // Auto open WhatsApp link
      if (res.whatsapp_url) {
        window.open(res.whatsapp_url, '_blank')
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.toString() || 'فشل إرسال كود التحقق. تأكد من صحة اسم المستخدم وتسجيل رقم هاتف له.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      toast.error('يرجى إدخال كود التحقق المكون من 6 أرقام')
      return
    }
    if (!newPassword || newPassword.length < 4) {
      toast.error('كلمة المرور الجديدة يجب أن تكون 4 أحرف أو أرقام على الأقل')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)
    try {
      await verifyOtpAndResetPassword({
        username: username.trim(),
        otp_code: otpCode.trim(),
        new_password: newPassword,
      })
      toast.success('تم تغيير وتعيين كلمة المرور الجديدة بنجاح!')
      onSuccess(username.trim())
    } catch (err: any) {
      console.error(err)
      toast.error(err?.toString() || 'كود التحقق غير صحيح أو انتهت صلاحيته')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content p-6 max-w-md w-full animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b mb-5" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--clr-text)]">
                استعادة كلمة المرور عبر WhatsApp OTP
              </h3>
              <p className="text-[11px] text-[var(--clr-muted)]">
                خاص بمدير الحسابات والمالية والمسؤولين المسجل لديهم رقم هاتف
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon p-1 text-[var(--clr-muted)] hover:text-[var(--clr-text)]">
            <X size={18} />
          </button>
        </div>

        {/* Step 1: Request OTP */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
              <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
              <span>
                سيقوم النظام بإرسال كود تحقق سري مؤقت عبر تطبيق <strong>WhatsApp</strong> إلى رقم الهاتف المسجل لحسابك لتأكيد هويتك.
              </span>
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">اسم المستخدم (Username) *</label>
              <input
                type="text"
                autoFocus
                className="input w-full font-bold text-sm"
                placeholder="أدخل اسم المستخدم (مثال: admin)"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

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
                disabled={loading}
                className="btn-primary flex-1 py-2.5 font-bold text-xs flex items-center justify-center gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700"
              >
                <Send size={15} />
                {loading ? 'جاري التوليد...' : 'إرسال كود الواتساب'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Verify OTP and Reset Password */}
        {step === 2 && (
          <form onSubmit={handleVerifyAndReset} className="flex flex-col gap-4">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 size={16} />
                <span>تم إرسال كود التحقق إلى الرقم: {phoneInfo}</span>
              </div>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-300 hover:underline flex items-center gap-1.5 font-bold"
                >
                  <MessageSquare size={13} />
                  انقر هنا إذا لم يفتح الواتساب تلقائياً
                </a>
              )}
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">كود التحقق السري (OTP) *</label>
              <input
                type="text"
                autoFocus
                maxLength={6}
                className="input w-full font-mono font-black text-center text-xl tracking-widest text-[var(--clr-primary)]"
                placeholder="000000"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                required
              />
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">كلمة المرور الجديدة *</label>
              <input
                type="password"
                className="input w-full font-bold text-sm"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">تأكيد كلمة المرور الجديدة *</label>
              <input
                type="password"
                className="input w-full font-bold text-sm"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-3 pt-3 border-t mt-2" style={{ borderColor: 'var(--clr-border)' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary flex-1 py-2.5 font-bold text-xs flex items-center justify-center gap-1"
              >
                <ArrowRight size={14} />
                تغيير المستخدم
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 py-2.5 font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <KeyRound size={15} />
                {loading ? 'جاري التحقق...' : 'تأكيد وحفظ كلمة السر'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
