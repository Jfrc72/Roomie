# Pruebas

## Unitarias

`npm run test:hu` ejecuta las 175 unitarias y cuenta los casos aprobados por HU. Las 39 historias tienen al menos tres. No necesita servidor ni base de datos.

## API y navegador

- API: iniciar `npm run dev` y, en otra terminal, ejecutar `npm run test:integration`.
- Navegador: `npm run test:e2e`. Inicia la aplicación si no está abierta y necesita Google Chrome.
- Informe del navegador: `npx playwright show-report`.

Las pruebas crean cuentas y apartamentos temporales y los borran al terminar. No se deben ejecutar contra una base de datos de uso real.

Los recorridos revisan cuentas, perfil, preferencias, acuerdos, reservas, filtros, español/inglés, teclado y pantallas de 1280, 768 y 320 px. Las comprobaciones de accesibilidad cubren las pantallas recorridas.

## En GitHub

[GitHub Actions](https://github.com/Jfrc72/Roomie/actions/workflows/pruebas.yml) revisa lint, tipos, unitarias y compilación. Después inicia la aplicación con Docker y ejecuta la API y las E2E. El informe y los registros quedan como archivos del resultado.

Para comprobar una aplicación que ya está corriendo, se puede usar `E2E_EXTERNAL_SERVER=true`. `APP_URL` debe indicar su dirección y `DATABASE_URL` su base de pruebas.
