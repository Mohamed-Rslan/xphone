import { useEffect, useState } from 'react'
import {
  TrendingUp, ShoppingCart, DollarSign, AlertTriangle,
  Wrench, ArrowUpRight, Package, Banknote, FileSpreadsheet,
  Wallet, Building2, Scale, Users, Compass
} from 'lucide-react'
import { getDashboardStats, getDailySummary, getFinancialAccounts, FinancialAccount } from '../../lib/commands'
import { formatEGP, formatDate, monthStart, today } from '../../lib/utils'
import { exportPeriodRevenueExpenseReport } from '../../lib/excel'
import ExportReportModal from '../../components/ExportReportModal'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

interface Stats {
  today_sales: number
  today_transactions: number
  month_revenue: number
  month_expenses: number
  month_monetary_profit: number
  low_stock_count: number
  pending_repairs: number
}

interface DashboardPageProps {
  onNavigate?: (page: string) => void
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [accountAlerts, setAccountAlerts] = useState<FinancialAccount[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, chart, accs] = await Promise.all([
          getDashboardStats(),
          getDailySummary({ date_from: monthStart(), date_to: today() }),
          getFinancialAccounts(),
        ])
        setStats(s)
        setChartData(chart.reverse().map((d: any) => ({
          day: formatDate(d.day),
          revenue: d.sales_revenue,
          profit: d.gross_profit,
        })))
        setAccountAlerts((accs || []).filter((a: any) => a.alert_status && a.alert_status !== 'normal'))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg" style={{ color: 'var(--clr-muted)' }}>جاري التحميل...</div>
      </div>
    )
  }

  const kpis = [
    {
      label: 'مبيعات اليوم',
      value: formatEGP(stats?.today_sales ?? 0),
      sub: `${stats?.today_transactions ?? 0} معاملة`,
      icon: ShoppingCart,
      color: 'var(--clr-primary)',
      glow: 'var(--clr-primary-glow)',
      bg: 'var(--clr-primary-dim)',
      page: 'pos'
    },
    {
      label: 'إيرادات الشهر',
      value: formatEGP(stats?.month_revenue ?? 0),
      sub: 'إجمالي المبيعات',
      icon: TrendingUp,
      color: 'var(--clr-accent)',
      glow: 'var(--clr-accent-dim)',
      bg: 'var(--clr-accent-dim)',
      page: 'accounting'
    },
    {
      label: 'مصاريف الشهر',
      value: formatEGP(stats?.month_expenses ?? 0),
      sub: 'انقر للوصول لجدول المصروفات',
      icon: DollarSign,
      color: 'var(--clr-warning)',
      glow: 'var(--clr-warning-dim)',
      bg: 'var(--clr-warning-dim)',
      page: 'expenses'
    },
    {
      label: 'خدمات مالية',
      value: formatEGP(stats?.month_monetary_profit ?? 0),
      sub: 'عمولات الشهر',
      icon: Banknote,
      color: 'var(--clr-success)',
      glow: 'var(--clr-success-dim)',
      bg: 'var(--clr-success-dim)',
      page: 'monetary'
    },
  ]

  const quickShortcuts = [
    { label: 'المصروفات والالتزامات', icon: Wallet, page: 'expenses', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { label: 'الحسابات والسيولة', icon: Building2, page: 'accounts', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'المحاسبة وحقوق الملكية', icon: Scale, page: 'accounting', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { label: 'المخزون والمستودع', icon: Package, page: 'inventory', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
    { label: 'الموردون والمشتريات', icon: Users, page: 'suppliers', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    { label: 'الصيانة والتسليمات', icon: Wrench, page: 'repairs', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  ]

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-12">
      {/* Header */}
      <div className="page-header flex-wrap gap-4">
        <div>
          <h1 className="page-title">لوحة التحكم</h1>
          <p className="text-sm" style={{ color: 'var(--clr-muted)' }}>
            {formatDate(new Date().toISOString())}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="btn-secondary flex items-center gap-2 font-bold cursor-pointer text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 shadow-sm"
          title="استخراج تقرير إكسيل تفصيلي بإجمالي الإيرادات والمصروفات وصافي الأرباح لفترة"
        >
          <FileSpreadsheet size={16} />
          تقرير إجمالي الإيرادات والمصروفات لـ Excel
        </button>
      </div>

      {showExportModal && (
        <ExportReportModal
          title="تقرير إجمالي الإيرادات والمصروفات والأرباح"
          description="حدد الفترة الزمنية لتوليد تقرير شامل بكافة الإيرادات والمصروفات وصافي أرباح المتجر"
          onClose={() => setShowExportModal(false)}
          onExport={exportPeriodRevenueExpenseReport}
        />
      )}

      {/* Quick Navigation Shortcuts Bar */}
      <div className="glass-card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--clr-muted)] border-b pb-2" style={{ borderColor: 'var(--clr-border)' }}>
          <Compass size={16} className="text-[var(--clr-primary)]" />
          <span>الوصول السريع والتنقل الفوري بنقرة واحدة للأقسام:</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickShortcuts.map(sc => {
            const Icon = sc.icon
            return (
              <button
                key={sc.page}
                type="button"
                onClick={() => onNavigate?.(sc.page)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 hover:scale-105 ${sc.bg}`}
              >
                <Icon size={20} className={sc.color} />
                <span className="text-xs font-bold text-white text-center">{sc.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Financial Accounts Limits Alert Banner */}
      {accountAlerts.length > 0 && (
        <div className="glass-card p-4 border space-y-3" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <div className="flex items-center gap-2 font-bold text-sm text-red-400">
              <AlertTriangle size={18} className="animate-pulse" />
              <span>🚨 تنبيهات ومراقبة ضوابط الحسابات النقدية والمسحوبات:</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('accounts')}
              className="btn-secondary text-xs py-1 px-3 font-bold cursor-pointer text-amber-300 border-amber-500/40"
            >
              إدارة الحسابات والسيولة ⚙️
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accountAlerts.map(acc => {
              const isUrgent = acc.alert_status.includes('100') || acc.alert_status.includes('below') || acc.alert_status.includes('above')
              return (
                <div key={acc.id} className="p-3 rounded-xl bg-black/40 border border-red-500/20 text-xs flex flex-col gap-1.5 justify-between">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white text-sm">{acc.name_ar}</span>
                    <span className={`badge text-[10px] ${isUrgent ? 'badge-danger animate-pulse' : 'badge-warning'}`}>
                      {isUrgent ? '🚨 تنبيه مشدد' : '⚠️ تحذير'}
                    </span>
                  </div>
                  <p className="text-[var(--clr-muted)] text-[11px] leading-relaxed">
                    {acc.alert_message}
                  </p>
                  {acc.limit_type === 'debit_limit' && (
                    <div className="flex justify-between items-center text-[10px] font-mono text-amber-300 border-t pt-1" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <span>المدينة الخارجة للفترة: {formatEGP(acc.current_period_debit || 0)}</span>
                      <span>المتبقي بالشهر الحالي: {acc.days_remaining_in_period ?? 0} يوم</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="kpi-card cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:border-white/30"
              onClick={() => onNavigate?.(kpi.page)}
              title={`انقر للوصول لصفحة ${kpi.label}`}
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex items-center justify-center rounded-2xl p-2.5"
                  style={{ background: kpi.bg }}
                >
                  <Icon size={22} style={{ color: kpi.color }} />
                </div>
                <ArrowUpRight size={14} style={{ color: kpi.color }} />
              </div>
              <div>
                <div className="kpi-value text-2xl">{kpi.value}</div>
                <div className="kpi-label mt-1">{kpi.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--clr-muted)' }}>{kpi.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="glass-card p-4 flex items-center gap-4"
          style={{ border: '1px solid rgba(255,171,62,0.2)' }}
        >
          <div className="rounded-xl p-3" style={{ background: 'var(--clr-warning-dim)' }}>
            <Package size={20} style={{ color: 'var(--clr-warning)' }} />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--clr-warning)' }}>
              {stats?.low_stock_count ?? 0}
            </div>
            <div className="text-sm" style={{ color: 'var(--clr-text-2)' }}>منتج يحتاج إعادة طلب</div>
          </div>
        </div>
        <div
          className="glass-card p-4 flex items-center gap-4"
          style={{ border: '1px solid rgba(124,107,255,0.2)' }}
        >
          <div className="rounded-xl p-3" style={{ background: 'var(--clr-primary-dim)' }}>
            <Wrench size={20} style={{ color: 'var(--clr-primary)' }} />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--clr-primary)' }}>
              {stats?.pending_repairs ?? 0}
            </div>
            <div className="text-sm" style={{ color: 'var(--clr-text-2)' }}>طلب صيانة معلق</div>
          </div>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--clr-text)' }}>
          مبيعات الشهر الحالي
        </h2>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48" style={{ color: 'var(--clr-muted)' }}>
            لا توجد بيانات مبيعات بعد
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} style={{ direction: 'ltr' }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c6bff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c6bff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: 'rgba(240,240,250,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'rgba(240,240,250,0.4)', fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(13,13,31,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, color: '#f0f0fa', fontFamily: 'Cairo, sans-serif',
                }}
                formatter={(v: any) => [formatEGP(v), '']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#7c6bff" strokeWidth={2}
                fill="url(#revGrad)" name="الإيراد" dot={false} />
              <Area type="monotone" dataKey="profit" stroke="#00d4aa" strokeWidth={2}
                fill="url(#profitGrad)" name="الربح" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-6 mt-4 justify-center">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-muted)' }}>
            <div className="w-3 h-3 rounded-full" style={{ background: '#7c6bff' }} />
            الإيراد
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-muted)' }}>
            <div className="w-3 h-3 rounded-full" style={{ background: '#00d4aa' }} />
            الربح الإجمالي
          </div>
        </div>
      </div>
    </div>
  )
}
