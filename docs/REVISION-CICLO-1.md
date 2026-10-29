# Correcciones del ciclo 1

- Separamos Acuerdos y Reservas en componentes más pequeños. Gastos, compras y mantenimiento tienen hooks que organizan sus datos y filtros.
- Compartimos los formatos de moneda y fechas, y la navegación. La fecha de un gasto se devuelve sin hora para que Docker no la cambie de día.
- Agregamos español e inglés, foco visible, etiquetas y tamaños adaptados a cada pantalla.
- Revisamos las 39 historias: cada una tiene responsable, prioridad, estimación, estado, criterios, pruebas y mockups de escritorio y móvil. La diferencia con las 49 mencionadas en la evaluación está aclarada en [el listado](HISTORIAS.md).
- Actualizamos Figma con las diez funcionalidades, versiones móviles, cambio de idioma, confirmaciones y los estados del asistente.
- Las unitarias se ejecutan sin base de datos. Las pruebas de API y navegador también se ejecutan contra Docker en GitHub Actions.

Para repetir la revisión: `npm run lint`, `npm run typecheck`, `npm run test:hu` y `npm run build`. Los pasos de Docker están en el README y los de pruebas en [PRUEBAS.md](PRUEBAS.md).

La wiki se prepara desde estos archivos con `node scripts/sync-wiki.mjs <carpeta-de-la-wiki>`, para mantener ambas versiones iguales.

La migración a NestJS, Swagger, Postman y la conexión real del asistente corresponden al ciclo 2.
