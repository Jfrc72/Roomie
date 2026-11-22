import { BadRequestException, Injectable, ParseUUIDPipe, PipeTransform } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { isISO8601, ValidationOptions, ValidateBy } from 'class-validator';

export const Trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

// Fecha con hora y zona horaria (2026-11-22T15:00:00.000Z o -05:00), como pedía la API del ciclo 1.
const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
export const isDateTime = (value: unknown): value is string =>
  typeof value === 'string' && dateTimePattern.test(value) && isISO8601(value, { strict: true });
export const IsDateTime = (options?: ValidationOptions) =>
  ValidateBy({ name: 'isDateTime', validator: { validate: isDateTime } }, options);

// Sin esto, ParseUUIDPipe responde en inglés y con un texto que la interfaz no traduce.
export const idPipe = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Identificador inválido.') });

// El formato del identificador lo revisa HomeAccessService; aquí solo se exige que venga.
@Injectable()
export class HomeIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown) {
    if (typeof value !== 'string' || !value) throw new BadRequestException('Selecciona un apartamento.');
    return value;
  }
}
