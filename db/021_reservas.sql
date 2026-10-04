CREATE EXTENSION IF NOT EXISTS btree_gist;
-- active=false retira el recurso sin borrar las reservas que lo referencian.
CREATE TABLE IF NOT EXISTS resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 name varchar(80) NOT NULL, description varchar(300) NOT NULL DEFAULT '',
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 resource_id uuid NOT NULL REFERENCES resources(id), membership_id uuid NOT NULL REFERENCES memberships(id),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz,
 CHECK(ends_at > starts_at),
 -- La base de datos impide cruces del mismo recurso, también entre solicitudes simultáneas.
 -- El rango [inicio, fin) permite reservas consecutivas (10:00-11:00 y 11:00-12:00).
 EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at,ends_at) WITH &&) WHERE (status='active')
);
CREATE UNIQUE INDEX IF NOT EXISTS resources_name_idx ON resources(home_id,lower(name)) WHERE active;
CREATE INDEX IF NOT EXISTS reservations_home_idx ON reservations(home_id,starts_at) WHERE status='active';
