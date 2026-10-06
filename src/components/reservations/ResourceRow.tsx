"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { ConfirmButton, Form } from "@/components/ui";
import type { Resource } from "@/types";
import ResourceFields from "@/components/reservations/ResourceFields";

export default function ResourceRow({
  resource,
  admin,
  onUpdate,
  onRetire,
}: {
  resource: Resource;
  admin: boolean;
  onUpdate: (form: FormData) => Promise<void>;
  onRetire: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className="invitation-row">
        <div>
          <strong>{resource.name}</strong>
          <small>{resource.description || t("Sin descripción")}</small>
        </div>
        {admin && (
          <div className="member-actions">
            <button
              className="text-button"
              onClick={() => setEditing(!editing)}
            >
              {editing ? t("Cerrar edición") : t("Editar")}
            </button>
            <ConfirmButton
              label={t("Retirar")}
              description={t(
                "¿Retirar {value1}? Ya no se podrá reservar; las reservas pasadas se conservan.",
                { value1: resource.name },
              )}
              onConfirm={onRetire}
            />
          </div>
        )}
      </div>
      {editing && (
        <Form
          success={t("Recurso actualizado.")}
          onSave={async (form) => {
            await onUpdate(form);
            setEditing(false);
          }}
        >
          <ResourceFields resource={resource} />
        </Form>
      )}
    </>
  );
}
