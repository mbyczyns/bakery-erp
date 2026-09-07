"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import PrzychodyTab from "./PrzychodyTab";
import KosztyTab from "./KosztyTab";

type FinanceTab = "PRZYCHODY" | "KOSZTY";

function FinanseContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const initialTab: FinanceTab = (searchParams.get("tab")?.toUpperCase() === "KOSZTY") ? "KOSZTY" : "PRZYCHODY";
    const [activeTab, setActiveTab] = useState<FinanceTab>(initialTab);

    useEffect(() => {
        const tabParam = searchParams.get("tab")?.toUpperCase();
        if (tabParam === "KOSZTY") {
            setActiveTab("KOSZTY");
        } else if (tabParam === "PRZYCHODY") {
            setActiveTab("PRZYCHODY");
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-ui-black flex items-center gap-3">
                        Finanse
                    </h1>
                </div>

                {/* ---------------- GŁÓWNY PRZEŁĄCZNIK ZAKŁADEK (PRZYCHODY / KOSZTY) ---------------- */}
                <div className="flex items-center p-1.5 bg-ui-accent/15 rounded-2xl border border-ui-accent/40 shadow-xs">
                    <button
                        onClick={() => handleTabChange("PRZYCHODY")}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
                            activeTab === "PRZYCHODY"
                                ? "bg-white text-ui-black shadow-xs border border-ui-accent/60"
                                : "text-ui-secondary hover:text-ui-primary"
                        }`}
                    >
                        <TrendingUp size={18} className={activeTab === "PRZYCHODY" ? "text-emerald-600" : ""} />
                        Przychody
                    </button>
                    <button
                        onClick={() => handleTabChange("KOSZTY")}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
                            activeTab === "KOSZTY"
                                ? "bg-white text-ui-black shadow-xs border border-ui-accent/60"
                                : "text-ui-secondary hover:text-ui-primary"
                        }`}
                    >
                        <TrendingDown size={18} className={activeTab === "KOSZTY" ? "text-rose-600" : ""} />
                        Koszty
                    </button>
                </div>
            </div>

            {/* ---------------- ZAWARTOŚĆ AKTYWNEJ ZAKŁADKI ---------------- */}
            {activeTab === "PRZYCHODY" && <PrzychodyTab />}
            {activeTab === "KOSZTY" && <KosztyTab />}
        </div>
    );
}

export default function FinansePage() {
    return (
        <Suspense fallback={<div className="p-8 text-xs font-bold text-ui-secondary">Ładowanie modułu finansów...</div>}>
            <FinanseContent />
        </Suspense>
    );
}