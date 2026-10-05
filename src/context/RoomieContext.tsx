"use client";
import { useLanguage } from "@/context/LanguageContext";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Session } from "@/types";
import { api } from "@/lib/api";
interface RoomieState {
  session: Session;
  refresh: () => Promise<void>;
  selectHome: (id: string) => Promise<void>;
  toast: (message: string, action?: ToastAction) => void;
}
interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}
const Context = createContext<RoomieState | null>(null);
export function RoomieProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoRunning = useRef(false);
  const toast = useCallback((nextMessage: string, action?: ToastAction) => {
    setMessage(nextMessage);
    setToastAction(action ?? null);
  }, []);
  const refresh = useCallback(async () => {
    const result = await api<Session>("/session");
    setSession(result);
    setError("");
  }, []);
  useEffect(() => {
    let active = true;
    api<Session>("/session")
      .then((result) => {
        if (active) setSession(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!message || undoBusy) return;
    const timer = setTimeout(() => {
      setMessage("");
      setToastAction(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [message, toastAction, undoBusy]);
  async function undo() {
    if (!toastAction || undoRunning.current) return;
    undoRunning.current = true;
    setUndoBusy(true);
    try {
      await toastAction.onClick();
      toast("Acción deshecha.");
    } catch (reason) {
      toast(
        reason instanceof Error
          ? reason.message
          : "No se pudo deshacer la acción.",
      );
    } finally {
      undoRunning.current = false;
      setUndoBusy(false);
    }
  }
  async function selectHome(id: string) {
    await api(`/homes/${id}/select`, "POST", {});
    await refresh();
  }
  if (error)
    return (
      <main className="standalone">
        <h1>{t("No pudimos abrir tu hogar")}</h1>
        <p role="alert">{t(error)}</p>
        <button onClick={() => refresh().catch((e) => setError(e.message))}>
          {t("Reintentar")}
        </button>
        <a href="/login">{t("Iniciar sesión")}</a>
      </main>
    );
  if (!session)
    return (
      <p className="standalone" role="status">
        {t("Cargando tu hogar…")}
      </p>
    );
  return (
    <Context.Provider value={{ session, refresh, selectHome, toast }}>
      {children}
      <div className="toast" role="status" aria-live="polite">
        {message && <span>{t(message)}</span>}
        {message && toastAction && (
          <button
            className="secondary"
            type="button"
            disabled={undoBusy}
            onClick={undo}
          >
            {t(undoBusy ? "Procesando…" : toastAction.label)}
          </button>
        )}
      </div>
    </Context.Provider>
  );
}
export function useRoomie() {
  const value = useContext(Context);
  if (!value) throw Error("Falta RoomieProvider");
  return value;
}
