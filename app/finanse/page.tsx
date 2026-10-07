"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Scale, Loader2 } from "lucide-react";
import PodsumowanieTab from "./PodsumowanieTab";
import PrzychodyTab from "./PrzychodyTab";
import KosztyTab from "./KosztyTab";

type FinanceTab = "PODSUMOWANIE" | "PRZYCHODY" | "KOSZTY";

function FinanseContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const getInitialTab = (): FinanceTab => {
        const tabParam = searchParams.get("tab")?.toUpperCase();
        if (tabParam === "KOSZTY") return "KOSZTY";
        if (tabParam === "PRZYCHODY") return "PRZYCHODY";
        return "PODSUMOWANIE";
    };

    const [activeTab, setActiveTab] = useState<FinanceTab>(getInitialTab);

    useEffect(() => {
        const tabParam = searchParams.get("tab")?.toUpperCase();
        if (tabParam === "KOSZTY") {
            setActiveTab("KOSZTY");
        } else if (tabParam === "PRZYCHODY") {
            setActiveTab("PRZYCHODY");
        } else if (tabParam === "PODSUMOWANIE") {
            setActiveTab("PODSUMOWANIE");
        }
    }, [searchParams]);

    const handleTabChange = (tab: FinanceTab) => {
        setActiveTab(tab);
        const params = new URLSearchParams(window.location.search);
        params.set("tab", tab.toLowerCase());
        router.replace(`/finanse?${params.toString()}`);
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20">
            {/* ---------------- GŁÓWNY NAGŁÓWEK STRONY FINANSE ---------------- */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ui-black flex items-center gap-2.5 sm:gap-3">
                        Finanse
                    </h1>
                </div>
            </div>

            {/* ---------------- GŁÓWNY PRZEŁĄCZNIK ZAKŁADEK (PODSUMOWANIE / PRZYCHODY / KOSZTY) ---------------- */}
            <div className="flex gap-1.5 sm:gap-2 border-b border-ui-accent pb-px mb-6 overflow-x-auto">
                <button
                    onClick={() => handleTabChange("PODSUMOWANIE")}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "PODSUMOWANIE"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <Scale size={15} />
                    <span>Podsumowanie</span>
                </button>
                <button
                    onClick={() => handleTabChange("PRZYCHODY")}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "PRZYCHODY"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <TrendingUp size={15} />
                    <span>Przychody</span>
                </button>
                <button
                    onClick={() => handleTabChange("KOSZTY")}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "KOSZTY"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <TrendingDown size={15} />
                    <span>Koszty</span>
                </button>
            </div>

            {/* ---------------- ZAWARTOŚĆ AKTYWNEJ ZAKŁADKI ---------------- */}
            {activeTab === "PODSUMOWANIE" && <PodsumowanieTab />}
            {activeTab === "PRZYCHODY" && <PrzychodyTab />}
            {activeTab === "KOSZTY" && <KosztyTab />}
        </div>
    );
}

export default function FinansePage() {
    return (
        <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-xs font-bold text-ui-secondary"><Loader2 size={16} className="animate-spin text-ui-secondary" /> Ładowanie modułu finansów...</div>}>
            <FinanseContent />
        </Suspense>
    );
}