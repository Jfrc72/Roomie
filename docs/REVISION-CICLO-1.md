# Ajustes del ciclo 1 combinados con el equipo

Actualización del 4 de octubre de 2026. La rama local `revision-rubrica-ciclo-1` parte ahora de `main` en `efedf86`, con los módulos y ajustes de los compañeros. Los cambios de esta revisión están pendientes de commit y de revisión de Juan; no se publicaron en GitHub.

## Cambios combinados

- Se conservaron las siete pantallas funcionales, sus hooks, la API, las migraciones y el cierre automático de votaciones.
- `ConfirmButton` combina foco en Cancelar, Escape, bloqueo de envíos y traducción con las propiedades `success` y `undo` del equipo. El aviso permite deshacer y bloquea clics repetidos mientras restaura.
- Todas las unitarias usan Vitest, incluidas las cuatro suites de los compañeros. `npm test` y `npm run test:unit` ejecutan lo mismo. `npm run test:integration` incluye las seis suites contra la API; estas siguen usando `node:test`.
- El selector ES/EN cubre los módulos nuevos, Inicio, Ayuda, el asistente y mensajes del sistema. Las fechas y monedas usan el idioma elegido. Las opciones mantienen sus valores de API aunque se traduzca su etiqueta; los nombres, títulos y acuerdos escritos por el hogar se conservan.
- Se mantienen cierre de cuenta, archivo de apartamento y eliminación de avisos, con la migración `002_ciclo1.sql`.
- Se conservaron las historias consolidadas del equipo y se añadieron los criterios nuevos y la relación con las pruebas de Juan. README, API, modelo y guía del equipo reflejan la versión combinada.
- Se corrigió el contraste del texto del calendario de reservas, además de los ajustes anteriores de navegación y vista móvil.

## Comprobaciones de la aplicación combinada

- Unitarias: 78 aprobadas.
- Integración: 98 resultados aprobados, incluidos los grupos que reúnen los escenarios. Recorren todos los módulos con la API y PostgreSQL.
- Navegador: cuatro recorridos aprobados. Incluyen registro/perfil/hogar/avisos, idioma persistente, teclado, las siete pantallas con datos en inglés a 320 px y eliminar/deshacer gastos, compras y mantenimiento.
- Axe revisa accesibilidad en las pantallas visitadas. No equivale a comprobar todos los estados posibles.
- Lint, comprobación de tipos y compilación: aprobados.

Las pruebas crean y eliminan sus propios datos; se comprobó que no quedaran cuentas temporales. El servidor y PostgreSQL iniciados para comprobar se detuvieron al terminar. El respaldo de los cambios anteriores se conserva en el stash local. Los conflictos de la combinación están resueltos y los cambios quedan sin preparar para commit, para que Juan los revise.

## Pendientes de la entrega completa

Esto resuelve la compatibilidad de los cambios locales con main. No certifica todavía el cumplimiento completo de la rúbrica:

- La documentación tiene 39 historias. Hay más unitarias y están relacionadas con los códigos del equipo, pero todavía se debe comprobar y completar el mínimo de tres casos útiles por cada historia de todos los integrantes. Las de integración no cuentan para ese mínimo.
- Falta ejecutar y demostrar Docker en un equipo que lo tenga instalado; en este equipo solo se conservó y revisó su configuración.
- Comprobar Figma, la plantilla oficial de historias y la actualización de la wiki. Esta revisión no modificó esos entregables externos.
