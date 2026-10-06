"use client";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="standalone">
      <h1>{t("Esta puerta no lleva a ninguna parte")}</h1>
      <p>{t("No encontramos la página que buscas.")}</p>
      <Link className="button" href="/">
        {t("Volver al inicio")}
      </Link>
    </main>
  );
}
