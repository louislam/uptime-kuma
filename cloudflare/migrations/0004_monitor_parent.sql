ALTER TABLE monitors ADD COLUMN parent INTEGER;

CREATE INDEX IF NOT EXISTS idx_monitors_parent ON monitors(parent);
