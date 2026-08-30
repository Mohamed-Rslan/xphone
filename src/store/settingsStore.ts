import { create } from 'zustand'
import { getSettings, setSetting } from '../lib/commands'

interface SettingsState {
  storeName: string
  storeLogo: string
  storeAddress: string
  storePhone: string
  loaded: boolean
  loadSettings: () => Promise<void>
  saveStoreSettings: (payload: {
    name: string
    logo?: string
    address?: string
    phone?: string
  }) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  storeName: 'XPhone',
  storeLogo: '',
  storeAddress: '',
  storePhone: '',
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
        loaded: true,
      })
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  },

  saveStoreSettings: async ({ name, logo, address, phone }) => {
    try {
      await Promise.all([
        setSetting('store_name', name || 'XPhone'),
        setSetting('store_logo', logo !== undefined ? logo : ''),
        setSetting('store_address', address || ''),
        setSetting('store_phone', phone || ''),
      ])

      set({
        storeName: name || 'XPhone',
        storeLogo: logo !== undefined ? logo : '',
        storeAddress: address || '',
        storePhone: phone || '',
      })
    } catch (err) {
      console.error('Failed to save store settings:', err)
      throw err
    }
  },
}))
