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
    ChevronLeft,
    ChevronRight,
    RotateCcw,
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

// Formatowanie daty: YYYY-MM-DD -> DD.MM.YYYY lub YYYY-MM -> MM.YYYY
function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    if (parts.length === 2) {
        return `${parts[1]}.${parts[0]}`;
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
    const [selectedProductFilter, setSelectedProductFilter] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

    // Stan zakresów dla widoku dziennego
    const [dailyCount, setDailyCount] = useState<number>(30);
    const [dailyOffset, setDailyOffset] = useState<number>(0);
    const [dailyCustomRange, setDailyCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [dailyInputStart, setDailyInputStart] = useState<string>(() => `${new Date().toISOString().split("T")[0].slice(0, 7)}-01`);
    const [dailyInputEnd, setDailyInputEnd] = useState<string>(() => new Date().toISOString().split("T")[0]);

    // Stan zakresów dla widoku tygodniowego
    const [weeklyCount, setWeeklyCount] = useState<number>(8);
    const [weeklyOffset, setWeeklyOffset] = useState<number>(0);
    const [weeklyCustomRange, setWeeklyCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [weeklyInputStart, setWeeklyInputStart] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 56);
        return d.toISOString().split("T")[0];
    });
    const [weeklyInputEnd, setWeeklyInputEnd] = useState<string>(() => new Date().toISOString().split("T")[0]);

    // Stan zakresów dla widoku miesięcznego
    const [monthlyCount, setMonthlyCount] = useState<number>(12);
    const [monthlyOffset, setMonthlyOffset] = useState<number>(0);
    const [monthlyCustomRange, setMonthlyCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [monthlyInputStart, setMonthlyInputStart] = useState<string>(() => `${new Date().toISOString().split("T")[0].slice(0, 4)}-01`);
    const [monthlyInputEnd, setMonthlyInputEnd] = useState<string>(() => `${new Date().toISOString().split("T")[0].slice(0, 4)}-12`);

    // Reset rozszerzonych wierszy przy zmianie widoku
    useEffect(() => {
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
        let list = dailyHistory.filter((d) => d.totalConsumed > 0);

        if (dailyCustomRange) {
            list = list.filter(
                (d) => d.date >= dailyCustomRange.startDate && d.date <= dailyCustomRange.endDate
            );
        } else {
            const startIdx = dailyOffset * dailyCount;
            list = list.slice(startIdx, startIdx + dailyCount);
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
                .filter((d) => d.totalConsumed > 0);
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
    }, [dailyHistory, dailyCustomRange, dailyOffset, dailyCount, selectedProductFilter, searchQuery]);

    // --- FILTROWANIE DANYCH TYGODNIOWYCH ---
    const filteredWeeklyData = useMemo(() => {
        let list = [...weeklyHistory];

        if (weeklyCustomRange) {
            list = list.filter(
                (w) => w.startDate <= weeklyCustomRange.endDate && w.endDate >= weeklyCustomRange.startDate
            );
        } else {
            const startIdx = weeklyOffset * weeklyCount;
            list = list.slice(startIdx, startIdx + weeklyCount);
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
    }, [weeklyHistory, weeklyCustomRange, weeklyOffset, weeklyCount, selectedProductFilter, searchQuery]);

    // --- FILTROWANIE DANYCH MIESIĘCZNYCH ---
    const filteredMonthlyData = useMemo(() => {
        let list = [...monthlyHistory];

        if (monthlyCustomRange) {
            const startM = monthlyCustomRange.startDate.slice(0, 7);
            const endM = monthlyCustomRange.endDate.slice(0, 7);
            list = list.filter((m) => m.key >= startM && m.key <= endM);
        } else {
            const startIdx = monthlyOffset * monthlyCount;
            list = list.slice(startIdx, startIdx + monthlyCount);
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
    }, [monthlyHistory, monthlyCustomRange, monthlyOffset, monthlyCount, selectedProductFilter, searchQuery]);

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
                <div className="px-6 py-5 border-b border-ui-accent/30 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 bg-ui-secondary/20 rounded-xl text-ui-secondary shadow-sm">
                            <Scale size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-extrabold text-ui-black tracking-tight">
                                    Szczegółowa analiza zużycia
                                </h2>
                                <span className="ml-2 text-xs font-normal text-ui-secondary bg-ui-accent/30 px-2 py-0.5 rounded-md">
                                    {unit}
                                </span>
                            </div>
                            <p className="text-xs text-ui-secondary font-medium mt-0.5 flex items-center gap-2">
                                <span className="text-ui-primary font-bold">{ingredientName}</span>
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
                <div className="px-6 border-b border-ui-accent bg-ui-white flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
                    <div className="flex gap-1.5 sm:gap-2 -mb-px">
                        <button
                            onClick={() => setView("DAILY")}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${view === "DAILY"
                                ? "border-ui-secondary text-ui-secondary font-bold"
                                : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                                }`}
                        >
                            <Calendar size={15} />
                            <span>Dzienne</span>
                        </button>
                        <button
                            onClick={() => setView("WEEKLY")}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${view === "WEEKLY"
                                ? "border-ui-secondary text-ui-secondary font-bold"
                                : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                                }`}
                        >
                            <BarChart3 size={15} />
                            <span>Tygodniowe</span>
                        </button>
                        <button
                            onClick={() => setView("MONTHLY")}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${view === "MONTHLY"
                                ? "border-ui-secondary text-ui-secondary font-bold"
                                : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                                }`}
                        >
                            <CalendarDays size={15} />
                            <span>Miesięczne</span>
                        </button>
                        <button
                            onClick={() => setView("PRODUCTS")}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${view === "PRODUCTS"
                                ? "border-ui-secondary text-ui-secondary font-bold"
                                : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                                }`}
                        >
                            <Wheat size={15} />
                            <span>Wyroby</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${view === "PRODUCTS"
                                ? "bg-ui-secondary text-ui-white"
                                : "bg-ui-accent/25 text-ui-primary/70"
                                }`}>
                                {productRanking.length}
                            </span>
                        </button>
                    </div>

                    {/* Filtr wg konkretnego produktu oraz szukajka */}
                    {availableProducts.length > 1 && view !== "PRODUCTS" && (
                        <div className="flex items-center py-2 shrink-0">
                            <div className="relative">
                                <select
                                    value={selectedProductFilter}
                                    onChange={(e) => setSelectedProductFilter(e.target.value)}
                                    className="text-xs font-semibold pl-2.5 pr-7 py-1.5 rounded-xl border border-ui-accent bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary cursor-pointer appearance-none shadow-2xs"
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
                        </div>
                    )}
                </div>

                {/* ---------------- ZAWARTOŚĆ GŁÓWNA ---------------- */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 1. PASEK NAWIGACJI PO OKRESACH I WYBÓR ZAKRESU */}
                    {view !== "PRODUCTS" && (
                        <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2.5 bg-ui-secondary/20 rounded-xl text-ui-secondary shadow-sm">
                                        {view === "DAILY" ? <BarChart3 size={20} /> : view === "WEEKLY" ? <BarChart3 size={20} /> : <CalendarDays size={20} />}
                                    </div>
                                    <div>
                                        <h2 className="text-sm sm:text-base font-extrabold text-ui-black">
                                            {view === "DAILY" ? "Zużycie dzienne" : view === "WEEKLY" ? "Zużycie tygodniowe" : "Zużycie miesięczne"}
                                        </h2>
                                        <div className="text-xs text-ui-secondary font-medium flex items-center gap-1.5 flex-wrap">
                                            {(() => {
                                                let startStr = "";
                                                let endStr = "";
                                                let count = 0;
                                                if (view === "DAILY") {
                                                    count = filteredDailyData.length;
                                                    if (dailyCustomRange) {
                                                        startStr = formatDate(dailyCustomRange.startDate);
                                                        endStr = formatDate(dailyCustomRange.endDate);
                                                    } else if (filteredDailyData.length > 0) {
                                                        startStr = formatDate(filteredDailyData[filteredDailyData.length - 1].date);
                                                        endStr = formatDate(filteredDailyData[0].date);
                                                    }
                                                } else if (view === "WEEKLY") {
                                                    count = filteredWeeklyData.length;
                                                    if (weeklyCustomRange) {
                                                        startStr = formatDate(weeklyCustomRange.startDate);
                                                        endStr = formatDate(weeklyCustomRange.endDate);
                                                    } else if (filteredWeeklyData.length > 0) {
                                                        startStr = formatDate(filteredWeeklyData[filteredWeeklyData.length - 1].startDate);
                                                        endStr = formatDate(filteredWeeklyData[0].endDate);
                                                    }
                                                } else if (view === "MONTHLY") {
                                                    count = filteredMonthlyData.length;
                                                    if (monthlyCustomRange) {
                                                        startStr = formatDate(monthlyCustomRange.startDate);
                                                        endStr = formatDate(monthlyCustomRange.endDate);
                                                    } else if (filteredMonthlyData.length > 0) {
                                                        startStr = filteredMonthlyData[filteredMonthlyData.length - 1].label;
                                                        endStr = filteredMonthlyData[0].label;
                                                    }
                                                }

                                                if (startStr && endStr) {
                                                    return (
                                                        <>
                                                            <span><b>{startStr}</b> - <b>{endStr}</b></span>
                                                            <span className="text-[10px] bg-ui-accent/30 text-ui-primary font-bold px-2 py-0.5 rounded-full">
                                                                {count} {view === "DAILY" ? (count === 1 ? "dzień" : count < 5 ? "dni" : "dni") : view === "WEEKLY" ? (count === 1 ? "tydzień" : count < 5 ? "tygodnie" : "tygodni") : (count === 1 ? "miesiąc" : count < 5 ? "miesiące" : "miesięcy")}
                                                            </span>
                                                        </>
                                                    );
                                                }
                                                return <span>Analiza słupkowa zużycia składnika</span>;
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Przyciski presetów & Własny zakres */}
                                <div className="flex flex-wrap items-center gap-1.5 bg-ui-accent/10 p-1.5 rounded-xl border border-ui-accent/40 text-xs font-bold">
                                    {view === "DAILY" && (
                                        <>
                                            {[7, 14, 30].map((cnt) => (
                                                <button
                                                    key={cnt}
                                                    onClick={() => {
                                                        setDailyCustomRange(null);
                                                        setDailyOffset(0);
                                                        setDailyCount(cnt);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${!dailyCustomRange && dailyCount === cnt
                                                        ? "bg-white text-ui-primary shadow-xs font-black"
                                                        : "text-ui-secondary hover:text-ui-primary"
                                                        }`}
                                                >
                                                    {cnt} dni
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    const s = `${todayStr.slice(0, 7)}-01`;
                                                    const e = todayStr;
                                                    setDailyInputStart(s);
                                                    setDailyInputEnd(e);
                                                    setDailyCustomRange({ startDate: s, endDate: e });
                                                }}
                                                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${dailyCustomRange?.startDate === `${todayStr.slice(0, 7)}-01` && dailyCustomRange?.endDate === todayStr
                                                    ? "bg-white text-ui-primary shadow-xs font-black"
                                                    : "text-ui-secondary hover:text-ui-primary"
                                                    }`}
                                            >
                                                Ten miesiąc
                                            </button>
                                        </>
                                    )}

                                    {view === "WEEKLY" && (
                                        <>
                                            {[4, 6, 8, 12].map((cnt) => (
                                                <button
                                                    key={cnt}
                                                    onClick={() => {
                                                        setWeeklyCustomRange(null);
                                                        setWeeklyOffset(0);
                                                        setWeeklyCount(cnt);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${!weeklyCustomRange && weeklyCount === cnt
                                                        ? "bg-white text-ui-primary shadow-xs font-black"
                                                        : "text-ui-secondary hover:text-ui-primary"
                                                        }`}
                                                >
                                                    {cnt} tyg.
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {view === "MONTHLY" && (
                                        <>
                                            {[3, 6, 12].map((cnt) => (
                                                <button
                                                    key={cnt}
                                                    onClick={() => {
                                                        setMonthlyCustomRange(null);
                                                        setMonthlyOffset(0);
                                                        setMonthlyCount(cnt);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${!monthlyCustomRange && monthlyCount === cnt
                                                        ? "bg-white text-ui-primary shadow-xs font-black"
                                                        : "text-ui-secondary hover:text-ui-primary"
                                                        }`}
                                                >
                                                    {cnt} mies.
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    const s = `${todayStr.slice(0, 4)}-01`;
                                                    const e = `${todayStr.slice(0, 4)}-12`;
                                                    setMonthlyInputStart(s);
                                                    setMonthlyInputEnd(e);
                                                    setMonthlyCustomRange({ startDate: s, endDate: e });
                                                }}
                                                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${monthlyCustomRange?.startDate === `${todayStr.slice(0, 4)}-01` && monthlyCustomRange?.endDate === `${todayStr.slice(0, 4)}-12`
                                                    ? "bg-white text-ui-primary shadow-xs font-black"
                                                    : "text-ui-secondary hover:text-ui-primary"
                                                    }`}
                                            >
                                                Ten rok
                                            </button>
                                        </>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (view === "DAILY" && !dailyCustomRange) {
                                                setDailyCustomRange({ startDate: dailyInputStart, endDate: dailyInputEnd });
                                            } else if (view === "WEEKLY" && !weeklyCustomRange) {
                                                setWeeklyCustomRange({ startDate: weeklyInputStart, endDate: weeklyInputEnd });
                                            } else if (view === "MONTHLY" && !monthlyCustomRange) {
                                                setMonthlyCustomRange({ startDate: monthlyInputStart, endDate: monthlyInputEnd });
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${(view === "DAILY" && dailyCustomRange) || (view === "WEEKLY" && weeklyCustomRange) || (view === "MONTHLY" && monthlyCustomRange)
                                            ? "bg-white text-ui-primary shadow-xs font-black border border-ui-accent/40"
                                            : "text-ui-secondary hover:text-ui-primary"
                                            }`}
                                    >
                                        <CalendarDays size={13} />
                                        <span>Własny zakres</span>
                                    </button>
                                </div>
                            </div>

                            {/* Wiersz drugorzędny: Kontrolki nawigacji paginacji lub selektor własnego zakresu dat */}
                            <div className="pt-2.5 border-t border-ui-accent/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                                {((view === "DAILY" && dailyCustomRange) || (view === "WEEKLY" && weeklyCustomRange) || (view === "MONTHLY" && monthlyCustomRange)) ? (
                                    <div className="flex flex-wrap items-center gap-2.5 w-full justify-between">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-ui-secondary">Zakres od:</span>
                                            <input
                                                type={view === "MONTHLY" ? "month" : "date"}
                                                value={view === "DAILY" ? dailyInputStart : view === "WEEKLY" ? weeklyInputStart : monthlyInputStart}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (view === "DAILY") {
                                                        setDailyInputStart(val);
                                                        if (val && dailyInputEnd && val <= dailyInputEnd) {
                                                            setDailyCustomRange({ startDate: val, endDate: dailyInputEnd });
                                                        }
                                                    } else if (view === "WEEKLY") {
                                                        setWeeklyInputStart(val);
                                                        if (val && weeklyInputEnd && val <= weeklyInputEnd) {
                                                            setWeeklyCustomRange({ startDate: val, endDate: weeklyInputEnd });
                                                        }
                                                    } else if (view === "MONTHLY") {
                                                        setMonthlyInputStart(val);
                                                        if (val && monthlyInputEnd && val <= monthlyInputEnd) {
                                                            setMonthlyCustomRange({ startDate: val, endDate: monthlyInputEnd });
                                                        }
                                                    }
                                                }}
                                                className="bg-ui-white border border-ui-accent rounded-lg px-2.5 py-1 font-bold text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-2xs"
                                            />
                                            <span className="font-bold text-ui-secondary">do:</span>
                                            <input
                                                type={view === "MONTHLY" ? "month" : "date"}
                                                value={view === "DAILY" ? dailyInputEnd : view === "WEEKLY" ? weeklyInputEnd : monthlyInputEnd}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (view === "DAILY") {
                                                        setDailyInputEnd(val);
                                                        if (dailyInputStart && val && dailyInputStart <= val) {
                                                            setDailyCustomRange({ startDate: dailyInputStart, endDate: val });
                                                        }
                                                    } else if (view === "WEEKLY") {
                                                        setWeeklyInputEnd(val);
                                                        if (weeklyInputStart && val && weeklyInputStart <= val) {
                                                            setWeeklyCustomRange({ startDate: weeklyInputStart, endDate: val });
                                                        }
                                                    } else if (view === "MONTHLY") {
                                                        setMonthlyInputEnd(val);
                                                        if (monthlyInputStart && val && monthlyInputStart <= val) {
                                                            setMonthlyCustomRange({ startDate: monthlyInputStart, endDate: val });
                                                        }
                                                    }
                                                }}
                                                className="bg-ui-white border border-ui-accent rounded-lg px-2.5 py-1 font-bold text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-2xs"
                                            />

                                            <button
                                                onClick={() => {
                                                    if (view === "DAILY") {
                                                        if (dailyInputStart && dailyInputEnd && dailyInputStart <= dailyInputEnd) {
                                                            setDailyCustomRange({ startDate: dailyInputStart, endDate: dailyInputEnd });
                                                        } else {
                                                            alert("Wprowadź poprawny zakres (data początkowa nie może być późniejsza niż końcowa).");
                                                        }
                                                    } else if (view === "WEEKLY") {
                                                        if (weeklyInputStart && weeklyInputEnd && weeklyInputStart <= weeklyInputEnd) {
                                                            setWeeklyCustomRange({ startDate: weeklyInputStart, endDate: weeklyInputEnd });
                                                        } else {
                                                            alert("Wprowadź poprawny zakres (data początkowa nie może być późniejsza niż końcowa).");
                                                        }
                                                    } else if (view === "MONTHLY") {
                                                        if (monthlyInputStart && monthlyInputEnd && monthlyInputStart <= monthlyInputEnd) {
                                                            setMonthlyCustomRange({ startDate: monthlyInputStart, endDate: monthlyInputEnd });
                                                        } else {
                                                            alert("Wprowadź poprawny zakres (data początkowa nie może być późniejsza niż końcowa).");
                                                        }
                                                    }
                                                }}
                                                className="px-3 py-1 bg-ui-primary text-white font-bold rounded-lg hover:bg-ui-primary/90 transition-colors shadow-2xs cursor-pointer"
                                            >
                                                Zastosuj
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => {
                                                if (view === "DAILY") {
                                                    setDailyCustomRange(null);
                                                    setDailyOffset(0);
                                                } else if (view === "WEEKLY") {
                                                    setWeeklyCustomRange(null);
                                                    setWeeklyOffset(0);
                                                } else if (view === "MONTHLY") {
                                                    setMonthlyCustomRange(null);
                                                    setMonthlyOffset(0);
                                                }
                                            }}
                                            className="flex items-center gap-1 text-ui-secondary hover:text-ui-primary font-semibold transition-colors cursor-pointer"
                                        >
                                            <RotateCcw size={12} />
                                            <span>Wróć do standardowych okresów</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between w-full">
                                        <div className="text-ui-secondary text-[11px] font-medium">
                                            Użyj przycisków, aby przeglądać wcześniejsze lub późniejsze okresy:
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => {
                                                    if (view === "DAILY") setDailyOffset(dailyOffset + 1);
                                                    else if (view === "WEEKLY") setWeeklyOffset(weeklyOffset + 1);
                                                    else if (view === "MONTHLY") setMonthlyOffset(monthlyOffset + 1);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-white text-ui-primary rounded-lg font-bold shadow-2xs hover:bg-ui-accent/20 transition-all cursor-pointer border border-ui-accent/40"
                                                title="Generuj dla wcześniejszego okresu"
                                            >
                                                <ChevronLeft size={14} />
                                                <span>Wcześniejsze</span>
                                            </button>

                                            {((view === "DAILY" && dailyOffset > 0) || (view === "WEEKLY" && weeklyOffset > 0) || (view === "MONTHLY" && monthlyOffset > 0)) && (
                                                <button
                                                    onClick={() => {
                                                        if (view === "DAILY") setDailyOffset(0);
                                                        else if (view === "WEEKLY") setWeeklyOffset(0);
                                                        else if (view === "MONTHLY") setMonthlyOffset(0);
                                                    }}
                                                    className="px-2.5 py-1.5 font-bold text-ui-secondary hover:text-ui-primary transition-colors cursor-pointer"
                                                    title="Wróć do bieżącego okresu"
                                                >
                                                    <RotateCcw size={13} className="inline mr-1" />
                                                    Bieżące
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    if (view === "DAILY") setDailyOffset(Math.max(0, dailyOffset - 1));
                                                    else if (view === "WEEKLY") setWeeklyOffset(Math.max(0, weeklyOffset - 1));
                                                    else if (view === "MONTHLY") setMonthlyOffset(Math.max(0, monthlyOffset - 1));
                                                }}
                                                disabled={view === "DAILY" ? dailyOffset === 0 : view === "WEEKLY" ? weeklyOffset === 0 : monthlyOffset === 0}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all ${(view === "DAILY" ? dailyOffset === 0 : view === "WEEKLY" ? weeklyOffset === 0 : monthlyOffset === 0)
                                                    ? "bg-ui-accent/20 text-ui-secondary/50 cursor-not-allowed border border-transparent"
                                                    : "bg-white text-ui-primary shadow-2xs hover:bg-ui-accent/20 cursor-pointer border border-ui-accent/40"
                                                    }`}
                                                title="Generuj dla nowszego okresu"
                                            >
                                                <span>Późniejsze</span>
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {/* KARTY KPI PODSUMOWANIA */}
                    <div className="grid grid-cols-2 lg:grid-cols-2 gap-3.5">
                        <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                            <div className="flex items-center justify-between text-ui-secondary mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider">Łączne zużycie</span>
                                <Package size={18} className="text-ui-secondary" />
                            </div>
                            <div className="mt-2 text-2xl font-black text-ui-primary">
                                {statsSummary.totalConsumed.toLocaleString("pl-PL")}{" "}
                                <span className="text-xs font-semibold text-ui-secondary">{unit}</span>
                            </div>
                            <div className="text-[10px] text-ui-secondary mt-1 font-medium">
                                {view === "DAILY" && `Suma z wybranego okresu (${filteredDailyData.length} dni)`}
                                {view === "WEEKLY" && `Suma z wybranego okresu (${filteredWeeklyData.length} tyg.)`}
                                {view === "MONTHLY" && `Suma z wybranego okresu (${filteredMonthlyData.length} mies.)`}
                                {view === "PRODUCTS" && "Łączne zużycie ze wszystkich receptur"}
                            </div>
                        </div>


                        <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                            <div className="flex items-center justify-between text-ui-secondary mb-2 text-xs font-bold uppercase tracking-wider">
                                {view === "DAILY" && "Średnia dzienna"}
                                {view === "WEEKLY" && "Średnia tygodniowa"}
                                {view === "MONTHLY" && "Średnia miesięczna"}
                                {view === "PRODUCTS" && "Liczba wyrobów"}
                                <TrendingUp size={14} className="text-ui-secondary font-bold" />
                            </div>
                            <div className="mt-2 text-2xl font-black text-ui-primary">
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



                    </div>

                    {/* ---------------- WYKRES RECHARTS (WIDOKI CZASOWE) ---------------- */}
                    {view !== "PRODUCTS" && chartData.length > 0 && (
                        <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                    <BarChart3 size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
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
                                                    const tooltipTitle = dataPoint.fullLabel
                                                        ? dataPoint.fullLabel
                                                        : (dataPoint.dayOfWeek && dataPoint.fullDate)
                                                            ? `${dataPoint.dayOfWeek}, ${formatDate(dataPoint.fullDate)}`
                                                            : (dataPoint.label || label);

                                                    return (
                                                        <div className="bg-white border border-ui-accent/80 rounded-2xl p-3.5 shadow-xl text-xs min-w-[240px] max-w-sm">
                                                            <div className="font-bold text-ui-black border-b border-ui-accent/40 pb-1.5 mb-2">
                                                                {tooltipTitle}
                                                            </div>
                                                            <div className="flex items-center justify-between text-emerald-700 font-semibold mb-1">
                                                                <span>Zużyto:</span>
                                                                <span className="font-bold">
                                                                    {dataPoint.consumed} {unit}
                                                                </span>
                                                            </div>
                                                            {dataPoint.products && dataPoint.products.length > 0 && (
                                                                <div className="mt-2.5 pt-2 border-t border-ui-accent/30 space-y-1">
                                                                    <div className="text-[10px] text-ui-secondary font-bold uppercase tracking-wider mb-1">
                                                                        Wyroby ({dataPoint.products.length}):
                                                                    </div>
                                                                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                                                                        {dataPoint.products.map((p: ProductUsage) => (
                                                                            <div
                                                                                key={p.productId}
                                                                                className="flex items-center justify-between text-[11px] text-ui-primary py-0.5"
                                                                            >
                                                                                <span className="truncate max-w-[190px]" title={p.productName}>{p.productName}</span>
                                                                                <span className="font-bold ml-2 shrink-0 text-ui-black">
                                                                                    {p.consumedAmount} {unit}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
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
                                                formatter={(val) => (val === "purchased" ? "Zakupiono" : "Zużyto")}
                                            />
                                        )}
                                        {view === "MONTHLY" && (
                                            <Bar dataKey="purchased" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                        )}
                                        <Bar dataKey="consumed" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} />
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
                                    <Calendar size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" /> Dzienny rejestr zużycia
                                </h3>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                            <th className="p-3.5">Data</th>
                                            <th className="p-3.5">Dzień</th>
                                            <th className="p-3.5 text-right">Zużycie ({unit})</th>
                                            <th className="p-3.5 text-center">Wypieki (liczba wyrobów)</th>
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
                                                            className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${isExpanded ? "bg-emerald-50/30" : ""
                                                                }`}
                                                        >
                                                            <td className="p-3.5 text-ui-black">
                                                                {formatDate(d.date)}
                                                            </td>
                                                            <td className="p-3.5 text-ui-black">
                                                                {d.dayOfWeek}
                                                            </td>
                                                            <td className="p-3.5 text-right font-black text-emerald-700 text-sm">
                                                                {d.totalConsumed.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-center">
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ui-accent/20 text-ui-primary text-[11px]">
                                                                    <Wheat size={12} className="text-amber-700" />
                                                                    {d.products.length} {d.products.length === 1 ? "wyrób" : "wyrobów"}
                                                                </span>
                                                            </td>
                                                            <td className="p-3.5 text-center text-ui-secondary">
                                                                <div className="flex items-center justify-center">
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* ROZWINIĘCIE WIERSZA ZE SZCZEGÓŁAMI WYROBÓW */}
                                                        {isExpanded && (
                                                            <tr className="bg-emerald-50/20">
                                                                <td colSpan={5} className="p-4 border-b border-ui-accent/30">
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
                                                <td colSpan={5} className="p-8 text-center text-ui-secondary italic">
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
                                    <BarChart3 size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" /> Tygodniowy rejestr zużycia
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
                                                            className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${isExpanded ? "bg-emerald-50/30" : ""
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
                                                            <td className="p-3.5 text-right font-black text-ui-primary text-sm">
                                                                {w.totalConsumed.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-right font-bold text-ui-primary">
                                                                {w.avgDailyConsumed.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-center text-ui-secondary">
                                                                <div className="flex items-center justify-center">
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {isExpanded && (
                                                            <tr className="bg-emerald-50/20">
                                                                <td colSpan={5} className="p-4 border-b border-ui-accent/30">
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
                                                <td colSpan={5} className="p-8 text-center text-ui-secondary italic">
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
                                    <CalendarDays size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" /> Miesięczny bilans zużycia i zakupów
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
                                                            className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${isExpanded ? "bg-emerald-50/30" : ""
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
                                                            <td className="p-3.5 text-right font-black text-ui-primary text-sm">
                                                                {m.totalConsumed.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-right font-bold text-ui-primary">
                                                                {m.totalPurchased.toFixed(2)} {unit}
                                                            </td>
                                                            <td className="p-3.5 text-right font-bold">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-lg text-[11px] ${balance >= 0
                                                                        ? "bg-ui-primary/10 text-ui-primary border border-ui-accent"
                                                                        : "bg-ui-error/15 text-ui-error border border-ui-accent"
                                                                        }`}
                                                                >
                                                                    {balance >= 0 ? `+${balance.toFixed(2)}` : balance.toFixed(2)} {unit}
                                                                </span>
                                                            </td>
                                                            <td className="p-3.5 text-center text-ui-secondary">
                                                                <div className="flex items-center justify-center">
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {isExpanded && (
                                                            <tr className="bg-emerald-50/20">
                                                                <td colSpan={6} className="p-4 border-b border-ui-accent/30">
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

                    {/* ---------------- WIDOK RANKINGU WYROBÓW (PRODUCTS) ---------------- */}
                    {view === "PRODUCTS" && (
                        <div className="space-y-4">
                            <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2 mb-3">
                                    <PieIcon size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
                                    Podział zużycia składnika wg wyrobów piekarniczych
                                </h3>

                                <div className="space-y-3.5">
                                    {productRanking.map((p, idx) => (
                                        <div
                                            key={p.productId}
                                            className="p-3.5 rounded-2xl border border-ui-accent/40 bg-ui-white/80 hover:bg-emerald-50/30 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-1">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <div className="font-bold text-ui-black text-sm">{p.productName}</div>
                                                        <div className="text-[10px] text-ui-secondary flex items-center gap-2 mt-0.5">
                                                            <span>Łącznie upieczono: {p.totalProducedUnits} szt.</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-black text-emerald-800 text-base">
                                                        {p.totalConsumed.toFixed(2)}{" "}
                                                        <span className="text-xs font-semibold">{unit}</span>
                                                    </div>
                                                </div>
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


            </div>
        </div>
    );
}
