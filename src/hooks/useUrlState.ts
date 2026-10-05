"use client";
import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

// Estado guardado en la URL (?clave=valor): se conserva al recargar y al compartir el enlace.
// Usa la API nativa del historial, que Next.js sincroniza con useSearchParams sin pedir la
// página al servidor. "push" añade una entrada (Atrás vuelve al valor anterior); "replace" no.
export function useUrlState(
  key: string,
  fallback: string,
  mode: "push" | "replace" = "replace",
) {
  const params = useSearchParams();
  const value = params.get(key) ?? fallback;
  const setValue = useCallback(
    (next: string) => {
      const query = new URLSearchParams(window.location.search);
      if (next === fallback) query.delete(key);
      else query.set(key, next);
      const search = query.toString();
      const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [key, fallback, mode],
  );
  return [value, setValue] as const;
}
