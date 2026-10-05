// Fechas para mostrar en el navegador; la API recibe y devuelve ISO con zona.
export function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function formatTime(value: Date) {
  return value.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
// Si empieza y termina el mismo día, la fecha se escribe una sola vez.
export function formatRange(start: string, end: string) {
  const from = new Date(start);
  const to = new Date(end);
  const until =
    from.toDateString() === to.toDateString()
      ? formatTime(to)
      : formatDate(end);
  return `${from.toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} – ${until}`;
}
// datetime-local trabaja con la hora local sin zona.
export function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function fromDateInput(value: FormDataEntryValue | null) {
  return value ? new Date(String(value)).toISOString() : null;
}
// Semanas de lunes a domingo en la hora local del navegador.
export function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}
export function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}
