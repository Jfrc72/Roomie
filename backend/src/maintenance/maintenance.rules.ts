import { canManageRecord, HomeRole } from '../common/permissions.rules';
import { UpdateMaintenanceReportDto } from './maintenance.dto';
import {
  MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES, MaintenanceChanges, MaintenanceFilters, MaintenancePriority, MaintenanceReport,
  MaintenanceReportRow, MaintenanceStatus,
} from './maintenance.entity';
import { MaintenanceReportView } from './maintenance.responses';

export interface RawFilters {
  status?: string;
  priority?: string;
  category?: string;
}

/** Indica qué filtro tiene un valor no permitido. Un filtro vacío equivale a no filtrar. */
export function invalidFilter(raw: RawFilters): 'estado' | 'prioridad' | null {
  if (raw.status && !(MAINTENANCE_STATUSES as readonly string[]).includes(raw.status)) return 'estado';
  if (raw.priority && !(MAINTENANCE_PRIORITIES as readonly string[]).includes(raw.priority)) return 'prioridad';
  return null;
}

/** Normaliza los filtros ya validados: vacío se convierte en `null` para que la consulta no filtre por ese campo. */
export function normalizeFilters(raw: RawFilters): MaintenanceFilters {
  return {
    status: (raw.status || null) as MaintenanceStatus | null,
    priority: (raw.priority || null) as MaintenancePriority | null,
    category: raw.category || null,
  };
}

/** Quien reportó, el responsable o un administrador pueden cambiar el estado y reasignar el reporte. */
export function canUpdateReport(role: HomeRole, reportedBy: string, assigneeUserId: string | null, userId: string): boolean {
  return canManageRecord(role, reportedBy, userId) || assigneeUserId === userId;
}

/** Convierte una fila a lo que ve la interfaz: costo numérico y permisos de quien consulta. */
export function toReportView(row: MaintenanceReportRow, role: HomeRole, userId: string): MaintenanceReportView {
  const { assigned_user_id: assigneeUserId, ...report } = row;
  return {
    ...report,
    estimated_cost: report.estimated_cost === null ? null : Number(report.estimated_cost),
    can_edit: canManageRecord(role, report.reported_by, userId),
    can_manage: canUpdateReport(role, report.reported_by, assigneeUserId, userId),
  };
}

/**
 * Valores finales del reporte tras aplicar los cambios recibidos. `undefined` conserva el valor actual;
 * `null` en costo o responsable lo borra.
 */
export function applyChanges(report: MaintenanceReport, patch: UpdateMaintenanceReportDto): MaintenanceChanges {
  let cost = report.estimated_cost;
  if (patch.estimated_cost !== undefined) cost = patch.estimated_cost === null ? null : patch.estimated_cost.toFixed(2);
  return {
    title: patch.title ?? report.title,
    description: patch.description ?? report.description,
    category: patch.category ?? report.category,
    estimated_cost: cost,
    priority: (patch.priority ?? report.priority) as MaintenancePriority,
    status: (patch.status ?? report.status) as MaintenanceStatus,
    assigned_membership_id: patch.assigned_membership_id === undefined ? report.assigned_membership_id : patch.assigned_membership_id,
  };
}
