"use client";
import { LanguageSelector, useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  House,
  Wallet,
  ListChecks,
  ShoppingBasket,
  CalendarDays,
  Wrench,
  Vote,
  BookOpen,
  Bell,
  Settings,
  CircleHelp,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import type { Notice } from "@/types";
const links = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/gastos", label: "Gastos", icon: Wallet },
  { href: "/tareas", label: "Tareas", icon: ListChecks },
  { href: "/compras", label: "Lista de compras", icon: ShoppingBasket },
  { href: "/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/mantenimiento", label: "Mantenimiento", icon: Wrench },
  { href: "/votaciones", label: "Votaciones", icon: Vote },
  { href: "/reglamento", label: "Acuerdos", icon: BookOpen },
];
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { session, selectHome, toast } = useRoomie();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const home = session.homes.find((h) => h.id === session.activeHomeId);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const rows = await api<Notice[]>(
          `/notifications?homeId=${session.activeHomeId || ""}`,
        );
        if (active) setUnread(rows.filter((n) => !n.read_at).length);
      } catch {
        /* La página de notificaciones presenta los errores con reintento. */
      }
    }
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("roomie:notices", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("roomie:notices", load);
    };
  }, [session.activeHomeId, pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">
        {t("Saltar al contenido")}
      </a>
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <Link href="/" className="brand" onClick={() => setMenu(false)}>
          <span className="brand-icon">
            <House size={20} />
          </span>
          roomie<span className="brand-dot">.</span>
        </Link>
        <p className="nav-caption">{t("TU HOGAR, EN EQUIPO")}</p>
        <nav aria-label={t("Navegación principal")}>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "nav-link active" : "nav-link"}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              {t(label)}
              {pathname === href && (
                <ChevronRight size={14} className="nav-arrow" />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="home-note">
            <span className="tiny-dot" />
            {t("Un hogar más organizado")}
            <p>
              {t("Pequeños acuerdos.")}
              <br />
              {t("Mejor convivencia.")}
            </p>
          </div>
          <Link
            className="nav-link"
            href="/apartamento"
            onClick={() => setMenu(false)}
          >
            <Settings size={19} />
            {t("Mi apartamento")}
          </Link>
          <Link
            className="nav-link"
            href="/ayuda"
            onClick={() => setMenu(false)}
          >
            <CircleHelp size={19} />
            {t("Ayuda y soporte")}
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label={t(menu ? "Cerrar menú" : "Abrir menú")}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="home-selector">
            <House size={18} />
            <label className="sr-only" htmlFor="home-select">
              {t("Apartamento activo")}
            </label>
            <select
              id="home-select"
              value={home?.id || ""}
              onChange={(e) =>
                selectHome(e.target.value).catch((e) => toast(e.message))
              }
            >
              {!home && <option value="">{t("Sin apartamento")}</option>}
              {session.homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <span className="member-pill">
              {home?.member_count || 0} {t("roommates")}
            </span>
          </div>
          <div className="top-actions">
            <LanguageSelector />
            <Link className="invite-top secondary" href="/apartamento">
              {t("+ Invitar roommate")}
            </Link>
            <Link
              className="notification-link icon-button"
              href="/notificaciones"
              aria-label={t("Notificaciones, {count} sin leer", {
                count: unread,
              })}
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="notification-count">{unread}</span>
              )}
            </Link>
            <Link href="/perfil" className="avatar" aria-label={t("Mi perfil")}>
              {session.user.name.slice(0, 2).toUpperCase()}
            </Link>
            <button
              className="icon-button logout"
              aria-label={t("Cerrar sesión")}
              onClick={async () => {
                try {
                  await api("/auth/logout", "POST", {});
                  router.push("/login");
                  router.refresh();
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main
          id="contenido"
          tabIndex={-1}
          className="main-content"
          key={session.activeHomeId || "none"}
        >
          {children}
        </main>
        <footer>
          {t("Roomie · Un espacio para convivir mejor")}{" "}
          <span>{t("Proyecto de Programación con Tecnologías Web")}</span>
        </footer>
      </div>
    </div>
  );
}
