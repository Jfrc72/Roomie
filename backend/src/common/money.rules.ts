// Reglas puras para manejar dinero sin errores de coma flotante.
// PostgreSQL guarda los valores como numeric(12,2): como máximo 9.999.999.999,99.
export const MAX_MONEY = 9999999999.99;

/** Indica si el número tiene como máximo dos decimales; también entiende la notación científica. */
export function hasCentPrecision(value: number): boolean {
  const [coefficient, exponent] = String(value).toLowerCase().split('e');
  const decimals = (coefficient.split('.')[1]?.length ?? 0) - Number(exponent ?? 0);
  return Math.max(0, decimals) <= 2;
}

/** Convierte un importe (número o texto de PostgreSQL) a centavos enteros. */
export const toCents = (value: number | string): number => Math.round(Number(value) * 100);

/** Convierte centavos enteros al texto decimal con dos cifras que espera `numeric(12,2)`. */
export const fromCents = (cents: number): string => (cents / 100).toFixed(2);

/**
 * Reparte un total en centavos entre `parts` cuotas. Las cuotas suman exactamente el total:
 * los centavos que sobran se asignan de uno en uno a las primeras cuotas.
 */
export function splitCents(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new RangeError('El total debe ser un número entero de centavos.');
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError('Debe haber al menos una cuota.');
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}
