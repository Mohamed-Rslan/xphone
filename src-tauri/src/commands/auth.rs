use crate::{error::AppError, state::AppState};
use bcrypt::{hash, verify};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub is_active: bool,
    pub phone: Option<String>,
    pub permissions: Option<String>,
    pub created_at: String,
    pub job_title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub user: User,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct OtpRequestResult {
    pub username: String,
    pub phone: String,
    pub otp_code: String,
    pub whatsapp_url: String,
    pub expires_at: String,
}

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    payload: LoginPayload,
) -> Result<SessionInfo, AppError> {
    let conn = state.pool.get()?;

    let result = conn.query_row(
        "SELECT id, username, display_name, password_hash, role, is_active, phone, permissions, created_at, job_title
         FROM users WHERE username = ?1 AND is_active = 1",
        rusqlite::params![payload.username],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, bool>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, Option<String>>(9)?,
            ))
        },
    );

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err(AppError::Auth("اسم المستخدم أو كلمة المرور غير صحيحة".into()))
        }
        Err(e) => Err(AppError::Database(e)),
        Ok((id, username, display_name, hash, role, is_active, phone, permissions, created_at, job_title)) => {
            let valid = verify(&payload.password, &hash)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            if !valid {
                return Err(AppError::Auth("اسم المستخدم أو كلمة المرور غير صحيحة".into()));
            }

            let session_id = Uuid::new_v4().to_string();
            let expires = (Utc::now() + Duration::hours(12)).to_rfc3339();

            conn.execute(
                "INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![session_id, id, expires],
            )?;

            Ok(SessionInfo {
                session_id,
                user: User {
                    id,
                    username,
                    display_name,
                    role,
                    is_active,
                    phone,
                    permissions: permissions.or_else(|| Some("[]".to_string())),
                    created_at,
                    job_title,
                },
            })
        }
    }
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>, session_id: String) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute("DELETE FROM sessions WHERE id = ?1", rusqlite::params![session_id])?;
    Ok(())
}

#[tauri::command]
pub async fn get_users(state: State<'_, AppState>) -> Result<Vec<User>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, username, display_name, role, is_active, phone, permissions, created_at, job_title
         FROM users ORDER BY created_at ASC",
    )?;
    let users = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                role: row.get(3)?,
                is_active: row.get(4)?,
                phone: row.get(5)?,
                permissions: row.get(6)?,
                created_at: row.get(7)?,
                job_title: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(users)
}

#[derive(Debug, Deserialize)]
pub struct CreateUserPayload {
    pub username: String,
    pub display_name: String,
    pub password: String,
    pub role: String,
    pub phone: Option<String>,
    pub permissions: Option<Vec<String>>,
    pub job_title: Option<String>,
}

#[tauri::command]
pub async fn create_user(
    state: State<'_, AppState>,
    payload: CreateUserPayload,
) -> Result<User, AppError> {
    let conn = state.pool.get()?;
    let pwd_hash = hash(&payload.password, 12).map_err(|e| AppError::Internal(e.to_string()))?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let perms_json = payload
        .permissions
        .as_ref()
        .map(|p| serde_json::to_string(p).unwrap_or_else(|_| "[]".to_string()))
        .unwrap_or_else(|| "[]".to_string());

    conn.execute(
        "INSERT INTO users (id, username, display_name, password_hash, role, phone, permissions, created_at, job_title)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            id,
            payload.username,
            payload.display_name,
            pwd_hash,
            payload.role,
            payload.phone,
            perms_json,
            now,
            payload.job_title
        ],
    )?;

    Ok(User {
        id,
        username: payload.username,
        display_name: payload.display_name,
        role: payload.role,
        is_active: true,
        phone: payload.phone,
        permissions: Some(perms_json),
        created_at: now,
        job_title: payload.job_title,
    })
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserPermissionsPayload {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
    pub is_active: bool,
    pub phone: Option<String>,
    pub permissions: Vec<String>,
    pub new_password: Option<String>,
    pub job_title: Option<String>,
}

#[tauri::command]
pub async fn update_user_permissions(
    state: State<'_, AppState>,
    payload: UpdateUserPermissionsPayload,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    let perms_json = serde_json::to_string(&payload.permissions).unwrap_or_else(|_| "[]".to_string());

    if let Some(ref pwd) = payload.new_password {
        if !pwd.trim().is_empty() {
            let pwd_hash = hash(pwd.trim(), 12).map_err(|e| AppError::Internal(e.to_string()))?;
            conn.execute(
                "UPDATE users
                 SET display_name = ?2, role = ?3, is_active = ?4, phone = ?5, permissions = ?6, password_hash = ?7, job_title = ?8
                 WHERE id = ?1",
                rusqlite::params![
                    payload.user_id,
                    payload.display_name,
                    payload.role,
                    payload.is_active,
                    payload.phone,
                    perms_json,
                    pwd_hash,
                    payload.job_title
                ],
            )?;
            return Ok(());
        }
    }

    conn.execute(
        "UPDATE users
         SET display_name = ?2, role = ?3, is_active = ?4, phone = ?5, permissions = ?6, job_title = ?7
         WHERE id = ?1",
        rusqlite::params![
            payload.user_id,
            payload.display_name,
            payload.role,
            payload.is_active,
            payload.phone,
            perms_json,
            payload.job_title
        ],
    )?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN WHATSAPP OTP PASSWORD RESET (استعادة كلمة المرور عبر كود الواتساب)
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn request_whatsapp_otp(
    state: State<'_, AppState>,
    username: String,
) -> Result<OtpRequestResult, AppError> {
    let conn = state.pool.get()?;

    let (_user_id, display_name, phone_opt): (String, String, Option<String>) = conn
        .query_row(
            "SELECT id, display_name, phone FROM users WHERE username = ?1",
            rusqlite::params![username.trim()],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|_| AppError::Validation("اسم المستخدم غير موجود في النظام".into()))?;

    let phone = phone_opt
        .filter(|p| !p.trim().is_empty())
        .ok_or_else(|| {
            AppError::Validation(
                "لم يتم تسجيل رقم هاتف لهذا الحساب بعد. يرجى التواصل مع الإدارة أو تسجيل رقم الهاتف في الإعدادات.".into(),
            )
        })?;

    // Generate 6-digit OTP code (pure numeric)
    let now = Utc::now();
    let expires = (now + Duration::minutes(10)).to_rfc3339();
    let nanos = now.timestamp_nanos_opt().unwrap_or(0).unsigned_abs();
    let otp_val = (nanos % 900000) + 100000;
    let otp_code = format!("{:06}", otp_val);

    let otp_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO otp_codes (id, username, phone, code, expires_at, is_used, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
        rusqlite::params![otp_id, username.trim(), phone.trim(), otp_code, expires, now.to_rfc3339()],
    )?;

    // Format WhatsApp phone number
    let mut clean_phone = phone.chars().filter(|c| c.is_ascii_digit()).collect::<String>();
    if clean_phone.starts_with('0') {
        clean_phone = format!("2{}", clean_phone);
    } else if !clean_phone.starts_with('2') && clean_phone.len() == 10 {
        clean_phone = format!("20{}", clean_phone);
    }

    let msg = format!(
        "مرحباً {}، كود التحقق السري الخاص بك لتغيير كلمة مرور مدير المبيعات في نظام XPhone هو: *{}*\nصالح للاستخدام لمدة 10 دقائق فقط.",
        display_name, otp_code
    );

fn url_encode(input: &str) -> String {
    let mut encoded = String::new();
    for byte in input.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push_str("%20"),
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }
    encoded
}

    let encoded_msg = url_encode(&msg);
    let whatsapp_url = format!("https://wa.me/{}?text={}", clean_phone, encoded_msg);

    Ok(OtpRequestResult {
        username: username.trim().to_string(),
        phone: phone.trim().to_string(),
        otp_code,
        whatsapp_url,
        expires_at: expires,
    })
}

#[derive(Debug, Deserialize)]
pub struct VerifyOtpResetPayload {
    pub username: String,
    pub otp_code: String,
    pub new_password: String,
}

#[tauri::command]
pub async fn verify_otp_and_reset_password(
    state: State<'_, AppState>,
    payload: VerifyOtpResetPayload,
) -> Result<(), AppError> {
    if payload.new_password.trim().len() < 4 {
        return Err(AppError::Validation("يجب أن تكون كلمة المرور 4 أحرف/أرقام على الأقل".into()));
    }

    let conn = state.pool.get()?;
    let now = Utc::now().to_rfc3339();

    let otp_id: String = conn
        .query_row(
            "SELECT id FROM otp_codes
             WHERE username = ?1 AND code = ?2 AND is_used = 0 AND expires_at > ?3
             ORDER BY created_at DESC LIMIT 1",
            rusqlite::params![payload.username.trim(), payload.otp_code.trim(), now],
            |r| r.get(0),
        )
        .map_err(|_| AppError::Validation("كود التحقق غير صحيح أو انتهت صلاحيته. يرجى طلب كود جديد.".into()))?;

    // Hash new password
    let pwd_hash = hash(payload.new_password.trim(), 12)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    conn.execute(
        "UPDATE users SET password_hash = ?2 WHERE username = ?1",
        rusqlite::params![payload.username.trim(), pwd_hash],
    )?;

    // Mark OTP as used
    conn.execute(
        "UPDATE otp_codes SET is_used = 1 WHERE id = ?1",
        rusqlite::params![otp_id],
    )?;

    Ok(())
}
