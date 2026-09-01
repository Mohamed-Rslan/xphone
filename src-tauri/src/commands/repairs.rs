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
    pub delivery_cost: f64,
    pub total_cost: f64,
    pub amount_paid: f64,
    pub repair_profit: f64,
    pub technician_name: Option<String>,
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
    pub labor_cost: Option<f64>,
    pub parts_cost: Option<f64>,
    pub delivery_cost: Option<f64>,
    pub amount_paid: Option<f64>,
    pub technician_name: Option<String>,
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
    technician_name: Option<String>,
) -> Result<Vec<RepairJob>, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref s) = status {
        if !s.is_empty() {
            conditions.push(format!("r.status = '{}'", s));
        }
    }
    if let Some(ref q) = search {
        if !q.is_empty() {
            conditions.push(format!("(c.name LIKE '%{q}%' OR c.phone LIKE '%{q}%' OR r.job_no LIKE '%{q}%' OR r.device_model LIKE '%{q}%' OR COALESCE(r.technician_name,'') LIKE '%{q}%')"));
        }
    }
    if let Some(ref tech) = technician_name {
        if !tech.is_empty() {
            conditions.push(format!("COALESCE(r.technician_name, '') LIKE '%{tech}%'"));
        }
    }
    if let Some(ref df) = date_from {
        if !df.is_empty() {
            conditions.push(format!("date(r.received_at) >= '{}'", df));
        }
    }
    if let Some(ref dt) = date_to {
        if !dt.is_empty() {
            conditions.push(format!("date(r.received_at) <= '{}'", dt));
        }
    }

    let sql = format!(
        "SELECT r.id, r.job_no, r.customer_id, c.name, c.phone,
                r.device_brand_id, b.name, r.device_model, r.device_color,
                r.device_condition, r.fault_desc, r.technician_notes, r.status,
                COALESCE(r.labor_cost,0.0), COALESCE(r.parts_cost,0.0),
                COALESCE(r.delivery_cost,0.0), COALESCE(r.total_cost,0.0),
                COALESCE(r.amount_paid,0.0), r.technician_name,
                r.received_at, r.delivered_at
         FROM repair_jobs r
         JOIN customers c ON r.customer_id = c.id
         LEFT JOIN brands b ON r.device_brand_id = b.id
         WHERE {} ORDER BY r.received_at DESC",
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let jobs = stmt.query_map([], |r| {
        let labor: f64 = r.get(13)?;
        let parts: f64 = r.get(14)?;
        let delivery: f64 = r.get(15)?;
        let total_cost = parts + labor + delivery;
        let amount_paid: f64 = r.get(17)?;
        let profit = amount_paid - total_cost;

        Ok(RepairJob {
            id: r.get(0)?, job_no: r.get(1)?, customer_id: r.get(2)?,
            customer_name: r.get(3)?, customer_phone: r.get(4)?,
            device_brand_id: r.get(5)?, device_brand_name: r.get(6)?,
            device_model: r.get(7)?, device_color: r.get(8)?,
            device_condition: r.get(9)?, fault_desc: r.get(10)?,
            technician_notes: r.get(11)?, status: r.get(12)?,
            labor_cost: labor, parts_cost: parts, delivery_cost: delivery,
            total_cost, amount_paid, repair_profit: profit,
            technician_name: r.get(18)?,
            received_at: r.get(19)?, delivered_at: r.get(20)?,
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

    // Generate repair job/invoice number: DDMMXXXR (e.g. 3108001R for 31st of August)
    let local_now = chrono::Local::now();
    let day_month = local_now.format("%d%m").to_string();
    let today_date = local_now.format("%Y-%m-%d").to_string();

    let count_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM repair_jobs WHERE date(received_at) = ?1 OR substr(received_at, 1, 10) = ?1",
        rusqlite::params![today_date],
        |r| r.get(0),
    ).unwrap_or(0);
    let seq = count_today + 1;
    let job_no = format!("{}{:03}R", day_month, seq);

    let labor = payload.labor_cost.unwrap_or(0.0);
    let parts = payload.parts_cost.unwrap_or(0.0);
    let delivery = payload.delivery_cost.unwrap_or(0.0);
    let total_cost = labor + parts + delivery;
    let price = payload.amount_paid.unwrap_or(0.0);

    conn.execute(
        "INSERT INTO repair_jobs (id,job_no,customer_id,device_brand_id,device_model,device_color,device_condition,fault_desc,labor_cost,parts_cost,delivery_cost,total_cost,amount_paid,technician_name,created_by,received_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
        rusqlite::params![
            id, job_no, payload.customer_id, payload.device_brand_id,
            payload.device_model, payload.device_color, payload.device_condition,
            payload.fault_desc, labor, parts, delivery, total_cost, price,
            payload.technician_name, payload.user_id, now
        ],
    )?;

    let job = conn.query_row(
        "SELECT r.id, r.job_no, r.customer_id, c.name, c.phone,
                r.device_brand_id, b.name, r.device_model, r.device_color,
                r.device_condition, r.fault_desc, r.technician_notes, r.status,
                COALESCE(r.labor_cost,0.0), COALESCE(r.parts_cost,0.0),
                COALESCE(r.delivery_cost,0.0), COALESCE(r.total_cost,0.0),
                COALESCE(r.amount_paid,0.0), r.technician_name,
                r.received_at, r.delivered_at
         FROM repair_jobs r JOIN customers c ON r.customer_id=c.id
         LEFT JOIN brands b ON r.device_brand_id=b.id WHERE r.id=?1",
        rusqlite::params![id],
        |r| {
            let l: f64 = r.get(13)?;
            let p: f64 = r.get(14)?;
            let d: f64 = r.get(15)?;
            let tc = l + p + d;
            let ap: f64 = r.get(17)?;
            Ok(RepairJob {
                id: r.get(0)?, job_no: r.get(1)?, customer_id: r.get(2)?,
                customer_name: r.get(3)?, customer_phone: r.get(4)?,
                device_brand_id: r.get(5)?, device_brand_name: r.get(6)?,
                device_model: r.get(7)?, device_color: r.get(8)?,
                device_condition: r.get(9)?, fault_desc: r.get(10)?,
                technician_notes: r.get(11)?, status: r.get(12)?,
                labor_cost: l, parts_cost: p, delivery_cost: d,
                total_cost: tc, amount_paid: ap, repair_profit: ap - tc,
                technician_name: r.get(18)?,
                received_at: r.get(19)?, delivered_at: r.get(20)?,
                parts: vec![],
            })
        },
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
    parts_cost: Option<f64>,
    delivery_cost: Option<f64>,
    technician_name: Option<String>,
    financial_account_id: Option<String>,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let delivered_at = if status == "delivered" { Some(Utc::now().to_rfc3339()) } else { None };
    let acc_id = financial_account_id.unwrap_or_else(|| "cash_drawer".to_string());

    // Fetch existing values
    let (old_labor, old_parts, old_delivery): (f64, f64, f64) = conn.query_row(
        "SELECT COALESCE(labor_cost,0.0), COALESCE(parts_cost,0.0), COALESCE(delivery_cost,0.0) FROM repair_jobs WHERE id=?1",
        rusqlite::params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap_or((0.0, 0.0, 0.0));

    let new_labor = labor_cost.unwrap_or(old_labor);
    let new_parts = parts_cost.unwrap_or(old_parts);
    let new_delivery = delivery_cost.unwrap_or(old_delivery);
    let new_total_cost = new_labor + new_parts + new_delivery;

    conn.execute(
        "UPDATE repair_jobs SET status=?2, technician_notes=COALESCE(?3,technician_notes),
         amount_paid=COALESCE(?4,amount_paid), delivered_at=COALESCE(?5,delivered_at),
         labor_cost=?6, parts_cost=?7, delivery_cost=?8, total_cost=?9, technician_name=COALESCE(?10,technician_name),
         financial_account_id=?11 WHERE id=?1",
        rusqlite::params![
            id, status, technician_notes, amount_paid, delivered_at,
            new_labor, new_parts, new_delivery, new_total_cost, technician_name, acc_id
        ],
    )?;

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
    let parts_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(qty * unit_cost), 0.0) FROM repair_parts WHERE repair_job_id=?1",
        rusqlite::params![payload.repair_job_id],
        |r| r.get(0),
    ).unwrap_or(0.0);

    conn.execute(
        "UPDATE repair_jobs SET parts_cost=?2, total_cost=(COALESCE(labor_cost,0.0) + COALESCE(delivery_cost,0.0) + ?2) WHERE id=?1",
        rusqlite::params![payload.repair_job_id, parts_total],
    )?;
    Ok(())
}
