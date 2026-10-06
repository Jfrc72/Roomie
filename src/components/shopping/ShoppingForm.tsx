"use client";
import { useLanguage } from "@/context/LanguageContext";
import { Form } from "@/components/ui";
import type { Member } from "@/types";
import { categories } from "@/components/shopping/fields";
import { itemBody } from "@/components/shopping/fields";

export default function ShoppingForm({
  members,
  create,
}: {
  members: Member[];
  create: (body: unknown) => Promise<void>;
}) {
  const { t } = useLanguage();

  return (
    <aside className="panel narrow">
      <h2>{t("Añadir producto")}</h2>
      <Form
        label={t("Agregar a la lista")}
        success={t("Producto agregado a la lista.")}
        onSave={(form) => create(itemBody(form))}
      >
        <label>
          {t("Nombre del producto")}
          <input
            name="title"
            required
            minLength={2}
            maxLength={255}
            placeholder={t("Ej. Papel higiénico")}
          />
        </label>
        <label>
          {t("Categoría")}
          <select name="category" defaultValue="Alimentos">
            {categories.map((category) => (
              <option key={category} value={category}>
                {t(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Cantidad")}
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
            required
          />
        </label>
        <label>
          {t("Precio estimado (COP)")}
          <input
            name="estimated_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
          />
        </label>
        <label>
          {t("Asignar comprador (opcional)")}
          <select name="assigned_membership_id" defaultValue="">
            <option value="">{t("Sin asignar")}</option>
            {members.map((member) => (
              <option key={member.membership_id} value={member.membership_id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      </Form>
    </aside>
  );
}
