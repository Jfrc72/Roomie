import { ForbiddenException } from '@nestjs/common';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { DatabaseService } from '../src/database/database.service';
import { MaintenanceRepository } from '../src/maintenance/maintenance.repository';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { client, database, homeId, memberId, service, user } from './helpers';

const other = '00000000-0000-4000-8000-000000000002';
const reportId = '00000000-0000-4000-8000-000000000050';
const dto = (over: object = {}) => ({ title: 'Fuga de agua', description: 'Cocina', category: 'Plomería', estimated_cost: null, priority: 'ALTA', assigned_membership_id: null, ...over });
const stored = (over: object = {}) => ({
  id: reportId, home_id: homeId, title: 'Fuga de agua', description: 'Cocina', category: 'Plomería', estimated_cost: '25.50', priority: 'ALTA',
  status: 'PENDIENTE', reported_by: other, assigned_membership_id: null, ...over,
});

describe('Mantenimiento', () => {
  let maintenance: MaintenanceService;
  const repo = {
    list: jest.fn(), counts: jest.fn(), urgentCount: jest.fn(), lock: jest.fn(), assigneeUserId: jest.fn(),
    isActiveMembership: jest.fn(), insert: jest.fn(), update: jest.fn(), setDeleted: jest.fn(),
  };
  const access = { requireHome: jest.fn(), lockHome: jest.fn() };
  const activities = { add: jest.fn() };
  let db: ReturnType<typeof database>;

  beforeEach(async () => {
    jest.resetAllMocks();
    access.requireHome.mockResolvedValue('member');
    access.lockHome.mockResolvedValue('member');
    repo.insert.mockResolvedValue(reportId);
    repo.isActiveMembership.mockResolvedValue(true);
    repo.list.mockResolvedValue([]);
    repo.counts.mockResolvedValue({ pending: 0, in_progress: 0, resolved: 0 });
    db = database();
    maintenance = await service(MaintenanceService, [
      { provide: MaintenanceRepository, useValue: repo }, { provide: DatabaseService, useValue: db },
      { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities },
    ]);
  });

  describe('HU6.1 reportar problemas', () => {
    it('HU6.1 guarda categoría, prioridad, costo y responsable y devuelve el id', async () => {
      const data = dto({ estimated_cost: 25.5, assigned_membership_id: memberId });
      await expect(maintenance.create(user, homeId, data as never)).resolves.toEqual({ id: reportId, message: 'Reporte creado.' });
      expect(repo.isActiveMembership).toHaveBeenCalledWith(homeId, memberId, client);
      expect(repo.insert).toHaveBeenCalledWith(homeId, user.id, data, client);
      expect(access.lockHome).toHaveBeenCalledWith(user.id, homeId, client, false);
    });
    it('HU6.1 el responsable es opcional: sin él no se consultan membresías', async () => {
      await maintenance.create(user, homeId, dto() as never);
      await maintenance.create(user, homeId, dto({ assigned_membership_id: undefined }) as never);
      expect(repo.isActiveMembership).not.toHaveBeenCalled();
    });
    it('HU6.1 rechaza un responsable que no pertenece al hogar y no guarda nada', async () => {
      repo.isActiveMembership.mockResolvedValue(false);
      await expect(maintenance.create(user, homeId, dto({ assigned_membership_id: memberId }) as never))
        .rejects.toMatchObject({ status: 400, message: 'El responsable debe pertenecer al apartamento.' });
      expect(repo.insert).not.toHaveBeenCalled();
      expect(activities.add).not.toHaveBeenCalled();
    });
    it('HU6.1 registra la actividad con el título del reporte', async () => {
      await maintenance.create(user, homeId, dto() as never);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'reportó "Fuga de agua" para mantenimiento', client);
    });
    it('HU6.1 una persona de fuera no crea reportes y se exige indicar el apartamento', async () => {
      access.requireHome.mockRejectedValue(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(maintenance.create(user, homeId, dto() as never)).rejects.toMatchObject({ status: 403 });
      expect(db.transaction).not.toHaveBeenCalled();
      await expect(maintenance.create(user, undefined, dto() as never)).rejects.toMatchObject({ status: 400, message: 'Selecciona un apartamento.' });
    });
  });

  describe('HU6.2 filtrar y contar reportes', () => {
    it('HU6.2 combina los tres filtros y conserva los contadores del hogar', async () => {
      repo.list.mockResolvedValue([{ id: reportId, estimated_cost: '15.25', reported_by: other, assigned_user_id: null }]);
      repo.counts.mockResolvedValue({ pending: 2, in_progress: 1, resolved: 4 });
      const result = await maintenance.list(user.id, homeId, { status: 'PENDIENTE', priority: 'ALTA', category: 'Plomería' });
      expect(repo.list).toHaveBeenCalledWith(homeId, { status: 'PENDIENTE', priority: 'ALTA', category: 'Plomería' });
      expect(repo.counts).toHaveBeenCalledWith(homeId);
      expect(result.counts).toEqual({ pending: 2, in_progress: 1, resolved: 4 });
      expect(result.reports).toMatchObject([{ estimated_cost: 15.25, can_edit: false, can_manage: false }]);
    });
    it('HU6.2 rechaza un filtro de estado inválido antes de consultar', async () => {
      await expect(maintenance.list(user.id, homeId, { status: 'OTRO' })).rejects.toMatchObject({ status: 400, message: 'Filtro de estado no válido.' });
      expect(repo.list).not.toHaveBeenCalled();
    });
    it('HU6.2 rechaza un filtro de prioridad inválido antes de consultar', async () => {
      await expect(maintenance.list(user.id, homeId, { priority: 'OTRA' })).rejects.toMatchObject({ status: 400, message: 'Filtro de prioridad no válido.' });
      expect(repo.counts).not.toHaveBeenCalled();
    });
    it('HU6.2 un filtro vacío equivale a no filtrar', async () => {
      await maintenance.list(user.id, homeId, { status: '', priority: '', category: '' });
      expect(repo.list).toHaveBeenCalledWith(homeId, { status: null, priority: null, category: null });
    });
    it('HU6.2 una persona de fuera no ve los reportes ni los contadores', async () => {
      access.requireHome.mockRejectedValue(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(maintenance.list(user.id, homeId, {})).rejects.toMatchObject({ status: 403 });
      expect(repo.list).not.toHaveBeenCalled();
      expect(repo.counts).not.toHaveBeenCalled();
    });
    it('HU6.2 marca qué reportes puede editar y gestionar quien consulta, incluido el responsable', async () => {
      repo.list.mockResolvedValue([
        { id: 'propio', estimated_cost: null, reported_by: user.id, assigned_user_id: null },
        { id: 'asignado', estimated_cost: null, reported_by: other, assigned_user_id: user.id },
        { id: 'ajeno', estimated_cost: null, reported_by: other, assigned_user_id: other },
      ]);
      const { reports } = await maintenance.list(user.id, homeId, {});
      expect(reports.map(report => [report.can_edit, report.can_manage])).toEqual([[true, true], [false, true], [false, false]]);
      expect(reports.every(report => !('assigned_user_id' in report))).toBe(true);
    });
    it('HU6.2 el resumen del inicio cuenta los reportes urgentes sin resolver', async () => {
      repo.urgentCount.mockResolvedValue(3);
      await expect(maintenance.summary(homeId)).resolves.toEqual({ urgent: 3 });
    });
  });

  describe('HU6.3 gestionar el estado y el responsable', () => {
    it('HU6.3 el responsable puede resolver un reporte que no creó', async () => {
      repo.lock.mockResolvedValue(stored({ assigned_membership_id: memberId }));
      repo.assigneeUserId.mockResolvedValue(user.id);
      await expect(maintenance.update(user, reportId, { status: 'RESUELTO' })).resolves.toEqual({ message: 'Reporte actualizado.' });
      expect(repo.assigneeUserId).toHaveBeenCalledWith(homeId, memberId, client);
      expect(repo.update).toHaveBeenCalledWith(reportId, expect.objectContaining({ status: 'RESUELTO', title: 'Fuga de agua', estimated_cost: '25.50' }), client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'actualizó el reporte "Fuga de agua"', client);
    });
    it('HU6.3 un integrante ajeno al reporte no puede cambiarlo', async () => {
      repo.lock.mockResolvedValue(stored());
      await expect(maintenance.update(user, reportId, { status: 'RESUELTO' }))
        .rejects.toMatchObject({ status: 403, message: 'Solo quien reportó, el responsable o un administrador puede actualizar el reporte.' });
      expect(repo.update).not.toHaveBeenCalled();
    });
    it('HU6.3 quien reportó y un administrador también pueden actualizarlo', async () => {
      repo.lock.mockResolvedValue(stored({ reported_by: user.id }));
      await expect(maintenance.update(user, reportId, { priority: 'URGENTE' })).resolves.toBeDefined();
      access.lockHome.mockResolvedValue('admin');
      repo.lock.mockResolvedValue(stored());
      await expect(maintenance.update(user, reportId, { status: 'EN_PROGRESO' })).resolves.toBeDefined();
      expect(repo.update).toHaveBeenCalledTimes(2);
    });
    it('HU6.3 reasignar valida al responsable y null lo quita; null en el costo lo borra', async () => {
      repo.lock.mockResolvedValue(stored({ reported_by: user.id, assigned_membership_id: memberId }));
      repo.assigneeUserId.mockResolvedValue(other);
      await maintenance.update(user, reportId, { assigned_membership_id: null, estimated_cost: null });
      expect(repo.update.mock.calls[0][1]).toMatchObject({ assigned_membership_id: null, estimated_cost: null });
      repo.isActiveMembership.mockResolvedValue(false);
      await expect(maintenance.update(user, reportId, { assigned_membership_id: other })).rejects.toMatchObject({ status: 400, message: 'El responsable debe pertenecer al apartamento.' });
    });
    it('HU6.3 un cuerpo vacío se rechaza sin abrir la transacción', async () => {
      await expect(maintenance.update(user, reportId, {})).rejects.toMatchObject({ status: 400, message: 'Indica qué deseas actualizar.' });
      expect(db.transaction).not.toHaveBeenCalled();
    });
    it('HU6.3 el autor deshace la eliminación conservando el reporte', async () => {
      repo.lock.mockResolvedValue(stored({ reported_by: user.id }));
      await expect(maintenance.restore(user, reportId)).resolves.toEqual({ message: 'Reporte restaurado.' });
      expect(repo.lock).toHaveBeenCalledWith(reportId, true, client);
      expect(repo.setDeleted).toHaveBeenCalledWith(reportId, false, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'restauró el reporte "Fuga de agua"', client);
    });
    it('HU6.3 solo quien reportó o un administrador elimina o restaura; el responsable no', async () => {
      repo.lock.mockResolvedValue(stored({ assigned_membership_id: memberId }));
      await expect(maintenance.remove(user, reportId)).rejects.toMatchObject({ status: 403, message: 'Solo quien reportó o un administrador puede eliminar el reporte.' });
      await expect(maintenance.restore(user, reportId)).rejects.toMatchObject({ status: 403, message: 'Solo quien reportó o un administrador puede restaurar el reporte.' });
      expect(repo.setDeleted).not.toHaveBeenCalled();
      access.lockHome.mockResolvedValue('admin');
      await expect(maintenance.remove(user, reportId)).resolves.toEqual({ message: 'Reporte eliminado.' });
      expect(repo.setDeleted).toHaveBeenCalledWith(reportId, true, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'eliminó el reporte "Fuga de agua"', client);
    });
    it('HU6.3 un reporte inexistente o no eliminado da 404 con el mensaje de cada caso', async () => {
      repo.lock.mockResolvedValue(null);
      await expect(maintenance.update(user, reportId, { status: 'RESUELTO' })).rejects.toMatchObject({ status: 404, message: 'Reporte no encontrado.' });
      await expect(maintenance.remove(user, reportId)).rejects.toMatchObject({ status: 404, message: 'Reporte no encontrado.' });
      await expect(maintenance.restore(user, reportId)).rejects.toMatchObject({ status: 404, message: 'Reporte eliminado no encontrado.' });
      expect(access.lockHome).not.toHaveBeenCalled();
    });
  });
});
