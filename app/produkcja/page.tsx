"use client";

import React, { useState } from "react";
import { Save, Calendar, Wheat, Croissant, Pizza, Info, Hamburger, Eye, EyeOff, RotateCcw } from "lucide-react";

// 1. Szybkie mock dane z podziałem na kategorie
const menuProdukcyjne = [
    {
        kategoria: "Chleby",
        ikona: Wheat,
        produkty: [
            { id: 101, nazwa: "Chleb Wiejski 500g", cena: 10, koszt: 5 },
            { id: 102, nazwa: "Chleb Żytni 100%", cena: 15, koszt: 8 },
            { id: 103, nazwa: "Bagietka Paryska", cena: 5, koszt: 2 },
        ],
    },
    {
        kategoria: "Bułki",
        ikona: Hamburger,
        produkty: [
            { id: 201, nazwa: "Kajzerka Tradycyjna", cena: 4, koszt: 2 },
            { id: 202, nazwa: "Bułka Grahamka", cena: 5, koszt: 2 },
        ],
    },
    {
        kategoria: "Słodkie wypieki",
        ikona: Croissant,
        produkty: [
            { id: 301, nazwa: "Pączek z konfiturą z róży", cena: 12, koszt: 5 },
            { id: 302, nazwa: "Drożdżówka z serem i brzoskwinią", cena: 10, koszt: 4 },
        ],
    },
    {
        kategoria: "Słone wypieki",
        ikona: Pizza,
        produkty: [
            { id: 401, nazwa: "Pasztecik z pieczarkami", cena: 5, koszt: 3 },
            { id: 402, nazwa: "Cebularz lubelski", cena: 6, koszt: 3 },
        ],
    },
];

export default function ProdukcjaPage() {
    // Stan przechowujący ID produktów, które użytkownik zdecydował się ukryć
    const [hiddenProductIds, setHiddenProductIds] = useState<number[]>([]);
    // Stan kontrolujący, czy aktualnie wyświetlamy te ukryte pozycje na liście
    const [showHidden, setShowHidden] = useState(false);

    // Funkcja ukrywająca/pokazująca pojedynczy produkt
    const toggleHideProduct = (id: number) => {
        setHiddenProductIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    // Resetowanie wszystkich ukrytych produktów (opcjonalne, ale bardzo wygodne)
    const resetHidden = () => {
        setHiddenProductIds([]);
        setShowHidden(false);
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20">

            {/* Nagłówek strony */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Dzienna produkcja i sprzedaż
                    </h1>
                    <p className="text-ui-black/60 text-sm mt-1">
                        Wprowadź ilość wyprodukowanego i sprzedanego towaru.
                    </p>
                </div>

                {/* Kontrolki daty i zapisu */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-ui-white px-4 py-2.5 rounded-xl border border-ui-accent text-ui-primary shadow-sm">
                        <Calendar size={18} className="text-ui-secondary" />
                        <span className="font-medium text-sm">11 Lipca 2026</span>
                    </div>
                    <button className="flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm">
                        <Save size={18} />
                        <span className="hidden sm:inline">Zapisz raport</span>
                    </button>
                </div>
            </div>

            {/* Panel kontroli ukrytych wyrobów (Zaimplementowany przełącznik nad listą) */}
            <div className="bg-ui-accent/10 border border-ui-accent/30 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-ui-primary">
                    <Info size={18} className="text-ui-secondary shrink-0" />
                    <span>
                        Ukryłeś obecnie <strong className="font-bold text-ui-black">{hiddenProductIds.length}</strong> {hiddenProductIds.length === 1 ? "wyrób" : hiddenProductIds.length > 1 && hiddenProductIds.length < 5 ? "wyroby" : "wyrobów"}.
                    </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Przycisk odsłaniania/zasłaniania ukrytych */}
                    <button
                        onClick={() => setShowHidden(!showHidden)}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 shadow-sm
                            ${showHidden
                                ? "bg-ui-secondary text-ui-white border-ui-secondary"
                                : "bg-ui-white text-ui-primary border-ui-accent hover:bg-ui-accent/20"
                            }`}
                    >
                        {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        {showHidden ? "Ukryj nieaktywne" : "Pokaż ukryte"}
                    </button>

                    {/* Szybki reset (Pokaż wszystkie na stałe) */}
                    {hiddenProductIds.length > 0 && (
                        <button
                            onClick={resetHidden}
                            className="flex items-center justify-center p-2 rounded-xl border border-ui-accent bg-ui-white text-ui-primary/60 hover:text-ui-primary hover:bg-ui-accent/20 transition-colors"
                            title="Przywróć wszystkie wyroby"
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Lista kategorii i produktów */}
            <div className="space-y-10">
                {menuProdukcyjne.map((sekcja) => {
                    const Icon = sekcja.ikona;

                    // Filtrowanie wyrobów w locie w zależności od stanu ukrycia i przełącznika na górze
                    const widoczneProdukty = sekcja.produkty.filter((produkt) => {
                        const isHidden = hiddenProductIds.includes(produkt.id);
                        if (showHidden) return true; // Jeśli kliknięto "Pokaż ukryte", pokazujemy wszystko
                        return !isHidden; // Standardowo odrzucamy ukryte
                    });

                    // Jeśli w danej kategorii po odfiltrowaniu nic nie zostało, nie renderujemy nagłówka kategorii
                    if (widoczneProdukty.length === 0) return null;

                    return (
                        <div key={sekcja.kategoria} className="animate-fade-in">
                            {/* Nagłówek kategorii */}
                            <div className="flex items-center gap-3 mb-4 border-b border-ui-accent pb-2">
                                <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                                    <Icon size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-ui-black">{sekcja.kategoria}</h2>
                            </div>

                            {/* Lista produktów w danej kategorii */}
                            <div className="space-y-3">
                                {widoczneProdukty.map((produkt) => {
                                    const isProductHidden = hiddenProductIds.includes(produkt.id);

                                    return (
                                        <div
                                            key={produkt.id}
                                            className={`rounded-xl p-4 sm:px-6 shadow-sm border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4
                                                ${isProductHidden
                                                    ? "bg-ui-accent/5 border-dashed border-ui-accent opacity-50"
                                                    : "bg-ui-white border-ui-accent hover:border-ui-secondary"
                                                }`}
                                        >
                                            {/* Lewa strona: Nazwa produktu i plan */}
                                            <div className="flex-1 flex items-start gap-3">
                                                {/* Guziczek do ukrywania/pokazywania pojedynczego produktu */}
                                                <button
                                                    onClick={() => toggleHideProduct(produkt.id)}
                                                    className={`mt-1 p-1 rounded-lg transition-colors duration-200 hover:bg-ui-accent/30
                                                        ${isProductHidden ? "text-ui-secondary" : "text-ui-black/30 hover:text-ui-secondary"}`}
                                                    title={isProductHidden ? "Pokaż na liście" : "Ukryj wyrób"}
                                                >
                                                    {isProductHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>

                                                <div>
                                                    <h3 className={`font-semibold text-ui-black text-base ${isProductHidden ? "line-through text-ui-black/40" : ""}`}>
                                                        {produkt.nazwa}
                                                    </h3>
                                                    <p className="text-xs text-ui-primary/60 mt-1">
                                                        Cena: <strong className="text-ui-black/80">{produkt.cena} zł</strong> | Koszt produkcji: <strong className="text-ui-black/80">{produkt.koszt} zł</strong>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Prawa strona: Inputy do wpisywania */}
                                            <div className={`flex items-center gap-3 sm:gap-6 border-t sm:border-t-0 border-ui-accent/30 pt-3 sm:pt-0 ${isProductHidden ? "pointer-events-none opacity-40" : ""}`}>

                                                {/* Input: Wyprodukowano */}
                                                <div className="flex flex-col gap-1 w-full sm:w-auto">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-ui-secondary">
                                                        Wyprodukowano
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            className="w-full sm:w-24 bg-ui-white border border-ui-accent rounded-lg px-3 py-2 text-center text-ui-primary font-semibold focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                                                        />
                                                        <span className="absolute right-3 top-2.5 text-xs text-ui-secondary pointer-events-none">
                                                            szt
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Znak minus (wizualny separator) */}
                                                <span className="text-ui-accent font-light hidden sm:block mt-4">-</span>

                                                {/* Input: Sprzedano */}
                                                <div className="flex flex-col gap-1 w-full sm:w-auto">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-ui-secondary">
                                                        Sprzedano
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            className="w-full sm:w-24 bg-ui-white border border-ui-accent rounded-lg px-3 py-2 text-center text-ui-primary font-semibold focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                                                        />
                                                        <span className="absolute right-3 top-2.5 text-xs text-ui-secondary pointer-events-none">
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
        </div>
    );
}