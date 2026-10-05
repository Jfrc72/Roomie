"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getLanguage, translate, type Language } from "@/lib/i18n";

const Context = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

export function LanguageProvider({
  children,
  initialLanguage = "es",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.cookie = `roomie_language=${language};path=/;max-age=31536000;samesite=lax`;
  }, [language]);
  return (
    <Context.Provider value={{ language, setLanguage }}>
      {children}
    </Context.Provider>
  );
}

export function useLanguage() {
  const context = useContext(Context);
  if (!context) throw Error("Falta LanguageProvider");
  return {
    ...context,
    locale: context.language === "es" ? "es-CO" : "en-US",
    t: (message: string, values?: Record<string, string | number>) =>
      translate(message, context.language, values),
  };
}

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label className="language-selector">
      <span className="sr-only">{t("Idioma")}</span>
      <select
        value={language}
        onChange={(e) => setLanguage(getLanguage(e.target.value))}
      >
        <option value="es" lang="es">
          Español
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
    </label>
  );
}
