"use client";

import React, { useState, useEffect } from "react";
import {
    Wheat,
    Plus,
    Search,
    Loader2,
    X,
    ChevronRight,
    Milk
} from "lucide-react";

type IngredientType = "FLOUR" | "OTHER";

interface Ingredient {
    id: string;
    name: string;
    unit: string;
    type?: IngredientType;
    categoryId?: string;
    supplierName?: string; // Przygotowane pod dostawcę
    calculatedPrice?: number | string;
}

interface Category {
    id: string;
    name: string;
}

export default function SkladnikiPage() {
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"FLOUR" | "FOOD">("FLOUR");

    // Modal dodawania nowego składnika
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newIngredientName, setNewIngredientName] = useState("");
    const [newIngredientUnit, setNewIngredientUnit] = useState("kg");
    const [newIngredientType, setNewIngredientType] = useState<IngredientType>("FLOUR");
    const [newIngredientCategoryId, setNewIngredientCategoryId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch danych o składnikach ze słownika
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/dictionaries");
            if (res.ok) {
                const data = await res.json();
                setIngredients(data.ingredients || []);
                setCategories(data.categories || []);

                if (data.categories && data.categories.length > 0) {
                    setNewIngredientCategoryId(data.categories[0].id);
                }
            }
        } catch (error) {
            console.error("Błąd podczas pobierania składników:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Identyfikatory kategorii dla Mąki i Produktów spożywczych z bazy
    const flourCategoryId = categories.find((c) => c.name.toLowerCase() === "mąka")?.id;
    const foodCategoryId = categories.find((c) => c.name.toLowerCase() === "produkty spożywcze")?.id;

    // Filtrowanie pod kątem zakładki (Mąka / Spożywcze) oraz wyszukiwarki
    const filteredIngredients = ingredients.filter((item) => {
        const isFlour = item.type === "FLOUR" || (flourCategoryId && item.categoryId === flourCategoryId);
        const isFood = item.type === "OTHER" || (foodCategoryId && item.categoryId === foodCategoryId) || (!isFlour);

        const matchesTab = activeTab === "FLOUR" ? isFlour : isFood;
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesTab && matchesSearch;
    });

    const flourCount = ingredients.filter(
        (i) => i.type === "FLOUR" || (flourCategoryId && i.categoryId === flourCategoryId)
    ).length;

    const foodCount = ingredients.filter(
        (i) => i.type === "OTHER" || (foodCategoryId && i.categoryId === foodCategoryId) || (i.type !== "FLOUR" && i.categoryId !== flourCategoryId)
    ).length;

    // Dodawanie nowego składnika
    const handleAddIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIngredientName.trim()) {
            alert("Wprowadź nazwę składnika");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/skladniki", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newIngredientName.trim(),
                    unit: newIngredientUnit,
                    type: newIngredientType,
                    categoryId: newIngredientCategoryId || undefined,
                }),
            });

            if (res.ok) {
                setNewIngredientName("");
                setIsAddModalOpen(false);
                await fetchData();
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error || "Nie udało się dodać składnika"}`);
            }
        } catch (error) {
            console.error("Błąd podczas zapisywania składnika:", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">
            {/* Nagłówek strony */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Baza Składników Piekarni
                    </h1>
                    <p className="text-ui-black/60 text-sm mt-1">
                        Przeglądaj mąki oraz surowce spożywcze wykorzystywane w recepturach i wyliczaniu Food Costu.
                    </p>
                </div>

                <button
                    onClick={() => {
                        setNewIngredientType(activeTab === "FLOUR" ? "FLOUR" : "OTHER");
                        setIsAddModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-ui-primary text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all cursor-pointer"
                >
                    <Plus size={18} />
                    Dodaj Nowy Składnik
                </button>
            </div>

            {/* Zakładki kategorii (Mąki / Składniki Spożywcze) */}
            <div className="flex flex-wrap border-b border-ui-accent mb-6 gap-2">
                <button
                    onClick={() => setActiveTab("FLOUR")}
                    className={`flex items-center gap-2.5 px-6 py-3.5 font-bold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "FLOUR"
                        ? "border-amber-600 text-amber-900 bg-amber-50/70 rounded-t-xl"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    <Wheat size={18} className={activeTab === "FLOUR" ? "text-amber-700" : ""} />
                    Mąki
                    <span className="bg-amber-200/80 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-extrabold ml-1">
                        {flourCount}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab("FOOD")}
                    className={`flex items-center gap-2.5 px-6 py-3.5 font-bold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "FOOD"
                        ? "border-emerald-600 text-emerald-900 bg-emerald-50/70 rounded-t-xl"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    <Milk size={18} className={activeTab === "FOOD" ? "text-emerald-700" : ""} />
                    Składniki Spożywcze
                    <span className="bg-emerald-200/80 text-emerald-900 text-xs px-2.5 py-0.5 rounded-full font-extrabold ml-1">
                        {foodCount}
                    </span>
                </button>
            </div>

            {/* Wyszukiwarka */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder={
                        activeTab === "FLOUR"
                            ? "Szukaj mąki (np. pszenna, żytnia, orkiszowa)..."
                            : "Szukaj składnika (np. masło, mleko, drożdże)..."
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary transition-all text-sm"
                />
            </div>

            {/* CZYSTA, PRZEJRZYSTA TABELA SKŁADNIKÓW */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                                <th className="p-4">Nazwa Składnika</th>
                                <th className="p-4">Dostawca</th>
                                <th className="p-4 text-right">Cena</th>
                                <th className="p-4 text-center">Ostatnio zakupiono</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ui-accent/40 text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-ui-secondary">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={18} className="animate-spin text-amber-600" />
                                            Pobieranie składników...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredIngredients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-ui-secondary italic">
                                        Brak składników w tej kategorii.
                                    </td>
                                </tr>
                            ) : (
                                filteredIngredients.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-ui-accent/10 transition-colors cursor-pointer group"
                                        onClick={() => alert(`Szczegóły dla składnika: ${item.name} (wkrótce)`)}
                                    >
                                        {/* Nazwa + Jednostka */}
                                        <td className="p-4 font-bold text-ui-black group-hover:text-ui-primary transition-colors">
                                            {item.name}
                                            <span className="ml-2 text-xs font-normal text-ui-secondary">
                                                ({item.unit})
                                            </span>
                                        </td>

                                        {/* Dostawca */}
                                        <td className="p-4 text-ui-secondary font-medium">
                                            {item.supplierName || "—"}
                                        </td>

                                        {/* Wyliczona cena */}
                                        <td className="p-4 text-right font-bold text-ui-black">
                                            {item.calculatedPrice
                                                ? `${Number(item.calculatedPrice).toFixed(2)} zł / ${item.unit}`
                                                : "—"}
                                        </td>

                                        {/* Ostatnio zakupiono */}
                                        <td className="p-4 text-right font-bold text-ui-black">
                                            "-"
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL: Dodawanie Nowego Składnika */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsAddModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-ui-accent"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-ui-accent flex items-center justify-between bg-amber-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="bg-amber-100 p-2 rounded-xl text-amber-800">
                                    <Plus size={20} />
                                </div>
                                <h2 className="text-lg font-bold text-ui-black">Dodaj Składnik</h2>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-1.5 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddIngredient} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase mb-1">
                                    Nazwa Składnika *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="np. Mąka Pszenna Typ 750 lub Masło Extra 82%"
                                    value={newIngredientName}
                                    onChange={(e) => setNewIngredientName(e.target.value)}
                                    className="w-full bg-ui-white border border-ui-accent rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ui-secondary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary uppercase mb-1">
                                        Typ Składnika
                                    </label>
                                    <select
                                        value={newIngredientType}
                                        onChange={(e) => setNewIngredientType(e.target.value as IngredientType)}
                                        className="w-full bg-ui-white border border-ui-accent rounded-xl px-3 py-2.5 text-xs font-bold text-ui-primary focus:outline-none cursor-pointer"
                                    >
                                        <option value="FLOUR">🌾 Mąka</option>
                                        <option value="OTHER">🥛 Produkt Spożywczy</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary uppercase mb-1">
                                        Jednostka
                                    </label>
                                    <select
                                        value={newIngredientUnit}
                                        onChange={(e) => setNewIngredientUnit(e.target.value)}
                                        className="w-full bg-ui-white border border-ui-accent rounded-xl px-3 py-2.5 text-xs font-bold text-ui-primary focus:outline-none cursor-pointer"
                                    >
                                        <option value="kg">kg (kilogram)</option>
                                        <option value="l">l (litr)</option>
                                        <option value="szt">szt (sztuka)</option>
                                        <option value="g">g (gram)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-ui-accent flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold text-xs hover:bg-ui-accent/20 transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                                    Zapisz Składnik
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}