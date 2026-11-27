import { rangeProblem, reservationProblem, upcomingMessage } from '../src/reservations/reservations.rules';

const now = new Date('2026-11-22T12:00:00Z').getTime();
const at = (hours: number) => new Date(now + hours * 3600000);

describe('Reglas de reservas', () => {
  it('HU5.2 acepta un horario futuro de hasta siete días', () => {
    expect(reservationProblem(at(1), at(2), now)).toBeNull();
    expect(reservationProblem(at(1), at(1 + 7 * 24), now)).toBeNull();
  });
  it('HU5.2 rechaza inicios pasados, fines anteriores al inicio y duraciones largas', () => {
    expect(reservationProblem(at(-1), at(1), now)).toBe('La reserva debe empezar en el futuro.');
    expect(reservationProblem(at(2), at(2), now)).toBe('La hora de fin debe ser posterior a la de inicio.');
    expect(reservationProblem(at(1), at(2 + 7 * 24), now)).toBe('Una reserva puede durar como máximo 7 días.');
  });
  it('HU5.3 el calendario admite rangos de hasta 31 días', () => {
    expect(rangeProblem(at(0), at(24 * 7))).toBeNull();
    expect(rangeProblem(at(0), at(0))).toBe('El rango debe durar entre 1 y 31 días.');
    expect(rangeProblem(at(0), at(24 * 32))).toBe('El rango debe durar entre 1 y 31 días.');
  });
  it('HU5.1 explica cuántas reservas impiden retirar un recurso', () => {
    expect(upcomingMessage(1)).toBe('Este recurso tiene una reserva próxima. Cancélalas antes de retirarlo.');
    expect(upcomingMessage(3)).toBe('Este recurso tiene 3 reservas próximas. Cancélalas antes de retirarlo.');
  });
});
