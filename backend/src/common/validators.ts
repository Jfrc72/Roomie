import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNumber, IsPositive, Max, Min, registerDecorator, ValidateIf, ValidationOptions } from 'class-validator';
import { hasCentPrecision, MAX_MONEY } from './money.rules';

/** Quita los espacios de los extremos de un texto; otros tipos pasan intactos para que el validador los rechace. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** El campo puede omitirse, pero si llega no puede ser `null`: se valida con el resto de reglas. */
export const OmitOnly = () => ValidateIf((_object, value) => value !== undefined);

/** El campo puede omitirse o ser `null` (por ejemplo, "sin responsable"); si trae un valor, se valida. */
export const Nullable = () => ValidateIf((_object, value) => value !== undefined && value !== null);

/**
 * `true` si es una fecha de calendario real escrita como YYYY-MM-DD, sin hora.
 * Se comprueba con ida y vuelta para rechazar fechas como 2026-02-30.
 */
export function isDateOnly(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => registerDecorator({
    name: 'isDateOnly', target: target.constructor, propertyName: String(propertyKey), options,
    validator: { validate: isDateOnly },
  });
}

/**
 * `true` si es una fecha y hora ISO 8601 con zona horaria (`Z` o `±hh:mm`), como la que produce `Date#toISOString`.
 * La parte de la fecha se comprueba como calendario real.
 */
export function isOffsetDateTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  return match !== null && isDateOnly(match[1]);
}

export function IsOffsetDateTime(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => registerDecorator({
    name: 'isOffsetDateTime', target: target.constructor, propertyName: String(propertyKey), options,
    validator: { validate: isOffsetDateTime },
  });
}

/**
 * Máximo dos decimales. Se evita `IsNumber({ maxDecimalPlaces })` porque falla con una excepción
 * en números en notación científica (por ejemplo 1e-7), lo que produciría un error 500.
 */
export function IsCentPrecision(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => registerDecorator({
    name: 'isCentPrecision', target: target.constructor, propertyName: String(propertyKey), options,
    validator: { validate: (value: unknown) => typeof value === 'number' && Number.isFinite(value) && hasCentPrecision(value) },
  });
}

/** Importe en pesos: número finito (no texto), con máximo dos decimales y dentro del tope de `numeric(12,2)`. */
export function IsMoney({ allowZero = false }: { allowZero?: boolean } = {}) {
  return applyDecorators(
    IsNumber({ allowNaN: false, allowInfinity: false }),
    allowZero ? Min(0) : IsPositive(),
    Max(MAX_MONEY),
    IsCentPrecision(),
  );
}
