"use client";
import { formatCurrency } from "@/lib/money";
import { formatDay } from "@/lib/dates";
import { useLanguage } from "@/context/LanguageContext";
import { ConfirmButton, Form } from "@/components/ui";
import type { Member } from "@/types";
import type { Expense } from "@/types/shared-modules";
import { categories } from "@/components/expenses/fields";
import { expenseBody } from "@/components/expenses/fields";

export default function ExpenseCard({
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
  const { t, locale } = useLanguage();
  return (
    <article
      className="summary-row"
      style={{
        display: "block",
        padding: 14,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div className="record-heading">
        <div>
          <strong>{expense.title}</strong>
          <p style={{ margin: "4px 0", color: "var(--muted)" }}>
            {t("Pagó")} {expense.paid_by_name} {"·"} {t(expense.category)} {"·"}{" "}
            {formatDay(expense.expense_date, locale)}
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>
            {t("Dividido entre:")}{" "}
            {expense.shares.map((item) => item.member).join(", ")}
          </p>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <strong>{formatCurrency(expense.total_amount, locale)}</strong>
          <p>
            {t(
              expense.user_status === "PAGADO"
                ? "Pagado"
                : expense.user_status === "PENDIENTE"
                  ? "Pendiente"
                  : "No incluida",
            )}
          </p>
        </div>
      </div>
      {expense.can_edit && (
        <div className="actions">
          <details>
            <summary className="text-button">{t("Editar gasto")}</summary>
            <Form
              label={t("Guardar cambios")}
              success={t("Gasto actualizado.")}
              onSave={(formData) => onUpdate(expenseBody(formData))}
            >
              <label>
                {t("Concepto")}
                <input
                  name="title"
                  defaultValue={expense.title}
                  required
                  minLength={2}
                  maxLength={255}
                />
              </label>
              <label>
                {t("Monto (COP)")}
                <input
                  name="total_amount"
                  type="number"
                  min="1"
                  step="0.01"
                  defaultValue={expense.total_amount}
                  required
                />
              </label>
              <label>
                {t("Categoría")}
                <select name="category" defaultValue={expense.category}>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {t(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Fecha")}
                <input
                  name="expense_date"
                  type="date"
                  defaultValue={String(expense.expense_date).slice(0, 10)}
                  required
                />
              </label>
              <label>
                {t("Pagado por")}
                <select
                  name="paid_by_id"
                  defaultValue={expense.paid_by}
                  required
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>{t("Integrantes")}</legend>
                {members.map((member) => (
                  <label key={member.id} className="check-label">
                    <input
                      type="checkbox"
                      name="participant_ids"
                      value={member.id}
                      defaultChecked={expense.shares.some(
                        (entry) => entry.user_id === member.id,
                      )}
                    />
                    {member.name}
                  </label>
                ))}
              </fieldset>
            </Form>
          </details>
          <ConfirmButton
            label={t("Eliminar gasto")}
            description={t('¿Eliminar "{value1}" y sus divisiones?', {
              value1: expense.title,
            })}
            onConfirm={onDelete}
            success={t("Gasto eliminado.")}
            undo={onRestore}
          />
        </div>
      )}
    </article>
  );
}
