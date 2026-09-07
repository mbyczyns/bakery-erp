"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { Loader2 } from "lucide-react";

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, isLoading } = useAuth();

    const isLoginPage = pathname === "/login";

    // Na stronie logowania renderujemy pełnoekranowy widok bez paska bocznego
    if (isLoginPage) {
        return <>{children}</>;
    }

    // Stan ładowania danych sesji przy pierwszym wejściu
    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-ui-white">
                <Loader2 size={32} className="animate-spin text-ui-primary" />
            </div>
        );
    }

    // Jeśli niezalogowany i nie na /login (middleware przekieruje, ale zabezpieczamy też klienta)
    if (!user) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-ui-white">
            {/* Lewa strona: Stały pasek boczny z obsługą ról */}
            <Sidebar />

            {/* Prawa strona: Dynamiczna treść podstron */}
            <main className="flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    );
}
