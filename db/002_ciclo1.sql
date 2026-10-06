ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE homes ADD COLUMN archived_at timestamptz;
ALTER TABLE notifications ADD COLUMN dismissed_at timestamptz;
