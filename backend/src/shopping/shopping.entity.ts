export const SHOPPING_STATUSES = ['PENDIENTE', 'COMPRADO'] as const;
export type ShoppingStatus = (typeof SHOPPING_STATUSES)[number];

// Fila de la tabla shopping_items (db/024_shared_modules.sql y db/025_shopping_assignment.sql).
export class ShoppingItem {
  id: string;
  home_id: string;
  title: string;
  category: string;
  quantity: number;
  estimated_price: string;
  status: ShoppingStatus;
  added_by: string;
  assigned_membership_id: string | null;
  bought_by: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

/** Producto de la lista con los nombres de quien lo agregó, lo compró y está asignado. */
export interface ShoppingItemRow {
  id: string;
  title: string;
  category: string;
  quantity: number;
  estimated_price: string;
  status: ShoppingStatus;
  added_by: string;
  added_by_name: string;
  bought_by: string | null;
  bought_by_name: string | null;
  assigned_membership_id: string | null;
  assigned_to: string | null;
  created_at: Date;
}

/** Valores completos que se guardan al actualizar un producto. */
export interface ShoppingChanges {
  title: string;
  category: string;
  quantity: number;
  estimated_price: string;
  status: ShoppingStatus;
  bought_by: string | null;
  assigned_membership_id: string | null;
}
