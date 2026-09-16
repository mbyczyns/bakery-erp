"use client";

import React from "react";
import { User, Sliders, Save, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ZespolSection from "@/components/ZespolSection";

export default function KonfiguracjaPage() {
    const { user } = useAuth();

    const isManagerOrAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">

            {/* Nagłówek strony */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ui-black">Konfiguracja</h1>
                </div>
            </div>

            {/* Kontener na sekcje ustawień */}
            <div className="space-y-6 w-full">

                {/* SEKCJA 1: Konto zalogowanego użytkownika */}
                <div className="bg-ui-white rounded-2xl p-4 sm:p-6 shadow-xs border border-ui-accent hover:border-ui-secondary transition-all duration-300">

                    {/* Nagłówek sekcji */}
                    <div className="flex items-center gap-3 mb-4 sm:mb-6 border-b border-ui-accent/30 pb-3">
                        <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                            <User size={20} className="text-ui-secondary" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-ui-black">Konto użytkownika</h2>
                        </div>
                    </div>

                    {/* Wizualna wizytówka zalogowanego użytkownika */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-ui-accent/10 border border-ui-accent/40 rounded-xl p-3.5 sm:p-4 mb-6 sm:mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-ui-primary text-ui-white font-bold text-base sm:text-lg rounded-full flex items-center justify-center shadow-xs shrink-0">
                                {(user?.name || user?.login || "U").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-ui-black text-sm sm:text-base truncate">{user?.name || user?.login || "Użytkownik"}</h3>
                                <p className="text-xs text-ui-primary/60 truncate">Login: <span className="font-semibold text-ui-primary">{user?.login}</span></p>
                            </div>
                        </div>

                        {/* Status roli użytkownika */}
                        <div className="flex items-center gap-1.5 bg-ui-white border border-ui-secondary/35 text-ui-secondary px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs w-fit">
                            <ShieldCheck size={14} />
                            Rola: {user?.role || "USER"}
                        </div>
                    </div>

                    {/* Pola formularza zmiany hasła */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Aktualne hasło</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Nowe hasło</label>
                            <input
                                type="password"
                                placeholder="Min. 8 znaków"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>
                    </div>

                    {/* Przycisk akcji */}
                    <div className="flex justify-end mt-5 sm:mt-6">
                        <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors duration-200 cursor-pointer">
                            <Save size={14} />
                            Zmień hasło
                        </button>
                    </div>
                </div>

                {/* SEKCJA 2: Zespół i pracownicy (Dostępna TYLKO dla Managerów i Administratorów) */}
                {isManagerOrAdmin && (
                    <ZespolSection />
                )}



            </div>
        </div>
    );
}