# Entornos y servicios

## Local sin Docker

`npm run dev` inicia PostgreSQL mediante `embedded-postgres`, aplica migraciones, opcionalmente ejecuta seed y arranca Next junto al worker. Todo vive dentro del proyecto. Requiere descargar dependencias la primera vez; no requiere una instalación global de PostgreSQL.

- Aplicación: `APP_URL`, inicialmente http://localhost:3000.
- Base: `DATABASE_URL`, inicialmente puerto 54329.
- Persistencia: `.roomie-data/postgres`, excluida de Git.
- Ctrl+C cierra los procesos iniciados por el comando.
- Si un puerto está ocupado, el arranque se detiene y lo informa; no mata procesos ajenos.

Para una base externa: `LOCAL_DATABASE=false` y una URL PostgreSQL propia. No cambiar de versión mayor de PostgreSQL sobre una carpeta de datos existente sin hacer la migración correspondiente.

## Docker

Requiere Docker con Compose. Probado con Docker Desktop 28.4 (Compose 2.39) en Windows: construcción, migraciones, aplicación, worker (incluido el cierre automático de votaciones), cuentas de prueba y reinicio conservando los datos. Los pasos rápidos están en el README ("Usar con Docker").

1. Copiar `.env.example` a `.env` si aún no existe.
2. Completar `POSTGRES_PASSWORD` con una contraseña alfanumérica larga y propia; esta configuración usa el mismo valor en PostgreSQL y en su URL de conexión, por lo que no admite caracteres reservados de URL. Solo se aplica al crear el volumen: cambiarla después exige `docker compose down -v`.
3. Ajustar `APP_URL` a la dirección real de acceso. Con HTTPS las cookies pasan a ser Secure.
4. Ejecutar:

```bash
docker compose up --build -d
```

Servicios: `db` guarda datos en un volumen; `migrate` aplica SQL antes de iniciar y termina; `web` sirve la aplicación; `worker` procesa avisos y cierra votaciones vencidas. `db`, `web` y `worker` se reinician solos (`restart: unless-stopped`); `web` tiene una comprobación de salud sobre `/api/health`. `web` y `worker` usan `init: true` para detenerse limpiamente con `docker compose stop`. PostgreSQL no publica su puerto hacia fuera del conjunto de contenedores.

```bash
docker compose logs -f web worker
docker compose down
```

No usar `down -v` si se quieren conservar los datos. El seed no se ejecuta automáticamente en Docker. Para una demostración deliberada, configurar `DEMO_PASSWORD` y ejecutar `docker compose run --rm migrate node --import tsx scripts/seed.ts`.

El despliegue público no está realizado. El contenedor web necesita un proxy con HTTPS y el dominio final configurado en `APP_URL`.

## Email

Completar `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` con un proveedor propio. Reiniciar aplicación y worker. Las credenciales nunca van al frontend ni a Git.

Las preferencias solo permiten activar email si hay un host y un remitente configurados. Los mensajes generados por `notify` entran en `deliveries`; el worker entrega los elegidos por el usuario, reintenta hasta cinco veces y guarda el error. El envío es texto plano.

Las invitaciones se comparten manualmente mediante enlace; la interfaz lo explica. No se simula un email enviado. Los correos de prueba `@roomie.test` no son buzones reales.

## Push

1. Generar el par VAPID con `npx web-push generate-vapid-keys`.
2. Copiar la clave pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, la privada en `VAPID_PRIVATE_KEY` y un contacto válido `mailto:...` en `VAPID_SUBJECT`.
3. Reiniciar; en producción, reconstruir la imagen porque la clave pública forma parte del frontend.
4. En Notificaciones, registrar el dispositivo, conceder permiso, activar Push y guardar.

Requiere navegador compatible y contexto seguro (HTTPS o localhost). Se admiten endpoints de los proveedores de Chrome, Firefox y Safari. El service worker abre únicamente rutas internas.

Los adaptadores de email y push están implementados, pero no se han probado con proveedores externos porque no se proporcionaron credenciales ni claves. Tampoco se ha enviado ningún mensaje externo durante el desarrollo.

## Recordatorios

El worker consulta cada 15 segundos los registros cuyo vencimiento menos la anticipación configurada ya llegó. Cada aviso tiene una clave única. Los módulos deben programar o cancelar sus recordatorios dentro de sus transacciones; no se crean automáticamente a partir de tablas aún inexistentes. En cada ciclo también cierra las votaciones cuya fecha de cierre ya pasó y avisa del resultado.

No se promete entrega exactamente una vez de email/push: una interrupción justo después de que el proveedor reciba el mensaje puede provocar un reintento. La bandeja interna sí evita duplicados por `source_key`.
