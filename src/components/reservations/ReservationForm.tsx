"use client";
import type { Resource } from "@/types";
import { useLanguage } from "@/context/LanguageContext";
import { toDateInput } from "@/lib/dates";
import { Form } from "@/components/ui";

export default function ReservationForm({
  resources,
  reserve,
  onCreated,
}: {
  resources: Resource[];
  reserve: (form: FormData) => Promise<void>;
  onCreated: () => void;
}) {
  const { t } = useLanguage();

  return (
    <section className="panel narrow">
      <h2>{t("Reservar un espacio")}</h2>
      <Form
        label={t("Reservar")}
        success={t("Reserva creada.")}
        onSave={async (form) => {
          await reserve(form);
          onCreated();
        }}
      >
        <label>
          {t("Recurso")}
          <select name="resource_id" required>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Inicio de la reserva")}
          <input
            name="starts_at"
            type="datetime-local"
            required
            min={toDateInput(new Date().toISOString())}
          />
        </label>
        <label>
          {t("Fin")}
          <input
            name="ends_at"
            type="datetime-local"
            required
            min={toDateInput(new Date().toISOString())}
          />
        </label>
        <small>
          {t(
            "No puede cruzarse con otra reserva del mismo recurso y dura como máximo 7 días. Recibirás un recordatorio según tus preferencias de notificación.",
          )}
        </small>
      </Form>
    </section>
  );
}
