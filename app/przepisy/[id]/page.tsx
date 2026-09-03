"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Loader2,
    ChefHat,
    Layers,
    Calculator,
    TrendingUp,
    TrendingDown,
    Save,
    Check,
    Percent,
    Coins,
    BarChart3,
    Calendar,
    AlertCircle,
    Scale,
    PackageCheck,
    ShoppingBag,
    Sparkles,
    Edit3,
    Trash2,
    X,
    Search,
    Plus,
    AlertTriangle,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

interface DetailedIngredient {
    id: string;
    name: string;
    kind: "INGREDIENT" | "SEMI_FINISHED";
    amount: number;
    unit: string;
    unitPrice: number;
    costContribution: number;
    ingredientDetails?: any;
    semiFinishedDetails?: any;
}

interface ProductionHistoryItem {
    id: string;
    date: string;
    producedAmount: number;
    soldAmount: number;
    salesIncome: number;
    unsoldAmount: number;
    efficiencyRate: number;
}

interface RecipeData {
    recipe: {
        id: string;
        name: string;
        type: "BREAD" | "ROLL" | "SWEET" | "SAVORY";
        productionCost: number;
        sellingPrice: number;
        createdAt: string;
    };
    detailedIngredients: DetailedIngredient[];
    totalFoodCost: number;
    productionStats: {
        totalProduced: number;
        totalSold: number;
        totalUnsold: number;
        totalRevenue: number;
        sellThroughRate: number;
        count: number;
    };
    productions: ProductionHistoryItem[];
}

const CATEGORY_NAMES: Record<string, string> = {
    BREAD: "Chleb",
    ROLL: "Bułka",
    SWEET: "Słodkie wypieki",
    SAVORY: "Słone wypieki",
};

export default function PrzepisSzczegolyPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const router = useRouter();
    const { id } = React.use(params);

    const [data, setData] = useState<RecipeData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dynamiczny kalkulator partii w tabeli składników
    const [previewBatchSize, setPreviewBatchSize] = useState<number>(1);

    // Interaktywny kalkulator marży i ceny (stały VAT 5% dla wyrobów piekarniczych)
    const VAT_RATE = 5;
    const [targetMargin, setTargetMargin] = useState<number>(60); // % marży
    const [customGrossPrice, setCustomGrossPrice] = useState<string>("");
    const [calcMode, setCalcMode] = useState<"FROM_MARGIN" | "FROM_PRICE">("FROM_MARGIN");

    // Zapisywanie ceny
    const [isSavingPrice, setIsSavingPrice] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // -------------------------------------------------------------
    // STAN MODALU EDYCJI PRZEPISU
    // -------------------------------------------------------------
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [editType, setEditType] = useState<"BREAD" | "ROLL" | "SWEET" | "SAVORY">("BREAD");
    const [editBatchSize, setEditBatchSize] = useState("1");
    const [editItems, setEditItems] = useState<
        Array<{
            id: string;
            kind: "INGREDIENT" | "SEMI_FINISHED";
            name: string;
            unit: string;
            batchAmount: string;
            unitPrice: number;
        }>
    >([]);
    const [availableIngredients, setAvailableIngredients] = useState<any[]>([]);
    const [availableSemiFinished, setAvailableSemiFinished] = useState<any[]>([]);
    const [editSearchInput, setEditSearchInput] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // -------------------------------------------------------------
    // STAN MODALU USUWANIA PRZEPISU
    // -------------------------------------------------------------
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/przepisy/${id}`);
            if (!res.ok) {
                if (res.status === 404) {
                    setError("Nie znaleziono wybranego przepisu.");
                } else {
                    const err = await res.json().catch(() => ({}));
                    setError(err.error || "Wystąpił błąd podczas ładowania danych.");
                }
                return;
            }
            const json = await res.json();
            setData(json);

            // Jeśli przepis ma już zapisaną cenę sprzedaży, zainicjalizuj kalkulator
            if (json.recipe?.sellingPrice && Number(json.recipe.sellingPrice) > 0) {
                const currentPrice = Number(json.recipe.sellingPrice);
                setCustomGrossPrice(currentPrice.toFixed(2));

                const foodcost = Number(json.totalFoodCost || 0);
                if (foodcost > 0 && currentPrice > 0) {
                    // Cena w bazie to cena netto
                    const calculatedMargin = Math.max(0, ((currentPrice - foodcost) / currentPrice) * 100);
                    setTargetMargin(Math.min(95, Math.round(calculatedMargin)));
                }
            }
        } catch (err: any) {
            console.error("Błąd ładowania szczegółów przepisu:", err);
            setError("Błąd połączenia z serwerem.");
        } finally {
            setIsLoading(false);
        }
    };

    // Otwieranie modalu edycji i przygotowanie danych
    const handleOpenEditModal = async () => {
        if (!data) return;
        setEditName(data.recipe.name);
        setEditType(data.recipe.type);
        setEditBatchSize("1");

        // Mapujemy aktualne składniki
        setEditItems(
            data.detailedIngredients.map((ing) => ({
                id:
                    ing.kind === "SEMI_FINISHED"
                        ? ing.semiFinishedDetails?.id || ing.id
                        : ing.ingredientDetails?.id || ing.id,
                kind: ing.kind,
                name: ing.name,
                unit: ing.unit,
                batchAmount: String(ing.amount),
                unitPrice: ing.unitPrice,
            }))
        );
        setEditSearchInput("");
        setIsEditModalOpen(true);

        // Pobieramy słowniki jeśli jeszcze nie zostały załadowane
        if (availableIngredients.length === 0 || availableSemiFinished.length === 0) {
            try {
                const [resDict, resSemi] = await Promise.all([
                    fetch("/api/dictionaries"),
                    fetch("/api/polprodukty"),
                ]);
                if (resDict.ok) {
                    const dictData = await resDict.json();
                    setAvailableIngredients(dictData.ingredients || []);
                }
                if (resSemi.ok) {
                    const semiData = await resSemi.json();
                    setAvailableSemiFinished(semiData.semiFinished || []);
                }
            } catch (err) {
                console.error("Błąd ładowania słowników do edycji:", err);
            }
        }
    };

    // Dodawanie składnika do edytowanego przepisu
    const handleSelectEditItem = (
        id: string,
        kind: "INGREDIENT" | "SEMI_FINISHED",
        name: string,
        unit: string,
        unitPrice: number
    ) => {
        if (editItems.some((i) => i.id === id && i.kind === kind)) return;

        setEditItems((prev) => [
            ...prev,
            { id, kind, name, unit, batchAmount: "1.0", unitPrice },
        ]);
        setEditSearchInput("");
    };

    // Usuwanie składnika z edycji
    const handleRemoveEditItem = (id: string, kind: string) => {
        setEditItems((prev) => prev.filter((i) => !(i.id === id && i.kind === kind)));
    };

    // Zmiana ilości składnika
    const handleAmountChangeEditItem = (id: string, kind: string, amount: string) => {
        setEditItems((prev) =>
            prev.map((i) => (i.id === id && i.kind === kind ? { ...i, batchAmount: amount } : i))
        );
    };

    // Zapis edycji przepisu
    const handleSaveEditRecipe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editName.trim()) {
            alert("Wprowadź nazwę wyrobu!");
            return;
        }
        if (editItems.length === 0) {
            alert("Przepis musi zawierać co najmniej jeden składnik!");
            return;
        }

        const batchNum = parseFloat(editBatchSize.replace(",", ".").trim()) || 1;
        if (batchNum <= 0) {
            alert("Wprowadź prawidłową wielkość partii (liczbę większą od 0)!");
            return;
        }

        setIsSavingEdit(true);
        try {
            const formattedIngredients = editItems.map((item) => {
                const cleanAmt = parseFloat(item.batchAmount.replace(",", ".").trim()) || 0;
                const perPieceAmt = cleanAmt / batchNum;
                return {
                    amount: perPieceAmt,
                    ingredientUnit: item.unit,
                    ingredientId: item.kind === "INGREDIENT" ? item.id : null,
                    semiFinishedId: item.kind === "SEMI_FINISHED" ? item.id : null,
                };
            });

            const res = await fetch(`/api/przepisy/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName.trim(),
                    type: editType,
                    ingredients: formattedIngredients,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Błąd podczas zapisu zmian w przepisie");
            }

            setIsEditModalOpen(false);
            await fetchData();
        } catch (err: any) {
            alert(`Błąd: ${err.message}`);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Usunięcie przepisu
    const handleDeleteRecipe = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/przepisy/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Błąd podczas usuwania przepisu");
            }

            router.push("/przepisy");
        } catch (err: any) {
            alert(`Błąd: ${err.message}`);
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-ui-white flex items-center justify-center pb-20">
                <div className="flex flex-col items-center gap-3 text-ui-secondary">
                    <Loader2 size={32} className="animate-spin text-amber-600" />
                    <p className="font-medium text-sm">Ładowanie danych receptury i foodcostu...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-ui-white text-ui-primary pb-20 pt-16 flex flex-col items-center justify-center">
                <AlertCircle size={44} className="text-rose-500 mb-3" />
                <p className="text-ui-black font-bold text-lg mb-1">Brak danych przepisu</p>
                <p className="text-ui-secondary text-sm mb-6">{error || "Nie udało się znaleźć przepisu"}</p>
                <button
                    onClick={() => router.push("/przepisy")}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    Powrót do bazy przepisów
                </button>
            </div>
        );
    }

    const { recipe, detailedIngredients, totalFoodCost, productionStats, productions } = data;

    // Obliczenia kalkulatora marży
    const foodCostPerUnit = Math.max(0.001, totalFoodCost);

    // 1. Z marży na cenę:
    // Marża % = (CenaNetto - Koszt) / CenaNetto * 100
    // => CenaNetto = Koszt / (1 - Marża/100)
    const validMargin = Math.min(99, Math.max(0, targetMargin));
    const calculatedNetFromMargin = foodCostPerUnit / (1 - validMargin / 100);
    const calculatedGrossFromMargin = calculatedNetFromMargin * (1 + VAT_RATE / 100);
    const profitPerUnitFromMargin = calculatedNetFromMargin - foodCostPerUnit;
    const markupFromMargin = (profitPerUnitFromMargin / foodCostPerUnit) * 100;

    // 2. Z ceny na marżę (tryb odwrotny):
    const inputPriceGross = parseFloat(customGrossPrice.replace(",", ".")) || 0;
    const inputPriceNet = inputPriceGross / (1 + VAT_RATE / 100);
    const marginFromPrice = inputPriceNet > 0 ? ((inputPriceNet - foodCostPerUnit) / inputPriceNet) * 100 : 0;
    const profitFromPrice = inputPriceNet - foodCostPerUnit;
    const markupFromPrice = foodCostPerUnit > 0 ? (profitFromPrice / foodCostPerUnit) * 100 : 0;

    // Wybrana cena do zapisu:
    const finalNetToSave =
        calcMode === "FROM_MARGIN" ? calculatedNetFromMargin : inputPriceNet;
    const finalGrossToSave =
        calcMode === "FROM_MARGIN" ? calculatedGrossFromMargin : inputPriceGross;
    const activeMargin =
        calcMode === "FROM_MARGIN" ? validMargin : marginFromPrice;

    // Zapisywanie ceny sprzedaży do bazy (w kwocie brutto)
    const handleSaveSellingPrice = async () => {
        setIsSavingPrice(true);
        setSaveSuccess(false);
        try {
            const res = await fetch(`/api/przepisy/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sellingPrice: Number(finalGrossToSave.toFixed(2)),
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Nie udało się zapisać ceny");
            }

            setData((prev) =>
                prev
                    ? {
                        ...prev,
                        recipe: {
                            ...prev.recipe,
                            sellingPrice: Number(finalGrossToSave.toFixed(2)),
                        },
                    }
                    : prev
            );

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            alert(`Błąd: ${err.message}`);
        } finally {
            setIsSavingPrice(false);
        }
    };

    // Aktualna marża na podstawie obecnej ceny w bazie (cena w cenniku to brutto)
    const currentSellingPrice = Number(recipe.sellingPrice || 0);
    const currentNetPrice = currentSellingPrice / (1 + VAT_RATE / 100);
    const currentMargin =
        currentSellingPrice > 0
            ? ((currentNetPrice - totalFoodCost) / currentNetPrice) * 100
            : 0;

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-24">
            {/* Przycisk nawigacji */}
            <button
                onClick={() => router.push("/przepisy")}
                className="flex items-center gap-2 text-ui-secondary hover:text-ui-primary font-semibold text-sm mb-6 transition-colors cursor-pointer group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Powrót do listy przepisów
            </button>

            {/* NAGŁÓWEK RECEPTURY */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 sm:p-7 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ui-black">
                        {recipe.name}
                    </h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenEditModal}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary font-bold text-xs transition-colors cursor-pointer shadow-sm"
                            title="Edytuj przepis"
                        >
                            <Edit3 size={14} className="text-amber-700" />
                            Edytuj przepis
                        </button>
                        <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-800 font-bold text-xs transition-colors cursor-pointer shadow-sm"
                            title="Usuń przepis"
                        >
                            <Trash2 size={14} className="text-rose-600" />
                            Usuń
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-ui-accent/10 border border-ui-accent/60 rounded-xl px-4 py-2 text-right">
                        <div className="text-[11px] uppercase tracking-wider font-bold text-ui-secondary">
                            Koszt surowcowy (Foodcost)
                        </div>
                        <div className="text-xl font-black text-amber-950">
                            {totalFoodCost.toFixed(2)} zł <span className="text-xs font-semibold text-ui-secondary">/ szt.</span>
                        </div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-right">
                        <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-800">
                            Cena w cenniku (Brutto)
                        </div>
                        <div className="text-xl font-black text-emerald-950">
                            {currentSellingPrice > 0 ? (
                                <>
                                    {currentSellingPrice.toFixed(2)} zł{" "}
                                    <span className="text-xs font-semibold text-emerald-800">brutto</span>
                                </>
                            ) : (
                                <span className="text-sm font-semibold text-emerald-700 italic">Nieustalona</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* GŁÓWNE KARTY KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Karta 1: Foodcost */}
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Foodcost / 1 szt.</span>
                        <Scale size={18} className="text-amber-700" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-ui-black">
                            {totalFoodCost.toFixed(2)} <span className="text-sm font-medium">zł</span>
                        </div>
                        <p className="text-[11px] text-ui-secondary mt-1">
                            Suma kosztów surowców i półproduktów
                        </p>
                    </div>
                </div>

                {/* Karta 2: Aktualna marża */}
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Aktualna marża</span>
                        <Percent size={18} className={currentMargin >= 50 ? "text-emerald-600" : "text-amber-600"} />
                    </div>
                    <div>
                        <div className={`text-2xl font-black ${currentMargin >= 50 ? "text-emerald-700" : currentMargin > 0 ? "text-amber-800" : "text-ui-secondary"}`}>
                            {currentSellingPrice > 0 ? `${currentMargin.toFixed(1)}%` : "—"}
                        </div>
                        <p className="text-[11px] text-ui-secondary mt-1">
                            {currentSellingPrice > 0
                                ? `Zysk netto: ${(currentNetPrice - totalFoodCost).toFixed(2)} zł / szt.`
                                : "Ustal cenę sprzedaży poniżej"}
                        </p>
                    </div>
                </div>

                {/* Karta 3: Produkcja ostatnie 30 dni */}
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Wypieczono (30 dni)</span>
                        <PackageCheck size={18} className="text-blue-600" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-ui-black">
                            {productionStats.totalProduced} <span className="text-sm font-medium">szt.</span>
                        </div>
                        <p className="text-[11px] text-ui-secondary mt-1">
                            Sprzedano: <b>{productionStats.totalSold} szt.</b> ({productionStats.sellThroughRate.toFixed(0)}%)
                        </p>
                    </div>
                </div>

                {/* Karta 4: Przychód ze sprzedaży */}
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Przychód (30 dni)</span>
                        <Coins size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-ui-black">
                            {productionStats.totalRevenue.toLocaleString("pl-PL")} <span className="text-sm font-medium">zł</span>
                        </div>
                        <p className="text-[11px] text-ui-secondary mt-1">
                            Straty / niesprzedane: <b>{productionStats.totalUnsold} szt.</b>
                        </p>
                    </div>
                </div>
            </div>

            {/* SEKCJA 1: ROZPISANY FOODCOST & KALKULATOR CENY */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
                {/* LEWA KOLUMNA: ROZPISANY FOODCOST (7 kolumn) */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-ui-accent">
                            <div>
                                <h2 className="text-lg font-bold text-ui-black flex items-center gap-2">
                                    <Scale size={20} className="text-amber-800" />
                                    Foodcost
                                </h2>
                            </div>

                            {/* Przelicznik partii */}
                            <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200/80 px-3 py-1.5 rounded-xl">
                                <span className="text-xs font-bold text-amber-950 whitespace-nowrap">
                                    Partia:
                                </span>
                                {[1, 10, 50, 100].map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => setPreviewBatchSize(size)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${previewBatchSize === size
                                            ? "bg-amber-800 text-white shadow-sm"
                                            : "text-amber-900 hover:bg-amber-200/60"
                                            }`}
                                    >
                                        {size} szt.
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tabela składników z kosztami */}
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-ui-accent text-ui-secondary font-bold uppercase tracking-wider text-[10px]">
                                        <th className="py-3 px-3 text-left">Składnik</th>
                                        <th className="py-3 px-3 text-right">
                                            {previewBatchSize === 1 ? "Waga na 1 szt." : `Ilość na ${previewBatchSize} szt.`}
                                        </th>
                                        <th className="py-3 px-3 text-right">Cena surowca</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/40">
                                    {detailedIngredients.map((item) => {
                                        const scaledAmount = item.amount * previewBatchSize;
                                        return (
                                            <tr key={item.id} className="hover:bg-ui-accent/5 transition-colors">
                                                <td className="py-3.5 px-3">
                                                    <span className="font-bold text-ui-black text-xs">
                                                        {item.name}
                                                    </span>
                                                </td>

                                                <td className="py-3.5 px-3 text-right font-medium text-ui-secondary">
                                                    {scaledAmount < 1 && item.unit === "kg"
                                                        ? `${(scaledAmount * 1000).toFixed(1)} g`
                                                        : `${scaledAmount.toFixed(3)} ${item.unit}`}
                                                </td>

                                                <td className="py-3.5 px-3 text-right font-semibold text-ui-black">
                                                    {item.unitPrice.toFixed(2)} zł / {item.unit}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-ui-accent font-bold text-xs bg-amber-50/50">
                                        <td className="py-3 px-3 text-ui-black" colSpan={2}>
                                            ŁĄCZNY KOSZT WYTWORZENIA (FOODCOST)
                                            {previewBatchSize > 1 && (
                                                <span className="text-[11px] font-normal text-ui-secondary ml-1.5">
                                                    (dla {previewBatchSize} szt.)
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-right font-black text-sm text-amber-950">
                                            {(totalFoodCost * previewBatchSize).toFixed(2)} zł
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                {/* PRAWA KOLUMNA: KALKULATOR MARŻY I CENY (5 kolumn) */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-ui-black flex items-center gap-2">
                                    <Calculator size={20} className="text-emerald-700" />
                                    Kalkulator Ceny
                                </h2>
                            </div>
                        </div>

                        {/* Przełącznik trybu wyliczania */}
                        <div className="grid grid-cols-2 gap-2 bg-ui-accent/10 p-1.5 rounded-xl border border-ui-accent/40 mb-5">
                            <button
                                type="button"
                                onClick={() => setCalcMode("FROM_MARGIN")}
                                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${calcMode === "FROM_MARGIN"
                                    ? "bg-ui-primary text-ui-white shadow-sm"
                                    : "text-ui-secondary hover:text-ui-primary"
                                    }`}
                            >
                                Marża %
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCalcMode("FROM_PRICE");
                                    if (!customGrossPrice && currentSellingPrice > 0) {
                                        setCustomGrossPrice((currentSellingPrice * (1 + VAT_RATE / 100)).toFixed(2));
                                    }
                                }}
                                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${calcMode === "FROM_PRICE"
                                    ? "bg-ui-primary text-ui-white shadow-sm"
                                    : "text-ui-secondary hover:text-ui-primary"
                                    }`}
                            >
                                Cena brutto
                            </button>
                        </div>

                        {/* Panel Wejściowy */}
                        <div className="space-y-4 mb-6">
                            {calcMode === "FROM_MARGIN" ? (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-ui-black uppercase tracking-wider">
                                            Oczekiwana marża:
                                        </label>
                                        <span className="text-lg font-black text-emerald-800">
                                            {targetMargin}%
                                        </span>
                                    </div>

                                    {/* Szybkie presety */}
                                    <div className="grid grid-cols-5 gap-2 mb-3">
                                        {[40, 50, 60, 65, 75].map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setTargetMargin(preset)}
                                                className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${targetMargin === preset
                                                    ? "bg-emerald-700 text-white border-emerald-700 shadow-sm"
                                                    : "bg-ui-white border-ui-accent text-ui-secondary hover:border-emerald-500 hover:text-emerald-700"
                                                    }`}
                                            >
                                                {preset}%
                                            </button>
                                        ))}
                                    </div>

                                    {/* Suwak i ręczne pole */}
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="10"
                                            max="90"
                                            step="1"
                                            value={targetMargin}
                                            onChange={(e) => setTargetMargin(Number(e.target.value))}
                                            className="flex-1 accent-emerald-700 cursor-pointer"
                                        />
                                        <div className="w-16 relative">
                                            <input
                                                type="number"
                                                min="1"
                                                max="99"
                                                value={targetMargin}
                                                onChange={(e) => setTargetMargin(Math.max(1, Math.min(99, Number(e.target.value) || 0)))}
                                                className="w-full h-9 border border-ui-accent rounded-lg text-center font-bold text-sm text-ui-black focus:outline-none focus:border-emerald-600"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-ui-secondary pointer-events-none">
                                                %
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-ui-black uppercase tracking-wider mb-2">
                                        Wpisz proponowaną cenę brutto:
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="np. 7.50"
                                            value={customGrossPrice}
                                            onChange={(e) => setCustomGrossPrice(e.target.value)}
                                            className="w-full h-11 border border-ui-accent rounded-xl pl-3.5 pr-12 text-base font-bold text-ui-black focus:outline-none focus:border-emerald-600 shadow-sm"
                                        />
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ui-secondary pointer-events-none">
                                            zł brutto
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* KARTA WYNIKÓW KALKULACJI */}
                        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4.5 space-y-3 mb-6">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                                    Sugerowana cena (Brutto):
                                </span>
                                <div className="text-2xl font-black text-emerald-950">
                                    {finalGrossToSave.toFixed(2)} zł
                                </div>
                            </div>

                            <div className="pt-2.5 border-t border-emerald-200/80 space-y-2 text-xs text-emerald-950">
                                <div className="flex items-center justify-between">
                                    <span className="text-ui-secondary font-medium">Cena netto (w tym VAT 5%):</span>
                                    <span className="font-bold">{finalNetToSave.toFixed(2)} zł</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-ui-secondary font-medium">Koszt surowcowy (Foodcost):</span>
                                    <span className="font-bold">{foodCostPerUnit.toFixed(2)} zł</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-ui-secondary font-medium">Zysk netto na 1 sztuce:</span>
                                    <span className="font-bold text-emerald-700">
                                        +{(calcMode === "FROM_MARGIN" ? profitPerUnitFromMargin : profitFromPrice).toFixed(2)} zł
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-ui-secondary font-medium">Marża handlowa:</span>
                                    <span className="font-extrabold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                                        {activeMargin.toFixed(1)}%
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-ui-secondary font-medium">Narzut (Markup):</span>
                                    <span className="font-bold">
                                        {(calcMode === "FROM_MARGIN" ? markupFromMargin : markupFromPrice).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Przycisk zapisu */}
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={handleSaveSellingPrice}
                                disabled={isSavingPrice || finalGrossToSave <= 0}
                                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${saveSuccess
                                    ? "bg-emerald-700 text-white"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                                    }`}
                            >
                                {isSavingPrice ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Zapisywanie w cenniku...
                                    </>
                                ) : saveSuccess ? (
                                    <>
                                        <Check size={18} />
                                        Zapisano nową cenę!
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Zapisz cenę sprzedaży ({finalGrossToSave.toFixed(2)} zł brutto)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* SEKCJA 2: HISTORIA PRODUKCJI I SPRZEDAŻY */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 sm:p-7 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-ui-accent">
                    <div>
                        <h2 className="text-lg font-bold text-ui-black flex items-center gap-2">
                            <BarChart3 size={20} className="text-amber-800" />
                            Produkcja i Sprzedaż
                        </h2>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-amber-500" />
                            <span>Wyprodukowano</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-emerald-600" />
                            <span>Sprzedano</span>
                        </div>
                    </div>
                </div>

                {productions.length === 0 ? (
                    <div className="py-16 text-center text-ui-secondary">
                        <Calendar size={36} className="mx-auto mb-2 opacity-40 text-ui-secondary" />
                        <p className="font-bold text-sm text-ui-black mb-1">Brak zarejestrowanej produkcji</p>
                        <p className="text-xs max-w-sm mx-auto">
                            Dla tego wyrobu nie wprowadzono jeszcze dziennych raportów produkcji i sprzedaży.
                            Dane pojawią się automatycznie po wprowadzeniu dziennych wypieków.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Wykres Recharts */}
                        <div className="h-72 w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[...productions].reverse()}
                                    margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: "#6b7280" }}
                                        tickFormatter={(val) => {
                                            const parts = val.split("-");
                                            return `${parts[2]}.${parts[1]}`;
                                        }}
                                        dy={5}
                                    />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#ffffff",
                                            borderColor: "#e5e7eb",
                                            borderRadius: "12px",
                                            fontSize: "12px",
                                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                                        }}
                                        formatter={(val: any, name: any) => [
                                            `${val} szt.`,
                                            name === "producedAmount" ? "Wyprodukowano" : "Sprzedano",
                                        ]}
                                        labelFormatter={(label) => `Data: ${label}`}
                                    />
                                    <Bar dataKey="producedAmount" name="producedAmount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="soldAmount" name="soldAmount" fill="#059669" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Tabela historii dziennej */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider text-[10px] border-b border-ui-accent">
                                        <th className="py-3 px-3">Data wypieku</th>
                                        <th className="py-3 px-3 text-right">Wyprodukowano</th>
                                        <th className="py-3 px-3 text-right">Sprzedano</th>
                                        <th className="py-3 px-3 text-right">Niesprzedane (strata)</th>
                                        <th className="py-3 px-3 text-right">Skuteczność</th>
                                        <th className="py-3 px-3 text-right">Przychód</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/40">
                                    {productions.map((item) => (
                                        <tr key={item.id} className="hover:bg-ui-accent/5 transition-colors">
                                            <td className="py-3 px-3 font-semibold text-ui-black">
                                                {item.date}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-amber-950">
                                                {item.producedAmount} szt.
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-emerald-950">
                                                {item.soldAmount} szt.
                                            </td>
                                            <td className="py-3 px-3 text-right text-rose-700 font-medium">
                                                {item.unsoldAmount > 0 ? `-${item.unsoldAmount} szt.` : "0 szt."}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${item.efficiencyRate >= 90
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : item.efficiencyRate >= 70
                                                            ? "bg-amber-100 text-amber-800"
                                                            : "bg-rose-100 text-rose-800"
                                                        }`}
                                                >
                                                    {item.efficiencyRate.toFixed(0)}%
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-extrabold text-ui-black">
                                                {item.salesIncome.toLocaleString("pl-PL")} zł
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* MODAL EDYCJI PRZEPISU                                     */}
            {/* ========================================================= */}
            {isEditModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsEditModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Nagłówek Modalu */}
                        <div className="px-6 py-4 border-b border-ui-accent flex items-center justify-between bg-amber-50/70">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-100 rounded-xl text-amber-900 shadow-sm">
                                    <Edit3 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-ui-black leading-tight">
                                        Edycja przepisu: {recipe.name}
                                    </h2>
                                    <p className="text-xs text-ui-secondary">
                                        Zmień nazwę, kategorię lub zmodyfikuj listę składników receptury
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-2 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                                title="Zamknij"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Formularz */}
                        <form onSubmit={handleSaveEditRecipe} className="p-6 md:p-7 space-y-6 overflow-y-auto flex-1 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Nazwa wyrobu */}
                                <div className="md:col-span-5">
                                    <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                        Nazwa wyrobu
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="np. Chleb Żytni 500g"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl px-3.5 py-2 text-sm text-ui-black placeholder:text-ui-secondary/50 focus:outline-none focus:border-amber-600 transition-all shadow-sm font-semibold"
                                    />
                                </div>

                                {/* Kategoria */}
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                        Kategoria
                                    </label>
                                    <select
                                        value={editType}
                                        onChange={(e) => setEditType(e.target.value as any)}
                                        className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl px-3.5 py-2 text-sm text-ui-black focus:outline-none focus:border-amber-600 cursor-pointer transition-all shadow-sm font-semibold"
                                    >
                                        <option value="BREAD">Chleb</option>
                                        <option value="ROLL">Bułka</option>
                                        <option value="SWEET">Słodkie</option>
                                        <option value="SAVORY">Słone</option>
                                    </select>
                                </div>

                                {/* Wielkość partii do kalkulacji */}
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                        Partia przeliczeniowa
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={editBatchSize}
                                            onChange={(e) => setEditBatchSize(e.target.value)}
                                            className="w-full h-11 bg-amber-50/50 border border-amber-300 rounded-xl pl-3 pr-12 text-sm font-black text-amber-950 focus:outline-none focus:border-amber-600 shadow-sm"
                                        />
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-900 pointer-events-none">
                                            szt.
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Wyszukiwarka surowców / półproduktów */}
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                    Dodaj surowiec lub półprodukt
                                </label>
                                <div className="relative">
                                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ui-secondary" />
                                    <input
                                        type="text"
                                        placeholder="Wpisz nazwę składnika (np. Mąka pszenna, Zaczyn...)"
                                        value={editSearchInput}
                                        onChange={(e) => setEditSearchInput(e.target.value)}
                                        className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl pl-10 pr-4 text-sm text-ui-black focus:outline-none focus:border-amber-600 transition-all shadow-sm"
                                    />

                                    {editSearchInput.trim() && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-ui-white border border-ui-accent rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-ui-accent/50">
                                            {/* Surowce */}
                                            {availableIngredients
                                                .filter((ing) =>
                                                    ing.name.toLowerCase().includes(editSearchInput.toLowerCase())
                                                )
                                                .map((ing) => (
                                                    <div
                                                        key={`ing-${ing.id}`}
                                                        onClick={() =>
                                                            handleSelectEditItem(
                                                                ing.id,
                                                                "INGREDIENT",
                                                                ing.name,
                                                                ing.unit,
                                                                Number(ing.calculatedPrice || 0)
                                                            )
                                                        }
                                                        className="p-3 hover:bg-amber-50 flex items-center justify-between cursor-pointer transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                                                Surowiec
                                                            </span>
                                                            <span className="font-bold text-ui-black text-xs">
                                                                {ing.name}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-ui-secondary">
                                                            {Number(ing.calculatedPrice || 0).toFixed(2)} zł / {ing.unit}
                                                        </div>
                                                    </div>
                                                ))}

                                            {/* Półprodukty */}
                                            {availableSemiFinished
                                                .filter((semi) =>
                                                    semi.name.toLowerCase().includes(editSearchInput.toLowerCase())
                                                )
                                                .map((semi) => (
                                                    <div
                                                        key={`semi-${semi.id}`}
                                                        onClick={() =>
                                                            handleSelectEditItem(
                                                                semi.id,
                                                                "SEMI_FINISHED",
                                                                semi.name,
                                                                semi.unit,
                                                                Number(semi.cost || 0)
                                                            )
                                                        }
                                                        className="p-3 hover:bg-amber-50 flex items-center justify-between cursor-pointer transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                                                Półprodukt
                                                            </span>
                                                            <span className="font-bold text-ui-black text-xs">
                                                                {semi.name}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-ui-secondary">
                                                            {Number(semi.cost || 0).toFixed(2)} zł / {semi.unit}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tabela składników receptury */}
                            <div className="border border-ui-accent rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-ui-accent/20 px-4 py-2.5 flex items-center justify-between border-b border-ui-accent">
                                    <span className="text-xs font-bold text-ui-secondary uppercase tracking-wider">
                                        Składniki receptury ({editItems.length})
                                    </span>
                                    <span className="text-[11px] text-ui-secondary">
                                        Ilości podane na <b>{editBatchSize} szt.</b>
                                    </span>
                                </div>

                                {editItems.length === 0 ? (
                                    <div className="p-8 text-center text-ui-secondary text-xs">
                                        Brak składników w recepturze. Użyj wyszukiwarki powyżej, aby dodać surowce.
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-ui-accent/60 text-ui-secondary font-bold uppercase text-[9px]">
                                                <th className="py-2.5 px-3">Składnik</th>
                                                <th className="py-2.5 px-3 text-center w-36">Ilość na partię</th>
                                                <th className="py-2.5 px-3 text-right">Cena jedn.</th>
                                                <th className="py-2.5 px-3 text-right">Koszt partii</th>
                                                <th className="py-2.5 px-3 text-center w-12">Usuń</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-ui-accent/40">
                                            {editItems.map((item) => {
                                                const cleanAmt = parseFloat(item.batchAmount.replace(",", ".").trim()) || 0;
                                                const totalItemCost = cleanAmt * item.unitPrice;

                                                return (
                                                    <tr key={`${item.kind}-${item.id}`} className="hover:bg-ui-accent/5">
                                                        <td className="py-3 px-3">
                                                            <div className="font-bold text-ui-black">
                                                                {item.name}
                                                            </div>
                                                            <span
                                                                className={`text-[9px] px-1 py-0.2 rounded font-semibold ${item.kind === "SEMI_FINISHED"
                                                                    ? "text-amber-800 bg-amber-50"
                                                                    : "text-blue-700 bg-blue-50"
                                                                    }`}
                                                            >
                                                                {item.kind === "SEMI_FINISHED" ? "Półprodukt" : "Surowiec"}
                                                            </span>
                                                        </td>

                                                        <td className="py-3 px-3 text-center">
                                                            <div className="relative inline-block w-28">
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    value={item.batchAmount}
                                                                    onChange={(e) =>
                                                                        handleAmountChangeEditItem(
                                                                            item.id,
                                                                            item.kind,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="w-full bg-ui-white border border-ui-accent rounded-lg px-2 py-1 text-center font-bold text-xs text-ui-black focus:outline-none focus:border-amber-600"
                                                                />
                                                                <span className="absolute right-2 top-1.5 text-[10px] text-ui-secondary pointer-events-none">
                                                                    {item.unit}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3 text-right text-ui-secondary">
                                                            {item.unitPrice.toFixed(2)} zł
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-bold text-ui-black">
                                                            {totalItemCost.toFixed(2)} zł
                                                        </td>

                                                        <td className="py-3 px-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveEditItem(item.id, item.kind)}
                                                                className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors cursor-pointer"
                                                                title="Usuń składnik"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Szacowany przeliczony foodcost */}
                            {editItems.length > 0 && (
                                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-amber-950 uppercase tracking-wider block">
                                            Szacowany koszt surowcowy (Foodcost)
                                        </span>
                                        <span className="text-[11px] text-ui-secondary">
                                            Wyliczony na 1 gotową sztukę wyrobu
                                        </span>
                                    </div>
                                    <div className="text-2xl font-black text-amber-950">
                                        {(() => {
                                            const batchNum = parseFloat(editBatchSize.replace(",", ".").trim()) || 1;
                                            const totalCost = editItems.reduce((sum, item) => {
                                                const cleanAmt = parseFloat(item.batchAmount.replace(",", ".").trim()) || 0;
                                                return sum + cleanAmt * item.unitPrice;
                                            }, 0);
                                            const perPiece = batchNum > 0 ? totalCost / batchNum : 0;
                                            return `${perPiece.toFixed(2)} zł`;
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Stopka Modalu */}
                            <div className="pt-4 border-t border-ui-accent flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-ui-accent text-ui-secondary hover:text-ui-primary font-semibold text-xs transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingEdit ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            Zapisywanie...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={15} />
                                            Zapisz zmiany w przepisie
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL POTWIERDZENIA USUNIĘCIA PRZEPISU                    */}
            {/* ========================================================= */}
            {isDeleteModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-rose-200 p-6 space-y-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-ui-black">
                                    Usunąć przepis?
                                </h3>
                                <p className="text-xs text-ui-secondary mt-0.5">
                                    Operacja jest nieodwracalna
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-ui-secondary leading-relaxed">
                            Czy na pewno chcesz trwale usunąć przepis{" "}
                            <b className="text-ui-black font-bold">„{recipe.name}”</b>? Spowoduje to
                            również usunięcie powiązanych z nim składników receptury oraz historii wpisów
                            produkcyjnych tego wyrobu.
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 rounded-xl border border-ui-accent text-ui-secondary hover:text-ui-primary font-semibold text-xs transition-colors cursor-pointer"
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={handleDeleteRecipe}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Usuwanie...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        Usuń trwale
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

