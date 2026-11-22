// Cada publicación crea una versión nueva; las anteriores se conservan como historial.
export class RuleVersion {
  id: string;
  home_id: string;
  version: number;
  content: string;
  notes: string;
  created_by: string;
  created_at: Date;
}

// Registro de lectura por versión e integrante; no es una firma electrónica certificada.
export class RuleAcceptance {
  rule_version_id: string;
  membership_id: string;
  accepted_at: Date;
}

// clause guarda el texto del acuerdo para que siga legible aunque se publiquen versiones nuevas.
export class RuleReport {
  id: string;
  home_id: string;
  rule_version_id: string;
  clause: string;
  description: string;
  reported_by: string;
  reported_membership_id: string | null;
  created_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
}

export interface RuleVersionRow extends Pick<RuleVersion, 'id' | 'version' | 'content' | 'notes' | 'created_at'> { author: string }
export interface AcceptanceRow { membership_id: string; user_id: string; name: string; accepted_at: Date | null }
export interface ReportRow extends Pick<RuleReport, 'id' | 'clause' | 'description' | 'created_at' | 'resolved_at'> { reporter: string; reported: string | null }
