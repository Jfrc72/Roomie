"use client";
import { formatCurrency } from "@/lib/money";
import { useLanguage } from "@/context/LanguageContext";
import { Check } from "lucide-react";
import { ConfirmButton, Form } from "@/components/ui";
import { useRoomie } from "@/context/RoomieContext";
import type { Member } from "@/types";
import type { ShoppingItem } from "@/types/shared-modules";
import { categories } from "@/components/shopping/fields";
import { itemBody } from "@/components/shopping/fields";

export default function ShoppingRow({
  item,
  members,
  onUpdate,
  onDelete,
  onToggle,
  onRestore,
}: {
  item: ShoppingItem;
  members: Member[];
  onUpdate: (body: unknown) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggle: () => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  const { toast } = useRoomie();
  const bought = item.status === "COMPRADO";
  return (
    <article
      className="summary-row"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        opacity: bought ? 0.7 : 1,
      }}
    >
      <div>
        <strong style={{ textDecoration: bought ? "line-through" : undefined }}>
          {item.title}
        </strong>
        <p style={{ margin: "4px 0", color: "var(--muted)" }}>
          {t("Cantidad:")} {item.quantity} {"·"}{" "}
          {formatCurrency(item.estimated_price, locale)} {t("· Añadió")}{" "}
          {item.added_by_name}
          {item.assigned_to
            ? t(" · Asignado a {value1}", { value1: item.assigned_to })
            : ""}
          {item.bought_by_name
            ? t(" · Compró {value1}", { value1: item.bought_by_name })
            : ""}
        </p>
      </div>
      <div className="actions">
        <button
          className="secondary"
          type="button"
          onClick={() =>
            void onToggle().catch((reason: unknown) =>
              toast(
                reason instanceof Error
                  ? reason.message
                  : "No se pudo actualizar el producto.",
              ),
            )
          }
          aria-label={
            bought
              ? t("Reactivar {value1}", { value1: item.title })
              : t("Marcar {value1} como comprado", { value1: item.title })
          }
        >
          <Check size={16} aria-hidden="true" />{" "}
          {bought ? t("Reactivar") : t("Comprado")}
        </button>
        {item.can_edit && (
          <>
            <details>
              <summary className="text-button">{t("Editar")}</summary>
              <Form
                label={t("Guardar")}
                success={t("Producto actualizado.")}
                onSave={(form) => onUpdate(itemBody(form))}
              >
                <label>
                  {t("Nombre")}
                  <input
                    name="title"
                    defaultValue={item.title}
                    minLength={2}
                    maxLength={255}
                    required
                  />
                </label>
                <label>
                  {t("Categoría")}
                  <select name="category" defaultValue={item.category}>
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
                    defaultValue={item.quantity}
                    required
                  />
                </label>
                <label>
                  {t("Precio estimado")}
                  <input
                    name="estimated_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={item.estimated_price}
                  />
                </label>
                <label>
                  {t("Comprador asignado")}
                  <select
                    name="assigned_membership_id"
                    defaultValue={item.assigned_membership_id ?? ""}
                  >
                    <option value="">{t("Sin asignar")}</option>
                    {members.map((member) => (
                      <option
                        key={member.membership_id}
                        value={member.membership_id}
                      >
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              </Form>
            </details>
            <ConfirmButton
              label={t("Eliminar")}
              description={t('¿Eliminar "{value1}" de la lista?', {
                value1: item.title,
              })}
              onConfirm={onDelete}
              success={t("Producto eliminado.")}
              undo={onRestore}
            />
          </>
        )}
      </div>
    </article>
  );
}
