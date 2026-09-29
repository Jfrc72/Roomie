import Link from "next/link";
import { Empty, PageTitle } from "@/components/ui";
// Responsable: Miguel. Reemplazar este contenido con el módulo conectado al backend.
export default function Page() {
  return (
    <>
      <PageTitle
        title="Gastos"
        description="Las cuentas claras, la convivencia tranquila."
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
