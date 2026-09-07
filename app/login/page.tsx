"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    Wheat,
    Lock,
    User,
    ArrowRight,
    Loader2,
    AlertCircle,
    Eye,
    EyeOff,
    ShieldCheck,
    CheckCircle2,
    Sparkles
} from "lucide-react";

export default function LoginPage() {
    const { user, login, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    const [loginValue, setLoginValue] = useState("");
    const [passwordValue, setPasswordValue] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Jeśli użytkownik jest już zalogowany, przekieruj do właściwego modułu
    useEffect(() => {
        if (!isAuthLoading && user) {
            if (user.role === "BAKER") {
                router.push("/produkcja");
            } else {
                router.push("/produkcja");
            }
        }
    }, [user, isAuthLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!loginValue.trim() || !passwordValue) {
            setErrorMessage("Wprowadź login oraz hasło.");
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await login(loginValue.trim(), passwordValue);

            if (!result.success) {
                setErrorMessage(result.error || "Nieprawidłowy login lub hasło.");
                setIsSubmitting(false);
            }
        } catch (err: any) {
            setErrorMessage("Wystąpił błąd: " + (err?.message || "Nie można się zalogować"));
            setIsSubmitting(false);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-ui-white flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-ui-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ui-white flex flex-col justify-between selection:bg-amber-200">
            {/* Tło dekoracyjne */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-100/60 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-ui-primary/10 blur-3xl" />
            </div>

            {/* Górny pasek z brandingiem */}
            <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-ui-primary text-white rounded-xl shadow-xs">
                        <Wheat size={22} className="text-amber-300" />
                    </div>
                    <div>
                        <span className="font-black text-lg text-ui-black tracking-tight">Piekarnia MWS</span>
                        <span className="text-[11px] block text-ui-secondary font-semibold uppercase tracking-wider">
                            System Zarządzania Produkcją i Finansami
                        </span>
                    </div>
                </div>

            </header>

            {/* Główna sekcja z formularzem logowania */}
            <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-md">
                    <div className="bg-white border border-ui-accent rounded-3xl shadow-xl p-8 sm:p-10 space-y-7">
                        {/* Nagłówek formularza */}
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-ui-black tracking-tight">
                                Zaloguj się do systemu
                            </h1>
                        </div>

                        {/* Komunikat o błędzie */}
                        {errorMessage && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl p-3.5 flex items-start gap-2.5 animate-fade-in">
                                <AlertCircle size={17} className="shrink-0 mt-0.5 text-rose-600" />
                                <span className="font-medium leading-relaxed">{errorMessage}</span>
                            </div>
                        )}

                        {/* Formularz */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Pole: Login */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-ui-primary flex items-center justify-between">
                                    <span>Login / Nazwa użytkownika</span>
                                </label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3.5 top-3.5 text-ui-secondary" />
                                    <input
                                        type="text"
                                        autoComplete="username"
                                        autoFocus
                                        placeholder="Wpisz login..."
                                        value={loginValue}
                                        onChange={(e) => setLoginValue(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-ui-white border border-ui-accent rounded-xl text-sm font-medium text-ui-black focus:outline-none focus:ring-2 focus:ring-ui-primary focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            {/* Pole: Hasło */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-ui-primary flex items-center justify-between">
                                    <span>Hasło</span>
                                </label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3.5 top-3.5 text-ui-secondary" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        value={passwordValue}
                                        onChange={(e) => setPasswordValue(e.target.value)}
                                        className="w-full pl-10 pr-11 py-2.5 bg-ui-white border border-ui-accent rounded-xl text-sm font-medium text-ui-black focus:outline-none focus:ring-2 focus:ring-ui-primary focus:bg-white transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-3 text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                                        title={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Przycisk logowania */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-ui-primary hover:bg-ui-black text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 mt-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Logowanie...
                                    </>
                                ) : (
                                    <>
                                        <span>Zaloguj się</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>


                    </div>
                </div>
            </main>

            {/* Stopka */}
            <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-ui-secondary">
                Piekarnia MWS &copy; {new Date().getFullYear()} &bull; System produkcyjno-finansowy
            </footer>
        </div>
    );
}
