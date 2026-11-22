# Ciclo 2

Conservamos las pantallas en Next.js y pasamos la API a NestJS, siguiendo el taller de arquitectura.

## Parte de Juan

- Registro, inicio y cierre de sesión, perfil, contraseña y cierre de cuenta.
- Apartamentos, invitaciones, integrantes y roles.
- Avisos, preferencias, recordatorios y resumen de Inicio.
- Conexión a PostgreSQL, permisos, validaciones, Swagger y pruebas.

Todo está en `backend/src/`. Cada módulo tiene controladores para las rutas, servicios para las reglas y repositorios para las consultas. Los DTO revisan las entradas y las clases de entidades describen los datos que guardamos. Seguimos usando `pg` y las tablas del ciclo 1 para conservar los datos.

El registro crea la cuenta y la sesión en una transacción. Las contraseñas usan scrypt y las sesiones una cookie HttpOnly. Se comprueba el acceso al hogar en el servidor. No se permite retirar al último administrador ni superar ocho integrantes, incluso con invitaciones aceptadas al mismo tiempo.

## Parte de Tomás

- Tareas: crear, asignar, editar, cambiar de estado, historial, recordatorios y eliminación.
- Reservas: recursos, reservas sin cruces, calendario por rango y cancelación.
- Acuerdos: versiones del reglamento, aceptaciones, reportes de incumplimiento y asistente con IA.

Están en `backend/src/tasks/`, `backend/src/reservations/` y `backend/src/rules/`, con la misma separación que `homes/`. Las rutas y respuestas no cambiaron, así que las pantallas siguen igual. El proxy de Next ya envía `tasks`, `resources`, `reservations` y `rules` a NestJS y se retiraron sus manejadores anteriores.

Las reglas que no dependen de la base están en archivos `*.rules.ts`. La interfaz usa la misma regla `canAdvance` que el servidor para mostrar los botones de estado. Inicio ya usa `TasksService.assignedSummary` y `ReservationsService.next` en lugar de consultar esas tablas.

El asistente usa el SDK oficial de Anthropic. `GET /rules/assistant` indica si hay IA real y `POST /rules/assistant` consulta a Claude con la petición, el borrador y los nombres del hogar, que NestJS toma de la base. La respuesta se pide como JSON con un esquema fijo y se revisa antes de mostrarla. Sin `ANTHROPIC_API_KEY`, la pantalla usa el asistente simulado del ciclo 1. Solo consultan los administradores, con un máximo de 10 consultas cada 10 minutos por persona, y los errores del proveedor se muestran sin detalles internos. El proxy espera hasta 60 segundos esta ruta; NestJS corta cada intento a los 25 y reintenta una vez.

Pruebas: 84 unitarias nuevas en `backend/test/`, la colección `postman/Roomie-Tomas.postman_collection.json` y las pruebas de integración y navegador que ya existían para estas historias. `npm run test:hu` ahora suma también las unitarias de Jest.

## Para Miguel

1. Crear su módulo dentro de `backend/src/` e importarlo en `app.module.ts`.
2. Separar controlador, DTO, servicio y repositorio. Puede seguir el ejemplo de `homes/` o `tasks/`.
3. Importar `AuthModule`, `AccessModule` y `DatabaseModule`. Usar `SessionGuard` y `HomeAccessService.requireHome(user.id, homeId)`; pasar `true` si la operación es solo de administrador.
4. Conservar las rutas y respuestas actuales para que funcionen las pantallas. El interceptor ya agrega `{data}`; los errores se lanzan con las excepciones de NestJS. `HomeIdPipe`, `idPipe`, `Trim` e `IsDateTime` de `common/validation.ts` conservan los mensajes y formatos de la API anterior.
5. Para avisos, importar `NotificationsModule` y usar `notify`, `scheduleReminder` o `cancelReminder` dentro de la transacción que cambia los datos.
6. Añadir su prefijo en `nestRoutes` de `src/server/nest-proxy.ts` cuando el módulo esté listo. Después retirar su manejador anterior de `src/app/api/[...path]/route.ts`.
7. Añadir casos unitarios en `backend/test/`, documentar las rutas con Swagger y ampliar la colección de Postman. Probar también permisos, entradas inválidas y errores.

`DatabaseService.query(sql, valores, client?)` devuelve las filas. `DatabaseService.transaction(async client => ...)` confirma todo junto o lo revierte si falla. Las consultas siempre llevan parámetros.

Mientras se completa la migración, los módulos anteriores comparten las mismas tablas y cookies. Inicio ya usa los servicios de resumen de tareas y reservas; los de gastos, compras y mantenimiento siguen consultando sus tablas. El worker conserva el cierre de votaciones anterior. Cuando esté el módulo de Miguel, Dashboard deberá usar sus servicios de resumen y JobsService deberá llamar a PollsService, como propusimos en el taller. JobsModule se inicia en el worker, separado de AppModule, para poder ejecutarlo como un servicio aparte en Docker.

## Clase del 9 de noviembre

- Ya tenemos AuthModule con credenciales en PostgreSQL, SessionGuard para autenticar, permisos por hogar y DTO con ValidationPipe.
- Falta adaptar AuthModule a JWT, con clave en el entorno, vencimiento y verificación en el guard, como indican los próximos pasos de la clase. Por ahora usamos un token aleatorio en una cookie HttpOnly y una sesión que vence en la base de datos. La rúbrica y el taller no pedían JWT expresamente; este cambio viene de las notas nuevas.
- El middleware de acceso con identificador por petición también queda pendiente. Fue el ejemplo de clase, no un requisito literal de la rúbrica. Debe usar Logger inyectado, sin guardar contraseñas ni tokens y sin consultar reglas de negocio.
- Redis es opcional. No necesitamos copiar la API key fija usada en el ejemplo de clase.

## Revisión antes de entregar

La aplicación conserva español/inglés, componentes separados, formatos compartidos y pruebas del ciclo 1. Los comandos y resultados del backend están en [PRUEBAS.md](PRUEBAS.md).

Antes de cerrar la parte de Juan hay que revisar los ajustes de autenticación de la clase nueva. Para la entrega del equipo también falta el módulo de Miguel y reunir las retrospectivas y evidencias de los tres en la wiki. Docker ya fue comprobado con la parte actual de Juan; debemos volver a probarlo después de integrar cambios. El asistente ya puede usar Claude; falta probarlo con una clave real. El release `V2.0-Final` se crea al terminar la revisión y autorizar la publicación.

Lo que más debemos cuidar al integrar es mantener los permisos y las respuestas que ya usan las pantallas. Las pruebas de API y navegador ayudan a comprobarlo después de cada migración.

## Revisión individual de Juan

- Conservar las rutas y tablas anteriores permitió cambiar el backend sin rehacer las pantallas ni perder los datos.
- Separar la lógica de las consultas permitió probar permisos, invitaciones y avisos sin depender de una base de datos. Postman e integración comprobaron después las consultas reales.
- Las pruebas completas mostraron que conviene usar una base aparte y esperar los cambios de navegación antes de comprobar los filtros. Para la siguiente integración debemos ejecutar esas pruebas antes de unir las ramas.
