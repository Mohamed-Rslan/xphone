use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use chrono::{Utc, Datelike};

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPENSES & CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Expense {
    pub id: String,
    pub category_id: i64,
    pub category_name: String,
    pub amount: f64,
    pub description: Option<String>,
    pub is_recurring: bool,
    pub recurrence: Option<String>,
    pub expense_date: String,
    pub financial_account_id: Option<String>,
    pub financial_account_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExpenseCategory {
    pub id: i64,
    pub name_ar: String,
    pub name_en: String,
}

#[derive(Debug, Deserialize)]
pub struct ExpensePayload {
    pub category_id: i64,
    pub amount: f64,
    pub description: Option<String>,
    pub is_recurring: bool,
    pub recurrence: Option<String>,
    pub expense_date: String,
    pub user_id: Option<String>,
    pub financial_account_id: Option<String>,
}

#[tauri::command]
pub async fn get_expense_categories(
    state: State<'_, AppState>,
) -> Result<Vec<ExpenseCategory>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare("SELECT id, name_ar, name_en FROM expense_categories WHERE is_active=1 ORDER BY id")?;
    let cats = stmt.query_map([], |r| Ok(ExpenseCategory { id: r.get(0)?, name_ar: r.get(1)?, name_en: r.get(2)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(cats)
}

#[tauri::command]
pub async fn get_expenses(
    state: State<'_, AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
    category_id: Option<i64>,
) -> Result<Vec<Expense>, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref df) = date_from { conditions.push(format!("e.expense_date >= '{}'", df)); }
    if let Some(ref dt) = date_to { conditions.push(format!("e.expense_date <= '{}'", dt)); }
    if let Some(cid) = category_id { conditions.push(format!("e.category_id = {}", cid)); }

    let sql = format!(
        "SELECT e.id, e.category_id, ec.name_ar, e.amount, e.description,
                e.is_recurring, e.recurrence, e.expense_date, e.financial_account_id,
                fa.name_ar, e.created_at
         FROM expenses e
         JOIN expense_categories ec ON e.category_id = ec.id
         LEFT JOIN financial_accounts fa ON e.financial_account_id = fa.id
         WHERE {} ORDER BY e.expense_date DESC, e.created_at DESC",
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let expenses = stmt.query_map([], |r| {
        Ok(Expense {
            id: r.get(0)?, category_id: r.get(1)?, category_name: r.get(2)?,
            amount: r.get(3)?, description: r.get(4)?, is_recurring: r.get::<_, i64>(5)? == 1,
            recurrence: r.get(6)?, expense_date: r.get(7)?, financial_account_id: r.get(8)?,
            financial_account_name: r.get(9)?, created_at: r.get(10)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(expenses)
}

#[tauri::command]
pub async fn create_expense(
    state: State<'_, AppState>,
    payload: ExpensePayload,
) -> Result<Expense, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let acc_id = payload.financial_account_id.unwrap_or_else(|| "cash_drawer".to_string());

    conn.execute(
        "INSERT INTO expenses (id,category_id,amount,description,is_recurring,recurrence,expense_date,created_by,created_at,financial_account_id)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        rusqlite::params![
            id, payload.category_id, payload.amount, payload.description,
            if payload.is_recurring { 1 } else { 0 }, payload.recurrence, payload.expense_date,
            payload.user_id, now, acc_id
        ],
    )?;

    let cat_name: String = conn.query_row(
        "SELECT name_ar FROM expense_categories WHERE id=?1",
        rusqlite::params![payload.category_id], |r| r.get(0),
    ).unwrap_or_else(|_| "مصروف".to_string());

    let acc_name: Option<String> = conn.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id=?1",
        rusqlite::params![acc_id], |r| r.get(0),
    ).ok();

    Ok(Expense {
        id, category_id: payload.category_id, category_name: cat_name,
        amount: payload.amount, description: payload.description,
        is_recurring: payload.is_recurring, recurrence: payload.recurrence,
        expense_date: payload.expense_date, financial_account_id: Some(acc_id),
        financial_account_name: acc_name, created_at: now,
    })
}

#[derive(Debug, Deserialize)]
pub struct UpdateExpensePayload {
    pub id: String,
    pub category_id: i64,
    pub amount: f64,
    pub description: Option<String>,
    pub is_recurring: bool,
    pub recurrence: Option<String>,
    pub expense_date: String,
    pub financial_account_id: Option<String>,
    pub user_id: Option<String>,
    pub username: Option<String>,
}

#[tauri::command]
pub async fn update_expense(
    state: State<'_, AppState>,
    payload: UpdateExpensePayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let acc_id = payload.financial_account_id.unwrap_or_else(|| "cash_drawer".to_string());

    let old_info: Option<(f64, String)> = conn.query_row(
        "SELECT amount, COALESCE(description, '') FROM expenses WHERE id=?1",
        rusqlite::params![payload.id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).ok();

    conn.execute(
        "UPDATE expenses SET category_id=?1, amount=?2, description=?3, is_recurring=?4, recurrence=?5, expense_date=?6, financial_account_id=?7 WHERE id=?8",
        rusqlite::params![
            payload.category_id, payload.amount, payload.description,
            if payload.is_recurring { 1 } else { 0 }, payload.recurrence, payload.expense_date,
            acc_id, payload.id
        ],
    )?;

    if let Some(ref uid) = payload.user_id {
        let user_display: String = conn.query_row(
            "SELECT display_name FROM users WHERE id=?1",
            rusqlite::params![uid],
            |r| r.get(0),
        ).unwrap_or_else(|_| payload.username.clone().unwrap_or_else(|| "موظف".to_string()));

        let old_amt = old_info.as_ref().map(|(a, _)| *a).unwrap_or(0.0);
        let title = format!("تعديل مصروف بقيمة {:.2} ج.م", payload.amount);
        let details = format!(
            "قام المستخدم ({}) بتعديل بيانات مصروف من مبلغ {:.2} ج.م إلى {:.2} ج.م. البيان: {}",
            user_display, old_amt, payload.amount, payload.description.as_deref().unwrap_or("بدون بيان")
        );
        let _ = crate::commands::notifications::log_system_notification(
            &conn,
            Some(uid.as_str()),
            &user_display,
            "expense_updated",
            &title,
            Some(&details),
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_expense(
    state: State<'_, AppState>,
    id: String,
    user_id: Option<String>,
    username: Option<String>,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;

    let exp_info: Option<(f64, String)> = conn.query_row(
        "SELECT amount, COALESCE(description, '') FROM expenses WHERE id=?1",
        rusqlite::params![id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).ok();

    conn.execute("DELETE FROM expenses WHERE id=?1", rusqlite::params![id])?;

    if let Some(ref uid) = user_id {
        let user_display: String = conn.query_row(
            "SELECT display_name FROM users WHERE id=?1",
            rusqlite::params![uid],
            |r| r.get(0),
        ).unwrap_or_else(|_| username.unwrap_or_else(|| "موظف".to_string()));

        let amt = exp_info.as_ref().map(|(a, _)| *a).unwrap_or(0.0);
        let desc = exp_info.as_ref().map(|(_, d)| d.clone()).unwrap_or_default();
        let title = format!("حذف مصروف بقيمة {:.2} ج.م", amt);
        let details = format!(
            "قام المستخدم ({}) بحذف مصروف بقيمة {:.2} ج.م. البيان: {}",
            user_display, amt, if desc.is_empty() { "بدون بيان" } else { &desc }
        );
        let _ = crate::commands::notifications::log_system_notification(
            &conn,
            Some(uid.as_str()),
            &user_display,
            "expense_deleted",
            &title,
            Some(&details),
        );
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FIXED ASSETS & DEPRECIATION (الأصول الثابتة وإهلاكها)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FixedAsset {
    pub id: String,
    pub name: String,
    pub purchase_date: String,
    pub purchase_cost: f64,
    pub salvage_value: f64,
    pub depreciation_rate: f64,
    pub depreciation_method: String,
    pub accumulated_depreciation: f64,
    pub book_value: f64,
    pub financial_account_id: Option<String>,
    pub financial_account_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateFixedAssetPayload {
    pub name: String,
    pub purchase_date: String,
    pub purchase_cost: f64,
    pub salvage_value: Option<f64>,
    pub depreciation_rate: f64,
    pub financial_account_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordDepreciationPayload {
    pub asset_id: String,
    pub amount: f64,
    pub period_date: String,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn get_fixed_assets(
    state: State<'_, AppState>,
) -> Result<Vec<FixedAsset>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT fa.id, fa.name, fa.purchase_date, fa.purchase_cost, fa.salvage_value,
                fa.depreciation_rate, fa.depreciation_method, fa.accumulated_depreciation,
                fa.financial_account_id, acc.name_ar, fa.notes, fa.created_at
         FROM fixed_assets fa
         LEFT JOIN financial_accounts acc ON fa.financial_account_id = acc.id
         ORDER BY fa.purchase_date DESC"
    )?;
    let assets = stmt.query_map([], |r| {
        let cost: f64 = r.get(3)?;
        let accum: f64 = r.get(7)?;
        let book_val = (cost - accum).max(0.0);
        Ok(FixedAsset {
            id: r.get(0)?, name: r.get(1)?, purchase_date: r.get(2)?,
            purchase_cost: cost, salvage_value: r.get(4)?, depreciation_rate: r.get(5)?,
            depreciation_method: r.get(6)?, accumulated_depreciation: accum,
            book_value: book_val, financial_account_id: r.get(8)?,
            financial_account_name: r.get(9)?, notes: r.get(10)?, created_at: r.get(11)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(assets)
}

#[tauri::command]
pub async fn create_fixed_asset(
    state: State<'_, AppState>,
    payload: CreateFixedAssetPayload,
) -> Result<FixedAsset, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let salvage = payload.salvage_value.unwrap_or(0.0);
    let acc_id = payload.financial_account_id.clone().unwrap_or_else(|| "cash_drawer".to_string());

    conn.execute(
        "INSERT INTO fixed_assets (id, name, purchase_date, purchase_cost, salvage_value, depreciation_rate, depreciation_method, accumulated_depreciation, financial_account_id, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'straight_line', 0, ?7, ?8, ?9)",
        rusqlite::params![
            id, payload.name, payload.purchase_date, payload.purchase_cost,
            salvage, payload.depreciation_rate, acc_id, payload.notes, now
        ],
    )?;

    let acc_name: Option<String> = conn.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id=?1",
        rusqlite::params![acc_id], |r| r.get(0),
    ).ok();

    Ok(FixedAsset {
        id, name: payload.name, purchase_date: payload.purchase_date,
        purchase_cost: payload.purchase_cost, salvage_value: salvage,
        depreciation_rate: payload.depreciation_rate, depreciation_method: "straight_line".to_string(),
        accumulated_depreciation: 0.0, book_value: payload.purchase_cost,
        financial_account_id: Some(acc_id), financial_account_name: acc_name,
        notes: payload.notes, created_at: now,
    })
}

#[tauri::command]
pub async fn record_depreciation(
    state: State<'_, AppState>,
    payload: RecordDepreciationPayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO fixed_asset_depreciations (id, asset_id, amount, period_date, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, payload.asset_id, payload.amount, payload.period_date, payload.notes, now],
    )?;

    conn.execute(
        "UPDATE fixed_assets SET accumulated_depreciation = accumulated_depreciation + ?1 WHERE id = ?2",
        rusqlite::params![payload.amount, payload.asset_id],
    )?;

    Ok(())
}

#[tauri::command]
pub async fn delete_fixed_asset(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute("DELETE FROM fixed_asset_depreciations WHERE asset_id=?1", rusqlite::params![id])?;
    conn.execute("DELETE FROM fixed_assets WHERE id=?1", rusqlite::params![id])?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DAMAGED GOODS / PERISHED STOCK (الهالك والتالف)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DamagedGoodItem {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub qty: f64,
    pub unit_cost: f64,
    pub total_cost: f64,
    pub reason: Option<String>,
    pub user_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct RecordDamagedGoodPayload {
    pub product_id: String,
    pub qty: f64,
    pub reason: Option<String>,
    pub user_id: Option<String>,
}

#[tauri::command]
pub async fn record_damaged_goods(
    state: State<'_, AppState>,
    payload: RecordDamagedGoodPayload,
) -> Result<DamagedGoodItem, AppError> {
    if payload.qty <= 0.0 {
        return Err(AppError::Validation("يجب أن تكون كمية الهالك أكبر من صفر".into()));
    }
    let conn = state.pool.get()?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    let (product_name, unit_cost, current_stock): (String, f64, f64) = conn.query_row(
        "SELECT name_ar, cost_price, CAST(stock_qty AS REAL) FROM products WHERE id=?1",
        rusqlite::params![payload.product_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )?;

    let total_cost = payload.qty * unit_cost;

    // Deduct from product stock
    let new_stock = (current_stock - payload.qty).max(0.0);
    conn.execute(
        "UPDATE products SET stock_qty=?1, updated_at=?2 WHERE id=?3",
        rusqlite::params![new_stock as i64, now, payload.product_id],
    )?;

    let (valid_user_id, user_display_name): (Option<String>, String) = if let Some(ref uid) = payload.user_id {
        conn.query_row(
            "SELECT id, display_name FROM users WHERE id=?1",
            rusqlite::params![uid],
            |r| Ok((Some(r.get(0)?), r.get(1)?)),
        ).unwrap_or((None, "موظف".to_string()))
    } else {
        (None, "موظف".to_string())
    };

    // Log stock movement
    let mv_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, reason, user_id, created_at)
         VALUES (?1, ?2, 'adjustment', ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            mv_id, payload.product_id, -(payload.qty as i64), current_stock as i64,
            new_stock as i64, format!("هالك / تالف: {}", payload.reason.clone().unwrap_or_default()),
            valid_user_id, now
        ],
    )?;

    // Insert into damaged_goods
    conn.execute(
        "INSERT INTO damaged_goods (id, product_id, qty, unit_cost, total_cost, reason, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, payload.product_id, payload.qty, unit_cost, total_cost, payload.reason, valid_user_id, now],
    )?;

    // Log sensitive action notification for Super Admin
    let notif_title = format!("تسجيل بضاعة هالك: {} ({} قطعة)", product_name, payload.qty);
    let notif_details = format!(
        "قام المستخدم {} بتسجيل بضاعة هالك بتكلفة إجمالية {:.2} ج.م. السبب: {}",
        user_display_name, total_cost, payload.reason.as_deref().unwrap_or("بدون سبب")
    );
    let _ = crate::commands::notifications::log_system_notification(
        &conn, valid_user_id.as_deref(), &user_display_name, "inventory_damaged", &notif_title, Some(&notif_details)
    );

    Ok(DamagedGoodItem {
        id, product_id: payload.product_id, product_name,
        qty: payload.qty, unit_cost, total_cost, reason: payload.reason,
        user_name: Some(user_display_name),
        created_at: now,
    })
}

#[tauri::command]
pub async fn get_damaged_goods(
    state: State<'_, AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<DamagedGoodItem>, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref df) = date_from { conditions.push(format!("date(dg.created_at) >= '{}'", df)); }
    if let Some(ref dt) = date_to { conditions.push(format!("date(dg.created_at) <= '{}'", dt)); }

    let sql = format!(
        "SELECT dg.id, dg.product_id, p.name_ar, dg.qty, dg.unit_cost, dg.total_cost, dg.reason, dg.created_at, COALESCE(u.display_name, 'المدير')
         FROM damaged_goods dg
         JOIN products p ON dg.product_id = p.id
         LEFT JOIN users u ON dg.created_by = u.id
         WHERE {} ORDER BY dg.created_at DESC",
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let list = stmt.query_map([], |r| {
        Ok(DamagedGoodItem {
            id: r.get(0)?, product_id: r.get(1)?, product_name: r.get(2)?,
            qty: r.get(3)?, unit_cost: r.get(4)?, total_cost: r.get(5)?,
            reason: r.get(6)?, created_at: r.get(7)?, user_name: r.get(8)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(list)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PHYSICAL INVENTORY AUDIT / RECONCILIATION (جرد المخزون المقارن)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InventoryAuditItemSummary {
    pub product_id: String,
    pub product_name: String,
    pub system_qty: f64,
    pub actual_qty: f64,
    pub variance_qty: f64,
    pub unit_cost: f64,
    pub variance_cost: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InventoryAuditSummary {
    pub id: String,
    pub title: String,
    pub audit_date: String,
    pub notes: Option<String>,
    pub total_system_qty: f64,
    pub total_actual_qty: f64,
    pub total_variance_qty: f64,
    pub total_variance_cost: f64,
    pub items_count: i64,
    pub created_at: String,
    pub items: Vec<InventoryAuditItemSummary>,
}

#[derive(Debug, Deserialize)]
pub struct AuditItemInput {
    pub product_id: String,
    pub actual_qty: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAuditPayload {
    pub title: String,
    pub notes: Option<String>,
    pub items: Vec<AuditItemInput>,
    pub user_id: Option<String>,
}

#[tauri::command]
pub async fn create_inventory_audit(
    state: State<'_, AppState>,
    payload: CreateAuditPayload,
) -> Result<InventoryAuditSummary, AppError> {
    let mut conn = state.pool.get()?;
    let tx = conn.transaction()?;
    let audit_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let mut total_sys = 0.0;
    let mut total_act = 0.0;
    let mut total_var_qty = 0.0;
    let mut total_var_cost = 0.0;
    let mut audit_items = Vec::new();

    // 1. Calculate and prepare items
    for item in &payload.items {
        let (name_ar, sys_qty, unit_cost): (String, f64, f64) = tx.query_row(
            "SELECT name_ar, CAST(stock_qty AS REAL), cost_price FROM products WHERE id=?1",
            rusqlite::params![item.product_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        ).unwrap_or(("غير معروف".to_string(), 0.0, 0.0));

        let variance_qty = item.actual_qty - sys_qty;
        let variance_cost = variance_qty * unit_cost;

        total_sys += sys_qty;
        total_act += item.actual_qty;
        total_var_qty += variance_qty;
        total_var_cost += variance_cost;

        audit_items.push(InventoryAuditItemSummary {
            product_id: item.product_id.clone(),
            product_name: name_ar,
            system_qty: sys_qty,
            actual_qty: item.actual_qty,
            variance_qty,
            unit_cost,
            variance_cost,
            notes: item.notes.clone(),
        });
    }

    // Check user_id existence for FK safety
    let valid_user_id: Option<String> = if let Some(ref uid) = payload.user_id {
        let exists: i64 = tx.query_row(
            "SELECT COUNT(1) FROM users WHERE id=?1",
            rusqlite::params![uid],
            |r| r.get(0),
        ).unwrap_or(0);
        if exists > 0 { Some(uid.clone()) } else { None }
    } else {
        None
    };

    // 2. Insert parent audit record FIRST
    tx.execute(
        "INSERT INTO inventory_audits (id, title, audit_date, notes, total_system_qty, total_actual_qty, total_variance_qty, total_variance_cost, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            audit_id, payload.title, now, payload.notes,
            total_sys, total_act, total_var_qty, total_var_cost,
            valid_user_id, now
        ],
    )?;

    // 3. Insert child items
    for it in &audit_items {
        let item_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO inventory_audit_items (id, audit_id, product_id, system_qty, actual_qty, variance_qty, unit_cost, variance_cost, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                item_id, audit_id, it.product_id, it.system_qty, it.actual_qty,
                it.variance_qty, it.unit_cost, it.variance_cost, it.notes
            ],
        )?;
    }

    tx.commit()?;

    Ok(InventoryAuditSummary {
        id: audit_id,
        title: payload.title,
        audit_date: now.clone(),
        notes: payload.notes,
        total_system_qty: total_sys,
        total_actual_qty: total_act,
        total_variance_qty: total_var_qty,
        total_variance_cost: total_var_cost,
        items_count: audit_items.len() as i64,
        created_at: now,
        items: audit_items,
    })
}

#[tauri::command]
pub async fn get_inventory_audits(
    state: State<'_, AppState>,
) -> Result<Vec<InventoryAuditSummary>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, title, audit_date, notes, total_system_qty, total_actual_qty, total_variance_qty, total_variance_cost, created_at
         FROM inventory_audits ORDER BY created_at DESC"
    )?;
    let audits = stmt.query_map([], |r| {
        let audit_id: String = r.get(0)?;
        Ok((
            audit_id,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, Option<String>>(3)?,
            r.get::<_, f64>(4)?,
            r.get::<_, f64>(5)?,
            r.get::<_, f64>(6)?,
            r.get::<_, f64>(7)?,
            r.get::<_, String>(8)?,
        ))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut result = Vec::new();
    for (id, title, audit_date, notes, total_sys, total_act, total_var_qty, total_var_cost, created_at) in audits {
        let mut items_stmt = conn.prepare(
            "SELECT iai.product_id, p.name_ar, iai.system_qty, iai.actual_qty, iai.variance_qty, iai.unit_cost, iai.variance_cost, iai.notes
             FROM inventory_audit_items iai
             JOIN products p ON iai.product_id = p.id
             WHERE iai.audit_id = ?1"
        )?;
        let items = items_stmt.query_map(rusqlite::params![id], |ir| {
            Ok(InventoryAuditItemSummary {
                product_id: ir.get(0)?,
                product_name: ir.get(1)?,
                system_qty: ir.get(2)?,
                actual_qty: ir.get(3)?,
                variance_qty: ir.get(4)?,
                unit_cost: ir.get(5)?,
                variance_cost: ir.get(6)?,
                notes: ir.get(7)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        result.push(InventoryAuditSummary {
            id, title, audit_date, notes,
            total_system_qty: total_sys,
            total_actual_qty: total_act,
            total_variance_qty: total_var_qty,
            total_variance_cost: total_var_cost,
            items_count: items.len() as i64,
            created_at,
            items,
        });
    }

    Ok(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. CASH & LIQUIDITY AUDITS (جرد ومطابقة النقدية والسيولة)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CashAuditItemInput {
    pub financial_account_id: String,
    pub actual_balance: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCashAuditPayload {
    pub title: String,
    pub notes: Option<String>,
    pub items: Vec<CashAuditItemInput>,
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CashAuditItemSummary {
    pub financial_account_id: String,
    pub account_name: String,
    pub system_balance: f64,
    pub actual_balance: f64,
    pub variance: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CashAuditSummary {
    pub id: String,
    pub title: String,
    pub audit_date: String,
    pub notes: Option<String>,
    pub total_system_balance: f64,
    pub total_actual_balance: f64,
    pub total_variance: f64,
    pub created_by: Option<String>,
    pub items: Vec<CashAuditItemSummary>,
}

#[tauri::command]
pub async fn create_cash_audit(
    state: State<'_, AppState>,
    payload: CreateCashAuditPayload,
) -> Result<CashAuditSummary, AppError> {
    let mut conn = state.pool.get()?;
    let tx = conn.transaction()?;
    let audit_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let mut total_sys = 0.0;
    let mut total_act = 0.0;
    let mut total_var = 0.0;
    let mut audit_items = Vec::new();

    for item in &payload.items {
        let name_ar: String = tx.query_row(
            "SELECT name_ar FROM financial_accounts WHERE id=?1",
            rusqlite::params![item.financial_account_id],
            |r| r.get(0),
        ).unwrap_or_else(|_| "حساب مالي".to_string());

        let sys_balance = calculate_account_balance(&tx, &item.financial_account_id)?;
        let variance = item.actual_balance - sys_balance;

        total_sys += sys_balance;
        total_act += item.actual_balance;
        total_var += variance;

        audit_items.push(CashAuditItemSummary {
            financial_account_id: item.financial_account_id.clone(),
            account_name: name_ar,
            system_balance: sys_balance,
            actual_balance: item.actual_balance,
            variance,
            notes: item.notes.clone(),
        });
    }

    let valid_user_id: Option<String> = if let Some(ref uid) = payload.user_id {
        let exists: i64 = tx.query_row(
            "SELECT COUNT(1) FROM users WHERE id=?1",
            rusqlite::params![uid],
            |r| r.get(0),
        ).unwrap_or(0);
        if exists > 0 { Some(uid.clone()) } else { None }
    } else {
        None
    };

    tx.execute(
        "INSERT INTO cash_audits (id, title, audit_date, notes, total_system_balance, total_actual_balance, total_variance, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            audit_id, payload.title, now, payload.notes,
            total_sys, total_act, total_var,
            valid_user_id, now
        ],
    )?;

    for it in &audit_items {
        let item_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO cash_audit_items (id, audit_id, financial_account_id, account_name, system_balance, actual_balance, variance, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                item_id, audit_id, it.financial_account_id, it.account_name,
                it.system_balance, it.actual_balance, it.variance, it.notes
            ],
        )?;
    }

    tx.commit()?;

    Ok(CashAuditSummary {
        id: audit_id,
        title: payload.title,
        audit_date: now,
        notes: payload.notes,
        total_system_balance: total_sys,
        total_actual_balance: total_act,
        total_variance: total_var,
        created_by: valid_user_id,
        items: audit_items,
    })
}

#[tauri::command]
pub async fn get_cash_audits(
    state: State<'_, AppState>,
) -> Result<Vec<CashAuditSummary>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, title, audit_date, notes, total_system_balance, total_actual_balance, total_variance, created_by
         FROM cash_audits ORDER BY audit_date DESC LIMIT 50"
    )?;

    let audits_meta = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, Option<String>>(3)?,
            r.get::<_, f64>(4)?,
            r.get::<_, f64>(5)?,
            r.get::<_, f64>(6)?,
            r.get::<_, Option<String>>(7)?,
        ))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut result = Vec::new();
    let mut item_stmt = conn.prepare(
        "SELECT financial_account_id, account_name, system_balance, actual_balance, variance, notes
         FROM cash_audit_items WHERE audit_id = ?1"
    )?;

    for (id, title, audit_date, notes, total_system_balance, total_actual_balance, total_variance, created_by) in audits_meta {
        let items = item_stmt.query_map(rusqlite::params![id], |r| {
            Ok(CashAuditItemSummary {
                financial_account_id: r.get(0)?,
                account_name: r.get(1)?,
                system_balance: r.get(2)?,
                actual_balance: r.get(3)?,
                variance: r.get(4)?,
                notes: r.get(5)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        result.push(CashAuditSummary {
            id, title, audit_date, notes,
            total_system_balance, total_actual_balance, total_variance,
            created_by, items,
        });
    }

    Ok(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ACCRUED EXPENSES (مصروفات واجبة السداد / مستحقة)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccruedExpense {
    pub id: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub title: String,
    pub amount: f64,
    pub due_date: Option<String>,
    pub status: String,
    pub paid_at: Option<String>,
    pub financial_account_id: Option<String>,
    pub financial_account_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccruedExpensePayload {
    pub category_id: Option<i64>,
    pub title: String,
    pub amount: f64,
    pub due_date: Option<String>,
    pub notes: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PayAccruedExpensePayload {
    pub id: String,
    pub financial_account_id: String,
    pub user_id: Option<String>,
}

#[tauri::command]
pub async fn get_accrued_expenses(
    state: State<'_, AppState>,
    status: Option<String>,
) -> Result<Vec<AccruedExpense>, AppError> {
    let conn = state.pool.get()?;
    let cond = if let Some(ref s) = status {
        format!("WHERE ae.status = '{}'", s)
    } else {
        "".to_string()
    };
    let sql = format!(
        "SELECT ae.id, ae.category_id, ec.name_ar, ae.title, ae.amount, ae.due_date,
                ae.status, ae.paid_at, ae.financial_account_id, fa.name_ar, ae.notes, ae.created_at
         FROM accrued_expenses ae
         LEFT JOIN expense_categories ec ON ae.category_id = ec.id
         LEFT JOIN financial_accounts fa ON ae.financial_account_id = fa.id
         {} ORDER BY ae.created_at DESC",
        cond
    );
    let mut stmt = conn.prepare(&sql)?;
    let list = stmt.query_map([], |r| {
        Ok(AccruedExpense {
            id: r.get(0)?, category_id: r.get(1)?, category_name: r.get(2)?,
            title: r.get(3)?, amount: r.get(4)?, due_date: r.get(5)?,
            status: r.get(6)?, paid_at: r.get(7)?, financial_account_id: r.get(8)?,
            financial_account_name: r.get(9)?, notes: r.get(10)?, created_at: r.get(11)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(list)
}

#[tauri::command]
pub async fn create_accrued_expense(
    state: State<'_, AppState>,
    payload: CreateAccruedExpensePayload,
) -> Result<AccruedExpense, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO accrued_expenses (id, category_id, title, amount, due_date, status, notes, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'unpaid', ?6, ?7, ?8)",
        rusqlite::params![
            id, payload.category_id, payload.title, payload.amount,
            payload.due_date, payload.notes, payload.user_id, now
        ],
    )?;

    let cat_name: Option<String> = if let Some(cid) = payload.category_id {
        conn.query_row("SELECT name_ar FROM expense_categories WHERE id=?1", rusqlite::params![cid], |r| r.get(0)).ok()
    } else {
        None
    };

    Ok(AccruedExpense {
        id, category_id: payload.category_id, category_name: cat_name,
        title: payload.title, amount: payload.amount, due_date: payload.due_date,
        status: "unpaid".to_string(), paid_at: None, financial_account_id: None,
        financial_account_name: None, notes: payload.notes, created_at: now,
    })
}

#[tauri::command]
pub async fn pay_accrued_expense(
    state: State<'_, AppState>,
    payload: PayAccruedExpensePayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE accrued_expenses SET status='paid', paid_at=?1, financial_account_id=?2 WHERE id=?3",
        rusqlite::params![now, payload.financial_account_id, payload.id],
    )?;

    Ok(())
}

#[tauri::command]
pub async fn delete_accrued_expense(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute("DELETE FROM accrued_expenses WHERE id=?1", rusqlite::params![id])?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED LIABILITIES & ACCRUED OBLIGATIONS (نظام الالتزامات والاستحقاقات المالية الموحد)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Liability {
    pub id: String,
    pub title: String,
    pub amount: f64,
    pub paid_amount: f64,
    pub remaining_amount: f64,
    pub creditor_name: String,
    pub debit_counterpart_type: String, // "accrued_expense" | "fixed_asset" | "current_asset" | "cash_advance"
    pub debit_account_id: Option<String>,
    pub due_date: String,
    pub status: String, // "unpaid" | "partially_paid" | "paid"
    pub notes: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateLiabilityPayload {
    pub title: String,
    pub amount: f64,
    pub creditor_name: String,
    pub debit_counterpart_type: String,
    pub debit_account_id: Option<String>,
    pub due_date: String,
    pub notes: Option<String>,
    pub created_by: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PayLiabilityPayload {
    pub liability_id: String,
    pub amount: f64,
    pub financial_account_id: String,
    pub notes: Option<String>,
    pub paid_by: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LiabilityLedgerEntry {
    pub id: String,
    pub tx_date: String,
    pub entry_type: String, // "creation" | "payment"
    pub description: String,
    pub credit_amount: f64,
    pub debit_amount: f64,
    pub balance_after: f64,
    pub account_name: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn get_liabilities(
    state: State<'_, AppState>,
    status: Option<String>,
) -> Result<Vec<Liability>, AppError> {
    let conn = state.pool.get()?;
    let mut sql = "SELECT id, title, amount, paid_amount, creditor_name, debit_counterpart_type, debit_account_id, due_date, status, notes, created_by, created_at FROM liabilities".to_string();
    if let Some(s) = &status {
        if s != "all" {
            sql.push_str(&format!(" WHERE status = '{}'", s));
        }
    }
    sql.push_str(" ORDER BY created_at DESC");

    let mut stmt = conn.prepare(&sql)?;
    let iter = stmt.query_map([], |r| {
        let amount: f64 = r.get(2)?;
        let paid_amount: f64 = r.get(3)?;
        let remaining_amount = (amount - paid_amount).max(0.0);
        Ok(Liability {
            id: r.get(0)?,
            title: r.get(1)?,
            amount,
            paid_amount,
            remaining_amount,
            creditor_name: r.get(4)?,
            debit_counterpart_type: r.get(5)?,
            debit_account_id: r.get(6)?,
            due_date: r.get(7)?,
            status: r.get(8)?,
            notes: r.get(9)?,
            created_by: r.get(10)?,
            created_at: r.get(11)?,
        })
    })?;

    let mut list = Vec::new();
    for item in iter {
        list.push(item?);
    }
    Ok(list)
}

#[tauri::command]
pub async fn create_liability(
    state: State<'_, AppState>,
    payload: CreateLiabilityPayload,
) -> Result<Liability, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO liabilities (id, title, amount, paid_amount, creditor_name, debit_counterpart_type, debit_account_id, due_date, status, notes, created_by, created_at)
         VALUES (?1, ?2, ?3, 0.0, ?4, ?5, ?6, ?7, 'unpaid', ?8, ?9, ?10)",
        rusqlite::params![
            id, payload.title, payload.amount, payload.creditor_name,
            payload.debit_counterpart_type, payload.debit_account_id,
            payload.due_date, payload.notes, payload.created_by, now
        ],
    )?;

    // Log notification
    let _ = crate::commands::notifications::log_system_notification(
        &conn, None, "سجل الالتزامات المالية", "liability_created",
        &format!("نشوء التزام جديد: {}", payload.title),
        Some(&format!("بقيمة {:.2} ج.م للجهة {} (الطرف المدين: {})", payload.amount, payload.creditor_name, payload.debit_counterpart_type))
    );

    Ok(Liability {
        id,
        title: payload.title,
        amount: payload.amount,
        paid_amount: 0.0,
        remaining_amount: payload.amount,
        creditor_name: payload.creditor_name,
        debit_counterpart_type: payload.debit_counterpart_type,
        debit_account_id: payload.debit_account_id,
        due_date: payload.due_date,
        status: "unpaid".to_string(),
        notes: payload.notes,
        created_by: payload.created_by,
        created_at: now,
    })
}

#[tauri::command]
pub async fn pay_liability(
    state: State<'_, AppState>,
    payload: PayLiabilityPayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let now = Utc::now().to_rfc3339();
    let pid = Uuid::new_v4().to_string();

    let (title, amount, paid_amount): (String, f64, f64) = conn.query_row(
        "SELECT title, amount, paid_amount FROM liabilities WHERE id = ?1",
        rusqlite::params![payload.liability_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )?;

    let new_paid = paid_amount + payload.amount;
    let new_status = if new_paid >= amount - 0.001 { "paid" } else { "partially_paid" };

    conn.execute(
        "UPDATE liabilities SET paid_amount = ?1, status = ?2 WHERE id = ?3",
        rusqlite::params![new_paid, new_status, payload.liability_id],
    )?;

    conn.execute(
        "INSERT INTO liability_payments (id, liability_id, amount, financial_account_id, notes, paid_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![pid, payload.liability_id, payload.amount, payload.financial_account_id, payload.notes, payload.paid_by, now],
    )?;

    // Log notification
    let _ = crate::commands::notifications::log_system_notification(
        &conn, None, "سجل الالتزامات المالية", "liability_paid",
        &format!("سداد دفعة للالتزام: {}", title),
        Some(&format!("تم سداد مبلغ {:.2} ج.م (الحالة الجديدة: {})", payload.amount, if new_status == "paid" { "تم السداد بالكامل" } else { "سداد جزئي" }))
    );

    Ok(())
}

#[tauri::command]
pub async fn delete_liability(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute("DELETE FROM liabilities WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

#[tauri::command]
pub async fn get_liability_ledger(
    state: State<'_, AppState>,
    liability_id: String,
) -> Result<Vec<LiabilityLedgerEntry>, AppError> {
    let conn = state.pool.get()?;
    
    let liability = conn.query_row(
        "SELECT title, amount, creditor_name, created_at FROM liabilities WHERE id = ?1",
        rusqlite::params![liability_id],
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?)),
    )?;

    let mut entries = Vec::new();
    let mut current_balance = liability.1; // Credit balance (Debt)

    // Entry 1: Creation of liability
    entries.push(LiabilityLedgerEntry {
        id: format!("init_{}", liability_id),
        tx_date: liability.3,
        entry_type: "creation".to_string(),
        description: format!("نشوء الالتزام: {} للجهة {}", liability.0, liability.2),
        credit_amount: liability.1,
        debit_amount: 0.0,
        balance_after: current_balance,
        account_name: None,
        notes: Some("تسجيل التزام جديد".to_string()),
    });

    // Payments
    let mut stmt = conn.prepare(
        "SELECT lp.id, lp.amount, lp.notes, lp.created_at, fa.name_ar
         FROM liability_payments lp
         LEFT JOIN financial_accounts fa ON fa.id = lp.financial_account_id
         WHERE lp.liability_id = ?1 ORDER BY lp.created_at ASC"
    )?;

    let p_iter = stmt.query_map(rusqlite::params![liability_id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, f64>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, Option<String>>(4)?,
        ))
    })?;

    for p in p_iter {
        let (pid, pamt, pnotes, pdate, fa_name) = p?;
        current_balance = (current_balance - pamt).max(0.0);
        entries.push(LiabilityLedgerEntry {
            id: pid,
            tx_date: pdate,
            entry_type: "payment".to_string(),
            description: format!("سداد دفعة من الحساب ({})", fa_name.as_deref().unwrap_or("حساب نقدي")),
            credit_amount: 0.0,
            debit_amount: pamt,
            balance_after: current_balance,
            account_name: fa_name,
            notes: pnotes,
        });
    }

    Ok(entries)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CUSTOMER ADVANCES & PAYMENTS (الدفعات المقدمة وسداد العملاء)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerAdvance {
    pub id: String,
    pub customer_id: String,
    pub customer_name: String,
    pub amount: f64,
    pub financial_account_id: String,
    pub financial_account_name: String,
    pub status: String,
    pub used_amount: f64,
    pub remaining_amount: f64,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCustomerAdvancePayload {
    pub customer_id: String,
    pub amount: f64,
    pub financial_account_id: String,
    pub notes: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CustomerPaymentPayload {
    pub customer_id: String,
    pub amount: f64,
    pub financial_account_id: String,
    pub notes: Option<String>,
    pub user_id: Option<String>,
}

#[tauri::command]
pub async fn create_customer_advance(
    state: State<'_, AppState>,
    payload: CreateCustomerAdvancePayload,
) -> Result<CustomerAdvance, AppError> {
    if payload.amount <= 0.0 {
        return Err(AppError::Validation("يجب أن يكون المبلغ أكبر من صفر".into()));
    }
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO customer_advances (id, customer_id, amount, financial_account_id, status, used_amount, notes, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, 'active', 0, ?5, ?6, ?7)",
        rusqlite::params![
            id, payload.customer_id, payload.amount, payload.financial_account_id,
            payload.notes, payload.user_id, now
        ],
    )?;

    let cust_name: String = conn.query_row(
        "SELECT name FROM customers WHERE id=?1",
        rusqlite::params![payload.customer_id], |r| r.get(0),
    ).unwrap_or_else(|_| "عميل".to_string());

    let acc_name: String = conn.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id=?1",
        rusqlite::params![payload.financial_account_id], |r| r.get(0),
    ).unwrap_or_else(|_| "خزينة".to_string());

    Ok(CustomerAdvance {
        id, customer_id: payload.customer_id, customer_name: cust_name,
        amount: payload.amount, financial_account_id: payload.financial_account_id,
        financial_account_name: acc_name, status: "active".to_string(),
        used_amount: 0.0, remaining_amount: payload.amount, notes: payload.notes,
        created_at: now,
    })
}

#[tauri::command]
pub async fn get_customer_advances(
    state: State<'_, AppState>,
    customer_id: Option<String>,
) -> Result<Vec<CustomerAdvance>, AppError> {
    let conn = state.pool.get()?;
    let cond = if let Some(ref cid) = customer_id {
        format!("WHERE ca.customer_id = '{}'", cid)
    } else {
        "".to_string()
    };
    let sql = format!(
        "SELECT ca.id, ca.customer_id, c.name, ca.amount, ca.financial_account_id,
                fa.name_ar, ca.status, ca.used_amount, ca.notes, ca.created_at
         FROM customer_advances ca
         JOIN customers c ON ca.customer_id = c.id
         JOIN financial_accounts fa ON ca.financial_account_id = fa.id
         {} ORDER BY ca.created_at DESC",
        cond
    );
    let mut stmt = conn.prepare(&sql)?;
    let list = stmt.query_map([], |r| {
        let amt: f64 = r.get(3)?;
        let used: f64 = r.get(7)?;
        Ok(CustomerAdvance {
            id: r.get(0)?, customer_id: r.get(1)?, customer_name: r.get(2)?,
            amount: amt, financial_account_id: r.get(4)?, financial_account_name: r.get(5)?,
            status: r.get(6)?, used_amount: used, remaining_amount: (amt - used).max(0.0),
            notes: r.get(8)?, created_at: r.get(9)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(list)
}

#[tauri::command]
pub async fn record_customer_payment(
    state: State<'_, AppState>,
    payload: CustomerPaymentPayload,
) -> Result<(), AppError> {
    if payload.amount <= 0.0 {
        return Err(AppError::Validation("يجب أن يكون مبلغ السداد أكبر من صفر".into()));
    }
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO customer_payments (id, customer_id, amount, financial_account_id, notes, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            id, payload.customer_id, payload.amount, payload.financial_account_id,
            payload.notes, payload.user_id, now
        ],
    )?;

    conn.execute(
        "UPDATE customers SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![payload.amount, payload.customer_id],
    )?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SHAREHOLDERS & EQUITY TRANSACTIONS & PROFIT DISTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Shareholder {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub initial_capital: f64,
    pub ownership_percentage: f64,
    pub short_term_balance: f64,
    pub total_equity: f64,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EquityTransaction {
    pub id: String,
    pub shareholder_id: String,
    pub shareholder_name: String,
    pub tx_type: String,
    pub amount: f64,
    pub financial_account_id: Option<String>,
    pub financial_account_name: Option<String>,
    pub counterpart_type: String,
    pub description: Option<String>,
    pub tx_date: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateShareholderPayload {
    pub name: String,
    pub phone: Option<String>,
    pub initial_capital: f64,
    pub ownership_percentage: f64,
    pub financial_account_id: Option<String>,
    pub notes: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EquityTransactionPayload {
    pub shareholder_id: String,
    pub tx_type: String,
    pub amount: f64,
    pub financial_account_id: Option<String>,
    pub counterpart_type: String,
    pub description: Option<String>,
    pub tx_date: String,
    pub user_id: Option<String>,
}

#[tauri::command]
pub async fn get_shareholders(
    state: State<'_, AppState>,
) -> Result<Vec<Shareholder>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, name, phone, initial_capital, ownership_percentage, notes, created_at FROM shareholders ORDER BY name ASC"
    )?;
    let shareholders_base = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, f64>(3)?,
            r.get::<_, f64>(4)?,
            r.get::<_, Option<String>>(5)?,
            r.get::<_, String>(6)?,
        ))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut result = Vec::new();
    for (id, name, phone, initial_cap, pct, notes, created_at) in shareholders_base {
        // Calculate short term balance & additional capital from transactions
        let short_term_in: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE shareholder_id=?1 AND tx_type='short_term_contribution'",
            rusqlite::params![id], |r| r.get(0),
        ).unwrap_or(0.0);

        let short_term_out: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE shareholder_id=?1 AND tx_type='short_term_withdrawal'",
            rusqlite::params![id], |r| r.get(0),
        ).unwrap_or(0.0);

        let cap_increase: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE shareholder_id=?1 AND tx_type='capital_increase'",
            rusqlite::params![id], |r| r.get(0),
        ).unwrap_or(0.0);

        let withdrawals: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE shareholder_id=?1 AND tx_type IN ('withdrawal', 'profit_distribution')",
            rusqlite::params![id], |r| r.get(0),
        ).unwrap_or(0.0);

        let current_cap = initial_cap + cap_increase;
        let short_term = (short_term_in - short_term_out).max(0.0);
        let total_eq = current_cap + short_term - withdrawals;

        result.push(Shareholder {
            id, name, phone, initial_capital: current_cap,
            ownership_percentage: pct, short_term_balance: short_term,
            total_equity: total_eq, notes, created_at,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_shareholder(
    state: State<'_, AppState>,
    payload: CreateShareholderPayload,
) -> Result<Shareholder, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO shareholders (id, name, phone, initial_capital, ownership_percentage, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, payload.name, payload.phone, payload.initial_capital, payload.ownership_percentage, payload.notes, now],
    )?;

    // If initial capital > 0 and financial_account_id is specified, record cash deposit for capital
    if payload.initial_capital > 0.0 && payload.financial_account_id.is_some() {
        let tx_id = Uuid::new_v4().to_string();
        let today_date = Utc::now().format("%Y-%m-%d").to_string();
        let _ = conn.execute(
            "INSERT INTO equity_transactions (id, shareholder_id, tx_type, amount, financial_account_id, counterpart_type, description, tx_date, created_by, created_at)
             VALUES (?1, ?2, 'capital_increase', ?3, ?4, 'cash', 'إيداع رأس المال التأسيسي للأصل/الشريك', ?5, ?6, ?7)",
            rusqlite::params![
                tx_id, id, payload.initial_capital, payload.financial_account_id, today_date, payload.user_id, now
            ],
        );
    }

    Ok(Shareholder {
        id, name: payload.name, phone: payload.phone,
        initial_capital: payload.initial_capital,
        ownership_percentage: payload.ownership_percentage,
        short_term_balance: 0.0, total_equity: payload.initial_capital,
        notes: payload.notes, created_at: now,
    })
}

#[tauri::command]
pub async fn create_equity_transaction(
    state: State<'_, AppState>,
    payload: EquityTransactionPayload,
) -> Result<(), AppError> {
    if payload.amount <= 0.0 {
        return Err(AppError::Validation("يجب أن يكون المبلغ أكبر من صفر".into()));
    }
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO equity_transactions (id, shareholder_id, tx_type, amount, financial_account_id, counterpart_type, description, tx_date, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            id, payload.shareholder_id, payload.tx_type, payload.amount,
            payload.financial_account_id, payload.counterpart_type, payload.description,
            payload.tx_date, payload.user_id, now
        ],
    )?;

    // Log notification
    let (sh_name, user_name): (String, String) = {
        let s = conn.query_row(
            "SELECT name FROM shareholders WHERE id=?1",
            rusqlite::params![payload.shareholder_id],
            |r| r.get(0),
        ).unwrap_or_else(|_| "شريك".to_string());
        let u = if let Some(ref uid) = payload.user_id {
            conn.query_row("SELECT display_name FROM users WHERE id=?1", rusqlite::params![uid], |r| r.get(0)).unwrap_or_else(|_| "موظف".to_string())
        } else {
            "موظف".to_string()
        };
        (s, u)
    };

    let notif_title = format!("حركة رأس مال / جاري الشريك: {} ({:.2} ج.م)", sh_name, payload.amount);
    let notif_details = format!("قام المستخدم {} بتسجيل حركة {} للشريك {}. البيان: {}", user_name, payload.tx_type, sh_name, payload.description.as_deref().unwrap_or(""));
    let _ = crate::commands::notifications::log_system_notification(&conn, payload.user_id.as_deref(), &user_name, "equity_edit", &notif_title, Some(&notif_details));

    Ok(())
}

#[tauri::command]
pub async fn get_equity_transactions(
    state: State<'_, AppState>,
    shareholder_id: Option<String>,
) -> Result<Vec<EquityTransaction>, AppError> {
    let conn = state.pool.get()?;
    let cond = if let Some(ref sid) = shareholder_id {
        format!("WHERE et.shareholder_id = '{}'", sid)
    } else {
        "".to_string()
    };
    let sql = format!(
        "SELECT et.id, et.shareholder_id, sh.name, et.tx_type, et.amount,
                et.financial_account_id, fa.name_ar, et.counterpart_type,
                et.description, et.tx_date, et.created_at
         FROM equity_transactions et
         JOIN shareholders sh ON et.shareholder_id = sh.id
         LEFT JOIN financial_accounts fa ON et.financial_account_id = fa.id
         {} ORDER BY et.tx_date DESC, et.created_at DESC",
        cond
    );
    let mut stmt = conn.prepare(&sql)?;
    let list = stmt.query_map([], |r| {
        Ok(EquityTransaction {
            id: r.get(0)?, shareholder_id: r.get(1)?, shareholder_name: r.get(2)?,
            tx_type: r.get(3)?, amount: r.get(4)?, financial_account_id: r.get(5)?,
            financial_account_name: r.get(6)?, counterpart_type: r.get(7)?,
            description: r.get(8)?, tx_date: r.get(9)?, created_at: r.get(10)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(list)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShareholderLedgerRow {
    pub id: String,
    pub tx_date: String,
    pub shareholder_id: String,
    pub shareholder_name: String,
    pub tx_type: String,
    pub tx_type_label: String,
    pub description: String,
    pub debit: f64,
    pub credit: f64,
    pub running_balance: f64,
    pub financial_account_name: String,
    pub created_at: String,
}

#[tauri::command]
pub async fn get_shareholder_ledger(
    state: State<'_, AppState>,
    shareholder_id: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<ShareholderLedgerRow>, AppError> {
    let conn = state.pool.get()?;
    let mut conds = vec!["1=1".to_string()];
    if let Some(ref sid) = shareholder_id {
        if sid != "all" && !sid.is_empty() {
            conds.push(format!("et.shareholder_id = '{}'", sid));
        }
    }
    if let Some(ref df) = date_from {
        if !df.is_empty() {
            conds.push(format!("date(et.tx_date) >= '{}'", df));
        }
    }
    if let Some(ref dt) = date_to {
        if !dt.is_empty() {
            conds.push(format!("date(et.tx_date) <= '{}'", dt));
        }
    }

    let sql = format!(
        "SELECT et.id, et.shareholder_id, sh.name, et.tx_type, et.amount,
                COALESCE(fa.name_ar, 'الخزينة الرئيسية'), COALESCE(et.description, ''), et.tx_date, et.created_at
         FROM equity_transactions et
         JOIN shareholders sh ON et.shareholder_id = sh.id
         LEFT JOIN financial_accounts fa ON et.financial_account_id = fa.id
         WHERE {}
         ORDER BY et.tx_date ASC, et.created_at ASC",
        conds.join(" AND ")
    );

    let mut stmt = conn.prepare(&sql)?;
    let raw_rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, f64>(4)?,
            r.get::<_, String>(5)?,
            r.get::<_, String>(6)?,
            r.get::<_, String>(7)?,
            r.get::<_, String>(8)?,
        ))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut ledger = Vec::new();
    let mut running_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();

    for (id, sh_id, sh_name, tx_type, amount, acc_name, desc, tx_date, created_at) in raw_rows {
        let is_addition = tx_type == "capital_increase" || tx_type == "short_term_contribution" || tx_type == "profit_distribution";
        let (debit, credit) = if is_addition {
            (amount, 0.0)
        } else {
            (0.0, amount)
        };

        let current_bal = running_map.entry(sh_id.clone()).or_insert(0.0);
        if is_addition {
            *current_bal += amount;
        } else {
            *current_bal -= amount;
        }
        let running_balance = *current_bal;

        let tx_type_label = match tx_type.as_str() {
            "capital_increase" => "زيادة رأس المال",
            "short_term_contribution" => "مساهمة قصيرة الأجل",
            "withdrawal" => "مسحوبات شريك",
            "profit_distribution" => "توزيع أرباح",
            "short_term_withdrawal" => "سحب مساهمة مؤقتة",
            _ => &tx_type,
        }.to_string();

        ledger.push(ShareholderLedgerRow {
            id,
            tx_date,
            shareholder_id: sh_id,
            shareholder_name: sh_name,
            tx_type,
            tx_type_label,
            description: desc,
            debit,
            credit,
            running_balance,
            financial_account_name: acc_name,
            created_at,
        });
    }

    ledger.reverse();
    Ok(ledger)
}

#[derive(Debug, Serialize)]
pub struct ShareholderProfitShare {
    pub shareholder_id: String,
    pub shareholder_name: String,
    pub base_capital: f64,
    pub short_term_contribution: f64,
    pub base_equity_pct: f64,
    pub profit_from_base_capital: f64,
    pub profit_from_monetary_commissions: f64,
    pub total_profit_share: f64,
    pub effective_share_pct: f64,
}

#[derive(Debug, Serialize)]
pub struct ProfitDistributionReport {
    pub method: String,
    pub date_from: String,
    pub date_to: String,
    pub net_profit: f64,
    pub monetary_commissions: f64,
    pub total_distributed: f64,
    pub shareholders: Vec<ShareholderProfitShare>,
}

#[tauri::command]
pub async fn calculate_profit_distribution(
    state: State<'_, AppState>,
    date_from: String,
    date_to: String,
    method: Option<String>,
) -> Result<ProfitDistributionReport, AppError> {
    let m = method.unwrap_or_else(|| "method_1".to_string());

    // 1. Calculate Period Net Profit
    let pl = get_profit_loss(state.clone(), date_from.clone(), date_to.clone()).await?;
    let net_profit = pl.net_profit;
    let monetary_comm = pl.monetary_revenue;

    // 2. Fetch shareholders
    let sh_list = get_shareholders(state.clone()).await?;
    let total_capital: f64 = sh_list.iter().map(|s| s.initial_capital).sum();
    let total_all_equity: f64 = sh_list.iter().map(|s| s.total_equity).sum();

    // 3. Compute Daily Weighted Monetary Commission Profit Shares (يوم بيوم)
    let conn = state.pool.get()?;
    let mut comm_share_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();

    let mut stmt = conn.prepare(
        "SELECT date(created_at) as day_date, SUM(commission) as day_comm
         FROM monetary_transactions
         WHERE date(created_at) BETWEEN ?1 AND ?2
         GROUP BY date(created_at)
         HAVING SUM(commission) > 0"
    )?;
    let daily_comms = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let day_date: String = r.get(0)?;
        let day_comm: f64 = r.get(1)?;
        Ok((day_date, day_comm))
    })?.collect::<Result<Vec<_>, _>>().unwrap_or_default();

    for (day_date, day_comm) in daily_comms {
        if day_comm <= 0.0 { continue; }

        let mut sh_st_balances = Vec::new();
        let mut total_st_on_day = 0.0;

        for sh in &sh_list {
            let st_in: f64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions
                 WHERE shareholder_id = ?1 AND tx_type = 'short_term_contribution' AND date(tx_date) <= ?2",
                rusqlite::params![sh.id, day_date], |r| r.get(0),
            ).unwrap_or(0.0);

            let st_out: f64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions
                 WHERE shareholder_id = ?1 AND tx_type = 'short_term_withdrawal' AND date(tx_date) <= ?2",
                rusqlite::params![sh.id, day_date], |r| r.get(0),
            ).unwrap_or(0.0);

            let st_bal = (st_in - st_out).max(0.0);
            sh_st_balances.push((sh.id.clone(), st_bal));
            total_st_on_day += st_bal;
        }

        if total_st_on_day > 0.0 {
            for (sh_id, st_bal) in sh_st_balances {
                if st_bal > 0.0 {
                    let day_share = 0.5 * day_comm * (st_bal / total_st_on_day);
                    *comm_share_map.entry(sh_id).or_insert(0.0) += day_share;
                }
            }
        }
    }

    let mut report_items = Vec::new();
    let mut total_dist = 0.0;

    for sh in &sh_list {
        let (profit_from_base, profit_from_comm, total_share) = if m == "method_1" {
            // Method 1: (Equity Share % * net_profit) + (Daily accumulated 50% monetary commissions share)
            let base_share = (sh.ownership_percentage / 100.0) * net_profit;
            let comm_share = *comm_share_map.get(&sh.id).unwrap_or(&0.0);
            (base_share, comm_share, base_share + comm_share)
        } else {
            // Method 2: Weighted average share of total equity (Capital + Short-term)
            let share_pct = if total_all_equity > 0.0 {
                sh.total_equity / total_all_equity
            } else if total_capital > 0.0 {
                sh.initial_capital / total_capital
            } else {
                sh.ownership_percentage / 100.0
            };
            let total = share_pct * net_profit;
            (total, 0.0, total)
        };

        total_dist += total_share;
        let eff_pct = if net_profit != 0.0 { (total_share / net_profit) * 100.0 } else { sh.ownership_percentage };

        report_items.push(ShareholderProfitShare {
            shareholder_id: sh.id.clone(),
            shareholder_name: sh.name.clone(),
            base_capital: sh.initial_capital,
            short_term_contribution: sh.short_term_balance,
            base_equity_pct: sh.ownership_percentage,
            profit_from_base_capital: profit_from_base,
            profit_from_monetary_commissions: profit_from_comm,
            total_profit_share: total_share,
            effective_share_pct: eff_pct,
        });
    }

    Ok(ProfitDistributionReport {
        method: m,
        date_from,
        date_to,
        net_profit,
        monetary_commissions: monetary_comm,
        total_distributed: total_dist,
        shareholders: report_items,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. FINANCIAL ACCOUNTS & LIMITS & ALARMS
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinancialAccount {
    pub id: String,
    pub name_ar: String,
    pub name_en: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub balance: f64,
    pub limit_type: String, // "min_max" or "debit_limit"
    pub min_balance_limit: Option<f64>,
    pub max_balance_limit: Option<f64>,
    pub debit_limit_amount: Option<f64>,
    pub debit_limit_days: Option<i32>,
    pub debit_limit_start_date: Option<String>,
    pub debit_limit_end_date: Option<String>,
    pub warning_threshold_pct: f64,
    pub current_period_debit: f64,
    pub days_remaining_in_period: i32,
    pub alert_status: String, // "normal", "warning_75", "exceeded_100", "below_min", "above_max", "near_min", "near_max"
    pub alert_message: String,
    pub monthly_inflow: f64,
    pub monthly_outflow: f64,
    pub net_monthly_flow: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountPayload {
    pub name_ar: String,
    pub name_en: Option<String>,
    pub limit_type: Option<String>,
    pub min_balance_limit: Option<f64>,
    pub max_balance_limit: Option<f64>,
    pub debit_limit_amount: Option<f64>,
    pub debit_limit_days: Option<i32>,
    pub debit_limit_start_date: Option<String>,
    pub debit_limit_end_date: Option<String>,
    pub warning_threshold_pct: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccountLimitsPayload {
    pub id: String,
    pub limit_type: Option<String>,
    pub min_balance_limit: Option<f64>,
    pub max_balance_limit: Option<f64>,
    pub debit_limit_amount: Option<f64>,
    pub debit_limit_days: Option<i32>,
    pub debit_limit_start_date: Option<String>,
    pub debit_limit_end_date: Option<String>,
    pub warning_threshold_pct: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct AccountAlert {
    pub account_id: String,
    pub account_name: String,
    pub balance: f64,
    pub alert_type: String, // "below_min", "near_min", "above_max", "near_max", "warning_75", "exceeded_100"
    pub message: String,
}

pub fn get_current_month_range() -> (String, String, i32) {
    use chrono::Datelike;
    let now = chrono::Local::now().date_naive();
    let year = now.year();
    let month = now.month();

    let start_date = chrono::NaiveDate::from_ymd_opt(year, month, 1).unwrap_or(now);
    let next_month_start = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap_or(now)
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap_or(now)
    };
    let end_date = next_month_start.pred_opt().unwrap_or(now);

    let days_remaining = (end_date - now).num_days().max(0) as i32;

    (start_date.to_string(), end_date.to_string(), days_remaining)
}

pub fn get_period_debit_outflow_for_account(
    conn: &rusqlite::Connection,
    account_id: &str,
    start_date: &str,
    end_date: &str,
) -> f64 {
    let exp_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE financial_account_id = ?1 AND date(expense_date) >= ?2 AND date(expense_date) <= ?3",
        rusqlite::params![account_id, start_date, end_date],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let accr_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM accrued_expenses WHERE status = 'paid' AND financial_account_id = ?1 AND date(created_at) >= ?2 AND date(created_at) <= ?3",
        rusqlite::params![account_id, start_date, end_date],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let mon_out: f64 = if account_id == "cash_drawer" {
        conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM monetary_transactions WHERE tx_type = 'transfer_in_cash_out' AND date(created_at) >= ?1 AND date(created_at) <= ?2",
            rusqlite::params![start_date, end_date],
            |r| r.get(0)
        ).unwrap_or(0.0)
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM monetary_transactions WHERE tx_type = 'cash_in_transfer_out' AND financial_account_id = ?1 AND date(created_at) >= ?2 AND date(created_at) <= ?3",
            rusqlite::params![account_id, start_date, end_date],
            |r| r.get(0)
        ).unwrap_or(0.0)
    };

    let supp_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM supplier_payments WHERE financial_account_id = ?1 AND date(created_at) >= ?2 AND date(created_at) <= ?3",
        rusqlite::params![account_id, start_date, end_date],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let trans_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM financial_transfers WHERE from_account_id = ?1 AND date(created_at) >= ?2 AND date(created_at) <= ?3",
        rusqlite::params![account_id, start_date, end_date],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let eq_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE tx_type IN ('withdrawal','profit_distribution','short_term_withdrawal') AND counterpart_type='cash' AND financial_account_id = ?1 AND date(tx_date) >= ?2 AND date(tx_date) <= ?3",
        rusqlite::params![account_id, start_date, end_date],
        |r| r.get(0)
    ).unwrap_or(0.0);

    exp_out + accr_out + mon_out + supp_out + trans_out + eq_out
}

pub fn calculate_account_balance(conn: &rusqlite::Connection, account_id: &str) -> Result<f64, AppError> {
    // 1. Sales (Cash + card paid)
    let sales_inflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(cash_amount + card_amount), 0.0) FROM sales WHERE status != 'returned' AND financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 2. Expenses paid
    let expenses_outflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 3. Repairs delivered & paid
    let repairs_inflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN amount_paid > 0.0 THEN amount_paid ELSE total_cost END), 0.0)
         FROM repair_jobs WHERE status='delivered' AND financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 4. Monetary transactions
    // - If account is "cash_drawer" (الخزينة الورقية):
    //   * Inflow: receives amount + commission on 'cash_in_transfer_out' (استقبال نقدية وإرسال رصيد)
    //   * Outflow: pays amount on 'transfer_in_cash_out' (استقبال رصيد ودفع نقدية)
    // - If account is digital wallet/bank account (المحفظة أو الحساب البنكي):
    //   * Inflow: receives amount + commission on 'transfer_in_cash_out' (استقبال رصيد ودفع نقدية)
    //   * Outflow: pays amount on 'cash_in_transfer_out' (استقبال نقدية وإرسال رصيد)
    let (monetary_inflow, monetary_outflow): (f64, f64) = if account_id == "cash_drawer" {
        let in_amt: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount + commission), 0.0) FROM monetary_transactions WHERE tx_type = 'cash_in_transfer_out'",
            [], |r| r.get(0)
        ).unwrap_or(0.0);
        let out_amt: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM monetary_transactions WHERE tx_type = 'transfer_in_cash_out'",
            [], |r| r.get(0)
        ).unwrap_or(0.0);
        (in_amt, out_amt)
    } else {
        let in_amt: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount + commission), 0.0) FROM monetary_transactions WHERE tx_type = 'transfer_in_cash_out' AND financial_account_id = ?1",
            rusqlite::params![account_id], |r| r.get(0)
        ).unwrap_or(0.0);
        let out_amt: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM monetary_transactions WHERE tx_type = 'cash_in_transfer_out' AND financial_account_id = ?1",
            rusqlite::params![account_id], |r| r.get(0)
        ).unwrap_or(0.0);
        (in_amt, out_amt)
    };

    // 5. Supplier payments
    let supplier_outflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM supplier_payments WHERE financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 6. Internal Transfers
    let transfers_inflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM financial_transfers WHERE to_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let transfers_outflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM financial_transfers WHERE from_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 7. Fixed Assets purchased
    let fixed_assets_outflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(purchase_cost), 0.0) FROM fixed_assets WHERE financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 8. Customer debts paid (Customer payments)
    let customer_pay_inflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM customer_payments WHERE financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 9. Customer Advances
    let customer_adv_inflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM customer_advances WHERE financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 10. Accrued Expenses paid
    let accrued_exp_outflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM accrued_expenses WHERE status='paid' AND financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 11. Equity transactions
    let equity_inflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE tx_type IN ('capital_increase','short_term_contribution') AND counterpart_type='cash' AND financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let equity_outflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE tx_type IN ('withdrawal','profit_distribution','short_term_withdrawal') AND counterpart_type='cash' AND financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 12. Purchase Returns refunded in cash
    let purchase_returns_inflow: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0.0) FROM purchase_returns WHERE refund_type='cash' AND financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    // 13. Manual cash balance adjustments by sadmin
    let adjustments_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(adjustment_amount), 0.0) FROM cash_adjustments WHERE financial_account_id = ?1",
        rusqlite::params![account_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let balance = sales_inflow + repairs_inflow + monetary_inflow + transfers_inflow + customer_pay_inflow + customer_adv_inflow + equity_inflow + purchase_returns_inflow + adjustments_total
        - expenses_outflow - monetary_outflow - supplier_outflow - transfers_outflow - fixed_assets_outflow - accrued_exp_outflow - equity_outflow;

    Ok(balance)
}

fn get_monthly_cashflow_for_account(conn: &rusqlite::Connection, account_id: &str) -> (f64, f64) {
    let now = Utc::now();
    let month_start = format!("{:04}-{:02}-01", now.year(), now.month());

    let sales_in: f64 = conn.query_row(
        "SELECT COALESCE(SUM(cash_amount + card_amount), 0.0) FROM sales WHERE status != 'returned' AND financial_account_id = ?1 AND date(created_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let repairs_in: f64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN amount_paid > 0.0 THEN amount_paid ELSE total_cost END), 0.0) FROM repair_jobs WHERE status='delivered' AND financial_account_id = ?1 AND date(delivered_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let (monetary_in, mon_out): (f64, f64) = if account_id == "cash_drawer" {
        let in_val: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount + commission), 0.0) FROM monetary_transactions WHERE tx_type = 'cash_in_transfer_out' AND date(created_at) >= ?1",
            rusqlite::params![month_start], |r| r.get(0)
        ).unwrap_or(0.0);
        let out_val: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM monetary_transactions WHERE tx_type = 'transfer_in_cash_out' AND date(created_at) >= ?1",
            rusqlite::params![month_start], |r| r.get(0)
        ).unwrap_or(0.0);
        (in_val, out_val)
    } else {
        let in_val: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount + commission), 0.0) FROM monetary_transactions WHERE tx_type = 'transfer_in_cash_out' AND financial_account_id = ?1 AND date(created_at) >= ?2",
            rusqlite::params![account_id, month_start], |r| r.get(0)
        ).unwrap_or(0.0);
        let out_val: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM monetary_transactions WHERE tx_type = 'cash_in_transfer_out' AND financial_account_id = ?1 AND date(created_at) >= ?2",
            rusqlite::params![account_id, month_start], |r| r.get(0)
        ).unwrap_or(0.0);
        (in_val, out_val)
    };

    let transfer_in: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM financial_transfers WHERE to_account_id = ?1 AND date(created_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let cust_pay_in: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM customer_payments WHERE financial_account_id = ?1 AND date(created_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let cust_adv_in: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM customer_advances WHERE financial_account_id = ?1 AND date(created_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let eq_in: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE tx_type IN ('capital_increase','short_term_contribution') AND counterpart_type='cash' AND financial_account_id = ?1 AND date(tx_date) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let po_ret_in: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0.0) FROM purchase_returns WHERE refund_type='cash' AND financial_account_id = ?1 AND date(created_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let total_in = sales_in + repairs_in + monetary_in + transfer_in + cust_pay_in + cust_adv_in + eq_in + po_ret_in;

    let exp_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE financial_account_id = ?1 AND date(expense_date) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let supp_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM supplier_payments WHERE financial_account_id = ?1 AND date(paid_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let trans_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM financial_transfers WHERE from_account_id = ?1 AND date(created_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let fa_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(purchase_cost), 0.0) FROM fixed_assets WHERE financial_account_id = ?1 AND date(purchase_date) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let accr_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM accrued_expenses WHERE status='paid' AND financial_account_id = ?1 AND date(paid_at) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let eq_out: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE tx_type IN ('withdrawal','profit_distribution') AND counterpart_type='cash' AND financial_account_id = ?1 AND date(tx_date) >= ?2",
        rusqlite::params![account_id, month_start], |r| r.get(0)
    ).unwrap_or(0.0);

    let total_out = exp_out + mon_out + supp_out + trans_out + fa_out + accr_out + eq_out;

    (total_in, total_out)
}

#[tauri::command]
pub async fn get_financial_accounts(
    state: State<'_, AppState>,
) -> Result<Vec<FinancialAccount>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, name_ar, name_en, is_active, created_at, min_balance_limit, max_balance_limit,
                COALESCE(limit_type, 'min_max'), debit_limit_amount, COALESCE(debit_limit_days, 30),
                COALESCE(warning_threshold_pct, 75.0), debit_limit_start_date, debit_limit_end_date
         FROM financial_accounts ORDER BY created_at ASC"
    )?;
    let accounts_iter = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, i64>(3)? == 1,
            r.get::<_, String>(4)?,
            r.get::<_, Option<f64>>(5)?,
            r.get::<_, Option<f64>>(6)?,
            r.get::<_, String>(7)?,
            r.get::<_, Option<f64>>(8)?,
            r.get::<_, i32>(9)?,
            r.get::<_, f64>(10)?,
            r.get::<_, Option<String>>(11)?,
            r.get::<_, Option<String>>(12)?,
        ))
    })?;

    let mut list = Vec::new();
    for item in accounts_iter {
        let (id, name_ar, name_en, is_active, created_at, min_limit, max_limit, limit_type, debit_limit_amount, debit_limit_days, warning_threshold_pct, start_date_opt, end_date_opt) = item?;
        let balance = calculate_account_balance(&conn, &id)?;
        let (monthly_inflow, monthly_outflow) = get_monthly_cashflow_for_account(&conn, &id);

        let (default_start, default_end, default_days_rem) = get_current_month_range();
        let eff_start_date = start_date_opt.clone().unwrap_or(default_start);
        let eff_end_date = end_date_opt.clone().unwrap_or(default_end);

        let days_remaining_in_period = if let Ok(end_nd) = chrono::NaiveDate::parse_from_str(&eff_end_date, "%Y-%m-%d") {
            let now_nd = chrono::Local::now().date_naive();
            (end_nd - now_nd).num_days().max(0) as i32
        } else {
            default_days_rem
        };

        let current_period_debit = get_period_debit_outflow_for_account(&conn, &id, &eff_start_date, &eff_end_date);

        let mut alert_status = "normal".to_string();
        let mut alert_message = "الحساب يعمل بصورة طبيعية ضمن الحدود المقررة".to_string();

        if limit_type == "debit_limit" {
            if let Some(debit_max) = debit_limit_amount {
                if debit_max > 0.0 {
                    let pct = (current_period_debit / debit_max) * 100.0;
                    if pct >= 100.0 {
                        alert_status = "exceeded_100".to_string();
                        alert_message = format!("🚨 تنبيه مشدد عاجل: تجاوز إجمالي الحركات المدينة الخارجة الحد الأقصى المسموح ({:.1}%) للفترة (متبقي {} يوم بالشهر)! ", pct, days_remaining_in_period);
                        let _ = crate::commands::notifications::log_system_notification(
                            &conn, None, "نظام التنبيهات والحدود", "debit_limit_exceeded",
                            &format!("🚨 تجاوز الحد الأقصى للمسحوبات ({})", name_ar),
                            Some(&format!("بلغت الحركات المدينة الخارجة {:.2} ج.م بنسبة {:.1}% من الحد الأقصى للفترة (متبقي {} يوم)", current_period_debit, pct, days_remaining_in_period))
                        );
                    } else if pct >= warning_threshold_pct {
                        alert_status = "warning_75".to_string();
                        alert_message = format!("⚠️ تحذير: بلغت الحركات المدينة الخارجة {:.1}% من الحد الأقصى المسموح للمدة ({} يوم)", pct, debit_limit_days);
                        let _ = crate::commands::notifications::log_system_notification(
                            &conn, None, "نظام التنبيهات والحدود", "debit_limit_warning",
                            &format!("⚠️ تحذير اقتراب من الحد النقدي ({})", name_ar),
                            Some(&format!("بلغت الحركات المدينة الخارجة {:.2} ج.م بنسبة {:.1}% من الحد الأقصى المقرر", current_period_debit, pct))
                        );
                    }
                }
            }
        } else {
            if let Some(min_val) = min_limit {
                let near_min_val = min_val * (1.0 + (100.0 - warning_threshold_pct) / 100.0);
                if balance <= min_val {
                    alert_status = "below_min".to_string();
                    alert_message = format!("🚨 تنبيه مشدد: رصيد الحساب الحالي ({:.2} ج.م) ينخفض عن الحد الأدنى المسموح ({:.2} ج.م)!", balance, min_val);
                } else if balance <= near_min_val {
                    alert_status = "near_min".to_string();
                    alert_message = format!("⚠️ تحذير: رصيد الحساب يقترب من الحد الأدنى المقبول (نسبة التنبيه {:.0}%)", warning_threshold_pct);
                }
            }
            if let Some(max_val) = max_limit {
                let near_max_val = max_val * (warning_threshold_pct / 100.0);
                if balance >= max_val {
                    alert_status = "above_max".to_string();
                    alert_message = format!("🚨 تنبيه مشدد: رصيد الحساب الحالي ({:.2} ج.م) يتجاوز الحد الأقصى المسموح ({:.2} ج.م)!", balance, max_val);
                } else if balance >= near_max_val {
                    alert_status = "near_max".to_string();
                    alert_message = format!("⚠️ تحذير: رصيد الحساب يقترب من الحد الأقصى المقبول (وصل إلى {:.0}%)", warning_threshold_pct);
                }
            }
        }

        list.push(FinancialAccount {
            id, name_ar, name_en, is_active, created_at, balance,
            limit_type, min_balance_limit: min_limit, max_balance_limit: max_limit,
            debit_limit_amount, debit_limit_days: Some(debit_limit_days),
            debit_limit_start_date: start_date_opt,
            debit_limit_end_date: end_date_opt,
            warning_threshold_pct, current_period_debit, days_remaining_in_period,
            alert_status, alert_message,
            monthly_inflow, monthly_outflow,
            net_monthly_flow: monthly_inflow - monthly_outflow,
        });
    }
    Ok(list)
}

#[tauri::command]
pub async fn create_financial_account(
    state: State<'_, AppState>,
    payload: CreateAccountPayload,
) -> Result<FinancialAccount, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let limit_type = payload.limit_type.unwrap_or_else(|| "min_max".to_string());
    let debit_days = payload.debit_limit_days.unwrap_or(30);
    let warning_pct = payload.warning_threshold_pct.unwrap_or(75.0);

    conn.execute(
        "INSERT INTO financial_accounts (id, name_ar, name_en, is_active, min_balance_limit, max_balance_limit, limit_type, debit_limit_amount, debit_limit_days, warning_threshold_pct, debit_limit_start_date, debit_limit_end_date, created_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            id, payload.name_ar, payload.name_en, payload.min_balance_limit, payload.max_balance_limit,
            limit_type, payload.debit_limit_amount, debit_days, warning_pct,
            payload.debit_limit_start_date, payload.debit_limit_end_date, now
        ],
    )?;

    let (def_s, def_e, def_rem) = get_current_month_range();

    Ok(FinancialAccount {
        id, name_ar: payload.name_ar, name_en: payload.name_en, is_active: true,
        created_at: now, balance: 0.0, limit_type,
        min_balance_limit: payload.min_balance_limit,
        max_balance_limit: payload.max_balance_limit,
        debit_limit_amount: payload.debit_limit_amount,
        debit_limit_days: Some(debit_days),
        debit_limit_start_date: payload.debit_limit_start_date,
        debit_limit_end_date: payload.debit_limit_end_date,
        warning_threshold_pct: warning_pct,
        current_period_debit: 0.0,
        days_remaining_in_period: def_rem,
        alert_status: "normal".to_string(),
        alert_message: "الحساب يعمل بصورة طبيعية".to_string(),
        monthly_inflow: 0.0, monthly_outflow: 0.0, net_monthly_flow: 0.0,
    })
}

#[tauri::command]
pub async fn update_financial_account_limits(
    state: State<'_, AppState>,
    payload: UpdateAccountLimitsPayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let limit_type = payload.limit_type.unwrap_or_else(|| "min_max".to_string());
    let debit_days = payload.debit_limit_days.unwrap_or(30);
    let warning_pct = payload.warning_threshold_pct.unwrap_or(75.0);

    conn.execute(
        "UPDATE financial_accounts SET limit_type=?1, min_balance_limit=?2, max_balance_limit=?3, debit_limit_amount=?4, debit_limit_days=?5, warning_threshold_pct=?6, debit_limit_start_date=?7, debit_limit_end_date=?8 WHERE id=?9",
        rusqlite::params![
            limit_type, payload.min_balance_limit, payload.max_balance_limit,
            payload.debit_limit_amount, debit_days, warning_pct,
            payload.debit_limit_start_date, payload.debit_limit_end_date, payload.id
        ],
    )?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct AdjustAccountBalancePayload {
    pub financial_account_id: String,
    pub new_balance: f64,
    pub reason: Option<String>,
    pub user_id: Option<String>,
    pub username: String,
}

#[tauri::command]
pub async fn adjust_financial_account_balance(
    state: State<'_, AppState>,
    payload: AdjustAccountBalancePayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;

    let user_role: String = conn.query_row(
        "SELECT role FROM users WHERE id = ?1 OR username = ?2",
        rusqlite::params![payload.user_id, payload.username.trim()],
        |r| r.get(0),
    ).unwrap_or_else(|_| "staff".to_string());

    if user_role != "admin" {
        return Err(AppError::Validation("عذراً، تعديل أرصدة حسابات النقدية مقتصر حصرياً على مدراء النظام (Admin Role)".into()));
    }

    let current_balance = calculate_account_balance(&conn, &payload.financial_account_id)?;
    let adjustment_amount = payload.new_balance - current_balance;

    if adjustment_amount.abs() < 0.001 {
        return Ok(());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO cash_adjustments (id, financial_account_id, old_balance, new_balance, adjustment_amount, reason, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id, payload.financial_account_id, current_balance, payload.new_balance,
            adjustment_amount, payload.reason, payload.user_id, now
        ],
    )?;

    let account_name: String = conn.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id=?1",
        rusqlite::params![payload.financial_account_id],
        |r| r.get(0),
    ).unwrap_or_else(|_| "حساب نقدي".to_string());

    let user_display = if let Some(ref uid) = payload.user_id {
        conn.query_row("SELECT display_name FROM users WHERE id=?1", rusqlite::params![uid], |r| r.get(0)).unwrap_or_else(|_| payload.username.clone())
    } else {
        payload.username.clone()
    };

    let title = format!("تعديل رصيد حساب نقدي ({}) بواسطة المدير", account_name);
    let details = format!(
        "قام المدير ({}) بتعديل رصيد حساب '{}' من {:.2} ج.م إلى {:.2} ج.م (الفارق: {:.2} ج.م). البيان/السبب: {}",
        user_display, account_name, current_balance, payload.new_balance, adjustment_amount, payload.reason.as_deref().unwrap_or("بدون ملاحظات")
    );

    let _ = crate::commands::notifications::log_system_notification(
        &conn,
        payload.user_id.as_deref(),
        &user_display,
        "account_balance_adjustment",
        &title,
        Some(&details),
    );

    Ok(())
}

#[tauri::command]
pub async fn get_account_alerts(
    state: State<'_, AppState>,
) -> Result<Vec<AccountAlert>, AppError> {
    let accounts = get_financial_accounts(state).await?;
    let mut alerts = Vec::new();

    for acc in accounts {
        if acc.alert_status == "below_min" {
            alerts.push(AccountAlert {
                account_id: acc.id.clone(),
                account_name: acc.name_ar.clone(),
                balance: acc.balance,
                alert_type: "below_min".to_string(),
                message: format!("تنبيه عاجل: رصيد حساب {} ({} ج.م) وصل للحد الأدنى المسموح ({:?} ج.م)!", acc.name_ar, acc.balance, acc.min_balance_limit.unwrap_or(0.0)),
            });
        } else if acc.alert_status == "near_min" {
            alerts.push(AccountAlert {
                account_id: acc.id.clone(),
                account_name: acc.name_ar.clone(),
                balance: acc.balance,
                alert_type: "near_min".to_string(),
                message: format!("تنبيه: رصيد حساب {} ({} ج.م) يقترب من الحد الأدنى ({:?} ج.م)", acc.name_ar, acc.balance, acc.min_balance_limit.unwrap_or(0.0)),
            });
        } else if acc.alert_status == "above_max" {
            alerts.push(AccountAlert {
                account_id: acc.id.clone(),
                account_name: acc.name_ar.clone(),
                balance: acc.balance,
                alert_type: "above_max".to_string(),
                message: format!("تنبيه: رصيد حساب {} ({} ج.م) تجاوز الحد الأقصى المسموح ({:?} ج.م)!", acc.name_ar, acc.balance, acc.max_balance_limit.unwrap_or(0.0)),
            });
        } else if acc.alert_status == "near_max" {
            alerts.push(AccountAlert {
                account_id: acc.id.clone(),
                account_name: acc.name_ar.clone(),
                balance: acc.balance,
                alert_type: "near_max".to_string(),
                message: format!("تنبيه: رصيد حساب {} ({} ج.م) يقترب من الحد الأقصى ({:?} ج.م)", acc.name_ar, acc.balance, acc.max_balance_limit.unwrap_or(0.0)),
            });
        }
    }

    Ok(alerts)
}

#[tauri::command]
pub async fn delete_financial_account(
    state: State<'_, AppState>,
    id: String,
    target_account_id: String,
) -> Result<(), AppError> {
    if id == "cash_drawer" {
        return Err(AppError::Validation("لا يمكن حذف الحساب الرئيسي (الخزينة)".into()));
    }
    if id == target_account_id {
        return Err(AppError::Validation("لا يمكن نقل الحركات لنفس الحساب".into()));
    }

    let mut conn = state.pool.get()?;
    let tx = conn.transaction()?;

    tx.execute("UPDATE sales SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE expenses SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE repair_jobs SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE monetary_transactions SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE supplier_payments SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE fixed_assets SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE customer_payments SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE customer_advances SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE accrued_expenses SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;
    tx.execute("UPDATE equity_transactions SET financial_account_id = ?2 WHERE financial_account_id = ?1", rusqlite::params![id, target_account_id])?;

    tx.execute("DELETE FROM financial_accounts WHERE id = ?1", rusqlite::params![id])?;
    tx.commit()?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct TransferPayload {
    pub from_account_id: String,
    pub to_account_id: String,
    pub amount: f64,
    pub notes: Option<String>,
    pub user_id: Option<String>,
}

#[tauri::command]
pub async fn transfer_financial_amount(
    state: State<'_, AppState>,
    payload: TransferPayload,
) -> Result<(), AppError> {
    if payload.from_account_id == payload.to_account_id {
        return Err(AppError::Validation("لا يمكن التحويل لنفس الحساب".into()));
    }
    if payload.amount <= 0.0 {
        return Err(AppError::Validation("يجب أن يكون مبلغ التحويل أكبر من صفر".into()));
    }

    let conn = state.pool.get()?;
    let current_balance = calculate_account_balance(&conn, &payload.from_account_id)?;
    if current_balance < payload.amount {
        return Err(AppError::Validation(format!(
            "رصيد الحساب المصدر غير كافٍ. الرصيد الحالي: {:.2} ج.م",
            current_balance
        )));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO financial_transfers (id, from_account_id, to_account_id, amount, notes, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            id, payload.from_account_id, payload.to_account_id, payload.amount,
            payload.notes, payload.user_id, now
        ],
    )?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. INCOME STATEMENT (قائمة الدخل متعددة المراحل)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ProfitLoss {
    pub period_from: String,
    pub period_to: String,
    // 1. Revenues
    pub sales_revenue: f64,
    pub repair_revenue: f64,
    pub monetary_revenue: f64,
    pub total_revenue: f64,
    // 2. Direct Costs
    pub cogs: f64,
    pub damaged_goods_cost: f64,
    pub repair_parts_cost: f64,
    pub total_direct_costs: f64,
    // 3. Gross Profit
    pub gross_profit: f64,
    // 4. Operating & Indirect Expenses
    pub operating_expenses: f64,
    pub depreciation_expense: f64,
    pub accrued_expenses: f64,
    pub total_expenses: f64,
    // 5. Net Profit
    pub net_profit: f64,
    pub expense_breakdown: Vec<serde_json::Value>,
}

#[tauri::command]
pub async fn get_profit_loss(
    state: State<'_, AppState>,
    date_from: String,
    date_to: String,
) -> Result<ProfitLoss, AppError> {
    let conn = state.pool.get()?;

    // 1. Sales revenue & COGS
    let (sales_revenue, cogs): (f64, f64) = conn.query_row(
        "SELECT COALESCE(SUM(s.total),0.0), COALESCE(SUM(si.qty * si.unit_cost),0.0)
         FROM sales s JOIN sale_items si ON si.sale_id=s.id
         WHERE s.status != 'returned' AND date(s.created_at) BETWEEN ?1 AND ?2",
        rusqlite::params![date_from, date_to],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0.0, 0.0));

    // 2. Repair revenue & parts cost
    let (repair_revenue, repair_parts_cost): (f64, f64) = conn.query_row(
        "SELECT COALESCE(SUM(total_cost),0.0), COALESCE(SUM(parts_cost),0.0) FROM repair_jobs
         WHERE status='delivered' AND date(delivered_at) BETWEEN ?1 AND ?2",
        rusqlite::params![date_from, date_to],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0.0, 0.0));

    // 3. Monetary commissions
    let monetary_revenue: f64 = conn.query_row(
        "SELECT COALESCE(SUM(commission),0.0) FROM monetary_transactions
         WHERE date(created_at) BETWEEN ?1 AND ?2",
        rusqlite::params![date_from, date_to],
        |r| r.get(0),
    ).unwrap_or(0.0);

    // 4. Damaged Goods cost
    let damaged_goods_cost: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_cost),0.0) FROM damaged_goods
         WHERE date(created_at) BETWEEN ?1 AND ?2",
        rusqlite::params![date_from, date_to],
        |r| r.get(0),
    ).unwrap_or(0.0);

    // 5. Operating expenses (cash expenses)
    let operating_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0.0) FROM expenses WHERE date(expense_date) BETWEEN ?1 AND ?2",
        rusqlite::params![date_from, date_to],
        |r| r.get(0),
    ).unwrap_or(0.0);

    // 6. Depreciation expense
    let depreciation_expense: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0.0) FROM fixed_asset_depreciations WHERE date(period_date) BETWEEN ?1 AND ?2",
        rusqlite::params![date_from, date_to],
        |r| r.get(0),
    ).unwrap_or(0.0);

    // 7. Accrued expenses recorded in this period
    let accrued_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0.0) FROM accrued_expenses WHERE date(created_at) BETWEEN ?1 AND ?2",
        rusqlite::params![date_from, date_to],
        |r| r.get(0),
    ).unwrap_or(0.0);

    let mut stmt = conn.prepare(
        "SELECT ec.name_ar, SUM(e.amount) FROM expenses e
         JOIN expense_categories ec ON e.category_id=ec.id
         WHERE date(e.expense_date) BETWEEN ?1 AND ?2
         GROUP BY e.category_id ORDER BY SUM(e.amount) DESC"
    )?;
    let mut expense_breakdown = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        Ok(serde_json::json!({ "category": r.get::<_,String>(0)?, "amount": r.get::<_,f64>(1)? }))
    })?.collect::<Result<Vec<_>, _>>()?;

    if depreciation_expense > 0.0 {
        expense_breakdown.push(serde_json::json!({ "category": "إهلاك الأصول الثابتة", "amount": depreciation_expense }));
    }
    if accrued_expenses > 0.0 {
        expense_breakdown.push(serde_json::json!({ "category": "مصروفات مستحقة", "amount": accrued_expenses }));
    }

    let total_revenue = sales_revenue + repair_revenue + monetary_revenue;
    let total_direct_costs = cogs + damaged_goods_cost + repair_parts_cost;
    let gross_profit = total_revenue - total_direct_costs;
    let total_expenses = operating_expenses + depreciation_expense + accrued_expenses;
    let net_profit = gross_profit - total_expenses;

    Ok(ProfitLoss {
        period_from: date_from, period_to: date_to,
        sales_revenue, repair_revenue, monetary_revenue, total_revenue,
        cogs, damaged_goods_cost, repair_parts_cost, total_direct_costs,
        gross_profit, operating_expenses, depreciation_expense, accrued_expenses,
        total_expenses, net_profit, expense_breakdown,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. BALANCE SHEET (قائمة المركز المالي)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct BalanceSheet {
    pub as_of_date: String,
    // 1. Assets
    pub cash_and_banks: f64,
    pub accounts_receivable: f64, // العملاء والمدينون
    pub inventory_value: f64,      // المخزون
    pub total_current_assets: f64,
    pub fixed_assets_gross: f64,
    pub accumulated_depreciation: f64,
    pub fixed_assets_net: f64,
    pub total_assets: f64,
    // 2. Liabilities
    pub accounts_payable: f64,     // الموردون والدائنون
    pub accrued_expenses: f64,     // مصروفات مستحقة
    pub customer_advances: f64,    // دفعات مقدمة من العملاء
    pub total_liabilities: f64,
    // 3. Equity
    pub capital: f64,
    pub short_term_contributions: f64,
    pub drawings: f64,
    pub retained_and_current_earnings: f64,
    pub total_equity: f64,
    // Check
    pub is_balanced: bool,
    pub discrepancy: f64,
}

#[tauri::command]
pub async fn get_balance_sheet(
    state: State<'_, AppState>,
    as_of_date: Option<String>,
) -> Result<BalanceSheet, AppError> {
    let conn = state.pool.get()?;
    let target_date = as_of_date.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    // 1. Cash and bank accounts total
    let accounts = get_financial_accounts(state.clone()).await?;
    let cash_and_banks: f64 = accounts.iter().map(|a| a.balance).sum();

    // 2. Accounts Receivable (Customer positive balance / debts)
    let accounts_receivable: f64 = conn.query_row(
        "SELECT COALESCE(SUM(balance), 0.0) FROM customers WHERE balance > 0",
        [], |r| r.get(0),
    ).unwrap_or(0.0);

    // 3. Inventory value (Sum of qty * cost_price for active products)
    let inventory_value: f64 = conn.query_row(
        "SELECT COALESCE(SUM(CAST(stock_qty AS REAL) * cost_price), 0.0) FROM products WHERE is_active=1 AND stock_qty > 0",
        [], |r| r.get(0),
    ).unwrap_or(0.0);

    let total_current_assets = cash_and_banks + accounts_receivable + inventory_value;

    // 4. Fixed assets
    let (fixed_assets_gross, accumulated_depreciation): (f64, f64) = conn.query_row(
        "SELECT COALESCE(SUM(purchase_cost), 0.0), COALESCE(SUM(accumulated_depreciation), 0.0) FROM fixed_assets",
        [], |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0.0, 0.0));

    let fixed_assets_net = (fixed_assets_gross - accumulated_depreciation).max(0.0);
    let total_assets = total_current_assets + fixed_assets_net;

    // 5. Liabilities
    // Suppliers (Accounts payable)
    let accounts_payable: f64 = conn.query_row(
        "SELECT COALESCE(SUM(balance), 0.0) FROM suppliers WHERE balance > 0",
        [], |r| r.get(0),
    ).unwrap_or(0.0);

    // Unpaid Liabilities & Obligations (جدول الالتزامات والاستحقاقات الموحد)
    let unpaid_liabilities: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount - paid_amount), 0.0) FROM liabilities WHERE status != 'paid'",
        [], |r| r.get(0),
    ).unwrap_or(0.0);

    let total_liabilities = accounts_payable + unpaid_liabilities;

    // 6. Equity
    let shareholders = get_shareholders(state.clone()).await?;
    let capital: f64 = shareholders.iter().map(|s| s.initial_capital).sum();
    let short_term_contributions: f64 = shareholders.iter().map(|s| s.short_term_balance).sum();
    
    let drawings: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM equity_transactions WHERE tx_type IN ('withdrawal', 'profit_distribution')",
        [], |r| r.get(0),
    ).unwrap_or(0.0);

    // Net earnings up to this date
    let pl = get_profit_loss(state, "2000-01-01".to_string(), target_date.clone()).await?;
    let retained_and_current_earnings = pl.net_profit;

    let total_equity = capital + short_term_contributions - drawings + retained_and_current_earnings;

    let discrepancy = total_assets - (total_liabilities + total_equity);
    let is_balanced = discrepancy.abs() < 0.01;

    Ok(BalanceSheet {
        as_of_date: target_date,
        cash_and_banks,
        accounts_receivable,
        inventory_value,
        total_current_assets,
        fixed_assets_gross,
        accumulated_depreciation,
        fixed_assets_net,
        total_assets,
        accounts_payable,
        accrued_expenses: unpaid_liabilities,
        customer_advances: 0.0,
        total_liabilities,
        capital,
        short_term_contributions,
        drawings,
        retained_and_current_earnings,
        total_equity,
        is_balanced,
        discrepancy,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. GENERAL LEDGER TRANSACTIONS (دفتر الأستاذ العام وتصنيف الحركات)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LedgerRow {
    pub date: String,
    pub ledger_category: String, // "assets_cash", "assets_inventory", "assets_fixed", "assets_customers", "liabilities_suppliers", "liabilities_accrued", "liabilities_advances", "equity"
    pub tx_type: String,
    pub description: String,
    pub debit: f64,  // مدين (Inflow / Increase for Assets/Expenses)
    pub credit: f64, // دائن (Outflow / Decrease for Assets/Expenses)
    pub financial_account_id: Option<String>,
    pub financial_account_name: String,
}

#[tauri::command]
pub async fn get_ledger(
    state: State<'_, AppState>,
    date_from: String,
    date_to: String,
    category_filter: Option<String>,
) -> Result<Vec<LedgerRow>, AppError> {
    let conn = state.pool.get()?;
    let mut ledger = Vec::new();

    // 1. Sales
    let mut stmt = conn.prepare(
        "SELECT s.created_at, s.invoice_no, s.total, s.cash_amount, s.card_amount,
                COALESCE(fa.name_ar, 'الخزينة الرئيسية')
         FROM sales s
         LEFT JOIN financial_accounts fa ON s.financial_account_id = fa.id
         WHERE s.status != 'returned' AND date(s.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let invoice_no: String = r.get(1)?;
        let total: f64 = r.get(2)?;
        let account_name: String = r.get(5)?;
        Ok(LedgerRow {
            date,
            ledger_category: "assets_cash".to_string(),
            tx_type: "مبيعات".to_string(),
            description: format!("فاتورة مبيعات {}", invoice_no),
            debit: total,
            credit: 0.0,
            financial_account_id: None,
            financial_account_name: account_name,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    ledger.extend(rows);

    // 2. Expenses
    let mut stmt = conn.prepare(
        "SELECT e.expense_date, ec.name_ar, e.amount, e.description,
                COALESCE(fa.name_ar, 'الخزينة الرئيسية')
         FROM expenses e
         JOIN expense_categories ec ON e.category_id = ec.id
         LEFT JOIN financial_accounts fa ON e.financial_account_id = fa.id
         WHERE date(e.expense_date) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let category: String = r.get(1)?;
        let amount: f64 = r.get(2)?;
        let desc: Option<String> = r.get(3)?;
        let account_name: String = r.get(4)?;
        let description = match desc {
            Some(d) => format!("مصروف {}: {}", category, d),
            None => format!("مصروف {}", category),
        };
        Ok(LedgerRow {
            date: format!("{}T12:00:00Z", date),
            ledger_category: "assets_cash".to_string(),
            tx_type: "مصروفات".to_string(),
            description,
            debit: 0.0,
            credit: amount,
            financial_account_id: None,
            financial_account_name: account_name,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    ledger.extend(rows);

    // 3. Repairs
    let mut stmt = conn.prepare(
        "SELECT r.delivered_at, r.job_no, r.device_model, r.total_cost, r.amount_paid,
                COALESCE(fa.name_ar, 'الخزينة الرئيسية')
         FROM repair_jobs r
         LEFT JOIN financial_accounts fa ON r.financial_account_id = fa.id
         WHERE r.status='delivered' AND date(r.delivered_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let job_no: String = r.get(1)?;
        let model: String = r.get(2)?;
        let total: f64 = r.get(3)?;
        let paid: f64 = r.get(4)?;
        let account_name: String = r.get(5)?;
        Ok(LedgerRow {
            date,
            ledger_category: "assets_cash".to_string(),
            tx_type: "صيانة".to_string(),
            description: format!("تسليم جهاز {} صيانة رقم {}", model, job_no),
            debit: if paid > 0.0 { paid } else { total },
            credit: 0.0,
            financial_account_id: None,
            financial_account_name: account_name,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    ledger.extend(rows);

    // 4. Monetary Transactions (خدمات مالية وفق القيد المزدوج)
    let mut stmt = conn.prepare(
        "SELECT mt.created_at, mst.name_ar, mt.tx_type, mt.amount, mt.commission,
                COALESCE(fa.name_ar, 'محفظة/حساب رقمي')
         FROM monetary_transactions mt
         JOIN monetary_service_types mst ON mt.service_type_id = mst.id
         LEFT JOIN financial_accounts fa ON mt.financial_account_id = fa.id
         WHERE date(mt.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows_iter = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let name: String = r.get(1)?;
        let tx_type: String = r.get(2)?;
        let amount: f64 = r.get(3)?;
        let comm: f64 = r.get(4)?;
        let digital_acc_name: String = r.get(5)?;
        Ok((date, name, tx_type, amount, comm, digital_acc_name))
    })?;

    for item in rows_iter {
        let (date, name, tx_type, amount, comm, digital_acc_name) = item?;
        if tx_type == "cash_in_transfer_out" {
            // استقبال نقدية وإرسال رصيد
            // الخزينة الرئيسية تستقبل المبلغ + العمولة
            ledger.push(LedgerRow {
                date: date.clone(),
                ledger_category: "assets_cash".to_string(),
                tx_type: "خدمات مالية: كاش إن".to_string(),
                description: format!("استقبال نقدية وعمولة بالخزينة (خدمة: {})", name),
                debit: amount + comm,
                credit: 0.0,
                financial_account_id: Some("cash_drawer".to_string()),
                financial_account_name: "الخزينة الرئيسية".to_string(),
            });
            // المحفظة/الحساب البنكي يخصم منه المبلغ
            ledger.push(LedgerRow {
                date,
                ledger_category: "assets_cash".to_string(),
                tx_type: "خدمات مالية: إرسال رصيد".to_string(),
                description: format!("إرسال رصيد من المحفظة/البنك (خدمة: {})", name),
                debit: 0.0,
                credit: amount,
                financial_account_id: None,
                financial_account_name: digital_acc_name,
            });
        } else {
            // transfer_in_cash_out: استقبال رصيد ودفع نقدية
            // المحفظة/الحساب البنكي يستقبل المبلغ + العمولة
            ledger.push(LedgerRow {
                date: date.clone(),
                ledger_category: "assets_cash".to_string(),
                tx_type: "خدمات مالية: استقبال رصيد".to_string(),
                description: format!("استقبال رصيد وعمولة بالمحفظة/البنك (خدمة: {})", name),
                debit: amount + comm,
                credit: 0.0,
                financial_account_id: None,
                financial_account_name: digital_acc_name,
            });
            // الخزينة الرئيسية تدفع النقدية للعميل
            ledger.push(LedgerRow {
                date,
                ledger_category: "assets_cash".to_string(),
                tx_type: "خدمات مالية: كاش أوت".to_string(),
                description: format!("دفع نقدية من الخزينة للعميل (خدمة: {})", name),
                debit: 0.0,
                credit: amount,
                financial_account_id: Some("cash_drawer".to_string()),
                financial_account_name: "الخزينة الرئيسية".to_string(),
            });
        }
    }

    // 5. Supplier Payments
    let mut stmt = conn.prepare(
        "SELECT sp.paid_at, s.name, sp.amount, sp.notes,
                COALESCE(fa.name_ar, 'الخزينة الرئيسية')
         FROM supplier_payments sp
         JOIN suppliers s ON sp.supplier_id = s.id
         LEFT JOIN financial_accounts fa ON sp.financial_account_id = fa.id
         WHERE date(sp.paid_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let name: String = r.get(1)?;
        let amount: f64 = r.get(2)?;
        let notes: Option<String> = r.get(3)?;
        let account_name: String = r.get(4)?;
        let description = match notes {
            Some(n) => format!("سداد للمورد {}: {}", name, n),
            None => format!("سداد للمورد {}", name),
        };
        Ok(LedgerRow {
            date,
            ledger_category: "liabilities_suppliers".to_string(),
            tx_type: "سداد مورد".to_string(),
            description,
            debit: 0.0,
            credit: amount,
            financial_account_id: None,
            financial_account_name: account_name,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    ledger.extend(rows);

    // 5b. Purchase Returns
    if let Ok(mut stmt) = conn.prepare(
        "SELECT pr.created_at, s.name, pr.total_amount, pr.refund_type, COALESCE(fa.name_ar, 'الخزينة الرئيسية'), pr.reason
         FROM purchase_returns pr
         JOIN suppliers s ON pr.supplier_id = s.id
         LEFT JOIN financial_accounts fa ON pr.financial_account_id = fa.id
         WHERE date(pr.created_at) BETWEEN ?1 AND ?2"
    ) {
        if let Ok(rows) = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
            let date: String = r.get(0)?;
            let sname: String = r.get(1)?;
            let amount: f64 = r.get(2)?;
            let rtype: String = r.get(3)?;
            let acc_name: String = r.get(4)?;
            let reason: Option<String> = r.get(5)?;
            let reason_str = reason.map(|rs| format!(" ({})", rs)).unwrap_or_default();
            if rtype == "cash" {
                Ok(LedgerRow {
                    date,
                    ledger_category: "assets_cash".to_string(),
                    tx_type: "مرتجع شراء (نقدي)".to_string(),
                    description: format!("استرداد نقدي لمرتجع شراء من المورد {}{}", sname, reason_str),
                    debit: amount,
                    credit: 0.0,
                    financial_account_id: None,
                    financial_account_name: acc_name,
                })
            } else {
                Ok(LedgerRow {
                    date,
                    ledger_category: "liabilities_suppliers".to_string(),
                    tx_type: "مرتجع شراء (خصم مديونية)".to_string(),
                    description: format!("خصم من مستحقات المورد {}{}", sname, reason_str),
                    debit: amount,
                    credit: 0.0,
                    financial_account_id: None,
                    financial_account_name: "حسابات الموردين".to_string(),
                })
            }
        }) {
            if let Ok(collected) = rows.collect::<Result<Vec<_>, _>>() {
                ledger.extend(collected);
            }
        }
    }

    // 6. Fixed Assets Acquisitions & Depreciation
    let mut stmt = conn.prepare(
        "SELECT fa.purchase_date, fa.name, fa.purchase_cost, COALESCE(acc.name_ar, 'الخزينة الرئيسية')
         FROM fixed_assets fa
         LEFT JOIN financial_accounts acc ON fa.financial_account_id = acc.id
         WHERE date(fa.purchase_date) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let name: String = r.get(1)?;
        let cost: f64 = r.get(2)?;
        let acc_name: String = r.get(3)?;
        Ok(LedgerRow {
            date: format!("{}T12:00:00Z", date),
            ledger_category: "assets_fixed".to_string(),
            tx_type: "شراء أصل ثابت".to_string(),
            description: format!("شراء أصل ثابت: {}", name),
            debit: cost,
            credit: 0.0,
            financial_account_id: None,
            financial_account_name: acc_name,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    ledger.extend(rows);

    // 7. Damaged Goods
    let mut stmt = conn.prepare(
        "SELECT dg.created_at, p.name_ar, dg.qty, dg.total_cost, dg.reason
         FROM damaged_goods dg
         JOIN products p ON dg.product_id = p.id
         WHERE date(dg.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let name: String = r.get(1)?;
        let qty: f64 = r.get(2)?;
        let total_cost: f64 = r.get(3)?;
        let reason: Option<String> = r.get(4)?;
        Ok(LedgerRow {
            date,
            ledger_category: "assets_inventory".to_string(),
            tx_type: "هالك مخزون".to_string(),
            description: format!("إتلاف مخزون {} (كمية {}) - {}", name, qty, reason.unwrap_or_default()),
            debit: 0.0,
            credit: total_cost,
            financial_account_id: None,
            financial_account_name: "المخزون السلعي".to_string(),
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    ledger.extend(rows);

    // 8. Customer Payments & Advances
    let mut stmt = conn.prepare(
        "SELECT cp.created_at, c.name, cp.amount, COALESCE(fa.name_ar, 'الخزينة الرئيسية')
         FROM customer_payments cp
         JOIN customers c ON cp.customer_id = c.id
         LEFT JOIN financial_accounts fa ON cp.financial_account_id = fa.id
         WHERE date(cp.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let name: String = r.get(1)?;
        let amount: f64 = r.get(2)?;
        let acc_name: String = r.get(3)?;
        Ok(LedgerRow {
            date,
            ledger_category: "assets_customers".to_string(),
            tx_type: "سداد عميل".to_string(),
            description: format!("سداد مديونية من العميل: {}", name),
            debit: amount,
            credit: 0.0,
            financial_account_id: None,
            financial_account_name: acc_name,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    ledger.extend(rows);

    // 9. Equity Transactions
    let mut stmt = conn.prepare(
        "SELECT et.tx_date, sh.name, et.tx_type, et.amount, et.description, COALESCE(fa.name_ar, 'الخزينة الرئيسية')
         FROM equity_transactions et
         JOIN shareholders sh ON et.shareholder_id = sh.id
         LEFT JOIN financial_accounts fa ON et.financial_account_id = fa.id
         WHERE date(et.tx_date) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let name: String = r.get(1)?;
        let tx_type: String = r.get(2)?;
        let amount: f64 = r.get(3)?;
        let desc: Option<String> = r.get(4)?;
        let acc_name: String = r.get(5)?;
        let is_inflow = tx_type == "capital_increase" || tx_type == "short_term_contribution";
        Ok(LedgerRow {
            date: format!("{}T12:00:00Z", date),
            ledger_category: "equity".to_string(),
            tx_type: format!("حقوق ملكية ({})", tx_type),
            description: format!("حركة للشريك {}: {}", name, desc.unwrap_or_default()),
            debit: if is_inflow { amount } else { 0.0 },
            credit: if !is_inflow { amount } else { 0.0 },
            financial_account_id: None,
            financial_account_name: acc_name,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    ledger.extend(rows);

    // 10. Transfers
    let mut stmt = conn.prepare(
        "SELECT t.created_at, t.amount, t.notes, fa_from.name_ar, fa_to.name_ar
         FROM financial_transfers t
         JOIN financial_accounts fa_from ON t.from_account_id = fa_from.id
         JOIN financial_accounts fa_to ON t.to_account_id = fa_to.id
         WHERE date(t.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let amount: f64 = r.get(1)?;
        let notes: Option<String> = r.get(2)?;
        let from_name: String = r.get(3)?;
        let to_name: String = r.get(4)?;
        Ok((date, amount, notes, from_name, to_name))
    })?;

    for row in rows {
        let (date, amount, notes, from_name, to_name) = row?;
        let notes_str = notes.map(|n| format!(" - {}", n)).unwrap_or_else(|| "".to_string());
        ledger.push(LedgerRow {
            date: date.clone(),
            ledger_category: "assets_cash".to_string(),
            tx_type: "تحويل صادر".to_string(),
            description: format!("تحويل إلى حساب {}{}", to_name, notes_str),
            debit: 0.0,
            credit: amount,
            financial_account_id: None,
            financial_account_name: from_name.clone(),
        });
        ledger.push(LedgerRow {
            date,
            ledger_category: "assets_cash".to_string(),
            tx_type: "تحويل وارد".to_string(),
            description: format!("تحويل من حساب {}{}", from_name, notes_str),
            debit: amount,
            credit: 0.0,
            financial_account_id: None,
            financial_account_name: to_name,
        });
    }

    if let Some(ref cat) = category_filter {
        if cat != "all" {
            ledger.retain(|r| r.ledger_category == *cat);
        }
    }

    ledger.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(ledger)
}

#[tauri::command]
pub async fn get_beginning_balance(
    state: State<'_, AppState>,
    date_from: String,
) -> Result<f64, AppError> {
    let conn = state.pool.get()?;
    
    let sales: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total), 0.0) FROM sales WHERE status != 'returned' AND date(created_at) < ?1",
        rusqlite::params![date_from], |r| r.get(0)
    ).unwrap_or(0.0);

    let expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE date(expense_date) < ?1",
        rusqlite::params![date_from], |r| r.get(0)
    ).unwrap_or(0.0);

    let repairs: f64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN amount_paid > 0.0 THEN amount_paid ELSE total_cost END), 0.0)
         FROM repair_jobs WHERE status='delivered' AND date(delivered_at) < ?1",
        rusqlite::params![date_from], |r| r.get(0)
    ).unwrap_or(0.0);

    let monetary_commission_net: f64 = conn.query_row(
        "SELECT COALESCE(SUM(commission), 0.0) FROM monetary_transactions WHERE date(created_at) < ?1",
        rusqlite::params![date_from], |r| r.get(0)
    ).unwrap_or(0.0);

    let supplier: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM supplier_payments WHERE date(paid_at) < ?1",
        rusqlite::params![date_from], |r| r.get(0)
    ).unwrap_or(0.0);
    
    let total_balance = sales - expenses + repairs + monetary_commission_net - supplier;
    Ok(total_balance)
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. SALES DETAILED METRICS (مبيعات اليوم والشهر وحركة الصيانة)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TodaySaleItemDetail {
    pub invoice_no: String,
    pub customer_name: Option<String>,
    pub total: f64,
    pub payment_method: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct SalesMetricsDetailed {
    pub today_date: String,
    pub today_sales_total: f64,
    pub today_sales_count: i64,
    pub today_sales_list: Vec<TodaySaleItemDetail>,
    pub month_sales_total: f64,
    pub month_sales_count: i64,
    pub month_repairs_total: f64,
    pub month_repairs_count: i64,
    pub month_repairs_delivered_count: i64,
}

#[tauri::command]
pub async fn get_sales_detailed_metrics(
    state: State<'_, AppState>,
) -> Result<SalesMetricsDetailed, AppError> {
    let conn = state.pool.get()?;
    let now = Utc::now();
    let today_str = now.format("%Y-%m-%d").to_string();
    let month_start = format!("{:04}-{:02}-01", now.year(), now.month());

    // 1. Today sales
    let (today_total, today_count): (f64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(total), 0.0), COUNT(id) FROM sales WHERE status != 'returned' AND date(created_at) = ?1",
        rusqlite::params![today_str],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0.0, 0));

    let mut stmt = conn.prepare(
        "SELECT s.invoice_no, c.name, s.total, s.cash_amount, s.card_amount, s.created_at
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.status != 'returned' AND date(s.created_at) = ?1
         ORDER BY s.created_at DESC"
    )?;
    let today_sales_list = stmt.query_map(rusqlite::params![today_str], |r| {
        let inv: String = r.get(0)?;
        let cust: Option<String> = r.get(1)?;
        let tot: f64 = r.get(2)?;
        let cash: f64 = r.get(3)?;
        let card: f64 = r.get(4)?;
        let dt: String = r.get(5)?;
        let method = if cash > 0.0 && card > 0.0 { "نقدي + فيزا" } else if cash > 0.0 { "نقدي" } else { "فيزا" };
        Ok(TodaySaleItemDetail {
            invoice_no: inv,
            customer_name: cust,
            total: tot,
            payment_method: method.to_string(),
            created_at: dt,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    // 2. Month sales
    let (month_sales_total, month_sales_count): (f64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(total), 0.0), COUNT(id) FROM sales WHERE status != 'returned' AND date(created_at) >= ?1",
        rusqlite::params![month_start],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0.0, 0));

    // 3. Month repairs
    let (month_repairs_total, month_repairs_count, month_repairs_delivered_count): (f64, i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(total_cost), 0.0), COUNT(id),
                COALESCE(SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END), 0)
         FROM repair_jobs WHERE date(received_at) >= ?1",
        rusqlite::params![month_start],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap_or((0.0, 0, 0));

    Ok(SalesMetricsDetailed {
        today_date: today_str,
        today_sales_total: today_total,
        today_sales_count: today_count,
        today_sales_list,
        month_sales_total,
        month_sales_count,
        month_repairs_total,
        month_repairs_count,
        month_repairs_delivered_count,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. CASH MOVEMENTS & RUNNING BALANCE REPORT (تقرير حركة النقدية والأرصدة والحدود)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct CashMovementRow {
    pub date: String,
    pub account_id: String,
    pub account_name: String,
    pub tx_type: String,
    pub description: String,
    pub inflow: f64,
    pub outflow: f64,
    pub commission: f64,
    pub balance_after: f64,
    pub min_balance_limit: Option<f64>,
    pub max_balance_limit: Option<f64>,
    pub remaining_limit: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct CashMovementsReport {
    pub date_from: String,
    pub date_to: String,
    pub movements: Vec<CashMovementRow>,
    pub accounts: Vec<FinancialAccount>,
    pub total_inflow: f64,
    pub total_outflow: f64,
    pub total_commission: f64,
    pub net_cashflow: f64,
}

#[tauri::command]
pub async fn get_cash_movements_report(
    state: State<'_, AppState>,
    date_from: String,
    date_to: String,
    account_id: Option<String>,
) -> Result<CashMovementsReport, AppError> {
    let conn = state.pool.get()?;
    let accounts = get_financial_accounts(state.clone()).await?;

    struct RawCashEntry {
        date: String,
        account_id: String,
        account_name: String,
        tx_type: String,
        description: String,
        inflow: f64,
        outflow: f64,
        commission: f64,
    }

    let mut raw_entries: Vec<RawCashEntry> = Vec::new();

    // 1. Sales
    let mut stmt = conn.prepare(
        "SELECT s.created_at, COALESCE(s.financial_account_id, 'cash_drawer'),
                COALESCE(fa.name_ar, 'الخزينة الرئيسية'), s.invoice_no, s.total
         FROM sales s
         LEFT JOIN financial_accounts fa ON s.financial_account_id = fa.id
         WHERE s.status != 'returned' AND date(s.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let acc_id: String = r.get(1)?;
        let acc_name: String = r.get(2)?;
        let inv_no: String = r.get(3)?;
        let total: f64 = r.get(4)?;
        Ok(RawCashEntry {
            date,
            account_id: acc_id,
            account_name: acc_name,
            tx_type: "مبيعات نقدية".to_string(),
            description: format!("فاتورة مبيعات رقم {}", inv_no),
            inflow: total,
            outflow: 0.0,
            commission: 0.0,
        })
    })?;
    for r in rows { raw_entries.push(r?); }

    // 2. Expenses
    let mut stmt = conn.prepare(
        "SELECT e.created_at, COALESCE(e.financial_account_id, 'cash_drawer'),
                COALESCE(fa.name_ar, 'الخزينة الرئيسية'), ec.name_ar, e.amount, e.description
         FROM expenses e
         JOIN expense_categories ec ON e.category_id = ec.id
         LEFT JOIN financial_accounts fa ON e.financial_account_id = fa.id
         WHERE date(e.expense_date) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let acc_id: String = r.get(1)?;
        let acc_name: String = r.get(2)?;
        let cat: String = r.get(3)?;
        let amt: f64 = r.get(4)?;
        let desc: Option<String> = r.get(5)?;
        let desc_str = desc.map(|d| format!(": {}", d)).unwrap_or_default();
        Ok(RawCashEntry {
            date,
            account_id: acc_id,
            account_name: acc_name,
            tx_type: "مصروفات".to_string(),
            description: format!("مصروف {}{}", cat, desc_str),
            inflow: 0.0,
            outflow: amt,
            commission: 0.0,
        })
    })?;
    for r in rows { raw_entries.push(r?); }

    // 3. Repairs
    let mut stmt = conn.prepare(
        "SELECT r.delivered_at, COALESCE(r.financial_account_id, 'cash_drawer'),
                COALESCE(fa.name_ar, 'الخزينة الرئيسية'), r.job_no, r.device_model,
                r.total_cost, r.amount_paid
         FROM repair_jobs r
         LEFT JOIN financial_accounts fa ON r.financial_account_id = fa.id
         WHERE r.status = 'delivered' AND date(r.delivered_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let acc_id: String = r.get(1)?;
        let acc_name: String = r.get(2)?;
        let job_no: String = r.get(3)?;
        let model: String = r.get(4)?;
        let total: f64 = r.get(5)?;
        let paid: f64 = r.get(6)?;
        let amount = if paid > 0.0 { paid } else { total };
        Ok(RawCashEntry {
            date,
            account_id: acc_id,
            account_name: acc_name,
            tx_type: "صيانة".to_string(),
            description: format!("تسليم صيانة جهاز {} - إيصال {}", model, job_no),
            inflow: amount,
            outflow: 0.0,
            commission: 0.0,
        })
    })?;
    for r in rows { raw_entries.push(r?); }

    // 4. Monetary Transactions
    let mut stmt = conn.prepare(
        "SELECT mt.created_at, mst.name_ar, mt.tx_type, mt.amount, mt.commission,
                COALESCE(mt.financial_account_id, 'wallet_vodafone'), COALESCE(fa.name_ar, 'المحفظة الإلكترونية')
         FROM monetary_transactions mt
         JOIN monetary_service_types mst ON mt.service_type_id = mst.id
         LEFT JOIN financial_accounts fa ON mt.financial_account_id = fa.id
         WHERE date(mt.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let name: String = r.get(1)?;
        let tx_type: String = r.get(2)?;
        let amount: f64 = r.get(3)?;
        let comm: f64 = r.get(4)?;
        let dig_id: String = r.get(5)?;
        let dig_name: String = r.get(6)?;
        Ok((date, name, tx_type, amount, comm, dig_id, dig_name))
    })?;
    for r in rows {
        let (date, name, tx_type, amount, comm, dig_id, dig_name) = r?;
        if tx_type == "cash_in_transfer_out" {
            // Cash in drawer
            raw_entries.push(RawCashEntry {
                date: date.clone(),
                account_id: "cash_drawer".to_string(),
                account_name: "الخزينة الرئيسية".to_string(),
                tx_type: "خدمات مالية (كاش إن)".to_string(),
                description: format!("استلام نقدية وعمولة بالخزينة (خدمة {})", name),
                inflow: amount + comm,
                outflow: 0.0,
                commission: comm,
            });
            // Digital wallet out
            raw_entries.push(RawCashEntry {
                date,
                account_id: dig_id,
                account_name: dig_name,
                tx_type: "خدمات مالية (تحويل رصيد)".to_string(),
                description: format!("إرسال رصيد للعميل (خدمة {})", name),
                inflow: 0.0,
                outflow: amount,
                commission: 0.0,
            });
        } else {
            // Digital wallet in
            raw_entries.push(RawCashEntry {
                date: date.clone(),
                account_id: dig_id,
                account_name: dig_name,
                tx_type: "خدمات مالية (استقبال رصيد)".to_string(),
                description: format!("استقبال رصيد وعمولة بالمحفظة (خدمة {})", name),
                inflow: amount + comm,
                outflow: 0.0,
                commission: comm,
            });
            // Cash drawer out
            raw_entries.push(RawCashEntry {
                date,
                account_id: "cash_drawer".to_string(),
                account_name: "الخزينة الرئيسية".to_string(),
                tx_type: "خدمات مالية (كاش أوت)".to_string(),
                description: format!("دفع نقدية للعميل من الخزينة (خدمة {})", name),
                inflow: 0.0,
                outflow: amount,
                commission: 0.0,
            });
        }
    }

    // 5. Financial Transfers
    let mut stmt = conn.prepare(
        "SELECT t.created_at, t.amount, t.notes, t.from_account_id, fa_from.name_ar,
                t.to_account_id, fa_to.name_ar
         FROM financial_transfers t
         JOIN financial_accounts fa_from ON t.from_account_id = fa_from.id
         JOIN financial_accounts fa_to ON t.to_account_id = fa_to.id
         WHERE date(t.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let amount: f64 = r.get(1)?;
        let notes: Option<String> = r.get(2)?;
        let from_id: String = r.get(3)?;
        let from_name: String = r.get(4)?;
        let to_id: String = r.get(5)?;
        let to_name: String = r.get(6)?;
        let notes_str = notes.map(|n| format!(" - {}", n)).unwrap_or_default();
        Ok((date, amount, notes_str, from_id, from_name, to_id, to_name))
    })?;
    for r in rows {
        let (date, amount, notes_str, from_id, from_name, to_id, to_name) = r?;
        raw_entries.push(RawCashEntry {
            date: date.clone(),
            account_id: from_id,
            account_name: from_name.clone(),
            tx_type: "تحويل مالي صادر".to_string(),
            description: format!("تحويل إلى حساب {}{}", to_name, notes_str),
            inflow: 0.0,
            outflow: amount,
            commission: 0.0,
        });
        raw_entries.push(RawCashEntry {
            date,
            account_id: to_id,
            account_name: to_name,
            tx_type: "تحويل مالي وارد".to_string(),
            description: format!("تحويل من حساب {}{}", from_name, notes_str),
            inflow: amount,
            outflow: 0.0,
            commission: 0.0,
        });
    }

    // 6. Supplier Payments
    let mut stmt = conn.prepare(
        "SELECT sp.paid_at, COALESCE(sp.financial_account_id, 'cash_drawer'),
                COALESCE(fa.name_ar, 'الخزينة الرئيسية'), s.name, sp.amount, sp.notes
         FROM supplier_payments sp
         JOIN suppliers s ON sp.supplier_id = s.id
         LEFT JOIN financial_accounts fa ON sp.financial_account_id = fa.id
         WHERE date(sp.paid_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let acc_id: String = r.get(1)?;
        let acc_name: String = r.get(2)?;
        let sname: String = r.get(3)?;
        let amount: f64 = r.get(4)?;
        let notes: Option<String> = r.get(5)?;
        let notes_str = notes.map(|n| format!(" ({})", n)).unwrap_or_default();
        Ok(RawCashEntry {
            date,
            account_id: acc_id,
            account_name: acc_name,
            tx_type: "سداد مورد".to_string(),
            description: format!("سداد مشتريات للمورد {}{}", sname, notes_str),
            inflow: 0.0,
            outflow: amount,
            commission: 0.0,
        })
    })?;
    for r in rows { raw_entries.push(r?); }

    // 7. Customer Payments & Advances
    let mut stmt = conn.prepare(
        "SELECT cp.created_at, COALESCE(cp.financial_account_id, 'cash_drawer'),
                COALESCE(fa.name_ar, 'الخزينة الرئيسية'), c.name, cp.amount
         FROM customer_payments cp
         JOIN customers c ON cp.customer_id = c.id
         LEFT JOIN financial_accounts fa ON cp.financial_account_id = fa.id
         WHERE date(cp.created_at) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let acc_id: String = r.get(1)?;
        let acc_name: String = r.get(2)?;
        let cname: String = r.get(3)?;
        let amount: f64 = r.get(4)?;
        Ok(RawCashEntry {
            date,
            account_id: acc_id,
            account_name: acc_name,
            tx_type: "تحصيل من عميل".to_string(),
            description: format!("تحصيل مديونية من العميل {}", cname),
            inflow: amount,
            outflow: 0.0,
            commission: 0.0,
        })
    })?;
    for r in rows { raw_entries.push(r?); }

    // 8. Equity Transactions
    let mut stmt = conn.prepare(
        "SELECT eq.tx_date, COALESCE(eq.financial_account_id, 'cash_drawer'),
                COALESCE(fa.name_ar, 'الخزينة الرئيسية'), sh.name, eq.tx_type, eq.amount, eq.notes
         FROM equity_transactions eq
         JOIN shareholders sh ON eq.shareholder_id = sh.id
         LEFT JOIN financial_accounts fa ON eq.financial_account_id = fa.id
         WHERE eq.counterpart_type = 'cash' AND date(eq.tx_date) BETWEEN ?1 AND ?2"
    )?;
    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        let date: String = r.get(0)?;
        let acc_id: String = r.get(1)?;
        let acc_name: String = r.get(2)?;
        let sh_name: String = r.get(3)?;
        let ttype: String = r.get(4)?;
        let amount: f64 = r.get(5)?;
        let notes: Option<String> = r.get(6)?;
        let notes_str = notes.map(|n| format!(" ({})", n)).unwrap_or_default();
        let is_deposit = ttype == "capital_increase" || ttype == "short_term_contribution";
        let desc = if is_deposit {
            format!("إيداع مساهمة/رأس مال من الشريك {}{}", sh_name, notes_str)
        } else {
            format!("سحب مسحوبات/توزيعات للشريك {}{}", sh_name, notes_str)
        };
        Ok(RawCashEntry {
            date,
            account_id: acc_id,
            account_name: acc_name,
            tx_type: if is_deposit { "إيداع حقوق ملكية".to_string() } else { "مسحوبات شركاء".to_string() },
            description: desc,
            inflow: if is_deposit { amount } else { 0.0 },
            outflow: if !is_deposit { amount } else { 0.0 },
            commission: 0.0,
        })
    })?;
    for r in rows { raw_entries.push(r?); }

    // Filter by account_id if specified
    if let Some(ref target_acc) = account_id {
        if target_acc != "all" && !target_acc.is_empty() {
            raw_entries.retain(|e| e.account_id == *target_acc);
        }
    }

    // Sort chronologically
    raw_entries.sort_by(|a, b| a.date.cmp(&b.date));

    // Calculate running balance per account
    let mut balance_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for acc in &accounts {
        balance_map.insert(acc.id.clone(), 0.0);
    }

    let mut movements: Vec<CashMovementRow> = Vec::new();
    let mut total_inflow = 0.0;
    let mut total_outflow = 0.0;
    let mut total_commission = 0.0;

    for entry in raw_entries {
        total_inflow += entry.inflow;
        total_outflow += entry.outflow;
        total_commission += entry.commission;

        let cur_bal = balance_map.entry(entry.account_id.clone()).or_insert(0.0);
        *cur_bal += entry.inflow - entry.outflow;
        let balance_after = *cur_bal;

        let acc_info = accounts.iter().find(|a| a.id == entry.account_id);
        let min_lim = acc_info.and_then(|a| a.min_balance_limit);
        let max_lim = acc_info.and_then(|a| a.max_balance_limit);
        let remaining_limit = max_lim.map(|max_v| (max_v - balance_after).max(0.0));

        movements.push(CashMovementRow {
            date: entry.date,
            account_id: entry.account_id,
            account_name: entry.account_name,
            tx_type: entry.tx_type,
            description: entry.description,
            inflow: entry.inflow,
            outflow: entry.outflow,
            commission: entry.commission,
            balance_after,
            min_balance_limit: min_lim,
            max_balance_limit: max_lim,
            remaining_limit,
        });
    }

    Ok(CashMovementsReport {
        date_from,
        date_to,
        movements,
        accounts,
        total_inflow,
        total_outflow,
        total_commission,
        net_cashflow: total_inflow - total_outflow,
    })
}
