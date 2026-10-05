# Configuración adicional

Los pasos para iniciar en local o con Docker están en el [README](../README.md).

## Base de datos y Docker

`npm run dev` inicia una base local en el puerto 54329 y guarda los datos en `.roomie-data/postgres`. Docker usa otra base, guardada en su propio volumen.

En Docker, `db` inicia PostgreSQL, `migrate` aplica los cambios de las tablas, `web` inicia la aplicación y `worker` revisa recordatorios y votaciones cada 15 segundos.

El equipo dejó registrada una prueba de Docker en Windows. Falta volver a comprobar la versión final antes de presentar. En la última revisión local no se pudo ejecutar Docker porque no estaba instalado.

Para usar una base externa con `npm run dev`, cambiar `LOCAL_DATABASE=false` y poner su dirección en `DATABASE_URL`. Para publicar la aplicación también hace falta configurar HTTPS y poner la dirección final en `APP_URL`.

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
