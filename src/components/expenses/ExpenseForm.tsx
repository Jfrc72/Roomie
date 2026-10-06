"use client";
import { useLanguage } from "@/context/LanguageContext";
import { Form } from "@/components/ui";
import type { Member } from "@/types";
import { localToday } from "@/lib/dates";
import { categories } from "@/components/expenses/fields";
import { expenseBody } from "@/components/expenses/fields";

export default function ExpenseForm({
  members,
  userId,
  create,
}: {
  members: Member[];
  userId: string;
  create: (body: unknown) => Promise<void>;
}) {
  const { t } = useLanguage();

  return (
    <section className="panel narrow">
      <h2>{t("Registrar un gasto")}</h2>
      <Form
        label={t("Guardar gasto")}
        success={t("Gasto registrado correctamente.")}
        onSave={(formData) => create(expenseBody(formData))}
      >
        <label>
          {t("Concepto")}
          <input
            name="title"
            required
            minLength={2}
            maxLength={255}
            placeholder={t("Ej. Arriendo de octubre")}
          />
        </label>
        <label>
          {t("Monto total (COP)")}
          <input
            name="total_amount"
            type="number"
            min="1"
            step="0.01"
            required
          />
        </label>
        <label>
          {t("Categoría")}
          <select name="category" defaultValue="Varios">
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
            defaultValue={localToday()}
            required
          />
        </label>
        <label>
          {t("Pagado por")}
          <select name="paid_by_id" defaultValue={userId} required>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>
            {t("Integrantes de la división (el pagador siempre se incluye)")}
          </legend>
          {members.map((member) => (
            <label key={member.id} className="check-label">
              <input
                type="checkbox"
                name="participant_ids"
                value={member.id}
                defaultChecked
                aria-label={t("Incluir a {value1} en la división", {
                  value1: member.name,
                })}
              />
              {member.name}
            </label>
          ))}
        </fieldset>
      </Form>
    </section>
  );
}
