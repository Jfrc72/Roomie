-- rule admite solo mayoría simple; la columna permite agregar otras reglas más adelante.
-- eligible_count guarda los integrantes activos al cerrar (votantes + abstenciones).
CREATE TABLE IF NOT EXISTS polls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 title varchar(120) NOT NULL, description varchar(500) NOT NULL DEFAULT '',
 rule text NOT NULL DEFAULT 'simple' CHECK(rule IN ('simple')),
 anonymous boolean NOT NULL DEFAULT false, closes_at timestamptz,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz, eligible_count integer
);
CREATE TABLE IF NOT EXISTS poll_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
 label varchar(80) NOT NULL, position smallint NOT NULL,
 UNIQUE(poll_id,position), UNIQUE(id,poll_id)
);
-- Un voto por integrante y votación; la clave compuesta exige que la opción sea de esa votación.
CREATE TABLE IF NOT EXISTS votes (
 poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE, option_id uuid NOT NULL,
 membership_id uuid NOT NULL REFERENCES memberships(id), voted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(poll_id,membership_id),
 FOREIGN KEY(option_id,poll_id) REFERENCES poll_options(id,poll_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS poll_options_label_idx ON poll_options(poll_id,lower(label));
CREATE INDEX IF NOT EXISTS polls_home_idx ON polls(home_id,status);
CREATE INDEX IF NOT EXISTS polls_closing_idx ON polls(closes_at) WHERE status='open';
CREATE INDEX IF NOT EXISTS votes_option_idx ON votes(option_id);
