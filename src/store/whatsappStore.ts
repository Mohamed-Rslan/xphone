import { create } from 'zustand'

export interface WhatsAppPayload {
  phone?: string | null
  message: string
  title?: string
  recipientName?: string
}

interface WhatsAppState {
  isOpen: boolean
  phone: string
  message: string
  title: string
  recipientName: string
  openWhatsAppDrawer: (payload: WhatsAppPayload) => void
  closeWhatsAppDrawer: () => void
  setMessage: (msg: string) => void
  setPhone: (phone: string) => void
}

export const useWhatsAppStore = create<WhatsAppState>((set) => ({
  isOpen: false,
  phone: '',
  message: '',
  title: 'إرسال رسالة عبر الواتساب',
  recipientName: '',

  openWhatsAppDrawer: ({ phone, message, title, recipientName }: WhatsAppPayload) => {
    set({
      isOpen: true,
      phone: phone || '',
      message: message || '',
      title: title || 'إرسال رسالة عبر الواتساب',
      recipientName: recipientName || '',
    })
  },

  closeWhatsAppDrawer: () => {
    set({ isOpen: false })
  },

  setMessage: (message: string) => set({ message }),
  setPhone: (phone: string) => set({ phone }),
}))
