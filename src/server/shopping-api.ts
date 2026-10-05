import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, requireUser } from "./security";
import { activity, requireHome } from "./home-access";
import { idSchema } from "./validation";
import { hasCentPrecision, homeIdFrom, lockHome } from "./shared-modules";

const itemSchema = z.object({
  title: z.string().trim().min(2).max(255),
  category: z.string().trim().min(1).max(50),
  quantity: z.number().int().min(1).max(9999),
  estimated_price: z.number().finite().min(0).max(9999999999.99)
    .refine(hasCentPrecision, "El precio admite máximo dos decimales."),
  assigned_membership_id: idSchema.nullable().optional(),
});

export async function shoppingApi(request: Request, path: string[]) {
  const user = await requireUser();
  const itemId = path[1];
  if (!itemId) {
    const homeId = homeIdFrom(request);
    const role = await requireHome(user.id, homeId);
    if (request.method === "GET") {
      const items = await query(
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
      return items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        estimated_price: Number(item.estimated_price),
        can_edit: role === "admin" || item.added_by === user.id,
      }));
    }
    if (request.method === "POST") {
      const data = itemSchema.parse(await request.json());
      return transaction(async (db) => {
        await lockHome(db, homeId);
        if (data.assigned_membership_id) {
          const member = await db.query(
            "SELECT id FROM memberships WHERE id=$1 AND home_id=$2 AND active FOR SHARE",
            [data.assigned_membership_id, homeId],
          );
          if (!member.rowCount)
            throw new ApiError(400, "El comprador asignado debe pertenecer al apartamento.");
        }
        const { rows } = await db.query(
          `INSERT INTO shopping_items(home_id,title,category,quantity,estimated_price,added_by,assigned_membership_id)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [homeId, data.title, data.category, data.quantity, data.estimated_price.toFixed(2), user.id,
            data.assigned_membership_id ?? null],
        );
        await activity(db, homeId, user.id, `agregó "${data.title}" a la lista de compras`);
        return { id: rows[0].id, message: "Producto agregado." };
      });
    }
    throw new ApiError(405, "Método no permitido.");
  }
  idSchema.parse(itemId);
  if (request.method === "POST" && path[2] === "restore") {
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM shopping_items WHERE id=$1 FOR UPDATE", [itemId]);
      const item = rows[0];
      if (!item || !item.deleted_at) throw new ApiError(404, "Producto eliminado no encontrado.");
      const role = await requireHome(user.id, item.home_id, false, db);
      if (role !== "admin" && item.added_by !== user.id)
        throw new ApiError(403, "Solo quien agregó el producto o un administrador puede restaurarlo.");
      await db.query("UPDATE shopping_items SET deleted_at=NULL WHERE id=$1", [itemId]);
      await activity(db, item.home_id, user.id, `restauró "${item.title}" en la lista de compras`);
      return { message: "Producto restaurado." };
    });
  }
  if (request.method === "PATCH") {
    const body = await request.json();
    const patchSchema = itemSchema.partial().extend({
      status: z.enum(["PENDIENTE", "COMPRADO"]).optional(),
    });
    const data = patchSchema.parse(body);
    if (!Object.keys(data).length) throw new ApiError(400, "Indica qué deseas actualizar.");
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM shopping_items WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [itemId]);
      const item = rows[0];
      if (!item) throw new ApiError(404, "Producto no encontrado.");
      await lockHome(db, item.home_id);
      const role = await requireHome(user.id, item.home_id, false, db);
      if (
        Object.keys(data).some((key) => key !== "status") &&
        role !== "admin" &&
        item.added_by !== user.id
      )
        throw new ApiError(403, "Solo quien agregó el producto o un administrador puede editarlo.");
      if (data.assigned_membership_id) {
        const member = await db.query(
          "SELECT id FROM memberships WHERE id=$1 AND home_id=$2 AND active FOR SHARE",
          [data.assigned_membership_id, item.home_id],
        );
        if (!member.rowCount)
          throw new ApiError(400, "El comprador asignado debe pertenecer al apartamento.");
      }
      const nextStatus = data.status ?? item.status;
      await db.query(
        `UPDATE shopping_items SET title=$1,category=$2,quantity=$3,estimated_price=$4,
          status=$5,bought_by=CASE WHEN $5='COMPRADO' THEN COALESCE(bought_by,$6) ELSE NULL END,
          assigned_membership_id=$7 WHERE id=$8`,
        [
          data.title ?? item.title,
          data.category ?? item.category,
          data.quantity ?? item.quantity,
          data.estimated_price?.toFixed(2) ?? item.estimated_price,
          nextStatus,
          user.id,
          data.assigned_membership_id === undefined ? item.assigned_membership_id : data.assigned_membership_id,
          itemId,
        ],
      );
      if (data.status)
        await activity(db, item.home_id, user.id, `${nextStatus === "COMPRADO" ? "marcó como comprado" : "reactivó"} "${data.title ?? item.title}"`);
      return { message: "Producto actualizado." };
    });
  }
  if (request.method === "DELETE") {
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM shopping_items WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [itemId]);
      const item = rows[0];
      if (!item) throw new ApiError(404, "Producto no encontrado.");
      await lockHome(db, item.home_id);
      const role = await requireHome(user.id, item.home_id, false, db);
      if (role !== "admin" && item.added_by !== user.id)
        throw new ApiError(403, "Solo quien agregó el producto o un administrador puede eliminarlo.");
      await db.query("UPDATE shopping_items SET deleted_at=now() WHERE id=$1", [itemId]);
      await activity(db, item.home_id, user.id, `eliminó "${item.title}" de la lista de compras`);
      return { message: "Producto eliminado." };
    });
  }
  throw new ApiError(405, "Método no permitido.");
}
