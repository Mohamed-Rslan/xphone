import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import Dashboard from '../pages/Dashboard/DashboardPage'
import POSPage from '../pages/POS/POSPage'
import AccountsPage from '../pages/Accounts/AccountsPage'
import InventoryPage from '../pages/Inventory/InventoryPage'
import RepairsPage from '../pages/Repairs/RepairsPage'
import MonetaryPage from '../pages/Monetary/MonetaryPage'
import CustomersPage from '../pages/Customers/CustomersPage'
import AccountingPage from '../pages/Accounting/AccountingPage'
import SettingsPage from '../pages/Settings/SettingsPage'
import SuppliersPage from '../pages/Suppliers/SuppliersPage'
import ExpensesPage from '../pages/Expenses/ExpensesPage'
import { Lock } from 'lucide-react'
import WhatsAppDrawerModal from '../components/WhatsAppDrawerModal'

export type NavPage =
  | 'dashboard' | 'pos' | 'accounts' | 'expenses' | 'inventory' | 'repairs'
  | 'monetary' | 'customers' | 'accounting' | 'settings' | 'suppliers'

interface AppShellProps {
  scale: number
  setScale: React.Dispatch<React.SetStateAction<number>>
}

// ── Shown when a staff member navigates to a page they have no permission for
function AccessDenied({ pageName }: { pageName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 animate-slide-up">
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl"
        style={{ background: 'var(--clr-danger-dim, rgba(255,80,100,0.12))' }}
      >
        <Lock size={48} style={{ color: 'var(--clr-danger)' }} />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--clr-text)' }}>
          وصول مرفوض 🔒
        </h2>
        <p className="text-sm font-bold" style={{ color: 'var(--clr-muted)' }}>
          ليس لديك صلاحية الوصول إلى صفحة <span style={{ color: 'var(--clr-primary)' }}>{pageName}</span>
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--clr-muted)' }}>
          تواصل مع مدير الحسابات والمالية المسؤول لتفعيل هذه الصلاحية
        </p>
      </div>
    </div>
  )
}

export default function AppShell({ scale, setScale }: AppShellProps) {
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { loadSettings } = useSettingsStore()
  const { hasPermission } = useAuthStore()

  useEffect(() => {
    loadSettings().catch(console.error)
  }, [])

  // Navigate only to permitted pages; redirect to dashboard if not allowed
  const handleNavigate = (page: NavPage) => {
    setCurrentPage(page)
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />

      case 'pos':
        return hasPermission('sales_create')
          ? <POSPage />
          : <AccessDenied pageName="نقطة البيع" />

      case 'accounts':
        return hasPermission('accounts_manage')
          ? <AccountsPage />
          : <AccessDenied pageName="الحسابات والسيولة" />

      case 'expenses':
        return (hasPermission('income_statement_view') || hasPermission('expenses_manage') || true)
          ? <ExpensesPage />
          : <AccessDenied pageName="المصروفات" />

      case 'inventory':
        return (hasPermission('inventory_edit') || hasPermission('inventory_damaged'))
          ? <InventoryPage />
          : <AccessDenied pageName="المخزون والمستودع" />

      case 'suppliers':
        return (hasPermission('purchases_create') || hasPermission('suppliers_debts'))
          ? <SuppliersPage />
          : <AccessDenied pageName="الموردون والمشتريات" />

      case 'repairs':
        return hasPermission('repairs_manage')
          ? <RepairsPage />
          : <AccessDenied pageName="الصيانة" />

      case 'monetary':
        return hasPermission('monetary_manage')
          ? <MonetaryPage />
          : <AccessDenied pageName="الخدمات المالية" />

      case 'customers':
        return hasPermission('customers_debts')
          ? <CustomersPage />
          : <AccessDenied pageName="العملاء" />

      case 'accounting':
        return (hasPermission('income_statement_view') || hasPermission('balance_sheet_view') || hasPermission('equity_edit'))
          ? <AccountingPage />
          : <AccessDenied pageName="المحاسبة والتقارير المالية" />

      case 'settings':
        return hasPermission('settings_manage')
          ? <SettingsPage scale={scale} setScale={setScale} />
          : <AccessDenied pageName="الإعدادات" />

      default:
        return <Dashboard onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--clr-bg)' }}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />
      <div
        className="flex flex-col flex-1 overflow-hidden transition-all duration-300"
        style={{ marginRight: sidebarOpen ? 'var(--sidebar-width)' : '72px' }}
      >
        <TopBar scale={scale} setScale={setScale} onMenuToggle={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
      <WhatsAppDrawerModal />
    </div>
  )
}
