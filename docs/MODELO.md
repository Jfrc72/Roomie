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

## Reglas existentes

- Un usuario puede pertenecer a varios hogares, con roles distintos.
- Un apartamento puede empezar con una persona mientras invita al resto; admite como máximo ocho miembros activos.
- Siempre queda al menos un administrador. Las operaciones de miembros e invitaciones bloquean la fila del hogar para controlar concurrencia.
- `memberships.active=false` retira el acceso sin borrar el identificador ni el historial.
- Una invitación se acepta una vez, con el correo indicado, antes de siete días. Otra invitación al mismo correo/hogar revoca el enlace anterior.
- Las cookies duran siete días; las sesiones se comprueban contra la base de datos.
- Los enlaces de notificaciones deben ser rutas internas.

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
| Tarea | id, home_id, title, description, assigned_membership_id, due_at, priority, status |
| Historial de tarea | task_id, actor_id, previous_status, new_status, created_at |
| Recurso | id, home_id, name, description |
| Reserva | id, home_id, resource_id, membership_id, starts_at, ends_at, status |
| Votación | id, home_id, title, rule, anonymous, closes_at, status |
| Opción | id, poll_id, label |
| Voto | poll_id, option_id, membership_id; unicidad por votación/integrante |
| Versión de reglamento | id, home_id, version, content, created_by, created_at |
| Aceptación | rule_version_id, membership_id, accepted_at |

Importes: enteros en la unidad menor de la moneda (`amount_minor`), no números de coma flotante. Para COP, 100 representa un peso. La suma de participaciones debe coincidir exactamente con el total; repartir cualquier residuo de manera determinista. El adaptador del dashboard convierte a pesos para mostrar.

Reasignar responsables solo a miembros activos de ese hogar. Los antiguos pueden seguir apareciendo en el historial. Conservar el vínculo original al convertir compra/reparación en gasto para impedir duplicados.

Reservas: validar `ends_at > starts_at` e impedir cruces para el mismo recurso también en el backend. Definir la protección frente a dos reservas simultáneas en la migración/operación, no solo comprobando una lista en el navegador.

Votaciones anónimas: el backend necesita impedir votos duplicados, pero no debe exponer al cliente la asociación entre persona y opción. La aceptación del reglamento es un registro por versión y usuario, no una implementación de firma electrónica certificada.

## Estados

- Tareas: `pending`, `in_progress`, `completed`.
- Tickets: `open`, `in_progress`, `resolved`.
- Reservas: `active`, `cancelled`.
- Votaciones: `open`, `closed`.

Guardar valores estables en inglés y mostrar etiquetas en español. Al cerrar votaciones, acordar cómo se manejan empates, abstenciones y el conjunto de miembros habilitados antes de implementar el cálculo.
