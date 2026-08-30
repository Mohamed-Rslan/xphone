use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Supplier {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub balance: f64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseOrder {
    pub id: String,
    pub invoice_no: Option<String>,
    pub supplier_id: String,
    pub supplier_name: String,
    pub status: String,
    pub total_cost: f64,
    pub amount_paid: f64,
    pub financial_account_id: Option<String>,
    pub financial_account_name: Option<String>,
    pub notes: Option<String>,
    pub ordered_at: Option<String>,
    pub received_at: Option<String>,
    pub created_at: String,
    pub items: Vec<PurchaseOrderItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseOrderItem {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub qty_ordered: f64,
    pub qty_received: f64,
    pub unit_cost: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseReturnRecord {
    pub id: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub purchase_order_id: Option<String>,
    pub total_amount: f64,
    pub refund_type: String, // "cash" | "credit_reduction"
    pub financial_account_id: Option<String>,
    pub financial_account_name: Option<String>,
    pub reason: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
    pub items: Vec<PurchaseReturnItemRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseReturnItemRecord {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub qty: f64,
    pub unit_cost: f64,
    pub total_cost: f64,
}

#[derive(Debug, Deserialize)]
pub struct SupplierPayload {
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PurchaseInvoiceItemPayload {
    pub product_id: String,
    pub qty: f64,
    pub unit_cost: f64,
}

#[derive(Debug, Deserialize)]
pub struct RecordPurchaseInvoicePayload {
    pub supplier_id: String,
    pub invoice_no: Option<String>,
    pub items: Vec<PurchaseInvoiceItemPayload>,
    pub payment_type: String, // "cash" | "credit" | "split"
    pub paid_amount: f64,
    pub financial_account_id: Option<String>,
    pub notes: Option<String>,
    pub user_id: Option<String>,
    pub invoice_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PurchaseReturnItemPayload {
    pub product_id: String,
    pub qty: f64,
    pub unit_cost: f64,
}

#[derive(Debug, Deserialize)]
pub struct RecordPurchaseReturnPayload {
    pub supplier_id: String,
    pub purchase_order_id: Option<String>,
    pub items: Vec<PurchaseReturnItemPayload>,
    pub refund_type: String, // "cash" | "credit_reduction"
    pub refund_amount: f64,
    pub financial_account_id: Option<String>,
    pub reason: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePOPayload {
    pub supplier_id: String,
    pub items: Vec<POItemPayload>,
    pub notes: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct POItemPayload {
    pub product_id: String,
    pub qty_ordered: i64,
    pub unit_cost: f64,
}

#[derive(Debug, Deserialize)]
pub struct ReceivePOPayload {
    pub purchase_order_id: String,
    pub items: Vec<ReceiveItemPayload>,
    pub amount_paid: f64,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReceiveItemPayload {
    pub item_id: String,
    pub product_id: String,
    pub qty_received: i64,
}

// ─── Suppliers ──────────────────────────────────────────────────

#[tauri::command]
pub async fn get_suppliers(state: State<'_, AppState>) -> Result<Vec<Supplier>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, name, phone, address, notes, balance, created_at FROM suppliers ORDER BY name ASC"
    )?;
    let suppliers = stmt.query_map([], |r| {
        Ok(Supplier {
            id: r.get(0)?, name: r.get(1)?, phone: r.get(2)?,
            address: r.get(3)?, notes: r.get(4)?, balance: r.get(5)?,
            created_at: r.get(6)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(suppliers)
}

#[tauri::command]
pub async fn create_supplier(
    state: State<'_, AppState>,
    payload: SupplierPayload,
) -> Result<Supplier, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO suppliers (id, name, phone, address, notes, created_at) VALUES (?1,?2,?3,?4,?5,?6)",
        rusqlite::params![id, payload.name, payload.phone, payload.address, payload.notes, now],
    )?;
    Ok(Supplier { id, name: payload.name, phone: payload.phone, address: payload.address, notes: payload.notes, balance: 0.0, created_at: now })
}

#[tauri::command]
pub async fn update_supplier(
    state: State<'_, AppState>,
    id: String,
    payload: SupplierPayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute(
        "UPDATE suppliers SET name=?2, phone=?3, address=?4, notes=?5 WHERE id=?1",
        rusqlite::params![id, payload.name, payload.phone, payload.address, payload.notes],
    )?;
    Ok(())
}

// ─── Purchase Invoices (تسجيل فواتير الشراء وإضافتها للمخزون LIFO) ─────────────────

#[tauri::command]
pub async fn record_purchase_invoice(
    state: State<'_, AppState>,
    payload: RecordPurchaseInvoicePayload,
) -> Result<PurchaseOrder, AppError> {
    if payload.items.is_empty() {
        return Err(AppError::Validation("يجب أن تحتوي فاتورة الشراء على صنف واحد على الأقل".into()));
    }

    let conn = state.pool.get()?;
    let po_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let inv_date = payload.invoice_date.unwrap_or_else(|| now.clone());

    let auto_inv_no = payload.invoice_no.unwrap_or_else(|| {
        format!("PINV-{}", &po_id[..8].to_uppercase())
    });

    let total_cost: f64 = payload.items.iter().map(|i| i.qty * i.unit_cost).sum();
    let paid_amount = payload.paid_amount.clamp(0.0, total_cost);
    let unpaid_amount = total_cost - paid_amount;
    let target_account_id = payload.financial_account_id.clone().unwrap_or_else(|| "cash_drawer".to_string());

    // Validate created_by user FK
    let valid_user_id: Option<String> = if let Some(ref uid) = payload.user_id {
        let exists: i64 = conn.query_row(
            "SELECT COUNT(1) FROM users WHERE id=?1",
            rusqlite::params![uid],
            |r| r.get(0),
        ).unwrap_or(0);
        if exists > 0 { Some(uid.clone()) } else { None }
    } else {
        None
    };

    // 1. Insert Purchase Order as 'received'
    conn.execute(
        "INSERT INTO purchase_orders (id, supplier_id, invoice_no, status, total_cost, amount_paid, financial_account_id, notes, ordered_at, received_at, created_by, created_at)
         VALUES (?1, ?2, ?3, 'received', ?4, ?5, ?6, ?7, ?8, ?8, ?9, ?8)",
        rusqlite::params![
            po_id, payload.supplier_id, auto_inv_no, total_cost, paid_amount,
            target_account_id, payload.notes, inv_date, valid_user_id
        ],
    )?;

    // 2. Insert items, update inventory stock, and update cost price according to LIFO (Last In Cost)
    let mut order_items = Vec::new();
    for item in &payload.items {
        if item.qty <= 0.0 { continue; }
        let item_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO purchase_order_items (id, purchase_order_id, product_id, qty_ordered, qty_received, unit_cost)
             VALUES (?1, ?2, ?3, ?4, ?4, ?5)",
            rusqlite::params![item_id, po_id, item.product_id, item.qty, item.unit_cost],
        )?;

        // Stock quantity update
        let qty_before: f64 = conn.query_row(
            "SELECT stock_qty FROM products WHERE id=?1",
            rusqlite::params![item.product_id],
            |r| r.get(0),
        ).unwrap_or(0.0);

        let qty_after = qty_before + item.qty;

        // Update product cost_price (LIFO / Last Purchase Price) and stock
        conn.execute(
            "UPDATE products SET stock_qty = ?2, cost_price = ?3, updated_at = ?4 WHERE id = ?1",
            rusqlite::params![item.product_id, qty_after, item.unit_cost, now],
        )?;

        // Stock movement log
        let mv_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, ref_id, user_id)
             VALUES (?1, ?2, 'purchase', ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![mv_id, item.product_id, item.qty, qty_before, qty_after, po_id, valid_user_id],
        )?;

        let prod_name: String = conn.query_row(
            "SELECT name_ar FROM products WHERE id=?1",
            rusqlite::params![item.product_id],
            |r| r.get(0),
        ).unwrap_or_else(|_| "صنف".to_string());

        order_items.push(PurchaseOrderItem {
            id: item_id,
            product_id: item.product_id.clone(),
            product_name: prod_name,
            qty_ordered: item.qty,
            qty_received: item.qty,
            unit_cost: item.unit_cost,
        });
    }

    // 3. Financial Settlement:
    // If there is cash paid from financial account, log in supplier_payments
    if paid_amount > 0.0 {
        let payment_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO supplier_payments (id, supplier_id, purchase_order_id, amount, method, notes, paid_at, created_by, financial_account_id)
             VALUES (?1, ?2, ?3, ?4, 'cash', ?5, ?6, ?7, ?8)",
            rusqlite::params![
                payment_id, payload.supplier_id, po_id, paid_amount,
                payload.notes.as_ref().map(|n| format!("سداد فاتورة مشتريات رقم {}: {}", auto_inv_no, n)),
                inv_date, valid_user_id, target_account_id
            ],
        )?;
    }

    // If there is unpaid amount (credit purchase / آجل), add to supplier balance
    if unpaid_amount > 0.0 {
        conn.execute(
            "UPDATE suppliers SET balance = balance + ?1 WHERE id = ?2",
            rusqlite::params![unpaid_amount, payload.supplier_id],
        )?;
    }

    let supplier_name: String = conn.query_row(
        "SELECT name FROM suppliers WHERE id=?1",
        rusqlite::params![payload.supplier_id],
        |r| r.get(0),
    ).unwrap_or_else(|_| "مورد".to_string());

    let acc_name: Option<String> = conn.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id=?1",
        rusqlite::params![target_account_id],
        |r| r.get(0),
    ).ok();

    // Log sensitive action notification for Super Admin
    let user_name: String = if let Some(ref uid) = valid_user_id {
        conn.query_row("SELECT display_name FROM users WHERE id=?1", rusqlite::params![uid], |r| r.get(0)).unwrap_or_else(|_| "موظف".to_string())
    } else {
        "موظف".to_string()
    };
    let notif_title = format!("فاتورة مشتريات جديدة بقيمة {:.2} ج.م", total_cost);
    let notif_details = format!("قام المستخدم {} بتسجيل فاتورة شراء برقم {} من المورد {}", user_name, auto_inv_no, supplier_name);
    let _ = crate::commands::notifications::log_system_notification(&conn, valid_user_id.as_deref(), &user_name, "purchases_create", &notif_title, Some(&notif_details));

    Ok(PurchaseOrder {
        id: po_id,
        invoice_no: Some(auto_inv_no),
        supplier_id: payload.supplier_id,
        supplier_name,
        status: "received".into(),
        total_cost,
        amount_paid: paid_amount,
        financial_account_id: Some(target_account_id),
        financial_account_name: acc_name,
        notes: payload.notes,
        ordered_at: Some(inv_date.clone()),
        received_at: Some(inv_date.clone()),
        created_at: inv_date,
        items: order_items,
    })
}

// ─── Purchase Returns (تسجيل مرتجعات الشراء وخصم المخزون وتسوية الحسابات) ──────────

#[tauri::command]
pub async fn record_purchase_return(
    state: State<'_, AppState>,
    payload: RecordPurchaseReturnPayload,
) -> Result<PurchaseReturnRecord, AppError> {
    if payload.items.is_empty() {
        return Err(AppError::Validation("يجب تحديد صنف واحد على الأقل للمرتجع".into()));
    }

    let conn = state.pool.get()?;
    let return_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let total_amount: f64 = if payload.refund_amount > 0.0 {
        payload.refund_amount
    } else {
        payload.items.iter().map(|i| i.qty * i.unit_cost).sum()
    };

    let target_account_id = payload.financial_account_id.clone().unwrap_or_else(|| "cash_drawer".to_string());

    // Validate user FK
    let valid_user_id: Option<String> = if let Some(ref uid) = payload.user_id {
        let exists: i64 = conn.query_row(
            "SELECT COUNT(1) FROM users WHERE id=?1",
            rusqlite::params![uid],
            |r| r.get(0),
        ).unwrap_or(0);
        if exists > 0 { Some(uid.clone()) } else { None }
    } else {
        None
    };

    // 1. Insert Purchase Return parent
    conn.execute(
        "INSERT INTO purchase_returns (id, supplier_id, purchase_order_id, total_amount, refund_type, financial_account_id, reason, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            return_id, payload.supplier_id, payload.purchase_order_id, total_amount,
            payload.refund_type, target_account_id, payload.reason, valid_user_id, now
        ],
    )?;

    // 2. Insert items and deduct from stock
    let mut return_items_records = Vec::new();
    for item in &payload.items {
        if item.qty <= 0.0 { continue; }
        let item_id = Uuid::new_v4().to_string();
        let item_total = item.qty * item.unit_cost;

        conn.execute(
            "INSERT INTO purchase_return_items (id, purchase_return_id, product_id, qty, unit_cost, total_cost)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![item_id, return_id, item.product_id, item.qty, item.unit_cost, item_total],
        )?;

        // Update product stock (deduct returned units)
        let qty_before: f64 = conn.query_row(
            "SELECT stock_qty FROM products WHERE id=?1",
            rusqlite::params![item.product_id],
            |r| r.get(0),
        ).unwrap_or(0.0);

        let qty_after = (qty_before - item.qty).max(0.0);

        conn.execute(
            "UPDATE products SET stock_qty = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params![item.product_id, qty_after, now],
        )?;

        // Stock movement log
        let mv_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, ref_id, user_id)
             VALUES (?1, ?2, 'purchase_return', ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![mv_id, item.product_id, -item.qty, qty_before, qty_after, return_id, valid_user_id],
        )?;

        let prod_name: String = conn.query_row(
            "SELECT name_ar FROM products WHERE id=?1",
            rusqlite::params![item.product_id],
            |r| r.get(0),
        ).unwrap_or_else(|_| "صنف".to_string());

        return_items_records.push(PurchaseReturnItemRecord {
            id: item_id,
            product_id: item.product_id.clone(),
            product_name: prod_name,
            qty: item.qty,
            unit_cost: item.unit_cost,
            total_cost: item_total,
        });
    }

    // 3. Accounting Settlement:
    // If refund_type is 'credit_reduction' -> deduct from supplier payable balance
    if payload.refund_type == "credit_reduction" {
        conn.execute(
            "UPDATE suppliers SET balance = MAX(0.0, balance - ?1) WHERE id = ?2",
            rusqlite::params![total_amount, payload.supplier_id],
        )?;
    }

    let supplier_name: String = conn.query_row(
        "SELECT name FROM suppliers WHERE id=?1",
        rusqlite::params![payload.supplier_id],
        |r| r.get(0),
    ).unwrap_or_else(|_| "مورد".to_string());

    let acc_name: Option<String> = conn.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id=?1",
        rusqlite::params![target_account_id],
        |r| r.get(0),
    ).ok();

    Ok(PurchaseReturnRecord {
        id: return_id,
        supplier_id: payload.supplier_id,
        supplier_name,
        purchase_order_id: payload.purchase_order_id,
        total_amount,
        refund_type: payload.refund_type,
        financial_account_id: Some(target_account_id),
        financial_account_name: acc_name,
        reason: payload.reason,
        created_by: valid_user_id,
        created_at: now,
        items: return_items_records,
    })
}

#[tauri::command]
pub async fn get_purchase_returns(
    state: State<'_, AppState>,
    supplier_id: Option<String>,
) -> Result<Vec<PurchaseReturnRecord>, AppError> {
    let conn = state.pool.get()?;
    let cond = if supplier_id.is_some() { "AND pr.supplier_id = ?1" } else { "" };
    let sql = format!(
        "SELECT pr.id, pr.supplier_id, s.name, pr.purchase_order_id, pr.total_amount,
                pr.refund_type, pr.financial_account_id, fa.name_ar, pr.reason, pr.created_by, pr.created_at
         FROM purchase_returns pr
         JOIN suppliers s ON pr.supplier_id = s.id
         LEFT JOIN financial_accounts fa ON pr.financial_account_id = fa.id
         WHERE 1=1 {} ORDER BY pr.created_at DESC",
        cond
    );
    let mut stmt = conn.prepare(&sql)?;
    let returns = if let Some(sid) = supplier_id {
        stmt.query_map(rusqlite::params![sid], map_purchase_return)
    } else {
        stmt.query_map([], map_purchase_return)
    }?.collect::<Result<Vec<_>, _>>()?;

    Ok(returns)
}

fn map_purchase_return(r: &rusqlite::Row) -> rusqlite::Result<PurchaseReturnRecord> {
    Ok(PurchaseReturnRecord {
        id: r.get(0)?,
        supplier_id: r.get(1)?,
        supplier_name: r.get(2)?,
        purchase_order_id: r.get(3)?,
        total_amount: r.get(4)?,
        refund_type: r.get(5)?,
        financial_account_id: r.get(6)?,
        financial_account_name: r.get(7)?,
        reason: r.get(8)?,
        created_by: r.get(9)?,
        created_at: r.get(10)?,
        items: vec![],
    })
}

// ─── Purchase Orders Listing ─────────────────────────────────────

#[tauri::command]
pub async fn get_purchase_orders(
    state: State<'_, AppState>,
    supplier_id: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PurchaseOrder>, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref sid) = supplier_id {
        conditions.push(format!("po.supplier_id = '{sid}'"));
    }
    if let Some(ref df) = date_from {
        conditions.push(format!("date(po.created_at) >= '{df}'"));
    }
    if let Some(ref dt) = date_to {
        conditions.push(format!("date(po.created_at) <= '{dt}'"));
    }

    let sql = format!(
        "SELECT po.id, po.supplier_id, s.name, po.status, po.total_cost, po.amount_paid,
                po.notes, po.ordered_at, po.received_at, po.created_at, po.invoice_no,
                po.financial_account_id, fa.name_ar
         FROM purchase_orders po
         JOIN suppliers s ON po.supplier_id = s.id
         LEFT JOIN financial_accounts fa ON po.financial_account_id = fa.id
         WHERE {} ORDER BY po.created_at DESC",
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let mut orders = stmt.query_map([], map_po)?.collect::<Result<Vec<_>, _>>()?;

    // Load items for each order
    for order in &mut orders {
        let mut item_stmt = conn.prepare(
            "SELECT poi.id, poi.product_id, COALESCE(p.name_ar, 'صنف'), poi.qty_ordered, poi.qty_received, poi.unit_cost
             FROM purchase_order_items poi
             LEFT JOIN products p ON poi.product_id = p.id
             WHERE poi.purchase_order_id = ?1"
        )?;
        let items = item_stmt.query_map(rusqlite::params![order.id], |r| {
            Ok(PurchaseOrderItem {
                id: r.get(0)?,
                product_id: r.get(1)?,
                product_name: r.get(2)?,
                qty_ordered: r.get(3)?,
                qty_received: r.get(4)?,
                unit_cost: r.get(5)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        order.items = items;
    }

    Ok(orders)
}

fn map_po(r: &rusqlite::Row) -> rusqlite::Result<PurchaseOrder> {
    Ok(PurchaseOrder {
        id: r.get(0)?, supplier_id: r.get(1)?, supplier_name: r.get(2)?,
        status: r.get(3)?, total_cost: r.get(4)?, amount_paid: r.get(5)?,
        notes: r.get(6)?, ordered_at: r.get(7)?, received_at: r.get(8)?,
        created_at: r.get(9)?, invoice_no: r.get(10).ok(),
        financial_account_id: r.get(11).ok(),
        financial_account_name: r.get(12).ok(),
        items: vec![],
    })
}

#[tauri::command]
pub async fn create_purchase_order(
    state: State<'_, AppState>,
    payload: CreatePOPayload,
) -> Result<PurchaseOrder, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let total: f64 = payload.items.iter().map(|i| i.qty_ordered as f64 * i.unit_cost).sum();

    conn.execute(
        "INSERT INTO purchase_orders (id, supplier_id, total_cost, notes, created_by, created_at)
         VALUES (?1,?2,?3,?4,?5,?6)",
        rusqlite::params![id, payload.supplier_id, total, payload.notes, payload.user_id, now],
    )?;

    for item in &payload.items {
        let item_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO purchase_order_items (id, purchase_order_id, product_id, qty_ordered, unit_cost)
             VALUES (?1,?2,?3,?4,?5)",
            rusqlite::params![item_id, id, item.product_id, item.qty_ordered, item.unit_cost],
        )?;
    }

    // Update supplier balance
    conn.execute(
        "UPDATE suppliers SET balance = balance + ?1 WHERE id = ?2",
        rusqlite::params![total, payload.supplier_id],
    )?;

    let supplier_name: String = conn.query_row(
        "SELECT name FROM suppliers WHERE id=?1", rusqlite::params![payload.supplier_id], |r| r.get(0),
    )?;

    Ok(PurchaseOrder {
        id, invoice_no: None, supplier_id: payload.supplier_id, supplier_name, status: "draft".into(),
        total_cost: total, amount_paid: 0.0, financial_account_id: None,
        financial_account_name: None, notes: payload.notes,
        ordered_at: None, received_at: None, created_at: now, items: vec![],
    })
}

#[tauri::command]
pub async fn receive_purchase_order(
    state: State<'_, AppState>,
    payload: ReceivePOPayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let now = Utc::now().to_rfc3339();

    for item in &payload.items {
        // Update received qty on item
        conn.execute(
            "UPDATE purchase_order_items SET qty_received = qty_received + ?1 WHERE id = ?2",
            rusqlite::params![item.qty_received, item.item_id],
        )?;

        // Update product stock and LIFO unit cost
        let (qty_before, unit_cost): (f64, f64) = conn.query_row(
            "SELECT p.stock_qty, poi.unit_cost FROM products p JOIN purchase_order_items poi ON poi.product_id = p.id WHERE poi.id = ?1",
            rusqlite::params![item.item_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap_or((0.0, 0.0));

        let qty_after = qty_before + item.qty_received as f64;
        conn.execute(
            "UPDATE products SET stock_qty=?2, cost_price=?3, updated_at=?4 WHERE id=?1",
            rusqlite::params![item.product_id, qty_after, unit_cost, now],
        )?;

        // Stock movement log
        let mv_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_movements (id,product_id,type,qty_change,qty_before,qty_after,ref_id,user_id)
             VALUES (?1,?2,'purchase',?3,?4,?5,?6,?7)",
            rusqlite::params![mv_id, item.product_id, item.qty_received, qty_before, qty_after,
                payload.purchase_order_id, payload.user_id],
        )?;
    }

    // Check if fully received
    let (total_ordered, total_received): (f64, f64) = conn.query_row(
        "SELECT SUM(qty_ordered), SUM(qty_received) FROM purchase_order_items WHERE purchase_order_id=?1",
        rusqlite::params![payload.purchase_order_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0.0, 0.0));

    let new_status = if total_received >= total_ordered { "received" } else { "partial" };

    conn.execute(
        "UPDATE purchase_orders SET status=?2, amount_paid=amount_paid+?3,
         received_at=CASE WHEN ?2='received' THEN ?4 ELSE received_at END WHERE id=?1",
        rusqlite::params![payload.purchase_order_id, new_status, payload.amount_paid, now],
    )?;

    // Reduce supplier balance by amount paid
    let supplier_id: String = conn.query_row(
        "SELECT supplier_id FROM purchase_orders WHERE id=?1",
        rusqlite::params![payload.purchase_order_id], |r| r.get(0),
    )?;
    conn.execute(
        "UPDATE suppliers SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![payload.amount_paid, supplier_id],
    )?;

    Ok(())
}

#[tauri::command]
pub async fn get_purchase_order_items(
    state: State<'_, AppState>,
    po_id: String,
) -> Result<Vec<PurchaseOrderItem>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT poi.id, poi.product_id, p.name_ar, poi.qty_ordered, poi.qty_received, poi.unit_cost
         FROM purchase_order_items poi
         JOIN products p ON poi.product_id = p.id
         WHERE poi.purchase_order_id = ?1"
    )?;
    let items = stmt.query_map(rusqlite::params![po_id], |r| {
        Ok(PurchaseOrderItem {
            id: r.get(0)?, product_id: r.get(1)?, product_name: r.get(2)?,
            qty_ordered: r.get(3)?, qty_received: r.get(4)?, unit_cost: r.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER INVOICES DEBT SETTLEMENT (سداد مستحقات وفواتير الموردين)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnpaidSupplierInvoice {
    pub purchase_order_id: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub supplier_phone: Option<String>,
    pub order_no: Option<String>,
    pub created_at: String,
    pub total_cost: f64,
    pub amount_paid: f64,
    pub remaining_amount: f64,
    pub items_summary: String,
}

#[derive(Debug, Deserialize)]
pub struct SupplierInvoiceSettlementItem {
    pub invoice_id: String,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct SettleSupplierInvoicesPayload {
    pub supplier_id: String,
    pub settlements: Vec<SupplierInvoiceSettlementItem>,
    pub financial_account_id: String,
    pub notes: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SupplierSettlementResult {
    pub total_settled: f64,
    pub remaining_supplier_balance: f64,
    pub supplier_name: String,
    pub financial_account_name: String,
}

#[tauri::command]
pub async fn get_unpaid_supplier_invoices(
    state: State<'_, AppState>,
    supplier_id: Option<String>,
) -> Result<Vec<UnpaidSupplierInvoice>, AppError> {
    let conn = state.pool.get()?;
    let cond = if let Some(ref sid) = supplier_id {
        if sid != "all" && !sid.is_empty() {
            format!("AND po.supplier_id = '{}'", sid)
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    let sql = format!(
        "SELECT po.id, po.supplier_id, s.name, s.phone, po.notes,
                po.created_at, po.total_cost, po.amount_paid
         FROM purchase_orders po
         JOIN suppliers s ON po.supplier_id = s.id
         WHERE po.status != 'cancelled' AND (po.total_cost - po.amount_paid) > 0.001 {}
         ORDER BY po.created_at DESC",
        cond
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |r| {
        let poid: String = r.get(0)?;
        let sid: String = r.get(1)?;
        let sname: String = r.get(2)?;
        let sphone: Option<String> = r.get(3)?;
        let notes: Option<String> = r.get(4)?;
        let cat: String = r.get(5)?;
        let tot: f64 = r.get(6)?;
        let paid: f64 = r.get(7)?;
        let remaining = (tot - paid).max(0.0);
        Ok((poid, sid, sname, sphone, notes, cat, tot, paid, remaining))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut result = Vec::new();
    for (poid, sid, sname, sphone, notes, cat, tot, paid, remaining) in rows {
        // Fetch items summary
        let mut item_stmt = conn.prepare(
            "SELECT p.name_ar, poi.qty_ordered FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id WHERE poi.purchase_order_id = ?1"
        )?;
        let items: Vec<String> = item_stmt.query_map(rusqlite::params![poid], |ir| {
            let name: String = ir.get(0)?;
            let qty: f64 = ir.get(1)?;
            Ok(format!("{} ({}×)", name, qty))
        })?.collect::<Result<Vec<_>, _>>()?;

        let items_summary = if items.is_empty() { "—".to_string() } else { items.join(" • ") };

        result.push(UnpaidSupplierInvoice {
            purchase_order_id: poid,
            supplier_id: sid,
            supplier_name: sname,
            supplier_phone: sphone,
            order_no: notes,
            created_at: cat,
            total_cost: tot,
            amount_paid: paid,
            remaining_amount: remaining,
            items_summary,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn settle_supplier_invoices(
    state: State<'_, AppState>,
    payload: SettleSupplierInvoicesPayload,
) -> Result<SupplierSettlementResult, AppError> {
    let total_settled: f64 = payload.settlements.iter().map(|s| s.amount).sum();
    if total_settled <= 0.0 {
        return Err(AppError::Validation("يجب أن يكون إجمالي مبلغ السداد أكبر من صفر".into()));
    }

    let mut conn = state.pool.get()?;
    let tx = conn.transaction()?;
    let now = Utc::now().to_rfc3339();

    let supp_name: String = tx.query_row(
        "SELECT name FROM suppliers WHERE id = ?1",
        rusqlite::params![payload.supplier_id], |r| r.get(0)
    ).unwrap_or_else(|_| "مورد".to_string());

    let acc_name: String = tx.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id = ?1",
        rusqlite::params![payload.financial_account_id], |r| r.get(0)
    ).unwrap_or_else(|_| "الخزينة الرئيسية".to_string());

    for item in &payload.settlements {
        if item.amount <= 0.0 { continue; }

        let po_notes: Option<String> = tx.query_row(
            "SELECT notes FROM purchase_orders WHERE id = ?1",
            rusqlite::params![item.invoice_id], |r| r.get(0)
        ).unwrap_or(None);

        // Update purchase order paid amount
        tx.execute(
            "UPDATE purchase_orders SET amount_paid = amount_paid + ?1 WHERE id = ?2",
            rusqlite::params![item.amount, item.invoice_id],
        )?;

        // Record supplier payment
        let payment_id = Uuid::new_v4().to_string();
        let inv_label = po_notes.unwrap_or_else(|| "فاتورة مشتريات".to_string());
        let notes_text = match &payload.notes {
            Some(n) if !n.trim().is_empty() => format!("سداد {} - {}", inv_label, n.trim()),
            _ => format!("سداد {}", inv_label),
        };

        tx.execute(
            "INSERT INTO supplier_payments (id, supplier_id, purchase_order_id, amount, method, notes, paid_at, created_by, financial_account_id)
             VALUES (?1, ?2, ?3, ?4, 'cash', ?5, ?6, ?7, ?8)",
            rusqlite::params![
                payment_id, payload.supplier_id, item.invoice_id, item.amount,
                notes_text, now, payload.user_id, payload.financial_account_id
            ],
        )?;
    }

    // Update supplier balance
    tx.execute(
        "UPDATE suppliers SET balance = MAX(0.0, balance - ?1) WHERE id = ?2",
        rusqlite::params![total_settled, payload.supplier_id],
    )?;

    // Calculate real remaining balance
    let remaining_supplier_balance: f64 = tx.query_row(
        "SELECT COALESCE(SUM(CASE WHEN status != 'cancelled' AND total_cost > amount_paid THEN (total_cost - amount_paid) ELSE 0.0 END), 0.0)
         FROM purchase_orders WHERE supplier_id = ?1",
        rusqlite::params![payload.supplier_id], |r| r.get(0)
    ).unwrap_or(0.0);

    tx.commit()?;

    Ok(SupplierSettlementResult {
        total_settled,
        remaining_supplier_balance,
        supplier_name: supp_name,
        financial_account_name: acc_name,
    })
}
