-- Migration 017: Custom Broadcast Notifications & Timeframe Script Alerts

CREATE TABLE IF NOT EXISTS broadcast_notifications (
    id TEXT PRIMARY KEY,
    sender_user_id TEXT,
    sender_name TEXT NOT NULL,
    target_role TEXT NOT NULL DEFAULT 'all',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    start_time TEXT,
    end_time TEXT,
    script_payload TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_active ON broadcast_notifications(is_active, start_time, end_time);
