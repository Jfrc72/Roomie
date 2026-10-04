-- Cada publicación crea una versión nueva; las anteriores se conservan como historial.
CREATE TABLE IF NOT EXISTS rule_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 version integer NOT NULL CHECK(version > 0), content text NOT NULL CHECK(char_length(content) BETWEEN 10 AND 10000),
 notes varchar(200) NOT NULL DEFAULT '',
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(home_id,version)
);
-- Registro de lectura y aceptación por versión e integrante; no es una firma electrónica certificada.
CREATE TABLE IF NOT EXISTS rule_acceptances (
 rule_version_id uuid NOT NULL REFERENCES rule_versions(id) ON DELETE CASCADE,
 membership_id uuid NOT NULL REFERENCES memberships(id), accepted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(rule_version_id,membership_id)
);
