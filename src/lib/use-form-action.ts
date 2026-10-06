"use client";
import { useRef, useState } from "react";

// Comparte carga y errores entre formularios y confirmaciones.
export function useFormAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  async function run(action: () => Promise<void>) {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error.");
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run, clearError: () => setError("") };
}
