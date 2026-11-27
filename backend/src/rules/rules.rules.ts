// Compara textos sin importar saltos de línea ni espacios repetidos.
export const compact = (text: string) => text.replace(/\s+/g, ' ').trim();

export const excerpt = (text: string) => text.length > 120 ? `${text.slice(0, 119)}…` : text;

// Un reporte solo puede citar un acuerdo que esté en la versión vigente.
export const clauseInRules = (content: string, clause: string) => compact(content).includes(compact(clause));
