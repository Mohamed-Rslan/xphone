import {
  LayoutDashboard, ShoppingCart, Package, Wrench,
  Banknote, Users, Calculator, Settings, ChevronRight,
  Smartphone, Truck, Landmark, Wallet
} from 'lucide-react'
import type { NavPage } from './AppShell'
import { cn } from '../lib/utils'

import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'

interface NavItem {
  id: NavPage
  label: string
  icon: React.ComponentType<any>
  permCheck?: (hasPermission: (k: string) => boolean) => boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  label: 'لوحة التحكم',             icon: LayoutDashboard },
  { id: 'pos',        label: 'نقطة البيع',                icon: ShoppingCart, permCheck: h => h('sales_create') },
  { id: 'monetary',   label: 'الخدمات المالية',           icon: Banknote,     permCheck: h => h('monetary_manage') },
  { id: 'repairs',    label: 'الصيانة',                   icon: Wrench,       permCheck: h => h('repairs_manage') },
  { id: 'accounts',   label: 'الحسابات والسيولة والحدود', icon: Landmark,     permCheck: h => h('accounts_manage') },
  { id: 'inventory',  label: 'المخزون',                   icon: Package,      permCheck: h => h('inventory_edit') || h('inventory_damaged') },
  { id: 'expenses',   label: 'المصروفات',                 icon: Wallet,       permCheck: h => h('expenses_create') || h('expenses_edit_delete') || h('income_statement_view') || h('manage_liabilities') },
  { id: 'customers',  label: 'العملاء',                   icon: Users,        permCheck: h => h('customers_debts') },
  { id: 'suppliers',  label: 'الموردون والمشتريات',      icon: Truck,        permCheck: h => h('purchases_create') || h('suppliers_debts') },
  { id: 'accounting', label: 'المحاسبة والتقارير',        icon: Calculator,   permCheck: h => h('income_statement_view') || h('balance_sheet_view') || h('equity_edit') },
  { id: 'settings',   label: 'الإعدادات',                 icon: Settings,     permCheck: h => h('settings_manage') },
]

interface SidebarProps {
  currentPage: NavPage
  onNavigate: (page: NavPage) => void
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ currentPage, onNavigate, isOpen }: SidebarProps) {
  const { storeLogo, storeName, storeTagline } = useSettingsStore()
  const { hasPermission } = useAuthStore()

  const allowedNavItems = NAV_ITEMS.filter(item => {
    if (!item.permCheck) return true
    return item.permCheck(hasPermission)
  })

  return (
    <aside
      className="fixed top-0 right-0 h-full flex flex-col transition-all duration-300 z-40"
      style={{
        width: isOpen ? 'var(--sidebar-width)' : '72px',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(24px)',
        borderLeft: '1px solid var(--clr-border)',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-3.5 py-4 border-b"
        style={{ borderColor: 'var(--clr-border)', minHeight: 'calc(var(--topbar-height) + 10px)' }}
      >
        <div
          className="flex items-center justify-center rounded-2xl flex-shrink-0 overflow-hidden"
          style={{
            width: 52, height: 52,
            background: storeLogo ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, var(--clr-primary), var(--clr-accent))',
            boxShadow: '0 4px 20px var(--clr-primary-glow)',
            border: storeLogo ? '1.5px solid var(--clr-border)' : 'none',
          }}
        >
          {storeLogo ? (
            <img src={storeLogo} alt="Logo" className="w-full h-full object-contain p-1" />
          ) : (
            <Smartphone size={26} color="white" />
          )}
        </div>
        {isOpen && (
          <div className="animate-fade-in overflow-hidden flex flex-col justify-center">
            <div className="font-black text-lg leading-tight truncate max-w-[170px]" style={{ color: 'var(--clr-text)' }}>
              {storeName || 'XPhone'}
            </div>
            {storeTagline && (
              <div className="text-[11px] font-bold text-amber-400 mt-0.5 truncate max-w-[170px]">
                {storeTagline}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-1">
        {allowedNavItems.map(item => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'nav-link w-full border-0',
                isActive && 'active',
                !isOpen && 'justify-center px-0'
              )}
              title={!isOpen ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {isOpen && <span className="animate-fade-in whitespace-nowrap">{item.label}</span>}
              {isOpen && isActive && <ChevronRight size={14} className="mr-auto opacity-60" />}
            </button>
          )
        })}
      </nav>

      {/* Version */}
      {isOpen && (
        <div className="px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--clr-border)', color: 'var(--clr-muted)' }}>
          v1.0.0 — XPhone Store
        </div>
      )}
    </aside>
  )
}
