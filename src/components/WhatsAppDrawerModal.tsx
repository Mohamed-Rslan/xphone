import { MessageSquare, X, Send, Copy, Check, Smartphone, Globe } from 'lucide-react'
import { useState } from 'react'
import { useWhatsAppStore } from '../store/whatsappStore'
import { formatWhatsAppPhone } from '../lib/whatsapp'
import toast from 'react-hot-toast'

export default function WhatsAppDrawerModal() {
  const { isOpen, phone, message, title, recipientName, closeWhatsAppDrawer, setMessage, setPhone } = useWhatsAppStore()
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const formattedPhone = formatWhatsAppPhone(phone)

  const handleSendExternal = async (useWebUrl = false) => {
    if (!message.trim()) {
      toast.error('لا يمكن إرسال رسالة فارغة')
      return
    }

    const cleanPhone = formatWhatsAppPhone(phone)
    const encodedMsg = encodeURIComponent(message)
    
    // Formulate URLs
    const apiUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`
      : `https://api.whatsapp.com/send?text=${encodedMsg}`

    const webUrl = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`
      : `https://web.whatsapp.com/send?text=${encodedMsg}`

    const targetUrl = useWebUrl ? webUrl : apiUrl

    try {
      // 1. Primary: Use Tauri System Opener plugin (Opens in Default System Browser Chrome/Edge/Firefox)
      try {
        const opener = await import('@tauri-apps/plugin-opener')
        if (opener && typeof opener.openUrl === 'function') {
          await opener.openUrl(targetUrl)
          toast.success('تم فتح الواتساب بنجاح في متصفح النظام!')
          return
        }
      } catch (openerErr) {
        console.warn('Tauri Opener plugin fallback:', openerErr)
      }

      // 2. Fallback: window.open
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer')
      if (!win) {
        // 3. Last Fallback: direct location
        window.location.href = targetUrl
      } else {
        toast.success('تم فتح الواتساب بنجاح!')
      }
    } catch (e) {
      console.error(e)
      toast.error('تعذر فتح الرابط تلقائياً، يرجى استخدام زر نسخ النص')
    }
  }

  const handleCopy = () => {
    if (!message) return
    navigator.clipboard.writeText(message)
    setCopied(true)
    toast.success('تم نسخ نص الرسالة إلى الحافظة بنجاح!')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div
      className="fixed inset-0 z-[999999] flex justify-start pointer-events-auto animate-fade-in"
      style={{ zIndex: 999999, direction: 'rtl' }}
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={closeWhatsAppDrawer}
        title="انقر هنا لإغلاق النافذة المنبثقة الجانبية"
      />

      {/* Side Popup Panel */}
      <div
        className="relative w-full max-w-lg bg-[var(--clr-bg)] h-full shadow-2xl flex flex-col z-10 border-r border-[var(--clr-border)] animate-slide-right"
        style={{
          background: 'var(--glass-bg, rgba(20, 24, 33, 0.96))',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between gap-3 bg-emerald-950/20" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md">
              <MessageSquare size={22} />
            </div>
            <div>
              <h3 className="font-black text-lg text-[var(--clr-text)] flex items-center gap-2">
                <span>{title || 'نافذة إرسال الواتساب الجانبية'}</span>
              </h3>
              <p className="text-xs text-[var(--clr-muted)] mt-0.5">
                معاينة وتعديل وإرسال الرسالة بدون إغلاق البرنامج الرئيسي
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeWhatsAppDrawer}
            className="btn-icon p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="إغلاق النافذة الجانبية (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Form */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Recipient info card */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[var(--clr-muted)] flex items-center gap-1.5">
                <Smartphone size={15} className="text-emerald-400" />
                المستلم والمستهدف بالرسالة:
              </span>
              {recipientName && (
                <span className="text-[var(--clr-primary)] bg-[var(--clr-primary)]/10 px-2.5 py-0.5 rounded-lg border border-[var(--clr-primary)]/20">
                  👤 {recipientName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <label className="text-xs font-bold text-[var(--clr-muted)] whitespace-nowrap">رقم الهاتف:</label>
              <input
                type="text"
                dir="ltr"
                className="input w-full font-mono text-left text-xs py-1.5 font-bold text-emerald-400 bg-black/30"
                placeholder="010XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {formattedPhone && formattedPhone !== phone && (
              <div className="text-[10px] text-emerald-400/80 font-mono text-left" dir="ltr">
                صيغة واتساب الرقمية: +{formattedPhone}
              </div>
            )}
          </div>

          {/* Message Text Area Editor */}
          <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--clr-text)] flex items-center gap-1.5">
                <span>محتوى الرسالة الصادرة:</span>
                <span className="text-[10px] text-[var(--clr-muted)] font-normal">(يمكنك تعديل النص مباشرة قبل الإرسال)</span>
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
              </button>
            </div>

            <textarea
              className="input w-full flex-1 p-3.5 text-xs leading-relaxed font-sans resize-none bg-black/30 border-emerald-500/20 focus:border-emerald-500 rounded-xl"
              style={{ minHeight: '200px' }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="اكتب نص الرسالة هنا..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-black/40 flex flex-col gap-2.5" style={{ borderColor: 'var(--clr-border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSendExternal(false)}
              className="py-3 px-3 rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              }}
            >
              <Send size={16} />
              <span>إرسال عبر الواتساب المباشر</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendExternal(true)}
              className="py-3 px-3 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Globe size={16} />
              <span>فتح WhatsApp Web</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
              title="نسخ الرسالة إلى الحافظة"
            >
              <Copy size={15} />
              <span>{copied ? 'تم النسخ!' : 'نسخ نص الرسالة'}</span>
            </button>

            <button
              type="button"
              onClick={closeWhatsAppDrawer}
              className="btn-secondary py-2.5 px-4 rounded-xl text-xs font-bold text-[var(--clr-muted)] hover:text-white bg-white/5 hover:bg-white/10 transition-colors text-center border border-white/10 cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
