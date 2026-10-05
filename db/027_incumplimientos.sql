-- Reglamento: reportes de incumplimiento. clause guarda el texto del acuerdo para que el
-- reporte siga siendo legible aunque se publiquen versiones nuevas.
CREATE TABLE IF NOT EXISTS rule_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 rule_version_id uuid NOT NULL REFERENCES rule_versions(id) ON DELETE CASCADE,
 clause varchar(300) NOT NULL, description varchar(500) NOT NULL DEFAULT '',
 reported_by uuid NOT NULL REFERENCES users(id), reported_membership_id uuid REFERENCES memberships(id),
 created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, resolved_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS rule_reports_home_idx ON rule_reports(home_id,created_at DESC);
