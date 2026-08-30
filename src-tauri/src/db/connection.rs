use anyhow::Result;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::Path;

pub type DbPool = Pool<SqliteConnectionManager>;

const MIGRATION_001: &str = include_str!("migrations/001_initial.sql");
const MIGRATION_002: &str = include_str!("migrations/002_seed.sql");
const MIGRATION_003: &str = include_str!("migrations/003_accounts.sql");
const MIGRATION_004: &str = include_str!("migrations/004_transfers.sql");
const MIGRATION_005: &str = include_str!("migrations/005_accounting_standards.sql");
const MIGRATION_006: &str = include_str!("migrations/006_monetary_restructure.sql");
const MIGRATION_007: &str = include_str!("migrations/007_monetary_check_constraint_fix.sql");
const MIGRATION_008: &str = include_str!("migrations/008_purchase_invoices_returns.sql");
const MIGRATION_009: &str = include_str!("migrations/009_cash_audits.sql");
const MIGRATION_010: &str = include_str!("migrations/010_permissions_and_notifications.sql");
const MIGRATION_011: &str = include_str!("migrations/011_cash_adjustments.sql");
const MIGRATION_012: &str = include_str!("migrations/012_equity_short_term_withdrawal.sql");
const MIGRATION_013: &str = include_str!("migrations/013_account_debit_limits.sql");

pub fn init_pool(db_path: &Path) -> Result<DbPool> {
    let manager = SqliteConnectionManager::file(db_path)
        .with_init(|conn| {
            conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
            Ok(())
        });

    let pool = Pool::builder().max_size(5).build(manager)?;
    run_migrations(&pool)?;
    Ok(pool)
}

fn run_migrations(pool: &DbPool) -> Result<()> {
    let conn = pool.get()?;

    // Create migrations tracking table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    TEXT NOT NULL UNIQUE,
            run_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );"
    )?;

    let migrations = vec![
        ("001_initial", MIGRATION_001),
        ("002_seed", MIGRATION_002),
        ("003_accounts", MIGRATION_003),
        ("004_transfers", MIGRATION_004),
        ("005_accounting_standards", MIGRATION_005),
        ("006_monetary_restructure", MIGRATION_006),
        ("007_monetary_check_constraint_fix", MIGRATION_007),
        ("008_purchase_invoices_returns", MIGRATION_008),
        ("009_cash_audits", MIGRATION_009),
        ("010_permissions_and_notifications", MIGRATION_010),
        ("011_cash_adjustments", MIGRATION_011),
        ("012_equity_short_term_withdrawal", MIGRATION_012),
        ("013_account_debit_limits", MIGRATION_013),
    ];

    for (name, sql) in migrations {
        let already_run: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM _migrations WHERE name = ?1",
                rusqlite::params![name],
                |row| row.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .unwrap_or(false);

        if !already_run {
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO _migrations (name) VALUES (?1)",
                rusqlite::params![name],
            )?;
        }
    }

    Ok(())
}
