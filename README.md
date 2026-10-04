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
