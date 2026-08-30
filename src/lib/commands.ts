import { invoke } from '@tauri-apps/api/core'

// ─── Auth ───────────────────────────────────────────────────────
export const login = (username: string, password: string) =>
  invoke<{ session_id: string; user: any }>('login', { payload: { username, password } })

export const logout = (sessionId: string) =>
  invoke<void>('logout', { sessionId })

export const getUsers = () => invoke<any[]>('get_users')

export const createUser = (payload: { username: string; display_name: string; password: string; role: string; phone?: string; permissions?: string[]; job_title?: string }) =>
  invoke<any>('create_user', { payload })

// ─── Products ───────────────────────────────────────────────────
export const getProducts = (filter?: any) =>
  invoke<any[]>('get_products', { filter })

export const createProduct = (payload: any) =>
  invoke<any>('create_product', { payload })

export const updateProduct = (id: string, payload: any) =>
  invoke<any>('update_product', { id, payload })

export const deleteProduct = (id: string) =>
  invoke<void>('delete_product', { id })

export const getBrands = () => invoke<any[]>('get_brands')
export const getCategories = () => invoke<any[]>('get_categories')
export const getLowStockProducts = () => invoke<any[]>('get_low_stock_products')

// ─── Sales ──────────────────────────────────────────────────────
export const createSale = (payload: any) =>
  invoke<any>('create_sale', { payload })

export const getSales = (params?: { date_from?: string; date_to?: string; limit?: number; offset?: number }) =>
  invoke<any[]>('get_sales', params)

export const getSale = (id: string) => invoke<any>('get_sale', { id })

export const getDailySummary = (params?: { date_from?: string; date_to?: string }) =>
  invoke<any[]>('get_daily_summary', params)

export const getDetailedSaleItemsReport = (dateFrom: string, dateTo: string) =>
  invoke<any[]>('get_detailed_sale_items_report', { dateFrom, dateTo })

// ─── Customers ──────────────────────────────────────────────────
export const getCustomers = (search?: string) =>
  invoke<any[]>('get_customers', { search })

export const getCustomersReport = (dateFrom?: string, dateTo?: string) =>
  invoke<any[]>('get_customers_report', { dateFrom, dateTo, date_from: dateFrom, date_to: dateTo })

export const createCustomer = (payload: any) =>
  invoke<any>('create_customer', { payload })

export const updateCustomer = (id: string, payload: any) =>
  invoke<void>('update_customer', { id, payload })

export const getCustomerHistory = (customerId: string) =>
  invoke<any>('get_customer_history', { customerId })

export const getUnpaidCustomerInvoices = (customerId?: string) =>
  invoke<any[]>('get_unpaid_customer_invoices', { customerId })

export const settleCustomerInvoices = (payload: {
  customer_id: string
  settlements: { invoice_id: string; amount: number }[]
  financial_account_id: string
  notes?: string | null
  user_id?: string | null
}) => invoke<any>('settle_customer_invoices', { payload })

// ─── Repairs ────────────────────────────────────────────────────
export const getRepairJobs = (params?: { status?: string; search?: string; date_from?: string; date_to?: string }) =>
  invoke<any[]>('get_repair_jobs', params)

export const createRepairJob = (payload: any) =>
  invoke<any>('create_repair_job', { payload })

export const updateRepairStatus = (id: string, status: string, technician_notes?: string, amount_paid?: number, labor_cost?: number, financial_account_id?: string) =>
  invoke<void>('update_repair_status', { id, status, technicianNotes: technician_notes, amountPaid: amount_paid, laborCost: labor_cost, financialAccountId: financial_account_id })

export const addRepairPart = (payload: any) =>
  invoke<void>('add_repair_part', { payload })

// ─── Monetary ───────────────────────────────────────────────────
export const getMonetaryServiceTypes = () =>
  invoke<any[]>('get_monetary_service_types')

export const createMonetaryTransaction = (payload: any) =>
  invoke<any>('create_monetary_transaction', { payload })

export const getMonetaryTransactions = (params?: any) =>
  invoke<any[]>('get_monetary_transactions', params)

export const getMonetarySummary = (params?: { date_from?: string; date_to?: string }) =>
  invoke<any>('get_monetary_summary', params)

// ─── Accounting ─────────────────────────────────────────────────
export const getExpenseCategories = () => invoke<any[]>('get_expense_categories')
export const getExpenses = (params?: any) => invoke<any[]>('get_expenses', params)
export const createExpense = (payload: any) => invoke<any>('create_expense', { payload })
export const updateExpense = (payload: any) => invoke<void>('update_expense', { payload })
export const deleteExpense = (id: string, userId?: string, username?: string) =>
  invoke<void>('delete_expense', { id, userId, username })
export const getProfitLoss = (dateFrom: string, dateTo: string) =>
  invoke<any>('get_profit_loss', { dateFrom, dateTo })

export const getLedger = (dateFrom: string, dateTo: string, categoryFilter?: string) =>
  invoke<any[]>('get_ledger', { dateFrom, dateTo, categoryFilter: categoryFilter || 'all' })

export const getShareholderLedger = (shareholderId?: string, dateFrom?: string, dateTo?: string) =>
  invoke<any[]>('get_shareholder_ledger', { shareholderId, dateFrom, dateTo })

export const getFinancialAccounts = () => invoke<any[]>('get_financial_accounts')
export const createFinancialAccount = (payload: any) => invoke<any>('create_financial_account', { payload })
export const deleteFinancialAccount = (id: string, targetAccountId: string) => invoke<void>('delete_financial_account', { id, targetAccountId })
export const transferFinancialAmount = (payload: any) => invoke<void>('transfer_financial_amount', { payload })
export const adjustFinancialAccountBalance = (payload: { financial_account_id: string; new_balance: number; reason?: string; user_id?: string; username: string }) =>
  invoke<void>('adjust_financial_account_balance', { payload })
export const getBeginningBalance = (dateFrom: string) => invoke<number>('get_beginning_balance', { dateFrom })

// ─── Fixed Assets & Depreciation ────────────────────────────────
export const getFixedAssets = () => invoke<any[]>('get_fixed_assets')
export const createFixedAsset = (payload: any) => invoke<any>('create_fixed_asset', { payload })
export const recordDepreciation = (payload: any) => invoke<void>('record_depreciation', { payload })
export const deleteFixedAsset = (id: string) => invoke<void>('delete_fixed_asset', { id })

// ─── Physical Inventory & Cash Audits ───────────────────────────
export const createInventoryAudit = (payload: any) => invoke<any>('create_inventory_audit', { payload })
export const getInventoryAudits = () => invoke<any[]>('get_inventory_audits')
export const createCashAudit = (payload: any) => invoke<any>('create_cash_audit', { payload })
export const getCashAudits = () => invoke<any[]>('get_cash_audits')

// ─── Accrued Expenses ───────────────────────────────────────────
export const getAccruedExpenses = (status?: string) => invoke<any[]>('get_accrued_expenses', { status })
export const createAccruedExpense = (payload: any) => invoke<any>('create_accrued_expense', { payload })
export const payAccruedExpense = (payload: any) => invoke<void>('pay_accrued_expense', { payload })
export const deleteAccruedExpense = (id: string) => invoke<void>('delete_accrued_expense', { id })

// ─── Customer Advances & Payments ───────────────────────────────
export const createCustomerAdvance = (payload: any) => invoke<any>('create_customer_advance', { payload })
export const getCustomerAdvances = (customerId?: string) => invoke<any[]>('get_customer_advances', { customerId })
export const recordCustomerPayment = (payload: any) => invoke<void>('record_customer_payment', { payload })

// ─── Unified Liabilities & Obligations ───────────────────────────
export interface Liability {
  id: string
  title: string
  amount: number
  paid_amount: number
  remaining_amount: number
  creditor_name: string
  debit_counterpart_type: string
  debit_account_id?: string | null
  due_date: string
  status: string
  notes?: string | null
  created_by?: string | null
  created_at: string
}

export interface LiabilityLedgerEntry {
  id: string
  tx_date: string
  entry_type: string
  description: string
  credit_amount: number
  debit_amount: number
  balance_after: number
  account_name?: string | null
  notes?: string | null
}

export const getLiabilities = (status?: string) =>
  invoke<Liability[]>('get_liabilities', { status })

export const createLiability = (payload: {
  title: string
  amount: number
  creditor_name: string
  debit_counterpart_type: string
  debit_account_id?: string | null
  due_date: string
  notes?: string | null
  created_by?: string | null
}) => invoke<Liability>('create_liability', { payload })

export const payLiability = (payload: {
  liability_id: string
  amount: number
  financial_account_id: string
  notes?: string | null
  paid_by?: string | null
}) => invoke<void>('pay_liability', { payload })

export const deleteLiability = (id: string) =>
  invoke<void>('delete_liability', { id })

export const getLiabilityLedger = (liabilityId: string) =>
  invoke<LiabilityLedgerEntry[]>('get_liability_ledger', { liability_id: liabilityId, liabilityId })

// ─── Shareholders & Profit Distribution ─────────────────────────
export const getShareholders = () => invoke<any[]>('get_shareholders')
export const createShareholder = (payload: any) => invoke<any>('create_shareholder', { payload })
export const createEquityTransaction = (payload: any) => invoke<void>('create_equity_transaction', { payload })
export const getEquityTransactions = (shareholderId?: string) => invoke<any[]>('get_equity_transactions', { shareholderId })
export const calculateProfitDistribution = (dateFrom: string, dateTo: string, method?: string) =>
  invoke<any>('calculate_profit_distribution', { dateFrom, dateTo, method })

export interface FinancialAccount {
  id: string
  name_ar: string
  name_en?: string | null
  is_active: boolean
  created_at: string
  balance: number
  limit_type?: string
  min_balance_limit?: number | null
  max_balance_limit?: number | null
  debit_limit_amount?: number | null
  debit_limit_days?: number | null
  debit_limit_start_date?: string | null
  debit_limit_end_date?: string | null
  warning_threshold_pct?: number
  current_period_debit?: number
  days_remaining_in_period?: number
  alert_status: string
  alert_message?: string
  monthly_inflow: number
  monthly_outflow: number
  net_monthly_flow: number
}

// ─── Balance Sheet & Alerts & Detailed Metrics ───────────────────
export const getBalanceSheet = (asOfDate?: string) =>
  invoke<any>('get_balance_sheet', { targetDate: asOfDate, target_date: asOfDate, asOfDate })
export const updateFinancialAccountLimits = (payload: any) => invoke<void>('update_financial_account_limits', { payload })
export const getAccountAlerts = () => invoke<any[]>('get_account_alerts')
export const getSalesDetailedMetrics = () => invoke<any>('get_sales_detailed_metrics')
export const getCashMovementsReport = (params: { dateFrom: string; dateTo: string; accountId?: string }) =>
  invoke<any>('get_cash_movements_report', {
    date_from: params.dateFrom,
    dateFrom: params.dateFrom,
    date_to: params.dateTo,
    dateTo: params.dateTo,
    account_id: params.accountId || null,
    accountId: params.accountId || null
  })
export const processSalePartialReturn = (payload: any) => invoke<void>('process_sale_partial_return', { payload })
export const processSaleReturn = (payload: any) => invoke<void>('process_sale_partial_return', { payload })

// ─── Settings & Dashboard ───────────────────────────────────────
export interface NotificationRule {
  id: string
  rule_key: string
  name_ar: string
  description?: string | null
  is_enabled: boolean
  severity: 'low' | 'medium' | 'high'
  amount_threshold?: number | null
  threshold_type?: 'total' | 'single' | null
  updated_at: string
}

export const getSettings = () => invoke<any[]>('get_settings')
export const setSetting = (key: string, value: string) =>
  invoke<void>('set_setting', { key, value })

export const getNotificationRules = () => invoke<NotificationRule[]>('get_notification_rules')
export const updateNotificationRule = (payload: {
  rule_key: string
  is_enabled: boolean
  severity: string
  amount_threshold?: number | null
  threshold_type?: string | null
}) => invoke<void>('update_notification_rule', { payload })

export const getDashboardStats = () => invoke<any>('get_dashboard_stats')

export const getStockMovements = (productId?: string) =>
  invoke<any[]>('get_stock_movements', { productId })

// ─── Suppliers & Mappings ───────────────────────────────────────
export const getSuppliers = () => invoke<any[]>('get_suppliers')
export const createSupplier = (payload: any) => invoke<any>('create_supplier', { payload })
export const updateSupplier = (id: string, payload: any) => invoke<void>('update_supplier', { id, payload })
export const getPurchaseOrders = (params?: { supplierId?: string; date_from?: string; date_to?: string }) =>
  invoke<any[]>('get_purchase_orders', params)
export const createPurchaseOrder = (payload: any) => invoke<any>('create_purchase_order', { payload })
export const receivePurchaseOrder = (payload: any) => invoke<void>('receive_purchase_order', { payload })
export const getPurchaseOrderItems = (poId: string) => invoke<any[]>('get_purchase_order_items', { poId })
export const recordPurchaseInvoice = (payload: any) => invoke<any>('record_purchase_invoice', { payload })
export const recordPurchaseReturn = (payload: any) => invoke<any>('record_purchase_return', { payload })
export const getPurchaseReturns = (supplierId?: string) => invoke<any[]>('get_purchase_returns', { supplierId })

export const getUnpaidSupplierInvoices = (supplierId?: string) =>
  invoke<any[]>('get_unpaid_supplier_invoices', { supplierId })

export const settleSupplierInvoices = (payload: {
  supplier_id: string
  settlements: { invoice_id: string; amount: number }[]
  financial_account_id: string
  notes?: string | null
  user_id?: string | null
}) => invoke<any>('settle_supplier_invoices', { payload })

// ── Permissions & OTP Password Reset ──
export const updateUserPermissions = (payload: {
  user_id: string
  display_name: string
  role: string
  is_active: boolean
  phone?: string | null
  permissions: string[]
  new_password?: string | null
  job_title?: string | null
}) => invoke<void>('update_user_permissions', { payload })

export const requestWhatsappOtp = (username: string) =>
  invoke<{ username: string; phone: string; otp_code: string; whatsapp_url: string; expires_at: string }>(
    'request_whatsapp_otp',
    { username }
  )

export const verifyOtpAndResetPassword = (payload: {
  username: string
  otp_code: string
  new_password: string
}) => invoke<void>('verify_otp_and_reset_password', { payload })

// ── Notifications ──
export interface SystemNotification {
  id: string
  user_id?: string | null
  user_name: string
  action_type: string
  title: string
  details?: string | null
  is_read: boolean
  created_at: string
}

export const getSystemNotifications = (limit?: number, unreadOnly?: boolean) =>
  invoke<SystemNotification[]>('get_system_notifications', { limit, unreadOnly })

export const markNotificationAsRead = (id: string) =>
  invoke<void>('mark_notification_as_read', { id })

export const markAllNotificationsAsRead = () =>
  invoke<void>('mark_all_notifications_as_read')

// ── Damaged Goods ──
export interface DamagedGoodItem {
  id: string
  product_id: string
  product_name: string
  qty: number
  unit_cost: number
  total_cost: number
  reason?: string | null
  user_name?: string | null
  created_at: string
}

export const recordDamagedGoods = (payload: {
  product_id: string
  qty: number
  reason?: string | null
  user_id?: string | null
}) => invoke<DamagedGoodItem>('record_damaged_goods', { payload })

export const getDamagedGoods = (dateFrom?: string, dateTo?: string) =>
  invoke<DamagedGoodItem[]>('get_damaged_goods', { dateFrom, dateTo })





