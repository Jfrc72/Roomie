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
# Con npm run dev abierto en otra terminal:
npm test
```

Las pruebas revisan sesiones, permisos, invitaciones, el límite de integrantes, notificaciones, tareas (permisos, estados, historial, recordatorios y resumen de Inicio), reservas (recursos, cruces simultáneos, cancelación y avisos), gastos/pagos, compras y mantenimiento, votaciones (permisos, anonimato, cambio de voto, recuento y cierre automático) y acuerdos (versiones, aceptaciones, publicaciones simultáneas y respuestas del asistente). Crean datos temporales y los eliminan al terminar; ejecutarlas únicamente en desarrollo.

## Continuar en equipo

- [Distribución e integración](docs/EQUIPO.md)
- [API y ejemplo para nuevos módulos](docs/API.md)
- [Modelo de datos y reglas](docs/MODELO.md)
- [Docker, correo y push](docs/DESPLIEGUE.md)

Los gastos se dividen en cuotas exactas hasta centavos; los pagos entre integrantes ajustan balances bilaterales. Compras y mantenimiento admiten edición, filtros y eliminación reversible desde el aviso temporal de confirmación. Inicio muestra los saldos, compras pendientes y reportes urgentes.
