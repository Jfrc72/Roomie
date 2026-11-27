import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { MaintenanceController } from '../src/maintenance/maintenance.controller';
import { MaintenanceReportDto, UpdateMaintenanceReportDto } from '../src/maintenance/maintenance.dto';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { homeId, user } from './helpers';
import { startApi, TestApi } from './http-app';

const membership = '00000000-0000-4000-8000-000000000030';
const reportId = '00000000-0000-4000-8000-000000000050';
const validation = (type: new () => object, value: object) => validateSync(plainToInstance(type, value), { whitelist: true, forbidNonWhitelisted: true });
const report = (over: object = {}) => ({ title: 'Fuga en lavaplatos', description: 'Gotea', category: 'Plomería', estimated_cost: 45000, priority: 'ALTA', assigned_membership_id: membership, ...over });

describe('Validación de reportes de mantenimiento', () => {
  it('acepta un reporte completo y uno con solo título y categoría', () => {
    expect(validation(MaintenanceReportDto, report())).toHaveLength(0);
    expect(validation(MaintenanceReportDto, { title: 'Puerta del balcón', category: 'Carpintería' })).toHaveLength(0);
    expect(validation(MaintenanceReportDto, report({ estimated_cost: null, assigned_membership_id: null, description: '' }))).toHaveLength(0);
  });
  it('quita los espacios del título', () => {
    expect(plainToInstance(MaintenanceReportDto, report({ title: '  Fuga  ' })).title).toBe('Fuga');
  });
  it.each([[{ title: '' }], [{ title: 'ab' }], [{ title: 'x'.repeat(256) }], [{ category: '' }], [{ priority: 'CRITICA' }], [{ priority: 'alta' }], [{ estimated_cost: -1 }], [{ estimated_cost: 1.005 }],
    [{ estimated_cost: '45000' }], [{ description: 'x'.repeat(2001) }], [{ assigned_membership_id: 'no-es-uuid' }], [{ status: 'RESUELTO' }]])('rechaza %j', over => {
    expect(validation(MaintenanceReportDto, report(over)).length).toBeGreaterThan(0);
  });
  it('la actualización acepta cambios parciales y null para borrar costo o responsable, y rechaza el resto', () => {
    for (const ok of [{}, { status: 'EN_PROGRESO' }, { estimated_cost: null }, { assigned_membership_id: null }, { priority: 'URGENTE', description: '' }]) {
      expect(validation(UpdateMaintenanceReportDto, ok)).toHaveLength(0);
    }
    for (const bad of [{ title: null }, { status: 'TERMINADO' }, { status: null }, { priority: null }, { description: null }, { estimated_cost: -5 }, { reported_by: 'x' }]) {
      expect(validation(UpdateMaintenanceReportDto, bad).length).toBeGreaterThan(0);
    }
  });
});

describe('Rutas HTTP de mantenimiento', () => {
  const maintenance = { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), restore: jest.fn() };
  let api: TestApi;
  beforeEach(() => { jest.resetAllMocks(); });
  beforeAll(async () => { api = await startApi([MaintenanceController], [{ provide: MaintenanceService, useValue: maintenance }]); });
  afterAll(() => api.close());

  it('GET /maintenance pasa el apartamento y los tres filtros al servicio', async () => {
    maintenance.list.mockResolvedValue({ reports: [], counts: { pending: 0, in_progress: 0, resolved: 0 } });
    const reply = await api.call(`/maintenance?homeId=${homeId}&status=PENDIENTE&priority=ALTA&category=Plomer%C3%ADa`);
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ data: { reports: [], counts: { pending: 0, in_progress: 0, resolved: 0 } } });
    expect(maintenance.list).toHaveBeenCalledWith(user.id, homeId, { status: 'PENDIENTE', priority: 'ALTA', category: 'Plomería' });
  });
  it('GET /maintenance sin filtros los entrega como indefinidos', async () => {
    maintenance.list.mockResolvedValue({ reports: [], counts: {} });
    await api.call(`/maintenance?homeId=${homeId}`);
    expect(maintenance.list).toHaveBeenCalledWith(user.id, homeId, { status: undefined, priority: undefined, category: undefined });
  });
  it('un filtro inválido llega como 400 con el mensaje del servicio', async () => {
    maintenance.list.mockRejectedValue(new BadRequestException('Filtro de estado no válido.'));
    expect(await api.call(`/maintenance?homeId=${homeId}&status=INVALIDO`)).toEqual({ status: 400, body: { error: 'Filtro de estado no válido.' } });
  });
  it('POST /maintenance responde 200 con el id y rechaza datos inválidos sin llegar al servicio', async () => {
    maintenance.create.mockResolvedValue({ id: reportId, message: 'Reporte creado.' });
    expect(await api.call(`/maintenance?homeId=${homeId}`, 'POST', report())).toEqual({ status: 200, body: { data: { id: reportId, message: 'Reporte creado.' } } });
    expect(maintenance.create).toHaveBeenCalledWith(user, homeId, expect.objectContaining({ title: 'Fuga en lavaplatos', estimated_cost: 45000 }));
    for (const over of [{ title: '' }, { priority: 'CRITICA' }, { estimated_cost: -1 }, { assigned_membership_id: 'x' }]) {
      expect((await api.call(`/maintenance?homeId=${homeId}`, 'POST', report(over))).status).toBe(400);
    }
    expect(maintenance.create).toHaveBeenCalledTimes(1);
  });
  it('PATCH /maintenance/:id acepta cambios parciales y rechaza identificadores y estados inválidos', async () => {
    maintenance.update.mockResolvedValue({ message: 'Reporte actualizado.' });
    expect((await api.call(`/maintenance/${reportId}`, 'PATCH', { status: 'EN_PROGRESO', estimated_cost: null })).body).toEqual({ data: { message: 'Reporte actualizado.' } });
    expect(maintenance.update).toHaveBeenCalledWith(user, reportId, expect.objectContaining({ status: 'EN_PROGRESO', estimated_cost: null }));
    expect(await api.call('/maintenance/no-es-un-uuid', 'PATCH', { status: 'RESUELTO' })).toEqual({ status: 400, body: { error: 'Identificador inválido.' } });
    expect((await api.call(`/maintenance/${reportId}`, 'PATCH', { status: 'TERMINADO' })).status).toBe(400);
  });
  it('DELETE y restore usan el usuario de la sesión', async () => {
    maintenance.remove.mockResolvedValue({ message: 'Reporte eliminado.' });
    maintenance.restore.mockResolvedValue({ message: 'Reporte restaurado.' });
    expect((await api.call(`/maintenance/${reportId}`, 'DELETE')).status).toBe(200);
    expect((await api.call(`/maintenance/${reportId}/restore`, 'POST', {})).body).toEqual({ data: { message: 'Reporte restaurado.' } });
    expect(maintenance.remove).toHaveBeenCalledWith(user, reportId);
    expect(maintenance.restore).toHaveBeenCalledWith(user, reportId);
  });
  it('sin sesión todas las rutas responden 401 sin llegar al servicio', async () => {
    const anonymous = await startApi([MaintenanceController], [{ provide: MaintenanceService, useValue: maintenance }], null);
    try {
      expect((await anonymous.call(`/maintenance?homeId=${homeId}`)).status).toBe(401);
      expect((await anonymous.call(`/maintenance/${reportId}/restore`, 'POST', {})).status).toBe(401);
      expect(maintenance.list).not.toHaveBeenCalled();
      expect(maintenance.restore).not.toHaveBeenCalled();
    } finally {
      await anonymous.close();
    }
  });
});
