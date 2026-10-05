import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/context/LanguageContext";
import { getLanguage, translate } from "@/lib/i18n";
export async function generateMetadata(): Promise<Metadata> {
  const language = getLanguage((await cookies()).get("roomie_language")?.value);
  return {
    title: translate("Roomie · Tu hogar en equipo", language),
    description: translate(
      "Organiza tu apartamento y comparte responsabilidades.",
      language,
    ),
  };
}
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const language = getLanguage((await cookies()).get("roomie_language")?.value);
  return (
    <html lang={language}>
      <body>
        <LanguageProvider initialLanguage={language}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
