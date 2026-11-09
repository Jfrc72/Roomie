import { canRemoveAdmin, invitationProblem } from '../src/homes/homes.rules';

describe('Reglas del hogar', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  const invite = { status: 'pending', expiresAt: new Date('2026-10-30'), email: 'a@roomie.test', userEmail: 'a@roomie.test', count: 7, existing: false };
  it('acepta una invitación pendiente con cupo y correo correcto', () => expect(invitationProblem(invite, now)).toBeNull());
  it('vence exactamente al alcanzar su fecha límite', () => expect(invitationProblem({ ...invite, expiresAt: now }, now)).toBe('expired'));
  it('rechaza el correo incorrecto', () => expect(invitationProblem({ ...invite, userEmail: 'otro@roomie.test' }, now)).toBe('email'));
  it('no duplica una membresía activa', () => expect(invitationProblem({ ...invite, existing: true }, now)).toBe('member'));
  it('no supera ocho integrantes', () => expect(invitationProblem({ ...invite, count: 8 }, now)).toBe('capacity'));
  it('no vuelve a aceptar una invitación usada', () => expect(invitationProblem({ ...invite, status: 'accepted' }, now)).toBe('expired'));
  it('no retira al único administrador', () => expect(canRemoveAdmin('admin', null, 1)).toBe(false));
  it('no degrada al único administrador', () => expect(canRemoveAdmin('admin', 'member', 1)).toBe(false));
  it('permite retirar un integrante', () => expect(canRemoveAdmin('member', null, 1)).toBe(true));
  it('permite retirar un administrador si hay otro', () => expect(canRemoveAdmin('admin', null, 2)).toBe(true));
  it('permite mantener el rol administrador', () => expect(canRemoveAdmin('admin', 'admin', 1)).toBe(true));
});
