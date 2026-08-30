import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface PermissionDefinition {
  key: string
  labelAr: string
  category: string
  isSensitive: boolean
  description: string
}

export const PERMISSIONS_LIST: PermissionDefinition[] = [
  // POS & Sales
  { key: 'sales_create', labelAr: 'إدخال فواتير المبيعات (POS)', category: 'المبيعات', isSensitive: false, description: 'إنشاء فواتير مبيعات نقدية أو آجلة' },
  { key: 'sales_return', labelAr: 'إدخال مرتجعات المبيعات', category: 'المبيعات', isSensitive: true, description: 'تسجيل مرتجع بيع كلي أو جزئي (يولد إشعار للمدير)' },
  
  // Purchases & Suppliers
  { key: 'purchases_create', labelAr: 'إدخال فواتير المشتريات', category: 'المشتريات والموردين', isSensitive: true, description: 'تسجيل بضاعة ومشتريات جديدة من الموردين (يولد إشعار للمدير)' },
  { key: 'suppliers_debts', labelAr: 'سداد مستحقات وفواتير الموردين', category: 'المشتريات والموردين', isSensitive: false, description: 'تسوية وصرف دفعات الموردين من الحسابات النقدية' },
  
  // Inventory
  { key: 'inventory_edit', labelAr: 'تعديل بنود وبيانات المخزون والأسعار', category: 'المخزون', isSensitive: true, description: 'تعديل أسعار البيع والتكلفة والكميات اليدوية (يولد إشعار للمدير)' },
  { key: 'inventory_damaged', labelAr: 'تسجيل بضاعة هالك وتالف', category: 'المخزون', isSensitive: true, description: 'استبعاد بضاعة هالكة واحتسابها كمصروفات (يولد إشعار للمدير)' },
  
  // Customers & Debts
  { key: 'customers_debts', labelAr: 'سداد وتحصيل مديونيات العملاء', category: 'العملاء', isSensitive: false, description: 'تحصيل الفواتير الآجلة وتسجيل النقدية المحصلة' },
  
  // Services & Maintenance
  { key: 'repairs_manage', labelAr: 'إدارة وتحديث عمليات الصيانة', category: 'الصيانة', isSensitive: false, description: 'استلام وتسليم أجهزة الصيانة وقطع الغيار' },
  { key: 'monetary_manage', labelAr: 'إدارة عمليات الخدمات المالية', category: 'الخدمات المالية', isSensitive: false, description: 'تسجيل الإيداعات والسحوبات والتحويلات المالية' },
  
  // Accounts & Equity
  { key: 'accounts_manage', labelAr: 'إدارة الحسابات المالية والتحويلات', category: 'الخزينة والمالية', isSensitive: false, description: 'فتح حسابات وإجراء تحويلات السيولة النقدية' },
  { key: 'equity_edit', labelAr: 'تعديل رأس المال وجاري الشركاء والأرباح', category: 'الشركاء ورأس المال', isSensitive: true, description: 'إضافة شركاء وتعديل مسحوبات ورأس المال (يولد إشعار للمدير)' },
  
  // Financial Statements & Reports
  { key: 'income_statement_view', labelAr: 'الاطلاع على قائمة الدخل وتصدير الأرباح', category: 'التقارير المحاسبية', isSensitive: false, description: 'عرض صافي الربح وقائمة الدخل وتصدير إكسيل الأرباح' },
  { key: 'balance_sheet_view', labelAr: 'الاطلاع على قائمة المركز المالي (الميزانية)', category: 'التقارير المحاسبية', isSensitive: false, description: 'عرض الميزانية العمومية والمركز المالي وتصدير الإكسيل' },
  
  // Expenses
  { key: 'expenses_create', labelAr: 'إدخال وتسجيل المصروفات النقدية والمستحقة', category: 'المصروفات', isSensitive: false, description: 'إنشاء وتسجيل المصروفات النقدية والمستحقة' },
  { key: 'expenses_edit_delete', labelAr: 'تعديل وحذف المصروفات المسجلة والالتزامات', category: 'المصروفات', isSensitive: true, description: 'تعديل أو حذف المصروفات النقدية والمستحقة (يولد إشعار للمدير)' },
  
  // Settings
  { key: 'settings_manage', labelAr: 'إدارة الإعدادات والمستخدمين والصلاحيات', category: 'النظام', isSensitive: true, description: 'تعديل بيانات المتجر والمظهر وإدارة المستخدمين' },
]

export interface User {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'staff'
  is_active: boolean
  phone?: string | null
  permissions?: string | string[]
  created_at: string
}

interface AuthState {
  user: User | null
  sessionId: string | null
  isAuthenticated: boolean
  login: (user: User, sessionId: string) => void
  logout: () => void
  hasPermission: (permKey: string) => boolean
}

function parseUserPermissions(perms?: string | string[]): string[] {
  if (!perms) return []
  if (Array.isArray(perms)) return perms
  try {
    const parsed = JSON.parse(perms)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      sessionId: null,
      isAuthenticated: false,

      login: (user, sessionId) => {
        set({ user, sessionId, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, sessionId: null, isAuthenticated: false })
      },

      hasPermission: (permKey: string) => {
        const { user } = get()
        if (!user) return false
        // Super Admin has all permissions unconditionally
        if (user.role === 'admin') return true

        const userPerms = parseUserPermissions(user.permissions)
        return userPerms.includes(permKey) || userPerms.includes('*')
      },
    }),
    {
      name: 'xphone-auth-session',
      // Using sessionStorage so closing the window / new session requires re-login
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
