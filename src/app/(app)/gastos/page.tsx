"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { ConfirmButton, Empty, Form, LoadingError, PageTitle } from "@/components/ui";
import { useRoomie } from "@/context/RoomieContext";
import { useData } from "@/lib/use-data";
import { useGastos } from "@/hooks/useGastos";
import type { Home, Member } from "@/types";
import type { Expense } from "@/types/shared-modules";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const today = new Date().toISOString().slice(0, 10);
const categories = ["Servicios", "Arriendo", "Alimentación", "Mercado", "Varios"];

function expenseBody(data: FormData) {
  return {
    title: String(data.get("title") ?? ""),
    total_amount: Number(data.get("total_amount")),
    category: String(data.get("category") ?? "Varios"),
    expense_date: String(data.get("expense_date") ?? today),
    paid_by_id: String(data.get("paid_by_id") ?? ""),
    participant_ids: data.getAll("participant_ids").map(String),
  };
}

export default function GastosPage() {
  const { session } = useRoomie();
  const homeId = session.activeHomeId;
  const { data, loading, error, reload, create, update, remove, restore, pay } = useGastos(homeId);
  const { data: home } = useData<Home & { members: Member[] }>(
    homeId ? `/homes/${homeId}` : "/session",
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const members = home?.members ?? [];
  const expenses = useMemo(
    () =>
      (data?.expenses ?? []).filter(
        (expense) =>
          (!categoryFilter || expense.category === categoryFilter) &&
          (!statusFilter || expense.user_status === statusFilter) &&
          (!personFilter || expense.paid_by === personFilter ||
            expense.shares.some((share) => share.user_id === personFilter)),
      ),
    [data?.expenses, categoryFilter, statusFilter, personFilter],
  );

  if (!homeId)
    return (
      <Empty title="Sin apartamento seleccionado">
        Selecciona o crea un apartamento para gestionar los gastos compartidos.
      </Empty>
    );
  if (loading && !data) return <LoadingError error={error} retry={reload} />;
  if (error && !data) return <LoadingError error={error} retry={reload} />;

  return (
    <div>
      <PageTitle
        title="Gastos y pagos"
        description="Consulta las cuentas del hogar, divide los gastos y registra pagos entre integrantes."
      />
      {error && <p role="alert" className="error">{error}</p>}
      <section className="stats-grid" aria-label="Resumen de gastos" style={{ marginBottom: 24 }}>
        {[
          { label: "Gastos del mes", value: data?.summary.total_month ?? 0, icon: Wallet },
          { label: "Tu parte", value: data?.summary.your_share ?? 0, icon: Wallet },
          { label: "Te deben", value: data?.summary.you_are_owed ?? 0, icon: ArrowUpRight },
          { label: "Debes", value: data?.summary.you_owe ?? 0, icon: ArrowDownLeft },
        ].map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="section-title">
              <span>{label}</span>
              <Icon size={17} aria-hidden="true" />
            </div>
            <strong>{currency.format(value)}</strong>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <h2>Gastos recientes</h2>
            <button className="secondary" type="button" onClick={reload} aria-label="Actualizar gastos">
              Actualizar
            </button>
          </div>
          <div className="form" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
            <label>
              Filtrar por categoría
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="">Todas</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Tu estado
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="PAGADO">Pagado</option>
              </select>
            </label>
            <label>
              Integrante
              <select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}>
                <option value="">Todos</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
          </div>
          {expenses.length ? (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  members={members}
                  onUpdate={(body) => update(expense.id, body)}
                  onDelete={() => remove(expense.id)}
                  onRestore={() => restore(expense.id)}
                />
              ))}
            </div>
          ) : (
            <Empty title={data?.expenses.length ? "No hay resultados" : "Aún no hay gastos"}>
              {data?.expenses.length
                ? "Prueba cambiando los filtros."
                : "Registra el primer gasto común para comenzar a dividir las cuentas."}
            </Empty>
          )}
        </section>

        <aside style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <section className="panel narrow">
            <h2>Registrar un gasto</h2>
            <Form
              label="Guardar gasto"
              success="Gasto registrado correctamente."
              onSave={(formData) => create(expenseBody(formData))}
            >
              <label>
                Concepto
                <input name="title" required minLength={2} maxLength={255} placeholder="Ej. Arriendo de octubre" />
              </label>
              <label>
                Monto total (COP)
                <input name="total_amount" type="number" min="1" step="0.01" required />
              </label>
              <label>
                Categoría
                <select name="category" defaultValue="Varios">
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>
                Fecha
                <input name="expense_date" type="date" defaultValue={today} required />
              </label>
              <label>
                Pagado por
                <select name="paid_by_id" defaultValue={session.user.id} required>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </label>
              <fieldset>
                <legend>Integrantes de la división (el pagador siempre se incluye)</legend>
                {members.map((member) => (
                  <label key={member.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40 }}>
                    <input
                      type="checkbox"
                      name="participant_ids"
                      value={member.id}
                      defaultChecked
                      aria-label={`Incluir a ${member.name} en la división`}
                    />
                    {member.name}
                  </label>
                ))}
              </fieldset>
            </Form>
          </section>

          <section className="panel narrow">
            <h2>Saldar una deuda</h2>
            {data?.balances.i_owe.length ? (
              <Form
                label="Registrar pago"
                success="Pago entre integrantes registrado."
                onSave={(formData) =>
                  pay({
                    receiver_id: formData.get("receiver_id"),
                    amount: Number(formData.get("amount")),
                  })
                }
              >
                <label>
                  Pagar a
                  <select name="receiver_id" required defaultValue={data.balances.i_owe[0].user_id}>
                    {data.balances.i_owe.map((balance) => (
                      <option key={balance.user_id} value={balance.user_id}>
                        {balance.member} (saldo {currency.format(balance.amount)})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Monto (COP)
                  <input name="amount" type="number" min="1" step="0.01" required />
                </label>
              </Form>
            ) : (
              <p role="status">No tienes pagos pendientes con los integrantes.</p>
            )}
          </section>

          <section className="panel narrow">
            <h2>Balances por integrante</h2>
            {data?.balances.owes_me.length || data?.balances.i_owe.length ? (
              <ul>
                {data.balances.owes_me.map((balance) => (
                  <li key={`owes-${balance.user_id}`}>{balance.member} te debe {currency.format(balance.amount)}</li>
                ))}
                {data.balances.i_owe.map((balance) => (
                  <li key={`owe-${balance.user_id}`}>Debes a {balance.member} {currency.format(balance.amount)}</li>
                ))}
              </ul>
            ) : <p role="status">No hay saldos pendientes.</p>}
            {data?.payments.length ? (
              <div>
                <h3>Pagos recientes</h3>
                {data.payments.slice(0, 5).map((payment) => (
                  <p className="summary-row" key={payment.id}>
                    {payment.payer} pagó a {payment.receiver} {currency.format(payment.amount)}
                  </p>
                ))}
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ExpenseCard({
  expense,
  members,
  onUpdate,
  onDelete,
  onRestore,
}: {
  expense: Expense;
  members: Member[];
  onUpdate: (body: unknown) => Promise<void>;
  onDelete: () => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  return (
    <article className="summary-row" style={{ display: "block", padding: 14, borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <strong>{expense.title}</strong>
          <p style={{ margin: "4px 0", color: "var(--muted)" }}>
            Pagó {expense.paid_by_name} · {expense.category} · {new Date(`${expense.expense_date}T12:00:00`).toLocaleDateString("es-CO")}
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>Dividido entre: {expense.shares.map((item) => item.member).join(", ")}</p>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <strong>{currency.format(expense.total_amount)}</strong>
          <p>{expense.user_status ?? "No incluida"}</p>
        </div>
      </div>
      {expense.can_edit && (
        <div className="actions">
          <details>
            <summary className="text-button">Editar gasto</summary>
            <Form label="Guardar cambios" success="Gasto actualizado." onSave={(formData) => onUpdate(expenseBody(formData))}>
              <label>Concepto<input name="title" defaultValue={expense.title} required minLength={2} maxLength={255} /></label>
              <label>Monto (COP)<input name="total_amount" type="number" min="1" step="0.01" defaultValue={expense.total_amount} required /></label>
              <label>Categoría<select name="category" defaultValue={expense.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Fecha<input name="expense_date" type="date" defaultValue={String(expense.expense_date).slice(0, 10)} required /></label>
              <label>Pagado por<select name="paid_by_id" defaultValue={expense.paid_by} required>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
              <fieldset>
                <legend>Integrantes</legend>
                {members.map((member) => (
                  <label key={member.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40 }}>
                    <input type="checkbox" name="participant_ids" value={member.id} defaultChecked={expense.shares.some((entry) => entry.user_id === member.id)} />
                    {member.name}
                  </label>
                ))}
              </fieldset>
            </Form>
          </details>
          <ConfirmButton
            label="Eliminar gasto"
            description={`¿Eliminar "${expense.title}" y sus divisiones?`}
            onConfirm={onDelete}
            success="Gasto eliminado."
            undo={onRestore}
          />
        </div>
      )}
    </article>
  );
}
