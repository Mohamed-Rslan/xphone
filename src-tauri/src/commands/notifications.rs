use crate::{error::AppError, state::AppState};
use chrono::Utc;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemNotification {
    pub id: String,
    pub user_id: Option<String>,
    pub user_name: String,
    pub action_type: String,
    pub title: String,
    pub details: Option<String>,
    pub is_read: bool,
    pub created_at: String,
}

pub fn log_system_notification(
    conn: &rusqlite::Connection,
    user_id: Option<&str>,
    user_name: &str,
    action_type: &str,
    title: &str,
    details: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let now = Utc::now().to_rfc3339();

    // Deduplication check: do NOT create duplicate notifications if identical title/details exist!
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM system_notifications
             WHERE action_type = ?1 AND title = ?2 AND COALESCE(details, '') = COALESCE(?3, '')
             ORDER BY created_at DESC LIMIT 1",
            rusqlite::params![action_type, title, details],
            |r| r.get(0),
        )
        .optional()?;

    if let Some(eid) = existing_id {
        // Update timestamp & user_name on the existing notification instead of creating a duplicate row!
        conn.execute(
            "UPDATE system_notifications SET created_at = ?1, user_name = ?2 WHERE id = ?3",
            rusqlite::params![now, user_name, eid],
        )?;
        return Ok(());
    }

    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO system_notifications (id, user_id, user_name, action_type, title, details, is_read, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)",
        rusqlite::params![id, user_id, user_name, action_type, title, details, now],
    )?;

    Ok(())
}

#[tauri::command]
pub async fn get_system_notifications(
    state: State<'_, AppState>,
    limit: Option<i64>,
    unread_only: Option<bool>,
    include_all_history: Option<bool>,
) -> Result<Vec<SystemNotification>, AppError> {
    let conn = state.pool.get()?;
    let lim = limit.unwrap_or(100);
    let include_all = include_all_history.unwrap_or(false);

    let where_clause = if unread_only.unwrap_or(false) {
        "WHERE is_read = 0".to_string()
    } else if !include_all {
        // Read notifications older than 10 days automatically vanish from daily Bell view!
        "WHERE is_read = 0 OR datetime(created_at) >= datetime('now', '-10 days')".to_string()
    } else {
        "".to_string()
    };

    let sql = format!(
        "SELECT id, user_id, user_name, action_type, title, details, MIN(is_read) as is_read, MAX(created_at) as created_at
         FROM system_notifications
         {}
         GROUP BY action_type, title, COALESCE(details, '')
         ORDER BY created_at DESC
         LIMIT {}",
        where_clause, lim
    );

    let mut stmt = conn.prepare(&sql)?;
    let list = stmt
        .query_map([], |r| {
            let is_read_int: i64 = r.get(6)?;
            Ok(SystemNotification {
                id: r.get(0)?,
                user_id: r.get(1)?,
                user_name: r.get(2)?,
                action_type: r.get(3)?,
                title: r.get(4)?,
                details: r.get(5)?,
                is_read: is_read_int == 1,
                created_at: r.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(list)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BroadcastNotification {
    pub id: String,
    pub sender_user_id: Option<String>,
    pub sender_name: String,
    pub target_role: String,
    pub title: String,
    pub message: String,
    pub severity: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub script_payload: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBroadcastNotificationPayload {
    pub sender_user_id: Option<String>,
    pub sender_name: String,
    pub target_role: Option<String>,
    pub title: String,
    pub message: String,
    pub severity: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub script_payload: Option<String>,
}

#[tauri::command]
pub async fn create_broadcast_notification(
    state: State<'_, AppState>,
    payload: CreateBroadcastNotificationPayload,
) -> Result<BroadcastNotification, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let target_role = payload.target_role.unwrap_or_else(|| "all".to_string());
    let severity = payload.severity.unwrap_or_else(|| "medium".to_string());

    conn.execute(
        "INSERT INTO broadcast_notifications (
            id, sender_user_id, sender_name, target_role, title, message, severity, start_time, end_time, script_payload, is_active, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11)",
        rusqlite::params![
            id,
            payload.sender_user_id,
            payload.sender_name,
            target_role,
            payload.title,
            payload.message,
            severity,
            payload.start_time,
            payload.end_time,
            payload.script_payload,
            now
        ],
    )?;

    // Also broadcast to system_notifications for all users to see in real-time history!
    let sys_details = format!(
        "{}\n[إطار زمني: من {} إلى {}]\n{}",
        payload.message,
        payload.start_time.as_deref().unwrap_or("فوري"),
        payload.end_time.as_deref().unwrap_or("دائم"),
        payload.script_payload.as_ref().map(|s| format!("[تعليمات/إسكريبت: {}]", s)).unwrap_or_default()
    );

    log_system_notification(
        &conn,
        payload.sender_user_id.as_deref(),
        &payload.sender_name,
        "custom_broadcast",
        &format!("📢 تنبيه رئيسي: {}", payload.title),
        Some(&sys_details),
    )?;

    Ok(BroadcastNotification {
        id,
        sender_user_id: payload.sender_user_id,
        sender_name: payload.sender_name,
        target_role,
        title: payload.title,
        message: payload.message,
        severity,
        start_time: payload.start_time,
        end_time: payload.end_time,
        script_payload: payload.script_payload,
        is_active: true,
        created_at: now,
    })
}

#[tauri::command]
pub async fn get_broadcast_notifications(
    state: State<'_, AppState>,
    active_only: Option<bool>,
) -> Result<Vec<BroadcastNotification>, AppError> {
    let conn = state.pool.get()?;
    let where_clause = if active_only.unwrap_or(true) {
        "WHERE is_active = 1"
    } else {
        ""
    };

    let sql = format!(
        "SELECT id, sender_user_id, sender_name, target_role, title, message, severity, start_time, end_time, script_payload, is_active, created_at
         FROM broadcast_notifications
         {}
         ORDER BY created_at DESC",
        where_clause
    );

    let mut stmt = conn.prepare(&sql)?;
    let list = stmt
        .query_map([], |r| {
            let active_int: i64 = r.get(10)?;
            Ok(BroadcastNotification {
                id: r.get(0)?,
                sender_user_id: r.get(1)?,
                sender_name: r.get(2)?,
                target_role: r.get(3)?,
                title: r.get(4)?,
                message: r.get(5)?,
                severity: r.get(6)?,
                start_time: r.get(7)?,
                end_time: r.get(8)?,
                script_payload: r.get(9)?,
                is_active: active_int == 1,
                created_at: r.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(list)
}

#[tauri::command]
pub async fn delete_broadcast_notification(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute(
        "UPDATE broadcast_notifications SET is_active = 0 WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn mark_notification_as_read(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute(
        "UPDATE system_notifications SET is_read = 1 WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn mark_all_notifications_as_read(state: State<'_, AppState>) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute("UPDATE system_notifications SET is_read = 1", [])?;
    Ok(())
}
