import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import AppLayoutWrapper from "@/components/AppLayoutWrapper";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Piekarnia ERP",
    description: "System analizy KSeF i produkcji piekarni",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pl">
            <body className={inter.className}>
                <AuthProvider>
                    <AppLayoutWrapper>
                        {children}
                    </AppLayoutWrapper>
                </AuthProvider>
            </body>
        </html>
    );
}