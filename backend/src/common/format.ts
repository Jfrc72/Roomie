const homeDateFormat = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
});
export const formatHomeDate = (date: Date) => homeDateFormat.format(date);
