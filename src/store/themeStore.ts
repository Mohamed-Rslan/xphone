import { create } from 'zustand'

export type ThemeId =
  | 'light_win11'
  | 'light_ios'
  | 'light_corporate'
  | 'light_emerald'
  | 'light_warm'
  | 'light_crystal'
  | 'night_win11'
  | 'night_ios'
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
  // ─── 6 DAY / LIGHT THEMES ──────────────────────────────────────────
  {
    id: 'light_win11',
    nameAr: '🪟 نهاري ويندوز 11 فلوينت',
    nameEn: 'Windows 11 Fluent Light',
    primaryColor: '#0067c0',
    accentColor: '#005fb8',
    bgColor: '#f3f4f6',
    isDark: false,
    description: 'مظهر ويندوز 11 المكتبي العملي عالي التباين بنوافذ مسطحة ونصوص ناصعة الوضوح'
  },
  {
    id: 'light_ios',
    nameAr: '🍎 نهاري أبل جلاس زجاجي (الافتراضي)',
    nameEn: 'Apple Liquid Glass Light',
    primaryColor: '#0071e3',
    accentColor: '#5e5ce6',
    bgColor: '#eef2f7',
    isDark: false,
    description: 'مظهر أبل الزجاجي الشفاف فائق النقاء والانسيابية مع نصوص داكنة حادة وسريعة'
  },
  {
    id: 'light_corporate',
    nameAr: '☀️ نهاري ناصع عالي التباين',
    nameEn: 'Corporate Clear Light',
    primaryColor: '#2563eb',
    accentColor: '#0d9488',
    bgColor: '#f8fafc',
    isDark: false,
    description: 'مظهر نهاري رسمي بأعلى درجات التباين والوضوح لقراءة الأرقام والبيانات'
  },
  {
    id: 'light_emerald',
    nameAr: '🍃 نهاري زمردي مريح للعين',
    nameEn: 'Emerald Mint Light',
    primaryColor: '#059669',
    accentColor: '#0284c7',
    bgColor: '#f0fdf4',
    isDark: false,
    description: 'درجات الأخضر والنعناع الهادئة مع تباين قوي لراحة العين في فترات العمل الطويلة'
  },
  {
    id: 'light_warm',
    nameAr: '🌅 نهاري دافئ ومريح للعين',
    nameEn: 'Warm Amber Light',
    primaryColor: '#d97706',
    accentColor: '#ea580c',
    bgColor: '#fffbeb',
    isDark: false,
    description: 'ألوان كهرمانية وعنبرية دافئة تقلل إجهاد الإضاءة الزرقاء مع نصوص داكنة واضحة'
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

  // ─── 6 NIGHT / DARK THEMES ─────────────────────────────────────────
  {
    id: 'night_win11',
    nameAr: '🪟 ليلي ويندوز 11 دارك',
    nameEn: 'Windows 11 Fluent Dark',
    primaryColor: '#60cdff',
    accentColor: '#4cc2ff',
    bgColor: '#1f1f1f',
    isDark: true,
    description: 'مظهر ويندوز 11 المكتبي الداكن الاحترافي فائق التباين والعملية وسريع الاستجابة'
  },
  {
    id: 'night_ios',
    nameAr: '🍎 ليلي أبل جلاس زجاجي',
    nameEn: 'Apple Liquid Glass Dark',
    primaryColor: '#2997ff',
    accentColor: '#a370f7',
    bgColor: '#08090d',
    isDark: true,
    description: 'مظهر أبل الزجاجي الداكن الفاخر بتباين OLED عميق وخلفيات زجاجية بلورية انسيابية'
  },
  {
    id: 'night_cyber',
    nameAr: '🌙 ليلي بنفسجي سايبر',
    nameEn: 'Cyber Dark Mode',
    primaryColor: '#7c6bff',
    accentColor: '#00d4aa',
    bgColor: '#080812',
    isDark: true,
    description: 'المظهر الليلي الحديث بدرجات البنفسجي والسيان المتوهج'
  },
  {
    id: 'minimal_simple',
    nameAr: '⚡ ليلي مسطح عملي وسريع',
    nameEn: 'Minimal Flat Dark',
    primaryColor: '#4f8df9',
    accentColor: '#2dd4bf',
    bgColor: '#111318',
    isDark: true,
    description: 'تصميم فلات مريح جداً بدون مؤثرات إضافية لأداء فائق السرعة وبساطة مطلقة'
  },
  {
    id: 'deep_ocean',
    nameAr: '🌊 ليلي أزرق محيطي',
    nameEn: 'Deep Ocean Blue',
    primaryColor: '#38bdf8',
    accentColor: '#818cf8',
    bgColor: '#030c1b',
    isDark: true,
    description: 'ألوان البحر وأعماق المحيط الهادئة مع تباين نصوص ساطع'
  },
  {
    id: 'royal_gold',
    nameAr: '👑 ليلي ذهبي ملكي فاخر',
    nameEn: 'Royal Gold & Amber',
    primaryColor: '#f59e0b',
    accentColor: '#fbbf24',
    bgColor: '#0f0b04',
    isDark: true,
    description: 'مظهر كلاسيكي فخم باللون الذهبي والعنبر على خلفية سوداء عميقة'
  }
]

const DAY_NIGHT_PAIRS: Record<ThemeId, ThemeId> = {
  light_win11: 'night_win11',
  night_win11: 'light_win11',
  light_ios: 'night_ios',
  night_ios: 'light_ios',
  light_corporate: 'night_cyber',
  night_cyber: 'light_corporate',
  light_emerald: 'deep_ocean',
  deep_ocean: 'light_emerald',
  light_warm: 'royal_gold',
  royal_gold: 'light_warm',
  light_crystal: 'minimal_simple',
  minimal_simple: 'light_crystal',
}

export function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('')
  }
  if (c.length !== 6) return `rgba(124, 107, 255, ${alpha})`
  const num = parseInt(c, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const PRESET_CUSTOM_COLORS = [
  { name: 'أزرق ويندوز ملكي', primary: '#0067c0', accent: '#005fb8' },
  { name: 'أزرق أبل كلاسيكي', primary: '#0071e3', accent: '#5e5ce6' },
  { name: 'بنفسجي نيون عصري', primary: '#7c6bff', accent: '#00d4aa' },
  { name: 'أخضر زمردي ناصع', primary: '#059669', accent: '#10b981' },
  { name: 'أزرق سماوي فيروزي', primary: '#0284c7', accent: '#06b6d4' },
  { name: 'ذهبي عنبري ملكي', primary: '#d97706', accent: '#f59e0b' },
  { name: 'أحمر ياقوتي وقرمزي', primary: '#e11d48', accent: '#f43f5e' },
  { name: 'وردي فوشيا عصري', primary: '#d946ef', accent: '#ec4899' },
  { name: 'برتقالي متوهج دافئ', primary: '#ea580c', accent: '#f97316' },
  { name: 'نيلي ليلي هادئ', primary: '#4f46e5', accent: '#6366f1' },
]

function applyCustomColorsToDoc(primary: string | null, accent: string | null) {
  if (typeof document === 'undefined') return
  const doc = document.documentElement
  if (primary) {
    doc.style.setProperty('--clr-primary', primary)
    doc.style.setProperty('--clr-primary-dim', hexToRgba(primary, 0.15))
    doc.style.setProperty('--clr-primary-glow', hexToRgba(primary, 0.35))
  } else {
    doc.style.removeProperty('--clr-primary')
    doc.style.removeProperty('--clr-primary-dim')
    doc.style.removeProperty('--clr-primary-glow')
  }

  if (accent) {
    doc.style.setProperty('--clr-accent', accent)
    doc.style.setProperty('--clr-accent-dim', hexToRgba(accent, 0.15))
  } else {
    doc.style.removeProperty('--clr-accent')
    doc.style.removeProperty('--clr-accent-dim')
  }
}

interface ThemeState {
  currentTheme: ThemeId
  customPrimary: string | null
  customAccent: string | null
  setTheme: (theme: ThemeId) => void
  setCustomColors: (primary: string | null, accent: string | null) => void
  resetCustomColors: () => void
  toggleDayNight: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('xphone_theme') as ThemeId : null) || 'light_ios'
  const savedPrimary = typeof localStorage !== 'undefined' ? localStorage.getItem('xphone_custom_primary') : null
  const savedAccent = typeof localStorage !== 'undefined' ? localStorage.getItem('xphone_custom_accent') : null

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', saved)
    applyCustomColorsToDoc(savedPrimary, savedAccent)
  }

  return {
    currentTheme: saved,
    customPrimary: savedPrimary,
    customAccent: savedAccent,
    setTheme: (theme: ThemeId) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('xphone_theme', theme)
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme)
      }
      set({ currentTheme: theme })
    },
    setCustomColors: (primary: string | null, accent: string | null) => {
      if (typeof localStorage !== 'undefined') {
        if (primary) localStorage.setItem('xphone_custom_primary', primary)
        else localStorage.removeItem('xphone_custom_primary')

        if (accent) localStorage.setItem('xphone_custom_accent', accent)
        else localStorage.removeItem('xphone_custom_accent')
      }
      applyCustomColorsToDoc(primary, accent)
      set({ customPrimary: primary, customAccent: accent })
    },
    resetCustomColors: () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('xphone_custom_primary')
        localStorage.removeItem('xphone_custom_accent')
      }
      applyCustomColorsToDoc(null, null)
      set({ customPrimary: null, customAccent: null })
    },
    toggleDayNight: () => {
      const current = get().currentTheme
      const paired = DAY_NIGHT_PAIRS[current]
      if (paired) {
        get().setTheme(paired)
      } else {
        const currentObj = THEMES.find(t => t.id === current)
        const isDark = currentObj ? currentObj.isDark : true
        const nextTheme: ThemeId = isDark ? 'light_win11' : 'night_win11'
        get().setTheme(nextTheme)
      }
    }
  }
})

