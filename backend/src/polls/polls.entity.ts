export const POLL_RULES = ['simple', 'unanimous'] as const;
export type PollRule = (typeof POLL_RULES)[number];
export type PollStatus = 'open' | 'closed';

// Filas de las tablas polls, poll_options y votes (db/022_votaciones.sql y db/026_votaciones_unanimidad.sql).
export class Poll {
  id: string;
  home_id: string;
  title: string;
  description: string;
  rule: PollRule;
  anonymous: boolean;
  closes_at: Date | null;
  status: PollStatus;
  created_by: string;
  created_at: Date;
  closed_at: Date | null;
  eligible_count: number | null;
}

export class PollOption {
  id: string;
  poll_id: string;
  label: string;
  position: number;
}

export class Vote {
  poll_id: string;
  option_id: string;
  membership_id: string;
  voted_at: Date;
}

/** Datos mínimos de una votación bloqueada para votar o cerrar. */
export interface LockedPoll {
  id: string;
  home_id: string;
  title: string;
  rule: PollRule;
  status: PollStatus;
  closes_at: Date | null;
  created_by: string;
}

/** Votación del listado con el nombre de quien la creó y los datos de quien consulta. */
export interface PollRow {
  id: string;
  title: string;
  description: string;
  rule: PollRule;
  anonymous: boolean;
  closes_at: Date | null;
  status: PollStatus;
  created_by: string;
  creator: string;
  created_at: Date;
  closed_at: Date | null;
  eligible_count: number | null;
  my_option_id: string | null;
  voters: number;
}

export interface OptionRow {
  id: string;
  poll_id: string;
  label: string;
  votes: number;
}

export interface VoterRow {
  option_id: string;
  name: string;
}

/** Recuento de una opción al cerrar, para calcular el resultado. */
export interface Tally {
  label: string;
  votes: number;
}
