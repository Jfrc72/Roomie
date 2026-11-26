# Pruebas

## Unitarias

- `npm run test:hu`: 137 pruebas de Vitest (pantallas y módulos que siguen en Next.js) y 490 de Jest (NestJS). Las 39 historias tienen al menos tres casos aprobados; cada prueba cuenta para la historia cuyo código `HU#.#` aparece en su nombre.
- `npm run test:coverage`: 490 pruebas de NestJS, sin servidor ni base de datos. Se comprueban los servicios, reglas, validaciones de DTO, rutas HTTP, permisos, contraseñas y recordatorios con repositorios simulados.

La medición del backend incluye todos sus servicios y reglas de negocio. Dio 99,86% en sentencias, 100% en líneas, 99,63% en ramas y 99,39% en funciones. El mínimo configurado es 65% en cada medida. El informe se genera en `backend/coverage/index.html`.

Los módulos de Miguel (gastos y pagos, compras, mantenimiento y votaciones) tienen cuatro tipos de prueba: de servicio por historia (permisos, validaciones, transacciones y avisos con el repository simulado), de reglas puras (reparto en centavos, saldos, quién compró, resultado de una votación), de validación de DTO y de rutas HTTP. Estas últimas levantan los controladores reales con los mismos pipes, filtro de errores e interceptor de `main.ts` y simulan solo la sesión y los servicios, así que comprueban códigos de estado, el formato `{data}` o `{error}` y que una entrada inválida nunca llegue al servicio. Las consultas SQL y la conexión entre módulos se revisan con las pruebas de API; el módulo que migre Tomás debe agregar sus propias unitarias.

## API y Postman

Dejar `npm run dev` abierto y ejecutar en otra terminal:

```bash
npm run test:integration
npm run test:postman
```

Pasaron las 98 pruebas de integración, las 68 solicitudes de Postman de Juan (150 comprobaciones) y las 217 de la colección de Miguel (565 comprobaciones). Revisan respuestas válidas, entradas incorrectas, permisos, cupo del hogar, último administrador, sesiones, invitaciones, avisos propios, reparto de gastos, abonos, deshacer eliminaciones y votaciones.

La colección está en `postman/Roomie-Juan.postman_collection.json`. Al importarla en Postman, las variables `baseUrl` y `origin` apuntan a `http://localhost:3000/api` y `http://localhost:3000`. Si cambia el puerto, cambiar ambas. Ejecutar la colección completa y en orden: crea sus cuentas de prueba, guarda sus datos en variables y cierra esas cuentas al terminar. No habilita correos ni push.

Para guardar un resultado de Newman: `npm run test:postman -- --reporters cli,json --reporter-json-export .test-output/postman-juan.json`.

La colección de Miguel está en `postman/Roomie-Miguel.postman_collection.json` y se ejecuta con `npm run test:postman:miguel`. Usa las mismas variables `baseUrl` y `origin`; no tiene variable `token` porque la sesión va en una cookie `HttpOnly` que guarda el propio Postman, y `apartmentId` guarda el apartamento de prueba. Ejecutarla completa y en orden. Sus carpetas son: 00 seguridad sin sesión, 01 preparación (tres cuentas y un hogar propios con correos únicos), 02 gastos y pagos, 03 lista de compras, 04 mantenimiento, 05 votaciones, 06 documentación OpenAPI y 07 limpieza (archiva el hogar y cierra las cuentas). Cada solicitud comprueba el código HTTP y la forma `{data}` o `{error}`, y las de lectura verifican los valores (cuotas que suman el total, saldos, contadores, quién compró, recuentos ocultos mientras la votación está abierta, anonimato).

Antes de migrar, esta colección se ejecutó contra la implementación anterior en Next.js: pasó todo salvo los casos que dependen del contrato nuevo (campos opcionales y documentación OpenAPI). Eso comprobó que NestJS conserva el comportamiento que ya usaban las pantallas.

## Navegador

`npm run test:e2e` revisa las pantallas con Playwright. Inicia la aplicación si no está abierta y necesita Google Chrome. El informe se abre con `npx playwright show-report`.

Pasaron los 8 recorridos contra la versión compilada para producción. Las 98 pruebas de integración, las dos colecciones de Postman (68 y 217 solicitudes) y los 8 recorridos también pasaron con Docker. Incluyen cuentas, hogar, perfil, preferencias, invitaciones, roles, avisos, acuerdos, reservas, filtros, español/inglés, teclado y pantallas de 1280, 768 y 320 px. También se comprueba accesibilidad en las pantallas recorridas.

Integración y E2E crean datos temporales y los borran al terminar. Postman archiva su hogar y cierra sus cuentas de prueba, conservando ese historial. No se deben ejecutar contra una base de datos de uso real. Correo y push se prueban con simulaciones; falta verificarlos con un proveedor configurado.

## En GitHub

[GitHub Actions](https://github.com/Jfrc72/Roomie/actions/workflows/pruebas.yml) está preparado para revisar lint, tipos, unitarias, cobertura y compilación. Después inicia Docker y ejecuta integración, Postman y navegador. Guarda los informes y registros como archivos del resultado. Estos cambios todavía no se han publicado ni ejecutado en Actions.

Para comprobar una aplicación ya iniciada, usar `E2E_EXTERNAL_SERVER=true`. `APP_URL` debe indicar su dirección y `DATABASE_URL` su base de pruebas.
