use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaleItem {
    pub id: String,
    pub sale_id: String,
    pub product_id: String,
    pub product_name: String,
    pub brand_name: Option<String>,
    pub qty: i64,
    pub unit_price: f64,
    pub unit_cost: f64,
    pub discount: f64,
    pub line_total: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Sale {
    pub id: String,
    pub invoice_no: String,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub status: String,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub cash_amount: f64,
    pub card_amount: f64,
    pub change_amount: f64,
    pub notes: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
    pub items: Vec<SaleItem>,
}

#[derive(Debug, Deserialize)]
pub struct SaleItemPayload {
    pub product_id: String,
    pub qty: i64,
    pub unit_price: f64,
    pub unit_cost: f64,
    pub discount: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateSalePayload {
    pub customer_id: Option<String>,
    pub items: Vec<SaleItemPayload>,
    pub discount: f64,
    pub cash_amount: f64,
    pub card_amount: f64,
    pub notes: Option<String>,
    pub user_id: Option<String>,
    pub financial_account_id: Option<String>,
}

#[tauri::command]
pub async fn create_sale(
    state: State<'_, AppState>,
    payload: CreateSalePayload,
) -> Result<Sale, AppError> {
    let conn = state.pool.get()?;

    // Generate invoice number
    let next_no: i64 = conn.query_row(
        "SELECT CAST(value AS INTEGER) FROM settings WHERE key='next_invoice_no'",
        [],
        |r| r.get(0),
    ).unwrap_or(1);
    let prefix: String = conn.query_row(
        "SELECT value FROM settings WHERE key='invoice_prefix'",
        [], |r| r.get(0),
    ).unwrap_or_else(|_| "INV".to_string());
    let invoice_no = format!("{}-{:05}", prefix, next_no);

    // Calculate totals
    let subtotal: f64 = payload.items.iter()
        .map(|i| (i.unit_price * i.qty as f64) - i.discount)
        .sum();
    let total = subtotal - payload.discount;
    let change = (payload.cash_amount + payload.card_amount) - total;

    let sale_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // Insert sale
    conn.execute(
        "INSERT INTO sales (id,invoice_no,customer_id,subtotal,discount,total,cash_amount,card_amount,change_amount,notes,created_by,created_at,financial_account_id)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        rusqlite::params![
            sale_id, invoice_no, payload.customer_id, subtotal, payload.discount,
            total, payload.cash_amount, payload.card_amount, change.max(0.0),
            payload.notes, payload.user_id, now,
            payload.financial_account_id.unwrap_or_else(|| "cash_drawer".to_string())
        ],
    )?;

    // Insert items + update stock
    for item in &payload.items {
        let item_id = Uuid::new_v4().to_string();
        let line_total = (item.unit_price * item.qty as f64) - item.discount;

        conn.execute(
            "INSERT INTO sale_items (id,sale_id,product_id,qty,unit_price,unit_cost,discount,line_total)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            rusqlite::params![item_id, sale_id, item.product_id, item.qty, item.unit_price, item.unit_cost, item.discount, line_total],
        )?;

        // Get current stock
        let qty_before: i64 = conn.query_row(
            "SELECT stock_qty FROM products WHERE id=?1",
            rusqlite::params![item.product_id],
            |r| r.get(0),
        )?;
        let qty_after = qty_before - item.qty;

        // Update stock
        conn.execute(
            "UPDATE products SET stock_qty=?2, updated_at=?3 WHERE id=?1",
            rusqlite::params![item.product_id, qty_after, now],
        )?;

        // Log movement
        let mv_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_movements (id,product_id,type,qty_change,qty_before,qty_after,ref_id,user_id)
             VALUES (?1,?2,'sale',?3,?4,?5,?6,?7)",
            rusqlite::params![mv_id, item.product_id, -item.qty, qty_before, qty_after, sale_id, payload.user_id],
        )?;
    }

    // If credit sale (paid < total) and customer_id exists, increase customer debt balance
    let total_paid = payload.cash_amount + payload.card_amount;
    if total_paid < total {
        if let Some(ref cid) = payload.customer_id {
            let debt = total - total_paid;
            conn.execute(
                "UPDATE customers SET balance = balance + ?1 WHERE id = ?2",
                rusqlite::params![debt, cid],
            )?;
        }
    }

    // Increment invoice number
    conn.execute(
        "UPDATE settings SET value=?1 WHERE key='next_invoice_no'",
        rusqlite::params![(next_no + 1).to_string()],
    )?;

    get_sale_by_id(&conn, &sale_id)
}

#[derive(Debug, Deserialize)]
pub struct ReturnItemInput {
    pub sale_item_id: String,
    pub product_id: String,
    pub return_qty: i64,
    pub unit_price: f64,
}

#[derive(Debug, Deserialize)]
pub struct ProcessPartialReturnPayload {
    pub sale_id: String,
    pub items: Vec<ReturnItemInput>,
    pub reason: String,
    pub refund_method: String,
    pub user_id: Option<String>,
}

#[tauri::command]
pub async fn process_sale_partial_return(
    state: State<'_, AppState>,
    payload: ProcessPartialReturnPayload,
) -> Result<(), AppError> {
    let mut conn = state.pool.get()?;
    let tx = conn.transaction()?;
    let now = Utc::now().to_rfc3339();

    let (status, current_total, cust_id): (String, f64, Option<String>) = tx.query_row(
        "SELECT status, total, customer_id FROM sales WHERE id=?1",
        rusqlite::params![payload.sale_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )?;

    if status == "returned" {
        return Err(AppError::Validation("هذه الفاتورة تم إرجاعها مسبقاً بالكامل".into()));
    }

    let mut total_refund = 0.0;

    for item in &payload.items {
        if item.return_qty <= 0 { continue; }
        
        let item_refund = item.return_qty as f64 * item.unit_price;
        total_refund += item_refund;

        // 1. Update sale_item qty
        tx.execute(
            "UPDATE sale_items SET qty = qty - ?1, line_total = line_total - ?2 WHERE id = ?3",
            rusqlite::params![item.return_qty, item_refund, item.sale_item_id],
        )?;

        // 2. Restore stock for product
        let qty_before: i64 = tx.query_row(
            "SELECT stock_qty FROM products WHERE id=?1",
            rusqlite::params![item.product_id],
            |r| r.get(0),
        )?;
        let qty_after = qty_before + item.return_qty;

        tx.execute(
            "UPDATE products SET stock_qty=?1, updated_at=?2 WHERE id=?3",
            rusqlite::params![qty_after, now, item.product_id],
        )?;

        // 3. Log stock movement
        let mv_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, ref_id, reason, user_id, created_at)
             VALUES (?1, ?2, 'return', ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![mv_id, item.product_id, item.return_qty, qty_before, qty_after, payload.sale_id, payload.reason, payload.user_id, now],
        )?;
    }

    // Check remaining items qty
    let remaining_qty: i64 = tx.query_row(
        "SELECT COALESCE(SUM(qty), 0) FROM sale_items WHERE sale_id=?1",
        rusqlite::params![payload.sale_id],
        |r| r.get(0),
    ).unwrap_or(0);

    let new_status = if remaining_qty <= 0 { "returned" } else { "partial_return" };
    let new_total = (current_total - total_refund).max(0.0);

    tx.execute(
        "UPDATE sales SET status=?1, total=?2 WHERE id=?3",
        rusqlite::params![new_status, new_total, payload.sale_id],
    )?;

    // If credit customer debt adjustment
    if payload.refund_method == "credit" {
        if let Some(ref cid) = cust_id {
            tx.execute(
                "UPDATE customers SET balance = balance - ?1 WHERE id = ?2",
                rusqlite::params![total_refund, cid],
            )?;
        }
    }

    // Record return record
    let return_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO returns (id, sale_id, reason, refund_method, total_refund, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![return_id, payload.sale_id, payload.reason, payload.refund_method, total_refund, payload.user_id, now],
    )?;

    tx.commit()?;

    // Log notification to Super Admin
    let user_name: String = if let Some(ref uid) = payload.user_id {
        conn.query_row("SELECT display_name FROM users WHERE id=?1", rusqlite::params![uid], |r| r.get(0)).unwrap_or_else(|_| "موظف".to_string())
    } else {
        "موظف".to_string()
    };
    let notif_title = format!("تسجيل مرتجع مبيعات بقيمة {:.2} ج.م", total_refund);
    let reason_text = if payload.reason.trim().is_empty() { "بدون سبب" } else { payload.reason.trim() };
    let notif_details = format!("قام المستخدم {} بتسجيل مرتجع للفاتورة، السبب: {}", user_name, reason_text);
    let _ = crate::commands::notifications::log_system_notification(&conn, payload.user_id.as_deref(), &user_name, "sales_return", &notif_title, Some(&notif_details));

    Ok(())
}

#[tauri::command]
pub async fn get_sales(
    state: State<'_, AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Sale>, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref df) = date_from {
        if !df.is_empty() {
            conditions.push(format!("date(s.created_at, 'localtime') >= '{}'", df));
        }
    }
    if let Some(ref dt) = date_to {
        if !dt.is_empty() {
            conditions.push(format!("date(s.created_at, 'localtime') <= '{}'", dt));
        }
    }

    let sql = format!(
        "SELECT s.id, s.invoice_no, s.customer_id, c.name, s.status,
                s.subtotal, s.discount, s.total, s.cash_amount, s.card_amount,
                s.change_amount, s.notes, s.created_by, s.created_at
         FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
         WHERE {} ORDER BY s.created_at DESC LIMIT {} OFFSET {}",
        conditions.join(" AND "),
        limit.unwrap_or(1000),
        offset.unwrap_or(0)
    );

    let mut stmt = conn.prepare(&sql)?;
    let mut sales = stmt.query_map([], |row| {
        Ok(Sale {
            id: row.get(0)?,
            invoice_no: row.get(1)?,
            customer_id: row.get(2)?,
            customer_name: row.get(3)?,
            status: row.get(4)?,
            subtotal: row.get(5)?,
            discount: row.get(6)?,
            total: row.get(7)?,
            cash_amount: row.get(8)?,
            card_amount: row.get(9)?,
            change_amount: row.get(10)?,
            notes: row.get(11)?,
            created_by: row.get(12)?,
            created_at: row.get(13)?,
            items: vec![],
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;

    let mut item_stmt = conn.prepare(
        "SELECT si.id, si.sale_id, si.product_id, p.name_ar, b.name,
                si.qty, si.unit_price, si.unit_cost, si.discount, si.line_total
         FROM sale_items si
         JOIN products p ON si.product_id = p.id
         LEFT JOIN brands b ON p.brand_id = b.id
         WHERE si.sale_id = ?1"
    )?;

    for sale in &mut sales {
        if let Ok(rows) = item_stmt.query_map(rusqlite::params![sale.id], |r| {
            Ok(SaleItem {
                id: r.get(0)?, sale_id: r.get(1)?, product_id: r.get(2)?,
                product_name: r.get(3)?, brand_name: r.get(4)?,
                qty: r.get(5)?, unit_price: r.get(6)?, unit_cost: r.get(7)?,
                discount: r.get(8)?, line_total: r.get(9)?,
            })
        }) {
            if let Ok(items) = rows.collect::<Result<Vec<_>, _>>() {
                sale.items = items;
            }
        }
    }

    Ok(sales)
}

#[tauri::command]
pub async fn get_sale(state: State<'_, AppState>, id: String) -> Result<Sale, AppError> {
    let conn = state.pool.get()?;
    get_sale_by_id(&conn, &id)
}

fn get_sale_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Sale, AppError> {
    let sale = conn.query_row(
        "SELECT s.id, s.invoice_no, s.customer_id, c.name, s.status,
                s.subtotal, s.discount, s.total, s.cash_amount, s.card_amount,
                s.change_amount, s.notes, s.created_by, s.created_at
         FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id=?1",
        rusqlite::params![id],
        |row| Ok(Sale {
            id: row.get(0)?, invoice_no: row.get(1)?, customer_id: row.get(2)?,
            customer_name: row.get(3)?, status: row.get(4)?, subtotal: row.get(5)?,
            discount: row.get(6)?, total: row.get(7)?, cash_amount: row.get(8)?,
            card_amount: row.get(9)?, change_amount: row.get(10)?, notes: row.get(11)?,
            created_by: row.get(12)?, created_at: row.get(13)?, items: vec![],
        }),
    ).map_err(AppError::Database)?;

    let mut item_stmt = conn.prepare(
        "SELECT si.id, si.sale_id, si.product_id, p.name_ar, b.name,
                si.qty, si.unit_price, si.unit_cost, si.discount, si.line_total
         FROM sale_items si
         JOIN products p ON si.product_id = p.id
         LEFT JOIN brands b ON p.brand_id = b.id
         WHERE si.sale_id = ?1"
    )?;
    let items = item_stmt.query_map(rusqlite::params![id], |r| {
        Ok(SaleItem {
            id: r.get(0)?, sale_id: r.get(1)?, product_id: r.get(2)?,
            product_name: r.get(3)?, brand_name: r.get(4)?,
            qty: r.get(5)?, unit_price: r.get(6)?, unit_cost: r.get(7)?,
            discount: r.get(8)?, line_total: r.get(9)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(Sale { items, ..sale })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailySummary {
    pub day: String,
    pub sales_count: i64,
    pub sales_revenue: f64,
    pub cogs: f64,
    pub gross_profit: f64,
}

#[tauri::command]
pub async fn get_daily_summary(
    state: State<'_, AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<DailySummary>, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["s.status != 'returned'".to_string()];
    if let Some(ref df) = date_from { conditions.push(format!("date(s.created_at) >= '{}'", df)); }
    if let Some(ref dt) = date_to { conditions.push(format!("date(s.created_at) <= '{}'", dt)); }

    let sql = format!(
        "SELECT date(s.created_at) as day, COUNT(DISTINCT s.id),
                SUM(s.total), SUM(si.qty * si.unit_cost),
                SUM(s.total) - SUM(si.qty * si.unit_cost)
         FROM sales s JOIN sale_items si ON si.sale_id = s.id
         WHERE {} GROUP BY date(s.created_at) ORDER BY day DESC",
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |r| {
        Ok(DailySummary {
            day: r.get(0)?,
            sales_count: r.get(1)?,
            sales_revenue: r.get(2)?,
            cogs: r.get(3)?,
            gross_profit: r.get(4)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailedSaleItemRow {
    pub invoice_no: String,
    pub created_at: String,
    pub customer_name: String,
    pub product_name: String,
    pub brand_name: String,
    pub qty: i64,
    pub unit_price: f64,
    pub discount: f64,
    pub line_total: f64,
    pub cash_amount: f64,
    pub card_amount: f64,
    pub user_display_name: String,
}

#[tauri::command]
pub async fn get_detailed_sale_items_report(
    state: State<'_, AppState>,
    date_from: String,
    date_to: String,
) -> Result<Vec<DetailedSaleItemRow>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT s.invoice_no, s.created_at, COALESCE(c.name, 'عميل نقدي'),
                p.name_ar, COALESCE(b.name, '—'), si.qty, si.unit_price, si.discount, si.line_total,
                s.cash_amount, s.card_amount, COALESCE(u.display_name, 'المدير')
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         LEFT JOIN customers c ON s.customer_id = c.id
         JOIN products p ON si.product_id = p.id
         LEFT JOIN brands b ON p.brand_id = b.id
         LEFT JOIN users u ON s.created_by = u.id
         WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2 AND s.status != 'returned'
         ORDER BY s.created_at DESC"
    )?;

    let rows = stmt.query_map(rusqlite::params![date_from, date_to], |r| {
        Ok(DetailedSaleItemRow {
            invoice_no: r.get(0)?,
            created_at: r.get(1)?,
            customer_name: r.get(2)?,
            product_name: r.get(3)?,
            brand_name: r.get(4)?,
            qty: r.get(5)?,
            unit_price: r.get(6)?,
            discount: r.get(7)?,
            line_total: r.get(8)?,
            cash_amount: r.get(9)?,
            card_amount: r.get(10)?,
            user_display_name: r.get(11)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

