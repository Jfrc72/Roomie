CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(80) NOT NULL,
 email varchar(254) NOT NULL UNIQUE, password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS homes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(80) NOT NULL,
 address varchar(200) NOT NULL DEFAULT '', description varchar(500) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 user_id uuid NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN ('admin','member')),
 active boolean NOT NULL DEFAULT true, joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(home_id,user_id)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 active_home_id uuid REFERENCES homes(id), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 email varchar(254) NOT NULL, token_hash text NOT NULL UNIQUE,
 created_by uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 actor_id uuid REFERENCES users(id), message varchar(300) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 email_enabled boolean NOT NULL DEFAULT false, push_enabled boolean NOT NULL DEFAULT false,
 reminder_hours integer NOT NULL DEFAULT 24 CHECK(reminder_hours BETWEEN 0 AND 168)
);
CREATE TABLE IF NOT EXISTS reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 user_id uuid NOT NULL REFERENCES users(id), source_key text NOT NULL UNIQUE,
 title varchar(120) NOT NULL, message varchar(500) NOT NULL, href text NOT NULL DEFAULT '/',
 due_at timestamptz NOT NULL, processed_at timestamptz
);
CREATE TABLE IF NOT EXISTS notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 user_id uuid NOT NULL REFERENCES users(id), title varchar(120) NOT NULL,
 message varchar(500) NOT NULL, href text NOT NULL DEFAULT '/', read_at timestamptz,
 source_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint text UNIQUE NOT NULL, p256dh text NOT NULL, auth text NOT NULL
);
CREATE TABLE IF NOT EXISTS deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN ('email','push')), attempts integer NOT NULL DEFAULT 0,
 sent_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text,
 UNIQUE(notification_id,channel)
);
CREATE TABLE IF NOT EXISTS login_attempts (
 email text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS membership_user_idx ON memberships(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,home_id,created_at DESC);
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders(due_at) WHERE processed_at IS NULL;
