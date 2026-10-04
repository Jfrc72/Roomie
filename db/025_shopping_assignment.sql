ALTER TABLE shopping_items
 ADD COLUMN IF NOT EXISTS assigned_membership_id uuid REFERENCES memberships(id);
