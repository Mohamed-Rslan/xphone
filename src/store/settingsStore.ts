import { create } from 'zustand'
import { getSettings, setSetting } from '../lib/commands'

interface SettingsState {
  storeName: string
  storeLogo: string
  storeAddress: string
  storePhone: string
  storeTagline: string

  // WhatsApp Templates & Formatting Settings
  waTagline: string
  waSaleHeader: string
  waMonetaryHeader: string
  waRepairHeader: string
  waFooterNote: string

  loaded: boolean
  loadSettings: () => Promise<void>
  saveStoreSettings: (payload: {
    name: string
    logo?: string
    address?: string
    phone?: string
    tagline?: string
  }) => Promise<void>
  saveWhatsAppSettings: (payload: {
    tagline?: string
    saleHeader?: string
    monetaryHeader?: string
    repairHeader?: string
    footerNote?: string
  }) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  storeName: 'XPhone',
  storeLogo: '',
  storeAddress: '',
  storePhone: '',
  storeTagline: '',

  waTagline: '',
  waSaleHeader: '🧾 إيصال فاتورة شراء من {{storeName}}',
  waMonetaryHeader: '💸 إيصال معاملة خدمة مالية - {{storeName}}',
  waRepairHeader: '🔧 كارت استلام/تسليم صيانة - {{storeName}}',
  waFooterNote: 'شكراً لزيارتكم وتثمين ثقتكم بنا!',

  loaded: false,

  loadSettings: async () => {
    try {
      const items = await getSettings()
      const map: Record<string, string> = {}
      items.forEach((item: any) => {
        map[item.key] = item.value
      })

      set({
        storeName: map.store_name || 'XPhone',
        storeLogo: map.store_logo || '',
        storeAddress: map.store_address || '',
        storePhone: map.store_phone || '',
        storeTagline: map.store_tagline || '',
        waTagline: map.wa_tagline || '',
        waSaleHeader: map.wa_sale_header || '🧾 إيصال فاتورة شراء من {{storeName}}',
        waMonetaryHeader: map.wa_monetary_header || '💸 إيصال معاملة خدمة مالية - {{storeName}}',
        waRepairHeader: map.wa_repair_header || '🔧 كارت استلام/تسليم صيانة - {{storeName}}',
        waFooterNote: map.wa_footer_note || 'شكراً لزيارتكم وتثمين ثقتكم بنا!',
        loaded: true,
      })
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  },

  saveStoreSettings: async ({ name, logo, address, phone, tagline }) => {
    try {
      await Promise.all([
        setSetting('store_name', name || 'XPhone'),
        setSetting('store_logo', logo !== undefined ? logo : ''),
        setSetting('store_address', address || ''),
        setSetting('store_phone', phone || ''),
        setSetting('store_tagline', tagline !== undefined ? tagline : ''),
      ])

      set({
        storeName: name || 'XPhone',
        storeLogo: logo !== undefined ? logo : '',
        storeAddress: address || '',
        storePhone: phone || '',
        storeTagline: tagline !== undefined ? tagline : '',
      })
    } catch (err) {
      console.error('Failed to save store settings:', err)
      throw err
    }
  },

  saveWhatsAppSettings: async ({ tagline, saleHeader, monetaryHeader, repairHeader, footerNote }) => {
    try {
      const newTagline = tagline ?? 'لأنك تستحق الأفضل 🌹'
      const newSaleHeader = saleHeader ?? '🧾 إيصال فاتورة شراء من {{storeName}}'
      const newMonetaryHeader = monetaryHeader ?? '💸 إيصال معاملة خدمة مالية - {{storeName}}'
      const newRepairHeader = repairHeader ?? '🔧 كارت استلام/تسليم صيانة - {{storeName}}'
      const newFooterNote = footerNote ?? 'شكراً لزيارتكم وتثمين ثقتكم بنا!'

      await Promise.all([
        setSetting('wa_tagline', newTagline),
        setSetting('wa_sale_header', newSaleHeader),
        setSetting('wa_monetary_header', newMonetaryHeader),
        setSetting('wa_repair_header', newRepairHeader),
        setSetting('wa_footer_note', newFooterNote),
      ])

      set({
        waTagline: newTagline,
        waSaleHeader: newSaleHeader,
        waMonetaryHeader: newMonetaryHeader,
        waRepairHeader: newRepairHeader,
        waFooterNote: newFooterNote,
      })
    } catch (err) {
      console.error('Failed to save WhatsApp settings:', err)
      throw err
    }
  },
}))
