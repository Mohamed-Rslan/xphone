use crate::{error::AppError, state::AppState};
use chrono::Utc;
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
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

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
) -> Result<Vec<SystemNotification>, AppError> {
    let conn = state.pool.get()?;
    let lim = limit.unwrap_or(50);
    let where_clause = if unread_only.unwrap_or(false) {
        "WHERE is_read = 0"
    } else {
        ""
    };

    let sql = format!(
        "SELECT id, user_id, user_name, action_type, title, details, is_read, created_at
         FROM system_notifications
         {}
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
