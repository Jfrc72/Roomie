# Ciclo 2

Conservamos las pantallas en Next.js y pasamos la API a NestJS, siguiendo el taller de arquitectura.

## Parte de Juan

- Registro, inicio y cierre de sesión, perfil, contraseña y cierre de cuenta.
- Apartamentos, invitaciones, integrantes y roles.
- Avisos, preferencias, recordatorios y resumen de Inicio.
- Conexión a PostgreSQL, permisos, validaciones, Swagger y pruebas.

Todo está en `backend/src/`. Cada módulo tiene controladores para las rutas, servicios para las reglas y repositorios para las consultas. Los DTO revisan las entradas y las clases de entidades describen los datos que guardamos. Seguimos usando `pg` y las tablas del ciclo 1 para conservar los datos.

El registro crea la cuenta y la sesión en una transacción. Las contraseñas usan scrypt y las sesiones una cookie HttpOnly. Se comprueba el acceso al hogar en el servidor. No se permite retirar al último administrador ni superar ocho integrantes, incluso con invitaciones aceptadas al mismo tiempo.

## Parte de Miguel

- Gastos y pagos, lista de compras, mantenimiento y votaciones, con sus pantallas, sus módulos de NestJS (`backend/src/expenses/`, `shopping/`, `maintenance/` y `polls/`), Swagger y pruebas.
- Cada módulo separa controlador, DTO, servicio, repository y reglas puras (`*.rules.ts`), e importa `DatabaseModule`, `AuthModule`, `AccessModule` y `ActivitiesModule` (Votaciones también `NotificationsModule`). Todos exportan su servicio: Inicio usa `summary()` de Gastos, Compras y Mantenimiento en vez de consultar sus tablas, y `JobsService` llama a `PollsService.closeExpired()` para cerrar las votaciones vencidas.
- Se conservaron las rutas, las respuestas, los mensajes de error y las tablas del ciclo 1, así que las pantallas casi no cambiaron. La única adición es `can_manage` en los reportes de mantenimiento, que deshabilita el selector de estado para quien el servidor rechazaría.
- Los importes se calculan en centavos, las operaciones que cambian saldos bloquean el apartamento y la fila afectada, y eliminar es un borrado lógico que se puede deshacer. Las justificaciones están en el [README](../README.md#decisiones-técnicas).
- `backend/src/common/` reúne lo compartido: dinero en centavos, permisos de edición, validadores de DTO y utilidades de Swagger.
- Pruebas: Jest por historia (servicios, reglas, DTO y rutas HTTP con los mismos pipes y filtros de `main.ts`) y la colección `postman/Roomie-Miguel.postman_collection.json`.

## Parte de Tomás

- Tareas: crear, asignar, editar, cambiar de estado, historial, recordatorios y eliminación.
- Reservas: recursos, reservas sin cruces, calendario por rango y cancelación.
- Acuerdos: versiones del reglamento, aceptaciones, reportes de incumplimiento y asistente con IA.

Están en `backend/src/tasks/`, `backend/src/reservations/` y `backend/src/rules/`, con la misma separación que `homes/`. Las rutas y respuestas no cambiaron, así que las pantallas siguen igual. El proxy de Next ya envía `tasks`, `resources`, `reservations` y `rules` a NestJS y se retiraron sus manejadores anteriores.

Las reglas que no dependen de la base están en archivos `*.rules.ts`. La interfaz usa la misma regla `canAdvance` que el servidor para mostrar los botones de estado. Inicio usa `TasksService.assignedSummary` y `ReservationsService.next` en lugar de consultar esas tablas.

El asistente usa el SDK oficial de Anthropic. `GET /rules/assistant` indica si hay IA real y `POST /rules/assistant` consulta a Claude con la petición, el borrador y los nombres del hogar, que NestJS toma de la base. La respuesta se pide como JSON con un esquema fijo y se revisa antes de mostrarla. Sin `ANTHROPIC_API_KEY`, la pantalla usa el asistente simulado del ciclo 1. Solo consultan los administradores, con un máximo de 10 consultas cada 10 minutos por persona, y los errores del proveedor se muestran sin detalles internos. El proxy espera hasta 60 segundos esta ruta; NestJS corta cada intento a los 25 y reintenta una vez.

Pruebas: 84 unitarias nuevas en `backend/test/`, la colección `postman/Roomie-Tomas.postman_collection.json` y las pruebas de integración y navegador que ya existían para estas historias.

## Para agregar un módulo

1. Crear el módulo dentro de `backend/src/` e importarlo en `app.module.ts`.
2. Separar controlador, DTO, servicio, repositorio y reglas puras (`*.rules.ts`). Se puede seguir el ejemplo de `homes/`, `expenses/` o `tasks/`.
3. Importar `AuthModule`, `AccessModule` y `DatabaseModule`. Usar `SessionGuard` y `HomeAccessService.requireHome(user.id, homeId)`; pasar `true` si la operación es solo de administrador.
4. Conservar las rutas y respuestas actuales para que funcionen las pantallas. El interceptor ya agrega `{data}`; los errores se lanzan con las excepciones de NestJS. `uuidPipe` y `requireHomeId` de `common/params.ts`, y `Trim`, `OmitOnly`, `Nullable` e `IsOffsetDateTime` de `common/validators.ts`, conservan los mensajes y formatos de la API anterior.
5. Para avisos, importar `NotificationsModule` y usar `notify`, `scheduleReminder` o `cancelReminder` dentro de la transacción que cambia los datos.
6. Añadir su prefijo en `nestRoutes` de `src/server/nest-proxy.ts`; `route.ts` responde 404 a los que no estén ahí.
7. Añadir casos unitarios en `backend/test/` con el código `HU#.#` en su nombre, documentar las rutas con Swagger y crear su colección de Postman. Probar también permisos, entradas inválidas y errores.

`DatabaseService.query(sql, valores, client?)` devuelve las filas. `DatabaseService.transaction(async client => ...)` confirma todo junto o lo revierte si falla. Las consultas siempre llevan parámetros.

Con los módulos de los tres en NestJS, Inicio reúne el resumen de Gastos, Compras, Mantenimiento, Tareas y Reservas y ya no consulta tablas propias, y JobsService llama a PollsService para cerrar las votaciones vencidas, como propusimos en el taller. `src/app/api/[...path]/route.ts` solo revisa el origen y reenvía a NestJS. JobsModule se inicia en el worker, separado de AppModule, para poder ejecutarlo como un servicio aparte en Docker.

## Clase del 9 de noviembre

- Ya tenemos AuthModule con credenciales en PostgreSQL, SessionGuard para autenticar, permisos por hogar y DTO con ValidationPipe.
- Falta adaptar AuthModule a JWT, con clave en el entorno, vencimiento y verificación en el guard, como indican los próximos pasos de la clase. Por ahora usamos un token aleatorio en una cookie HttpOnly y una sesión que vence en la base de datos. La rúbrica y el taller no pedían JWT expresamente; este cambio viene de las notas nuevas.
- El middleware de acceso con identificador por petición también queda pendiente. Fue el ejemplo de clase, no un requisito literal de la rúbrica. Debe usar Logger inyectado, sin guardar contraseñas ni tokens y sin consultar reglas de negocio.
- Redis es opcional. No necesitamos copiar la API key fija usada en el ejemplo de clase.

## Revisión antes de entregar

La aplicación conserva español/inglés, componentes separados, formatos compartidos y pruebas del ciclo 1. Los comandos y resultados del backend están en [PRUEBAS.md](PRUEBAS.md).

Antes de cerrar la parte de Juan hay que revisar los ajustes de autenticación de la clase nueva. Para la entrega del equipo falta reunir las retrospectivas y evidencias de los tres en la wiki. Docker ya fue comprobado con las partes de Juan y de Miguel; debemos volver a probarlo con los tres módulos juntos. El asistente ya puede usar Claude; falta probarlo con una clave real. El release `V2.0-Final` se crea al terminar la revisión y autorizar la publicación.

Lo que más debemos cuidar al integrar es mantener los permisos y las respuestas que ya usan las pantallas. Las pruebas de API y navegador ayudan a comprobarlo después de cada migración.

## Revisión individual de Juan

- Conservar las rutas y tablas anteriores permitió cambiar el backend sin rehacer las pantallas ni perder los datos.
- Separar la lógica de las consultas permitió probar permisos, invitaciones y avisos sin depender de una base de datos. Postman e integración comprobaron después las consultas reales.
- Las pruebas completas mostraron que conviene usar una base aparte y esperar los cambios de navegación antes de comprobar los filtros. Para la siguiente integración debemos ejecutar esas pruebas antes de unir las ramas.
