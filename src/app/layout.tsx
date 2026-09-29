import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Roomie · Tu hogar en equipo",
  description: "Organiza tu apartamento y comparte responsabilidades.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
