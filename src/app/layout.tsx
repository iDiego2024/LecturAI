import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LecturAI | Evaluaciones de comprensión lectora impulsadas por IA",
  description: "Plataforma premium para docentes. Genera pruebas escolares de comprensión lectora a partir de libros completos usando Inteligencia Artificial.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
