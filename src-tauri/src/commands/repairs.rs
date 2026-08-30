use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepairJob {
    pub id: String,
    pub job_no: String,
    pub customer_id: String,
    pub customer_name: String,
    pub customer_phone: Option<String>,
    pub device_brand_id: Option<i64>,
    pub device_brand_name: Option<String>,
    pub device_model: String,
    pub device_color: Option<String>,
    pub device_condition: Option<String>,
    pub fault_desc: String,
    pub technician_notes: Option<String>,
    pub status: String,
    pub labor_cost: f64,
    pub parts_cost: f64,
    pub total_cost: f64,
    pub amount_paid: f64,
    pub received_at: String,
    pub delivered_at: Option<String>,
    pub parts: Vec<RepairPartDetail>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepairPartDetail {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub qty: i64,
    pub unit_cost: f64,
}

#[derive(Debug, Deserialize)]
pub struct RepairJobPayload {
    pub customer_id: String,
    pub device_brand_id: Option<i64>,
    pub device_model: String,
    pub device_color: Option<String>,
    pub device_condition: Option<String>,
    pub fault_desc: String,
    pub labor_cost: f64,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddRepairPartPayload {
    pub repair_job_id: String,
    pub product_id: String,
    pub qty: i64,
    pub unit_cost: f64,
    pub user_id: Option<String>,
}

#[tauri::command]
pub async fn get_repair_jobs(
    state: State<'_, AppState>,
    status: Option<String>,
    search: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<RepairJob>, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref s) = status { conditions.push(format!("r.status = '{}'", s)); }
    if let Some(ref q) = search {
        conditions.push(format!("(c.name LIKE '%{q}%' OR r.job_no LIKE '%{q}%' OR r.device_model LIKE '%{q}%')"));
    }
    if let Some(ref df) = date_from { conditions.push(format!("date(r.received_at) >= '{}'", df)); }
    if let Some(ref dt) = date_to { conditions.push(format!("date(r.received_at) <= '{}'", dt)); }

    let sql = format!(
        "SELECT r.id, r.job_no, r.customer_id, c.name, c.phone,
                r.device_brand_id, b.name, r.device_model, r.device_color,
                r.device_condition, r.fault_desc, r.technician_notes, r.status,
                r.labor_cost, r.parts_cost, r.total_cost, r.amount_paid,
                r.received_at, r.delivered_at
         FROM repair_jobs r
         JOIN customers c ON r.customer_id = c.id
         LEFT JOIN brands b ON r.device_brand_id = b.id
         WHERE {} ORDER BY r.received_at DESC",
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let jobs = stmt.query_map([], |r| {
        Ok(RepairJob {
            id: r.get(0)?, job_no: r.get(1)?, customer_id: r.get(2)?,
            customer_name: r.get(3)?, customer_phone: r.get(4)?,
            device_brand_id: r.get(5)?, device_brand_name: r.get(6)?,
            device_model: r.get(7)?, device_color: r.get(8)?,
            device_condition: r.get(9)?, fault_desc: r.get(10)?,
            technician_notes: r.get(11)?, status: r.get(12)?,
            labor_cost: r.get(13)?, parts_cost: r.get(14)?,
            total_cost: r.get(15)?, amount_paid: r.get(16)?,
            received_at: r.get(17)?, delivered_at: r.get(18)?,
            parts: vec![],
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(jobs)
}

#[tauri::command]
pub async fn create_repair_job(
    state: State<'_, AppState>,
    payload: RepairJobPayload,
) -> Result<RepairJob, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let next_no: i64 = conn.query_row(
        "SELECT CAST(value AS INTEGER) FROM settings WHERE key='next_repair_no'",
        [], |r| r.get(0),
    ).unwrap_or(1);
    let prefix: String = conn.query_row(
        "SELECT value FROM settings WHERE key='repair_prefix'", [], |r| r.get(0),
    ).unwrap_or_else(|_| "REP".to_string());
    let job_no = format!("{}-{:05}", prefix, next_no);

    conn.execute(
        "INSERT INTO repair_jobs (id,job_no,customer_id,device_brand_id,device_model,device_color,device_condition,fault_desc,labor_cost,total_cost,created_by,received_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9,?10,?11)",
        rusqlite::params![
            id, job_no, payload.customer_id, payload.device_brand_id,
            payload.device_model, payload.device_color, payload.device_condition,
            payload.fault_desc, payload.labor_cost, payload.user_id, now
        ],
    )?;

    conn.execute(
        "UPDATE settings SET value=?1 WHERE key='next_repair_no'",
        rusqlite::params![(next_no + 1).to_string()],
    )?;

    let job = conn.query_row(
        "SELECT r.id, r.job_no, r.customer_id, c.name, c.phone,
                r.device_brand_id, b.name, r.device_model, r.device_color,
                r.device_condition, r.fault_desc, r.technician_notes, r.status,
                r.labor_cost, r.parts_cost, r.total_cost, r.amount_paid,
                r.received_at, r.delivered_at
         FROM repair_jobs r JOIN customers c ON r.customer_id=c.id
         LEFT JOIN brands b ON r.device_brand_id=b.id WHERE r.id=?1",
        rusqlite::params![id],
        |r| Ok(RepairJob {
            id: r.get(0)?, job_no: r.get(1)?, customer_id: r.get(2)?,
            customer_name: r.get(3)?, customer_phone: r.get(4)?,
            device_brand_id: r.get(5)?, device_brand_name: r.get(6)?,
            device_model: r.get(7)?, device_color: r.get(8)?,
            device_condition: r.get(9)?, fault_desc: r.get(10)?,
            technician_notes: r.get(11)?, status: r.get(12)?,
            labor_cost: r.get(13)?, parts_cost: r.get(14)?,
            total_cost: r.get(15)?, amount_paid: r.get(16)?,
            received_at: r.get(17)?, delivered_at: r.get(18)?,
            parts: vec![],
        }),
    ).map_err(AppError::Database)?;
    Ok(job)
}

#[tauri::command]
pub async fn update_repair_status(
    state: State<'_, AppState>,
    id: String,
    status: String,
    technician_notes: Option<String>,
    amount_paid: Option<f64>,
    labor_cost: Option<f64>,
    financial_account_id: Option<String>,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let delivered_at = if status == "delivered" { Some(Utc::now().to_rfc3339()) } else { None };
    let acc_id = financial_account_id.unwrap_or_else(|| "cash_drawer".to_string());

    if let Some(new_labor) = labor_cost {
        conn.execute(
            "UPDATE repair_jobs SET status=?2, technician_notes=COALESCE(?3,technician_notes),
             amount_paid=COALESCE(?4,amount_paid), delivered_at=COALESCE(?5,delivered_at),
             labor_cost=?6, total_cost=(?6 + parts_cost), financial_account_id=?7 WHERE id=?1",
            rusqlite::params![id, status, technician_notes, amount_paid, delivered_at, new_labor, acc_id],
        )?;
    } else {
        conn.execute(
            "UPDATE repair_jobs SET status=?2, technician_notes=COALESCE(?3,technician_notes),
             amount_paid=COALESCE(?4,amount_paid), delivered_at=COALESCE(?5,delivered_at),
             financial_account_id=?6 WHERE id=?1",
            rusqlite::params![id, status, technician_notes, amount_paid, delivered_at, acc_id],
        )?;
    }
    Ok(())
}

#[tauri::command]
pub async fn add_repair_part(
    state: State<'_, AppState>,
    payload: AddRepairPartPayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let part_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO repair_parts (id,repair_job_id,product_id,qty,unit_cost) VALUES (?1,?2,?3,?4,?5)",
        rusqlite::params![part_id, payload.repair_job_id, payload.product_id, payload.qty, payload.unit_cost],
    )?;

    // Deduct stock
    let qty_before: i64 = conn.query_row(
        "SELECT stock_qty FROM products WHERE id=?1", rusqlite::params![payload.product_id], |r| r.get(0),
    )?;
    let qty_after = qty_before - payload.qty;
    conn.execute(
        "UPDATE products SET stock_qty=?2, updated_at=?3 WHERE id=?1",
        rusqlite::params![payload.product_id, qty_after, now],
    )?;
    let mv_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO stock_movements (id,product_id,type,qty_change,qty_before,qty_after,ref_id,user_id)
         VALUES (?1,?2,'repair_use',?3,?4,?5,?6,?7)",
        rusqlite::params![mv_id, payload.product_id, -payload.qty, qty_before, qty_after, payload.repair_job_id, payload.user_id],
    )?;

    // Recalculate parts_cost and total_cost
    conn.execute(
        "UPDATE repair_jobs SET parts_cost=(SELECT SUM(qty*unit_cost) FROM repair_parts WHERE repair_job_id=?1),
         total_cost=labor_cost+(SELECT COALESCE(SUM(qty*unit_cost),0) FROM repair_parts WHERE repair_job_id=?1) WHERE id=?1",
        rusqlite::params![payload.repair_job_id],
    )?;
    Ok(())
}
