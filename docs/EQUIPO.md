# Trabajo en equipo

| Integrante | Parte del proyecto                                                     |
| ---------- | ---------------------------------------------------------------------- |
| Juan       | Cuentas, apartamentos, integrantes, permisos, inicio y notificaciones. |
| Miguel     | Gastos, pagos, compras, mantenimiento y votaciones.                     |
| Tomás      | Tareas, reservas, acuerdos, asistente con IA real y revisión final de Docker. |

Cada parte incluye sus pantallas, módulo de NestJS, Swagger y pruebas. Juan también deja la conexión a PostgreSQL, sesiones, validaciones y arranque del proyecto. Pasamos votaciones a Miguel para equilibrar el trabajo del ciclo 2.

## Para continuar

1. Actualizar el repositorio y trabajar en una rama propia.
2. Usar los pasos del README para iniciar el proyecto.
3. Probar los cambios y pedir a otro integrante que los revise antes de unirlos a `main`.

## Archivos compartidos

- `src/components/ui.tsx`: formularios, avisos y confirmaciones. La confirmación también permite deshacer cuando el módulo lo admite.
- `src/context/RoomieContext.tsx`: usuario, apartamento activo y avisos temporales.
- `src/app/globals.css`: colores, tamaños y estilos de las páginas.
- `src/context/LanguageContext.tsx` y `src/locales/en.json`: textos en español e inglés. Los nombres y textos escritos por usuarios no se traducen.
- `backend/src/dashboard/`: resumen que se muestra en Inicio.
- `backend/src/notifications/`: avisos y recordatorios de NestJS.
- `backend/src/access/`: comprobación de integrantes y administradores.
- `backend/src/common/`: `params.ts` (`uuidPipe`, `requireHomeId`), `validators.ts` (`Trim`, `OmitOnly`, `Nullable`, `IsOffsetDateTime` e importes), `swagger.ts` y reglas compartidas de dinero y permisos. Conservan los mensajes y formatos de la API anterior.
- `backend/src/database/`: consultas y transacciones de PostgreSQL.
- `src/server/notifications.ts`: compatibilidad temporal para los módulos que siguen en la API anterior.

Los permisos siempre se revisan en el servidor. Para cambiar la base, añadir una migración nueva en `db/`, sin editar las que ya compartimos.

Antes de integrar, ejecutar lint, tipos, build, `npm run test:hu` y `npm run test:coverage`. La wiki debe tener las mismas historias que [HISTORIAS.md](HISTORIAS.md). Los pasos para migrar cada módulo están en [CICLO-2.md](CICLO-2.md).
