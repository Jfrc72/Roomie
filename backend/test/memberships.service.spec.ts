import { MembershipsService } from '../src/homes/memberships.service';
import { MembershipsRepository } from '../src/homes/memberships.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { client, database, homeId, memberId, service, user } from './helpers';

describe('Integrantes y roles', () => {
  let memberships: MembershipsService;
  const member = { id: memberId, user_id: 'roommate', home_id: homeId, role: 'member', active: true };
  const repo = { find: jest.fn(), adminCount: jest.fn(), remove: jest.fn(), changeRole: jest.fn() };
  const access = { lockHome: jest.fn() };
  const activities = { add: jest.fn() };
  const notifications = { notify: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks(); repo.find.mockResolvedValue(member); repo.adminCount.mockResolvedValue(1);
    memberships = await service(MembershipsService, [
      { provide: MembershipsRepository, useValue: repo }, { provide: DatabaseService, useValue: database() },
      { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities }, { provide: NotificationsService, useValue: notifications },
    ]);
  });
  it('HU1.3 retirar usa una baja lógica y mantiene la actividad', async () => {
    await memberships.change(user.id, homeId, memberId, null);
    expect(repo.remove).toHaveBeenCalledWith(member, client);
    expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'retiró a un integrante del apartamento', client);
  });
  it('HU1.3 una persona sin permiso no retira a otro integrante', async () => {
    access.lockHome.mockRejectedValue(new Error('Sin permiso'));
    await expect(memberships.change(user.id, homeId, memberId, null)).rejects.toThrow('Sin permiso');
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it('HU1.3 no cambia un integrante inexistente o de otro hogar', async () => {
    repo.find.mockResolvedValue(null);
    await expect(memberships.change(user.id, homeId, memberId, null)).rejects.toMatchObject({ status: 404 });
  });
  it('HU1.3 no permite retirar al último administrador', async () => {
    repo.find.mockResolvedValue({ ...member, role: 'admin' });
    await expect(memberships.change(user.id, homeId, memberId, null)).rejects.toMatchObject({ status: 409 });
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it('HU1.3 puede retirar a un administrador si queda otro', async () => {
    repo.find.mockResolvedValue({ ...member, role: 'admin' }); repo.adminCount.mockResolvedValue(2);
    await memberships.change(user.id, homeId, memberId, null);
    expect(repo.remove).toHaveBeenCalled();
  });
  it('HU1.4 convertir en administrador avisa a la persona afectada', async () => {
    await memberships.change(user.id, homeId, memberId, 'admin');
    expect(repo.changeRole).toHaveBeenCalledWith(memberId, 'admin', client);
    expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ userId: member.user_id, message: 'Tu nuevo rol es administrador.' }));
  });
  it('HU1.4 no degrada al último administrador', async () => {
    repo.find.mockResolvedValue({ ...member, role: 'admin' });
    await expect(memberships.change(user.id, homeId, memberId, 'member')).rejects.toMatchObject({ status: 409 });
    expect(repo.changeRole).not.toHaveBeenCalled();
  });
  it('HU1.4 permite compartir y luego devolver el rol de integrante', async () => {
    repo.find.mockResolvedValue({ ...member, role: 'admin' }); repo.adminCount.mockResolvedValue(2);
    await memberships.change(user.id, homeId, memberId, 'member');
    expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ message: 'Tu nuevo rol es integrante.' }));
  });
  it('HU1.4 mantener el rol de administrador no se confunde con retirarlo', async () => {
    repo.find.mockResolvedValue({ ...member, role: 'admin' });
    await memberships.change(user.id, homeId, memberId, 'admin');
    expect(repo.adminCount).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });
});
