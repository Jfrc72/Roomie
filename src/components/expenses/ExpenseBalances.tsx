"use client";
import { formatCurrency } from "@/lib/money";
import type { ExpensesData } from "@/types/shared-modules";
import { useLanguage } from "@/context/LanguageContext";
import { Form } from "@/components/ui";

export default function ExpenseBalances({
  data,
  pay,
}: {
  data: ExpensesData | null;
  pay: (body: unknown) => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  return (
    <>
      <section className="panel narrow">
        <h2>{t("Saldar una deuda")}</h2>
        {data?.balances.i_owe.length ? (
          <Form
            label={t("Registrar pago")}
            success={t("Pago entre integrantes registrado.")}
            onSave={(formData) =>
              pay({
                receiver_id: formData.get("receiver_id"),
                amount: Number(formData.get("amount")),
              })
            }
          >
            <label>
              {t("Pagar a")}
              <select
                name="receiver_id"
                required
                defaultValue={data.balances.i_owe[0].user_id}
              >
                {data.balances.i_owe.map((balance) => (
                  <option key={balance.user_id} value={balance.user_id}>
                    {balance.member} {t("(saldo")}{" "}
                    {formatCurrency(balance.amount, locale)}
                    {")"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Monto (COP)")}
              <input name="amount" type="number" min="1" step="0.01" required />
            </label>
          </Form>
        ) : (
          <p role="status">
            {t("No tienes pagos pendientes con los integrantes.")}
          </p>
        )}
      </section>

      <section className="panel narrow">
        <h2>{t("Balances por integrante")}</h2>
        {data?.balances.owes_me.length || data?.balances.i_owe.length ? (
          <ul>
            {data.balances.owes_me.map((balance) => (
              <li key={`owes-${balance.user_id}`}>
                {balance.member} {t("te debe")}{" "}
                {formatCurrency(balance.amount, locale)}
              </li>
            ))}
            {data.balances.i_owe.map((balance) => (
              <li key={`owe-${balance.user_id}`}>
                {t("Debes a")} {balance.member}{" "}
                {formatCurrency(balance.amount, locale)}
              </li>
            ))}
          </ul>
        ) : (
          <p role="status">{t("No hay saldos pendientes.")}</p>
        )}
        {data?.payments.length ? (
          <div>
            <h3>{t("Pagos recientes")}</h3>
            {data.payments.slice(0, 5).map((payment) => (
              <p className="summary-row" key={payment.id}>
                {payment.payer} {t("pagó a")} {payment.receiver}{" "}
                {formatCurrency(payment.amount, locale)}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
