use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MonetaryTransaction {
    pub id: String,
    pub receipt_no: Option<String>,
    pub service_type_id: i64,
    pub service_name: String,
    pub tx_type: String, // "cash_in_transfer_out" or "transfer_in_cash_out"
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub amount: f64,
    pub commission: f64,
    pub net_profit: f64,
    pub financial_account_id: Option<String>,
    pub financial_account_name: Option<String>,
    pub notes: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MonetaryServiceType {
    pub id: i64,
    pub name_ar: String,
    pub name_en: String,
    pub commission_rate: f64,
    pub commission_type: String,
    pub is_active: bool,
    pub direction: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMonetaryTxPayload {
    pub service_type_id: i64,
    pub tx_type: String, // "cash_in_transfer_out" | "transfer_in_cash_out"
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub amount: f64,
    pub notes: Option<String>,
    pub user_id: Option<String>,
    pub custom_commission: Option<f64>,
    pub financial_account_id: Option<String>,
}

#[tauri::command]
pub async fn get_monetary_service_types(
    state: State<'_, AppState>,
) -> Result<Vec<MonetaryServiceType>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, name_ar, name_en, commission_rate, commission_type, is_active, direction
         FROM monetary_service_types WHERE is_active=1 ORDER BY id ASC"
    )?;
    let types = stmt.query_map([], |r| {
        Ok(MonetaryServiceType {
            id: r.get(0)?, name_ar: r.get(1)?, name_en: r.get(2)?,
            commission_rate: r.get(3)?, commission_type: r.get(4)?, is_active: r.get(5)?,
            direction: r.get(6).unwrap_or(None),
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(types)
}

#[tauri::command]
pub async fn create_monetary_transaction(
    state: State<'_, AppState>,
    payload: CreateMonetaryTxPayload,
) -> Result<MonetaryTransaction, AppError> {
    if payload.amount <= 0.0 {
        return Err(AppError::Validation("يجب أن يكون مبلغ المعاملة أكبر من صفر".into()));
    }

    // Validate type strictly
    if payload.tx_type != "cash_in_transfer_out" && payload.tx_type != "transfer_in_cash_out" {
        return Err(AppError::Validation(
            "نوع المعاملة يجب أن يكون إما: استقبال نقدية وإرسال رصيد (cash_in_transfer_out) أو استقبال رصيد ودفع نقدية (transfer_in_cash_out)".into()
        ));
    }

    let conn = state.pool.get()?;

    let commission = if let Some(custom) = payload.custom_commission {
        custom
    } else {
        // Fetch commission rate
        let (rate, rate_type): (f64, String) = conn.query_row(
            "SELECT commission_rate, commission_type FROM monetary_service_types WHERE id=?1",
            rusqlite::params![payload.service_type_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).map_err(|_| AppError::NotFound("نوع الخدمة غير موجود".into()))?;

        if rate_type == "percentage" {
            payload.amount * rate / 100.0
        } else {
            rate
        }
    };

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let target_acc_id = payload.financial_account_id.clone().unwrap_or_else(|| "cash_drawer".to_string());

    // Generate monetary transaction receipt/invoice number: DDMMXXXM (e.g. 3108001M for 31st of August)
    let local_now = chrono::Local::now();
    let day_month = local_now.format("%d%m").to_string();
    let today_date = local_now.format("%Y-%m-%d").to_string();

    let count_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM monetary_transactions WHERE date(created_at) = ?1 OR substr(created_at, 1, 10) = ?1",
        rusqlite::params![today_date],
        |r| r.get(0),
    ).unwrap_or(0);
    let seq = count_today + 1;
    let receipt_no = format!("{}{:03}M", day_month, seq);

    // Check user_id FK safety
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

    conn.execute(
        "INSERT INTO monetary_transactions (id, receipt_no, service_type_id, tx_type, customer_id, customer_name, amount, commission, net_profit, notes, created_by, created_at, financial_account_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            id, receipt_no, payload.service_type_id, payload.tx_type, payload.customer_id,
            payload.customer_name, payload.amount, commission,
            payload.notes, valid_user_id, now,
            target_acc_id
        ],
    )?;

    let service_name: String = conn.query_row(
        "SELECT name_ar FROM monetary_service_types WHERE id=?1",
        rusqlite::params![payload.service_type_id], |r| r.get(0),
    ).unwrap_or_else(|_| "خدمة مالية".to_string());

    let acc_name: Option<String> = conn.query_row(
        "SELECT name_ar FROM financial_accounts WHERE id=?1",
        rusqlite::params![target_acc_id], |r| r.get(0),
    ).ok();

    Ok(MonetaryTransaction {
        id, receipt_no: Some(receipt_no), service_type_id: payload.service_type_id,
        service_name, tx_type: payload.tx_type,
        customer_id: payload.customer_id, customer_name: payload.customer_name,
        amount: payload.amount, commission, net_profit: commission,
        financial_account_id: Some(target_acc_id),
        financial_account_name: acc_name,
        notes: payload.notes, created_by: valid_user_id, created_at: now,
    })
}

#[tauri::command]
pub async fn get_monetary_transactions(
    state: State<'_, AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
    service_type_id: Option<i64>,
) -> Result<Vec<MonetaryTransaction>, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref df) = date_from { conditions.push(format!("date(mt.created_at) >= '{}'", df)); }
    if let Some(ref dt) = date_to { conditions.push(format!("date(mt.created_at) <= '{}'", dt)); }
    if let Some(sid) = service_type_id { conditions.push(format!("mt.service_type_id = {}", sid)); }

    let sql = format!(
        "SELECT mt.id, mt.receipt_no, mt.service_type_id, mst.name_ar, mt.tx_type, mt.customer_id,
                mt.customer_name, mt.amount, mt.commission, mt.net_profit, mt.financial_account_id,
                fa.name_ar, mt.notes, mt.created_by, mt.created_at
         FROM monetary_transactions mt
         JOIN monetary_service_types mst ON mt.service_type_id = mst.id
         LEFT JOIN financial_accounts fa ON mt.financial_account_id = fa.id
         WHERE {} ORDER BY mt.created_at DESC",
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let txs = stmt.query_map([], |r| {
        Ok(MonetaryTransaction {
            id: r.get(0)?, receipt_no: r.get(1)?, service_type_id: r.get(2)?, service_name: r.get(3)?,
            tx_type: r.get(4)?, customer_id: r.get(5)?, customer_name: r.get(6)?,
            amount: r.get(7)?, commission: r.get(8)?, net_profit: r.get(9)?,
            financial_account_id: r.get(10)?, financial_account_name: r.get(11)?,
            notes: r.get(12)?, created_by: r.get(13)?, created_at: r.get(14)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(txs)
}

#[derive(Debug, Serialize)]
pub struct MonetarySummary {
    pub total_volume: f64,
    pub total_commission: f64,
    pub total_cash_in_volume: f64,
    pub total_cash_out_volume: f64,
    pub by_service: Vec<serde_json::Value>,
}

#[tauri::command]
pub async fn get_monetary_summary(
    state: State<'_, AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<MonetarySummary, AppError> {
    let conn = state.pool.get()?;
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref df) = date_from { conditions.push(format!("date(mt.created_at) >= '{}'", df)); }
    if let Some(ref dt) = date_to { conditions.push(format!("date(mt.created_at) <= '{}'", dt)); }

    let (total_volume, total_commission): (f64, f64) = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount),0.0), COALESCE(SUM(commission),0.0) FROM monetary_transactions mt WHERE {}", conditions.join(" AND ")),
        [], |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0.0, 0.0));

    let total_cash_in_volume: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount),0.0) FROM monetary_transactions mt WHERE mt.tx_type = 'cash_in_transfer_out' AND {}", conditions.join(" AND ")),
        [], |r| r.get(0),
    ).unwrap_or(0.0);

    let total_cash_out_volume: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount),0.0) FROM monetary_transactions mt WHERE mt.tx_type = 'transfer_in_cash_out' AND {}", conditions.join(" AND ")),
        [], |r| r.get(0),
    ).unwrap_or(0.0);

    let sql = format!(
        "SELECT mst.name_ar, COUNT(*), SUM(mt.amount), SUM(mt.commission)
         FROM monetary_transactions mt JOIN monetary_service_types mst ON mt.service_type_id=mst.id
         WHERE {} GROUP BY mt.service_type_id ORDER BY SUM(mt.commission) DESC",
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let by_service = stmt.query_map([], |r| {
        Ok(serde_json::json!({
            "service": r.get::<_,String>(0)?,
            "count": r.get::<_,i64>(1)?,
            "volume": r.get::<_,f64>(2)?,
            "commission": r.get::<_,f64>(3)?,
        }))
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(MonetarySummary {
        total_volume,
        total_commission,
        total_cash_in_volume,
        total_cash_out_volume,
        by_service
    })
}
