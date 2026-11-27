import { canManageRecord, HomeRole } from '../common/permissions.rules';
import { OptionRow, PollRow, PollRule, Tally, VoterRow } from './polls.entity';
import { PollView } from './polls.responses';

/**
 * Resultado de una votación al cerrarla.
 * Mayoría simple: gana la opción con más votos; un empate no tiene ganadora.
 * Unanimidad: gana solo si todos los integrantes habilitados eligieron la misma opción,
 * así que cualquier abstención o voto distinto la deja sin ganadora.
 */
export function pollResult(options: Tally[], rule: PollRule, eligible: number) {
  const top = Math.max(0, ...options.map(option => option.votes));
  const leaders = top ? options.filter(option => option.votes === top) : [];
  const winner = leaders.length === 1 && (rule === 'simple' || top === eligible) ? leaders[0] : null;
  let text: string;
  if (!top) text = 'nadie votó.';
  else if (winner) text = `ganó "${winner.label}"${rule === 'unanimous' ? ' por unanimidad' : ''}.`;
  else if (rule === 'unanimous') text = 'no hubo unanimidad.';
  else text = `empate entre ${leaders.length} opciones.`;
  return { leaders, winner, text };
}

/** Una votación con fecha de cierre ya vencida no admite votos aunque nadie la haya cerrado todavía. */
export function isExpired(closesAt: Date | string | null, now = new Date()): boolean {
  return closesAt !== null && new Date(closesAt) <= now;
}

/** Cierran la votación quien la creó o un administrador. */
export const canClosePoll = canManageRecord;

/**
 * Arma lo que ve quien consulta. Mientras la votación está abierta solo se informa cuántas personas votaron
 * (no los recuentos), y en las anónimas nunca se dice quién eligió qué.
 */
export function buildPollViews(rows: PollRow[], options: OptionRow[], voters: VoterRow[], activeMembers: number, role: HomeRole, userId: string): PollView[] {
  return rows.map(({ created_by: createdBy, eligible_count: eligibleAtClose, ...poll }) => {
    const closed = poll.status === 'closed';
    return {
      ...poll,
      eligible: closed ? eligibleAtClose : activeMembers,
      can_close: !closed && canClosePoll(role, createdBy, userId),
      options: options.filter(option => option.poll_id === poll.id).map(option => ({
        id: option.id,
        label: option.label,
        votes: closed ? option.votes : null,
        voters: closed && !poll.anonymous ? voters.filter(voter => voter.option_id === option.id).map(voter => voter.name) : null,
      })),
    };
  });
}
