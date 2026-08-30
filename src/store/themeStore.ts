import { create } from 'zustand'

export type ThemeId =
  | 'light_corporate'
  | 'light_emerald'
  | 'light_warm'
  | 'light_crystal'
  | 'night_cyber'
  | 'minimal_simple'
  | 'deep_ocean'
  | 'royal_gold'

export interface ThemeOption {
  id: ThemeId
  nameAr: string
  nameEn: string
  primaryColor: string
  accentColor: string
  bgColor: string
  isDark: boolean
  description: string
}

export const THEMES: ThemeOption[] = [
  // ─── 4 DAY / LIGHT THEMES ──────────────────────────────────────────
  {
    id: 'light_corporate',
    nameAr: '☀️ نهاري أزرق ناصع وواضح',
    nameEn: 'Corporate Blue Light',
    primaryColor: '#2563eb',
    accentColor: '#0d9488',
    bgColor: '#f8fafc',
    isDark: false,
    description: 'مظهر نهاري رسمي عالي التباين بألوان زرقاء ملكية مريحة وواضحة جداً'
  },
  {
    id: 'light_emerald',
    nameAr: '🍃 نهاري زمردي مريح للعين',
    nameEn: 'Emerald Mint Light',
    primaryColor: '#059669',
    accentColor: '#0284c7',
    bgColor: '#f0fdf4',
    isDark: false,
    description: 'درجات الأخضر والنعناع الهادئة لراحة العين طوال فترات العمل النهارية'
  },
  {
    id: 'light_warm',
    nameAr: '🌅 نهاري دافئ وعنبري',
    nameEn: 'Warm Amber Light',
    primaryColor: '#d97706',
    accentColor: '#ea580c',
    bgColor: '#fffbeb',
    isDark: false,
    description: 'ألوان كهرمانية وعنبرية دافئة تقلل إجهاد العين والإضاءة الزرقاء'
  },
  {
    id: 'light_crystal',
    nameAr: '💎 نهاري كريستالي بنفسجي',
    nameEn: 'Crystal Indigo Light',
    primaryColor: '#6366f1',
    accentColor: '#06b6d4',
    bgColor: '#f5f3ff',
    isDark: false,
    description: 'مظهر نهاري عصري ناصع بدرجات النيلي والبنفسجي الكريستالي'
  },

  // ─── 4 NIGHT / DARK THEMES ─────────────────────────────────────────
  {
    id: 'night_cyber',
    nameAr: '🌙 ليلي بنفسجي سايبر (الافتراضي)',
    nameEn: 'Cyber Dark Mode',
    primaryColor: '#7c6bff',
    accentColor: '#00d4aa',
    bgColor: '#080812',
    isDark: true,
    description: 'المظهر الليلي الحديث بدرجات البنفسجي والسيان المتوهج'
  },
  {
    id: 'minimal_simple',
    nameAr: '⚡ ليلي بسيط وعملي جداً',
    nameEn: 'Minimal Clean Dark',
    primaryColor: '#4f8df9',
    accentColor: '#2dd4bf',
    bgColor: '#111318',
    isDark: true,
    description: 'تصميم فلات مريح جداً بدون مؤثرات إضافية لأداء سريع وعملي'
  },
  {
    id: 'deep_ocean',
    nameAr: '🌊 ليلي أزرق محيطي',
    nameEn: 'Deep Ocean Blue',
    primaryColor: '#38bdf8',
    accentColor: '#818cf8',
    bgColor: '#030c1b',
    isDark: true,
    description: 'ألوان البحر وأعماق المحيط الهادئة'
  },
  {
    id: 'royal_gold',
    nameAr: '👑 ليلي ذهبي ملكي فاخر',
    nameEn: 'Royal Gold & Amber',
    primaryColor: '#f59e0b',
    accentColor: '#fbbf24',
    bgColor: '#0f0b04',
    isDark: true,
    description: 'مظهر كلاسيكي فخم باللون الذهبي والعنبر على خلفية سوداء'
  }
]

interface ThemeState {
  currentTheme: ThemeId
  setTheme: (theme: ThemeId) => void
  toggleDayNight: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('xphone_theme') as ThemeId : null) || 'night_cyber'
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', saved)
  }

  return {
    currentTheme: saved,
    setTheme: (theme: ThemeId) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('xphone_theme', theme)
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme)
      }
      set({ currentTheme: theme })
    },
    toggleDayNight: () => {
      const current = get().currentTheme
      const currentObj = THEMES.find(t => t.id === current)
      const isDark = currentObj ? currentObj.isDark : true
      // If currently dark -> switch to primary light ('light_corporate'), else switch to 'night_cyber'
      const nextTheme: ThemeId = isDark ? 'light_corporate' : 'night_cyber'
      get().setTheme(nextTheme)
    }
  }
})
