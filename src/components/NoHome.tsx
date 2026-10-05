import Link from "next/link";
import { Empty, PageTitle } from "./ui";
// Página de un módulo cuando la persona aún no tiene un apartamento activo.
export default function NoHome({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageTitle title={title} description={description} />
      <section className="panel">
        <Empty title="Primero, un hogar">{children}</Empty>
        <Link className="button" href="/apartamento">
          Crear mi apartamento
        </Link>
      </section>
    </>
  );
}
