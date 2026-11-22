import { RulesService } from '../src/rules/rules.service';
import { RulesRepository } from '../src/rules/rules.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { client, database, homeId, service, user } from './helpers';

const versionId = '00000000-0000-4000-8000-000000000060';
const otherId = '00000000-0000-4000-8000-000000000002';
const content = 'Limpiar los espacios comunes al terminar.';

describe('Reglamento', () => {
  let rules: RulesService;
  const repo = {
    versions: jest.fn(), reports: jest.fn(), acceptances: jest.fn(), latest: jest.fn(), findVersion: jest.fn(),
    createVersion: jest.fn(), accept: jest.fn(), otherMembers: jest.fn(),
  };
  const access = { requireHome: jest.fn(), lockHome: jest.fn() };
  const activities = { add: jest.fn() };
  const notifications = { notify: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    repo.latest.mockResolvedValue({ id: versionId, version: 2, content: 'Reglamento anterior' });
    repo.createVersion.mockResolvedValue(versionId);
    repo.otherMembers.mockResolvedValue([otherId]);
    repo.findVersion.mockResolvedValue({ id: versionId, home_id: homeId, version: 2 });
    repo.accept.mockResolvedValue(true);
    rules = await service(RulesService, [
      { provide: RulesRepository, useValue: repo }, { provide: DatabaseService, useValue: database() }, { provide: HomeAccessService, useValue: access },
      { provide: ActivitiesService, useValue: activities }, { provide: NotificationsService, useValue: notifications },
    ]);
  });

  describe('HU9.1 publicar', () => {
    it('HU9.1 bloquea el hogar como administrador y numera la versión siguiente', async () => {
      expect(await rules.publish(user, homeId, { content, notes: 'Turnos' })).toEqual({ id: versionId, version: 3, message: 'Versión publicada.' });
      expect(access.lockHome).toHaveBeenCalledWith(user.id, homeId, client);
      expect(repo.createVersion).toHaveBeenCalledWith({ homeId, version: 3, content, notes: 'Turnos', userId: user.id }, client);
    });
    it('HU9.1 no crea otra versión si el texto no cambió', async () => {
      repo.latest.mockResolvedValue({ id: versionId, version: 2, content });
      await expect(rules.publish(user, homeId, { content, notes: '' })).rejects.toMatchObject({ status: 409 });
      expect(repo.createVersion).not.toHaveBeenCalled();
    });
    it('HU9.1 un integrante que no administra no publica', async () => {
      access.lockHome.mockRejectedValue(new Error('Se requiere administrador'));
      await expect(rules.publish(user, homeId, { content, notes: '' })).rejects.toThrow('Se requiere administrador');
      expect(repo.createVersion).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });
    it('HU9.1 la primera versión de un hogar es la número 1', async () => {
      repo.latest.mockResolvedValue(null);
      expect((await rules.publish(user, homeId, { content, notes: '' })).version).toBe(1);
    });
  });

  describe('HU9.2 aceptar', () => {
    it('HU9.2 quien publica acepta su versión y los demás reciben un aviso', async () => {
      await rules.publish(user, homeId, { content, notes: '' });
      expect(repo.accept).toHaveBeenCalledWith(versionId, homeId, user.id, client);
      expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ userId: otherId, title: 'Nuevo reglamento', href: '/reglamento', sourceKey: `rules:${versionId}:${otherId}` }));
    });
    it('HU9.2 acepta la versión vigente y lo registra en la actividad', async () => {
      expect(await rules.accept(user.id, versionId)).toEqual({ message: 'Aceptaste el reglamento.' });
      expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId, false, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'aceptó la versión 2 del reglamento', client);
    });
    it('HU9.2 rechaza aceptar una versión que ya no es la vigente', async () => {
      repo.latest.mockResolvedValue({ id: 'mas-reciente', version: 3, content });
      await expect(rules.accept(user.id, versionId)).rejects.toMatchObject({ status: 409 });
      expect(repo.accept).not.toHaveBeenCalled();
    });
    it('HU9.2 repetir la aceptación no duplica la actividad', async () => {
      repo.accept.mockResolvedValue(false);
      expect(await rules.accept(user.id, versionId)).toEqual({ message: 'Ya habías aceptado esta versión.' });
      expect(activities.add).not.toHaveBeenCalled();
    });
    it('HU9.2 una versión inexistente responde 404', async () => {
      repo.findVersion.mockResolvedValue(null);
      await expect(rules.accept(user.id, versionId)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('HU9.3 historial', () => {
    const current = { id: versionId, version: 3, content, notes: 'Turnos', author: 'Juan', created_at: new Date() };
    const previous = { ...current, id: 'v2', version: 2, notes: 'Primera revisión', author: 'Miguel' };
    it('HU9.3 separa la versión vigente del historial y conserva autor y notas', async () => {
      repo.versions.mockResolvedValue([current, previous]);
      repo.reports.mockResolvedValue([]);
      repo.acceptances.mockResolvedValue([{ membership_id: 'm', user_id: user.id, name: 'Juan', accepted_at: new Date() }]);
      const data = await rules.list(user.id, homeId);
      expect(data).toMatchObject({ current, history: [previous], accepted_by_me: true });
      expect(repo.acceptances).toHaveBeenCalledWith(homeId, versionId);
    });
    it('HU9.3 un hogar sin versiones muestra un estado vacío', async () => {
      repo.versions.mockResolvedValue([]);
      repo.reports.mockResolvedValue([]);
      expect(await rules.list(user.id, homeId)).toEqual({ current: null, accepted_by_me: false, acceptances: [], history: [], reports: [] });
      expect(repo.acceptances).not.toHaveBeenCalled();
    });
    it('HU9.3 no entrega el reglamento a quien no pertenece al hogar', async () => {
      access.requireHome.mockRejectedValue(new Error('Sin acceso'));
      await expect(rules.list(user.id, homeId)).rejects.toThrow('Sin acceso');
      expect(repo.versions).not.toHaveBeenCalled();
    });
    it('HU9.3 una aceptación pendiente no cuenta como aceptada', async () => {
      repo.versions.mockResolvedValue([current]);
      repo.reports.mockResolvedValue([]);
      repo.acceptances.mockResolvedValue([{ membership_id: 'm', user_id: user.id, name: 'Juan', accepted_at: null }]);
      expect((await rules.list(user.id, homeId)).accepted_by_me).toBe(false);
    });
  });
});
