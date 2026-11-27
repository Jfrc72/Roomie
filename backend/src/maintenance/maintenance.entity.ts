export const MAINTENANCE_STATUSES = ['PENDIENTE', 'EN_PROGRESO', 'RESUELTO'] as const;
export const MAINTENANCE_PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

// Fila de la tabla maintenance_reports (db/024_shared_modules.sql).
export class MaintenanceReport {
  id: string;
  home_id: string;
  title: string;
  description: string;
  category: string;
  estimated_cost: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reported_by: string;
  assigned_membership_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/** Reporte con los nombres de quien lo reportó y del responsable. */
export interface MaintenanceReportRow {
  id: string;
  title: string;
  description: string;
  category: string;
  estimated_cost: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reported_by: string;
  reported_by_name: string;
  assigned_membership_id: string | null;
  assigned_to: string | null;
  assigned_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StatusCounts {
  pending: number;
  in_progress: number;
  resolved: number;
}

/** Filtros del listado ya normalizados: `null` significa "sin filtrar". */
export interface MaintenanceFilters {
  status: MaintenanceStatus | null;
  priority: MaintenancePriority | null;
  category: string | null;
}

/** Valores completos que se guardan al actualizar un reporte. */
export interface MaintenanceChanges {
  title: string;
  description: string;
  category: string;
  estimated_cost: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assigned_membership_id: string | null;
}
