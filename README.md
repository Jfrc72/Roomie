# Roomie

Proyecto para organizar la convivencia en un apartamento: gastos, tareas, compras, reservas, mantenimiento, votaciones y acuerdos. También permite manejar integrantes y recibir avisos.

Usamos Next.js y React para las pantallas, NestJS para el backend del ciclo 2, TypeScript y PostgreSQL.

Las partes de Juan (cuentas, apartamentos, integrantes y avisos) y de Miguel (gastos y pagos, compras, mantenimiento y votaciones) ya usan NestJS. Los módulos de Tomás conservan su API anterior mientras él hace la migración. [Estado y pasos para continuar](docs/CICLO-2.md).

Con las notas de la clase del 9 de noviembre queda pendiente adaptar la autenticación a JWT. La versión actual usa sesiones en PostgreSQL y cookies HttpOnly.

[Prototipo en Figma](https://www.figma.com/proto/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=45-11&starting-point-node-id=45%3A11) · [Historias en la wiki](https://github.com/Jfrc72/Roomie/wiki/Historias-de-usuario)

## Ejecutar en local

Requiere Node.js 22 y npm.

```bash
npm ci
npm run dev
```

Abrir http://localhost:3000. El comando inicia la base, NestJS, las pantallas y los recordatorios. El primer inicio crea `.env` y aplica las migraciones. Ctrl+C detiene todo. Los datos quedan en `.roomie-data/`; esa carpeta y `.env` no se suben a GitHub.

Swagger está en http://localhost:3000/api/docs/. Para probar operaciones privadas, iniciar sesión en la aplicación desde ese mismo navegador. Las rutas mantienen el prefijo `/api`.

Si los puertos 3000 o 3001 están ocupados, cambiar en `.env`: `APP_URL=http://localhost:3018`, `API_PORT=3019` y `API_INTERNAL_URL=http://127.0.0.1:3019`. En ese caso se abre la aplicación por el puerto 3018.

Puedes registrar una cuenta desde la aplicación. Para usar las cuentas de ejemplo, poner en `.env` y reiniciar:

```dotenv
SEED_DEMO=true
DEMO_PASSWORD=RoomieClase2026!
```

Cuentas: `juan@roomie.test`, `miguel@roomie.test`, `tomas@roomie.test` y `visitante@roomie.test`. Comparten esa contraseña; Juan es administrador y Visitante pertenece a otro apartamento. Esta opción no cambia contraseñas de cuentas que ya existan.

## Ejecutar con Docker

Requiere Docker con Compose. Si usas Docker Desktop, debe estar abierto.

En macOS también se puede usar Colima: iniciar `colima start` antes de ejecutar los comandos. Si el equipo usa el comando `docker-compose`, sirve en lugar de `docker compose`.

1. Copiar `.env.example` a `.env` si aún no existe: `cp .env.example .env`.
2. Completar `POSTGRES_PASSWORD` con una contraseña propia, larga y solo con letras y números. Mantener `APP_URL=http://localhost:3000`. No hace falta cambiar `LOCAL_DATABASE` ni `DATABASE_URL` para Docker.
3. Cerrar `npm run dev` si está abierto y ejecutar:

```bash
docker compose up --build -d
```

Abrir http://localhost:3000. Usar esa dirección, porque debe coincidir con `APP_URL`.

| Acción                       | Comando                             |
| ---------------------------- | ----------------------------------- |
| Ver estado                   | `docker compose ps`                 |
| Ver errores                  | `docker compose logs -f api web worker` |
| Aplicar cambios del proyecto | `docker compose up --build -d`      |
| Detener conservando datos    | `docker compose down`               |

Docker tiene su propia base de datos. No cambies `POSTGRES_PASSWORD` después de crearla. `docker compose down -v` permite empezar de cero, pero **borra los datos de Docker**.

Para crear las cuentas de ejemplo en Docker, completar `DEMO_PASSWORD` y ejecutar `docker compose run --rm migrate node --import tsx scripts/seed.ts`.

Si el puerto 3000 está ocupado, cambiar `APP_PORT=3018` y `APP_URL=http://localhost:3018` en `.env` antes de iniciar Docker.

## Pruebas

```bash
npm run lint
npm run typecheck
npm run build
npm run test:hu
npm run test:coverage
```

`test:hu` ejecuta las 137 unitarias de Vitest y las 490 de Jest (NestJS) y revisa que cada una de las 39 historias tenga al menos tres aprobadas. `test:coverage` ejecuta las 490 unitarias del backend y exige mínimo 65% de cobertura (hoy 99,9%). Ninguna necesita servidor ni base de datos.

Para las pruebas de la API, dejar `npm run dev` abierto y ejecutar `npm run test:integration` en otra terminal.

Hay dos colecciones de Postman en `postman/`: `Roomie-Juan.postman_collection.json` (cuentas, apartamentos, integrantes y avisos) y `Roomie-Miguel.postman_collection.json` (gastos y pagos, compras, mantenimiento y votaciones). Se pueden importar en Postman o ejecutar con `npm run test:postman` y `npm run test:postman:miguel`; prueban las rutas migradas, sus permisos y sus validaciones. Como la sesión va en una cookie `HttpOnly`, no hay variable `token`: el almacén de cookies de Postman/Newman hace ese papel, y `apartmentId` guarda el apartamento de prueba.

Para los recorridos de navegador:

```bash
npm run test:e2e
```

Este comando inicia y detiene la aplicación si no está abierta. Al terminar, `npx playwright show-report` abre el informe.

Integración y E2E usan datos temporales y los borran al terminar; se ejecutan con una base de pruebas. Postman archiva su hogar y cierra sus cuentas. Las E2E necesitan Google Chrome. Si no está instalado: `npx playwright install chromium` y `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.

Al subir cambios o abrir un pull request, GitHub Actions revisa lint, tipos, unitarias y compilación. También inicia Docker y ejecuta las pruebas de API y navegador con datos temporales. [Más sobre las pruebas](docs/PRUEBAS.md).

## Decisiones técnicas

- **Next.js, React y NestJS:** las pantallas siguen en Next.js. En NestJS separamos rutas, validaciones, lógica y consultas en módulos pequeños.
- **PostgreSQL:** para guardar la relación entre apartamentos, integrantes y sus registros. Las consultas usan parámetros y las migraciones están en `db/`.
- **`pg` y repositories, sin ORM:** NestJS consulta PostgreSQL con `pg`, consultas parametrizadas y una clase de entidad por tabla (`*.entity.ts`). No usamos TypeORM ni Prisma porque las tablas y migraciones de `db/` ya existían y el resto del backend usa este mismo estilo: así hay una sola forma de acceder a los datos, cada consulta se ve completa (`FOR UPDATE`, `unnest`, agregaciones) y las transacciones son explícitas con `DatabaseService.transaction`.
- **Gastos, compras, mantenimiento y votaciones:** cada módulo separa controlador (rutas y Swagger), DTO (validación con `class-validator`), servicio (reglas), repository (SQL) y reglas puras (`*.rules.ts`, sin dependencias, fáciles de probar). Los controladores no calculan ni consultan.
- **Dinero en centavos:** los importes se guardan como `numeric(12,2)` y se calculan en centavos enteros, nunca con decimales de coma flotante. Un gasto se reparte en cuotas que suman exactamente su total; los centavos sobrantes los asume quien pagó. Los montos con más de dos decimales se rechazan.
- **Concurrencia:** las operaciones que cambian saldos o cupos bloquean el apartamento y la fila afectada (`FOR UPDATE`, siempre en el mismo orden). Así dos pagos, ediciones o cierres simultáneos no se pisan, y ningún voto entra después del recuento.
- **Borrado lógico y deshacer:** gastos, productos y reportes se eliminan con `deleted_at` y se restauran con `POST /.../restore`, que es lo que usa el botón "Deshacer" de la interfaz.
- **Sesiones y permisos:** usamos cookies y contraseñas guardadas con hash. El servidor comprueba quién puede ver o modificar cada registro: `SessionGuard` identifica a la persona y `HomeAccessService` comprueba su pertenencia y su rol en el apartamento del registro.
- **Hooks y componentes compartidos:** para reutilizar formularios, carga de datos, filtros y navegación.
- **Diseño:** CSS compartido, selector español/inglés, campos con etiquetas y navegación con teclado.
- **Worker:** proceso aparte para recordatorios, entregas y cierre automático de votaciones vencidas; es el `JobsService` de NestJS ejecutado cada 15 segundos. Docker inicia la base, las migraciones, la API NestJS, las pantallas y este proceso.
- **Pruebas:** Jest para los servicios de NestJS, Vitest para la parte anterior, Postman y `node:test` para la API, y Playwright para el navegador.
- **Asistente de acuerdos:** por ahora responde con ejemplos simulados. Tomás tiene pendiente la conexión con una IA real para el bono.

## Documentación

- [Avance del ciclo 2 y guía para el equipo](docs/CICLO-2.md)
- [Historias y pruebas](docs/HISTORIAS.md)
- [Diseño y prototipos](docs/DISENO.md)
- [Reparto del trabajo](docs/EQUIPO.md)
- [Rutas de la API](docs/API.md)
- [Base de datos](docs/MODELO.md)
- [Correo, push y despliegue](docs/DESPLIEGUE.md)
- [Revisión de la entrega](docs/REVISION-CICLO-1.md)
