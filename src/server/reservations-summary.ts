import { query } from "./db";
import { homeDateFormat } from "./format";
// Próxima reserva activa del hogar. Sin reservas devuelve null e Inicio muestra
// "Sin reservas para mostrar". El llamador debe verificar requireHome.
export async function getNextReservation(homeId: string) {
  const [next] = await query(
    `SELECT s.name,r.starts_at FROM reservations r JOIN resources s ON s.id=r.resource_id
    WHERE r.home_id=$1 AND r.status='active' AND r.starts_at>now() ORDER BY r.starts_at LIMIT 1`,
    [homeId],
  );
  return next
    ? `${next.name} · ${homeDateFormat.format(next.starts_at)}`
    : null;
}
