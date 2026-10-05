import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, requireUser } from "./security";
import { activity, requireHome } from "./home-access";
import { idSchema } from "./validation";
import { activeUserIds, hasCentPrecision, homeIdFrom, lockHome } from "./shared-modules";

const expenseSchema = z.object({
  title: z.string().trim().min(2).max(255),
  category: z.string().trim().min(1).max(50),
  paid_by_id: idSchema.optional(),
  total_amount: z.number().finite().positive().max(9999999999.99)
    .refine(hasCentPrecision, "El monto admite máximo dos decimales."),
  expense_date: z.iso.date(),
  participant_ids: z.array(idSchema).min(1).max(8),
});
const paymentSchema = z.object({
  receiver_id: idSchema,
  amount: z.number().finite().positive().max(9999999999.99)
    .refine(hasCentPrecision, "El monto admite máximo dos decimales."),
});

function splitAmount(total: number, count: number) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, index) =>
    ((base + (index < remainder ? 1 : 0)) / 100).toFixed(2),
  );
}

export async function expensesApi(request: Request, path: string[]) {
  const user = await requireUser();
  const expenseId = path[1];
  if (path[0] === "payments" && !expenseId) {
    const homeId = homeIdFrom(request);
    await requireHome(user.id, homeId);
    if (request.method !== "POST")
      throw new ApiError(405, "Método no permitido.");
    const data = paymentSchema.parse(await request.json());
    if (data.receiver_id === user.id)
      throw new ApiError(400, "No puedes registrarte un pago a ti mismo.");
    return transaction(async (db) => {
      await lockHome(db, homeId);
      await activeUserIds(db, homeId, [user.id, data.receiver_id]);
      const { rows } = await db.query(
        `SELECT COALESCE(
          (SELECT sum(CASE WHEN es.user_id=$2 THEN es.amount ELSE -es.amount END)
           FROM expense_shares es JOIN expenses e ON e.id=es.expense_id
           WHERE e.home_id=$1 AND e.deleted_at IS NULL AND es.status='PENDIENTE'
             AND ((es.user_id=$2 AND e.paid_by=$3) OR (es.user_id=$3 AND e.paid_by=$2))),0)
          - COALESCE((SELECT sum(CASE WHEN payer_id=$2 THEN amount ELSE -amount END)
           FROM direct_payments WHERE home_id=$1
             AND ((payer_id=$2 AND receiver_id=$3) OR (payer_id=$3 AND receiver_id=$2))),0)
          AS outstanding`,
        [homeId, user.id, data.receiver_id],
      );
      const outstanding = Number(rows[0].outstanding);
      if (outstanding <= 0 || data.amount - outstanding > 0.005)
        throw new ApiError(400, "El pago supera el saldo pendiente con este integrante.");
      await db.query(
        "INSERT INTO direct_payments(home_id,payer_id,receiver_id,amount) VALUES($1,$2,$3,$4)",
        [homeId, user.id, data.receiver_id, data.amount.toFixed(2)],
      );
      await activity(db, homeId, user.id, "registró un pago entre integrantes");
      return { message: "Pago registrado." };
    });
  }

  if (!expenseId) {
    const homeId = homeIdFrom(request);
    const role = await requireHome(user.id, homeId);
    if (request.method === "GET") {
      const [expenses, balanceRows, summary, payments] = await Promise.all([
        query(
          `SELECT e.id,e.title,e.category,e.total_amount,e.expense_date,e.paid_by,
           payer.name AS paid_by_name,e.created_by,
           (SELECT es.status FROM expense_shares es WHERE es.expense_id=e.id AND es.user_id=$2) AS user_status,
           COALESCE((SELECT json_agg(json_build_object('id',es.id,'user_id',es.user_id,'member',u.name,
             'amount',es.amount,'status',es.status,'paid_at',es.paid_at) ORDER BY u.name)
             FROM expense_shares es JOIN users u ON u.id=es.user_id WHERE es.expense_id=e.id),'[]'::json) AS shares
           FROM expenses e JOIN users payer ON payer.id=e.paid_by
           WHERE e.home_id=$1 AND e.deleted_at IS NULL
           ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 100`,
          [homeId, user.id],
        ),
        query(
          `WITH ledger AS (
             SELECT es.user_id AS debtor,e.paid_by AS creditor,sum(es.amount) AS amount
             FROM expense_shares es JOIN expenses e ON e.id=es.expense_id
             WHERE e.home_id=$1 AND e.deleted_at IS NULL AND es.status='PENDIENTE' AND es.user_id<>e.paid_by
             GROUP BY es.user_id,e.paid_by
             UNION ALL
             SELECT payer_id,receiver_id,-sum(amount) FROM direct_payments WHERE home_id=$1
             GROUP BY payer_id,receiver_id
           )
           SELECT CASE WHEN sum(CASE WHEN l.debtor=$2 THEN l.amount ELSE -l.amount END)>0 THEN 'i_owe' ELSE 'owes_me' END AS direction,
             CASE WHEN l.debtor=$2 THEN l.creditor ELSE l.debtor END AS user_id,
             u.name AS member,abs(sum(CASE WHEN l.debtor=$2 THEN l.amount ELSE -l.amount END)) AS gross
           FROM ledger l JOIN users u ON u.id=CASE WHEN l.debtor=$2 THEN l.creditor ELSE l.debtor END
           WHERE l.debtor=$2 OR l.creditor=$2
           GROUP BY CASE WHEN l.debtor=$2 THEN l.creditor ELSE l.debtor END,u.name
           HAVING abs(sum(CASE WHEN l.debtor=$2 THEN l.amount ELSE -l.amount END))>0.005
           ORDER BY u.name`,
          [homeId, user.id],
        ),
        query(
          `SELECT COALESCE(sum(e.total_amount) FILTER (WHERE date_trunc('month',e.expense_date)=date_trunc('month',CURRENT_DATE)),0) AS total_month,
           COALESCE(sum(es.amount) FILTER (WHERE date_trunc('month',e.expense_date)=date_trunc('month',CURRENT_DATE)),0) AS your_share
           FROM expenses e LEFT JOIN expense_shares es ON es.expense_id=e.id AND es.user_id=$2
           WHERE e.home_id=$1 AND e.deleted_at IS NULL`,
          [homeId, user.id],
        ),
        query(
          `SELECT p.id,p.payer_id,pu.name AS payer,p.receiver_id,ru.name AS receiver,p.amount,p.created_at
           FROM direct_payments p JOIN users pu ON pu.id=p.payer_id JOIN users ru ON ru.id=p.receiver_id
           WHERE p.home_id=$1 ORDER BY p.created_at DESC LIMIT 10`,
          [homeId],
        ),
      ]);
      const balances = {
        owes_me: [] as { user_id: string; member: string; amount: number }[],
        i_owe: [] as { user_id: string; member: string; amount: number }[],
      };
      for (const row of balanceRows) {
        const bucket = row.direction === "i_owe" ? balances.i_owe : balances.owes_me;
        const existing = bucket.find((entry) => entry.member === row.member);
        if (existing) existing.amount += Number(row.gross);
        else bucket.push({ user_id: row.user_id, member: row.member, amount: Number(row.gross) });
      }
      const totalOwed = balances.owes_me.reduce((sum, row) => sum + row.amount, 0);
      const totalOwe = balances.i_owe.reduce((sum, row) => sum + row.amount, 0);
      const debtors = new Set(balances.i_owe.map((row) => row.user_id));
      return {
        expenses: expenses.map((expense) => ({
          ...expense,
          total_amount: Number(expense.total_amount),
          user_status: expense.user_status === null
            ? null
            : expense.user_status === "PAGADO" || !debtors.has(expense.paid_by)
              ? "PAGADO"
              : "PENDIENTE",
          can_edit: role === "admin" || expense.created_by === user.id,
          shares: expense.shares.map((share: { amount: string | number }) => ({
            ...share,
            amount: Number(share.amount),
          })),
        })),
        balances,
        payments: payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
        summary: {
          total_month: Number(summary[0].total_month),
          your_share: Number(summary[0].your_share),
          you_are_owed: totalOwed,
          you_owe: totalOwe,
        },
      };
    }
    if (request.method === "POST") {
      const data = expenseSchema.parse(await request.json());
      return transaction(async (db) => {
        await lockHome(db, homeId);
        const paidBy = data.paid_by_id ?? user.id;
        await activeUserIds(db, homeId, [user.id, paidBy, ...data.participant_ids]);
        const participants = [...new Set([paidBy, ...data.participant_ids])];
        const { rows } = await db.query(
          `INSERT INTO expenses(home_id,paid_by,created_by,title,total_amount,category,expense_date)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [homeId, paidBy, user.id, data.title, data.total_amount.toFixed(2), data.category, data.expense_date],
        );
        const amounts = splitAmount(data.total_amount, participants.length);
        for (const [index, participantId] of participants.entries())
          await db.query(
            "INSERT INTO expense_shares(expense_id,user_id,amount,status,paid_at) VALUES($1,$2,$3,$4,CASE WHEN $4='PAGADO' THEN now() END)",
            [rows[0].id, participantId, amounts[index], participantId === paidBy ? "PAGADO" : "PENDIENTE"],
          );
        await activity(db, homeId, user.id, `registró el gasto "${data.title}"`);
        return { id: rows[0].id, message: "Gasto registrado." };
      });
    }
    throw new ApiError(405, "Método no permitido.");
  }

  idSchema.parse(expenseId);
  if (request.method === "POST" && path[2] === "restore") {
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM expenses WHERE id=$1 FOR UPDATE", [expenseId]);
      const expense = rows[0];
      if (!expense || !expense.deleted_at) throw new ApiError(404, "Gasto eliminado no encontrado.");
      const role = await requireHome(user.id, expense.home_id, false, db);
      if (role !== "admin" && expense.created_by !== user.id)
        throw new ApiError(403, "Solo quien registró el gasto o un administrador puede restaurarlo.");
      await db.query("UPDATE expenses SET deleted_at=NULL WHERE id=$1", [expenseId]);
      await activity(db, expense.home_id, user.id, `restauró el gasto "${expense.title}"`);
      return { message: "Gasto restaurado." };
    });
  }
  if (request.method === "PATCH") {
    const data = expenseSchema.parse(await request.json());
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM expenses WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [expenseId]);
      const expense = rows[0];
      if (!expense) throw new ApiError(404, "Gasto no encontrado.");
      const role = await requireHome(user.id, expense.home_id, false, db);
      if (role !== "admin" && expense.created_by !== user.id)
        throw new ApiError(403, "Solo quien registró el gasto o un administrador puede modificarlo.");
      await lockHome(db, expense.home_id);
      const paidBy = data.paid_by_id ?? expense.paid_by;
      const participants = await activeUserIds(db, expense.home_id, [paidBy, ...data.participant_ids]);
      const uniqueParticipants = [...new Set([paidBy, ...participants])];
      await db.query(
        "UPDATE expenses SET paid_by=$1,title=$2,total_amount=$3,category=$4,expense_date=$5 WHERE id=$6",
        [paidBy, data.title, data.total_amount.toFixed(2), data.category, data.expense_date, expenseId],
      );
      await db.query("DELETE FROM expense_shares WHERE expense_id=$1", [expenseId]);
      const amounts = splitAmount(data.total_amount, uniqueParticipants.length);
      for (const [index, participantId] of uniqueParticipants.entries())
        await db.query(
          "INSERT INTO expense_shares(expense_id,user_id,amount,status,paid_at) VALUES($1,$2,$3,$4,CASE WHEN $4='PAGADO' THEN now() END)",
          [expenseId, participantId, amounts[index], participantId === paidBy ? "PAGADO" : "PENDIENTE"],
        );
      await activity(db, expense.home_id, user.id, `actualizó el gasto "${data.title}"`);
      return { message: "Gasto actualizado." };
    });
  }
  if (request.method === "DELETE") {
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM expenses WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [expenseId]);
      const expense = rows[0];
      if (!expense) throw new ApiError(404, "Gasto no encontrado.");
      const role = await requireHome(user.id, expense.home_id, false, db);
      if (role !== "admin" && expense.created_by !== user.id)
        throw new ApiError(403, "Solo quien registró el gasto o un administrador puede eliminarlo.");
      await db.query("UPDATE expenses SET deleted_at=now() WHERE id=$1", [expenseId]);
      await activity(db, expense.home_id, user.id, `eliminó el gasto "${expense.title}"`);
      return { message: "Gasto eliminado." };
    });
  }
  throw new ApiError(405, "Método no permitido.");
}
