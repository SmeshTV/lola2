-- ===== 7. Добавить поля для Discord ивентов =====

ALTER TABLE events ADD COLUMN IF NOT EXISTS discord_message_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS discord_event_id TEXT;

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_events_discord_message_id ON events(discord_message_id) WHERE discord_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_discord_event_id ON events(discord_event_id) WHERE discord_event_id IS NOT NULL;
