import Link from "next/link";
import { Empty, PageTitle } from "@/components/ui";
// Responsable: Tomás. Reemplazar este contenido con el módulo conectado al backend.
export default function Page() {
  return (
    <>
      <PageTitle
        title="Votaciones"
        description="Las decisiones del hogar se toman en equipo."
      />
      <section className="panel">
        <Empty title="Estamos preparando este espacio">
          Esta sección todavía no está disponible. Pronto podrás organizarla
          desde aquí.
        </Empty>
        <Link className="button secondary" href="/">
          Volver a Inicio
        </Link>
      </section>
    </>
  );
}
