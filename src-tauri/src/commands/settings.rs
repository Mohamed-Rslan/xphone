use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Vec<Setting>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
    let settings = stmt.query_map([], |r| Ok(Setting { key: r.get(0)?, value: r.get(1)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(settings)
}

#[tauri::command]
pub async fn set_setting(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1,?2,datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationRule {
    pub id: String,
    pub rule_key: String,
    pub name_ar: String,
    pub description: Option<String>,
    pub is_enabled: bool,
    pub severity: String, // "low" | "medium" | "high"
    pub amount_threshold: Option<f64>,
    pub threshold_type: Option<String>, // "total" | "single"
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNotificationRulePayload {
    pub rule_key: String,
    pub is_enabled: bool,
    pub severity: String,
    pub amount_threshold: Option<f64>,
    pub threshold_type: Option<String>,
}

#[tauri::command]
pub async fn get_notification_rules(
    state: State<'_, AppState>,
) -> Result<Vec<NotificationRule>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, rule_key, name_ar, description, is_enabled, severity, amount_threshold, threshold_type, updated_at
         FROM notification_rules ORDER BY rule_key"
    )?;

    let rules = stmt.query_map([], |r| {
        Ok(NotificationRule {
            id: r.get(0)?,
            rule_key: r.get(1)?,
            name_ar: r.get(2)?,
            description: r.get(3)?,
            is_enabled: r.get::<_, i32>(4)? != 0,
            severity: r.get(5)?,
            amount_threshold: r.get(6)?,
            threshold_type: r.get(7)?,
            updated_at: r.get(8)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(rules)
}

#[tauri::command]
pub async fn update_notification_rule(
    state: State<'_, AppState>,
    payload: UpdateNotificationRulePayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute(
        "UPDATE notification_rules
         SET is_enabled = ?2, severity = ?3, amount_threshold = ?4, threshold_type = ?5, updated_at = datetime('now')
         WHERE rule_key = ?1",
        rusqlite::params![
            payload.rule_key,
            if payload.is_enabled { 1 } else { 0 },
            payload.severity,
            payload.amount_threshold,
            payload.threshold_type
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn get_dashboard_stats(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let conn = state.pool.get()?;

    let today_sales: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total),0) FROM sales WHERE date(created_at)=date('now') AND status!='returned'",
        [], |r| r.get(0),
    )?;

    let today_transactions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sales WHERE date(created_at)=date('now') AND status!='returned'",
        [], |r| r.get(0),
    )?;

    let month_revenue: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total),0) FROM sales WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now') AND status!='returned'",
        [], |r| r.get(0),
    )?;

    let low_stock_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM products WHERE stock_qty <= reorder_level AND is_active=1",
        [], |r| r.get(0),
    )?;

    let pending_repairs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM repair_jobs WHERE status IN ('received','in_progress')",
        [], |r| r.get(0),
    )?;

    let month_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE strftime('%Y-%m',expense_date)=strftime('%Y-%m','now')",
        [], |r| r.get(0),
    )?;

    let month_monetary_profit: f64 = conn.query_row(
        "SELECT COALESCE(SUM(commission),0) FROM monetary_transactions WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')",
        [], |r| r.get(0),
    )?;

    Ok(serde_json::json!({
        "today_sales": today_sales,
        "today_transactions": today_transactions,
        "month_revenue": month_revenue,
        "month_expenses": month_expenses,
        "month_monetary_profit": month_monetary_profit,
        "low_stock_count": low_stock_count,
        "pending_repairs": pending_repairs,
    }))
}
