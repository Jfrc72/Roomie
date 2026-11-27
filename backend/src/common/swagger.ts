import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiParam, ApiProperty, ApiQuery, ApiResponse, getSchemaPath } from '@nestjs/swagger';

/** Forma de todos los errores de la API: `{ error: "mensaje" }`. */
export class ErrorResponse {
  @ApiProperty({ example: 'No tienes acceso a este apartamento.' })
  error: string;
}

export class MessageResponse {
  @ApiProperty({ example: 'Operación realizada.' })
  message: string;
}

export class CreatedResponse extends MessageResponse {
  @ApiProperty({ format: 'uuid', description: 'Identificador del registro creado.' })
  id: string;
}

/**
 * Documenta una respuesta correcta. La API envuelve todo en `{ data: ... }`
 * mediante un interceptor, así que el esquema describe ese envoltorio.
 */
export function ApiData(model: Type, description: string, options: { isArray?: boolean } = {}) {
  const data = options.isArray ? { type: 'array', items: { $ref: getSchemaPath(model) } } : { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({ status: 200, description, schema: { type: 'object', required: ['data'], properties: { data } } }),
  );
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Datos, filtros o identificadores inválidos.',
  401: 'Se necesita una sesión activa.',
  403: 'La persona no pertenece al apartamento o no tiene permiso sobre el registro.',
  404: 'El registro no existe.',
};

/** Documenta las respuestas de error con la forma `{ error }`; `overrides` ajusta el texto de un código. */
export function ApiErrors(statuses: number[], overrides: Record<number, string> = {}) {
  return applyDecorators(...statuses.map(status => ApiResponse({
    status, description: overrides[status] ?? ERROR_DESCRIPTIONS[status], type: ErrorResponse,
  })));
}

/** Parámetro de ruta `:id` con formato UUID. */
export const ApiIdParam = (description: string) => ApiParam({ name: 'id', format: 'uuid', description });

/** Parámetro de consulta `homeId`: el apartamento sobre el que operan las rutas de listado y creación. */
export const ApiHomeQuery = () => ApiQuery({ name: 'homeId', required: true, format: 'uuid', description: 'Apartamento sobre el que se opera.' });
