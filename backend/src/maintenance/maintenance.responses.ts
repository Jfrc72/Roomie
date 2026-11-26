import { ApiProperty } from '@nestjs/swagger';
import { MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES } from './maintenance.entity';

export class MaintenanceReportView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Fuga en el lavaplatos' }) title: string;
  @ApiProperty({ example: 'Gotea al cerrar la llave', description: 'Cadena vacía si no hay detalles.' }) description: string;
  @ApiProperty({ example: 'Plomería' }) category: string;
  @ApiProperty({ type: Number, nullable: true, example: 45000 }) estimated_cost: number | null;
  @ApiProperty({ enum: MAINTENANCE_PRIORITIES }) priority: string;
  @ApiProperty({ enum: MAINTENANCE_STATUSES }) status: string;
  @ApiProperty({ format: 'uuid', description: 'Cuenta de quien reportó.' }) reported_by: string;
  @ApiProperty({ example: 'Miguel' }) reported_by_name: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Membresía del responsable.' }) assigned_membership_id: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Nombre del responsable.' }) assigned_to: string | null;
  @ApiProperty({ description: 'true si quien consulta puede editar o eliminar el reporte (lo reportó o es administrador).' }) can_edit: boolean;
  @ApiProperty({ description: 'true si quien consulta puede cambiar su estado o reasignarlo (lo reportó, es el responsable o es administrador).' }) can_manage: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) created_at: string | Date;
  @ApiProperty({ type: String, format: 'date-time' }) updated_at: string | Date;
}

export class MaintenanceCountsView {
  @ApiProperty({ example: 2, description: 'Reportes pendientes.' }) pending: number;
  @ApiProperty({ example: 1, description: 'Reportes en progreso.' }) in_progress: number;
  @ApiProperty({ example: 4, description: 'Reportes resueltos.' }) resolved: number;
}

export class MaintenanceOverview {
  @ApiProperty({ type: [MaintenanceReportView], description: 'Reportes que cumplen los filtros, de mayor a menor prioridad.' }) reports: MaintenanceReportView[];
  @ApiProperty({ type: MaintenanceCountsView, description: 'Contadores de todo el apartamento: no dependen de los filtros.' }) counts: MaintenanceCountsView;
}

/** Resumen que consume el inicio (Dashboard). */
export class MaintenanceDigest {
  urgent: number;
}
