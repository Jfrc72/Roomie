import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { isOffsetDateTime } from '../src/common/validators';
import { PollsController } from '../src/polls/polls.controller';
import { PollDto, VoteDto } from '../src/polls/polls.dto';
import { PollsService } from '../src/polls/polls.service';
import { homeId, user } from './helpers';
import { startApi, TestApi } from './http-app';

const pollId = '00000000-0000-4000-8000-000000000060';
const optionId = '00000000-0000-4000-8000-000000000061';
const validation = (type: new () => object, value: object) => validateSync(plainToInstance(type, value), { whitelist: true, forbidNonWhitelisted: true });
const poll = (over: object = {}) => ({ title: '¿Pintamos la sala?', options: ['Verde', 'Blanco'], ...over });

describe('Validación de votaciones', () => {
  it('acepta una votación con lo obligatorio y una completa', () => {
    expect(validation(PollDto, poll())).toHaveLength(0);
    expect(validation(PollDto, poll({ description: 'Elegir color', rule: 'unanimous', anonymous: true, closes_at: '2026-12-01T17:00:00-05:00' }))).toHaveLength(0);
    expect(validation(PollDto, poll({ closes_at: null }))).toHaveLength(0);
  });
  it('quita los espacios de la pregunta y de las opciones', () => {
    const dto = plainToInstance(PollDto, poll({ title: '  ¿Pizza?  ', options: ['  Sí ', 'No  '] }));
    expect(dto).toMatchObject({ title: '¿Pizza?', options: ['Sí', 'No'] });
  });
  it.each([[{ title: '' }], [{ title: 'x' }], [{ title: 'a'.repeat(121) }], [{ description: 'x'.repeat(501) }], [{ rule: 'mayoria' }], [{ rule: null }], [{ anonymous: 'si' }],
    [{ closes_at: '2026-12-01' }], [{ closes_at: 'mañana' }], [{ closes_at: '2026-02-30T10:00:00Z' }], [{ closes_at: '2026-12-01T25:00:00Z' }], [{ closes_at: '2026-12-01T10:00:00' }],
    [{ options: ['Solo una'] }], [{ options: [] }], [{ options: Array.from({ length: 11 }, (_, i) => `Opción ${i}`) }], [{ options: ['Verde', ''] }], [{ options: ['Verde', 'x'.repeat(81)] }],
    [{ options: ['Verde', 'verde'] }], [{ options: ['Verde', ' VERDE '] }], [{ options: ['Verde', 5] }], [{ options: 'Verde,Blanco' }], [{ created_by: 'x' }]])('rechaza %j', over => {
    expect(validation(PollDto, poll(over)).length).toBeGreaterThan(0);
  });
  it('admite entre dos y diez opciones y fechas con distintas zonas horarias', () => {
    expect(validation(PollDto, poll({ options: Array.from({ length: 10 }, (_, i) => `Opción ${i}`) }))).toHaveLength(0);
    for (const closes_at of ['2026-12-01T17:00:00Z', '2026-12-01T17:00:00.123Z', '2026-12-01T17:00+05:30', '2028-02-29T00:00:00-05:00']) {
      expect(isOffsetDateTime(closes_at)).toBe(true);
    }
    expect(isOffsetDateTime(undefined)).toBe(false);
  });
  it('un voto necesita una opción con identificador válido', () => {
    expect(validation(VoteDto, { option_id: optionId })).toHaveLength(0);
    for (const bad of [{}, { option_id: 'x' }, { option_id: null }, { option_id: optionId, voter: 'x' }]) expect(validation(VoteDto, bad).length).toBeGreaterThan(0);
  });
});

describe('Rutas HTTP de votaciones', () => {
  const polls = { list: jest.fn(), create: jest.fn(), vote: jest.fn(), close: jest.fn() };
  let api: TestApi;
  beforeEach(() => { jest.resetAllMocks(); });
  beforeAll(async () => { api = await startApi([PollsController], [{ provide: PollsService, useValue: polls }]); });
  afterAll(() => api.close());

  it('GET /polls entrega las votaciones dentro de {data}', async () => {
    polls.list.mockResolvedValue([{ id: pollId }]);
    expect(await api.call(`/polls?homeId=${homeId}`)).toEqual({ status: 200, body: { data: [{ id: pollId }] } });
    expect(polls.list).toHaveBeenCalledWith(user.id, homeId);
  });
  it('POST /polls responde 200 con el id y entrega al servicio los datos limpios', async () => {
    polls.create.mockResolvedValue({ id: pollId, message: 'Votación abierta.' });
    const reply = await api.call(`/polls?homeId=${homeId}`, 'POST', poll({ title: '  ¿Pintamos la sala? ', options: [' Verde', 'Blanco '] }));
    expect(reply).toEqual({ status: 200, body: { data: { id: pollId, message: 'Votación abierta.' } } });
    expect(polls.create).toHaveBeenCalledWith(user, homeId, expect.objectContaining({ title: '¿Pintamos la sala?', options: ['Verde', 'Blanco'] }));
  });
  it.each([['opciones repetidas', { options: ['Verde', 'VERDE'] }], ['una sola opción', { options: ['Verde'] }], ['un tipo de decisión inventado', { rule: 'dictadura' }], ['una fecha sin zona horaria', { closes_at: '2026-12-01T10:00:00' }]])('POST /polls rechaza %s con 400 y no llega al servicio', async (_name, over) => {
    expect(await api.call(`/polls?homeId=${homeId}`, 'POST', poll(over))).toEqual({ status: 400, body: { error: 'Revisa los campos: los datos no son válidos.' } });
    expect(polls.create).not.toHaveBeenCalled();
  });
  it('POST /polls/:id/votes guarda el voto y valida identificadores y opción', async () => {
    polls.vote.mockResolvedValue({ message: 'Voto guardado.' });
    expect(await api.call(`/polls/${pollId}/votes`, 'POST', { option_id: optionId })).toEqual({ status: 200, body: { data: { message: 'Voto guardado.' } } });
    expect(polls.vote).toHaveBeenCalledWith(user, pollId, optionId);
    expect(await api.call('/polls/no-es-un-uuid/votes', 'POST', { option_id: optionId })).toEqual({ status: 400, body: { error: 'Identificador inválido.' } });
    expect((await api.call(`/polls/${pollId}/votes`, 'POST', { option_id: 'x' })).status).toBe(400);
    expect((await api.call(`/polls/${pollId}/votes`, 'POST', {})).status).toBe(400);
    expect(polls.vote).toHaveBeenCalledTimes(1);
  });
  it('POST /polls/:id/close cierra y los errores del servicio llegan con su código', async () => {
    polls.close.mockResolvedValueOnce({ message: 'Votación cerrada.' });
    expect((await api.call(`/polls/${pollId}/close`, 'POST', {})).body).toEqual({ data: { message: 'Votación cerrada.' } });
    polls.close.mockRejectedValueOnce(new ForbiddenException('Solo quien creó la votación o un administrador pueden cerrarla.'));
    expect(await api.call(`/polls/${pollId}/close`, 'POST', {})).toEqual({ status: 403, body: { error: 'Solo quien creó la votación o un administrador pueden cerrarla.' } });
    polls.close.mockRejectedValueOnce(new ConflictException('Esta votación ya está cerrada.'));
    expect((await api.call(`/polls/${pollId}/close`, 'POST', {})).status).toBe(409);
    expect((await api.call('/polls/no-es-un-uuid/close', 'POST', {})).status).toBe(400);
  });
  it('sin sesión todas las rutas responden 401 sin llegar al servicio', async () => {
    const anonymous = await startApi([PollsController], [{ provide: PollsService, useValue: polls }], null);
    try {
      expect((await anonymous.call(`/polls?homeId=${homeId}`)).status).toBe(401);
      expect((await anonymous.call(`/polls/${pollId}/votes`, 'POST', { option_id: optionId })).status).toBe(401);
      expect((await anonymous.call(`/polls/${pollId}/close`, 'POST', {})).status).toBe(401);
      expect(polls.list).not.toHaveBeenCalled();
      expect(polls.vote).not.toHaveBeenCalled();
      expect(polls.close).not.toHaveBeenCalled();
    } finally {
      await anonymous.close();
    }
  });
});
