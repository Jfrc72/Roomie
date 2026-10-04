// Mayoría simple: gana la opción con más votos. Devuelve [] si nadie votó y
// varias opciones si hay empate en el primer lugar; un empate no tiene ganadora.
export function pollWinners<T extends { votes: number | null }>(options: T[]) {
  const top = Math.max(0, ...options.map((o) => o.votes ?? 0));
  return top ? options.filter((o) => o.votes === top) : [];
}
export function resultText(winners: { label: string }[]) {
  if (!winners.length) return "nadie votó.";
  if (winners.length > 1) return `empate entre ${winners.length} opciones.`;
  return `ganó "${winners[0].label}".`;
}
