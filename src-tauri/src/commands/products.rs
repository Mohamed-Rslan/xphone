use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: String,
    pub sku: Option<String>,
    pub name_ar: String,
    pub name_en: Option<String>,
    pub brand_id: Option<i64>,
    pub brand_name: Option<String>,
    pub category_id: i64,
    pub category_name: String,
    pub variant_color: Option<String>,
    pub variant_storage: Option<String>,
    pub variant_ram: Option<String>,
    pub cost_price: f64,
    pub sell_price: f64,
    pub stock_qty: i64,
    pub reorder_level: i64,
    pub supplier_id: Option<String>,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ProductPayload {
    pub sku: Option<String>,
    pub name_ar: String,
    pub name_en: Option<String>,
    pub brand_id: Option<i64>,
    pub category_id: i64,
    pub variant_color: Option<String>,
    pub variant_storage: Option<String>,
    pub variant_ram: Option<String>,
    pub cost_price: f64,
    pub sell_price: f64,
    pub stock_qty: i64,
    pub reorder_level: Option<i64>,
    pub supplier_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProductFilter {
    pub search: Option<String>,
    pub category_id: Option<i64>,
    pub brand_id: Option<i64>,
    pub low_stock_only: Option<bool>,
    pub is_active: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[tauri::command]
pub async fn get_products(
    state: State<'_, AppState>,
    filter: Option<ProductFilter>,
) -> Result<Vec<Product>, AppError> {
    let conn = state.pool.get()?;
    let f = filter.unwrap_or(ProductFilter {
        search: None, category_id: None, brand_id: None,
        low_stock_only: None, is_active: Some(true),
        limit: Some(200), offset: Some(0),
    });

    let mut conditions = vec!["1=1".to_string()];
    if f.is_active.unwrap_or(true) { conditions.push("p.is_active = 1".to_string()); }
    if let Some(ref s) = f.search {
        conditions.push(format!("(p.name_ar LIKE '%{}%' OR p.sku LIKE '%{}%' OR b.name LIKE '%{}%')", s, s, s));
    }
    if let Some(cid) = f.category_id { conditions.push(format!("p.category_id = {}", cid)); }
    if let Some(bid) = f.brand_id { conditions.push(format!("p.brand_id = {}", bid)); }
    if f.low_stock_only.unwrap_or(false) { conditions.push("p.stock_qty <= p.reorder_level".to_string()); }

    let sql = format!(
        "SELECT p.id, p.sku, p.name_ar, p.name_en, p.brand_id, b.name,
                p.category_id, c.name_ar, p.variant_color, p.variant_storage,
                p.variant_ram, p.cost_price, p.sell_price, p.stock_qty,
                p.reorder_level, p.supplier_id, p.is_active, p.notes,
                p.created_at, p.updated_at
         FROM products p
         LEFT JOIN brands b ON p.brand_id = b.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE {}
         ORDER BY p.updated_at DESC
         LIMIT {} OFFSET {}",
        conditions.join(" AND "),
        f.limit.unwrap_or(200),
        f.offset.unwrap_or(0)
    );

    let mut stmt = conn.prepare(&sql)?;
    let products = stmt.query_map([], |row| {
        Ok(Product {
            id: row.get(0)?,
            sku: row.get(1)?,
            name_ar: row.get(2)?,
            name_en: row.get(3)?,
            brand_id: row.get(4)?,
            brand_name: row.get(5)?,
            category_id: row.get(6)?,
            category_name: row.get(7)?,
            variant_color: row.get(8)?,
            variant_storage: row.get(9)?,
            variant_ram: row.get(10)?,
            cost_price: row.get(11)?,
            sell_price: row.get(12)?,
            stock_qty: row.get(13)?,
            reorder_level: row.get(14)?,
            supplier_id: row.get(15)?,
            is_active: row.get(16)?,
            notes: row.get(17)?,
            created_at: row.get(18)?,
            updated_at: row.get(19)?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;
    Ok(products)
}

#[tauri::command]
pub async fn create_product(
    state: State<'_, AppState>,
    payload: ProductPayload,
) -> Result<Product, AppError> {
    let conn = state.pool.get()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO products (id,sku,name_ar,name_en,brand_id,category_id,variant_color,variant_storage,variant_ram,cost_price,sell_price,stock_qty,reorder_level,supplier_id,notes,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
        rusqlite::params![
            id, payload.sku, payload.name_ar, payload.name_en, payload.brand_id,
            payload.category_id, payload.variant_color, payload.variant_storage,
            payload.variant_ram, payload.cost_price, payload.sell_price, payload.stock_qty,
            payload.reorder_level.unwrap_or(5), payload.supplier_id, payload.notes, now, now
        ],
    )?;

    // Initial stock movement if qty > 0
    if payload.stock_qty > 0 {
        let mv_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_movements (id,product_id,type,qty_change,qty_before,qty_after,reason)
             VALUES (?1,?2,'purchase',?3,0,?4,'رصيد ابتدائي')",
            rusqlite::params![mv_id, id, payload.stock_qty, payload.stock_qty],
        )?;
    }

    get_product_by_id(&conn, &id)
}

#[tauri::command]
pub async fn update_product(
    state: State<'_, AppState>,
    id: String,
    payload: ProductPayload,
) -> Result<Product, AppError> {
    let conn = state.pool.get()?;
    let now = Utc::now().to_rfc3339();

    // 1. Fetch old quantity to compare
    let old_qty: i64 = conn.query_row(
        "SELECT stock_qty FROM products WHERE id = ?1",
        rusqlite::params![id],
        |row| row.get(0),
    )?;

    // 2. Perform the update including stock_qty
    conn.execute(
        "UPDATE products SET sku=?2,name_ar=?3,name_en=?4,brand_id=?5,category_id=?6,
         variant_color=?7,variant_storage=?8,variant_ram=?9,cost_price=?10,sell_price=?11,
         stock_qty=?12,reorder_level=?13,supplier_id=?14,notes=?15,updated_at=?16 WHERE id=?1",
        rusqlite::params![
            id, payload.sku, payload.name_ar, payload.name_en, payload.brand_id,
            payload.category_id, payload.variant_color, payload.variant_storage,
            payload.variant_ram, payload.cost_price, payload.sell_price,
            payload.stock_qty, payload.reorder_level.unwrap_or(5), payload.supplier_id,
            payload.notes, now
        ],
    )?;

    // 3. Log an adjustment movement if quantity changed
    if payload.stock_qty != old_qty {
        let mv_id = Uuid::new_v4().to_string();
        let qty_change = payload.stock_qty - old_qty;
        conn.execute(
            "INSERT INTO stock_movements (id,product_id,type,qty_change,qty_before,qty_after,reason)
             VALUES (?1,?2,'adjustment',?3,?4,?5,'تعديل يدوي من الإدارة')",
            rusqlite::params![mv_id, id, qty_change, old_qty, payload.stock_qty],
        )?;
    }

    // Log notification for Super Admin
    let notif_title = format!("تعديل بيانات صنف في المخزون: {}", payload.name_ar);
    let notif_details = format!("تم تعديل بيانات الصنف (السعر: {:.2} ج.م، الكمية: {})", payload.sell_price, payload.stock_qty);
    let _ = crate::commands::notifications::log_system_notification(&conn, None, "المستخدم", "inventory_edit", &notif_title, Some(&notif_details));

    get_product_by_id(&conn, &id)
}

#[tauri::command]
pub async fn delete_product(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let conn = state.pool.get()?;
    conn.execute("UPDATE products SET is_active=0 WHERE id=?1", rusqlite::params![id])?;
    Ok(())
}

fn get_product_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Product, AppError> {
    conn.query_row(
        "SELECT p.id, p.sku, p.name_ar, p.name_en, p.brand_id, b.name,
                p.category_id, c.name_ar, p.variant_color, p.variant_storage,
                p.variant_ram, p.cost_price, p.sell_price, p.stock_qty,
                p.reorder_level, p.supplier_id, p.is_active, p.notes,
                p.created_at, p.updated_at
         FROM products p
         LEFT JOIN brands b ON p.brand_id = b.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?1",
        rusqlite::params![id],
        |row| Ok(Product {
            id: row.get(0)?, sku: row.get(1)?, name_ar: row.get(2)?,
            name_en: row.get(3)?, brand_id: row.get(4)?, brand_name: row.get(5)?,
            category_id: row.get(6)?, category_name: row.get(7)?,
            variant_color: row.get(8)?, variant_storage: row.get(9)?,
            variant_ram: row.get(10)?, cost_price: row.get(11)?,
            sell_price: row.get(12)?, stock_qty: row.get(13)?,
            reorder_level: row.get(14)?, supplier_id: row.get(15)?,
            is_active: row.get(16)?, notes: row.get(17)?,
            created_at: row.get(18)?, updated_at: row.get(19)?,
        }),
    ).map_err(AppError::Database)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Brand { pub id: i64, pub name: String, pub is_active: bool }

#[tauri::command]
pub async fn get_brands(state: State<'_, AppState>) -> Result<Vec<Brand>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare("SELECT id, name, is_active FROM brands WHERE is_active=1 ORDER BY name")?;
    let brands = stmt.query_map([], |r| Ok(Brand { id: r.get(0)?, name: r.get(1)?, is_active: r.get(2)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(brands)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Category { pub id: i64, pub name_ar: String, pub name_en: String, pub sort_order: i64 }

#[tauri::command]
pub async fn get_categories(state: State<'_, AppState>) -> Result<Vec<Category>, AppError> {
    let conn = state.pool.get()?;
    let mut stmt = conn.prepare("SELECT id, name_ar, name_en, sort_order FROM categories ORDER BY sort_order")?;
    let cats = stmt.query_map([], |r| Ok(Category { id: r.get(0)?, name_ar: r.get(1)?, name_en: r.get(2)?, sort_order: r.get(3)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(cats)
}

#[tauri::command]
pub async fn get_low_stock_products(state: State<'_, AppState>) -> Result<Vec<Product>, AppError> {
    get_products(state, Some(ProductFilter {
        search: None, category_id: None, brand_id: None,
        low_stock_only: Some(true), is_active: Some(true),
        limit: Some(100), offset: Some(0),
    })).await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockMovement {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub type_: String,
    pub qty_change: i64,
    pub qty_before: i64,
    pub qty_after: i64,
    pub ref_id: Option<String>,
    pub reason: Option<String>,
    pub user_display_name: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub async fn get_stock_movements(
    state: State<'_, AppState>,
    product_id: Option<String>,
) -> Result<Vec<StockMovement>, AppError> {
    let conn = state.pool.get()?;
    let cond = if product_id.is_some() { "WHERE m.product_id = ?1" } else { "" };
    let sql = format!(
        "SELECT m.id, m.product_id, p.name_ar, m.type, m.qty_change, m.qty_before, m.qty_after,
                m.ref_id, m.reason, u.display_name, m.created_at
         FROM stock_movements m
         JOIN products p ON m.product_id = p.id
         LEFT JOIN users u ON m.user_id = u.id
         {} ORDER BY m.created_at DESC LIMIT 250",
        cond
    );
    let mut stmt = conn.prepare(&sql)?;
    let list = if let Some(ref pid) = product_id {
        stmt.query_map(rusqlite::params![pid], map_movement)
    } else {
        stmt.query_map([], map_movement)
    }?.collect::<Result<Vec<_>, _>>()?;
    Ok(list)
}

fn map_movement(r: &rusqlite::Row) -> rusqlite::Result<StockMovement> {
    Ok(StockMovement {
        id: r.get(0)?, product_id: r.get(1)?, product_name: r.get(2)?,
        type_: r.get(3)?, qty_change: r.get(4)?, qty_before: r.get(5)?,
        qty_after: r.get(6)?, ref_id: r.get(7)?, reason: r.get(8)?,
        user_display_name: r.get(9)?, created_at: r.get(10)?,
    })
}

