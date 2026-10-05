"use client";
import { useLanguage } from "@/context/LanguageContext";

import { useMemo } from "react";
import { Check, ShoppingBasket } from "lucide-react";
import {
  ConfirmButton,
  Empty,
  Form,
  LoadingError,
  PageTitle,
} from "@/components/ui";
import { useRoomie } from "@/context/RoomieContext";
import { useCompras } from "@/hooks/useCompras";
import { useData } from "@/lib/use-data";
import type { Home, Member } from "@/types";
import type { ShoppingItem } from "@/types/shared-modules";

const categories = ["Alimentos", "Limpieza", "Utensilios", "Hogar", "Varios"];

function itemBody(form: FormData) {
  return {
    title: String(form.get("title") ?? ""),
    category: String(form.get("category") ?? "Varios"),
    quantity: Number(form.get("quantity")),
    estimated_price: Number(form.get("estimated_price") || 0),
    assigned_membership_id:
      String(form.get("assigned_membership_id") ?? "") || null,
  };
}

export default function ComprasPage() {
  const { t } = useLanguage();
  const { session } = useRoomie();
  const homeId = session.activeHomeId;
  const { toast } = useRoomie();
  const { items, loading, error, reload, create, update, remove, restore } =
    useCompras(homeId);
  const { data: home } = useData<Home & { members: Member[] }>(
    homeId ? `/homes/${homeId}` : "/session",
  );
  const members = home?.members ?? [];
  const pending = useMemo(
    () => items.filter((item) => item.status === "PENDIENTE"),
    [items],
  );
  const bought = useMemo(
    () => items.filter((item) => item.status === "COMPRADO"),
    [items],
  );
  const grouped = useMemo(
    () =>
      pending.reduce<Record<string, ShoppingItem[]>>((groups, item) => {
        (groups[item.category] ??= []).push(item);
        return groups;
      }, {}),
    [pending],
  );

  if (!homeId)
    return (
      <Empty title={t("Sin apartamento")}>
        {t("Selecciona un apartamento para ver la lista de compras.")}
      </Empty>
    );
  if (loading && !items.length)
    return <LoadingError error={t(error)} retry={reload} />;
  if (error && !items.length)
    return <LoadingError error={t(error)} retry={reload} />;

  return (
    <div>
      <PageTitle
        title={t("Lista de compras")}
        description={t(
          "Organicen los productos del hogar, registren quién los compra y consulten el historial.",
        )}
      />
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <h2>
              <ShoppingBasket size={19} aria-hidden="true" /> {pending.length}{" "}
              {t("productos pendientes")}
            </h2>
            <button className="secondary" type="button" onClick={reload}>
              {t("Actualizar")}
            </button>
          </div>
          {!pending.length ? (
            <Empty title={t("¡Todo completo!")}>
              {t("No hay productos pendientes en la lista.")}
            </Empty>
          ) : (
            Object.entries(grouped).map(([category, categoryItems]) => (
              <section
                key={category}
                aria-labelledby={`category-${category}`}
              >
                <h3 id={`category-${category}`}>
                  {t(category)} {t("(")}
                  {categoryItems.length}
                  {t(")")}
                </h3>
                <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                  {categoryItems.map((item) => (
                    <ShoppingRow
                      key={item.id}
                      item={item}
                      members={members}
                      onUpdate={(body) => update(item.id, body)}
                      onDelete={() => remove(item.id)}
                      onRestore={() => restore(item.id)}
                      onToggle={() =>
                        update(item.id, {
                          status:
                            item.status === "PENDIENTE"
                              ? "COMPRADO"
                              : "PENDIENTE",
                        }).then(() =>
                          toast(
                            item.status === "PENDIENTE"
                              ? "Marcado como comprado."
                              : "Producto reactivado.",
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            ))
          )}
          {!!bought.length && (
            <section style={{ marginTop: 24 }}>
              <h3>{t("Comprados recientemente")}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {bought.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    members={members}
                    onUpdate={(body) => update(item.id, body)}
                    onDelete={() => remove(item.id)}
                    onRestore={() => restore(item.id)}
                    onToggle={() =>
                      update(item.id, { status: "PENDIENTE" }).then(() =>
                        toast("Producto devuelto a pendientes."),
                      )
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </section>

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
        </aside>
      </div>
    </div>
  );
}

function ShoppingRow({
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
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  });
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
          {t("Cantidad:")} {item.quantity} {t("·")}{" "}
          {currency.format(item.estimated_price)} {t("· Añadió")}{" "}
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
