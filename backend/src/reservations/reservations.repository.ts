import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { Reservation, ReservationRow } from './reservations.entity';

const columns = `SELECT r.id,r.resource_id,s.name AS resource,m.user_id,u.name AS member,
  m.active AS member_active,r.starts_at,r.ends_at
  FROM reservations r JOIN resources s ON s.id=r.resource_id
  JOIN memberships m ON m.id=r.membership_id JOIN users u ON u.id=m.user_id`;

export type ReservationToCancel = Pick<Reservation, 'home_id' | 'status' | 'ends_at'> & { user_id: string; resource: string };

@Injectable()
export class ReservationsRepository {
  constructor(private readonly db: DatabaseService) {}

  // Sin rango: activas que aún no terminan. Con rango (calendario): activas que se cruzan con él, aunque ya hayan pasado.
  list(homeId: string, range?: { from: string; to: string }) {
    if (!range) return this.db.query<ReservationRow>(`${columns} WHERE r.home_id=$1 AND r.status='active' AND r.ends_at>now() ORDER BY r.starts_at`, [homeId]);
    return this.db.query<ReservationRow>(`${columns} WHERE r.home_id=$1 AND r.status='active' AND r.ends_at>$2 AND r.starts_at<$3 ORDER BY r.starts_at`, [homeId, range.from, range.to]);
  }
  // FOR SHARE impide que retiren a la persona mientras se confirma su reserva.
  async membership(homeId: string, userId: string, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>('SELECT id FROM memberships WHERE home_id=$1 AND user_id=$2 AND active FOR SHARE', [homeId, userId], client);
    return row?.id ?? null;
  }
  async create(data: { homeId: string; resourceId: string; membershipId: string; start: Date; end: Date }, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>('INSERT INTO reservations(home_id,resource_id,membership_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [data.homeId, data.resourceId, data.membershipId, data.start, data.end], client);
    return row.id;
  }
  async lock(reservationId: string, client: PoolClient) {
    const [row] = await this.db.query<ReservationToCancel>(`SELECT r.home_id,r.status,r.ends_at,m.user_id,s.name AS resource FROM reservations r
      JOIN memberships m ON m.id=r.membership_id JOIN resources s ON s.id=r.resource_id WHERE r.id=$1 FOR UPDATE OF r`, [reservationId], client);
    return row ?? null;
  }
  // Cancelar es una baja lógica: el horario queda libre y el registro se conserva.
  async cancel(reservationId: string, client: PoolClient) {
    await this.db.query("UPDATE reservations SET status='cancelled',cancelled_at=now() WHERE id=$1", [reservationId], client);
  }
  async next(homeId: string) {
    const [row] = await this.db.query<{ name: string; starts_at: Date }>(`SELECT s.name,r.starts_at FROM reservations r JOIN resources s ON s.id=r.resource_id
      WHERE r.home_id=$1 AND r.status='active' AND r.starts_at>now() ORDER BY r.starts_at LIMIT 1`, [homeId]);
    return row ?? null;
  }
}
