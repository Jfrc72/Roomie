# Roomie

Aplicación para organizar apartamentos compartidos. Esta entrega contiene la base del proyecto: usuarios, apartamentos, integrantes, permisos, Inicio y notificaciones. También incluye gastos y pagos compartidos, listas colaborativas de compras, reportes de mantenimiento, tareas (tablero por estados, responsables, prioridades, fechas límite, historial y recordatorios), reservas (recursos compartidos, reservas sin cruces, cancelación y recordatorios), votaciones (públicas o anónimas, mayoría simple y cierre automático) y acuerdos (versiones del reglamento, aceptaciones y un asistente con IA simulada).

Hecha con Next.js, React, TypeScript y PostgreSQL. La API está en el mismo proyecto; los datos se guardan en la base de datos, no en el navegador.

## Ejecutar

Requiere Node.js 22 LTS y npm. También funciona con Node 20.20.2.

```bash
npm ci
npm run dev
```

Abrir http://localhost:3000. El primer arranque crea `.env`, inicia PostgreSQL local, aplica las migraciones y abre la aplicación. Detener con **Ctrl+C**: también cierra la base de datos. El puerto 54329 se usa para PostgreSQL.

Los datos locales se conservan en `.roomie-data/`. No subir esa carpeta ni `.env` a GitHub.

## Cuentas de prueba

Para crearlas, poner en `.env`:

```dotenv
SEED_DEMO=true
DEMO_PASSWORD=RoomieClase2026!
```

Reiniciar `npm run dev`. Cuentas: `juan@roomie.test` (administrador), `miguel@roomie.test` y `tomas@roomie.test` (integrantes), `visitante@roomie.test` (otro apartamento). Comparten la contraseña elegida. Son cuentas ficticias exclusivamente para desarrollo. El seed no cambia contraseñas de cuentas que ya existan.

También puedes registrar una cuenta nueva desde la aplicación.

## Usar con Docker

Alternativa a `npm run dev` que no necesita Node.js: levanta PostgreSQL, aplica las migraciones y arranca la aplicación y el worker en contenedores. Requiere [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto (o Docker Engine con Compose).

1. Crear `.env` desde la plantilla, si aún no existe:

   ```bash
   cp .env.example .env
   # En PowerShell: Copy-Item .env.example .env
   ```

2. En `.env`, lo único obligatorio para Docker es completar `POSTGRES_PASSWORD` (solo letras y números). `APP_URL` se deja como está:

   ```dotenv
   APP_URL=http://localhost:3000
   POSTGRES_PASSWORD=UnaClaveLargaSoloLetrasYNumeros
   ```

   **No cambies `LOCAL_DATABASE` ni `DATABASE_URL`.** Docker los ignora y usa su propia base; son de `npm run dev`. Con `LOCAL_DATABASE=false`, `npm run dev` deja de iniciar su base y la app no puede conectarse. El resto de variables son opcionales.

3. Cerrar `npm run dev` si está abierto (los dos usan el puerto 3000) y arrancar:

   ```bash
   docker compose up --build -d
   ```

4. Abrir http://localhost:3000. Usar `localhost`, no `127.0.0.1`: la API rechaza peticiones de un origen distinto de `APP_URL`.

La primera construcción tarda unos minutos. Comandos útiles:

| Para | Comando |
| --- | --- |
| Ver el estado (`web` pasa a `healthy` cuando responde) | `docker compose ps` |
| Ver los registros | `docker compose logs -f web worker` |
| Crear las cuentas de prueba (requiere `DEMO_PASSWORD` en `.env`) | `docker compose run --rm migrate node --import tsx scripts/seed.ts` |
| Aplicar cambios después de `git pull` (las migraciones nuevas se aplican solas) | `docker compose up --build -d` |
| Detener conservando los datos | `docker compose down` |
| Detener y borrar la base de datos | `docker compose down -v` |

La base de Docker es independiente de la de `npm run dev` (`.roomie-data/`): las cuentas y los datos no se comparten. PostgreSQL no publica su puerto fuera de Docker, así que `npm test` se ejecuta contra `npm run dev`, no contra Docker. No cambies `POSTGRES_PASSWORD` después del primer arranque: la base ya creada conserva la contraseña original; para empezar de cero usa `docker compose down -v`. HTTPS, correo y push en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm run build
# Pruebas unitarias: no necesitan servidor ni base de datos.
npm run test:unit
# Todas las pruebas (integración y unitarias), con npm run dev abierto en otra terminal:
npm test
```

Las pruebas de integración recorren la API real: sesiones, permisos, invitaciones, el límite de integrantes, notificaciones, gastos y pagos, compras, mantenimiento, tareas, reservas, votaciones y acuerdos. Crean datos temporales y los eliminan al terminar; ejecutarlas únicamente en desarrollo. Las unitarias (`tests/unit/`) prueban la lógica pura: estados de tareas, cálculo de resultados de votaciones, fechas del calendario y el asistente de IA simulada.

Las pruebas llevan en el nombre el identificador de la historia de usuario que cubren (por ejemplo `HU3.1.2`). Las historias de todas las funcionalidades, con sus criterios de aceptación y sus pruebas, están en [docs/HISTORIAS.md](docs/HISTORIAS.md) y en la [wiki del repositorio](https://github.com/Jfrc72/Roomie/wiki/Historias-de-usuario).

## Justificaciones técnicas

**Next.js (App Router), React y TypeScript en un solo proyecto.** La interfaz y la API viven juntas: la API es un único manejador (`src/app/api/[...path]/route.ts`) que centraliza el formato JSON, los errores y la comprobación de origen, y delega en un módulo por funcionalidad (`src/server/*-api.ts`). Así no hay CORS que configurar, frontend y backend comparten tipos (`src/types`) y se despliega una sola aplicación.

**PostgreSQL.** Los datos son relacionales (hogares, integrantes, cuotas de gastos, votos, aceptaciones) y varias reglas se garantizan en la propia base, no solo en el navegador:
- Claves foráneas y `CHECK` para estados y valores válidos.
- `UNIQUE` para impedir votos o aceptaciones duplicadas.
- Restricción `EXCLUDE` (extensión `btree_gist`) que impide reservas cruzadas del mismo recurso, incluso si llegan a la vez.
- Importes en `numeric(12,2)`, sin errores de coma flotante.

**SQL parametrizado con `pg`, sin ORM.** Permite controlar transacciones y bloqueos de filas (`FOR UPDATE` / `FOR SHARE`) donde hay concurrencia: altas de integrantes, numeración de versiones del reglamento, cierre de votaciones. Los parámetros `$1, $2…` evitan inyección SQL. Las migraciones son archivos SQL numerados (`db/`), aplicados en orden y una sola vez con un bloqueo consultivo.

**Seguridad.**
- Sesiones propias en la base de datos con cookie `HttpOnly` (sin tokens en `localStorage`), revocables al cerrar sesión o cambiar la contraseña.
- Contraseñas con `scrypt` y límite de intentos de login.
- Las escrituras exigen un `Origin` igual a `APP_URL` (protección CSRF).
- Los permisos (administrador o integrante, autor de cada registro) se comprueban siempre en el servidor con el hogar real del registro, nunca con datos enviados por el cliente.
- Todas las entradas de la API se validan con `zod` antes de tocar la base de datos.

**Worker separado.** Recordatorios, envíos por correo o push y el cierre automático de votaciones corren en `scripts/worker.ts`, fuera de las peticiones web. Los avisos se encolan en la base (`deliveries`) con reintentos, y cada uno tiene una clave única que evita duplicados.

**Estado en el cliente y hooks.** Un Context (`RoomieContext`) guarda solo la sesión, el hogar activo y los avisos temporales. Cada módulo tiene hooks propios en `src/hooks/` (`useGastos`, `useTasks`, `useReservations`, `usePolls`, `useRules`, `useRuleAssistant`…) que concentran la carga de datos, los filtros, las acciones contra la API y los estados de carga. Los componentes se ocupan solo de la presentación. `useUrlState` guarda en la URL los filtros y la semana del calendario: se conservan al recargar y al compartir el enlace, y "Atrás" vuelve a la semana anterior. Al cambiar de hogar se reinicia el estado de las páginas para no mostrar datos del anterior.

**Interfaz y accesibilidad.** CSS propio con variables (`src/app/globals.css`) y componentes reutilizables (`src/components/ui.tsx`), sin framework de UI, para mantener un diseño coherente y liviano. Incluye:
- Etiquetas en todos los campos y regiones `aria-live` para avisos y estados de carga.
- Foco visible, enlace "Saltar al contenido" y botones de al menos 44 px.
- Estados que no dependen solo del color y respeto de `prefers-reduced-motion`.
- El tablero de tareas se opera con botones, sin arrastrar.

**IA simulada.** El asistente de Acuerdos usa un mock aislado en `src/lib/assistant.ts` con la misma forma que tendría una llamada a un modelo real. En el ciclo 2 solo hay que reemplazar esa función.

**Docker.** Imagen en varias etapas con la salida `standalone` de Next.js, y Compose con servicios separados: base de datos, migraciones (se ejecutan antes de arrancar), web (con comprobación de salud) y worker.

**Pruebas.** `node:test` con pruebas de integración que recorren la API real contra PostgreSQL: permisos, validaciones y concurrencia. Cada prueba crea sus propios datos y los borra al terminar.

## Continuar en equipo

- [Distribución e integración](docs/EQUIPO.md)
- [API y ejemplo para nuevos módulos](docs/API.md)
- [Modelo de datos y reglas](docs/MODELO.md)
- [Docker, correo y push](docs/DESPLIEGUE.md)

Los gastos se dividen en cuotas exactas hasta centavos; los pagos entre integrantes ajustan balances bilaterales. Compras y mantenimiento admiten edición, filtros y eliminación reversible desde el aviso temporal de confirmación. Inicio muestra los saldos, compras pendientes y reportes urgentes.
