import { ForbiddenException } from '@nestjs/common';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { DatabaseService } from '../src/database/database.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PollsRepository } from '../src/polls/polls.repository';
import { PollsService } from '../src/polls/polls.service';
import { client, database, homeId, memberId, service, user } from './helpers';

const other = '00000000-0000-4000-8000-000000000002';
const pollId = '00000000-0000-4000-8000-000000000060';
const optionId = '00000000-0000-4000-8000-000000000061';
const dto = (over: object = {}) => ({ title: '¿Pintamos la sala?', options: ['Verde', 'Blanco'], ...over });
const locked = (over: object = {}) => ({ id: pollId, home_id: homeId, title: '¿Pintamos la sala?', rule: 'simple', status: 'open', closes_at: null, created_by: user.id, ...over });
const row = (over: object = {}) => ({
  id: pollId, title: '¿Pintamos la sala?', description: '', rule: 'simple', anonymous: false, closes_at: null, status: 'open', created_by: user.id, creator: 'Juan',
  created_at: new Date('2026-11-20'), closed_at: null, eligible_count: 2, my_option_id: null, voters: 1, ...over,
});

describe('Votaciones', () => {
  let polls: PollsService;
  const repo = {
    list: jest.fn(), options: jest.fn(), voterNames: jest.fn(), activeMemberCount: jest.fn(), insert: jest.fn(), insertOptions: jest.fn(), otherMemberIds: jest.fn(),
    lockForVote: jest.fn(), lockForClose: jest.fn(), lockExpired: jest.fn(), activeMembershipId: jest.fn(), optionBelongsToPoll: jest.fn(), saveVote: jest.fn(),
    discardInactiveVotes: jest.fn(), activeMemberIds: jest.fn(), markClosed: jest.fn(), tally: jest.fn(),
  };
  const access = { requireHome: jest.fn() };
  const activities = { add: jest.fn() };
  const notifications = { notify: jest.fn() };
  let db: ReturnType<typeof database>;

  beforeEach(async () => {
    jest.resetAllMocks();
    access.requireHome.mockResolvedValue('member');
    repo.insert.mockResolvedValue(pollId);
    repo.otherMemberIds.mockResolvedValue([]);
    repo.lockExpired.mockResolvedValue([]);
    repo.list.mockResolvedValue([]);
    repo.options.mockResolvedValue([]);
    repo.voterNames.mockResolvedValue([]);
    repo.activeMemberCount.mockResolvedValue(3);
    repo.activeMembershipId.mockResolvedValue(memberId);
    repo.optionBelongsToPoll.mockResolvedValue(true);
    repo.activeMemberIds.mockResolvedValue([user.id, other]);
    repo.tally.mockResolvedValue([{ label: 'Verde', votes: 1 }, { label: 'Blanco', votes: 0 }]);
    db = database();
    polls = await service(PollsService, [
      { provide: PollsRepository, useValue: repo }, { provide: DatabaseService, useValue: db }, { provide: HomeAccessService, useValue: access },
      { provide: ActivitiesService, useValue: activities }, { provide: NotificationsService, useValue: notifications },
    ]);
  });

  describe('HU8.1 abrir votaciones', () => {
    it('HU8.1 crea las opciones en orden, registra la actividad y avisa a los otros integrantes', async () => {
      repo.otherMemberIds.mockResolvedValue([other]);
      await expect(polls.create(user, homeId, dto() as never)).resolves.toEqual({ id: pollId, message: 'Votación abierta.' });
      expect(repo.insert).toHaveBeenCalledWith(homeId, user.id, expect.objectContaining({ title: '¿Pintamos la sala?' }), client);
      expect(repo.insertOptions).toHaveBeenCalledWith(pollId, ['Verde', 'Blanco'], client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'abrió la votación "¿Pintamos la sala?"', client);
      expect(repo.otherMemberIds).toHaveBeenCalledWith(homeId, user.id, client);
      expect(notifications.notify).toHaveBeenCalledWith(client, {
        homeId, userId: other, title: 'Nueva votación', message: 'Juan abrió "¿Pintamos la sala?".', href: '/votaciones', sourceKey: `poll:${pollId}:created:${other}`,
      });
    });
    it('HU8.1 si no hay otros integrantes no envía avisos', async () => {
      await polls.create(user, homeId, dto() as never);
      expect(notifications.notify).not.toHaveBeenCalled();
    });
    it('HU8.1 rechaza un cierre en el pasado sin guardar nada', async () => {
      await expect(polls.create(user, homeId, dto({ closes_at: '2000-01-01T00:00:00Z' }) as never)).rejects.toMatchObject({ status: 400, message: 'La fecha de cierre debe estar en el futuro.' });
      expect(db.transaction).not.toHaveBeenCalled();
      expect(repo.insert).not.toHaveBeenCalled();
    });
    it('HU8.1 acepta una fecha de cierre en el futuro', async () => {
      const closes_at = new Date(Date.now() + 3600000).toISOString();
      await expect(polls.create(user, homeId, dto({ closes_at }) as never)).resolves.toMatchObject({ id: pollId });
      expect(repo.insert).toHaveBeenCalledWith(homeId, user.id, expect.objectContaining({ closes_at }), client);
    });
    it('HU8.1 una persona de fuera no abre votaciones y se exige indicar el apartamento', async () => {
      access.requireHome.mockRejectedValue(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(polls.create(user, homeId, dto() as never)).rejects.toMatchObject({ status: 403 });
      expect(db.transaction).not.toHaveBeenCalled();
      await expect(polls.create(user, undefined, dto() as never)).rejects.toMatchObject({ status: 400, message: 'Selecciona un apartamento.' });
    });
    it('HU8.1 antes de listar cierra las votaciones vencidas del apartamento', async () => {
      await polls.list(user.id, homeId);
      expect(repo.lockExpired).toHaveBeenCalledWith(homeId, client);
    });
  });

  describe('HU8.3 votar', () => {
    it('HU8.3 guarda el voto del integrante activo para la opción elegida', async () => {
      repo.lockForVote.mockResolvedValue(locked());
      await expect(polls.vote(user, pollId, optionId)).resolves.toEqual({ message: 'Voto guardado.' });
      expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId, false, client);
      expect(repo.saveVote).toHaveBeenCalledWith(pollId, optionId, memberId, client);
    });
    it('HU8.3 rechaza votar por una opción que pertenece a otra votación', async () => {
      repo.lockForVote.mockResolvedValue(locked());
      repo.optionBelongsToPoll.mockResolvedValue(false);
      await expect(polls.vote(user, pollId, optionId)).rejects.toMatchObject({ status: 400, message: 'Elige una opción de esta votación.' });
      expect(repo.saveVote).not.toHaveBeenCalled();
    });
    it('HU8.3 una votación que no existe da 404', async () => {
      repo.lockForVote.mockResolvedValue(null);
      await expect(polls.vote(user, pollId, optionId)).rejects.toMatchObject({ status: 404, message: 'Votación no encontrada.' });
      expect(access.requireHome).not.toHaveBeenCalled();
    });
    it('HU8.3 quien no pertenece al apartamento o ya no es integrante activo no vota', async () => {
      repo.lockForVote.mockResolvedValue(locked());
      access.requireHome.mockRejectedValueOnce(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(polls.vote(user, pollId, optionId)).rejects.toMatchObject({ status: 403 });
      repo.activeMembershipId.mockResolvedValue(null);
      await expect(polls.vote(user, pollId, optionId)).rejects.toMatchObject({ status: 403, message: 'No tienes acceso a este apartamento.' });
      expect(repo.saveVote).not.toHaveBeenCalled();
    });
    it('HU8.3 mientras está abierta la lista oculta recuentos y nombres', async () => {
      repo.list.mockResolvedValue([row()]);
      repo.options.mockResolvedValue([{ id: optionId, poll_id: pollId, label: 'Verde', votes: 1 }]);
      const [view] = await polls.list(user.id, homeId);
      expect(view).toMatchObject({ eligible: 3, voters: 1 });
      expect(view.options).toEqual([{ id: optionId, label: 'Verde', votes: null, voters: null }]);
    });
  });

  describe('HU8.4 cerrar votaciones', () => {
    it('HU8.4 rechaza el cierre por un integrante que no la creó', async () => {
      repo.lockForClose.mockResolvedValue(locked({ created_by: other }));
      await expect(polls.close(user, pollId)).rejects.toMatchObject({ status: 403, message: 'Solo quien creó la votación o un administrador pueden cerrarla.' });
      expect(repo.markClosed).not.toHaveBeenCalled();
    });
    it('HU8.4 rechaza nuevos votos después del cierre y cuando ya venció la fecha', async () => {
      repo.lockForVote.mockResolvedValue(locked({ status: 'closed' }));
      await expect(polls.vote(user, pollId, optionId)).rejects.toMatchObject({ status: 409, message: 'Esta votación ya está cerrada.' });
      repo.lockForVote.mockResolvedValue(locked({ closes_at: new Date('2000-01-01') }));
      await expect(polls.vote(user, pollId, optionId)).rejects.toMatchObject({ status: 409 });
      expect(repo.saveVote).not.toHaveBeenCalled();
    });
    it('HU8.4 quien la creó cierra: descarta votos de retirados, guarda los habilitados y avisa el resultado a los demás', async () => {
      repo.lockForClose.mockResolvedValue(locked());
      await expect(polls.close(user, pollId)).resolves.toEqual({ message: 'Votación cerrada.' });
      expect(repo.discardInactiveVotes).toHaveBeenCalledWith(pollId, client);
      expect(repo.markClosed).toHaveBeenCalledWith(pollId, 2, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'cerró la votación "¿Pintamos la sala?"', client);
      expect(notifications.notify).toHaveBeenCalledTimes(1);
      expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({
        userId: other, title: 'Votación cerrada', message: '"¿Pintamos la sala?": ganó "Verde".', sourceKey: `poll:${pollId}:closed:${other}`,
      }));
    });
    it('HU8.4 un administrador cierra una votación ajena', async () => {
      access.requireHome.mockResolvedValue('admin');
      repo.lockForClose.mockResolvedValue(locked({ created_by: other }));
      await expect(polls.close(user, pollId)).resolves.toEqual({ message: 'Votación cerrada.' });
    });
    it('HU8.4 una votación ya cerrada responde 409 antes de revisar permisos, y una inexistente 404', async () => {
      repo.lockForClose.mockResolvedValue(locked({ status: 'closed', created_by: other }));
      await expect(polls.close(user, pollId)).rejects.toMatchObject({ status: 409 });
      repo.lockForClose.mockResolvedValue(null);
      await expect(polls.close(user, pollId)).rejects.toMatchObject({ status: 404, message: 'Votación no encontrada.' });
      expect(repo.markClosed).not.toHaveBeenCalled();
    });
    it('HU8.4 el cierre automático registra el resultado y avisa a todos sin atribuirlo a una persona', async () => {
      repo.lockExpired.mockResolvedValue([locked({ closes_at: new Date('2026-01-01') })]);
      await polls.closeExpired(homeId);
      expect(repo.lockExpired).toHaveBeenCalledWith(homeId, client);
      expect(repo.markClosed).toHaveBeenCalledWith(pollId, 2, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, null, 'cerró la votación "¿Pintamos la sala?"', client);
      expect(notifications.notify).toHaveBeenCalledTimes(2);
      expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ userId: other, message: expect.stringContaining('Verde') }));
    });
    it('HU8.4 sin indicar apartamento el cierre automático revisa todos los apartamentos', async () => {
      await polls.closeExpired();
      expect(repo.lockExpired).toHaveBeenCalledWith(null, client);
      expect(repo.markClosed).not.toHaveBeenCalled();
    });
    it('HU8.4 el resultado de una votación por unanimidad exige a todos los habilitados', async () => {
      repo.lockForClose.mockResolvedValue(locked({ rule: 'unanimous' }));
      repo.tally.mockResolvedValue([{ label: 'Verde', votes: 1 }, { label: 'Blanco', votes: 0 }]);
      await polls.close(user, pollId);
      expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ message: '"¿Pintamos la sala?": no hubo unanimidad.' }));
    });
  });

  describe('HU8.5 consultar decisiones', () => {
    const options = [{ id: optionId, poll_id: pollId, label: 'Verde', votes: 1 }];
    it('HU8.5 muestra votos y nombres en una decisión pública cerrada', async () => {
      repo.list.mockResolvedValue([row({ status: 'closed', closed_at: new Date('2026-11-21') })]);
      repo.options.mockResolvedValue(options);
      repo.voterNames.mockResolvedValue([{ option_id: optionId, name: 'Miguel' }]);
      const [view] = await polls.list(user.id, homeId);
      expect(view).toMatchObject({ can_close: false });
      expect(view.options).toEqual([{ id: optionId, label: 'Verde', votes: 1, voters: ['Miguel'] }]);
    });
    it('HU8.5 conserva el anonimato al publicar el resultado', async () => {
      repo.list.mockResolvedValue([row({ status: 'closed', anonymous: true })]);
      repo.options.mockResolvedValue(options);
      repo.voterNames.mockResolvedValue([{ option_id: optionId, name: 'Miguel' }]);
      expect((await polls.list(user.id, homeId))[0].options).toEqual([{ id: optionId, label: 'Verde', votes: 1, voters: null }]);
    });
    it('HU8.5 conserva el número de habilitados al cierre aunque después cambie el hogar', async () => {
      repo.list.mockResolvedValue([row({ status: 'closed', closed_at: new Date('2026-11-21T12:00:00Z'), eligible_count: 2 })]);
      repo.activeMemberCount.mockResolvedValue(7);
      expect(await polls.list(user.id, homeId)).toEqual([expect.objectContaining({ eligible: 2, closed_at: new Date('2026-11-21T12:00:00Z') })]);
    });
    it('HU8.5 un apartamento sin votaciones devuelve una lista vacía y una persona de fuera no ve nada', async () => {
      await expect(polls.list(user.id, homeId)).resolves.toEqual([]);
      expect(repo.options).toHaveBeenCalledWith([]);
      access.requireHome.mockRejectedValue(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(polls.list(user.id, homeId)).rejects.toMatchObject({ status: 403 });
      await expect(polls.list(user.id, undefined)).rejects.toMatchObject({ status: 400 });
    });
  });
});
