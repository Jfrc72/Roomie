"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
export function useData<T>(path: string) {
  const [result, setResult] = useState<{
    path: string;
    version: number;
    data: T | null;
    error: string;
  } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    api<T>(path)
      .then((value) => {
        if (active) {
          setResult({ path, version, data: value, error: "" });
        }
      })
      .catch((e) => {
        if (active) setResult({ path, version, data: null, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  function reload() {
    setVersion((v) => v + 1);
  }
  // Un hogar nuevo no debe mostrar datos del anterior mientras carga.
  const current = result?.path === path && result.version === version;
  const data = current ? result.data : null;
  const error = current ? result.error : "";
  return { data, error, reload };
}
