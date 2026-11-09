import { InvitationsService } from '../src/homes/invitations.service';
import { InvitationsRepository } from '../src/homes/invitations.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { hashToken } from '../src/auth/passwords';
import { client, database, homeId, service, user } from './helpers';

describe('Invitaciones', () => {
  let invitations: InvitationsService;
  const invite = { id: 'invitacion', home_id: homeId, email: user.email, created_by: 'administrador', status: 'pending', expires_at: new Date('2099-01-01') };
  const repo = { list: jest.fn(), count: jest.fn(), hasEmail: jest.fn(), create: jest.fn(), revoke: jest.fn(), find: jest.fn(), lockHome: jest.fn(), refresh: jest.fn(), alreadyMember: jest.fn(), accept: jest.fn() };
  const access = { requireHome: jest.fn(), lockHome: jest.fn() };
  const activities = { add: jest.fn() };
  const notifications = { notify: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks(); repo.list.mockResolvedValue([]); repo.count.mockResolvedValue(3); repo.hasEmail.mockResolvedValue(false);
    repo.revoke.mockResolvedValue(true); repo.find.mockResolvedValue(invite); repo.lockHome.mockResolvedValue(true); repo.refresh.mockResolvedValue(invite); repo.alreadyMember.mockResolvedValue(false);
    invitations = await service(InvitationsService, [
      { provide: InvitationsRepository, useValue: repo }, { provide: DatabaseService, useValue: database() },
      { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities }, { provide: NotificationsService, useValue: notifications },
    ]);
  });
  it('HU1.2 solo permite al administrador listar invitaciones', async () => {
    await invitations.list(user.id, homeId);
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId, true);
  });
  it('HU1.2 genera un enlace y guarda solo el hash del token', async () => {
    const result = await invitations.create(user.id, homeId, 'roommate@roomie.test');
    const value = new URL(result.url).searchParams.get('token')!;
    expect(value).toMatch(/^[a-f0-9]{64}$/);
    expect(repo.create).toHaveBeenCalledWith(homeId, 'roommate@roomie.test', hashToken(value), user.id, client);
  });
  it('HU1.2 impide invitar cuando el apartamento tiene ocho integrantes', async () => {
    repo.count.mockResolvedValue(8);
    await expect(invitations.create(user.id, homeId, 'roommate@roomie.test')).rejects.toMatchObject({ status: 409 });
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('HU1.2 no invita a quien ya pertenece al hogar', async () => {
    repo.hasEmail.mockResolvedValue(true);
    await expect(invitations.create(user.id, homeId, user.email)).rejects.toMatchObject({ status: 409 });
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('HU1.2 no crea un enlace si falta permiso', async () => {
    access.lockHome.mockRejectedValue(new Error('Solo administradores'));
    await expect(invitations.create(user.id, homeId, user.email)).rejects.toThrow('Solo administradores');
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('HU1.2 cancela una invitación pendiente dentro del hogar correcto', async () => {
    await invitations.revoke(user.id, homeId, invite.id);
    expect(repo.revoke).toHaveBeenCalledWith(homeId, invite.id, client);
  });
  it('HU1.2 informa cuando la invitación pendiente no existe', async () => {
    repo.revoke.mockResolvedValue(false);
    await expect(invitations.revoke(user.id, homeId, 'otra')).rejects.toMatchObject({ status: 404 });
  });
  it('HU1.2 rechaza un token que no existe', async () => {
    repo.find.mockResolvedValue(null);
    await expect(invitations.accept(user, 'a'.repeat(64))).rejects.toMatchObject({ status: 404 });
  });
  it('HU1.2 una invitación no permite volver a entrar a un apartamento archivado', async () => {
    repo.lockHome.mockResolvedValue(false);
    await expect(invitations.accept(user, 'a'.repeat(64))).rejects.toMatchObject({ status: 409 });
    expect(repo.accept).not.toHaveBeenCalled();
  });
  it.each(['accepted', 'revoked'])('HU1.2 no vuelve a usar una invitación %s', async status => {
    repo.refresh.mockResolvedValue({ ...invite, status });
    await expect(invitations.accept(user, 'a'.repeat(64))).rejects.toThrow('Esta invitación venció o ya fue utilizada.');
  });
  it('HU1.2 revisa la fecha de vencimiento antes de aceptar', async () => {
    repo.refresh.mockResolvedValue({ ...invite, expires_at: new Date('2000-01-01') });
    await expect(invitations.accept(user, 'a'.repeat(64))).rejects.toMatchObject({ status: 409 });
  });
  it('HU1.2 solo la cuenta del correo invitado puede aceptar', async () => {
    await expect(invitations.accept({ ...user, email: 'otra@roomie.test' }, 'a'.repeat(64))).rejects.toMatchObject({ status: 403 });
  });
  it('HU1.2 rechaza aceptar si ya se pertenece al hogar', async () => {
    repo.alreadyMember.mockResolvedValue(true);
    await expect(invitations.accept(user, 'a'.repeat(64))).rejects.toThrow('Ya perteneces a este apartamento.');
  });
  it('HU1.2 vuelve a comprobar el cupo al aceptar bajo el bloqueo del hogar', async () => {
    repo.count.mockResolvedValue(8);
    await expect(invitations.accept(user, 'a'.repeat(64))).rejects.toThrow('El apartamento llegó al límite de 8 integrantes.');
    expect(repo.accept).not.toHaveBeenCalled();
  });
  it('HU1.2 acepta el último cupo disponible y avisa al administrador', async () => {
    repo.count.mockResolvedValue(7);
    await invitations.accept(user, 'a'.repeat(64));
    expect(repo.accept).toHaveBeenCalledWith(invite, user.id, user.sessionHash, client);
    expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ homeId, userId: invite.created_by, href: '/apartamento' }));
  });
});
