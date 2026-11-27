export type HomeRole = 'admin' | 'member';

/**
 * Regla común de edición de Gastos, Compras, Mantenimiento y Tareas:
 * un registro lo modifica quien lo creó o un administrador del apartamento.
 */
export function canManageRecord(role: HomeRole, ownerId: string, userId: string): boolean {
  return role === 'admin' || ownerId === userId;
}
