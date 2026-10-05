# Base de datos

Usamos PostgreSQL. Los archivos de `db/` crean las tablas y guardan los cambios de estructura. El proyecto aplica las migraciones pendientes al iniciar.

| Parte                 | Tablas principales                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Cuentas               | `users`, `sessions`, `login_attempts`                                                        |
| Apartamentos          | `homes`, `memberships`, `invitations`, `activities`                                          |
| Avisos                | `notifications`, `notification_preferences`, `reminders`, `deliveries`, `push_subscriptions` |
| Gastos                | `expenses`, `expense_shares`, `direct_payments`                                              |
| Compras               | `shopping_items`                                                                             |
| Mantenimiento         | `maintenance_reports`                                                                        |
| Tareas                | `tasks`, `task_history`                                                                      |
| Reservas              | `resources`, `reservations`                                                                  |
| Votaciones            | `polls`, `poll_options`, `votes`                                                             |
| Acuerdos              | `rule_versions`, `rule_acceptances`, `rule_reports`                                          |
| Migraciones aplicadas | `migrations`                                                                                 |

## Reglas principales

- Una persona puede estar en varios apartamentos. Cada apartamento admite ocho integrantes y debe conservar al menos un administrador.
- Retirar a alguien le quita el acceso, pero conserva su historial. Archivar el apartamento también cancela invitaciones y recordatorios pendientes.
- Los gastos se reparten hasta el centavo. El pagador participa en la división y los abonos no pueden superar la deuda con la otra persona.
- Gastos, productos y reportes de mantenimiento se pueden restaurar después de eliminarlos.
- Las tareas guardan sus cambios de estado. Solo el creador o un administrador las modifica; si no tienen responsable, cualquier integrante puede empezarlas o completarlas.
- La base impide dos reservas activas del mismo recurso en horarios que se cruzan. Los horarios consecutivos sí se permiten.
- Cada integrante tiene un voto por votación y puede cambiarlo antes del cierre. En las anónimas no se muestran los nombres asociados a cada opción.
- Los acuerdos conservan sus versiones. Cada versión nueva debe aceptarse de nuevo.
- Los avisos tienen una clave que evita repetirlos. Eliminarlos de la bandeja conserva esa clave.

Los criterios completos están en [HISTORIAS.md](HISTORIAS.md).

## Estados guardados

| Módulo        | Valores                                |
| ------------- | -------------------------------------- |
| Tareas        | `pending`, `in_progress`, `completed`  |
| Compras       | `PENDIENTE`, `COMPRADO`                |
| Mantenimiento | `PENDIENTE`, `EN_PROGRESO`, `RESUELTO` |
| Reservas      | `active`, `cancelled`                  |
| Votaciones    | `open`, `closed`                       |

La interfaz traduce las etiquetas, pero mantiene estos valores al enviar datos a la API.
