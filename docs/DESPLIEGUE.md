# Configuración adicional

Los pasos para iniciar en local o con Docker están en el [README](../README.md).

## Base de datos y Docker

`npm run dev` inicia una base local en el puerto 54329 y guarda los datos en `.roomie-data/postgres`. Docker usa otra base, guardada en su propio volumen.

En Docker, `db` inicia PostgreSQL, `migrate` aplica los cambios de las tablas, `api` inicia NestJS, `web` inicia las pantallas y `worker` revisa recordatorios y votaciones cada 15 segundos. La API usa el puerto interno 3001 y solo se accede a ella desde `web`.

Se comprobó el arranque completo con Docker y Node.js 22. Las migraciones terminaron correctamente y pasaron las pruebas de integración, Postman y navegador contra esos contenedores.

Para usar una base externa con `npm run dev`, cambiar `LOCAL_DATABASE=false` y poner su dirección en `DATABASE_URL`. Para publicar la aplicación también hace falta configurar HTTPS y poner la dirección final en `APP_URL`.

## Asistente con IA

1. Crear una clave en la consola de Anthropic (platform.claude.com) y guardarla en `ANTHROPIC_API_KEY` dentro de `.env`.
2. Opcional: cambiar el modelo con `ANTHROPIC_MODEL`. Por defecto es `claude-opus-5-5`.
3. Reiniciar la aplicación. Con Docker basta `docker compose up -d`, porque `api` lee `.env` al iniciar.

En Acuerdos, la etiqueta del asistente pasa de «IA simulada» a «IA con Claude». Para volver al asistente simulado, dejar la variable vacía y reiniciar. Cada consulta tiene costo; la API limita a 10 consultas cada 10 minutos por persona y solo permite consultar a los administradores.

## Correo

Completar las variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` en `.env`, y reiniciar la aplicación y el worker.

Los avisos por correo se habilitan desde Notificaciones. Las invitaciones se comparten copiando el enlace. Las cuentas `@roomie.test` son ejemplos, no buzones reales.

## Notificaciones push

1. Generar claves con `npx web-push generate-vapid-keys`.
2. Guardar la pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, la privada en `VAPID_PRIVATE_KEY` y un contacto `mailto:...` en `VAPID_SUBJECT`.
3. Reiniciar la aplicación. Si se usa Docker, volver a construir la imagen.
4. En Notificaciones, registrar el dispositivo, aceptar el permiso y activar Push.

Se necesita un navegador compatible y HTTPS o localhost. Las claves y contraseñas se guardan en `.env`, fuera de GitHub.

Correo y push tienen código y configuración, pero todavía falta probarlos con un proveedor real. Los avisos dentro de la aplicación funcionan sin estos servicios.
