import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/** Valida identificadores de ruta con el mismo mensaje en español que usa el resto de la API. */
export const uuidPipe = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Identificador inválido.') });

/** Las rutas de listado y creación reciben el apartamento en `?homeId=`; sin él no hay sobre qué operar. */
export function requireHomeId(homeId?: string): string {
  if (!homeId) throw new BadRequestException('Selecciona un apartamento.');
  return homeId;
}

/** `true` si el DTO trae al menos un campo con valor. Las clases compiladas declaran todas sus propiedades como `undefined`. */
export function hasChanges(dto: object): boolean {
  return Object.values(dto).some(value => value !== undefined);
}
