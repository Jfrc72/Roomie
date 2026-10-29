# Roomie

Proyecto para organizar la convivencia en un apartamento: gastos, tareas, compras, reservas, mantenimiento, votaciones y acuerdos. También permite manejar integrantes y recibir avisos.

Usamos Next.js, React, TypeScript y PostgreSQL.

[Prototipo en Figma](https://www.figma.com/proto/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=45-11&starting-point-node-id=45%3A11) · [Historias en la wiki](https://github.com/Jfrc72/Roomie/wiki/Historias-de-usuario)

## Ejecutar en local

Requiere Node.js 22 y npm.

```bash
npm ci
npm run dev
```

Abrir http://localhost:3000. El primer inicio crea `.env`, prepara la base de datos y aplica las migraciones. Ctrl+C detiene la aplicación y la base. Los datos quedan en `.roomie-data/`; esa carpeta y `.env` no se suben a GitHub.

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
| Ver errores                  | `docker compose logs -f web worker` |
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
```

`test:hu` ejecuta las 175 unitarias y revisa que cada una de las 39 historias tenga al menos tres aprobadas. No necesita servidor. También se pueden ejecutar con `npm test`.

Para las pruebas de la API, dejar `npm run dev` abierto y ejecutar `npm run test:integration` en otra terminal.

Para los recorridos de navegador:

```bash
npm run test:e2e
```

Este comando inicia y detiene la aplicación si no está abierta. Al terminar, `npx playwright show-report` abre el informe.

Las pruebas de API y navegador usan datos temporales y los borran al terminar; se ejecutan en desarrollo. Las E2E necesitan Google Chrome. Si no está instalado: `npx playwright install chromium` y `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.

Al subir cambios o abrir un pull request, GitHub Actions revisa lint, tipos, unitarias y compilación. También inicia Docker y ejecuta las pruebas de API y navegador con datos temporales. [Más sobre las pruebas](docs/PRUEBAS.md).

## Decisiones técnicas

- **Next.js, React y TypeScript:** para tener las páginas y la API en el mismo proyecto y detectar errores de tipos.
- **PostgreSQL:** para guardar la relación entre apartamentos, integrantes y sus registros. Las consultas usan parámetros y las migraciones están en `db/`.
- **Sesiones y permisos:** usamos cookies y contraseñas guardadas con hash. El servidor comprueba quién puede ver o modificar cada registro.
- **Hooks y componentes compartidos:** para reutilizar formularios, carga de datos, filtros y navegación.
- **Diseño:** CSS compartido, selector español/inglés, campos con etiquetas y navegación con teclado.
- **Worker:** proceso aparte para los recordatorios y el cierre de votaciones. Docker inicia la base, las migraciones, la aplicación y este proceso.
- **Pruebas:** Vitest para unitarias, `node:test` para la API con base de datos y Playwright para recorridos en el navegador.
- **Asistente de acuerdos:** por ahora responde con ejemplos simulados y muestra un estado de carga. La conexión con una IA real queda para el ciclo 2.

## Documentación

- [Historias y pruebas](docs/HISTORIAS.md)
- [Diseño y prototipos](docs/DISENO.md)
- [Reparto del trabajo](docs/EQUIPO.md)
- [Rutas de la API](docs/API.md)
- [Base de datos](docs/MODELO.md)
- [Correo, push y despliegue](docs/DESPLIEGUE.md)
- [Revisión de la entrega](docs/REVISION-CICLO-1.md)
