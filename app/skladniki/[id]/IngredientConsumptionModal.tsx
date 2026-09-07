"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
    X,
    Calendar,
    BarChart3,
    CalendarDays,
    Layers,
    ChevronDown,
    ChevronUp,
    TrendingUp,
    Search,
    Filter,
    Scale,
    Wheat,
    Award,
    Sparkles,
    ArrowUpDown,
    PieChart as PieIcon,
    Package
} from "lucide-react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from "recharts";

type Granularity = "DAILY" | "WEEKLY" | "MONTHLY" | "PRODUCTS";

interface ProductDetail {
    type: "DIRECT" | "SEMI_FINISHED";
    semiFinishedName?: string | null;
    amountPerUnit: number;
    consumed: number;
}

interface ProductUsage {
    productId: string;
    productName: string;
    productType: string;
    producedUnits: number;
    consumedAmount: number;
    isDirect?: boolean;
    isSemiFinished?: boolean;
    details?: ProductDetail[];
}

interface DailyEntry {
    date: string;
    dayOfWeek: string;
    shortDay: string;
    totalConsumed: number;
    totalPurchased: number;
    products: ProductUsage[];
}

interface WeeklyEntry {
    key: string;
    weekNumber: number;
    year: number;
    label: string;
    shortLabel: string;
    startDate: string;
    endDate: string;
    totalConsumed: number;
    totalPurchased: number;
    avgDailyConsumed: number;
    daysWithProduction: number;
    products: ProductUsage[];
}

interface MonthlyEntry {
    key: string;
    year: number;
    monthIndex: number;
    label: string;
    shortLabel: string;
    totalConsumed: number;
    totalPurchased: number;
    estimatedCost: number;
    daysWithProduction: number;
    products: ProductUsage[];
}

interface ProductRankingItem {
    productId: string;
    productName: string;
    productType: string;
    totalConsumed: number;
    percentage: number;
    totalProducedUnits: number;
    isDirect: boolean;
    isSemiFinished: boolean;
}

interface IngredientConsumptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    ingredientName: string;
    unit: string;
    type: string;
    dailyHistory: DailyEntry[];
    weeklyHistory: WeeklyEntry[];
    monthlyHistory: MonthlyEntry[];
    productRanking: ProductRankingItem[];
}

// Formatowanie daty: YYYY-MM-DD -> DD.MM.YYYY
function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
}

export default function IngredientConsumptionModal({
    isOpen,
    onClose,
    ingredientName,
    unit,
    type,
    dailyHistory = [],
    weeklyHistory = [],
    monthlyHistory = [],
    productRanking = [],
}: IngredientConsumptionModalProps) {
    const [view, setView] = useState<Granularity>("DAILY");
    const [periodFilter, setPeriodFilter] = useState<string>("30d"); // "7d", "14d", "30d", "90d", "all", "6m", "12m"
    const [selectedProductFilter, setSelectedProductFilter] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    // Resetuj filtry przy zmianie widoku
    useEffect(() => {
        if (view === "DAILY") {
            setPeriodFilter("30d");
        } else if (view === "WEEKLY") {
            setPeriodFilter("8w");
        } else if (view === "MONTHLY") {
            setPeriodFilter("12m");
        }
        setExpandedRows({});
    }, [view]);

    // Obsługa klawisza ESC do zamykania
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Unikalna lista produktów do selektora filtra
    const availableProducts = useMemo(() => {
        const map = new Map<string, string>();
        productRanking.forEach((p) => map.set(p.productId, p.productName));
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [productRanking]);

    const toggleRow = (key: string) => {
        setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // --- FILTROWANIE DANYCH DZIENNYCH ---
    const filteredDailyData = useMemo(() => {
        let list = [...dailyHistory];

        if (periodFilter === "7d") {
            list = list.slice(0, 7);
        } else if (periodFilter === "14d") {
            list = list.slice(0, 14);
        } else if (periodFilter === "30d") {
            list = list.slice(0, 30);
        } else if (periodFilter === "90d") {
            list = list.slice(0, 90);
        }

        if (selectedProductFilter !== "ALL") {
            list = list
                .map((d) => {
                    const matchedProds = d.products.filter((p) => p.productId === selectedProductFilter);
                    const prodConsumed = matchedProds.reduce((acc, p) => acc + p.consumedAmount, 0);
                    return {
                        ...d,
                        totalConsumed: Math.round(prodConsumed * 100) / 100,
                        products: matchedProds,
                    };
                })
                .filter((d) => d.totalConsumed > 0 || d.totalPurchased > 0);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (d) =>
                    d.date.includes(q) ||
                    d.dayOfWeek.toLowerCase().includes(q) ||
                    d.products.some((p) => p.productName.toLowerCase().includes(q))
            );
        }

        return list;
    }, [dailyHistory, periodFilter, selectedProductFilter, searchQuery]);

    // --- FILTROWANIE DANYCH TYGODNIOWYCH ---
    const filteredWeeklyData = useMemo(() => {
        let list = [...weeklyHistory];

        if (periodFilter === "4w") {
            list = list.slice(0, 4);
        } else if (periodFilter === "8w") {
            list = list.slice(0, 8);
        } else if (periodFilter === "16w") {
            list = list.slice(0, 16);
        }

        if (selectedProductFilter !== "ALL") {
            list = list
                .map((w) => {
                    const matchedProds = w.products.filter((p) => p.productId === selectedProductFilter);
                    const prodConsumed = matchedProds.reduce((acc, p) => acc + p.consumedAmount, 0);
                    return {
                        ...w,
                        totalConsumed: Math.round(prodConsumed * 100) / 100,
                        avgDailyConsumed: Math.round((prodConsumed / 7) * 100) / 100,
                        products: matchedProds,
                    };
                })
                .filter((w) => w.totalConsumed > 0 || w.totalPurchased > 0);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (w) =>
                    w.label.toLowerCase().includes(q) ||
                    w.products.some((p) => p.productName.toLowerCase().includes(q))
            );
        }

        return list;
    }, [weeklyHistory, periodFilter, selectedProductFilter, searchQuery]);

    // --- FILTROWANIE DANYCH MIESIĘCZNYCH ---
    const filteredMonthlyData = useMemo(() => {
        let list = [...monthlyHistory];

        if (periodFilter === "6m") {
            list = list.slice(0, 6);
        } else if (periodFilter === "12m") {
            list = list.slice(0, 12);
        }

        if (selectedProductFilter !== "ALL") {
            list = list
                .map((m) => {
                    const matchedProds = m.products.filter((p) => p.productId === selectedProductFilter);
                    const prodConsumed = matchedProds.reduce((acc, p) => acc + p.consumedAmount, 0);
                    return {
                        ...m,
                        totalConsumed: Math.round(prodConsumed * 100) / 100,
                        products: matchedProds,
                    };
                })
                .filter((m) => m.totalConsumed > 0 || m.totalPurchased > 0);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (m) =>
                    m.label.toLowerCase().includes(q) ||
                    m.products.some((p) => p.productName.toLowerCase().includes(q))
            );
        }

        return list;
    }, [monthlyHistory, periodFilter, selectedProductFilter, searchQuery]);

    // Dane do wykresu (odwrócone chronologicznie: od najstarszego do najnowszego)
    const chartData = useMemo(() => {
        if (view === "DAILY") {
            return [...filteredDailyData].reverse().map((d) => ({
                label: `${d.shortDay} ${d.date.slice(8, 10)}.${d.date.slice(5, 7)}`,
                consumed: d.totalConsumed,
                purchased: d.totalPurchased,
                fullDate: d.date,
                dayOfWeek: d.dayOfWeek,
                products: d.products,
            }));
        }
        if (view === "WEEKLY") {
            return [...filteredWeeklyData].reverse().map((w) => ({
                label: w.shortLabel,
                fullLabel: w.label,
                consumed: w.totalConsumed,
                purchased: w.totalPurchased,
                avgDaily: w.avgDailyConsumed,
                products: w.products,
            }));
        }
        if (view === "MONTHLY") {
            return [...filteredMonthlyData].reverse().map((m) => ({
                label: m.shortLabel,
                fullLabel: m.label,
                consumed: m.totalConsumed,
                purchased: m.totalPurchased,
                products: m.products,
            }));
        }
        return [];
    }, [view, filteredDailyData, filteredWeeklyData, filteredMonthlyData]);

    // KPI Summary
    const statsSummary = useMemo(() => {
        let totalConsumed = 0;
        let avgConsumption = 0;
        let peakValue = 0;
        let peakLabel = "-";
        let count = 0;

        if (view === "DAILY") {
            count = filteredDailyData.length;
            totalConsumed = filteredDailyData.reduce((acc, d) => acc + d.totalConsumed, 0);
            avgConsumption = count > 0 ? totalConsumed / count : 0;
            filteredDailyData.forEach((d) => {
                if (d.totalConsumed > peakValue) {
                    peakValue = d.totalConsumed;
                    peakLabel = `${d.shortDay}, ${formatDate(d.date)}`;
                }
            });
        } else if (view === "WEEKLY") {
            count = filteredWeeklyData.length;
            totalConsumed = filteredWeeklyData.reduce((acc, w) => acc + w.totalConsumed, 0);
            avgConsumption = count > 0 ? totalConsumed / count : 0;
            filteredWeeklyData.forEach((w) => {
                if (w.totalConsumed > peakValue) {
                    peakValue = w.totalConsumed;
                    peakLabel = w.shortLabel;
                }
            });
        } else if (view === "MONTHLY") {
            count = filteredMonthlyData.length;
            totalConsumed = filteredMonthlyData.reduce((acc, m) => acc + m.totalConsumed, 0);
            avgConsumption = count > 0 ? totalConsumed / count : 0;
            filteredMonthlyData.forEach((m) => {
                if (m.totalConsumed > peakValue) {
                    peakValue = m.totalConsumed;
                    peakLabel = m.label;
                }
            });
        } else {
            totalConsumed = productRanking.reduce((acc, p) => acc + p.totalConsumed, 0);
        }

        const topProduct = productRanking.length > 0 ? productRanking[0] : null;

        return {
            totalConsumed: Math.round(totalConsumed * 100) / 100,
            avgConsumption: Math.round(avgConsumption * 100) / 100,
            peakValue: Math.round(peakValue * 100) / 100,
            peakLabel,
            topProductName: topProduct?.productName || "Brak",
            topProductShare: topProduct?.percentage || 0,
            topProductAmount: topProduct?.totalConsumed || 0,
        };
    }, [view, filteredDailyData, filteredWeeklyData, filteredMonthlyData, productRanking]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-3xl shadow-2xl border border-ui-accent/40 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ---------------- NAGŁÓWEK MODALU ---------------- */}
                <div className="px-6 py-5 border-b border-ui-accent/30 bg-gradient-to-r from-emerald-50/50 via-white to-sky-50/40 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                            <Scale size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-extrabold text-ui-black tracking-tight">
                                    Szczegółowa analiza zużycia
                                </h2>
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    {unit}
                                </span>
                            </div>
                            <p className="text-xs text-ui-secondary font-medium mt-0.5 flex items-center gap-2">
                                Składnik: <span className="text-ui-primary font-bold">{ingredientName}</span>
                                <span>•</span>
                                Kategoria: <span className="font-semibold text-ui-primary">{type}</span>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-2xl text-ui-secondary hover:text-ui-black hover:bg-ui-accent/15 transition-colors cursor-pointer"
                        title="Zamknij (Esc)"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ---------------- PRZEŁĄCZNIK WIDOKÓW (TABS) ---------------- */}
                <div className="px-6 py-3 border-b border-ui-accent/20 bg-ui-white flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 p-1 bg-ui-accent/10 rounded-2xl border border-ui-accent/30">
                        <button
                            onClick={() => setView("DAILY")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                view === "DAILY"
                                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-100"
                                    : "text-ui-secondary hover:text-ui-primary"
                            }`}
                        >
                            <Calendar size={14} />
                            Dzienne
                        </button>
                        <button
                            onClick={() => setView("WEEKLY")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                view === "WEEKLY"
                                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-100"
                                    : "text-ui-secondary hover:text-ui-primary"
                            }`}
                        >
                            <BarChart3 size={14} />
                            Tygodniowe
                        </button>
                        <button
                            onClick={() => setView("MONTHLY")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                view === "MONTHLY"
                                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-100"
                                    : "text-ui-secondary hover:text-ui-primary"
                            }`}
                        >
                            <CalendarDays size={14} />
                            Miesięczne
                        </button>
                        <button
                            onClick={() => setView("PRODUCTS")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                view === "PRODUCTS"
                                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-100"
                                    : "text-ui-secondary hover:text-ui-primary"
                            }`}
                        >
                            <Wheat size={14} />
                            Wyroby ({productRanking.length})
                        </button>
                    </div>

                    {/* Filtry zakresów i szukajka */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {view === "DAILY" && (
                            <div className="flex items-center gap-1 text-xs">
                                {[
                                    { id: "7d", label: "7 dni" },
                                    { id: "14d", label: "14 dni" },
                                    { id: "30d", label: "30 dni" },
                                    { id: "90d", label: "90 dni" },
                                    { id: "all", label: "Wszystko" },
                                ].map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPeriodFilter(p.id)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                                            periodFilter === p.id
                                                ? "bg-emerald-600 text-white shadow-xs"
                                                : "text-ui-secondary hover:bg-ui-accent/10"
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {view === "WEEKLY" && (
                            <div className="flex items-center gap-1 text-xs">
                                {[
                                    { id: "4w", label: "4 tyg." },
                                    { id: "8w", label: "8 tyg." },
                                    { id: "16w", label: "16 tyg." },
                                    { id: "all", label: "Wszystko" },
                                ].map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPeriodFilter(p.id)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                                            periodFilter === p.id
                                                ? "bg-emerald-600 text-white shadow-xs"
                                                : "text-ui-secondary hover:bg-ui-accent/10"
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {view === "MONTHLY" && (
                            <div className="flex items-center gap-1 text-xs">
                                {[
                                    { id: "6m", label: "6 mies." },
                                    { id: "12m", label: "12 mies." },
                                    { id: "all", label: "Wszystko" },
                                ].map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPeriodFilter(p.id)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                                            periodFilter === p.id
                                                ? "bg-emerald-600 text-white shadow-xs"
                                                : "text-ui-secondary hover:bg-ui-accent/10"
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Filtr wg konkretnego produktu */}
                        {availableProducts.length > 1 && view !== "PRODUCTS" && (
                            <div className="relative">
                                <select
                                    value={selectedProductFilter}
                                    onChange={(e) => setSelectedProductFilter(e.target.value)}
                                    className="text-xs font-semibold pl-2.5 pr-7 py-1.5 rounded-xl border border-ui-accent bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none"
                                >
                                    <option value="ALL">Wszystkie wyroby</option>
                                    {availableProducts.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-2.5 text-ui-secondary pointer-events-none" />
                            </div>
                        )}
                    </div>
                </div>

                {/* ---------------- ZAWARTOŚĆ GŁÓWNA ---------------- */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* KARTY KPI PODSUMOWANIA */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
                            <div className="text-[11px] uppercase font-bold text-emerald-800 tracking-wider flex items-center gap-1.5">
                                <Package size={14} className="text-emerald-600" />
                                Łączne zużycie
                            </div>
                            <div className="mt-2 text-2xl font-black text-emerald-950">
                                {statsSummary.totalConsumed.toLocaleString("pl-PL")}{" "}
                                <span className="text-xs font-semibold text-emerald-700">{unit}</span>
                            </div>
                            <div className="text-[10px] text-emerald-700/80 mt-1 font-medium">
                                {view === "DAILY" && `Suma z wybranego okresu (${filteredDailyData.length} dni)`}
                                {view === "WEEKLY" && `Suma z wybranego okresu (${filteredWeeklyData.length} tyg.)`}
                                {view === "MONTHLY" && `Suma z wybranego okresu (${filteredMonthlyData.length} mies.)`}
                                {view === "PRODUCTS" && "Łączne zużycie ze wszystkich receptur"}
                            </div>
                        </div>

                        <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                            <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center gap-1.5">
                                <TrendingUp size={14} className="text-blue-600" />
                                {view === "DAILY" && "Średnia dzienna"}
                                {view === "WEEKLY" && "Średnia tygodniowa"}
                                {view === "MONTHLY" && "Średnia miesięczna"}
                                {view === "PRODUCTS" && "Liczba wyrobów"}
                            </div>
                            <div className="mt-2 text-2xl font-black text-ui-black">
                                {view === "PRODUCTS"
                                    ? productRanking.length
                                    : statsSummary.avgConsumption.toLocaleString("pl-PL")}
                                {view !== "PRODUCTS" && (
                                    <span className="text-xs font-semibold text-ui-secondary ml-1">{unit}</span>
                                )}
                            </div>
                            <div className="text-[10px] text-ui-secondary mt-1 font-medium">
                                {view === "DAILY" && "W wybranym zakresie dni"}
                                {view === "WEEKLY" && "W wybranym zakresie tygodni"}
                                {view === "MONTHLY" && "W wybranym zakresie miesięcy"}
                                {view === "PRODUCTS" && "Wyrobów korzysta z tego składnika"}
                            </div>
                        </div>

                        <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                            <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center gap-1.5">
                                <Award size={14} className="text-amber-500" />
                                {view === "PRODUCTS" ? "Bezpośrednie vs Półprod." : "Szczyt (Peak)"}
                            </div>
                            <div className="mt-2 text-xl font-black text-ui-black truncate">
                                {view === "PRODUCTS" ? (
                                    `${productRanking.filter((p) => p.isDirect).length} bezp. / ${
                                        productRanking.filter((p) => p.isSemiFinished).length
                                    } półp.`
                                ) : (
                                    <>
                                        {statsSummary.peakValue.toLocaleString("pl-PL")}{" "}
                                        <span className="text-xs font-semibold text-ui-secondary">{unit}</span>
                                    </>
                                )}
                            </div>
                            <div className="text-[10px] text-ui-secondary mt-1 font-medium truncate">
                                {view === "PRODUCTS" ? "Typy powiązań w recepturach" : statsSummary.peakLabel}
                            </div>
                        </div>

                        <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                            <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center gap-1.5">
                                <Wheat size={14} className="text-amber-700" />
                                Główny wyrób
                            </div>
                            <div className="mt-2 text-lg font-black text-ui-black truncate" title={statsSummary.topProductName}>
                                {statsSummary.topProductName}
                            </div>
                            <div className="text-[10px] text-ui-secondary mt-1 font-medium">
                                {statsSummary.topProductShare}% udziału ({statsSummary.topProductAmount} {unit})
                            </div>
                        </div>
                    </div>

                    {/* ---------------- WYKRES RECHARTS (WIDOKI CZASOWE) ---------------- */}
                    {view !== "PRODUCTS" && chartData.length > 0 && (
                        <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                    <BarChart3 size={15} className="text-emerald-600" />
                                    {view === "DAILY" && "Zużycie dzienne w czasie"}
                                    {view === "WEEKLY" && "Zużycie tygodniowe w czasie"}
                                    {view === "MONTHLY" && "Zużycie miesięczne vs Zakupy"}
                                </h3>
                                <span className="text-[11px] font-semibold text-ui-secondary bg-ui-accent/15 px-2.5 py-0.5 rounded-full">
                                    {chartData.length} {view === "DAILY" ? "dni" : view === "WEEKLY" ? "tygodni" : "miesięcy"}
                                </span>
                            </div>

                            <div className="h-[240px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="label"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: "#6B7280" }}
                                            dy={8}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: "#6B7280" }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: "rgba(229, 231, 235, 0.4)" }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const dataPoint = payload[0].payload;
                                                    return (
                                                        <div className="bg-white border border-ui-accent/80 rounded-2xl p-3.5 shadow-xl text-xs max-w-xs">
                                                            <div className="font-black text-ui-black border-b border-ui-accent/40 pb-1.5 mb-2">
                                                                {dataPoint.fullLabel || dataPoint.dayOfWeek
                                                                    ? `${dataPoint.dayOfWeek}, ${formatDate(dataPoint.fullDate || "")}`
                                                                    : label}
                                                            </div>
                                                            <div className="flex items-center justify-between text-emerald-700 font-bold mb-1">
                                                                <span>Zużyto:</span>
                                                                <span>
                                                                    {dataPoint.consumed} {unit}
                                                                </span>
                                                            </div>
                                                            {dataPoint.purchased > 0 && (
                                                                <div className="flex items-center justify-between text-blue-600 font-bold mb-1">
                                                                    <span>Zakupiono:</span>
                                                                    <span>
                                                                        {dataPoint.purchased} {unit}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {dataPoint.products && dataPoint.products.length > 0 && (
                                                                <div className="mt-2 pt-2 border-t border-ui-accent/30 space-y-1">
                                                                    <div className="text-[10px] text-ui-secondary font-bold uppercase">
                                                                        Wyroby ({dataPoint.products.length}):
                                                                    </div>
                                                                    {dataPoint.products.slice(0, 4).map((p: ProductUsage) => (
                                                                        <div
                                                                            key={p.productId}
                                                                            className="flex items-center justify-between text-[11px] text-ui-primary"
                                                                        >
                                                                            <span className="truncate max-w-[170px]">{p.productName}</span>
                                                                            <span className="font-semibold ml-2">
                                                                                {p.consumedAmount} {unit}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                    {dataPoint.products.length > 4 && (
                                                                        <div className="text-[10px] text-ui-secondary italic text-right">
                                                                            + {dataPoint.products.length - 4} więcej
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        {view === "MONTHLY" && (
                                            <Legend
                                                wrapperStyle={{ paddingTop: "8px", fontSize: "11px", fontWeight: "600" }}
                                                iconType="circle"
                                                formatter={(val) => (val === "consumed" ? "Zużyto" : "Zakupiono")}
                                            />
                                        )}
                                        <Bar dataKey="consumed" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                        {view === "MONTHLY" && (
                                            <Bar dataKey="purchased" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* ---------------- TABELA SZCZEGÓŁOWA (DZIENNA) ---------------- */}
                    {view === "DAILY" && (
                        <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                            <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                    <Calendar size={14} /> Dzienny rejestr zużycia
                                </h3>
                                <span className="text-[11px] font-semibold text-ui-secondary">
                                    {filteredDailyData.length} pozycji
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                            <th className="p-3.5">Data</th>
                                            <th className="p-3.5">Dzień</th>
                                            <th className="p-3.5 text-right">Zużycie ({unit})</th>
                                            <th className="p-3.5 text-center">Wypieki (liczba wyrobów)</th>
                                            <th className="p-3.5 text-right">Dostawy ({unit})</th>
                                            <th className="p-3.5 text-center w-10">Szczegóły</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/30 font-medium">
                                        {filteredDailyData.length > 0 ? (
                                            filteredDailyData.map((d) => {
                                                const isExpanded = !!expandedRows[d.date];
                                                return (
                                                    <React.Fragment key={d.date}>
                                                        <tr
                                                            onClick={() => toggleRow(d.date)}
                                                            className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${
                                                                isExpanded ? "bg-emerald-50/30" : ""
                                                            }`}
                                                        >
                                                            <td className="p-3.5 font-bold text-ui-black">
                                                                {formatDate(d.date)}
                                                            </td>
                                                            <td className="p-3.5 text-ui-secondary font-semibold">
                                                                {d.dayOfWeek}
                                                            </td>
                                                            <td className="p-3.5 text-right font-black text-emerald-700 text-sm">
                                                                {d.totalConsumed.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-center">
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ui-accent/20 text-ui-primary font-bold text-[11px]">
                                                                    <Wheat size={12} className="text-amber-700" />
                                                                    {d.products.length} {d.products.length === 1 ? "wyrób" : "wyrobów"}
                                                                </span>
                                                            </td>
                                                            <td className="p-3.5 text-right font-semibold text-blue-600">
                                                                {d.totalPurchased > 0 ? `${d.totalPurchased.toFixed(2)} ${unit}` : "-"}
                                                            </td>
                                                            <td className="p-3.5 text-center text-ui-secondary">
                                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </td>
                                                        </tr>

                                                        {/* ROZWINIĘCIE WIERSZA ZE SZCZEGÓŁAMI WYROBÓW */}
                                                        {isExpanded && (
                                                            <tr className="bg-emerald-50/20">
                                                                <td colSpan={6} className="p-4 border-b border-ui-accent/30">
                                                                    <div className="space-y-2">
                                                                        <div className="text-[11px] font-bold text-ui-secondary uppercase tracking-wider">
                                                                            Rozbicie zużycia na wyroby w dniu {formatDate(d.date)}:
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                            {d.products.map((prod) => (
                                                                                <div
                                                                                    key={prod.productId}
                                                                                    className="p-2.5 rounded-xl bg-white border border-ui-accent/50 shadow-2xs flex flex-col justify-between"
                                                                                >
                                                                                    <div>
                                                                                        <div className="flex items-center justify-between gap-1">
                                                                                            <span className="font-bold text-ui-black truncate" title={prod.productName}>
                                                                                                {prod.productName}
                                                                                            </span>
                                                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-ui-accent/15 text-ui-secondary">
                                                                                                {prod.producedUnits} szt.
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="text-[10px] text-ui-secondary mt-0.5">
                                                                                            {prod.isDirect && !prod.isSemiFinished && "Receptura bezpośrednia"}
                                                                                            {prod.isSemiFinished && !prod.isDirect && "Przez półprodukt / zaczyn"}
                                                                                            {prod.isDirect && prod.isSemiFinished && "Bezpośrednio + półprodukt"}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="mt-2 pt-1 border-t border-ui-accent/20 flex items-center justify-between text-xs">
                                                                                        <span className="text-ui-secondary text-[10px]">Zużyto składnika:</span>
                                                                                        <span className="font-black text-emerald-700">
                                                                                            {prod.consumedAmount.toFixed(2)} {unit}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-ui-secondary italic">
                                                    Brak danych o zużyciu w wybranym okresie
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ---------------- TABELA SZCZEGÓŁOWA (TYGODNIOWA) ---------------- */}
                    {view === "WEEKLY" && (
                        <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                            <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                    <BarChart3 size={14} /> Tygodniowy rejestr zużycia
                                </h3>
                                <span className="text-[11px] font-semibold text-ui-secondary">
                                    {filteredWeeklyData.length} tygodni
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                            <th className="p-3.5">Okres</th>
                                            <th className="p-3.5 text-center">Dni produkcji</th>
                                            <th className="p-3.5 text-right">Łączne zużycie ({unit})</th>
                                            <th className="p-3.5 text-right">Średnia dzienna ({unit}/d)</th>
                                            <th className="p-3.5 text-right">Zakupy ({unit})</th>
                                            <th className="p-3.5 text-center w-10">Szczegóły</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/30 font-medium">
                                        {filteredWeeklyData.length > 0 ? (
                                            filteredWeeklyData.map((w) => {
                                                const isExpanded = !!expandedRows[w.key];
                                                return (
                                                    <React.Fragment key={w.key}>
                                                        <tr
                                                            onClick={() => toggleRow(w.key)}
                                                            className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${
                                                                isExpanded ? "bg-emerald-50/30" : ""
                                                            }`}
                                                        >
                                                            <td className="p-3.5">
                                                                <div className="font-bold text-ui-black">{w.label}</div>
                                                                <div className="text-[10px] text-ui-secondary mt-0.5">
                                                                    {formatDate(w.startDate)} — {formatDate(w.endDate)}
                                                                </div>
                                                            </td>
                                                            <td className="p-3.5 text-center">
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-ui-accent/15 text-ui-primary font-bold text-[11px]">
                                                                    {w.daysWithProduction} / 7 dni
                                                                </span>
                                                            </td>
                                                            <td className="p-3.5 text-right font-black text-emerald-700 text-sm">
                                                                {w.totalConsumed.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-right font-bold text-ui-primary">
                                                                {w.avgDailyConsumed.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-right font-semibold text-blue-600">
                                                                {w.totalPurchased > 0 ? `${w.totalPurchased.toFixed(2)} ${unit}` : "-"}
                                                            </td>
                                                            <td className="p-3.5 text-center text-ui-secondary">
                                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </td>
                                                        </tr>

                                                        {isExpanded && (
                                                            <tr className="bg-emerald-50/20">
                                                                <td colSpan={6} className="p-4 border-b border-ui-accent/30">
                                                                    <div className="space-y-2">
                                                                        <div className="text-[11px] font-bold text-ui-secondary uppercase tracking-wider">
                                                                            Wyroby wypiekane w tym tygodniu:
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                            {w.products.map((prod) => (
                                                                                <div
                                                                                    key={prod.productId}
                                                                                    className="p-2.5 rounded-xl bg-white border border-ui-accent/50 shadow-2xs flex items-center justify-between gap-2"
                                                                                >
                                                                                    <div className="truncate">
                                                                                        <div className="font-bold text-ui-black truncate">
                                                                                            {prod.productName}
                                                                                        </div>
                                                                                        <div className="text-[10px] text-ui-secondary">
                                                                                            Upieczono: {prod.producedUnits} szt.
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right whitespace-nowrap">
                                                                                        <div className="font-black text-emerald-700 text-xs">
                                                                                            {prod.consumedAmount.toFixed(2)} {unit}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-ui-secondary italic">
                                                    Brak danych dla wybranego okresu
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ---------------- TABELA SZCZEGÓŁOWA (MIESIĘCZNA) ---------------- */}
                    {view === "MONTHLY" && (
                        <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                            <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                    <CalendarDays size={14} /> Miesięczny bilans zużycia i zakupów
                                </h3>
                                <span className="text-[11px] font-semibold text-ui-secondary">
                                    {filteredMonthlyData.length} miesięcy
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                            <th className="p-3.5">Miesiąc</th>
                                            <th className="p-3.5 text-center">Dni produkcji</th>
                                            <th className="p-3.5 text-right">Zużycie ({unit})</th>
                                            <th className="p-3.5 text-right">Zakupy ({unit})</th>
                                            <th className="p-3.5 text-right">Bilans (Zakup - Zużycie)</th>
                                            <th className="p-3.5 text-right">Szacowany koszt</th>
                                            <th className="p-3.5 text-center w-10">Szczegóły</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/30 font-medium">
                                        {filteredMonthlyData.length > 0 ? (
                                            filteredMonthlyData.map((m) => {
                                                const isExpanded = !!expandedRows[m.key];
                                                const balance = m.totalPurchased - m.totalConsumed;
                                                return (
                                                    <React.Fragment key={m.key}>
                                                        <tr
                                                            onClick={() => toggleRow(m.key)}
                                                            className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${
                                                                isExpanded ? "bg-emerald-50/30" : ""
                                                            }`}
                                                        >
                                                            <td className="p-3.5 font-bold text-ui-black text-sm">
                                                                {m.label}
                                                            </td>
                                                            <td className="p-3.5 text-center">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ui-accent/15 text-ui-primary font-bold text-[11px]">
                                                                    {m.daysWithProduction} dni
                                                                </span>
                                                            </td>
                                                            <td className="p-3.5 text-right font-black text-emerald-700 text-sm">
                                                                {m.totalConsumed.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-right font-bold text-blue-600">
                                                                {m.totalPurchased.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-right font-bold">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-lg text-[11px] ${
                                                                        balance >= 0
                                                                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                                                                            : "bg-amber-50 text-amber-800 border border-amber-200"
                                                                    }`}
                                                                >
                                                                    {balance >= 0 ? `+${balance.toFixed(2)}` : balance.toFixed(2)} {unit}
                                                                </span>
                                                            </td>
                                                            <td className="p-3.5 text-right font-black text-ui-black">
                                                                {m.estimatedCost.toFixed(2)} zł
                                                            </td>
                                                            <td className="p-3.5 text-center text-ui-secondary">
                                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </td>
                                                        </tr>

                                                        {isExpanded && (
                                                            <tr className="bg-emerald-50/20">
                                                                <td colSpan={7} className="p-4 border-b border-ui-accent/30">
                                                                    <div className="space-y-2">
                                                                        <div className="text-[11px] font-bold text-ui-secondary uppercase tracking-wider">
                                                                            Wyroby w miesiącu {m.label}:
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                            {m.products.map((prod) => (
                                                                                <div
                                                                                    key={prod.productId}
                                                                                    className="p-2.5 rounded-xl bg-white border border-ui-accent/50 shadow-2xs flex items-center justify-between gap-2"
                                                                                >
                                                                                    <div className="truncate">
                                                                                        <div className="font-bold text-ui-black truncate">
                                                                                            {prod.productName}
                                                                                        </div>
                                                                                        <div className="text-[10px] text-ui-secondary">
                                                                                            Upieczono: {prod.producedUnits} szt.
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right whitespace-nowrap">
                                                                                        <div className="font-black text-emerald-700 text-xs">
                                                                                            {prod.consumedAmount.toFixed(2)} {unit}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-ui-secondary italic">
                                                    Brak danych dla wybranego okresu
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ---------------- WIDOK RANKINGU WYROBÓW (PRODUCTS) ---------------- */}
                    {view === "PRODUCTS" && (
                        <div className="space-y-4">
                            <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2 mb-4">
                                    <PieIcon size={15} className="text-emerald-600" />
                                    Podział zużycia składnika wg wyrobów piekarniczych
                                </h3>

                                <div className="space-y-3.5">
                                    {productRanking.map((p, idx) => (
                                        <div
                                            key={p.productId}
                                            className="p-3.5 rounded-2xl border border-ui-accent/40 bg-ui-white/80 hover:bg-emerald-50/30 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <div className="font-bold text-ui-black text-sm">{p.productName}</div>
                                                        <div className="text-[10px] text-ui-secondary flex items-center gap-2 mt-0.5">
                                                            <span>Łącznie upieczono: {p.totalProducedUnits} szt.</span>
                                                            <span>•</span>
                                                            <span className="font-semibold">
                                                                {p.isDirect && !p.isSemiFinished && "Receptura bezpośrednia"}
                                                                {p.isSemiFinished && !p.isDirect && "Z półproduktu / zaczynu"}
                                                                {p.isDirect && p.isSemiFinished && "Bezpośrednia + Półprodukt"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-black text-emerald-800 text-base">
                                                        {p.totalConsumed.toFixed(2)}{" "}
                                                        <span className="text-xs font-semibold">{unit}</span>
                                                    </div>
                                                    <div className="text-[11px] font-bold text-emerald-600">
                                                        {p.percentage}% całości
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pasek postępu */}
                                            <div className="w-full bg-ui-accent/20 h-2.5 rounded-full overflow-hidden">
                                                <div
                                                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.min(Math.max(p.percentage, 2), 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {productRanking.length === 0 && (
                                        <div className="p-8 text-center text-ui-secondary italic">
                                            Brak wyrobów przypisanych do tego składnika w recepturach
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ---------------- STOPKA MODALU ---------------- */}
                <div className="px-6 py-4 border-t border-ui-accent/30 bg-ui-white/90 flex items-center justify-between">
                    <div className="text-xs text-ui-secondary font-medium flex items-center gap-2">
                        <Sparkles size={14} className="text-emerald-600" />
                        Dane aktualizowane w czasie rzeczywistym na podstawie dziennych raportów produkcji
                    </div>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-ui-primary text-white text-xs font-bold hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer"
                    >
                        Zamknij okno
                    </button>
                </div>
            </div>
        </div>
    );
}
