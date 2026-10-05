import type { PollRule } from "@/types";
export const pollRules: PollRule[] = ["simple", "unanimous"];
export const ruleLabels: Record<PollRule, string> = {
  simple: "Mayoría simple",
  unanimous: "Unanimidad",
};
// Mayoría simple: gana la opción con más votos; un empate no tiene ganadora.
// Unanimidad: gana solo si todos los integrantes habilitados eligieron la misma opción,
// así que cualquier abstención o voto distinto deja la votación sin ganadora.
export function pollResult<T extends { label: string; votes: number | null }>(
  options: T[],
  rule: PollRule,
  eligible: number,
) {
  const top = Math.max(0, ...options.map((o) => o.votes ?? 0));
  const leaders = top ? options.filter((o) => o.votes === top) : [];
  const winner =
    leaders.length === 1 && (rule === "simple" || top === eligible)
      ? leaders[0]
      : null;
  let text: string;
  if (!top) text = "nadie votó.";
  else if (winner)
    text = `ganó "${winner.label}"${rule === "unanimous" ? " por unanimidad" : ""}.`;
  else if (rule === "unanimous") text = "no hubo unanimidad.";
  else text = `empate entre ${leaders.length} opciones.`;
  return { leaders, winner, text };
}
