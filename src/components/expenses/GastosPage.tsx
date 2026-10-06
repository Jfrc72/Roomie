"use client";
import { formatCurrency } from "@/lib/money";
import { useLanguage } from "@/context/LanguageContext";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { Empty, LoadingError, PageTitle } from "@/components/ui";
import ExpenseCard from "@/components/expenses/ExpenseCard";
import { categories } from "@/components/expenses/fields";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import ExpenseBalances from "@/components/expenses/ExpenseBalances";
import { useExpensesView } from "@/hooks/useExpensesView";

export default function GastosPage() {
  const { t, locale } = useLanguage();
  const {
    session,
    homeId,
    data,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    restore,
    pay,
    members,
    expenses,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    personFilter,
    setPersonFilter,
  } = useExpensesView();

  if (!homeId)
    return (
      <Empty title={t("Sin apartamento seleccionado")}>
        {t(
          "Selecciona o crea un apartamento para gestionar los gastos compartidos.",
        )}
      </Empty>
    );
  if (loading && !data) return <LoadingError error={t(error)} retry={reload} />;
  if (error && !data) return <LoadingError error={t(error)} retry={reload} />;

  return (
    <div>
      <PageTitle
        title={t("Gastos y pagos")}
        description={t(
          "Consulta las cuentas del hogar, divide los gastos y registra pagos entre integrantes.",
        )}
      />
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <section
        className="stats-grid"
        aria-label={t("Resumen de gastos")}
        style={{ marginBottom: 24 }}
      >
        {[
          {
            label: "Gastos del mes",
            value: data?.summary.total_month ?? 0,
            icon: Wallet,
          },
          {
            label: "Tu parte",
            value: data?.summary.your_share ?? 0,
            icon: Wallet,
          },
          {
            label: "Te deben",
            value: data?.summary.you_are_owed ?? 0,
            icon: ArrowUpRight,
          },
          {
            label: "Debes",
            value: data?.summary.you_owe ?? 0,
            icon: ArrowDownLeft,
          },
        ].map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="section-title">
              <span>{t(label)}</span>
              <Icon size={17} aria-hidden="true" />
            </div>
            <strong>{formatCurrency(value, locale)}</strong>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <h2>{t("Gastos recientes")}</h2>
            <button
              className="secondary"
              type="button"
              onClick={reload}
              aria-label={t("Actualizar gastos")}
            >
              {t("Actualizar")}
            </button>
          </div>
          <div className="form module-filters">
            <label>
              {t("Filtrar por categoría")}
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">{t("Todas")}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Tu estado")}
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">{t("Todos")}</option>
                <option value="PENDIENTE">{t("Pendiente")}</option>
                <option value="PAGADO">{t("Pagado")}</option>
              </select>
            </label>
            <label>
              {t("Integrante")}
              <select
                value={personFilter}
                onChange={(event) => setPersonFilter(event.target.value)}
              >
                <option value="">{t("Todos")}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
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
            <Empty
              title={
                data?.expenses.length
                  ? t("No hay resultados")
                  : t("Aún no hay gastos")
              }
            >
              {data?.expenses.length
                ? t("Prueba cambiando los filtros.")
                : t(
                    "Registra el primer gasto común para comenzar a dividir las cuentas.",
                  )}
            </Empty>
          )}
        </section>

        <aside style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <ExpenseForm
            members={members}
            userId={session.user.id}
            create={create}
          />
          <ExpenseBalances data={data} pay={pay} />
        </aside>
      </div>
    </div>
  );
}
