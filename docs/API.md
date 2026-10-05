# API común

Base: `/api`. Mismo origen que el frontend. Respuesta correcta: `{ "data": ... }`. Error: `{ "error": "Mensaje legible" }`.

Las escrituras reciben JSON. La sesión usa cookie HttpOnly; no se guarda un token en localStorage. Desde scripts de prueba las peticiones de escritura también deben incluir `Origin` igual a `APP_URL`.

## Endpoints implementados

| Método | Ruta | Datos / uso |
| --- | --- | --- |
| GET | `/health` | Comprueba la conexión con PostgreSQL |
| POST | `/auth/register` | `{name, email, password}`; crea cuenta y sesión |
| POST | `/auth/login` | `{email, password}` |
| POST | `/auth/logout` | `{}`; invalida la sesión |
| PATCH | `/auth/profile` | `{name}` |
| PATCH | `/auth/password` | `{current, password}`; invalida todas las sesiones anteriores |
| GET | `/session` | Usuario, hogares autorizados y hogar activo |
| POST | `/homes` | `{name, address, description}`; creador administrador |
| GET | `/homes/:id` | Hogar e integrantes activos |
| PATCH | `/homes/:id` | `{name, address, description}`; solo administrador |
| POST | `/homes/:id/select` | `{}`; cambia hogar activo de esta sesión |
| GET | `/homes/:id/dashboard` | Resumen y actividad |
| GET | `/homes/:id/invitations` | Invitaciones sin tokens; solo administrador |
| POST | `/homes/:id/invitations` | `{email}`; devuelve enlace de aceptación |
| DELETE | `/homes/:id/invitations/:invitationId` | Cancela una invitación pendiente |
| POST | `/invitations` | `{token}`; usuario conectado con el correo invitado |
| PATCH | `/homes/:id/members/:membershipId` | `{role: "admin" \| "member"}` |
| DELETE | `/homes/:id/members/:membershipId` | Baja lógica; no elimina historial |
| GET | `/notifications?homeId=...` | Avisos propios de ese hogar, hasta 100 recientes |
| PATCH | `/notifications/:id` | `{read: true/false}` |
| GET | `/notifications/preferences` | Preferencias y disponibilidad de canales |
| PATCH | `/notifications/preferences` | `{email_enabled, push_enabled, reminder_hours}` |
| POST | `/notifications/subscriptions` | Suscripción producida por PushManager |
| GET | `/tasks?homeId=...` | Tareas abiertas y completadas en los últimos 30 días, con `can_edit` |
| POST | `/tasks?homeId=...` | `{title, description, assigned_membership_id, due_at, priority}`; empieza en `pending` |
| GET | `/tasks/:id` | Tarea e historial de estados |
| PATCH | `/tasks/:id` | Cualquier subconjunto de los campos anteriores y `status`; creador o administrador. Sin responsable, cualquier integrante puede enviar solo `{status}` para avanzarla a `in_progress` o `completed` |
| DELETE | `/tasks/:id` | Creador o administrador; elimina también su historial |
| GET | `/resources?homeId=...` | Recursos activos del hogar |
| POST | `/resources?homeId=...` | `{name, description}`; solo administrador |
| PATCH | `/resources/:id` | `{name, description}`; solo administrador |
| DELETE | `/resources/:id` | Retira el recurso (baja lógica); solo administrador y sin reservas próximas (409) |
| GET | `/reservations?homeId=...` | Reservas activas que aún no terminan, con `can_cancel`. Con `&from=...&to=...` (ISO, 1 a 31 días): las activas que se cruzan con ese intervalo, incluidas las pasadas (calendario) |
| POST | `/reservations?homeId=...` | `{resource_id, starts_at, ends_at}`; para quien la crea. 409 si se cruza con otra |
| DELETE | `/reservations/:id` | Cancela (baja lógica); quien reservó o administrador |
| GET | `/polls?homeId=...` | Votaciones con opciones, `my_option_id`, participación y `can_close`. Antes cierra las vencidas. Recuentos solo si está cerrada; nombres por opción solo si está cerrada y no es anónima |
| POST | `/polls?homeId=...` | `{title, description, rule?, anonymous, closes_at, options: string[]}`; `rule` es `simple` (por defecto) o `unanimous`; 2 a 10 opciones distintas |
| POST | `/polls/:id/votes` | `{option_id}`; crea o cambia el voto propio mientras esté abierta (409 si cerró) |
| POST | `/polls/:id/close` | `{}`; creador o administrador |
| GET | `/rules?homeId=...` | Versión vigente, `accepted_by_me`, aceptaciones de los integrantes activos e historial |
| POST | `/rules?homeId=...` | `{content, notes}`; publica la versión siguiente; solo administrador |
| POST | `/rules/:id/accept` | `{}`; acepta la versión vigente (409 si hay una más reciente) |
| GET | `/expenses?homeId=...` | Gastos, cuotas, resumen mensual, balances bilaterales y pagos recientes |
| POST | `/expenses?homeId=...` | `{title, category, paid_by_id, total_amount, expense_date, participant_ids}`; divide exactamente hasta centavos |
| PATCH | `/expenses/:id` | Actualiza el gasto y regenera su división |
| DELETE | `/expenses/:id` | Baja reversible por quien lo registró o administrador |
| POST | `/expenses/:id/restore` | Restaura un gasto eliminado |
| POST | `/payments?homeId=...` | `{receiver_id, amount}`; el pago propio no puede superar el saldo bilateral |
| GET | `/shopping?homeId=...` | Lista de compras pendientes y compradas |
| POST | `/shopping?homeId=...` | `{title, category, quantity, estimated_price, assigned_membership_id}` |
| PATCH | `/shopping/:id` | Edita el producto o actualiza `{status}`; al comprar registra quién lo hizo |
| DELETE | `/shopping/:id` | Baja reversible por quien lo agregó o administrador |
| POST | `/shopping/:id/restore` | Restaura un producto eliminado |
| GET | `/maintenance?homeId=...&status=...&priority=...&category=...` | Reportes filtrables y contadores por estado |
| POST | `/maintenance?homeId=...` | `{title, description, category, estimated_cost, priority, assigned_membership_id}` |
| PATCH | `/maintenance/:id` | Edita reporte, estado o asignación; creador, responsable o administrador |
| DELETE | `/maintenance/:id` | Baja reversible por quien reportó o administrador |
| POST | `/maintenance/:id/restore` | Restaura un reporte eliminado |

401: sin sesión; 403: sin permiso/origen incorrecto; 404: registro ausente; 409: conflicto; 400: validación; 429: demasiados intentos de login.

## Añadir un módulo

1. Crear un manejador en `src/server/`.
2. Importar la función en `src/app/api/[...path]/route.ts` y añadir la rama correspondiente. El router ya centraliza errores, JSON y comprobación de origen.
3. En el manejador verificar la sesión y el hogar. No tomar un `userId` del formulario como identidad del autor.

Ejemplo, suponiendo que Miguel ya creó la tabla `expenses`:

```ts
import { query } from "./db";
import { ApiError, requireUser } from "./security";
import { requireHome } from "./home-access";

export async function expensesApi(request: Request) {
  const user = await requireUser();
  const homeId = new URL(request.url).searchParams.get("homeId");
  if (!homeId) throw new ApiError(400, "Selecciona un apartamento.");
  await requireHome(user.id, homeId);

  if (request.method === "GET") {
    return query(
      "SELECT id, title, amount_minor FROM expenses WHERE home_id=$1 ORDER BY created_at DESC",
      [homeId],
    );
  }
  throw new ApiError(405, "Método no permitido.");
}
```

En el frontend:

```tsx
const { data, error, reload } = useData<Expense[]>(`/expenses?homeId=${homeId}`);
```

Para editar un objeto por id, comprobar su hogar real desde la base de datos. No confiar en que el `homeId` enviado corresponda al objeto. Si la operación es exclusiva de administradores, llamar a `requireHome(user.id, homeId, true)`.

SQL con parámetros `$1`, `$2`, etc. Nunca concatenar textos del usuario en una consulta. Usar `transaction` cuando haya varias escrituras que deban completarse juntas.
