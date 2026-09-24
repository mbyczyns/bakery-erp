"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Search,
    Loader2,
    X,
    Trash2,
    ChevronRight,
    Calculator,
    Layers,
    ChefHat,
    BadgePercent,
    ChevronDown,
    Pencil,
    Sparkles,
    CheckCircle2,
    ArrowUp,
    ArrowDown
} from "lucide-react";

type ProductType = "BREAD" | "ROLL" | "SWEET" | "SAVORY";
type MainTab = "ALL" | ProductType | "SEMI_FINISHED";

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
    BREAD: "Chleb",
    ROLL: "Bułka",
    SWEET: "Wypiek słodki",
    SAVORY: "Wypiek słony",
};

interface DictionaryIngredient {
    id: string;
    name: string;
    unit: string;
}

interface SemiFinishedItem {
    id: string;
    name: string;
    unit: string;
    cost: number | string;
    ingredients: {
        id: string;
        amount: number | string;
        unit: string;
        ingredient: DictionaryIngredient;
    }[];
}

interface RecipeIngredientItem {
    id?: string;
    amount: number | string;
    ingredientUnit: string;
    order?: number;
    ingredientId?: string | null;
    ingredient?: DictionaryIngredient | null;
    semiFinishedId?: string | null;
    semiFinished?: { id: string; name: string; unit: string; cost: number | string } | null;
}

interface Recipe {
    id: string;
    name: string;
    type: ProductType;
    productionCost: number | string;
    sellingPrice: number | string;
    packagingCost?: number | string;
    ingredients: RecipeIngredientItem[];
}

export default function PrzepisyPage() {
    const router = useRouter();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [semiFinishedList, setSemiFinishedList] = useState<SemiFinishedItem[]>([]);
    const [dbIngredients, setDbIngredients] = useState<DictionaryIngredient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<MainTab>("ALL");

    // Modal podglądu wypieku
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [previewBatchSize, setPreviewBatchSize] = useState<number>(1);

    // Modal podglądu półproduktu
    const [selectedSemiFinished, setSelectedSemiFinished] = useState<SemiFinishedItem | null>(null);
    const [previewSemiBatch, setPreviewSemiBatch] = useState<number>(1);

    // Modal dodawania / edycji (Uniwersalny: Wypiek LUB Półprodukt)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingSemiFinishedId, setEditingSemiFinishedId] = useState<string | null>(null);
    const [creationKind, setCreationKind] = useState<"PRODUCT" | "SEMI_FINISHED">("PRODUCT");

    // Szybkie tworzenie składnika
    const [isCreateIngredientOpen, setIsCreateIngredientOpen] = useState(false);
    const [quickIngredientName, setQuickIngredientName] = useState("");
    const [quickIngredientType, setQuickIngredientType] = useState("");
    const [quickIngredientUnit, setQuickIngredientUnit] = useState("kg");
    const [isCreatingQuickIngredient, setIsCreatingQuickIngredient] = useState(false);

    // Pola formularza
    const [newName, setNewName] = useState("");
    const [newProductType, setNewProductType] = useState<ProductType>("BREAD");
    const [newSellingPrice, setNewSellingPrice] = useState<string>("0");
    const [newPackagingCost, setNewPackagingCost] = useState<string>("0");
    const [newSemiUnit, setNewSemiUnit] = useState<string>("kg");
    const [batchSize, setBatchSize] = useState<string>("10");

    // Pozycje w formularzu (mogą być surowcem lub półproduktem)
    const [formItems, setFormItems] = useState<
        {
            id: string;
            kind: "INGREDIENT" | "SEMI_FINISHED";
            name: string;
            unit: string;
            batchAmount: string;
        }[]
    >([]);

    const [searchInput, setSearchInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [resRecipes, resSemi, resDict] = await Promise.all([
                fetch("/api/przepisy"),
                fetch("/api/polprodukty"),
                fetch("/api/dictionaries"),
            ]);

            if (resRecipes.ok) {
                const data = await resRecipes.json();
                setRecipes(data.recipes || []);
            }
            if (resSemi.ok) {
                const data = await resSemi.json();
                setSemiFinishedList(data.semiFinished || []);
            }
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

    // Dodanie surowca lub półproduktu do formularza
    const handleSelectItem = (
        id: string,
        kind: "INGREDIENT" | "SEMI_FINISHED",
        name: string,
        unit: string
    ) => {
        if (formItems.some((i) => i.id === id && i.kind === kind)) return;

        setFormItems((prev) => [
            ...prev,
            { id, kind, name, unit, batchAmount: "1.0" },
        ]);
        setSearchInput("");
    };

    const handleRemoveItem = (id: string, kind: string) => {
        setFormItems((prev) => prev.filter((i) => !(i.id === id && i.kind === kind)));
    };

    const handleAmountChange = (id: string, kind: string, amount: string) => {
        setFormItems((prev) =>
            prev.map((i) => (i.id === id && i.kind === kind ? { ...i, batchAmount: amount } : i))
        );
    };

    const handleMoveItem = (index: number, direction: "UP" | "DOWN") => {
        setFormItems((prev) => {
            const newItems = [...prev];
            const targetIndex = direction === "UP" ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= newItems.length) return prev;
            const temp = newItems[index];
            newItems[index] = newItems[targetIndex];
            newItems[targetIndex] = temp;
            return newItems;
        });
    };

    const openEditSemiFinished = (semi: SemiFinishedItem) => {
        setEditingSemiFinishedId(semi.id);
        setCreationKind("SEMI_FINISHED");
        setNewName(semi.name);
        setNewSemiUnit(semi.unit || "kg");
        setBatchSize("1");
        setFormItems(
            semi.ingredients.map((item) => ({
                id: item.ingredient.id,
                kind: "INGREDIENT" as const,
                name: item.ingredient.name,
                unit: item.unit || item.ingredient.unit,
                batchAmount: Number(item.amount || 0).toString(),
            }))
        );
        setIsAddModalOpen(true);
    };

    const handleSaveQuickIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickIngredientName.trim()) {
            alert("Wprowadź nazwę składnika!");
            return;
        }
        if (!quickIngredientType) {
            alert("Wybierz typ / kategorię składnika!");
            return;
        }
        setIsCreatingQuickIngredient(true);
        try {
            const res = await fetch("/api/skladniki", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: quickIngredientName.trim(),
                    type: quickIngredientType,
                    unit: quickIngredientUnit,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Nie udało się utworzyć składnika");
            }
            const data = await res.json();
            const newIng: DictionaryIngredient = {
                id: data.ingredient?.id || data.id,
                name: data.ingredient?.name || quickIngredientName.trim(),
                unit: data.ingredient?.unit || quickIngredientUnit,
            };

            setDbIngredients((prev) => [...prev, newIng]);
            handleSelectItem(newIng.id, "INGREDIENT", newIng.name, newIng.unit);
            setQuickIngredientName("");
            setQuickIngredientType("");
            setQuickIngredientUnit("kg");
            setIsCreateIngredientOpen(false);
        } catch (error: any) {
            alert(`Błąd: ${error.message || "Nie udało się utworzyć składnika"}`);
        } finally {
            setIsCreatingQuickIngredient(false);
        }
    };

    // Zapis formularza (POST / PATCH)
    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) {
            alert("Wprowadź nazwę!");
            return;
        }
        if (formItems.length === 0) {
            alert("Dodaj przynajmniej jeden składnik lub półprodukt do receptury!");
            return;
        }

        const cleanBatchStr = batchSize.toString().replace(",", ".").trim();
        const batchNum = parseFloat(cleanBatchStr);
        if (isNaN(batchNum) || batchNum <= 0) {
            alert("Wprowadź prawidłową wielkość partii (liczbę większą od 0)!");
            return;
        }

        // Walidacja ilości składników
        for (const item of formItems) {
            const cleanAmtStr = item.batchAmount.toString().replace(",", ".").trim();
            const amtNum = parseFloat(cleanAmtStr);
            if (isNaN(amtNum) || amtNum <= 0) {
                alert(`Wprowadź poprawną ilość dla pozycji "${item.name}" (większą od 0)!`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            if (editingSemiFinishedId) {
                // Edycja Półproduktu (PATCH)
                const payload = {
                    name: newName.trim(),
                    unit: newSemiUnit,
                    amount: batchNum,
                    ingredients: formItems.map((item, index) => {
                        const cleanAmtStr = item.batchAmount.toString().replace(",", ".").trim();
                        const amtNum = parseFloat(cleanAmtStr) || 0;
                        return {
                            ingredientId: item.id,
                            amount: amtNum / batchNum,
                            unit: item.unit,
                            order: index,
                        };
                    }),
                };

                const res = await fetch(`/api/polprodukty/${editingSemiFinishedId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Nie udało się zaktualizować półproduktu");
                }
            } else if (creationKind === "PRODUCT") {
                const singleUnitIngredients = formItems.map((item, index) => {
                    const cleanAmtStr = item.batchAmount.toString().replace(",", ".").trim();
                    const amtNum = parseFloat(cleanAmtStr) || 0;
                    return {
                        amount: amtNum / batchNum,
                        unit: item.unit,
                        order: index,
                        ingredientId: item.kind === "INGREDIENT" ? item.id : null,
                        semiFinishedId: item.kind === "SEMI_FINISHED" ? item.id : null,
                    };
                });

                const cleanPackagingCost = parseFloat(newPackagingCost.replace(",", ".").trim()) || 0;

                const res = await fetch("/api/przepisy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: newName.trim(),
                        type: newProductType,
                        sellingPrice: 0,
                        packagingCost: cleanPackagingCost,
                        ingredients: singleUnitIngredients,
                    }),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Nie udało się zapisać przepisu");
                }
            } else {
                // Zapis nowego Półproduktu (POST)
                const payload = {
                    name: newName.trim(),
                    unit: newSemiUnit,
                    amount: batchNum,
                    ingredients: formItems.map((item, index) => {
                        const cleanAmtStr = item.batchAmount.toString().replace(",", ".").trim();
                        const amtNum = parseFloat(cleanAmtStr) || 0;
                        return {
                            ingredientId: item.id,
                            amount: amtNum / batchNum,
                            unit: item.unit,
                            order: index,
                        };
                    }),
                };

                const res = await fetch("/api/polprodukty", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Nie udało się zapisać półproduktu");
                }
            }

            // Reset formularza
            setNewName("");
            setNewSellingPrice("0");
            setNewPackagingCost("0");
            setBatchSize("10");
            setFormItems([]);
            setEditingSemiFinishedId(null);
            setIsAddModalOpen(false);
            await fetchData();
        } catch (error: any) {
            alert(`Błąd: ${error.message || "Nie udało się zapisać"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filtry list
    const filteredRecipes = recipes
        .filter((r) => activeTab === "ALL" || r.type === activeTab)
        .filter((r) => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const filteredSemiFinished = semiFinishedList.filter((s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Wyszukiwarka elementów w modalu (surowce + ewentualnie inne półprodukty)
    const availableIngredients = dbIngredients
        .filter((i) => !formItems.some((fi) => fi.id === i.id && fi.kind === "INGREDIENT"))
        .filter((i) => i.name.toLowerCase().includes(searchInput.toLowerCase()));

    const availableSemiFinished = (creationKind === "PRODUCT" && !editingSemiFinishedId ? semiFinishedList : [])
        .filter((s) => !formItems.some((fi) => fi.id === s.id && fi.kind === "SEMI_FINISHED"))
        .filter((s) => s.name.toLowerCase().includes(searchInput.toLowerCase()));

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">
            {/* Nagłówek */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ui-black">
                        Przepisy i foodcosty
                    </h1>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => {
                            setEditingSemiFinishedId(null);
                            setCreationKind("PRODUCT");
                            setNewProductType(activeTab === "SEMI_FINISHED" || activeTab === "ALL" ? "BREAD" : activeTab);
                            setBatchSize("10");
                            setNewPackagingCost("0");
                            setNewName("");
                            setFormItems([]);
                            setIsAddModalOpen(true);
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                    >
                        <Plus size={16} />
                        Nowy przepis
                    </button>
                </div>
            </div>

            {/* Zakładki */}
            <div className="flex border-b border-ui-accent mb-6 gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
                {(
                    [
                        { id: "ALL", label: "Wszystkie" },
                        { id: "BREAD", label: "Chleby" },
                        { id: "ROLL", label: "Bułki" },
                        { id: "SWEET", label: "Wypieki słodkie" },
                        { id: "SAVORY", label: "Wypieki słone" },
                        { id: "SEMI_FINISHED", label: "Półprodukty" },
                    ] as { id: MainTab; label: string; icon?: any }[]
                ).map((tab) => {
                    const isActive = activeTab === tab.id;
                    const count =
                        tab.id === "ALL"
                            ? recipes.length
                            : tab.id === "SEMI_FINISHED"
                            ? semiFinishedList.length
                            : recipes.filter((r) => r.type === tab.id).length;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${isActive
                                ? "border-amber-600 text-amber-900 bg-amber-50/70 rounded-t-xl font-bold"
                                : "border-transparent text-ui-secondary hover:text-ui-primary"
                                }`}
                        >
                            {tab.icon && <tab.icon size={15} />}
                            {tab.label}
                            <span className="bg-amber-200/80 text-amber-950 text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-bold ml-1">
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Wyszukiwarka */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder="Szukaj po nazwie..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary transition-all text-sm"
                />
            </div>

            {/* TABELA GŁÓWNA */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                            <th className="p-4">Nazwa</th>
                            <th className="p-4 text-right">
                                {activeTab === "SEMI_FINISHED" ? "Koszt wytworzenia" : "Cena Sprzedaży"}
                            </th>
                            <th className="p-4 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-ui-accent/40 text-sm">
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="p-12 text-center text-ui-secondary">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 size={18} className="animate-spin text-amber-600" />
                                        Ładowanie danych...
                                    </div>
                                </td>
                            </tr>
                        ) : activeTab === "SEMI_FINISHED" ? (
                            filteredSemiFinished.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-ui-secondary italic">
                                        Nie znaleziono półproduktów.
                                    </td>
                                </tr>
                            ) : (
                                filteredSemiFinished.map((semi) => (
                                    <tr
                                        key={semi.id}
                                        onClick={() => {
                                            setSelectedSemiFinished(semi);
                                            setPreviewSemiBatch(1);
                                        }}
                                        className="hover:bg-ui-accent/10 transition-colors cursor-pointer group"
                                    >
                                        <td className="p-4 text-ui-black group-hover:text-ui-primary transition-colors">
                                            <div className="flex items-center gap-2">
                                                <span>{semi.name}</span>
                                                <span className="text-xs text-ui-secondary font-normal">
                                                    ({semi.unit})
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right text-ui-black">
                                            {Number(semi.cost || 0).toFixed(2)} zł / {semi.unit}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSemiFinished(semi);
                                                        setPreviewSemiBatch(1);
                                                    }}
                                                    className="flex items-center gap-1 text-xs font-semibold border border-ui-accent hover:bg-ui-accent/30 text-ui-primary px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    Receptura
                                                    <ChevronRight size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditSemiFinished(semi);
                                                    }}
                                                    className="flex items-center gap-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                    title="Edytuj recepturę"
                                                >
                                                    <Pencil size={13} />
                                                    Edytuj
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )
                        ) : filteredRecipes.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="p-8 text-center text-ui-secondary italic">
                                    Nie znaleziono przepisów.
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
                                    <td className="p-4 text-ui-black group-hover:text-ui-primary transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{recipe.name}</span>
                                            {activeTab === "ALL" && (
                                                <span className="text-[10px] bg-ui-accent/20 text-ui-secondary border border-ui-accent/40 px-2 py-0.5 rounded-md font-bold">
                                                    {PRODUCT_TYPE_LABELS[recipe.type] || recipe.type}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right text-ui-black">
                                        {Number(recipe.sellingPrice || 0).toFixed(2)} zł
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/przepisy/${recipe.id}`);
                                            }}
                                            className="flex items-center gap-1 mx-auto text-xs font-semibold bg-ui-accent/15 hover:bg-ui-accent/10 text-ui-primary border border-ui-accent px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                                        >
                                            Foodcost
                                            <ChevronRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL 1: Podgląd Wypieku */}
            {selectedRecipe && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedRecipe(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-ui-accent  flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-ui-black">{selectedRecipe.name}</h2>
                                <p className="text-xs text-ui-primary mt-0.5">
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

                            <div className="border border-ui-accent rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-ui-accent/20 text-ui-secondary font-bold uppercase border-b border-ui-accent">
                                            <th className="p-3">Składnik / Półprodukt</th>
                                            <th className="p-3 text-right">Na 1 szt.</th>
                                            <th className="p-3 text-right text-ui-primary/80 font-extrabold bg-ui-accent/30">
                                                Dla {previewBatchSize} szt.
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/40">
                                        {selectedRecipe.ingredients.map((item, idx) => {
                                            const singleAmt = Number(item.amount || 0);
                                            const totalAmt = singleAmt * previewBatchSize;
                                            const displayName = item.semiFinished
                                                ? `[Półprodukt] ${item.semiFinished.name}`
                                                : item.ingredient?.name || "Nieokreślony";

                                            return (
                                                <tr key={idx} className="hover:bg-ui-accent/5">
                                                    <td className="p-3 font-extrabold text-ui-black">
                                                        {displayName}
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

                        {/* Stopka z linkiem do pełnej karty receptury i kalkulatora */}
                        <div className="p-4 border-t border-ui-accent  flex items-end justify-end">

                            <button
                                onClick={() => router.push(`/przepisy/${selectedRecipe.id}`)}
                                className=" flex gap-1  text-xs font-semibold bg-ui-accent/15 hover:bg-ui-accent/10 text-ui-primary border border-ui-accent px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                            >
                                Pełny foodcost, marża i historia
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: Podgląd Półproduktu */}
            {selectedSemiFinished && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedSemiFinished(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-ui-accent bg-amber-50/50 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Layers size={20} className="text-amber-800" />
                                    <h2 className="text-xl font-bold text-ui-black">{selectedSemiFinished.name}</h2>
                                </div>
                                <p className="text-xs text-ui-secondary mt-0.5">
                                    Koszt jednostkowy: <b>{Number(selectedSemiFinished.cost || 0).toFixed(2)} zł / {selectedSemiFinished.unit}</b>
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedSemiFinished(null)}
                                className="p-1.5 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 flex-1">
                            <div className="flex items-center justify-between bg-amber-100/60 border border-amber-300/80 p-3.5 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Calculator size={18} className="text-amber-800" />
                                    <span className="text-xs font-bold text-amber-950">Przelicz ilość do przygotowania:</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.5"
                                        value={previewSemiBatch}
                                        onChange={(e) => setPreviewSemiBatch(Math.max(0.1, parseFloat(e.target.value) || 1))}
                                        className="w-20 bg-ui-white border border-amber-400 rounded-lg px-2 py-1 text-center font-extrabold text-sm text-amber-950 focus:outline-none"
                                    />
                                    <span className="text-xs font-bold text-amber-950">{selectedSemiFinished.unit}</span>
                                </div>
                            </div>

                            <div className="border border-ui-accent rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-ui-accent/20 text-ui-secondary font-bold uppercase border-b border-ui-accent">
                                            <th className="p-3">Surowiec bazowy</th>
                                            <th className="p-3 text-right">Na 1 {selectedSemiFinished.unit}</th>
                                            <th className="p-3 text-right text-ui-primary/80 font-extrabold bg-ui-accent/30">
                                                Wymagane na {previewSemiBatch} {selectedSemiFinished.unit}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/40">
                                        {selectedSemiFinished.ingredients.map((item, idx) => {
                                            const singleAmt = Number(item.amount || 0);
                                            const totalAmt = singleAmt * previewSemiBatch;

                                            return (
                                                <tr key={idx} className="hover:bg-ui-accent/5">
                                                    <td className="p-3 font-extrabold text-ui-black">
                                                        {item.ingredient?.name || "Surowiec"}
                                                    </td>
                                                    <td className="p-3 text-right text-ui-secondary font-medium">
                                                        {singleAmt < 1 && item.unit === "kg"
                                                            ? `${(singleAmt * 1000).toFixed(0)} g`
                                                            : `${singleAmt.toFixed(3)} ${item.unit}`}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-ui-primary/80 bg-ui-accent/20 text-sm">
                                                        {totalAmt < 1 && item.unit === "kg"
                                                            ? `${(totalAmt * 1000).toFixed(0)} g`
                                                            : `${totalAmt.toFixed(2)} ${item.unit}`}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Stopka z edycją półproduktu */}
                        <div className="p-4 border-t border-ui-accent bg-amber-50/30 flex items-center justify-between">
                            <button
                                onClick={() => setSelectedSemiFinished(null)}
                                className="px-4 py-2 rounded-xl border border-ui-accent text-ui-secondary hover:text-ui-primary font-semibold text-xs transition-colors cursor-pointer"
                            >
                                Zamknij
                            </button>
                            <button
                                onClick={() => {
                                    const currentSemi = selectedSemiFinished;
                                    setSelectedSemiFinished(null);
                                    openEditSemiFinished(currentSemi);
                                }}
                                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                            >
                                <Pencil size={14} />
                                Edytuj recepturę
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: Uniwersalny Formularz Tworzenia / Edycji */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => {
                        setIsAddModalOpen(false);
                        setEditingSemiFinishedId(null);
                    }}
                >
                    <div
                        className="bg-ui-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Nagłówek Modalu */}
                        <div className="px-6 py-4 border-b border-ui-accent flex items-center justify-between bg-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-ui-accent/10 rounded-xl text-ui-primary shadow-sm">
                                    {editingSemiFinishedId ? <Pencil size={22} className="text-amber-700" /> : creationKind === "PRODUCT" ? <ChefHat size={22} /> : <Layers size={22} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-ui-black leading-tight">
                                        {editingSemiFinishedId
                                            ? `Edycja półproduktu: ${newName || "Receptura"}`
                                            : creationKind === "PRODUCT"
                                                ? "Nowy przepis"
                                                : "Nowy półprodukt"}
                                    </h2>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setIsAddModalOpen(false);
                                    setEditingSemiFinishedId(null);
                                }}
                                className="p-2 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                                title="Zamknij"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitForm} className="p-6 md:p-7 space-y-6 overflow-y-auto flex-1 text-sm">
                            {/* Wybór typu formularza (tylko w trybie tworzenia nowego) */}
                            {!editingSemiFinishedId && (
                                <div className="grid grid-cols-2 gap-2 bg-ui-accent/10 p-1.5 rounded-xl border border-ui-accent/40">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreationKind("PRODUCT");
                                            setBatchSize("10");
                                        }}
                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${creationKind === "PRODUCT"
                                            ? "bg-ui-primary text-ui-white shadow-sm"
                                            : "text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/10"
                                            }`}
                                    >
                                        <ChefHat size={17} />
                                        Wypiek gotowy
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreationKind("SEMI_FINISHED");
                                            setBatchSize("1");
                                        }}
                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${creationKind === "SEMI_FINISHED"
                                            ? "bg-ui-primary text-ui-white shadow-sm"
                                            : "text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/10"
                                            }`}
                                    >
                                        <Layers size={17} />
                                        Półprodukt
                                    </button>
                                </div>
                            )}

                            {/* Dane podstawowe */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Nazwa wyrobu / półproduktu */}
                                <div className={creationKind === "PRODUCT" ? "md:col-span-4" : "md:col-span-6"}>
                                    <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                        Nazwa {creationKind === "PRODUCT" ? "wyrobu" : "półproduktu"}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder={
                                            creationKind === "PRODUCT"
                                                ? "np. Chleb Żytni 500g"
                                                : "np. Zaczyn żytni / Kruszonka"
                                        }
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl px-3.5 py-2 text-sm text-ui-black placeholder:text-ui-secondary/50 focus:outline-none focus:border-amber-600 transition-all shadow-sm"
                                    />
                                </div>

                                {/* Kategoria dla wyrobu + Koszt opakowania LUB Jednostka dla półproduktu */}
                                {creationKind === "PRODUCT" ? (
                                    <>
                                        <div className="md:col-span-3">
                                            <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                                Kategoria
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={newProductType}
                                                    onChange={(e) => setNewProductType(e.target.value as ProductType)}
                                                    className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl pl-3.5 pr-9 py-2 text-sm text-ui-black focus:outline-none focus:border-amber-600 cursor-pointer transition-all appearance-none shadow-sm"
                                                >
                                                    <option value="BREAD">Chleb</option>
                                                    <option value="ROLL">Bułka</option>
                                                    <option value="SWEET">Słodkie</option>
                                                    <option value="SAVORY">Słone</option>
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5 truncate" title="Koszt opakowania (zł / szt.)">
                                                Koszt opakowania
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={newPackagingCost}
                                                    onChange={(e) => setNewPackagingCost(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl pl-3 pr-11 py-2 text-sm font-semibold text-ui-black focus:outline-none focus:border-amber-600 transition-all shadow-sm"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ui-secondary bg-ui-accent/15 px-1.5 py-0.5 rounded pointer-events-none font-bold">
                                                    zł
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                            Jednostka miary
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={newSemiUnit}
                                                onChange={(e) => setNewSemiUnit(e.target.value)}
                                                className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl pl-3.5 pr-9 py-2 text-sm text-ui-black focus:outline-none focus:border-amber-600 cursor-pointer transition-all appearance-none shadow-sm"
                                            >
                                                <option value="kg">kg (kilogram)</option>
                                                <option value="l">l (litr)</option>
                                                <option value="szt">szt (sztuka)</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Deklaracja partii */}
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5 truncate">
                                        {creationKind === "PRODUCT" ? "Deklaracja partii" : "Ilość partii bazowej"}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            required
                                            value={batchSize}
                                            onChange={(e) => setBatchSize(e.target.value)}
                                            placeholder={creationKind === "PRODUCT" ? "10" : "1"}
                                            className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl pl-3.5 pr-14 py-2 text-sm text-ui-black focus:outline-none focus:border-amber-600 transition-all shadow-sm"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ui-secondary bg-ui-accent/15 px-2 py-0.5 rounded pointer-events-none">
                                            {creationKind === "PRODUCT" ? "szt." : newSemiUnit}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Składniki i Półprodukty w przepisie */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-ui-black uppercase tracking-wider">
                                        Składniki dla partii ({batchSize || "1"} {creationKind === "PRODUCT" ? "szt." : newSemiUnit})
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateIngredientOpen(true)}
                                            className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-100/70 hover:bg-amber-100 border border-amber-300/80 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Plus size={13} />
                                            Nowy składnik
                                        </button>
                                        <span className="text-xs text-ui-secondary font-medium">
                                            Pozycji: <b>{formItems.length}</b>
                                        </span>
                                    </div>
                                </div>

                                {/* Wyszukiwarka surowców i półproduktów */}
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-3 text-ui-secondary" size={17} />
                                    <input
                                        type="text"
                                        placeholder="Wyszukaj i wybierz składnik lub półprodukt..."
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        className="w-full h-11 border border-ui-accent rounded-xl pl-10 pr-3 py-2 text-sm font-medium text-ui-primary focus:outline-none focus:border-amber-600 shadow-sm"
                                    />

                                    {searchInput.trim().length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-ui-white border border-ui-accent rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-ui-accent/40">
                                            {availableIngredients.length === 0 && availableSemiFinished.length === 0 ? (
                                                <div className="p-4 text-center text-ui-secondary text-xs">
                                                    <p className="italic mb-2">Nie znaleziono pozycji &quot;{searchInput}&quot;</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setQuickIngredientName(searchInput.trim());
                                                            setIsCreateIngredientOpen(true);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-all cursor-pointer"
                                                    >
                                                        <Plus size={14} />
                                                        Utwórz &quot;{searchInput.trim()}&quot; jako nowy składnik
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {availableSemiFinished.map((semi) => (
                                                        <button
                                                            key={`semi-${semi.id}`}
                                                            type="button"
                                                            onClick={() =>
                                                                handleSelectItem(semi.id, "SEMI_FINISHED", semi.name, semi.unit)
                                                            }
                                                            className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-center justify-between font-bold text-amber-950 cursor-pointer bg-amber-50/40"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Layers size={15} className="text-amber-700" />
                                                                <span>{semi.name}</span>
                                                                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                                                                    PÓŁPRODUKT
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-semibold text-ui-secondary">[{semi.unit}]</span>
                                                        </button>
                                                    ))}

                                                    {availableIngredients.map((ing) => (
                                                        <button
                                                            key={`ing-${ing.id}`}
                                                            type="button"
                                                            onClick={() =>
                                                                handleSelectItem(ing.id, "INGREDIENT", ing.name, ing.unit)
                                                            }
                                                            className="w-full text-left px-4 py-3 hover:bg-amber-50/60 transition-colors flex items-center justify-between font-semibold text-ui-black cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span>{ing.name}</span>
                                                                <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded border border-slate-200">
                                                                    SUROWIEC
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-semibold text-ui-secondary">[{ing.unit}]</span>
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Lista zadeklarowanych składników */}
                                <div className="border border-ui-accent rounded-xl overflow-hidden divide-y divide-ui-accent/40 bg-ui-white shadow-sm">
                                    {formItems.length === 0 ? (
                                        <div className="p-8 text-center text-ui-secondary text-xs italic">
                                            Wyszukaj i wybierz składniki powyżej, aby dodać je do receptury.
                                        </div>
                                    ) : (
                                        formItems.map((item, index) => {
                                            const currentBatchNum = parseFloat(batchSize.replace(",", ".")) || 1;
                                            const currentItemAmt = parseFloat(item.batchAmount.replace(",", ".")) || 0;
                                            const perUnitAmt = currentItemAmt / currentBatchNum;

                                            return (
                                                <div
                                                    key={`${item.kind}-${item.id}`}
                                                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ui-accent/5 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-0.5 shrink-0 bg-ui-accent/10 p-1 rounded-lg border border-ui-accent/40">
                                                            <button
                                                                type="button"
                                                                disabled={index === 0}
                                                                onClick={() => handleMoveItem(index, "UP")}
                                                                className="p-1 text-ui-secondary hover:text-ui-black hover:bg-ui-accent/20 rounded transition-colors disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                                                title="Przesuń w górę"
                                                            >
                                                                <ArrowUp size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={index === formItems.length - 1}
                                                                onClick={() => handleMoveItem(index, "DOWN")}
                                                                className="p-1 text-ui-secondary hover:text-ui-black hover:bg-ui-accent/20 rounded transition-colors disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                                                title="Przesuń w dół"
                                                            >
                                                                <ArrowDown size={13} />
                                                            </button>
                                                        </div>

                                                        <span className="text-xs font-bold text-ui-secondary w-5 text-center shrink-0">
                                                            {index + 1}.
                                                        </span>

                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 truncate">
                                                            <span className="font-bold text-ui-black text-sm truncate">
                                                                {item.name}
                                                            </span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold w-fit ${item.kind === "SEMI_FINISHED" ? "bg-amber-100 text-amber-900 border border-amber-200" : "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                                                                {item.kind === "SEMI_FINISHED" ? "Półprodukt" : "Surowiec"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs text-ui-secondary font-medium">Ilość:</span>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={item.batchAmount}
                                                                onChange={(e) => handleAmountChange(item.id, item.kind, e.target.value)}
                                                                placeholder="1.0"
                                                                className="w-24 h-9 bg-amber-50/70 border border-amber-300 rounded-lg px-2.5 text-center font-extrabold text-sm text-amber-950 focus:outline-none focus:border-amber-600 focus:bg-white transition-all shadow-sm"
                                                            />
                                                            <span className="font-bold text-ui-secondary text-xs w-7">{item.unit}</span>
                                                        </div>

                                                        <div className="hidden md:block text-[11px] text-ui-secondary bg-ui-accent/10 px-2 py-1 rounded font-medium">
                                                            ≈ {perUnitAmt < 1 && item.unit === "kg"
                                                                ? `${(perUnitAmt * 1000).toFixed(1)} g`
                                                                : `${perUnitAmt.toFixed(3)} ${item.unit}`} / {creationKind === "PRODUCT" ? "szt." : newSemiUnit}
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(item.id, item.kind)}
                                                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Usuń z receptury"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Stopka */}
                            <div className="pt-4 border-t border-ui-accent flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAddModalOpen(false);
                                        setEditingSemiFinishedId(null);
                                    }}
                                    className="px-5 py-2.5 rounded-xl border border-ui-accent text-ui-primary font-semibold text-sm hover:bg-ui-accent/20 transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={16} />
                                    )}
                                    {editingSemiFinishedId ? "Zaktualizuj recepturę" : creationKind === "PRODUCT" ? "Zapisz przepis" : "Zapisz półprodukt"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: Szybkie dodawanie składnika */}
            {isCreateIngredientOpen && (
                <div
                    className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
                    onClick={() => setIsCreateIngredientOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-ui-accent"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-ui-accent bg-amber-50/60 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-ui-black flex items-center gap-2">
                                <Sparkles size={18} className="text-amber-700" />
                                Nowy składnik / surowiec
                            </h3>
                            <button
                                onClick={() => setIsCreateIngredientOpen(false)}
                                className="p-1.5 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuickIngredient} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1">
                                    Nazwa składnika <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="np. Drożdże prasowane"
                                    value={quickIngredientName}
                                    onChange={(e) => setQuickIngredientName(e.target.value)}
                                    className="w-full h-10 bg-ui-white border border-ui-accent rounded-xl px-3 text-sm text-ui-black placeholder:text-ui-secondary/50 focus:outline-none focus:border-amber-600 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1">
                                    Kategoria / Typ <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        required
                                        value={quickIngredientType}
                                        onChange={(e) => setQuickIngredientType(e.target.value)}
                                        className="w-full h-10 bg-ui-white border border-ui-accent rounded-xl pl-3 pr-9 text-sm text-ui-black focus:outline-none focus:border-amber-600 cursor-pointer appearance-none shadow-sm"
                                    >
                                        <option value="" disabled>-- Wybierz typ / kategorię --</option>
                                        <option value="Mąka">Mąka</option>
                                        <option value="Ziarna">Ziarna</option>
                                        <option value="Nabiał">Nabiał</option>
                                        <option value="Drożdże">Drożdże</option>
                                        <option value="Tłuszcze">Tłuszcze</option>
                                        <option value="Cukier i słodziki">Cukier i słodziki</option>
                                        <option value="Sól i przyprawy">Sól i przyprawy</option>
                                        <option value="Owoce i warzywa">Owoce i warzywa</option>
                                        <option value="Nasiona i orzechy">Nasiona i orzechy</option>
                                        <option value="Dodatki piekarnicze">Dodatki piekarnicze</option>
                                        <option value="Inne">Inne</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                        <ChevronDown size={15} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1">
                                    Jednostka miary <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={quickIngredientUnit}
                                        onChange={(e) => setQuickIngredientUnit(e.target.value)}
                                        className="w-full h-10 bg-ui-white border border-ui-accent rounded-xl pl-3 pr-9 text-sm text-ui-black focus:outline-none focus:border-amber-600 cursor-pointer appearance-none shadow-sm"
                                    >
                                        <option value="kg">kg (kilogram)</option>
                                        <option value="l">l (litr)</option>
                                        <option value="szt">szt (sztuka)</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                        <ChevronDown size={15} />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-ui-accent flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateIngredientOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold text-xs hover:bg-ui-accent/20 transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingQuickIngredient}
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isCreatingQuickIngredient && <Loader2 size={14} className="animate-spin" />}
                                    Dodaj i wstaw do receptury
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}