"use client";

import React, { useState, useEffect } from "react";
import {
    Save,
    Calendar,
    Wheat,
    Croissant,
    Pizza,
    Info,
    Eye,
    EyeOff,
    RotateCcw,
    Loader2,
    CheckCircle2,
    Package,
    Hamburger
} from "lucide-react";

type ProductType = "BREAD" | "ROLL" | "SWEET" | "SAVORY";

interface BakeryProduct {
    id: string;
    name: string;
    type: ProductType;
    productionCost: number | string;
    sellingPrice: number | string;
}

const CATEGORY_MAP: Record<ProductType, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
    BREAD: { label: "Chleby", icon: Wheat },
    ROLL: { label: "Bułki", icon: Hamburger },
    SWEET: { label: "Słodkie Wypieki", icon: Croissant },
    SAVORY: { label: "Słone Wypieki", icon: Pizza },
};

export default function ProdukcjaPage() {
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );

    const [products, setProducts] = useState<BakeryProduct[]>([]);
    const [productionData, setProductionData] = useState<
        Record<string, { producedAmount: string; soldAmount: string }>
    >({});

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [hiddenProductIds, setHiddenProductIds] = useState<string[]>([]);
    const [showHidden, setShowHidden] = useState(false);

    const fetchReport = async (dateStr: string) => {
        setIsLoading(true);
        setSaveSuccess(false);
        try {
            const res = await fetch(`/api/produkcja?date=${dateStr}`);
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);

                // Mapowanie istniejących wpisów z Prismy
                const initialMap: Record<string, { producedAmount: string; soldAmount: string }> = {};
                (data.products || []).forEach((p: BakeryProduct) => {
                    const existing = (data.productions || []).find(
                        (prod: any) => prod.bakeryProductId === p.id
                    );
                    initialMap[p.id] = {
                        producedAmount: existing ? String(existing.producedAmount) : "0",
                        soldAmount: existing ? String(existing.soldAmount) : "0",
                    };
                });

                setProductionData(initialMap);
            }
        } catch (error) {
            console.error("Błąd podczas pobierania raportu:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReport(selectedDate);
    }, [selectedDate]);

    const handleInputChange = (bakeryProductId: string, field: "producedAmount" | "soldAmount", value: string) => {
        setProductionData((prev) => ({
            ...prev,
            [bakeryProductId]: {
                ...prev[bakeryProductId],
                [field]: value,
            },
        }));
    };

    const handleSaveReport = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            const items = Object.entries(productionData).map(([bakeryProductId, val]) => ({
                bakeryProductId,
                producedAmount: val.producedAmount,
                soldAmount: val.soldAmount,
            }));

            const res = await fetch("/api/produkcja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: selectedDate,
                    items,
                }),
            });

            if (res.ok) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 4000);
            } else {
                const err = await res.json();
                alert(`Błąd zapisu: ${err.error || "Nie udało się zapisać raportu"}`);
            }
        } catch (error) {
            console.error("Błąd podczas zapisywania raportu:", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleHideProduct = (id: string) => {
        setHiddenProductIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const resetHidden = () => {
        setHiddenProductIds([]);
        setShowHidden(false);
    };

    const categoriesList: ProductType[] = ["BREAD", "ROLL", "SWEET", "SAVORY"];

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20">
            {/* Nagłówek strony z Kalendarzem */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Dzienna Produkcja i Sprzedaż
                    </h1>
                    <p className="text-ui-black/60 text-sm mt-1">
                        Wprowadź ilość wyprodukowanego i sprzedanego towaru dla wybranego dnia.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-amber-50/80 px-3.5 py-2 rounded-xl border border-amber-300 text-amber-950 shadow-sm">
                        <Calendar size={18} className="text-amber-800 shrink-0" />
                        <span className="text-xs font-bold uppercase">Data:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent font-extrabold text-sm text-amber-950 focus:outline-none cursor-pointer"
                        />
                    </div>

                    <button
                        onClick={handleSaveReport}
                        disabled={isSaving || isLoading}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all text-sm cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Zapisuję...
                            </>
                        ) : saveSuccess ? (
                            <>
                                <CheckCircle2 size={18} />
                                Zapisano!
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Zapisz Raport
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Panel kontroli ukrytych wyrobów */}
            <div className="bg-ui-accent/10 border border-ui-accent/30 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-ui-primary">
                    <Info size={18} className="text-ui-secondary shrink-0" />
                    <span>
                        Ukryłeś obecnie <strong className="font-bold text-ui-black">{hiddenProductIds.length}</strong> {hiddenProductIds.length === 1 ? "wyrób" : "wyrobów"}.
                    </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setShowHidden(!showHidden)}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 shadow-sm cursor-pointer ${showHidden
                            ? "bg-ui-secondary text-ui-white border-ui-secondary"
                            : "bg-ui-white text-ui-primary border-ui-accent hover:bg-ui-accent/20"
                            }`}
                    >
                        {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        {showHidden ? "Ukryj nieaktywne" : "Pokaż ukryte"}
                    </button>

                    {hiddenProductIds.length > 0 && (
                        <button
                            onClick={resetHidden}
                            className="flex items-center justify-center p-2 rounded-xl border border-ui-accent bg-ui-white text-ui-primary/60 hover:text-ui-primary hover:bg-ui-accent/20 transition-colors cursor-pointer"
                            title="Przywróć wszystkie wyroby"
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Lista Wyrobów z Bazy */}
            {isLoading ? (
                <div className="flex items-center justify-center p-20 text-ui-secondary text-sm gap-3">
                    <Loader2 size={24} className="animate-spin text-amber-600" />
                    Pobieranie wyrobów i raportu dla dnia {selectedDate}...
                </div>
            ) : products.length === 0 ? (
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-12 text-center text-ui-secondary text-sm">
                    <Package size={36} className="mx-auto mb-3 text-ui-secondary/50" />
                    Brak wyrobów w bazie danych. Dodaj przepisy na stronie <b>/przepisy</b>!
                </div>
            ) : (
                <div className="space-y-10">
                    {categoriesList.map((catKey) => {
                        const catMeta = CATEGORY_MAP[catKey];
                        const Icon = catMeta.icon;

                        const categoryProducts = products.filter((p) => p.type === catKey);

                        const visibleProducts = categoryProducts.filter((p) => {
                            const isHidden = hiddenProductIds.includes(p.id);
                            if (showHidden) return true;
                            return !isHidden;
                        });

                        if (visibleProducts.length === 0) return null;

                        return (
                            <div key={catKey} className="animate-fade-in">
                                <div className="flex items-center gap-3 mb-4 border-b border-ui-accent pb-2">
                                    <div className="bg-amber-100 p-2 rounded-xl text-amber-800">
                                        <Icon size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold text-ui-black">{catMeta.label}</h2>
                                </div>

                                <div className="space-y-3">
                                    {visibleProducts.map((produkt) => {
                                        const isProductHidden = hiddenProductIds.includes(produkt.id);
                                        const entry = productionData[produkt.id] || { producedAmount: "0", soldAmount: "0" };

                                        return (
                                            <div
                                                key={produkt.id}
                                                className={`rounded-xl p-4 sm:px-6 shadow-sm border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isProductHidden
                                                    ? "bg-ui-accent/5 border-dashed border-ui-accent opacity-50"
                                                    : "bg-ui-white border-ui-accent hover:border-ui-secondary"
                                                    }`}
                                            >
                                                <div className="flex-1 flex items-start gap-3">
                                                    <button
                                                        onClick={() => toggleHideProduct(produkt.id)}
                                                        className={`mt-1 p-1 rounded-lg transition-colors cursor-pointer ${isProductHidden ? "text-ui-secondary" : "text-ui-black/30 hover:text-ui-secondary"
                                                            }`}
                                                        title={isProductHidden ? "Pokaż na liście" : "Ukryj wyrób"}
                                                    >
                                                        {isProductHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                                    </button>

                                                    <div>
                                                        <h3 className={`font-semibold text-ui-black text-base ${isProductHidden ? "line-through text-ui-black/40" : ""}`}>
                                                            {produkt.name}
                                                        </h3>
                                                        <p className="text-xs text-ui-primary/60 mt-1">
                                                            Cena: <strong className="text-ui-black">{Number(produkt.sellingPrice || 0).toFixed(2)} zł</strong>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className={`flex items-center gap-3 sm:gap-6 border-t sm:border-t-0 border-ui-accent/30 pt-3 sm:pt-0 ${isProductHidden ? "pointer-events-none opacity-40" : ""}`}>
                                                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-ui-secondary">
                                                            Wyprodukowano
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={entry.producedAmount}
                                                                onChange={(e) => handleInputChange(produkt.id, "producedAmount", e.target.value)}
                                                                className="w-full sm:w-28 bg-amber-50/50 border border-amber-300 rounded-lg px-3 py-2 text-center text-amber-950 font-extrabold focus:outline-none focus:border-amber-600 transition-all text-sm"
                                                            />
                                                            <span className="absolute right-3 top-2.5 text-xs text-amber-900/60 pointer-events-none font-bold">
                                                                szt
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <span className="text-ui-accent font-light hidden sm:block mt-4">-</span>

                                                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-ui-secondary">
                                                            Sprzedano
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={entry.soldAmount}
                                                                onChange={(e) => handleInputChange(produkt.id, "soldAmount", e.target.value)}
                                                                className="w-full sm:w-28 bg-emerald-50/50 border border-emerald-300 rounded-lg px-3 py-2 text-center text-emerald-950 font-extrabold focus:outline-none focus:border-emerald-600 transition-all text-sm"
                                                            />
                                                            <span className="absolute right-3 top-2.5 text-xs text-emerald-900/60 pointer-events-none font-bold">
                                                                szt
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}