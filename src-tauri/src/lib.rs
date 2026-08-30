mod commands;
mod db;
mod error;
mod state;

use commands::*;
use db::connection::init_pool;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("xphone.db");

            let pool = init_pool(&db_path).expect("Failed to initialize database");
            app.manage(AppState::new(pool));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth::login,
            auth::logout,
            auth::get_users,
            auth::create_user,
            auth::update_user_permissions,
            auth::request_whatsapp_otp,
            auth::verify_otp_and_reset_password,
            // Products / Inventory
            products::get_products,
            products::create_product,
            products::update_product,
            products::delete_product,
            products::get_brands,
            products::get_categories,
            products::get_low_stock_products,
            products::get_stock_movements,
            // Sales / POS
            sales::create_sale,
            sales::get_sales,
            sales::get_sale,
            sales::get_daily_summary,
            sales::get_detailed_sale_items_report,
            sales::process_sale_partial_return,
            // Customers
            customers::get_customers,
            customers::create_customer,
            customers::update_customer,
            customers::get_customer_history,
            customers::get_unpaid_customer_invoices,
            customers::settle_customer_invoices,
            // Repairs
            repairs::get_repair_jobs,
            repairs::create_repair_job,
            repairs::update_repair_status,
            repairs::add_repair_part,
            // Monetary Services
            monetary::get_monetary_service_types,
            monetary::create_monetary_transaction,
            monetary::get_monetary_transactions,
            monetary::get_monetary_summary,
            // Accounting & Standards
            accounting::get_expense_categories,
            accounting::get_expenses,
            accounting::create_expense,
            accounting::update_expense,
            accounting::delete_expense,
            accounting::get_profit_loss,
            accounting::get_ledger,
            accounting::get_shareholder_ledger,
            accounting::get_financial_accounts,
            accounting::create_financial_account,
            accounting::delete_financial_account,
            accounting::update_financial_account_limits,
            accounting::adjust_financial_account_balance,
            accounting::get_account_alerts,
            accounting::transfer_financial_amount,
            accounting::get_beginning_balance,
            accounting::get_fixed_assets,
            accounting::create_fixed_asset,
            accounting::record_depreciation,
            accounting::delete_fixed_asset,
            accounting::record_damaged_goods,
            accounting::get_damaged_goods,
            accounting::create_inventory_audit,
            accounting::get_inventory_audits,
            accounting::create_cash_audit,
            accounting::get_cash_audits,
            accounting::get_accrued_expenses,
            accounting::create_accrued_expense,
            accounting::pay_accrued_expense,
            accounting::delete_accrued_expense,
            accounting::create_customer_advance,
            accounting::get_customer_advances,
            accounting::record_customer_payment,
            accounting::get_shareholders,
            accounting::create_shareholder,
            accounting::create_equity_transaction,
            accounting::get_equity_transactions,
            accounting::calculate_profit_distribution,
            accounting::update_financial_account_limits,
            accounting::get_account_alerts,
            accounting::get_balance_sheet,
            accounting::get_sales_detailed_metrics,
            accounting::get_cash_movements_report,
            // Settings & Dashboard
            settings::get_settings,
            settings::set_setting,
            settings::get_dashboard_stats,
            // Suppliers
            suppliers::get_suppliers,
            suppliers::create_supplier,
            suppliers::update_supplier,
            suppliers::get_purchase_orders,
            suppliers::create_purchase_order,
            suppliers::receive_purchase_order,
            suppliers::get_purchase_order_items,
            suppliers::record_purchase_invoice,
            suppliers::record_purchase_return,
            suppliers::get_purchase_returns,
            suppliers::get_unpaid_supplier_invoices,
            suppliers::settle_supplier_invoices,
            // System / Export
            system::save_excel_file,
            // Notifications
            notifications::get_system_notifications,
            notifications::mark_notification_as_read,
            notifications::mark_all_notifications_as_read,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
