"use client";
import { useLanguage } from "@/context/LanguageContext";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <main className="standalone">
      <h1>{t("No pudimos abrir esta página")}</h1>
      <p role="alert">
        {t(
          "Comprueba que la base de datos esté funcionando e intenta nuevamente.",
        )}
      </p>
      <button onClick={reset}>{t("Reintentar")}</button>
    </main>
  );
}
