# Historias de usuario

Tenemos 10 funcionalidades y 39 historias. Contamos solo los títulos que empiezan por HU; el historial del repositorio conserva este mismo listado. El comentario de evaluación menciona 49, pero ese número no coincide con las historias registradas.

Cada historia incluye responsable, prioridad, estimación, estado, criterios, mockups y pruebas. Los puntos son una estimación de dificultad para repartir trabajo; no son horas registradas.

| Funcionalidad | HU | Responsable |
| --- | ---: | --- |
| Apartamento | 4 | Juan |
| Gastos | 3 | Miguel |
| Tareas | 6 | Tomás |
| Compras | 3 | Miguel |
| Reservas | 4 | Tomás |
| Mantenimiento | 3 | Miguel |
| Notificaciones | 3 | Juan |
| Votaciones | 5 | Tomás |
| Acuerdos | 5 | Tomás |
| Cuentas y perfil | 3 | Juan |
| **Total** | **39** | **3 integrantes** |

## Funcionalidad 1: Gestión del apartamento

### HU1.1 Crear y editar el apartamento

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=45-152) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-582).

**Pruebas:** 3 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx).

Como persona registrada quiero crear un apartamento y editar su información para tener un espacio compartido con mis roommates.

**Criterios de aceptación:**

- Archivar pide confirmación, retira el acceso de todos y cancela invitaciones y recordatorios pendientes. El historial se conserva.
- Quien crea el apartamento queda como su primer administrador. El nombre es obligatorio (2 a 80 caracteres); la dirección y la descripción son opcionales.
- Solo los administradores editan la información del apartamento.
- Las personas de fuera no ven sus datos. Quien pertenece a varios apartamentos elige el activo en la barra superior.

### HU1.2 Invitar roommates

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 5 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=45-185) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-615).

**Pruebas:** 9 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx), [reglas.test.ts](../tests/unit/reglas.test.ts).

Como administrador quiero invitar a mis roommates con un enlace para que se unan al apartamento.

**Criterios de aceptación:**

- La invitación genera un enlace asociado a un correo que vence en 7 días. Solo puede aceptarlo una cuenta con ese correo, y una sola vez.
- El administrador ve las invitaciones y puede cancelar las pendientes. Una nueva invitación al mismo correo anula la anterior.
- Nunca se superan los 8 integrantes, ni siquiera si se aceptan dos invitaciones a la vez.

### HU1.3 Retirar integrantes

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=45-170) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-600).

**Pruebas:** 4 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx), [reglas.test.ts](../tests/unit/reglas.test.ts).

Como administrador quiero retirar a un integrante para que deje de tener acceso al apartamento.

**Criterios de aceptación:**

- Solo los administradores retiran integrantes.
- La persona retirada pierde el acceso de inmediato, pero su historial (tareas, gastos, votos…) se conserva.
- El último administrador no puede ser retirado.

### HU1.4 Administrar permisos

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=45-170) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-600).

**Pruebas:** 3 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx), [reglas.test.ts](../tests/unit/reglas.test.ts).

Como administrador quiero cambiar el rol de los integrantes para compartir la administración del hogar.

**Criterios de aceptación:**

- Un administrador puede convertir a un integrante en administrador o quitarle ese rol.
- Siempre queda al menos un administrador.
- La persona cuyo rol cambia recibe un aviso.

## Funcionalidad 2: Gestión de gastos

### HU2.1 Registrar un gasto con división exacta

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 5 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-138) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-670).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como integrante quiero registrar un gasto y dividirlo entre los participantes para saber cuánto le corresponde a cada uno.

**Criterios de aceptación:**

- El gasto tiene título, categoría, monto mayor que cero con hasta dos decimales, fecha, pagador y participantes del hogar.
- Se crean las cuotas de todos los participantes y suman exactamente el total; la del pagador queda pagada.
- Se rechazan montos inválidos y participantes ajenos, y las personas de fuera no ven los gastos.

### HU2.2 Ver el resumen y los saldos

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 5 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-166) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-698).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como integrante quiero ver cuánto se gastó, cuánto debo y cuánto me deben para saber quién debe dinero.

**Criterios de aceptación:**

- El resumen muestra el total del mes y la cuota personal.
- Cada persona ve cuánto debe y cuánto le deben sus roommates.
- Se registran abonos a otra persona sin superar el saldo pendiente; al saldarlo, las cuotas quedan pagadas.

### HU2.3 Editar y eliminar gastos

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-121) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-653).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como integrante quiero corregir o eliminar un gasto para mantener el historial correcto.

**Criterios de aceptación:**

- Editar un gasto vuelve a calcular sus cuotas.
- Solo quien registró el gasto o un administrador lo editan o eliminan.
- Se puede deshacer la eliminación.

## Funcionalidad 3: Gestión de tareas

### HU3.1 Crear tarea

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-247) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-743).

**Pruebas:** 3 unitarias en [tareas-api.test.ts](../tests/unit/tareas-api.test.ts).

Como integrante del hogar quiero crear una tarea con título, descripción, prioridad y fecha límite para que todos sepan qué hay que hacer.

**Criterios de aceptación:**

- La tarea se crea en estado Pendiente y su creación queda en el historial.
- El título es obligatorio (2 a 120 caracteres) y la prioridad es Alta, Media o Baja. La fecha límite es opcional, pero no puede estar en el pasado.
- Solo los integrantes del hogar ven y crean sus tareas.

### HU3.2 Asignar responsable

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-261) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-757).

**Pruebas:** 3 unitarias en [tareas-api.test.ts](../tests/unit/tareas-api.test.ts).

Como integrante quiero asignar una tarea a un roommate para que quede claro quién se encarga.

**Criterios de aceptación:**

- Solo se puede asignar a integrantes activos del hogar.
- La persona asignada recibe un aviso con un enlace a la tarea.
- Si el responsable deja el hogar, se conserva en la tarea mientras no se cambie, pero no se le puede volver a asignar.

### HU3.3 Fecha límite y recordatorio

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-247) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-743).

**Pruebas:** 3 unitarias en [tareas-api.test.ts](../tests/unit/tareas-api.test.ts), [tareas.test.ts](../tests/unit/tareas.test.ts).

Como responsable quiero recibir un recordatorio antes de la fecha límite para no olvidar la tarea.

**Criterios de aceptación:**

- Una tarea con fecha y responsable programa un recordatorio según la anticipación que elija esa persona.
- Completar o eliminar la tarea cancela el recordatorio; cambiar de responsable lo traslada.
- Una tarea se muestra como vencida solo si pasó su fecha y no está completada.

### HU3.4 Cambiar estado

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-228) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-724).

**Pruebas:** 3 unitarias en [tareas-api.test.ts](../tests/unit/tareas-api.test.ts), [tareas.test.ts](../tests/unit/tareas.test.ts).

Como integrante quiero mover una tarea entre Pendiente, En progreso y Completada con botones para mostrar su avance sin arrastrar.

**Criterios de aceptación:**

- Cambian el estado quien creó la tarea o un administrador; el responsable no.
- Si la tarea no tiene responsable, cualquier integrante puede empezarla o completarla, pero no reabrirla ni editarla.
- Cada estado ofrece botones hacia los demás estados permitidos.

### HU3.5 Historial de cumplimiento

**Responsable:** Tomás · **Prioridad:** Media · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-337) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-797).

**Pruebas:** 3 unitarias en [tareas-api.test.ts](../tests/unit/tareas-api.test.ts).

Como integrante quiero ver quién cambió el estado de cada tarea y cuándo para saber cómo se cumplen las responsabilidades.

**Criterios de aceptación:**

- Cada cambio de estado queda registrado con su autor, el estado anterior y el nuevo.
- Al completar una tarea se guarda la fecha de cumplimiento, que se borra si se reabre. Si la completa otra persona, se avisa a quien la creó.
- En Inicio, cada persona ve cuántas tareas abiertas tiene asignadas y cuáles son.

### HU3.6 Editar, eliminar y filtrar

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-228) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-724).

**Pruebas:** 3 unitarias en [tareas-api.test.ts](../tests/unit/tareas-api.test.ts).

Como integrante quiero editar, eliminar y filtrar tareas para mantener el tablero al día.

**Criterios de aceptación:**

- Editar actualiza los datos y queda registrado en la actividad del hogar.
- Solo quien creó la tarea o un administrador la eliminan; al eliminarla se borran su historial y su recordatorio.
- El tablero indica a cada persona qué tareas puede editar, se filtra por responsable y prioridad (los filtros quedan en la URL) y muestra las completadas de los últimos 30 días.

## Funcionalidad 4: Lista de compras

### HU4.1 Agregar productos

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-422) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-846).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como integrante quiero agregar productos a la lista para organizar las compras comunes.

**Criterios de aceptación:**

- El producto tiene título, categoría, cantidad de al menos 1, precio estimado y, opcionalmente, un comprador que debe ser integrante activo.
- La lista muestra cada producto con su estado, su cantidad y la persona asignada.
- Se rechazan cantidades inválidas, y las personas de fuera no ven la lista.

### HU4.2 Marcar productos comprados

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-406) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-830).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como integrante quiero marcar un producto como comprado para que nadie lo compre dos veces.

**Criterios de aceptación:**

- Cualquier integrante marca un producto como comprado.
- Se guarda quién lo compró, y el producto queda en el historial de compras.
- Un producto comprado se puede volver a dejar pendiente.

### HU4.3 Editar y eliminar productos

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-406) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-830).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como integrante quiero corregir o quitar productos para mantener la lista al día.

**Criterios de aceptación:**

- Se pueden editar el nombre, la cantidad y el precio.
- Solo quien agregó el producto o un administrador lo modifican o eliminan.
- Se puede deshacer la eliminación.

## Funcionalidad 5: Reserva de espacios y recursos

### HU5.1 Gestionar recursos

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-543) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-931).

**Pruebas:** 3 unitarias en [reservas-api.test.ts](../tests/unit/reservas-api.test.ts).

Como administrador quiero agregar, editar y retirar los espacios u objetos que se turnan (lavadora, sala…) para que se puedan reservar.

**Criterios de aceptación:**

- Solo los administradores agregan, editan o retiran recursos.
- El nombre es obligatorio y no se repite entre los recursos activos del hogar.
- Un recurso con reservas próximas no se puede retirar; retirarlo no borra sus reservas pasadas.

### HU5.2 Reservar sin cruces

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 5 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-526) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-914).

**Pruebas:** 4 unitarias en [reservas-api.test.ts](../tests/unit/reservas-api.test.ts).

Como integrante quiero reservar un recurso para un horario para usarlo sin conflictos.

**Criterios de aceptación:**

- La reserva debe empezar en el futuro, terminar después de empezar y durar como máximo 7 días.
- Dos reservas activas del mismo recurso no se pueden cruzar, ni siquiera si se hacen a la vez; las consecutivas sí se permiten.
- Quien reserva recibe un recordatorio, e Inicio muestra la próxima reserva del hogar.

### HU5.3 Calendario de reservas

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-494) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-882).

**Pruebas:** 3 unitarias en [reservas.test.ts](../tests/unit/reservas.test.ts).

Como integrante quiero ver un calendario semanal para saber qué está ocupado cada día.

**Criterios de aceptación:**

- El calendario muestra de lunes a domingo las reservas que se cruzan con cada día, con su horario, recurso y persona.
- Se navega con "Anterior", "Esta semana" y "Siguiente". La semana queda en la URL, así que "Atrás" vuelve a la anterior.
- Los filtros por recurso y "Solo mis reservas" se aplican al calendario y a la lista. Un rango inválido se rechaza.

### HU5.4 Cancelar reserva

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-560) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-948).

**Pruebas:** 3 unitarias en [reservas-api.test.ts](../tests/unit/reservas-api.test.ts).

Como integrante quiero cancelar una reserva para liberar el horario.

**Criterios de aceptación:**

- Cancelan quien hizo la reserva o un administrador.
- Cancelar libera el horario y el recordatorio; una reserva cancelada no se cancela de nuevo.
- Si un administrador cancela la reserva de otra persona, esa persona recibe un aviso.

## Funcionalidad 6: Tickets de mantenimiento

### HU6.1 Crear reportes

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-651) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1003).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como integrante quiero reportar un daño para que se gestione su reparación.

**Criterios de aceptación:**

- El reporte tiene título, descripción, categoría, costo estimado opcional, prioridad y, opcionalmente, un responsable (gestor) que debe ser integrante activo.
- El reporte guarda su categoría, su costo y su responsable, y queda pendiente.
- Se rechazan los reportes sin título o con un responsable ajeno al hogar.

### HU6.2 Filtrar y contar reportes

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-628) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-980).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como integrante quiero filtrar los reportes para encontrar rápido lo que falta por resolver.

**Criterios de aceptación:**

- Se filtra por estado, prioridad y categoría.
- Se muestra cuántos reportes hay en cada estado.
- Se rechazan los filtros inválidos, y las personas de fuera no ven los reportes.

### HU6.3 Gestionar el estado y el responsable

**Responsable:** Miguel · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-628) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-980).

**Pruebas:** 3 unitarias en [gastos-compras-mantenimiento.test.ts](../tests/unit/gastos-compras-mantenimiento.test.ts).

Como responsable o administrador quiero actualizar el estado de un reporte para seguir la reparación de principio a fin.

**Criterios de aceptación:**

- Quien reportó, el responsable o un administrador cambian el estado y reasignan el reporte a un integrante activo.
- Al resolver un reporte se actualizan los contadores.
- Solo quien reportó o un administrador eliminan un reporte; la eliminación se puede deshacer.

## Funcionalidad 7: Notificaciones y recordatorios

### HU7.1 Bandeja de notificaciones

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-730) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1046).

**Pruebas:** 6 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx).

Como integrante quiero ver los avisos de mi hogar en un solo lugar para no perder lo importante.

**Criterios de aceptación:**

- La bandeja muestra los avisos propios del hogar activo, del más reciente al más antiguo, con un enlace a lo que los originó.
- Cada aviso se marca como leído o no leído, y la barra superior muestra cuántos quedan sin leer.
- Nadie puede marcar ni ver avisos de otra persona.
- Eliminar un aviso propio pide confirmación y conserva su clave para que no reaparezca.

### HU7.2 Preferencias de notificación

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-746) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1062).

**Pruebas:** 3 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx).

Como integrante quiero elegir por qué canal recibo los avisos y con cuánta anticipación para recibirlos a mi manera.

**Criterios de aceptación:**

- Los avisos dentro de Roomie están siempre activos; el correo y el push se pueden activar si el servidor los tiene configurados.
- Cada persona elige la anticipación de sus recordatorios: al vencer o hasta 168 horas antes.
- Para recibir push, la persona registra su dispositivo y concede el permiso del navegador.

### HU7.3 Recordatorios automáticos por vencimiento

**Responsable:** Juan · **Prioridad:** Media · **Estimación:** 5 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-741) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1057).

**Pruebas:** 5 unitarias en [reglas.test.ts](../tests/unit/reglas.test.ts).

Como integrante quiero que Roomie me recuerde lo que está por vencer para cumplir a tiempo.

**Criterios de aceptación:**

- El worker crea un aviso cuando llega el momento del vencimiento menos la anticipación elegida, sin duplicarlo aunque se ejecute varias veces.
- Las tareas con fecha límite y las reservas programan su recordatorio, y lo cancelan al completarse o cancelarse.
- Solo reciben avisos los integrantes activos del hogar.

## Funcionalidad 8: Votaciones y decisiones grupales

### HU8.1 Crear votación

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-826) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1106).

**Pruebas:** 3 unitarias en [votaciones-api.test.ts](../tests/unit/votaciones-api.test.ts).

Como integrante quiero abrir una votación con varias opciones para decidir en grupo.

**Criterios de aceptación:**

- Cualquier integrante abre una votación, y los demás reciben un aviso.
- Tiene de 2 a 10 opciones distintas y, opcionalmente, una fecha de cierre en el futuro.
- Las personas que no pertenecen al hogar no ven ni abren votaciones.

### HU8.2 Tipo de decisión

**Responsable:** Tomás · **Prioridad:** Media · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-836) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1116).

**Pruebas:** 3 unitarias en [votaciones.test.ts](../tests/unit/votaciones.test.ts).

Como integrante quiero elegir si se decide por mayoría simple o por unanimidad para adaptar la votación a la importancia del tema.

**Criterios de aceptación:**

- Con mayoría simple gana la opción con más votos. Un empate o la ausencia de votos no tienen ganadora.
- Con unanimidad gana solo si todos los integrantes habilitados votan por la misma opción.
- Si no se indica, se usa mayoría simple, y el aviso de cierre informa el resultado según la regla.

### HU8.3 Votar

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-813) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1093).

**Pruebas:** 3 unitarias en [votaciones-api.test.ts](../tests/unit/votaciones-api.test.ts).

Como integrante quiero votar, de forma anónima o pública, para expresar mi opinión.

**Criterios de aceptación:**

- Se puede votar y cambiar el voto mientras la votación esté abierta.
- Mientras está abierta solo se ve cuántos votaron, no los recuentos.
- En las votaciones anónimas nunca se muestra qué eligió cada persona; cada una ve solo su propio voto.

### HU8.4 Cerrar y ver resultados

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-813) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1093).

**Pruebas:** 3 unitarias en [votaciones-api.test.ts](../tests/unit/votaciones-api.test.ts).

Como creador o administrador quiero cerrar la votación para publicar el resultado.

**Criterios de aceptación:**

- Cierran quien creó la votación o un administrador; después ya no se puede votar.
- Al cerrar solo cuentan los votos de los integrantes activos, y quien no votó cuenta como abstención.
- Si tiene fecha de cierre, se cierra sola al llegar esa fecha.

### HU8.5 Historial de decisiones

**Responsable:** Tomás · **Prioridad:** Media · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-850) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1130).

**Pruebas:** 3 unitarias en [votaciones-api.test.ts](../tests/unit/votaciones-api.test.ts).

Como integrante quiero consultar las votaciones cerradas para recordar qué se decidió.

**Criterios de aceptación:**

- Las votaciones cerradas muestran su resultado, los votos por opción y la fecha de cierre (y quién eligió cada opción, si son públicas).
- La lista muestra primero las abiertas y luego las cerradas, de la más reciente a la más antigua.
- Al cerrar se avisa el resultado a los integrantes.

## Funcionalidad 9: Reglamento y acuerdos del hogar

### HU9.1 Crear y editar el reglamento

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-915) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1159).

**Pruebas:** 3 unitarias en [acuerdos-api.test.ts](../tests/unit/acuerdos-api.test.ts).

Como administrador quiero redactar el reglamento y publicar nuevas versiones para dejar por escrito los acuerdos.

**Criterios de aceptación:**

- Solo los administradores publican versiones.
- El texto tiene al menos 10 caracteres y debe ser distinto del de la versión vigente.
- Las versiones se numeran sin repetirse, aunque dos administradores publiquen a la vez.

### HU9.2 Aceptación por integrante

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-906) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1150).

**Pruebas:** 3 unitarias en [acuerdos-api.test.ts](../tests/unit/acuerdos-api.test.ts).

Como integrante quiero aceptar la versión vigente para dejar constancia de que la leí.

**Criterios de aceptación:**

- Cada integrante acepta la versión vigente una sola vez.
- Una versión nueva exige aceptar de nuevo, y las versiones antiguas no se pueden aceptar.
- Todos ven quién aceptó y quién falta. Quien publica la versión la acepta al publicarla, y los demás reciben un aviso.

### HU9.3 Versiones e historial de modificaciones

**Responsable:** Tomás · **Prioridad:** Media · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-939) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1183).

**Pruebas:** 3 unitarias en [acuerdos-api.test.ts](../tests/unit/acuerdos-api.test.ts).

Como integrante quiero consultar las versiones anteriores para ver cómo cambiaron los acuerdos.

**Criterios de aceptación:**

- Las versiones anteriores se conservan con su autor y su resumen de cambios.
- La versión vigente es siempre la más reciente.
- Las personas que no pertenecen al hogar no ven el reglamento.

### HU9.4 Reportar incumplimientos

**Responsable:** Tomás · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-944) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1188).

**Pruebas:** 3 unitarias en [acuerdos-api.test.ts](../tests/unit/acuerdos-api.test.ts).

Como integrante quiero reportar que no se cumplió un acuerdo para que el hogar lo resuelva.

**Criterios de aceptación:**

- Se elige un acuerdo de la versión vigente y, opcionalmente, a quién se le atribuye. Se avisa a los administradores y a esa persona.
- No se puede reportar un acuerdo que no está en el reglamento, reportarse a sí mismo ni reportar en un hogar sin reglamento.
- Solo un administrador marca el reporte como resuelto, y quien lo hizo recibe un aviso.

### HU9.5 Asistente de acuerdos con IA simulada

**Responsable:** Tomás · **Prioridad:** Media · **Estimación:** 5 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-927) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1171).

**Pruebas:** 7 unitarias en [acuerdos.test.ts](../tests/unit/acuerdos.test.ts), [compatibilidad.test.tsx](../tests/unit/compatibilidad.test.tsx).

Como administrador quiero pedirle ideas a un asistente para redactar acuerdos más rápido y repartir mejor las tareas.

**Criterios de aceptación:**

- Ante "Somos cuatro y nadie cumple las tareas", propone una rotación semanal equitativa. Toma el número de personas del mensaje o, si no lo dice, los integrantes del hogar con sus nombres.
- Propone cláusulas por tema (limpieza, ruido, visitas…) y, si se le pide, revisa qué temas faltan en el borrador. Las cláusulas se agregan al borrador con un botón.
- Mientras "genera" muestra un spinner y un skeleton durante una espera simulada. La respuesta es un mock aislado en `src/lib/assistant.ts`, que en el ciclo 2 se reemplazará por un modelo real.

## Funcionalidad 10: Cuentas, sesión y perfil

### HU10.1 Registro e inicio de sesión

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 5 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-1174) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1302).

**Pruebas:** 5 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx).

Como persona quiero crear una cuenta e iniciar sesión para acceder a mi hogar desde cualquier dispositivo.

**Criterios de aceptación:**

- La cuenta se crea con nombre, un correo que no esté registrado y una contraseña de al menos 10 caracteres.
- La sesión se guarda en una cookie `HttpOnly` y se comprueba en el servidor. Tras varios intentos fallidos, el inicio de sesión se bloquea temporalmente.
- Sin sesión no se accede a ningún dato, y se rechazan las peticiones que vienen de otro sitio.

### HU10.2 Cerrar sesión

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-1035) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1243).

**Pruebas:** 3 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx), [sesion-api.test.ts](../tests/unit/sesion-api.test.ts).

Como persona quiero cerrar sesión para proteger mi cuenta en un equipo compartido.

**Criterios de aceptación:**

- Cerrar sesión invalida la sesión en el servidor, no solo en el navegador.
- Una cookie anterior deja de funcionar.

### HU10.3 Perfil y contraseña

**Responsable:** Juan · **Prioridad:** Alta · **Estimación:** 3 puntos · **Estado:** Implementada en ciclo 1.

**Mockups:** [Escritorio](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=46-1009) · [Móvil](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-1217).

**Pruebas:** 3 unitarias en [funcionalidades.test.tsx](../tests/unit/funcionalidades.test.tsx).

Como persona quiero editar mi nombre y cambiar mi contraseña para mantener mi cuenta al día.

**Criterios de aceptación:**

- Se puede cambiar el nombre visible.
- Cambiar la contraseña exige la contraseña actual.
- Al cambiar la contraseña se cierran las demás sesiones abiertas.
- Cerrar la cuenta exige contraseña y confirmación. Si la persona es el único administrador de un hogar disponible, debe asignar otro o archivar ese hogar. La cuenta se desactiva, su nombre y correo se sustituyen y el historial compartido conserva sus referencias.

## Pruebas por historia

`npm run test:hu` ejecuta las unitarias y comprueba que cada historia tenga al menos tres aprobadas. El comando muestra los casos asociados a cada historia y las pruebas adicionales de hooks, formatos, idiomas y accesibilidad.

Los archivos están en `tests/unit/`. Las pruebas de servidor usan consultas y sesiones simuladas, pero ejecutan las reglas reales. No necesitan una base de datos ni la aplicación abierta.

Las pruebas de integración necesitan la aplicación abierta. Las E2E la inician si hace falta. Se cuentan aparte de las unitarias. GitHub Actions también ejecuta ambas contra la aplicación en Docker.

| HU     | Casos aprobados | Archivos unitarios                               |
| ------ | --------------: | ------------------------------------------------ |
| HU1.1  |               3 | `funcionalidades.test.tsx`                       |
| HU1.2  |               9 | `funcionalidades.test.tsx`, `reglas.test.ts`     |
| HU1.3  |               4 | `funcionalidades.test.tsx`, `reglas.test.ts`     |
| HU1.4  |               3 | `funcionalidades.test.tsx`, `reglas.test.ts`     |
| HU2.1  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU2.2  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU2.3  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU3.1  |               3 | `tareas-api.test.ts`                             |
| HU3.2  |               3 | `tareas-api.test.ts`                             |
| HU3.3  |               3 | `tareas-api.test.ts`, `tareas.test.ts`           |
| HU3.4  |               3 | `tareas-api.test.ts`, `tareas.test.ts`           |
| HU3.5  |               3 | `tareas-api.test.ts`                             |
| HU3.6  |               3 | `tareas-api.test.ts`                             |
| HU4.1  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU4.2  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU4.3  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU5.1  |               3 | `reservas-api.test.ts`                           |
| HU5.2  |               4 | `reservas-api.test.ts`                           |
| HU5.3  |               3 | `reservas.test.ts`                               |
| HU5.4  |               3 | `reservas-api.test.ts`                           |
| HU6.1  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU6.2  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU6.3  |               3 | `gastos-compras-mantenimiento.test.ts`           |
| HU7.1  |               6 | `funcionalidades.test.tsx`                       |
| HU7.2  |               3 | `funcionalidades.test.tsx`                       |
| HU7.3  |               5 | `reglas.test.ts`                                 |
| HU8.1  |               3 | `votaciones-api.test.ts`                         |
| HU8.2  |               3 | `votaciones.test.ts`                             |
| HU8.3  |               3 | `votaciones-api.test.ts`                         |
| HU8.4  |               3 | `votaciones-api.test.ts`                         |
| HU8.5  |               3 | `votaciones-api.test.ts`                         |
| HU9.1  |               3 | `acuerdos-api.test.ts`                           |
| HU9.2  |               3 | `acuerdos-api.test.ts`                           |
| HU9.3  |               3 | `acuerdos-api.test.ts`                           |
| HU9.4  |               3 | `acuerdos-api.test.ts`                           |
| HU9.5  |               7 | `acuerdos.test.ts`, `compatibilidad.test.tsx`    |
| HU10.1 |               5 | `funcionalidades.test.tsx`                       |
| HU10.2 |               3 | `funcionalidades.test.tsx`, `sesion-api.test.ts` |
| HU10.3 |               3 | `funcionalidades.test.tsx`                       |
