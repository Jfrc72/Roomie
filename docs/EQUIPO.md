# Trabajo en equipo

| Integrante | Parte del proyecto                                                     |
| ---------- | ---------------------------------------------------------------------- |
| Juan       | Cuentas, apartamentos, integrantes, permisos, inicio y notificaciones. |
| Miguel     | Gastos, pagos, compras y mantenimiento.                                |
| Tomás      | Tareas, reservas, votaciones, acuerdos y asistente.                    |

Cada parte incluye sus pantallas, operaciones del servidor y pruebas.

## Para continuar

1. Actualizar el repositorio y trabajar en una rama propia.
2. Usar los pasos del README para iniciar el proyecto.
3. Probar los cambios y pedir a otro integrante que los revise antes de unirlos a `main`.

## Archivos compartidos

- `src/components/ui.tsx`: formularios, avisos y confirmaciones. La confirmación también permite deshacer cuando el módulo lo admite.
- `src/context/RoomieContext.tsx`: usuario, apartamento activo y avisos temporales.
- `src/app/globals.css`: colores, tamaños y estilos de las páginas.
- `src/context/LanguageContext.tsx` y `src/locales/en.json`: textos en español e inglés. Los nombres y textos escritos por usuarios no se traducen.
- `src/server/dashboard.ts`: resumen de los módulos que se muestra en Inicio.
- `src/server/notifications.ts`: avisos y recordatorios.

Los permisos siempre se revisan en el servidor. Para cambiar la base, añadir una migración nueva en `db/`, sin editar las que ya compartimos.

Antes de integrar, ejecutar lint, tipos, build y `npm run test:hu`. La wiki debe tener las mismas historias que [HISTORIAS.md](HISTORIAS.md).
