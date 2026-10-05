CREATE TABLE IF NOT EXISTS expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 home_id uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
 paid_by uuid NOT NULL REFERENCES users(id),
 created_by uuid NOT NULL REFERENCES users(id),
 title varchar(255) NOT NULL,
 total_amount numeric(12,2) NOT NULL CHECK(total_amount>0),
 category varchar(50) NOT NULL DEFAULT 'Varios',
 expense_date date NOT NULL DEFAULT CURRENT_DATE,
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS expense_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 amount numeric(12,2) NOT NULL CHECK(amount>=0),
 status text NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE','PAGADO')),
 paid_at timestamptz,
 UNIQUE(expense_id,user_id)
);
CREATE TABLE IF NOT EXISTS direct_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 home_id uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
 payer_id uuid NOT NULL REFERENCES users(id),
 receiver_id uuid NOT NULL REFERENCES users(id),
 amount numeric(12,2) NOT NULL CHECK(amount>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(payer_id<>receiver_id)
);
CREATE TABLE IF NOT EXISTS shopping_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 home_id uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
 title varchar(255) NOT NULL,
 category varchar(50) NOT NULL DEFAULT 'Varios',
 quantity integer NOT NULL DEFAULT 1 CHECK(quantity>0),
 estimated_price numeric(12,2) NOT NULL DEFAULT 0 CHECK(estimated_price>=0),
 status text NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE','COMPRADO')),
 added_by uuid NOT NULL REFERENCES users(id),
 assigned_membership_id uuid REFERENCES memberships(id),
 bought_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS maintenance_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 home_id uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
 title varchar(255) NOT NULL,
 description text NOT NULL DEFAULT '',
 category varchar(50) NOT NULL DEFAULT 'Otros',
 estimated_cost numeric(12,2) CHECK(estimated_cost IS NULL OR estimated_cost>=0),
 priority text NOT NULL DEFAULT 'MEDIA' CHECK(priority IN ('BAJA','MEDIA','ALTA','URGENTE')),
 status text NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE','EN_PROGRESO','RESUELTO')),
 reported_by uuid NOT NULL REFERENCES users(id),
 assigned_membership_id uuid REFERENCES memberships(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS expenses_home_date_idx ON expenses(home_id,expense_date DESC,created_at DESC);
CREATE INDEX IF NOT EXISTS expense_shares_user_status_idx ON expense_shares(user_id,status);
CREATE INDEX IF NOT EXISTS direct_payments_home_idx ON direct_payments(home_id,created_at DESC);
CREATE INDEX IF NOT EXISTS shopping_items_home_status_idx ON shopping_items(home_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS maintenance_reports_home_status_idx ON maintenance_reports(home_id,status,created_at DESC);
