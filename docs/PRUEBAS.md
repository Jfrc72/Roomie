# Pruebas

## Unitarias

- `npm run test:hu`: 100 pruebas de Vitest (pantallas, hooks, formatos e idiomas) y 574 de Jest (NestJS). Las 39 historias tienen al menos tres casos aprobados; cada prueba cuenta para la historia cuyo código `HU#.#` aparece en su nombre.
- `npm run test:coverage`: las 574 pruebas de NestJS, sin servidor, base de datos ni clave de IA. Se comprueban los servicios, reglas, validaciones de DTO, rutas HTTP, permisos, contraseñas, recordatorios y el asistente con repositorios y un cliente de IA simulados.

La medición del backend incluye todos sus servicios y reglas de negocio. Dio 99,65% en sentencias, 99,89% en líneas, 98,48% en ramas y 99,56% en funciones. El mínimo configurado es 65% en cada medida. El informe se genera en `backend/coverage/index.html`.

Los módulos de Miguel (gastos y pagos, compras, mantenimiento y votaciones) tienen cuatro tipos de prueba: de servicio por historia (permisos, validaciones, transacciones y avisos con el repository simulado), de reglas puras (reparto en centavos, saldos, quién compró, resultado de una votación), de validación de DTO y de rutas HTTP. Estas últimas levantan los controladores reales con los mismos pipes, filtro de errores e interceptor de `main.ts` y simulan solo la sesión y los servicios, así que comprueban códigos de estado, el formato `{data}` o `{error}` y que una entrada inválida nunca llegue al servicio.

Los de Tomás (tareas, reservas y acuerdos) tienen pruebas de servicio por historia y de reglas puras (estados de una tarea, horarios de reserva, acuerdos citados en un reporte). Las del asistente usan un cliente de Claude simulado: revisan qué se envía al modelo, cómo se valida la respuesta, el límite de consultas y la traducción de los errores del proveedor, sin llamar a la API de Anthropic. Las consultas SQL y la conexión entre módulos se revisan con las pruebas de API.

## API y Postman

Dejar `npm run dev` abierto y ejecutar en otra terminal:

```bash
npm run test:integration
npm run test:postman
npm run test:postman:miguel
npm run test:postman:tomas
```

Con los módulos de los tres integrados pasaron las 98 pruebas de integración y las tres colecciones de Postman: la de Juan (68 solicitudes, 150 comprobaciones), la de Miguel (217 solicitudes, 565 comprobaciones) y la de Tomás (65 solicitudes, 158 comprobaciones). Revisan respuestas válidas, entradas incorrectas, permisos, cupo del hogar, último administrador, sesiones, invitaciones, avisos propios, reparto de gastos, abonos, deshacer eliminaciones, votaciones, tareas, reservas, reglamento y asistente.

Las colecciones están en `postman/`. Al importarlas en Postman, las variables `baseUrl` y `origin` apuntan a `http://localhost:3000/api` y `http://localhost:3000`. Si cambia el puerto, cambiar ambas. Ejecutar cada colección completa y en orden: crea sus cuentas de prueba, guarda sus datos en variables y al terminar archiva su hogar y cierra esas cuentas. No hay variable `token` porque la sesión va en una cookie `HttpOnly` que guarda el propio Postman. No habilitan correos ni push.

Para guardar un resultado de Newman: `npm run test:postman -- --reporters cli,json --reporter-json-export .test-output/postman-juan.json`.

La colección de Miguel tiene estas carpetas: 00 seguridad sin sesión, 01 preparación (tres cuentas y un hogar propios con correos únicos), 02 gastos y pagos, 03 lista de compras, 04 mantenimiento, 05 votaciones, 06 documentación OpenAPI y 07 limpieza. Cada solicitud comprueba el código HTTP y la forma `{data}` o `{error}`, y las de lectura verifican los valores (cuotas que suman el total, saldos, contadores, quién compró, recuentos ocultos mientras la votación está abierta, anonimato). Antes de migrar, se ejecutó contra la implementación anterior en Next.js: pasó todo salvo los casos que dependen del contrato nuevo (campos opcionales y documentación OpenAPI). Eso comprobó que NestJS conserva el comportamiento que ya usaban las pantallas.

La colección de Tomás revisa tareas, recursos, reservas, reglamento, reportes, el estado y las validaciones del asistente, permisos de integrantes y visitantes, origen de las escrituras, Inicio y Swagger. No envía consultas al modelo de IA. El camino con IA real se probó con un simulador local de la API de Anthropic; falta probarlo con una clave real.

## Navegador

`npm run test:e2e` revisa las pantallas con Playwright. Inicia la aplicación si no está abierta y necesita Google Chrome. El informe se abre con `npx playwright show-report`.

Con los tres módulos integrados pasaron los 8 recorridos, la integración y las tres colecciones contra la versión compilada para producción, con una base de pruebas aparte. También pasaron con Docker, con los tres módulos juntos: los cinco servicios inician sanos, las migraciones terminan bien y el worker convierte un recordatorio vencido en aviso. Los recorridos incluyen cuentas, hogar, perfil, preferencias, invitaciones, roles, avisos, acuerdos, reservas, filtros, español/inglés, teclado y pantallas de 1280, 768 y 320 px. También se comprueba accesibilidad en las pantallas recorridas.

Integración y E2E crean datos temporales y los borran al terminar. Postman archiva su hogar y cierra sus cuentas de prueba, conservando ese historial. No se deben ejecutar contra una base de datos de uso real. Correo y push se prueban con simulaciones; falta verificarlos con un proveedor configurado.

## En GitHub

[GitHub Actions](https://github.com/Jfrc72/Roomie/actions/workflows/pruebas.yml) está preparado para revisar lint, tipos, unitarias, cobertura y compilación. Después inicia Docker y ejecuta integración, Postman y navegador. Guarda los informes y registros como archivos del resultado. Estos cambios todavía no se han publicado ni ejecutado en Actions.

Para comprobar una aplicación ya iniciada, usar `E2E_EXTERNAL_SERVER=true`. `APP_URL` debe indicar su dirección y `DATABASE_URL` su base de pruebas.
