"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import { useRoomie } from "@/context/RoomieContext";
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol" aria-hidden="true">
        ⌂
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function LoadingError({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return error ? (
    <div className="panel empty">
      <p role="alert">{error}</p>
      <button className="secondary" onClick={retry}>
        Reintentar
      </button>
    </div>
  ) : (
    <p className="panel" role="status">
      Cargando información…
    </p>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Form({
  children,
  onSave,
  label = "Guardar cambios",
  success = "Cambios guardados.",
}: {
  children: ReactNode;
  onSave: (data: FormData) => Promise<void>;
  label?: string;
  success?: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useRoomie();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await onSave(data);
      toast(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form">
      <fieldset disabled={busy}>{children}</fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "Guardando…" : label}
      </button>
    </form>
  );
}
export function ConfirmButton({
  label,
  description,
  onConfirm,
  success = "Cambio realizado.",
  undo,
}: {
  label: string;
  description: string;
  onConfirm: () => Promise<void>;
  success?: string;
  undo?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useRoomie();
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setOpen(false);
      toast(success, undo ? { label: "Deshacer", onClick: undo } : undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {!open ? (
        <button className="text-button danger" onClick={() => setOpen(true)}>
          {label}
        </button>
      ) : (
        <div className="confirmation">
          <p>{description}</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button disabled={busy} onClick={confirm}>
              {busy ? "Procesando…" : "Confirmar"}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
