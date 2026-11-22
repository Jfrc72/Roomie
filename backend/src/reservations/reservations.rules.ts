export const maxReservationDays = 7;
export const maxRangeDays = 31;
const day = 86400000;

// Devuelve el problema de un horario o null si se puede reservar.
export function reservationProblem(start: Date, end: Date, now = Date.now()) {
  if (start.getTime() < now - 60000) return 'La reserva debe empezar en el futuro.';
  if (end <= start) return 'La hora de fin debe ser posterior a la de inicio.';
  if (end.getTime() - start.getTime() > maxReservationDays * day) return `Una reserva puede durar como máximo ${maxReservationDays} días.`;
  return null;
}

// El calendario pide como máximo un mes para no cargar todo el historial.
export function rangeProblem(from: Date, to: Date) {
  const days = (to.getTime() - from.getTime()) / day;
  return days <= 0 || days > maxRangeDays ? `El rango debe durar entre 1 y ${maxRangeDays} días.` : null;
}

export function upcomingMessage(total: number) {
  return `Este recurso tiene ${total === 1 ? 'una reserva próxima' : `${total} reservas próximas`}. Cancélalas antes de retirarlo.`;
}
