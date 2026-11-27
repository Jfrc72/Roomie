import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ShoppingChanges, ShoppingItem, ShoppingItemRow } from './shopping.entity';
import { ShoppingItemDto } from './shopping.dto';

@Injectable()
export class ShoppingRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Pendientes primero, agrupados por categoría; los comprados al final. */
  list(homeId: string) {
    return this.db.query<ShoppingItemRow>(
      `SELECT i.id,i.title,i.category,i.quantity,i.estimated_price,i.status,i.added_by,
        a.name AS added_by_name,i.bought_by,b.name AS bought_by_name,i.assigned_membership_id,
        assigned.name AS assigned_to,i.created_at
       FROM shopping_items i JOIN users a ON a.id=i.added_by
       LEFT JOIN users b ON b.id=i.bought_by
       LEFT JOIN memberships am ON am.id=i.assigned_membership_id
       LEFT JOIN users assigned ON assigned.id=am.user_id
       WHERE i.home_id=$1 AND i.deleted_at IS NULL
       ORDER BY CASE WHEN i.status='PENDIENTE' THEN 0 ELSE 1 END,i.category,i.created_at DESC`,
      [homeId],
    );
  }

  async pendingCount(homeId: string) {
    const [row] = await this.db.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM shopping_items WHERE home_id=$1 AND status='PENDIENTE' AND deleted_at IS NULL", [homeId],
    );
    return row.total;
  }

  /** Bloquea la fila para que las ediciones simultáneas del mismo producto se ejecuten de una en una. */
  async lock(id: string, deleted: boolean, client: PoolClient) {
    const [row] = await this.db.query<ShoppingItem>(
      `SELECT * FROM shopping_items WHERE id=$1 AND deleted_at IS ${deleted ? 'NOT NULL' : 'NULL'} FOR UPDATE`, [id], client,
    );
    return row ? Object.assign(new ShoppingItem(), row) : null;
  }

  /** `membershipId` es el id de la membresía, no el de la cuenta; debe estar activa en ese apartamento. */
  async isActiveMembership(homeId: string, membershipId: string, client: PoolClient) {
    const rows = await this.db.query('SELECT id FROM memberships WHERE id=$1 AND home_id=$2 AND active FOR SHARE', [membershipId, homeId], client);
    return rows.length > 0;
  }

  async insert(homeId: string, userId: string, data: ShoppingItemDto, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO shopping_items(home_id,title,category,quantity,estimated_price,added_by,assigned_membership_id)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [homeId, data.title, data.category, data.quantity, (data.estimated_price ?? 0).toFixed(2), userId, data.assigned_membership_id ?? null], client,
    );
    return row.id;
  }

  async update(id: string, changes: ShoppingChanges, client: PoolClient) {
    await this.db.query(
      `UPDATE shopping_items SET title=$1,category=$2,quantity=$3,estimated_price=$4,status=$5,bought_by=$6,assigned_membership_id=$7
       WHERE id=$8`,
      [changes.title, changes.category, changes.quantity, changes.estimated_price, changes.status, changes.bought_by, changes.assigned_membership_id, id], client,
    );
  }

  /** Borrado lógico: el producto se oculta pero se conserva para poder deshacerlo. */
  async setDeleted(id: string, deleted: boolean, client: PoolClient) {
    await this.db.query('UPDATE shopping_items SET deleted_at=CASE WHEN $2 THEN now() END WHERE id=$1', [id, deleted], client);
  }
}
