"use client";

import React, { useState } from "react";
import { User, Tags, Sliders, Save, ShieldCheck, Plus, X, Tag } from "lucide-react";

export default function Home() {
    // Stan dla domyślnych/obecnych kategorii w bazie

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">

            {/* Nagłówek strony */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">Konfiguracja</h1>
                    <p className="text-ui-black/60 text-sm mt-1">
                        Zarządzaj ustawieniami globalnymi i bezpieczeństwem aplikacji.
                    </p>
                </div>
            </div>

            {/* Kontener na sekcje ustawień */}
            <div className="space-y-6 w-full">

                {/* SEKCJA 1: Konto użytkownika + Zmiana Hasła */}
                <div className="bg-ui-white rounded-2xl p-6 shadow-sm border border-ui-accent hover:border-ui-secondary transition-all duration-300">

                    {/* Nagłówek sekcji */}
                    <div className="flex items-center gap-3 mb-6 border-b border-ui-accent/30 pb-3">
                        <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                            <User size={20} className="text-ui-secondary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-ui-black">Konto użytkownika</h2>
                            <p className="text-xs text-ui-black/50">Zarządzaj danymi użytkownika i bezpieczeństwem.</p>
                        </div>
                    </div>

                    {/* Wizualna wizytówka zalogowanego użytkownika */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ui-accent/10 border border-ui-accent/40 rounded-xl p-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-ui-primary text-ui-white font-bold text-lg rounded-full flex items-center justify-center shadow-sm">
                                JK
                            </div>
                            <div>
                                <h3 className="font-bold text-ui-black text-base">Jan Kowalski</h3>
                                <p className="text-xs text-ui-primary/60">Login: <span className="font-semibold text-ui-primary">j.kowalski</span></p>
                            </div>
                        </div>

                        {/* Status roli użytkownika */}
                        <div className="flex items-center gap-1.5 bg-ui-white border border-ui-secondary/35 text-ui-secondary px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm w-fit">
                            <ShieldCheck size={14} />
                            Właściciel
                        </div>
                    </div>

                    {/* Pola formularza zmiany hasła */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="flex justify-end mt-6">
                        <button className="flex items-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors duration-200">
                            <Save size={14} />
                            Zmień hasło
                        </button>
                    </div>
                </div>

                {/* SEKCJA 2: Parametry piekarni (Domyślne ustawienia) */}
                <div className="bg-ui-white rounded-2xl p-6 shadow-sm border border-ui-accent hover:border-ui-secondary transition-all duration-300">
                    <div className="flex items-center gap-3 mb-6 border-b border-ui-accent/30 pb-3">
                        <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                            <Sliders size={20} className="text-ui-secondary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-ui-black">Sekcja 3</h2>
                            <p className="text-xs text-ui-black/50">Sekcja 3.</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}