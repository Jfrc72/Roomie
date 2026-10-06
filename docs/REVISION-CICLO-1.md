# Revisión del ciclo 1

## Ajustes después de la retroalimentación

- Acuerdos y reservas separados en componentes para formularios, listas, historial y calendario.
- Gastos, compras y mantenimiento con componentes y hooks para organizar sus datos y filtros.
- Formatos de moneda y fechas compartidos. Se conservan los centavos y las fechas de los gastos.
- Español e inglés, filtros en la URL y navegación compartida.
- Textos pequeños más legibles y filtros que se acomodan al ancho disponible.

## Comprobado

- 175 unitarias sin servidor ni base de datos. Las 39 historias locales tienen al menos tres aprobadas (`npm run test:hu`).
- 98 resultados de integración aprobados con la API y PostgreSQL.
- 7 recorridos E2E: cuentas, idioma, teclado, módulos, filtros, acuerdos y reservas. Incluyen pantallas de 1280, 768 y 320 px.
- Lint, tipos y compilación aprobados.

Las comprobaciones de accesibilidad cubren las pantallas y estados recorridos, no todos los usos posibles. El informe E2E se abre con `npx playwright show-report`.

## Pendiente para la entrega

- La retroalimentación menciona **49 historias**; el archivo local tiene **39**. Hay que comparar ambos listados antes de asegurar el mínimo de pruebas para todas.
- Revisar las historias y completar los campos y mockups de la wiki.
- Corregir navegación, idioma, proporciones y adaptación a pantallas en Figma.
- Probar Docker en el equipo de la presentación (no está instalado en este equipo).
- Revisar e integrar `revision-rubrica-ciclo-1` en `main`. La versión de `main` todavía no tiene estos ajustes.
- Comprobar la primera ejecución de GitHub Actions cuando se suban los cambios.
