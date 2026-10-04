// Inicio muestra algunos textos tal cual llegan; se formatean en la zona horaria del proyecto.
export const homeDateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
