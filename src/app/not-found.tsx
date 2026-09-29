import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>Esta puerta no lleva a ninguna parte</h1>
      <p>No encontramos la página que buscas.</p>
      <Link className="button" href="/">
        Volver al inicio
      </Link>
    </main>
  );
}
