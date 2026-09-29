"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { House, Check, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { isInternalPath } from "@/lib/paths";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError("");
    setBusy(true);
    try {
      await api(
        `/auth/${register ? "register" : "login"}`,
        "POST",
        Object.fromEntries(data),
      );
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && isInternalPath(next) ? next : "/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link className="brand" href="/login">
          <span className="brand-icon">
            <House size={20} />
          </span>
          roomie.
        </Link>
        <div className="story-content">
          <p className="eyebrow">COMPARTIR CASA. SENTIRSE EN CASA.</p>
          <h1>
            La convivencia
            <br />
            empieza con
            <br />
            <em>un buen equipo.</em>
          </h1>
          <p>
            Un solo lugar para organizar tu hogar,
            <br />
            hacer acuerdos y compartir responsabilidades.
          </p>
          <div className="story-points">
            <span>
              <Check size={17} />
              Todos en la misma página
            </span>
            <span>
              <Check size={17} />
              Más orden, menos pendientes
            </span>
            <span>
              <Check size={17} />
              Un espacio para cada roommate
            </span>
          </div>
        </div>
        <small>Tu hogar, un poco más simple.</small>
        <div className="house-art" aria-hidden="true">
          <House size={190} strokeWidth={0.8} />
        </div>
      </section>
      <section className="auth-form-area">
        <div className="auth-box">
          <span className="tag">BIENVENIDO A ROOMIE</span>
          <h2>
            {register
              ? "Haz espacio para tu hogar"
              : "Qué bueno verte de nuevo"}
          </h2>
          <p>
            {register
              ? "Crea tu cuenta para organizar la vida en equipo."
              : "Entra y descubre qué está pasando en tu apartamento."}
          </p>
          <form className="form" onSubmit={submit}>
            <fieldset disabled={busy}>
              {register && (
                <label>
                  Tu nombre
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="¿Cómo te llamas?"
                  />
                </label>
              )}
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nombre@correo.com"
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  required
                  minLength={register ? 10 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register ? "Al menos 10 caracteres" : "Tu contraseña"
                  }
                />
              </label>
            </fieldset>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy}>
              {busy
                ? "Un momento…"
                : register
                  ? "Crear mi cuenta"
                  : "Entrar a mi hogar"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "¿Ya tienes cuenta?" : "¿Es tu primera vez?"}{" "}
            <Link
              href={register ? "/login" : "/registro"}
              onClick={(e) => {
                const next = new URLSearchParams(window.location.search).get(
                  "next",
                );
                if (next) {
                  e.preventDefault();
                  router.push(
                    `${register ? "/login" : "/registro"}?next=${encodeURIComponent(next)}`,
                  );
                }
              }}
            >
              {register ? "Inicia sesión" : "Crea una cuenta"}
            </Link>
          </p>
          <p className="auth-note">
            Organización para hogares de hasta 8 integrantes.
          </p>
        </div>
      </section>
    </div>
  );
}
