"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>No pudimos abrir esta página</h1>
      <p role="alert">
        Comprueba que la base de datos esté funcionando e intenta nuevamente.
      </p>
      <button onClick={reset}>Reintentar</button>
    </main>
  );
}
