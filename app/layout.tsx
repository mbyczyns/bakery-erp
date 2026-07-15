import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Piekarnia ERP",
  description: "System analizy KSeF i produkcji",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        {/* Kontener dzielący ekran na Sidebar (lewo) i Treść (prawo) */}
        <div className="flex h-screen w-screen overflow-hidden bg-ui-white">

          {/* Lewa strona: Stały pasek boczny */}
          <Sidebar />

          {/* Prawa strona: Dynamiczna treść podstron */}
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}