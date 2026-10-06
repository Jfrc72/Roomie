"use client";
import { useLanguage } from "@/context/LanguageContext";
import { ShoppingBasket } from "lucide-react";
import { Empty, LoadingError, PageTitle } from "@/components/ui";
import ShoppingRow from "@/components/shopping/ShoppingRow";
import ShoppingForm from "@/components/shopping/ShoppingForm";
import { useShoppingView } from "@/hooks/useShoppingView";

export default function ComprasPage() {
  const { t } = useLanguage();
  const {
    homeId,
    toast,
    items,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    restore,
    members,
    pending,
    bought,
    grouped,
  } = useShoppingView();

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
              <section key={category} aria-labelledby={`category-${category}`}>
                <h3 id={`category-${category}`}>
                  {t(category)} {"("}
                  {categoryItems.length}
                  {")"}
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

        <ShoppingForm members={members} create={create} />
      </div>
    </div>
  );
}
