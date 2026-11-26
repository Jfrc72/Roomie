import { canManageRecord, HomeRole } from '../common/permissions.rules';
import { ShoppingChanges, ShoppingItem, ShoppingItemRow } from './shopping.entity';
import { UpdateShoppingItemDto } from './shopping.dto';
import { ShoppingItemView } from './shopping.responses';

/** Convierte una fila a lo que ve la interfaz: números en vez de texto y permiso de edición. */
export function toItemView(row: ShoppingItemRow, role: HomeRole, userId: string): ShoppingItemView {
  return {
    ...row,
    quantity: Number(row.quantity),
    estimated_price: Number(row.estimated_price),
    can_edit: canManageRecord(role, row.added_by, userId),
  };
}

/** Cambiar solo el estado lo puede hacer cualquier integrante; cualquier otro campo, solo su autor o un administrador. */
export function editsDetails(patch: UpdateShoppingItemDto): boolean {
  return Object.entries(patch).some(([key, value]) => key !== 'status' && value !== undefined);
}

/**
 * Valores finales del producto tras aplicar los cambios recibidos.
 * Al marcarlo comprado se conserva quien ya lo compró o, si no hay nadie, se registra a quien lo marca;
 * al reactivarlo se borra el comprador.
 */
export function applyChanges(item: ShoppingItem, patch: UpdateShoppingItemDto, userId: string): ShoppingChanges {
  const status = (patch.status ?? item.status) as ShoppingChanges['status'];
  return {
    title: patch.title ?? item.title,
    category: patch.category ?? item.category,
    quantity: patch.quantity ?? item.quantity,
    estimated_price: patch.estimated_price === undefined ? item.estimated_price : patch.estimated_price.toFixed(2),
    status,
    bought_by: status === 'COMPRADO' ? item.bought_by ?? userId : null,
    assigned_membership_id: patch.assigned_membership_id === undefined ? item.assigned_membership_id : patch.assigned_membership_id,
  };
}
