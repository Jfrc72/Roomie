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
| GET | `/reservations?homeId=...` | Reservas activas que aún no terminan, con `can_cancel` |
| POST | `/reservations?homeId=...` | `{resource_id, starts_at, ends_at}`; para quien la crea. 409 si se cruza con otra |
| DELETE | `/reservations/:id` | Cancela (baja lógica); quien reservó o administrador |

401: sin sesión; 403: sin permiso/origen incorrecto; 404: registro ausente; 409: conflicto; 400: validación; 429: demasiados intentos de login.

## Añadir un módulo

1. Crear `src/server/expenses-api.ts` (ejemplo de nombre).
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
