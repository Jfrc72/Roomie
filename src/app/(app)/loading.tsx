"use client";
import { useLanguage } from "@/context/LanguageContext";
export default function Loading() {
  const { t } = useLanguage();
  return <p role="status">{t("Abriendo tu espacio…")}</p>;
}
