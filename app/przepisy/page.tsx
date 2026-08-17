"use client";

import React, { useState, useEffect } from "react";
import {
    Plus,
    Search,
    Loader2,
    X,
    Trash2,
    ChevronRight,
    Calculator,
    Scale,
    ChefHat
} from "lucide-react";

type ProductType = "BREAD" | "ROLL" | "SWEET" | "SAVORY";

interface DictionaryIngredient {
    id: string;
    name: string;
    unit: string;
}

interface RecipeIngredientItem {
    id?: string;
    ingredientId: string;
    amount: number;
    ingredientUnit: string;
    ingredient?: DictionaryIngredient;
}

interface Recipe {
    id: string;
    name: string;
    type: ProductType;
    productionCost: number | string;
    sellingPrice: number | string;
    ingredients: RecipeIngredientItem[];
}

export default function PrzepisyPage() {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [dbIngredients, setDbIngredients] = useState<DictionaryIngredient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<ProductType>("BREAD");

    // Modal podglądu przepisu
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [previewBatchSize, setPreviewBatchSize] = useState<number>(1);

    // Modal dodawania nowego przepisu
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newRecipeName, setNewRecipeName] = useState("");
    const [newRecipeType, setNewRecipeType] = useState<ProductType>("BREAD");
    const [newRecipeSellingPrice, setNewRecipeSellingPrice] = useState<string>("0");
    const [recipeBatchSize, setRecipeBatchSize] = useState<number>(10); // Deklaracja np. na 10 sztuk

    // Wybrane składniki w prosty sposób
    const [recipeIngredients, setRecipeIngredients] = useState<
        { ingredientId: string; name: string; unit: string; batchAmount: string }[]
    >([]);

    // Szybkie szukanie do dodania składnika
    const [ingSearchInput, setIngSearchInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const resRecipes = await fetch("/api/przepisy");
            if (resRecipes.ok) {
                const data = await resRecipes.json();
                setRecipes(data.recipes || []);
            }

            const resDict = await fetch("/api/dictionaries");
            if (resDict.ok) {
                const data = await resDict.json();
                setDbIngredients(data.ingredients || []);
            }
        } catch (error) {
            console.error("Błąd pobierania danych:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Dodanie składnika z listy podpowiedzi
    const handleSelectIngredient = (ing: DictionaryIngredient) => {
        if (recipeIngredients.some((i) => i.ingredientId === ing.id)) return;

        setRecipeIngredients((prev) => [
            ...prev,
            { ingredientId: ing.id, name: ing.name, unit: ing.unit, batchAmount: "1.0" },
        ]);
        setIngSearchInput("");
    };

    const handleRemoveIngredient = (ingredientId: string) => {
        setRecipeIngredients((prev) => prev.filter((i) => i.ingredientId !== ingredientId));
    };

    const handleAmountChange = (ingredientId: string, amount: string) => {
        setRecipeIngredients((prev) =>
            prev.map((i) => (i.ingredientId === ingredientId ? { ...i, batchAmount: amount } : i))
        );
    };

    // Zapisywanie nowego przepisu
    const handleCreateRecipe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRecipeName.trim()) {
            alert("Wprowadź nazwę wypieku");
            return;
        }
        if (recipeIngredients.length === 0) {
            alert("Dodaj przynajmniej jeden składnik!");
            return;
        }

        setIsSubmitting(true);
        try {
            // Przeliczenie całościowej wagi partii na 1 sztukę
            const singleUnitIngredients = recipeIngredients.map((item) => ({
                ingredientId: item.ingredientId,
                amount: Number(item.batchAmount) / recipeBatchSize,
                unit: item.unit,
            }));

            const res = await fetch("/api/przepisy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newRecipeName.trim(),
                    type: newRecipeType,
                    sellingPrice: Number(newRecipeSellingPrice || 0),
                    ingredients: singleUnitIngredients,
                }),
            });

            if (res.ok) {
                setNewRecipeName("");
                setNewRecipeSellingPrice("0");
                setRecipeIngredients([]);
                setIsAddModalOpen(false);
                await fetchData();
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error || "Nie udało się zapisać przepisu"}`);
            }
        } catch (error) {
            console.error("Błąd podczas zapisywania przepisu:", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredRecipes = recipes
        .filter((r) => r.type === activeTab)
        .filter((r) => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Podpowiedzi do prostego wyszukiwania
    const suggestedIngredients = dbIngredients
        .filter((i) => !recipeIngredients.some((ri) => ri.ingredientId === i.id))
        .filter((i) => i.name.toLowerCase().includes(ingSearchInput.toLowerCase()));

    const getTabBadgeCount = (type: ProductType) => recipes.filter((r) => r.type === type).length;

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">
            {/* Nagłówek */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Przepisy i Foodcosty
                    </h1>
                </div>

                <button
                    onClick={() => {
                        setNewRecipeType(activeTab); // <-- Przypisuje aktualnie wybraną zakładkę (BREAD, ROLL, SWEET lub SAVORY)
                        setIsAddModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all cursor-pointer"
                >
                    <Plus size={18} />
                    Nowy Przepis
                </button>
            </div>

            {/* Zakładki Kategorii */}
            <div className="flex flex-wrap border-b border-ui-accent mb-6 gap-2">
                <button
                    onClick={() => setActiveTab("BREAD")}
                    className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "BREAD"
                        ? "border-amber-600 text-amber-900 bg-amber-50/70 rounded-t-xl font-bold"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    Chleby
                    <span className="bg-amber-200/80 text-amber-950 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                        {getTabBadgeCount("BREAD")}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab("ROLL")}
                    className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "ROLL"
                        ? "border-amber-600 text-amber-900 bg-amber-50/70 rounded-t-xl font-bold"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    Bułki
                    <span className="bg-amber-200/80 text-amber-950 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                        {getTabBadgeCount("ROLL")}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab("SWEET")}
                    className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "SWEET"
                        ? "border-amber-600 text-amber-900 bg-amber-50/70 rounded-t-xl font-bold"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    Słodkie wypieki
                    <span className="bg-amber-200/80 text-amber-950 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                        {getTabBadgeCount("SWEET")}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab("SAVORY")}
                    className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "SAVORY"
                        ? "border-amber-600 text-amber-900 bg-amber-50/70 rounded-t-xl font-bold"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    Słone wypieki
                    <span className="bg-amber-200/80 text-amber-950 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                        {getTabBadgeCount("SAVORY")}
                    </span>
                </button>
            </div>

            {/* Wyszukiwarka */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder="Szukaj przepisu po nazwie..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary transition-all text-sm"
                />
            </div>

            {/* PROSTA PROSTA LISTA RECEPTUR */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                            <th className="p-4">Nazwa Wypieku</th>
                            <th className="p-4 text-right">Cena Sprzedaży</th>
                            <th className="p-4 text-center">Akcja</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-ui-accent/40 text-sm">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-ui-secondary">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 size={18} className="animate-spin text-amber-600" />
                                        Ładowanie przepisów...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRecipes.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-ui-secondary italic">
                                    Brak przepisów w tej kategorii.
                                </td>
                            </tr>
                        ) : (
                            filteredRecipes.map((recipe) => (
                                <tr
                                    key={recipe.id}
                                    onClick={() => {
                                        setSelectedRecipe(recipe);
                                        setPreviewBatchSize(10);
                                    }}
                                    className="hover:bg-ui-accent/10 transition-colors cursor-pointer group"
                                >
                                    <td className="p-4 font-bold text-ui-black group-hover:text-amber-800 transition-colors">
                                        {recipe.name}
                                    </td>
                                    <td className="p-4 text-right font-bold text-ui-black">
                                        {Number(recipe.sellingPrice || 0).toFixed(2)} zł
                                    </td>
                                    <td className="p-4 text-center">
                                        <button className="flex items-center gap-1 mx-auto text-xs font-semibold border border-ui-accent hover:bg-ui-accent/30 text-ui-primary px-3 py-1.5 rounded-lg transition-colors">
                                            Zobacz Przepis
                                            <ChevronRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL 1: Podgląd Przepisu ze Szczegółami */}
            {selectedRecipe && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedRecipe(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-ui-accent bg-amber-50/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-ui-black">{selectedRecipe.name}</h2>
                                <p className="text-xs text-ui-secondary mt-0.5">
                                    Cena sprzedaży: <b>{Number(selectedRecipe.sellingPrice || 0).toFixed(2)} zł</b>
                                </p>
                            </div>

                            <button
                                onClick={() => setSelectedRecipe(null)}
                                className="p-1.5 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 flex-1">
                            {/* Pasek przeliczania dla wyrobu */}
                            <div className="flex items-center justify-between bg-amber-100/60 border border-amber-300/80 p-3.5 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Calculator size={18} className="text-amber-800" />
                                    <span className="text-xs font-bold text-amber-950">Przelicz dla partii wypieku:</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="1"
                                        value={previewBatchSize}
                                        onChange={(e) => setPreviewBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-16 bg-ui-white border border-amber-400 rounded-lg px-2 py-1 text-center font-extrabold text-sm text-amber-950 focus:outline-none"
                                    />
                                    <span className="text-xs font-bold text-amber-950">sztuk</span>
                                </div>
                            </div>

                            {/* Tabela składników z wyliczoną wagi */}
                            <div className="border border-ui-accent rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-ui-accent/20 text-ui-secondary font-bold uppercase border-b border-ui-accent">
                                            <th className="p-3">Surowiec</th>
                                            <th className="p-3 text-right">Na 1 szt.</th>
                                            <th className="p-3 text-right text-ui-primary/80 font-extrabold bg-ui-accent/30">
                                                Przelicz na {previewBatchSize} szt.
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/40">
                                        {selectedRecipe.ingredients.map((item, idx) => {
                                            const singleAmt = Number(item.amount || 0);
                                            const totalAmt = singleAmt * previewBatchSize;

                                            return (
                                                <tr key={idx} className="hover:bg-ui-accent/5">
                                                    <td className="p-3 font-extrabold text-ui-black">
                                                        {item.ingredient?.name || "Nieokreślony surowiec"}
                                                    </td>
                                                    <td className="p-3 text-right text-ui-secondary font-medium">
                                                        {singleAmt < 1 && item.ingredientUnit === "kg"
                                                            ? `${(singleAmt * 1000).toFixed(0)} g`
                                                            : `${singleAmt.toFixed(3)} ${item.ingredientUnit}`}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-ui-primary/80 bg-ui-accent/20 text-sm">
                                                        {totalAmt < 1 && item.ingredientUnit === "kg"
                                                            ? `${(totalAmt * 1000).toFixed(0)} g`
                                                            : `${totalAmt.toFixed(2)} ${item.ingredientUnit}`}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: Skrajnie Uproszczony Formularz Dodawania Przepisu */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsAddModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-ui-accent flex items-center justify-between bg-amber-50/50">
                            <h2 className="text-lg font-bold text-ui-black">Dodaj Nowy Przepis</h2>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-1.5 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRecipe} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                            {/* 1. Podstawowe Dane */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block font-bold text-ui-secondary uppercase mb-1">
                                        Nazwa *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="np. Chleb Wiejski 600g"
                                        value={newRecipeName}
                                        onChange={(e) => setNewRecipeName(e.target.value)}
                                        className="w-full bg-ui-white border border-ui-accent rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-ui-secondary"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-ui-secondary uppercase mb-1">
                                        Kategoria *
                                    </label>
                                    <select
                                        value={newRecipeType}
                                        onChange={(e) => setNewRecipeType(e.target.value as ProductType)}
                                        className="w-full bg-ui-white border border-ui-accent rounded-xl px-2.5 py-2 text-xs font-bold text-ui-primary focus:outline-none cursor-pointer"
                                    >
                                        <option value="BREAD">Chleb</option>
                                        <option value="ROLL">Bułka</option>
                                        <option value="SWEET">Słodkie wypieki</option>
                                        <option value="SAVORY">Słone wypieki</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 bg-ui-accent/10 p-3 rounded-xl">
                                <div>
                                    <label className="block font-bold text-ui-secondary uppercase mb-1">
                                        Deklaracja Partii (Sztuki) *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={recipeBatchSize}
                                        onChange={(e) => setRecipeBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full bg-ui-white border border-ui-accent rounded-xl px-3 py-2 text-xs font-bold text-center focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-ui-secondary uppercase mb-1">
                                        Cena Sprzedaży (zł brutto)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.10"
                                        value={newRecipeSellingPrice}
                                        onChange={(e) => setNewRecipeSellingPrice(e.target.value)}
                                        className="w-full bg-ui-white border border-ui-accent rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* 2. Prosta sekcja dodawania składników */}
                            <div className="space-y-3">
                                <label className="block font-bold text-ui-black uppercase tracking-wider">
                                    Składniki dla Partii ({recipeBatchSize} szt.) *
                                </label>

                                {/* Wyszukiwarka z autopodpowiedzią */}
                                <div className="relative">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-ui-secondary" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Wpisz i wybierz surowiec z bazy (np. mąka, drożdże)..."
                                            value={ingSearchInput}
                                            onChange={(e) => setIngSearchInput(e.target.value)}
                                            className="w-full bg-amber-50/50 border border-amber-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-amber-950 focus:outline-none focus:border-amber-500"
                                        />
                                    </div>

                                    {/* Lista podpowiedzi po wpisaniu tekstu */}
                                    {ingSearchInput.trim().length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-ui-white border border-ui-accent rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-ui-accent/40">
                                            {suggestedIngredients.length === 0 ? (
                                                <div className="p-3 text-center text-ui-secondary italic">
                                                    Brak nieprzypisanych surowców o tej nazwie
                                                </div>
                                            ) : (
                                                suggestedIngredients.map((ing) => (
                                                    <button
                                                        key={ing.id}
                                                        type="button"
                                                        onClick={() => handleSelectIngredient(ing)}
                                                        className="w-full text-left p-2.5 hover:bg-amber-50 transition-colors flex items-center justify-between font-semibold text-ui-black cursor-pointer"
                                                    >
                                                        <span>{ing.name}</span>
                                                        <span className="text-[10px] text-ui-secondary">[{ing.unit}]</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Lista zadeklarowanych składników w przepisie */}
                                <div className="border border-ui-accent rounded-xl divide-y divide-ui-accent/40 bg-ui-white">
                                    {recipeIngredients.length === 0 ? (
                                        <div className="p-6 text-center text-ui-secondary italic">
                                            Wpisz nazwę surowca w polu powyżej, aby dodać go do przepisu.
                                        </div>
                                    ) : (
                                        recipeIngredients.map((item) => (
                                            <div key={item.ingredientId} className="p-3 flex items-center justify-between gap-3 hover:bg-ui-accent/5">
                                                <span className="font-bold text-ui-black flex-1">{item.name}</span>

                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-ui-secondary">Łączna waga:</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.batchAmount}
                                                        onChange={(e) => handleAmountChange(item.ingredientId, e.target.value)}
                                                        className="w-20 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 text-center font-extrabold text-amber-950 focus:outline-none"
                                                    />
                                                    <span className="font-bold text-ui-secondary w-6">{item.unit}</span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveIngredient(item.ingredientId)}
                                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Stopka Modala */}
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
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                                    Zapisz Przepis
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}