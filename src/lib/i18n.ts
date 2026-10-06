import english from "@/locales/en.json";

export type Language = "es" | "en";
const dictionary: Record<string, string> = english;
// Los avisos guardan el mensaje original. Estos patrones traducen su texto fijo
// y conservan los nombres, títulos y acuerdos escritos por las personas.
const templates = Object.keys(dictionary)
  .filter((key) => /\{\w+\}/.test(key))
  .sort((a, b) => b.length - a.length)
  .map((key) => {
    const names: string[] = [];
    const parts = key.split(/(\{\w+\})/).map((part) => {
      if (/^\{\w+\}$/.test(part)) {
        names.push(part.slice(1, -1));
        return "([\\s\\S]*?)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    return { key, names, pattern: new RegExp(`^${parts.join("")}$`) };
  });
export function getLanguage(value?: string | null): Language {
  return value === "en" ? "en" : "es";
}
export function translate(
  message: string,
  language: Language,
  values: Record<string, string | number> = {},
) {
  const translated = Object.hasOwn(dictionary, message)
    ? dictionary[message]
    : undefined;
  if (language === "en" && !translated && !Object.keys(values).length) {
    for (const template of templates) {
      const match = message.match(template.pattern);
      if (match) {
        const captured = Object.fromEntries(
          template.names.map((name, i) => [name, match[i + 1]]),
        );
        return translate(template.key, language, captured);
      }
    }
  }
  const text = language === "en" ? (translated ?? message) : message;
  return text.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
