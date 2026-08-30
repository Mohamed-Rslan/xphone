use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub phone2: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub total_spent: Option<f64>,
    pub purchase_count: Option<i64>,
    pub balance: Option<f64>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CustomerPayload {
    pub name: String,
    pub phone: Option<String>,
    pub phone2: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn get_customers(
    state: State<'_, AppState>,
    search: Option<String>,
) -> Result<Vec<Customer>, AppError> {
    let conn = state.pool.get()?;
    let sql = if let Some(ref s) = search {
        format!(
            "SELECT c.id, c.name, c.phone, c.phone2, c.address, c.notes,
                    COALESCE(SUM(sa.total), 0.0), COUNT(DISTINCT sa.id),
                    COALESCE(SUM(CASE WHEN sa.status != 'returned' AND sa.total > (sa.cash_amount + sa.card_amount) THEN (sa.total - (sa.cash_amount + sa.card_amount)) ELSE 0.0 END), 0.0),
                    c.created_at
             FROM customers c
             LEFT JOIN sales sa ON sa.customer_id = c.id AND sa.status != 'returned'
             WHERE c.name LIKE '%{s}%' OR c.phone LIKE '%{s}%'
             GROUP BY c.id ORDER BY c.name"
        )
    } else {
        "SELECT c.id, c.name, c.phone, c.phone2, c.address, c.notes,
                COALESCE(SUM(sa.total), 0.0), COUNT(DISTINCT sa.id),
                COALESCE(SUM(CASE WHEN sa.status != 'returned' AND sa.total > (sa.cash_amount + sa.card_amount) THEN (sa.total - (sa.cash_amount + sa.card_amount)) ELSE 0.0 END), 0.0),
                c.created_at
         FROM customers c
         LEFT JOIN sales sa ON sa.customer_id = c.id AND sa.status != 'returned'
         GROUP BY c.id ORDER BY c.name LIMIT 200".to_string()
    };

    let mut stmt = conn.prepare(&sql)?;
    let customers = stmt.query_map([], |r| {
        Ok(Customer {
            id: r.get(0)?, name: r.get(1)?, phone: r.get(2)?,
            phone2: r.get(3)?, address: r.get(4)?, notes: r.get(5)?,
            total_spent: r.get(6)?, purchase_count: r.get(7)?,
            balance: r.get(8)?, created_at: r.get(9)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(customers)
}

#[tauri::command]
pub async fn create_customer(
    state: State<'_, AppState>,
    payload: CustomerPayload,
) -> Result<Customer, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO customers (id, name, phone, phone2, address, notes, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![id, payload.name, payload.phone, payload.phone2, payload.address, payload.notes, now],
    )?;

    Ok(Customer {
        id, name: payload.name, phone: payload.phone, phone2: payload.phone2,
        address: payload.address, notes: payload.notes,
        total_spent: Some(0.0), purchase_count: Some(0), balance: Some(0.0), created_at: now,
    })
}

#[tauri::command]
pub async fn update_customer(
    state: State<'_, AppState>,
    id: String,
    payload: CustomerPayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute(
        "UPDATE customers SET name=?2, phone=?3, phone2=?4, address=?5, notes=?6 WHERE id=?1",
        rusqlite::params![id, payload.name, payload.phone, payload.phone2, payload.address, payload.notes],
    )?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerHistory {
    pub sales: Vec<serde_json::Value>,
    pub repairs: Vec<serde_json::Value>,
    pub monetary: Vec<serde_json::Value>,
}

#[tauri::command]
pub async fn get_customer_history(
    state: State<'_, AppState>,
    customer_id: String,
) -> Result<CustomerHistory, AppError> {
    let conn = state.pool.get()?;

    let mut sales_stmt = conn.prepare(
        "SELECT id, invoice_no, total, status, created_at FROM sales WHERE customer_id=?1 ORDER BY created_at DESC LIMIT 50"
    )?;
    let sales = sales_stmt.query_map(rusqlite::params![customer_id], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_,String>(0)?,
            "invoice_no": r.get::<_,String>(1)?,
            "total": r.get::<_,f64>(2)?,
            "status": r.get::<_,String>(3)?,
            "created_at": r.get::<_,String>(4)?,
        }))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut repair_stmt = conn.prepare(
        "SELECT id, job_no, device_model, status, total_cost, received_at FROM repair_jobs WHERE customer_id=?1 ORDER BY received_at DESC LIMIT 50"
    )?;
    let repairs = repair_stmt.query_map(rusqlite::params![customer_id], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_,String>(0)?,
            "job_no": r.get::<_,String>(1)?,
            "device_model": r.get::<_,String>(2)?,
            "status": r.get::<_,String>(3)?,
            "total_cost": r.get::<_,f64>(4)?,
            "received_at": r.get::<_,String>(5)?,
        }))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut monetary_stmt = conn.prepare(
        "SELECT mt.id, mst.name_ar, mt.amount, mt.commission, mt.created_at
         FROM monetary_transactions mt JOIN monetary_service_types mst ON mt.service_type_id = mst.id
         WHERE mt.customer_id=?1 ORDER BY mt.created_at DESC LIMIT 50"
    )?;
    let monetary = monetary_stmt.query_map(rusqlite::params![customer_id], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_,String>(0)?,
            "service_name": r.get::<_,String>(1)?,
            "amount": r.get::<_,f64>(2)?,
            "commission": r.get::<_,f64>(3)?,
            "created_at": r.get::<_,String>(4)?,
        }))
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(CustomerHistory { sales, repairs, monetary })
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER INVOICES DEBT SETTLEMENT (سداد وتحصيل مديونيات فواتير العملاء)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnpaidCustomerInvoice {
    pub sale_id: String,
    pub invoice_no: String,
    pub customer_id: String,
    pub customer_name: String,
    pub customer_phone: Option<String>,
    pub created_at: String,
    pub total: f64,
    pub paid_amount: f64,
    pub remaining_amount: f64,
    pub items_summary: String,
}

#[derive(Debug, Deserialize)]
pub struct CustomerInvoiceSettlementItem {
    pub invoice_id: String,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct SettleCustomerInvoicesPayload {
    pub customer_id: String,
    pub settlements: Vec<CustomerInvoiceSettlementItem>,
    pub financial_account_id: String,
    pub notes: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CustomerSettlementResult {
    pub total_settled: f64,
    pub remaining_customer_balance: f64,
    pub customer_name: String,
    pub financial_account_name: String,
}

#[tauri::command]
pub async fn get_unpaid_customer_invoices(
    state: State<'_, AppState>,
    customer_id: Option<String>,
) -> Result<Vec<UnpaidCustomerInvoice>, AppError> {
    let conn = state.pool.get()?;
    let cond = if let Some(ref cid) = customer_id {
        if cid != "all" && !cid.is_empty() {
            format!("AND s.customer_id = '{}'", cid)
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    let sql = format!(
        "SELECT s.id, s.invoice_no, s.customer_id, COALESCE(c.name, 'عميل'),
                c.phone, s.created_at, s.total, (s.cash_amount + s.card_amount) as paid
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.status != 'returned' AND (s.total - (s.cash_amount + s.card_amount)) > 0.001 {}
         ORDER BY s.created_at DESC",
        cond
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |r| {
        let sid: String = r.get(0)?;
        let inv_no: String = r.get(1)?;
        let cid: Option<String> = r.get(2)?;
        let cname: String = r.get(3)?;
        let cphone: Option<String> = r.get(4)?;
        let cat: String = r.get(5)?;
        let tot: f64 = r.get(6)?;
        let paid: f64 = r.get(7)?;
        let remaining = (tot - paid).max(0.0);
        Ok((sid, inv_no, cid.unwrap_or_default(), cname, cphone, cat, tot, paid, remaining))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut result = Vec::new();
    for (sid, inv_no, cid, cname, cphone, cat, tot, paid, remaining) in rows {
        // Fetch items summary
        let mut item_stmt = conn.prepare(
            "SELECT p.name_ar, si.qty FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?1"
        )?;
        let items: Vec<String> = item_stmt.query_map(rusqlite::params![sid], |ir| {
            let name: String = ir.get(0)?;
            let qty: i64 = ir.get(1)?;
            Ok(format!("{} ({}×)", name, qty))
        })?.collect::<Result<Vec<_>, _>>()?;

        let items_summary = if items.is_empty() { "—".to_string() } else { items.join(" • ") };

        result.push(UnpaidCustomerInvoice {
            sale_id: sid,
            invoice_no: inv_no,
            customer_id: cid,
            customer_name: cname,
            customer_phone: cphone,
            created_at: cat,
            total: tot,
            paid_amount: paid,
            remaining_amount: remaining,
            items_summary,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn settle_customer_invoices(
    state: State<'_, AppState>,
    payload: SettleCustomerInvoicesPayload,
) -> Result<CustomerSettlementResult, AppError> {
    let total_settled: f64 = payload.settlements.iter().map(|s| s.amount).sum();
    if total_settled <= 0.0 {
        return Err(AppError::Validation("يجب أن يكون إجمالي مبلغ السداد أكبر من صفر".into()));
    }

    let mut conn = state.pool.get()?;
    let tx = conn.transaction()?;
    let now = Utc::now().to_rfc3339();

    let cust_name: String = tx.query_row(
        "SELECT name FROM customers WHERE id = ?1",
        rusqlite::params![payload.customer_id], |r| r.get(0)
    ).unwrap_or_else(|_| "عميل".to_string());

    let acc_name: String = tx.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id = ?1",
        rusqlite::params![payload.financial_account_id], |r| r.get(0)
    ).unwrap_or_else(|_| "الخزينة الرئيسية".to_string());

    for item in &payload.settlements {
        if item.amount <= 0.0 { continue; }

        let inv_no: String = tx.query_row(
            "SELECT invoice_no FROM sales WHERE id = ?1",
            rusqlite::params![item.invoice_id], |r| r.get(0)
        ).unwrap_or_else(|_| "—".to_string());

        // Update sales invoice paid amount
        tx.execute(
            "UPDATE sales SET cash_amount = cash_amount + ?1 WHERE id = ?2",
            rusqlite::params![item.amount, item.invoice_id],
        )?;

        // Record customer payment
        let payment_id = Uuid::new_v4().to_string();
        let notes_text = match &payload.notes {
            Some(n) if !n.trim().is_empty() => format!("سداد فاتورة مبيعات رقم {}: {}", inv_no, n.trim()),
            _ => format!("سداد فاتورة مبيعات رقم {}", inv_no),
        };

        tx.execute(
            "INSERT INTO customer_payments (id, customer_id, amount, financial_account_id, notes, created_by, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                payment_id, payload.customer_id, item.amount,
                payload.financial_account_id, notes_text, payload.user_id, now
            ],
        )?;
    }

    // Update customer's balance
    tx.execute(
        "UPDATE customers SET balance = MAX(0.0, balance - ?1) WHERE id = ?2",
        rusqlite::params![total_settled, payload.customer_id],
    )?;

    // Calculate real remaining balance
    let remaining_customer_balance: f64 = tx.query_row(
        "SELECT COALESCE(SUM(CASE WHEN status != 'returned' AND total > (cash_amount + card_amount) THEN (total - (cash_amount + card_amount)) ELSE 0.0 END), 0.0)
         FROM sales WHERE customer_id = ?1",
        rusqlite::params![payload.customer_id], |r| r.get(0)
    ).unwrap_or(0.0);

    tx.commit()?;

    Ok(CustomerSettlementResult {
        total_settled,
        remaining_customer_balance,
        customer_name: cust_name,
        financial_account_name: acc_name,
    })
}
