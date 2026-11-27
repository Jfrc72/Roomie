import { OptionRow, PollRow } from '../src/polls/polls.entity';
import { buildPollViews, canClosePoll, isExpired, pollResult } from '../src/polls/polls.rules';

const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const tally = (...votes: number[]) => votes.map((count, index) => ({ label: `Opción ${index + 1}`, votes: count }));

describe('Resultado de una votación (HU8.2)', () => {
  it('HU8.2 con mayoría simple gana la opción con más votos', () => {
    const result = pollResult(tally(3, 1, 0), 'simple', 5);
    expect(result.winner?.label).toBe('Opción 1');
    expect(result.text).toBe('ganó "Opción 1".');
  });
  it('HU8.2 un empate o la ausencia de votos no tienen ganadora', () => {
    expect(pollResult(tally(2, 2, 1), 'simple', 5)).toMatchObject({ winner: null, text: 'empate entre 2 opciones.' });
    expect(pollResult(tally(0, 0), 'simple', 3)).toMatchObject({ winner: null, text: 'nadie votó.' });
    expect(pollResult(tally(0, 0), 'unanimous', 3).text).toBe('nadie votó.');
  });
  it('HU8.2 con unanimidad gana solo si todos los habilitados votan por la misma opción', () => {
    expect(pollResult(tally(3, 0), 'unanimous', 3)).toMatchObject({ text: 'ganó "Opción 1" por unanimidad.' });
    expect(pollResult(tally(3, 0), 'unanimous', 3).winner?.label).toBe('Opción 1');
  });
  it('HU8.2 una abstención o un voto distinto rompen la unanimidad', () => {
    expect(pollResult(tally(2, 0), 'unanimous', 3)).toMatchObject({ winner: null, text: 'no hubo unanimidad.' });
    expect(pollResult(tally(2, 1), 'unanimous', 3)).toMatchObject({ winner: null, text: 'no hubo unanimidad.' });
    expect(pollResult(tally(2, 2), 'unanimous', 4).text).toBe('no hubo unanimidad.');
  });
  it('HU8.2 una votación sin opciones no falla', () => {
    expect(pollResult([], 'simple', 0)).toMatchObject({ winner: null, leaders: [], text: 'nadie votó.' });
  });
});

describe('Vencimiento y cierre', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  it('sin fecha de cierre nunca vence', () => expect(isExpired(null, now)).toBe(false));
  it('vence cuando la fecha llega, incluso en el mismo instante', () => {
    expect(isExpired(new Date('2026-11-25T11:59:59Z'), now)).toBe(true);
    expect(isExpired('2026-11-25T12:00:00Z', now)).toBe(true);
    expect(isExpired('2026-11-25T12:00:01Z', now)).toBe(false);
  });
  it('cierran quien creó la votación y los administradores', () => {
    expect(canClosePoll('member', owner, owner)).toBe(true);
    expect(canClosePoll('admin', owner, other)).toBe(true);
    expect(canClosePoll('member', owner, other)).toBe(false);
  });
});

describe('Lo que ve quien consulta', () => {
  const poll = (over: Partial<PollRow> = {}): PollRow => ({
    id: 'p1', title: '¿Pintamos?', description: '', rule: 'simple', anonymous: false, closes_at: null, status: 'open', created_by: owner, creator: 'Miguel',
    created_at: new Date('2026-11-20'), closed_at: null, eligible_count: 2, my_option_id: null, voters: 1, ...over,
  });
  const options: OptionRow[] = [{ id: 'o1', poll_id: 'p1', label: 'Verde', votes: 1 }, { id: 'o2', poll_id: 'p2', label: 'Otra', votes: 5 }];
  const voters = [{ option_id: 'o1', name: 'Tomás' }];

  it('HU8.3 mientras está abierta oculta recuentos y nombres, y solo cuenta cuántos votaron', () => {
    const [view] = buildPollViews([poll()], options, voters, 3, 'member', other);
    expect(view.options).toEqual([{ id: 'o1', label: 'Verde', votes: null, voters: null }]);
    expect(view).toMatchObject({ eligible: 3, voters: 1, can_close: false });
  });
  it('HU8.3 en las anónimas nunca se muestra quién eligió cada opción, ni al cerrar', () => {
    const [view] = buildPollViews([poll({ status: 'closed', anonymous: true })], options, voters, 3, 'member', other);
    expect(view.options).toEqual([{ id: 'o1', label: 'Verde', votes: 1, voters: null }]);
  });
  it('HU8.5 al cerrar muestra votos y nombres en las públicas y conserva los habilitados de ese momento', () => {
    const [view] = buildPollViews([poll({ status: 'closed', closed_at: new Date('2026-11-21') })], options, voters, 5, 'member', other);
    expect(view.options).toEqual([{ id: 'o1', label: 'Verde', votes: 1, voters: ['Tomás'] }]);
    expect(view.eligible).toBe(2);
  });
  it('HU8.4 puede cerrar quien la creó o un administrador, y solo si está abierta', () => {
    expect(buildPollViews([poll()], options, voters, 3, 'member', owner)[0].can_close).toBe(true);
    expect(buildPollViews([poll()], options, voters, 3, 'admin', other)[0].can_close).toBe(true);
    expect(buildPollViews([poll()], options, voters, 3, 'member', other)[0].can_close).toBe(false);
    expect(buildPollViews([poll({ status: 'closed' })], options, voters, 3, 'admin', owner)[0].can_close).toBe(false);
  });
  it('no expone quién creó la votación como identificador ni el conteo interno al cierre', () => {
    const [view] = buildPollViews([poll()], options, voters, 3, 'member', other);
    expect('created_by' in view).toBe(false);
    expect('eligible_count' in view).toBe(false);
    expect(view.creator).toBe('Miguel');
  });
  it('una votación sin opciones registradas devuelve una lista vacía', () => {
    expect(buildPollViews([poll({ id: 'p9' })], options, voters, 3, 'member', other)[0].options).toEqual([]);
  });
});
