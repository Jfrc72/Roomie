CREATE TABLE IF NOT EXISTS tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES homes(id),
 title varchar(120) NOT NULL, description varchar(500) NOT NULL DEFAULT '',
 assigned_membership_id uuid REFERENCES memberships(id), due_at timestamptz,
 priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed')),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
-- previous_status es null en el registro que crea la tarea.
CREATE TABLE IF NOT EXISTS task_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES users(id),
 previous_status text CHECK(previous_status IN ('pending','in_progress','completed')),
 new_status text NOT NULL CHECK(new_status IN ('pending','in_progress','completed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_home_idx ON tasks(home_id,status);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx ON tasks(assigned_membership_id) WHERE status<>'completed';
CREATE INDEX IF NOT EXISTS task_history_task_idx ON task_history(task_id,created_at);
