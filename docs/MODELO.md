# Modelo y reglas compartidas

La estructura implementada está en `db/001_base.sql`. Todas las claves principales son UUID. Las fechas de eventos son `timestamptz`; convertir para mostrarlas al usuario, no guardar fechas ya formateadas.

## Tablas implementadas

| Tabla | Función |
| --- | --- |
| users | Nombre, correo único normalizado y hash de contraseña |
| sessions | Hash del token, usuario, expiración y hogar activo |
| homes | Nombre, dirección y descripción |
| memberships | Relación usuario-hogar, rol y estado activo |
| invitations | Correo, hogar, hash del enlace, vencimiento y estado |
| activities | Autor, hogar y descripción de un evento |
| notification_preferences | Canales elegidos y anticipación de recordatorios |
| notifications | Mensaje, destinatario, hogar y fecha de lectura |
| reminders | Pendientes de los módulos con fecha límite y clave estable |
| deliveries | Cola de entrega por email/push, intentos y resultado |
| push_subscriptions | Dispositivos autorizados por cada usuario |
| login_attempts | Límite temporal de intentos por correo |
| migrations | Migraciones SQL aplicadas |
| tasks | Tarea del hogar: responsable (`assigned_membership_id`), fecha límite, prioridad `low`/`medium`/`high`, estado, autor y fecha de finalización (`db/020_tareas.sql`) |
| task_history | Cambios de estado de cada tarea con su autor; `previous_status` es null al crearla |
| resources | Espacio u objeto reservable del hogar; `active=false` lo retira sin borrar sus reservas (`db/021_reservas.sql`) |
| reservations | Recurso, integrante (`membership_id`), inicio, fin y estado `active`/`cancelled` con fecha de cancelación |

## Reglas existentes

- Un usuario puede pertenecer a varios hogares, con roles distintos.
- Un apartamento puede empezar con una persona mientras invita al resto; admite como máximo ocho miembros activos.
- Siempre queda al menos un administrador. Las operaciones de miembros e invitaciones bloquean la fila del hogar para controlar concurrencia.
- `memberships.active=false` retira el acceso sin borrar el identificador ni el historial.
- Una invitación se acepta una vez, con el correo indicado, antes de siete días. Otra invitación al mismo correo/hogar revoca el enlace anterior.
- Las cookies duran siete días; las sesiones se comprueban contra la base de datos.
- Los enlaces de notificaciones deben ser rutas internas.

## Reglas de tareas

- Cualquier integrante crea tareas; siempre empiezan en `pending` y registran su creación en el historial.
- Solo quien creó la tarea o un administrador la editan, cambian su estado o la eliminan; el responsable no puede modificarla. Al eliminarla, el historial se borra en cascada y la actividad del hogar conserva el registro.
- Si no tiene responsable, cualquier integrante puede empezarla o completarla (solo avanzar `pending` → `in_progress` → `completed`), sin editar otros campos, reabrirla ni eliminarla. No se le asigna automáticamente; el historial registra quién hizo cada cambio.
- El responsable nuevo debe ser un integrante activo; la fila se bloquea con `FOR SHARE` para que no lo retiren durante la asignación. Un responsable retirado se conserva mientras no se cambie.
- Una fecha límite nueva no puede estar en el pasado.
- Recordatorio con clave `task:<id>` para el responsable si la tarea tiene fecha y no está completada. Se cancela al completarla o eliminarla y se recrea al cambiar de responsable.
- Avisos: al responsable cuando se le asigna (si no fue él mismo) y al autor cuando otra persona la completa.
- El listado incluye las completadas de los últimos 30 días; las anteriores siguen disponibles en `/tareas/<id>`.

## Reglas de reservas

- Solo los administradores agregan, editan o retiran recursos. El nombre es único entre los recursos activos del hogar. Un recurso con reservas próximas no se puede retirar; primero hay que cancelarlas.
- Cualquier integrante reserva para sí mismo un recurso activo. La reserva debe empezar en el futuro, terminar después de empezar (también `CHECK` en la tabla) y durar como máximo 7 días.
- Cruces: la restricción `EXCLUDE USING gist` (extensión `btree_gist`) impide en PostgreSQL dos reservas activas del mismo recurso con rangos `[inicio, fin)` superpuestos, también si llegan a la vez. Las consecutivas (10:00-11:00 y 11:00-12:00) son válidas. La API traduce el error `23P01` a 409.
- Crear una reserva bloquea con `FOR SHARE` el recurso y la membresía, para que no los retiren mientras se confirma.
- Cancelan quien reservó o un administrador, mientras la reserva no haya terminado. Cancelar es una baja lógica y libera el horario.
- Recordatorio con clave `reservation:<id>` para quien reservó, según su anticipación; se cancela al cancelar la reserva. Si un administrador cancela la reserva de otra persona, esta recibe un aviso.
- Inicio muestra la próxima reserva activa del hogar (`nextReservation`); `null` cuando no hay ninguna.

## Contratos propuestos para los módulos pendientes

No son tablas ya implementadas. Cada responsable creará su migración y tipos, conservando estas relaciones:

| Entidad | Campos principales acordados |
| --- | --- |
| Gasto | id, home_id, title, amount_minor, currency, paid_by_membership_id, category, occurred_at, created_by |
| Participación | expense_id, membership_id, share_minor |
| Pago entre integrantes | home_id, from_membership_id, to_membership_id, amount_minor, paid_at |
| Lista de compras | id, home_id, name, created_by, created_at |
| Producto de lista | id, list_id, title, quantity, buyer_membership_id, purchased_at, expense_id opcional |
| Ticket | id, home_id, title, description, status, manager_membership_id, expense_id opcional |
| Votación | id, home_id, title, rule, anonymous, closes_at, status |
| Opción | id, poll_id, label |
| Voto | poll_id, option_id, membership_id; unicidad por votación/integrante |
| Versión de reglamento | id, home_id, version, content, created_by, created_at |
| Aceptación | rule_version_id, membership_id, accepted_at |

Importes: enteros en la unidad menor de la moneda (`amount_minor`), no números de coma flotante. Para COP, 100 representa un peso. La suma de participaciones debe coincidir exactamente con el total; repartir cualquier residuo de manera determinista. El adaptador del dashboard convierte a pesos para mostrar.

Reasignar responsables solo a miembros activos de ese hogar. Los antiguos pueden seguir apareciendo en el historial. Conservar el vínculo original al convertir compra/reparación en gasto para impedir duplicados.

Votaciones anónimas: el backend necesita impedir votos duplicados, pero no debe exponer al cliente la asociación entre persona y opción. La aceptación del reglamento es un registro por versión y usuario, no una implementación de firma electrónica certificada.

## Estados

- Tareas: `pending`, `in_progress`, `completed`.
- Tickets: `open`, `in_progress`, `resolved`.
- Reservas: `active`, `cancelled`.
- Votaciones: `open`, `closed`.

Guardar valores estables en inglés y mostrar etiquetas en español. Al cerrar votaciones, acordar cómo se manejan empates, abstenciones y el conjunto de miembros habilitados antes de implementar el cálculo.
