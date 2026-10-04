# Continuación del proyecto

## Lo que ya está implementado

- Registro, login/logout, perfil y cambio de contraseña.
- Sesiones con cookie HttpOnly y vencimiento; contraseñas con scrypt.
- Crear y editar apartamentos; pertenecer a varios y seleccionar uno activo.
- Roles administrador/integrante validados por el backend.
- Invitaciones por enlace, correo asociado, vencimiento y cancelación.
- Límite de ocho integrantes; baja lógica que conserva referencias históricas.
- Protección del último administrador.
- Menú, layout, Inicio, ayuda, componentes de formularios y confirmaciones.
- Actividad real del hogar y bandeja de notificaciones, leído/no leído y preferencias.
- Servicio de recordatorios y adaptadores de email/push configurables.
- Base de datos local, migraciones, seed y configuración Docker.
- Tareas: tablero por estados operable con botones, filtros, detalle en `/tareas/ID`, historial, avisos, recordatorios y resumen en Inicio.
- Reservas: recursos gestionados por administradores, reservas sin cruces garantizadas por PostgreSQL, cancelación, filtros, avisos, recordatorios y próxima reserva en Inicio.
- Votaciones: públicas o anónimas, mayoría simple, cambio de voto, resultados al cerrar, cierre manual o automático (worker) y avisos.

No hay una API separada que iniciar manualmente: `src/app/api` expone el backend de Next. Las reglas están en `src/server`; los módulos del frontend están en `src/components` y `src/app/(app)`.

## Responsabilidades

| Integrante | Páginas | Backend y base de datos |
| --- | --- | --- |
| Juan | Inicio, apartamento, perfil, login, registro, ayuda y notificaciones | Usuarios, sesiones, hogares, integrantes, invitaciones, permisos, actividad y servicio común de avisos |
| Miguel | `/gastos`, `/compras`, `/mantenimiento` | Gastos/participantes/pagos, listas/productos, tickets; cálculos y conexión financiera |
| Tomás | `/tareas`, `/reservas`, `/votaciones`, `/reglamento` | Tareas/historial, recursos/reservas, votaciones/votos y acuerdos/aceptaciones; asistente simulado |

Cada compañero implementa las pantallas y operaciones de su área, sus migraciones y sus pruebas. No necesita reescribir autenticación o crear otro Context de usuario.

## Primeros pasos

1. Clonar el repositorio, ejecutar `npm ci` y `npm run dev`.
2. Preparar las cuentas de prueba según el README.
3. Crear una rama por funcionalidad, por ejemplo `feat/gastos` o `feat/tareas`.
4. Leer `API.md` y `MODELO.md` antes de crear las tablas.
5. Empezar con un recorrido completo: formulario → API → PostgreSQL → lista actualizada.
6. Abrir un pull request pequeño que el otro integrante pueda probar.

## Reutilizar el estado

```tsx
"use client";
import { useRoomie } from "@/context/RoomieContext";

const { session, toast } = useRoomie();
const homeId = session.activeHomeId;
const user = session.user;
```

El contexto ayuda a mostrar el usuario y hogar activo. No demuestra permisos: el backend debe volver a comprobarlos.

El contenido del layout tiene una `key` basada en el hogar. Cambiar de apartamento reinicia el estado local de las páginas para evitar mostrar información del hogar anterior. No guardar otra copia independiente del apartamento activo.

## Interfaz y formularios

- `src/components/ui.tsx`: `PageTitle`, `Form`, `LoadingError`, `Empty`, `ConfirmButton`.
- `src/lib/api.ts`: peticiones JSON y mensajes de error.
- `src/lib/use-data.ts`: carga de listas y reintento. Si no hay hogar activo, mostrar una invitación a crearlo; no consultar una URL con `null`.
- `src/app/globals.css`: paleta lavanda, paneles, campos, botones y adaptación móvil.
- `HomeManager.tsx` sirve como ejemplo de formulario real, permisos y confirmaciones.

No copiar los totales de las capturas: calcularlos desde los datos. Todos los filtros, botones y estados incluidos deben tener comportamiento real. Tareas debe poder operarse sin arrastrar; gastos necesita validación y confirmación al eliminar. Mantener textos en español y estados que no dependan solo del color.

## Conectar Inicio

`src/server/dashboard.ts` es el punto de integración. Devuelve `null` y listas vacías para los módulos que no existen todavía. La actividad, las tareas y las reservas sí vienen de PostgreSQL.

- Miguel entrega `balance`, `shoppingItems` y `expenses`.
- Tomás entrega `pendingTasks`, `nextReservation` y `tasks`. Ya están conectados desde `src/server/tasks-summary.ts` y `src/server/reservations-summary.ts`.
- Los textos con fecha que Inicio muestra tal cual se formatean con `homeDateFormat` (`src/server/format.ts`), en la zona horaria del proyecto.
- Consultas siempre filtradas por `homeId`; tareas y balance personal además por `userId`.
- `balance` y `expenses.amount` son pesos COP; si se almacenan centavos, convertir en este adaptador.
- `null` significa todavía no conectado; cero significa resultado real igual a cero.
- Las rutas `href` son internas, por ejemplo `/tareas/ID` cuando exista la página de detalle.

Conviene que cada uno cree su función de resumen en un archivo propio y que Juan haga la composición en `dashboard.ts`, para no editar el mismo archivo simultáneamente.

## Actividad y notificaciones

Dentro de la transacción que guarda el cambio:

```ts
await activity(db, homeId, user.id, "registró un gasto");
await notify(db, {
  homeId,
  userId: destinatarioId,
  title: "Nuevo gasto",
  message: "Hay un gasto nuevo para revisar.",
  href: "/gastos",
  sourceKey: `expense:${gastoId}:${destinatarioId}`,
});
```

Importar `activity` de `home-access.ts` y `notify` de `notifications.ts`. La clave única evita duplicados; usar un identificador distinto por evento y destinatario. `notify` no crea avisos para personas ajenas al hogar.

Para recordatorios, usar `scheduleReminder(db, {..., sourceKey, dueAt})`. La anticipación se calcula con las preferencias del destinatario. Usar `cancelReminder` al completar o eliminar el pendiente. Actualizar el recordatorio si cambia fecha o responsable. Son funciones de servidor: no importarlas en un componente cliente.

Los envíos externos requieren configuración. No crear funciones de correo independientes en cada módulo.

## Integración y entrega

- Las rutas de los módulos están reservadas con pantallas de preparación. Reemplazar su contenido.
- No modificar `db/001_base.sql` una vez compartida: añadir una migración nueva.
- Numeración propuesta: Miguel empieza en `010_finanzas.sql`; Tomás en `020_tareas.sql` (reservas usa `021_reservas.sql` y votaciones `022_votaciones.sql`). Acordar nuevos números cuando hagan cambios adicionales.
- Mantener cambios de `package.json`/lockfile, layout, estilos globales y router API pequeños y coordinados.
- Los tres ejecutan lint, tipos, build y pruebas; cada uno revisa un módulo ajeno.
- Docker y despliegue se verifican juntos en un equipo con Docker antes de presentar esa parte.
