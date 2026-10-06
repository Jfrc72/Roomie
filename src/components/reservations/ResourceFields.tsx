"use client";
import { useLanguage } from "@/context/LanguageContext";
import type { Resource } from "@/types";

export default function ResourceFields({ resource }: { resource?: Resource }) {
  const { t } = useLanguage();
  return (
    <>
      <label>
        {t("Nombre")}
        <input
          name="name"
          defaultValue={resource?.name}
          placeholder={t("Ej. Lavadora")}
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        {t("Descripción")}
        <input
          name="description"
          defaultValue={resource?.description}
          placeholder={t("Dónde está o cómo se usa")}
          maxLength={300}
        />
      </label>
    </>
  );
}
