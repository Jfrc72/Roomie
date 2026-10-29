# Diseño de Roomie

- [Prototipo de escritorio](https://www.figma.com/proto/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=45-11&starting-point-node-id=45%3A11)
- [Prototipo móvil](https://www.figma.com/proto/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=47-513&starting-point-node-id=47%3A513)
- [Archivo editable](https://www.figma.com/design/GpdXoSW60Fl4XQiXOhsmvz/Roomie?node-id=20-2)

Las pantallas actuales están en **Roomie - Ciclo 1**. Los bocetos anteriores quedaron en otra página. Hay versiones de escritorio (1280 px) y móvil (390 px), en español e inglés. Cada HU tiene enlaces a su sección en ambos tamaños.

## Para mantener el mismo estilo

- Fuente Arimo, incluida en el proyecto. Títulos de 30 px en escritorio y 24 px en móvil; secciones de 17 px, texto de 14 px y notas de 12 px.
- Morado `#6c5ce7`, fondo `#f8f7fc`, tarjetas blancas y texto `#292637`.
- Botones de al menos 44 px de alto, campos con etiqueta y foco visible al usar el teclado.
- En escritorio usamos barra lateral y dos columnas cuando caben. En móvil el menú se abre con un botón y el contenido se apila.
- Los calendarios permiten desplazarse cuando no caben completos. Las páginas largas tienen desplazamiento vertical.

En Figma se pueden abrir los módulos, el perfil, las invitaciones y las confirmaciones. El selector ES / EN cambia a la misma pantalla en el otro idioma. El asistente tiene un estado de espera y una respuesta simulada; los formularios del prototipo muestran ejemplos, no guardan datos.

En el código, los estilos están en `src/app/globals.css`, los controles comunes en `src/components/ui.tsx` y el idioma en `src/context/LanguageContext.tsx`. La fuente se guarda con su licencia en `src/app/fonts/`.
