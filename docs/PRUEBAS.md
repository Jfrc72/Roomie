# Pruebas

## Unitarias

- `npm run test:hu`: 176 pruebas del ciclo 1. Las 39 historias tienen al menos tres casos aprobados.
- `npm run test:coverage`: 161 pruebas de NestJS, sin servidor ni base de datos. Se comprueban los servicios, permisos, validaciones, contraseñas y recordatorios con repositorios simulados.

La medición del backend incluye todos sus servicios y reglas de negocio. Dio 99,71% en sentencias, 100% en líneas, 99,15% en ramas y 98,59% en funciones. El mínimo configurado es 65% en cada medida. El informe se genera en `backend/coverage/index.html`.

Esta cobertura corresponde a la parte migrada por Juan. Las consultas SQL y la conexión entre módulos se revisan con las pruebas de API; los módulos que migren Miguel y Tomás deben agregar sus propias unitarias.

## API y Postman

Dejar `npm run dev` abierto y ejecutar en otra terminal:

```bash
npm run test:integration
npm run test:postman
```

Pasaron las 98 pruebas de integración y las 68 solicitudes de Postman, con 150 comprobaciones. Revisan respuestas válidas, entradas incorrectas, permisos, cupo del hogar, último administrador, sesiones, invitaciones y avisos propios.

La colección está en `postman/Roomie-Juan.postman_collection.json`. Al importarla en Postman, las variables `baseUrl` y `origin` apuntan a `http://localhost:3000/api` y `http://localhost:3000`. Si cambia el puerto, cambiar ambas. Ejecutar la colección completa y en orden: crea sus cuentas de prueba, guarda sus datos en variables y cierra esas cuentas al terminar. No habilita correos ni push.

Para guardar un resultado de Newman: `npm run test:postman -- --reporters cli,json --reporter-json-export .test-output/postman-juan.json`.

## Navegador

`npm run test:e2e` revisa las pantallas con Playwright. Inicia la aplicación si no está abierta y necesita Google Chrome. El informe se abre con `npx playwright show-report`.

Pasaron los 8 recorridos contra la versión compilada para producción. Las 98 pruebas de integración, las 68 solicitudes de Postman y los 8 recorridos también pasaron con Docker. Incluyen cuentas, hogar, perfil, preferencias, invitaciones, roles, avisos, acuerdos, reservas, filtros, español/inglés, teclado y pantallas de 1280, 768 y 320 px. También se comprueba accesibilidad en las pantallas recorridas.

Integración y E2E crean datos temporales y los borran al terminar. Postman archiva su hogar y cierra sus cuentas de prueba, conservando ese historial. No se deben ejecutar contra una base de datos de uso real. Correo y push se prueban con simulaciones; falta verificarlos con un proveedor configurado.

## En GitHub

[GitHub Actions](https://github.com/Jfrc72/Roomie/actions/workflows/pruebas.yml) está preparado para revisar lint, tipos, unitarias, cobertura y compilación. Después inicia Docker y ejecuta integración, Postman y navegador. Guarda los informes y registros como archivos del resultado. Estos cambios todavía no se han publicado ni ejecutado en Actions.

Para comprobar una aplicación ya iniciada, usar `E2E_EXTERNAL_SERVER=true`. `APP_URL` debe indicar su dirección y `DATABASE_URL` su base de pruebas.
