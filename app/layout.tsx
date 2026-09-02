import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../src/styles/tokens.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "Gestor de tarefas",
  description: "Rotina operacional clara para equipes de mercado.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#533afd",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
