"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { Loader2, Menu, Bell, Wheat } from "lucide-react";

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, isLoading } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [notificationsCount, setNotificationsCount] = useState<number>(0);

    const isLoginPage = pathname === "/login";

    // Pobieranie licznika powiadomień dla ikony na pasku mobilnym
    const fetchNotificationsCount = async () => {
        try {
            const res = await fetch("/api/powiadomienia");
            if (res.ok) {
                const data = await res.json();
                setNotificationsCount(data.summary?.totalCount || 0);
            }
        } catch {
            // cichy fallback
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotificationsCount();
            const interval = setInterval(fetchNotificationsCount, 30000);
            return () => clearInterval(interval);
        }
    }, [user, pathname]);

    // Automatyczne zamykanie menu mobilnego po zmianie ścieżki URL
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

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
        <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-ui-white">
            {/* ========================================================= */}
            {/* WIDOK DESKTOP: Stały pasek boczny                         */}
            {/* ========================================================= */}
            <div className="hidden md:flex h-screen shrink-0">
                <Sidebar />
            </div>

            {/* ========================================================= */}
            {/* WIDOK MOBILNY: Górny pasek z nawigacją i hamburgerem      */}
            {/* ========================================================= */}
            <header className="flex md:hidden items-center justify-between px-4 py-3 bg-ui-primary text-white shadow-md z-30 shrink-0 border-b border-ui-white/10">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 -ml-1 text-white hover:bg-ui-white/10 rounded-xl transition-colors cursor-pointer"
                        title="Otwórz menu"
                        aria-label="Otwórz menu nawigacji"
                    >
                        <Menu size={22} />
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-ui-accent text-ui-primary rounded-lg font-black text-xs">
                            <Wheat size={16} />
                        </div>
                        <span className="font-extrabold text-sm text-white tracking-tight">
                            Piekarnia MWS
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/powiadomienia"
                        className="p-2 text-white hover:bg-ui-white/10 rounded-xl transition-colors relative cursor-pointer"
                        title="Powiadomienia"
                    >
                        <Bell size={20} />
                        {notificationsCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-ui-primary animate-pulse" />
                        )}
                    </Link>
                </div>
            </header>

            {/* ========================================================= */}
            {/* WIDOK MOBILNY: Wysuwany Drawer z menu (Off-canvas)        */}
            {/* ========================================================= */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    {/* Tło przyciemniające */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />

                    {/* Wysuwany kontener menu */}
                    <div className="relative flex flex-col w-72 max-w-[85vw] h-full bg-ui-primary z-10 shadow-2xl animate-slide-right">
                        <Sidebar isMobile onCloseMobile={() => setIsMobileMenuOpen(false)} />
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* GŁÓWNA TREŚĆ STRONY (Dynamiczny kontener)                  */}
            {/* ========================================================= */}
            <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-8">
                {children}
            </main>
        </div>
    );
}
