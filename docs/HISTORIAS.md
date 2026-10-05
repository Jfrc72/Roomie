# Historias de usuario: Tareas, Reservas, Votaciones y Acuerdos

Responsable: Tomás. Historias de las funcionalidades 3, 5, 8 y 9 del pitch, con los ajustes que se decidieron al implementarlas. La numeración sigue la del pitch: **HU3.x** corresponde a la Funcionalidad 3 (Tareas), y así con las demás.

Cada historia tiene al menos tres pruebas. Su identificador (por ejemplo `HU3.1.2`) aparece en el nombre de la prueba:

- Pruebas de integración contra la API real: `tests/tasks.test.ts`, `tests/reservations.test.ts`, `tests/polls.test.ts` y `tests/rules.test.ts`. Requieren `npm run dev` abierto y se ejecutan con `npm test`.
- Pruebas unitarias de la lógica, sin servidor ni base de datos: `tests/unit/*.test.ts`, con `npm run test:unit`.

> Las pruebas de Gastos, Compras y Mantenimiento (`tests/shared-modules.test.ts`) usan su propia numeración HU1 a HU3, que coincide con estos identificadores. Conviene unificar con la numeración del pitch (Gastos HU2, Compras HU4, Mantenimiento HU6).

| Historia | Pruebas |
| --- | --- |
| HU3.1 Crear tarea | HU3.1.1, HU3.1.2, HU3.1.3 |
| HU3.2 Asignar responsable | HU3.2.1, HU3.2.2, HU3.2.3 |
| HU3.3 Fecha límite y recordatorio | HU3.3.1, HU3.3.2, HU3.3.3 (unitaria) |
| HU3.4 Cambiar estado | HU3.4.1, HU3.4.2, HU3.4.3 y HU3.4.4 (unitarias) |
| HU3.5 Historial de cumplimiento | HU3.5.1, HU3.5.2, HU3.5.3 |
| HU3.6 Editar, eliminar y filtrar | HU3.6.1, HU3.6.2, HU3.6.3 |
| HU5.1 Gestionar recursos | HU5.1.1, HU5.1.2, HU5.1.3 |
| HU5.2 Reservar sin cruces | HU5.2.1, HU5.2.2, HU5.2.3 |
| HU5.3 Calendario de reservas | HU5.3.1, HU5.3.2, HU5.3.3 a HU5.3.5 (unitarias) |
| HU5.4 Cancelar reserva | HU5.4.1, HU5.4.2, HU5.4.3 |
| HU8.1 Crear votación | HU8.1.1, HU8.1.2, HU8.1.3 |
| HU8.2 Tipo de decisión | HU8.2.1 a HU8.2.3 (unitarias), HU8.2.4 |
| HU8.3 Votar | HU8.3.1, HU8.3.2, HU8.3.3 |
| HU8.4 Cerrar y ver resultados | HU8.4.1, HU8.4.2, HU8.4.3 |
| HU8.5 Historial de decisiones | HU8.5.1, HU8.5.2, HU8.5.3 |
| HU9.1 Crear y editar el reglamento | HU9.1.1, HU9.1.2, HU9.1.3 |
| HU9.2 Aceptación por integrante | HU9.2.1, HU9.2.2, HU9.2.3 |
| HU9.3 Versiones e historial | HU9.3.1, HU9.3.2, HU9.3.3 |
| HU9.4 Reportar incumplimientos | HU9.4.1, HU9.4.2, HU9.4.3 |
| HU9.5 Asistente con IA simulada | HU9.5.1 a HU9.5.4 (unitarias) |

## Funcionalidad 3: Tareas

Ajustes respecto al pitch:
- Las tareas tienen prioridad (alta, media o baja) y se pueden editar, eliminar y filtrar.
- Solo quien creó la tarea o un administrador la modifican; el responsable no. Si no tiene responsable, cualquier integrante puede empezarla o completarla.
- El tablero se opera con botones, sin arrastrar.

### HU3.1 Crear tarea
**Como** integrante del hogar **quiero** crear una tarea con título, descripción, prioridad y fecha límite **para** que todos sepan qué hay que hacer.
- La tarea se crea en estado Pendiente y su creación queda en el historial.
- El título es obligatorio (2 a 120 caracteres) y la prioridad es Alta, Media o Baja. La fecha límite es opcional, pero no puede estar en el pasado.
- Solo los integrantes del hogar ven y crean sus tareas.

### HU3.2 Asignar responsable
**Como** integrante **quiero** asignar una tarea a un roommate **para** que quede claro quién se encarga.
- Solo se puede asignar a integrantes activos del hogar.
- La persona asignada recibe un aviso con un enlace a la tarea.
- Si el responsable deja el hogar, se conserva en la tarea mientras no se cambie, pero no se le puede volver a asignar.

### HU3.3 Fecha límite y recordatorio
**Como** responsable **quiero** recibir un recordatorio antes de la fecha límite **para** no olvidar la tarea.
- Una tarea con fecha y responsable programa un recordatorio según la anticipación que elija esa persona.
- Completar o eliminar la tarea cancela el recordatorio; cambiar de responsable lo traslada.
- Una tarea se muestra como vencida solo si pasó su fecha y no está completada.

### HU3.4 Cambiar estado
**Como** integrante **quiero** mover una tarea entre Pendiente, En progreso y Completada con botones **para** mostrar su avance sin arrastrar.
- Cambian el estado quien creó la tarea o un administrador; el responsable no.
- Si la tarea no tiene responsable, cualquier integrante puede empezarla o completarla, pero no reabrirla ni editarla.
- Cada estado ofrece botones hacia los demás estados permitidos.

### HU3.5 Historial de cumplimiento
**Como** integrante **quiero** ver quién cambió el estado de cada tarea y cuándo **para** saber cómo se cumplen las responsabilidades.
- Cada cambio de estado queda registrado con su autor, el estado anterior y el nuevo.
- Al completar una tarea se guarda la fecha de cumplimiento, que se borra si se reabre. Si la completa otra persona, se avisa a quien la creó.
- En Inicio, cada persona ve cuántas tareas abiertas tiene asignadas y cuáles son.

### HU3.6 Editar, eliminar y filtrar
**Como** integrante **quiero** editar, eliminar y filtrar tareas **para** mantener el tablero al día.
- Editar actualiza los datos y queda registrado en la actividad del hogar.
- Solo quien creó la tarea o un administrador la eliminan; al eliminarla se borran su historial y su recordatorio.
- El tablero indica a cada persona qué tareas puede editar, se filtra por responsable y prioridad (los filtros quedan en la URL) y muestra las completadas de los últimos 30 días.

## Funcionalidad 5: Reservas de espacios y recursos

Ajustes respecto al pitch:
- Solo los administradores gestionan los recursos.
- Una reserva dura como máximo 7 días.
- El calendario es semanal y una reserva no se edita: se cancela y se crea otra.

### HU5.1 Gestionar recursos
**Como** administrador **quiero** agregar, editar y retirar los espacios u objetos que se turnan (lavadora, sala…) **para** que se puedan reservar.
- Solo los administradores agregan, editan o retiran recursos.
- El nombre es obligatorio y no se repite entre los recursos activos del hogar.
- Un recurso con reservas próximas no se puede retirar; retirarlo no borra sus reservas pasadas.

### HU5.2 Reservar sin cruces
**Como** integrante **quiero** reservar un recurso para un horario **para** usarlo sin conflictos.
- La reserva debe empezar en el futuro, terminar después de empezar y durar como máximo 7 días.
- Dos reservas activas del mismo recurso no se pueden cruzar, ni siquiera si se hacen a la vez; las consecutivas sí se permiten.
- Quien reserva recibe un recordatorio, e Inicio muestra la próxima reserva del hogar.

### HU5.3 Calendario de reservas
**Como** integrante **quiero** ver un calendario semanal **para** saber qué está ocupado cada día.
- El calendario muestra de lunes a domingo las reservas que se cruzan con cada día, con su horario, recurso y persona.
- Se navega con "Anterior", "Esta semana" y "Siguiente". La semana queda en la URL, así que "Atrás" vuelve a la anterior.
- Los filtros por recurso y "Solo mis reservas" se aplican al calendario y a la lista. Un rango inválido se rechaza.

### HU5.4 Cancelar reserva
**Como** integrante **quiero** cancelar una reserva **para** liberar el horario.
- Cancelan quien hizo la reserva o un administrador.
- Cancelar libera el horario y el recordatorio; una reserva cancelada no se cancela de nuevo.
- Si un administrador cancela la reserva de otra persona, esa persona recibe un aviso.

## Funcionalidad 8: Votaciones y decisiones grupales

Ajustes respecto al pitch y decisiones acordadas:
- Mayoría simple o unanimidad. Un empate no tiene ganadora.
- Al cerrar solo cuentan los integrantes activos, y quien no votó cuenta como abstención.
- Los resultados se muestran al cerrar y el voto se puede cambiar mientras la votación siga abierta.

### HU8.1 Crear votación
**Como** integrante **quiero** abrir una votación con varias opciones **para** decidir en grupo.
- Cualquier integrante abre una votación, y los demás reciben un aviso.
- Tiene de 2 a 10 opciones distintas y, opcionalmente, una fecha de cierre en el futuro.
- Las personas que no pertenecen al hogar no ven ni abren votaciones.

### HU8.2 Tipo de decisión
**Como** integrante **quiero** elegir si se decide por mayoría simple o por unanimidad **para** adaptar la votación a la importancia del tema.
- Con mayoría simple gana la opción con más votos. Un empate o la ausencia de votos no tienen ganadora.
- Con unanimidad gana solo si todos los integrantes habilitados votan por la misma opción.
- Si no se indica, se usa mayoría simple, y el aviso de cierre informa el resultado según la regla.

### HU8.3 Votar
**Como** integrante **quiero** votar, de forma anónima o pública, **para** expresar mi opinión.
- Se puede votar y cambiar el voto mientras la votación esté abierta.
- Mientras está abierta solo se ve cuántos votaron, no los recuentos.
- En las votaciones anónimas nunca se muestra qué eligió cada persona; cada una ve solo su propio voto.

### HU8.4 Cerrar y ver resultados
**Como** creador o administrador **quiero** cerrar la votación **para** publicar el resultado.
- Cierran quien creó la votación o un administrador; después ya no se puede votar.
- Al cerrar solo cuentan los votos de los integrantes activos, y quien no votó cuenta como abstención.
- Si tiene fecha de cierre, se cierra sola al llegar esa fecha.

### HU8.5 Historial de decisiones
**Como** integrante **quiero** consultar las votaciones cerradas **para** recordar qué se decidió.
- Las votaciones cerradas muestran su resultado, los votos por opción y la fecha de cierre (y quién eligió cada opción, si son públicas).
- La lista muestra primero las abiertas y luego las cerradas, de la más reciente a la más antigua.
- Al cerrar se avisa el resultado a los integrantes.

## Funcionalidad 9: Reglamento y acuerdos del hogar

Ajustes respecto al pitch:
- La aceptación es un registro de lectura por versión, no una firma electrónica certificada.
- Solo los administradores publican versiones.
- El asistente de IA del pitch, que proponía repartir las tareas, se integró en el asistente de Acuerdos: es la única funcionalidad con IA.

### HU9.1 Crear y editar el reglamento
**Como** administrador **quiero** redactar el reglamento y publicar nuevas versiones **para** dejar por escrito los acuerdos.
- Solo los administradores publican versiones.
- El texto tiene al menos 10 caracteres y debe ser distinto del de la versión vigente.
- Las versiones se numeran sin repetirse, aunque dos administradores publiquen a la vez.

### HU9.2 Aceptación por integrante
**Como** integrante **quiero** aceptar la versión vigente **para** dejar constancia de que la leí.
- Cada integrante acepta la versión vigente una sola vez.
- Una versión nueva exige aceptar de nuevo, y las versiones antiguas no se pueden aceptar.
- Todos ven quién aceptó y quién falta. Quien publica la versión la acepta al publicarla, y los demás reciben un aviso.

### HU9.3 Versiones e historial de modificaciones
**Como** integrante **quiero** consultar las versiones anteriores **para** ver cómo cambiaron los acuerdos.
- Las versiones anteriores se conservan con su autor y su resumen de cambios.
- La versión vigente es siempre la más reciente.
- Las personas que no pertenecen al hogar no ven el reglamento.

### HU9.4 Reportar incumplimientos
**Como** integrante **quiero** reportar que no se cumplió un acuerdo **para** que el hogar lo resuelva.
- Se elige un acuerdo de la versión vigente y, opcionalmente, a quién se le atribuye. Se avisa a los administradores y a esa persona.
- No se puede reportar un acuerdo que no está en el reglamento, reportarse a sí mismo ni reportar en un hogar sin reglamento.
- Solo un administrador marca el reporte como resuelto, y quien lo hizo recibe un aviso.

### HU9.5 Asistente de acuerdos con IA simulada
**Como** administrador **quiero** pedirle ideas a un asistente **para** redactar acuerdos más rápido y repartir mejor las tareas.
- Ante "Somos cuatro y nadie cumple las tareas", propone una rotación semanal equitativa. Toma el número de personas del mensaje o, si no lo dice, los integrantes del hogar con sus nombres.
- Propone cláusulas por tema (limpieza, ruido, visitas…) y, si se le pide, revisa qué temas faltan en el borrador. Las cláusulas se agregan al borrador con un botón.
- Mientras "genera" muestra un spinner y un skeleton durante una espera simulada. La respuesta es un mock aislado en `src/lib/assistant.ts`, que en el ciclo 2 se reemplazará por un modelo real.
