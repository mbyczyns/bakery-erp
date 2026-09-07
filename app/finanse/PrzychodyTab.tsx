"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    TrendingUp,
    Calendar,
    BarChart3,
    CalendarDays,
    DollarSign,
    ShoppingBag,
    Wheat,
    Award,
    Sparkles,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Loader2,
    PieChart as PieIcon,
    RefreshCw,
    Layers,
    Croissant,
    Pizza,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Percent
} from "lucide-react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Line
} from "recharts";

type Granularity = "DAILY" | "WEEKLY" | "MONTHLY" | "PRODUCTS";
type PeriodPreset = "CURRENT_MONTH" | "PREV_MONTH" | "30D" | "90D" | "YEAR" | "ALL";
type BakeryCategory = "ALL" | "BREAD" | "ROLL" | "SWEET" | "SAVORY";

interface DayProductDetail {
    productId: string;
    productName: string;
    productType: string;
    producedAmount: number;
    soldAmount: number;
    sellingPrice: number;
    salesIncome: number;
}

interface DailyRecord {
    date: string;
    dayOfWeek: string;
    shortDay: string;
    isWeekend: boolean;
    bakerySalesIncome: number;
    fiscalIncome: number;
    totalIncome: number;
    otherIncome: number;
    bakerySharePercent: number;
    totalProduced: number;
    totalSold: number;
    sellThroughRate: number;
    hasReport: boolean;
    categoryBreakdown: {
        BREAD: number;
        ROLL: number;
        SWEET: number;
        SAVORY: number;
    };
    products: DayProductDetail[];
}

interface WeeklyRecord {
    key: string;
    weekNumber: number;
    year: number;
    label: string;
    shortLabel: string;
    startDate: string;
    endDate: string;
    totalIncome: number;
    bakerySalesIncome: number;
    otherIncome: number;
    bakerySharePercent: number;
    avgDailyIncome: number;
    totalProduced: number;
    totalSold: number;
    sellThroughRate: number;
    daysWithReport: number;
    categoryBreakdown: {
        BREAD: number;
        ROLL: number;
        SWEET: number;
        SAVORY: number;
    };
}

interface MonthlyRecord {
    key: string;
    year: number;
    monthIndex: number;
    label: string;
    shortLabel: string;
    totalIncome: number;
    bakerySalesIncome: number;
    otherIncome: number;
    bakerySharePercent: number;
    avgDailyIncome: number;
    totalProduced: number;
    totalSold: number;
    sellThroughRate: number;
    daysWithReport: number;
    daysInMonth: number;
    categoryBreakdown: {
        BREAD: number;
        ROLL: number;
        SWEET: number;
        SAVORY: number;
    };
}

interface ProductRankingItem {
    productId: string;
    productName: string;
    productType: string;
    sellingPrice: number;
    totalProduced: number;
    totalSold: number;
    totalRevenue: number;
    sharePercent: number;
    sellThroughRate: number;
}

const CATEGORY_MAP: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    BREAD: { label: "Chleby", color: "#0c8ac9", icon: Wheat },
    ROLL: { label: "Bułki", color: "#38bdf8", icon: Layers },
    SWEET: { label: "Słodkie Wypieki", color: "#f59e0b", icon: Croissant },
    SAVORY: { label: "Słone Wypieki", color: "#10b981", icon: Pizza },
};

function formatCurrency(amount: number): string {
    return (amount || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
}

export default function PrzychodyTab() {
    const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
    const currentMonthKey = useMemo(() => todayStr.slice(0, 7), [todayStr]);

    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<{
        dailyData: DailyRecord[];
        weeklyData: WeeklyRecord[];
        monthlyData: MonthlyRecord[];
        productRanking: ProductRankingItem[];
        stats: any;
    } | null>(null);

    const [view, setView] = useState<Granularity>("DAILY");
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("CURRENT_MONTH");
    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
    const [selectedCategory, setSelectedCategory] = useState<BakeryCategory>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const fetchRevenueData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/przychody");
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error("Błąd pobierania danych przychodów:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRevenueData();
    }, []);

    const toggleRow = (id: string) => {
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Obsługa przełączania miesięcy w filtrze
    const handlePrevMonth = () => {
        const [yStr, mStr] = selectedMonth.split("-");
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) - 1;
        if (m === 0) {
            m = 12;
            y -= 1;
        }
        setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
        setPeriodPreset("CURRENT_MONTH");
    };

    const handleNextMonth = () => {
        const [yStr, mStr] = selectedMonth.split("-");
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) + 1;
        if (m === 13) {
            m = 1;
            y += 1;
        }
        setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
        setPeriodPreset("CURRENT_MONTH");
    };

    // --- FILTROWANIE DANYCH DZIENNYCH ---
    const filteredDailyData = useMemo(() => {
        if (!data?.dailyData) return [];
        let list = [...data.dailyData];

        if (periodPreset === "CURRENT_MONTH") {
            list = list.filter((d) => d.date.startsWith(selectedMonth));
        } else if (periodPreset === "PREV_MONTH") {
            const [yStr, mStr] = currentMonthKey.split("-");
            let y = parseInt(yStr, 10);
            let m = parseInt(mStr, 10) - 1;
            if (m === 0) {
                m = 12;
                y -= 1;
            }
            const prevKey = `${y}-${String(m).padStart(2, "0")}`;
            list = list.filter((d) => d.date.startsWith(prevKey));
        } else if (periodPreset === "30D") {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - 30);
            list = list.filter((d) => new Date(d.date) >= dateLimit);
        } else if (periodPreset === "90D") {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - 90);
            list = list.filter((d) => new Date(d.date) >= dateLimit);
        } else if (periodPreset === "YEAR") {
            const currentYear = new Date().getFullYear().toString();
            list = list.filter((d) => d.date.startsWith(currentYear));
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
    }, [data?.dailyData, periodPreset, selectedMonth, currentMonthKey, searchQuery]);

    // --- FILTROWANIE DANYCH TYGODNIOWYCH ---
    const filteredWeeklyData = useMemo(() => {
        if (!data?.weeklyData) return [];
        let list = [...data.weeklyData];

        if (periodPreset === "CURRENT_MONTH" || periodPreset === "PREV_MONTH" || periodPreset === "30D") {
            list = list.slice(0, 8);
        } else if (periodPreset === "90D") {
            list = list.slice(0, 14);
        } else if (periodPreset === "YEAR") {
            const currentYear = new Date().getFullYear();
            list = list.filter((w) => w.year === currentYear);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((w) => w.label.toLowerCase().includes(q));
        }

        return list;
    }, [data?.weeklyData, periodPreset, searchQuery]);

    // --- FILTROWANIE DANYCH MIESIĘCZNYCH ---
    const filteredMonthlyData = useMemo(() => {
        if (!data?.monthlyData) return [];
        let list = [...data.monthlyData];

        if (periodPreset === "YEAR") {
            const currentYear = new Date().getFullYear();
            list = list.filter((m) => m.year === currentYear);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((m) => m.label.toLowerCase().includes(q));
        }

        return list;
    }, [data?.monthlyData, periodPreset, searchQuery]);

    // --- FILTROWANIE RANKINGU PRODUKTÓW ---
    const filteredProductRanking = useMemo(() => {
        if (!data?.productRanking) return [];
        let list = [...data.productRanking];

        if (selectedCategory !== "ALL") {
            list = list.filter((p) => p.productType === selectedCategory);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((p) => p.productName.toLowerCase().includes(q));
        }

        return list;
    }, [data?.productRanking, selectedCategory, searchQuery]);

    // --- DYNAMICZNE PODSUMOWANIE KPI ---
    const activeStats = useMemo(() => {
        let totalIncome = 0;
        let bakerySalesIncome = 0;
        let otherIncome = 0;
        let totalSold = 0;
        let totalProduced = 0;
        let daysCount = 0;
        let peakAmount = 0;
        let peakLabel = "-";

        if (view === "DAILY") {
            daysCount = filteredDailyData.filter((d) => d.hasReport).length;
            filteredDailyData.forEach((d) => {
                totalIncome += d.totalIncome;
                bakerySalesIncome += d.bakerySalesIncome;
                otherIncome += d.otherIncome;
                totalSold += d.totalSold;
                totalProduced += d.totalProduced;

                if (d.totalIncome > peakAmount) {
                    peakAmount = d.totalIncome;
                    peakLabel = `${d.shortDay}, ${formatDate(d.date)}`;
                }
            });
        } else if (view === "WEEKLY") {
            daysCount = filteredWeeklyData.reduce((acc, w) => acc + w.daysWithReport, 0);
            filteredWeeklyData.forEach((w) => {
                totalIncome += w.totalIncome;
                bakerySalesIncome += w.bakerySalesIncome;
                otherIncome += w.otherIncome;
                totalSold += w.totalSold;
                totalProduced += w.totalProduced;

                if (w.totalIncome > peakAmount) {
                    peakAmount = w.totalIncome;
                    peakLabel = w.shortLabel;
                }
            });
        } else if (view === "MONTHLY") {
            daysCount = filteredMonthlyData.reduce((acc, m) => acc + m.daysWithReport, 0);
            filteredMonthlyData.forEach((m) => {
                totalIncome += m.totalIncome;
                bakerySalesIncome += m.bakerySalesIncome;
                otherIncome += m.otherIncome;
                totalSold += m.totalSold;
                totalProduced += m.totalProduced;

                if (m.totalIncome > peakAmount) {
                    peakAmount = m.totalIncome;
                    peakLabel = m.label;
                }
            });
        } else {
            totalIncome = data?.stats?.grandTotalIncome || 0;
            bakerySalesIncome = data?.stats?.grandTotalBakeryIncome || 0;
            otherIncome = data?.stats?.grandTotalOtherIncome || 0;
            totalSold = data?.stats?.grandTotalSold || 0;
            totalProduced = data?.stats?.grandTotalProduced || 0;
            daysCount = data?.stats?.daysWithReportCount || 1;
        }

        const bakeryShare = totalIncome > 0 ? (bakerySalesIncome / totalIncome) * 100 : 0;
        const otherShare = totalIncome > 0 ? (otherIncome / totalIncome) * 100 : 0;
        const avgDaily = daysCount > 0 ? totalIncome / daysCount : 0;
        const sellThrough = totalProduced > 0 ? (totalSold / totalProduced) * 100 : 0;

        return {
            totalIncome: Math.round(totalIncome * 100) / 100,
            bakerySalesIncome: Math.round(bakerySalesIncome * 100) / 100,
            otherIncome: Math.round(otherIncome * 100) / 100,
            bakerySharePercent: Math.round(bakeryShare * 10) / 10,
            otherSharePercent: Math.round(otherShare * 10) / 10,
            avgDailyIncome: Math.round(avgDaily * 100) / 100,
            totalSold,
            totalProduced,
            sellThroughRate: Math.round(sellThrough * 10) / 10,
            daysCount,
            peakAmount: Math.round(peakAmount * 100) / 100,
            peakLabel,
        };
    }, [view, filteredDailyData, filteredWeeklyData, filteredMonthlyData, data?.stats]);

    // Dane do wykresu skumulowanego (Stack Bar)
    const chartData = useMemo(() => {
        if (view === "DAILY") {
            return [...filteredDailyData].reverse().map((d) => ({
                label: `${d.shortDay} ${d.date.slice(8, 10)}.${d.date.slice(5, 7)}`,
                fullDate: d.date,
                dayOfWeek: d.dayOfWeek,
                bakery: d.bakerySalesIncome,
                other: d.otherIncome,
                total: d.totalIncome,
                soldUnits: d.totalSold,
                productsCount: d.products.length,
            }));
        }
        if (view === "WEEKLY") {
            return [...filteredWeeklyData].reverse().map((w) => ({
                label: w.shortLabel,
                fullLabel: w.label,
                bakery: w.bakerySalesIncome,
                other: w.otherIncome,
                total: w.totalIncome,
                avgDaily: w.avgDailyIncome,
                soldUnits: w.totalSold,
            }));
        }
        if (view === "MONTHLY") {
            return [...filteredMonthlyData].reverse().map((m) => ({
                label: m.shortLabel,
                fullLabel: m.label,
                bakery: m.bakerySalesIncome,
                other: m.otherIncome,
                total: m.totalIncome,
                avgDaily: m.avgDailyIncome,
                soldUnits: m.totalSold,
            }));
        }
        return [];
    }, [view, filteredDailyData, filteredWeeklyData, filteredMonthlyData]);

    // Dane do wykresu kołowego źródeł
    const pieSourceData = useMemo(() => {
        if (activeStats.totalIncome === 0) return [];
        return [
            { name: "Sprzedaż pieczywa", value: activeStats.bakerySalesIncome, color: "#042043" },
            { name: "Inne przychody", value: activeStats.otherIncome, color: "#0c8ac9" },
        ];
    }, [activeStats]);

    if (isLoading) {
        return (
            <div className="py-20 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-ui-secondary">
                    <Loader2 size={36} className="animate-spin text-ui-secondary" />
                    <p className="font-bold text-sm tracking-wide">Ładowanie analizy przychodów...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ---------------- NAGŁÓWEK PRZYCHODÓW: SELEKTOR MIESIĄCA ---------------- */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-ui-black flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-600" />
                        Przychody ze sprzedaży
                    </h2>

                </div>

                {/* Szybkie przełączniki miesięcy i odświeżanie */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white border border-ui-accent rounded-xl shadow-xs p-1">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-ui-accent/15 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            title="Poprzedni miesiąc"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 text-xs font-black text-ui-primary min-w-[90px] text-center">
                            {selectedMonth}
                        </span>
                        <button
                            onClick={handleNextMonth}
                            className="p-1.5 hover:bg-ui-accent/15 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            title="Następny miesiąc"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <button
                        onClick={fetchRevenueData}
                        className="p-2.5 bg-white border border-ui-accent rounded-xl text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/15 transition-colors shadow-xs cursor-pointer"
                        title="Odśwież dane"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* ---------------- PRZEŁĄCZNIK WIDOKÓW (TABS) & FILTRY ---------------- */}
            <div className="bg-white border border-ui-accent rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-ui-accent/10 rounded-xl border border-ui-accent/30">
                    <button
                        onClick={() => setView("DAILY")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${view === "DAILY"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <Calendar size={14} />
                        Dzienne
                    </button>
                    <button
                        onClick={() => setView("WEEKLY")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${view === "WEEKLY"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <BarChart3 size={14} />
                        Tygodniowe
                    </button>
                    <button
                        onClick={() => setView("MONTHLY")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${view === "MONTHLY"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <CalendarDays size={14} />
                        Miesięczne
                    </button>
                    <button
                        onClick={() => setView("PRODUCTS")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${view === "PRODUCTS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <Wheat size={14} />
                        Struktura wyrobów ({data?.productRanking.length || 0})
                    </button>
                </div>

                {/* Filtry zakresów */}
                <div className="flex flex-wrap items-center gap-2">
                    {view === "DAILY" && (
                        <div className="flex items-center gap-1 text-xs">
                            {[
                                { id: "CURRENT_MONTH", label: "Wybrany miesiąc" },
                                { id: "30D", label: "Ost. 30 dni" },
                                { id: "90D", label: "Ost. 90 dni" },
                                { id: "YEAR", label: "Bieżący rok" },
                                { id: "ALL", label: "Wszystko" },
                            ].map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setPeriodPreset(p.id as PeriodPreset)}
                                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${periodPreset === p.id
                                        ? "bg-ui-primary text-white shadow-xs"
                                        : "text-ui-secondary hover:bg-ui-accent/10"
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {view === "PRODUCTS" && (
                        <div className="flex items-center gap-1 text-xs">
                            {[
                                { id: "ALL", label: "Wszystkie" },
                                { id: "BREAD", label: "Chleby" },
                                { id: "ROLL", label: "Bułki" },
                                { id: "SWEET", label: "Słodkie" },
                                { id: "SAVORY", label: "Słone" },
                            ].map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCategory(c.id as BakeryCategory)}
                                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${selectedCategory === c.id
                                        ? "bg-ui-primary text-white shadow-xs"
                                        : "text-ui-secondary hover:bg-ui-accent/10"
                                        }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Wyszukiwarka */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-ui-secondary" />
                        <input
                            type="text"
                            placeholder="Szukaj daty, wyrobu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-ui-accent bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-secondary w-44 sm:w-56"
                        />
                    </div>
                </div>
            </div>

            {/* ---------------- KARTY PODSUMOWANIA KPI ---------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KARTA 1: CAŁKOWITY UTARG */}
                <div className="bg-gradient-to-br from-ui-primary to-slate-900 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="text-[11px] uppercase font-bold text-ui-accent tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <DollarSign size={15} className="text-ui-accent" />
                            Całkowity utarg
                        </span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md font-semibold">
                            {activeStats.daysCount} dni z raportem
                        </span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {formatCurrency(activeStats.totalIncome)}
                    </div>
                    <div className="text-[11px] text-ui-accent/80 mt-1 flex items-center justify-between font-medium">
                        <span>Śr. dzienna: <strong>{formatCurrency(activeStats.avgDailyIncome)}</strong></span>
                    </div>
                </div>

                {/* KARTA 2: SPRZEDAŻ PIECZYWA */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Wheat size={15} className="text-ui-primary" />
                                Sprzedaż pieczywa
                            </span>
                            <span className="text-[11px] font-black text-ui-primary bg-ui-accent/20 px-2 py-0.5 rounded-md">
                                {activeStats.bakerySharePercent}% utargu
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-ui-black tracking-tight">
                            {formatCurrency(activeStats.bakerySalesIncome)}
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="w-full bg-ui-accent/20 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-ui-primary h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(activeStats.bakerySharePercent, 100)}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-ui-secondary mt-1 font-semibold flex justify-between">
                            <span>Sprzedano: <strong>{activeStats.totalSold.toLocaleString("pl-PL")} szt.</strong></span>
                            <span>Wyprodukowano: {activeStats.totalProduced.toLocaleString("pl-PL")} szt.</span>
                        </div>
                    </div>
                </div>

                {/* KARTA 3: INNE PRZYCHODY */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <ShoppingBag size={15} className="text-blue-600" />
                                Inne przychody
                            </span>
                            <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                {activeStats.otherSharePercent}% utargu
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-ui-black tracking-tight">
                            {formatCurrency(activeStats.otherIncome)}
                        </div>
                    </div>
                </div>

                {/* KARTA 4: REKORD I WYPRZEDANIE */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Award size={15} className="text-amber-500" />
                                Rekord (Peak)
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {activeStats.sellThroughRate}% wyprzedania
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-ui-black tracking-tight">
                            {formatCurrency(activeStats.peakAmount)}
                        </div>
                    </div>
                    <div className="text-[11px] text-ui-secondary font-semibold mt-2 truncate">
                        Data: <strong className="text-ui-primary">{activeStats.peakLabel}</strong>
                    </div>
                </div>
            </div>

            {/* ---------------- SEKCJA WYKRESÓW ---------------- */}
            {view !== "PRODUCTS" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Główny wykres słupkowy skumulowany (2/3 szerokości) */}
                    <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <BarChart3 size={15} className="text-ui-primary" />
                                {view === "DAILY" && "Dzienny rozkład przychodów (Pieczywo + Inne = Utarg)"}
                                {view === "WEEKLY" && "Tygodniowy rozkład przychodów"}
                                {view === "MONTHLY" && "Miesięczny rozkład przychodów"}
                            </h3>
                            <span className="text-[11px] font-bold text-ui-secondary bg-ui-accent/15 px-2.5 py-0.5 rounded-full">
                                {chartData.length} punktów
                            </span>
                        </div>

                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: "rgba(229, 231, 235, 0.4)" }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const pt = payload[0].payload;
                                                return (
                                                    <div className="bg-white border border-ui-accent/80 rounded-2xl p-4 shadow-xl text-xs min-w-[220px]">
                                                        <div className="font-black text-ui-black border-b border-ui-accent/40 pb-1.5 mb-2.5">
                                                            {pt.fullLabel || (pt.dayOfWeek ? `${pt.dayOfWeek}, ${formatDate(pt.fullDate || "")}` : label)}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between text-ui-black font-black text-sm border-b border-ui-accent/20 pb-1">
                                                                <span>Utarg całkowity:</span>
                                                                <span>{formatCurrency(pt.total)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-ui-primary font-bold">
                                                                <span className="flex items-center gap-1">
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#042043]" />
                                                                    Sprzedaż pieczywa:
                                                                </span>
                                                                <span>{formatCurrency(pt.bakery)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-blue-600 font-bold">
                                                                <span className="flex items-center gap-1">
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                                                                    Inne przychody:
                                                                </span>
                                                                <span>{formatCurrency(pt.other)}</span>
                                                            </div>
                                                            {pt.soldUnits > 0 && (
                                                                <div className="flex items-center justify-between text-ui-secondary pt-1 border-t border-ui-accent/20 font-semibold">
                                                                    <span>Sprzedane sztuki:</span>
                                                                    <span>{pt.soldUnits} szt.</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={{ paddingTop: "10px", fontSize: "11px", fontWeight: "600" }}
                                        iconType="circle"
                                        formatter={(val) => (val === "bakery" ? "Sprzedaż pieczywa" : val === "other" ? "Inne przychody" : val)}
                                    />
                                    <Bar dataKey="bakery" stackId="a" fill="#042043" radius={[0, 0, 0, 0]} maxBarSize={36} />
                                    <Bar dataKey="other" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Wykres kołowy struktury przychodów (1/3 szerokości) */}
                    <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <PieIcon size={15} className="text-ui-primary" />
                                Struktura źródeł przychodu
                            </h3>
                        </div>

                        <div className="h-[200px] w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieSourceData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {pieSourceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val: number) => formatCurrency(val)}
                                        contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", fontWeight: "bold", fontSize: "12px" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ui-accent/30 text-xs">
                            <div className="p-2 rounded-xl bg-ui-accent/10">
                                <div className="text-[10px] text-ui-secondary font-bold">Pieczywo:</div>
                                <div className="font-black text-ui-primary text-sm">{activeStats.bakerySharePercent}%</div>
                                <div className="text-[10px] text-ui-secondary">{formatCurrency(activeStats.bakerySalesIncome)}</div>
                            </div>
                            <div className="p-2 rounded-xl bg-blue-50">
                                <div className="text-[10px] text-blue-600 font-bold">Inne:</div>
                                <div className="font-black text-blue-900 text-sm">{activeStats.otherSharePercent}%</div>
                                <div className="text-[10px] text-blue-700">{formatCurrency(activeStats.otherIncome)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ---------------- TABELE SZCZEGÓŁOWE ---------------- */}

            {/* 1. TABELA DZIENNA */}
            {view === "DAILY" && (
                <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                            <Calendar size={14} /> Dzienny rejestr utargu i sprzedaży
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
                                    <th className="p-3.5 text-right">Sprzedaż pieczywa</th>
                                    <th className="p-3.5 text-right">Inne przychody</th>
                                    <th className="p-3.5 text-right">Utarg całkowity</th>
                                    <th className="p-3.5 text-center">Udział pieczywa</th>
                                    <th className="p-3.5 text-center">Sprzedano (szt.)</th>
                                    <th className="p-3.5 text-center">Wyprzedanie (%)</th>
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
                                                    className={`hover:bg-ui-accent/10 transition-colors cursor-pointer ${isExpanded ? "bg-ui-accent/10" : ""
                                                        }`}
                                                >
                                                    <td className="p-3.5 font-bold text-ui-black">
                                                        {formatDate(d.date)}
                                                    </td>
                                                    <td className="p-3.5 text-ui-secondary font-semibold">
                                                        <span className={d.isWeekend ? "text-amber-600 font-bold" : ""}>
                                                            {d.dayOfWeek}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-right font-bold text-ui-primary">
                                                        {formatCurrency(d.bakerySalesIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-bold text-blue-600">
                                                        {formatCurrency(d.otherIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-black text-ui-black text-sm">
                                                        {formatCurrency(d.totalIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ui-accent/20 text-ui-primary font-bold text-[11px]">
                                                            {d.bakerySharePercent}%
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center font-bold text-ui-black">
                                                        {d.totalSold.toLocaleString("pl-PL")}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${d.sellThroughRate >= 90
                                                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                                                : d.sellThroughRate >= 75
                                                                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                                                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                                                }`}
                                                        >
                                                            {d.sellThroughRate}%
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-center text-ui-secondary">
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </td>
                                                </tr>

                                                {/* ROZWINIĘCIE DNIA ZE SZCZEGÓŁAMI WYROBÓW */}
                                                {isExpanded && (
                                                    <tr className="bg-ui-accent/5">
                                                        <td colSpan={9} className="p-4 border-b border-ui-accent/30">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between text-[11px] font-bold text-ui-secondary uppercase tracking-wider">
                                                                    <span>Rozbicie sprzedaży wyrobów w dniu {formatDate(d.date)}:</span>
                                                                    <span>Łącznie pozycji: {d.products.length}</span>
                                                                </div>

                                                                {/* Kategorie w danym dniu */}
                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                                                    {Object.entries(d.categoryBreakdown).map(([catKey, val]) => {
                                                                        const catInfo = CATEGORY_MAP[catKey];
                                                                        const Icon = catInfo?.icon || Wheat;
                                                                        return (
                                                                            <div key={catKey} className="p-2.5 rounded-xl bg-white border border-ui-accent/50 shadow-2xs flex items-center justify-between">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Icon size={14} className="text-ui-secondary" />
                                                                                    <span className="text-[11px] font-bold text-ui-black">{catInfo?.label}</span>
                                                                                </div>
                                                                                <span className="text-xs font-black text-ui-primary">{formatCurrency(val)}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Lista produktów */}
                                                                {d.products.length > 0 ? (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                                        {d.products.map((prod) => (
                                                                            <div
                                                                                key={prod.productId}
                                                                                className="p-2.5 rounded-xl bg-white border border-ui-accent/40 shadow-2xs flex flex-col justify-between"
                                                                            >
                                                                                <div className="flex items-start justify-between gap-1">
                                                                                    <span className="font-bold text-ui-black text-xs truncate" title={prod.productName}>
                                                                                        {prod.productName}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-ui-accent/15 text-ui-secondary whitespace-nowrap">
                                                                                        {prod.sellingPrice.toFixed(2)} zł
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-[10px] text-ui-secondary mt-1 flex justify-between">
                                                                                    <span>Sprzedano: <strong>{prod.soldAmount} szt.</strong></span>
                                                                                    <span>Wypiek: {prod.producedAmount} szt.</span>
                                                                                </div>
                                                                                <div className="mt-2 pt-1 border-t border-ui-accent/20 flex items-center justify-between text-xs">
                                                                                    <span className="text-ui-secondary text-[10px]">Przychód:</span>
                                                                                    <span className="font-black text-ui-primary">
                                                                                        {formatCurrency(prod.salesIncome)}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-3 text-xs text-ui-secondary italic">
                                                                        Brak wpisów jednostkowych sprzedaży w tym dniu
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-ui-secondary italic">
                                            Brak danych o przychodach w wybranym okresie
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 2. TABELA TYGODNIOWA */}
            {view === "WEEKLY" && (
                <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                            <BarChart3 size={14} /> Tygodniowy rejestr przychodów
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
                                    <th className="p-3.5 text-center">Dni z raportem</th>
                                    <th className="p-3.5 text-right">Sprzedaż pieczywa</th>
                                    <th className="p-3.5 text-right">Inne przychody</th>
                                    <th className="p-3.5 text-right">Utarg całkowity</th>
                                    <th className="p-3.5 text-right">Średnia dzienna</th>
                                    <th className="p-3.5 text-center">Udział pieczywa</th>
                                    <th className="p-3.5 text-center">Sprzedano szt.</th>
                                    <th className="p-3.5 text-center">Wyprzedanie (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/30 font-medium">
                                {filteredWeeklyData.length > 0 ? (
                                    filteredWeeklyData.map((w) => (
                                        <tr key={w.key} className="hover:bg-ui-accent/5 transition-colors">
                                            <td className="p-3.5">
                                                <div className="font-bold text-ui-black">{w.label}</div>
                                                <div className="text-[10px] text-ui-secondary mt-0.5">
                                                    {formatDate(w.startDate)} — {formatDate(w.endDate)}
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-ui-accent/15 text-ui-primary font-bold text-[11px]">
                                                    {w.daysWithReport} / 7 dni
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right font-bold text-ui-primary">
                                                {formatCurrency(w.bakerySalesIncome)}
                                            </td>
                                            <td className="p-3.5 text-right font-bold text-blue-600">
                                                {formatCurrency(w.otherIncome)}
                                            </td>
                                            <td className="p-3.5 text-right font-black text-ui-black text-sm">
                                                {formatCurrency(w.totalIncome)}
                                            </td>
                                            <td className="p-3.5 text-right font-bold text-ui-secondary">
                                                {formatCurrency(w.avgDailyIncome)}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ui-accent/20 text-ui-primary font-bold text-[11px]">
                                                    {w.bakerySharePercent}%
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center font-bold text-ui-black">
                                                {w.totalSold.toLocaleString("pl-PL")}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                    {w.sellThroughRate}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-ui-secondary italic">
                                            Brak danych dla wybranego okresu
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. TABELA MIESIĘCZNA */}
            {view === "MONTHLY" && (
                <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                            <CalendarDays size={14} /> Miesięczne zestawienie przychodów
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
                                    <th className="p-3.5 text-center">Dni z raportem</th>
                                    <th className="p-3.5 text-right">Sprzedaż pieczywa</th>
                                    <th className="p-3.5 text-right">Inne przychody</th>
                                    <th className="p-3.5 text-right">Utarg całkowity</th>
                                    <th className="p-3.5 text-right">Średnia dzienna</th>
                                    <th className="p-3.5 text-center">Udział pieczywa</th>
                                    <th className="p-3.5 text-center">Sprzedane sztuki</th>
                                    <th className="p-3.5 text-center">Wyprzedanie (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/30 font-medium">
                                {filteredMonthlyData.length > 0 ? (
                                    filteredMonthlyData.map((m) => (
                                        <tr key={m.key} className="hover:bg-ui-accent/5 transition-colors">
                                            <td className="p-3.5 font-bold text-ui-black text-sm">
                                                {m.label}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ui-accent/15 text-ui-primary font-bold text-[11px]">
                                                    {m.daysWithReport} / {m.daysInMonth} dni
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right font-bold text-ui-primary">
                                                {formatCurrency(m.bakerySalesIncome)}
                                            </td>
                                            <td className="p-3.5 text-right font-bold text-blue-600">
                                                {formatCurrency(m.otherIncome)}
                                            </td>
                                            <td className="p-3.5 text-right font-black text-ui-black text-sm">
                                                {formatCurrency(m.totalIncome)}
                                            </td>
                                            <td className="p-3.5 text-right font-bold text-ui-secondary">
                                                {formatCurrency(m.avgDailyIncome)}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-ui-accent/20 text-ui-primary font-bold text-[11px]">
                                                    {m.bakerySharePercent}%
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center font-bold text-ui-black">
                                                {m.totalSold.toLocaleString("pl-PL")} szt.
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                    {m.sellThroughRate}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-ui-secondary italic">
                                            Brak danych dla wybranego okresu
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 4. STRUKTURA I RANKING WYROBÓW */}
            {view === "PRODUCTS" && (
                <div className="space-y-6">
                    {/* Karty kategorii */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        {Object.entries(CATEGORY_MAP).map(([catKey, catInfo]) => {
                            const Icon = catInfo.icon;
                            const totalRev = data?.stats?.categoryTotals?.[catKey as keyof typeof data.stats.categoryTotals] || 0;
                            const grandBakery = data?.stats?.grandTotalBakeryIncome || 1;
                            const share = Math.round((totalRev / grandBakery) * 1000) / 10;
                            return (
                                <div key={catKey} className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-ui-secondary uppercase">
                                        <span className="flex items-center gap-1.5">
                                            <Icon size={14} className="text-ui-primary" />
                                            {catInfo.label}
                                        </span>
                                        <span className="font-bold text-ui-primary">{share}%</span>
                                    </div>
                                    <div className="mt-2 text-xl font-black text-ui-black">
                                        {formatCurrency(totalRev)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tabela rankingu wyrobów */}
                    <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <Wheat size={14} /> Ranking wyrobów wg generowanego przychodu
                            </h3>
                            <span className="text-[11px] font-semibold text-ui-secondary">
                                {filteredProductRanking.length} pozycji
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                        <th className="p-3.5 w-12 text-center">#</th>
                                        <th className="p-3.5">Nazwa wyrobu</th>
                                        <th className="p-3.5">Kategoria</th>
                                        <th className="p-3.5 text-right">Cena jedn.</th>
                                        <th className="p-3.5 text-center">Sprzedano (szt.)</th>
                                        <th className="p-3.5 text-center">Wyprodukowano (szt.)</th>
                                        <th className="p-3.5 text-center">Wyprzedanie (%)</th>
                                        <th className="p-3.5 text-right">Łączny przychód</th>
                                        <th className="p-3.5 text-center w-36">Udział w pieczywie</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/30 font-medium">
                                    {filteredProductRanking.length > 0 ? (
                                        filteredProductRanking.map((p, idx) => {
                                            const catInfo = CATEGORY_MAP[p.productType];
                                            return (
                                                <tr key={p.productId} className="hover:bg-ui-accent/5 transition-colors">
                                                    <td className="p-3.5 text-center font-black text-ui-secondary">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="p-3.5 font-bold text-ui-black">
                                                        {p.productName}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-ui-accent/15 text-ui-primary">
                                                            {catInfo?.label || p.productType}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-right font-semibold text-ui-secondary">
                                                        {p.sellingPrice.toFixed(2)} zł
                                                    </td>
                                                    <td className="p-3.5 text-center font-bold text-ui-black">
                                                        {p.totalSold.toLocaleString("pl-PL")}
                                                    </td>
                                                    <td className="p-3.5 text-center text-ui-secondary">
                                                        {p.totalProduced.toLocaleString("pl-PL")}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                            {p.sellThroughRate}%
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-right font-black text-ui-black text-sm">
                                                        {formatCurrency(p.totalRevenue)}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-ui-accent/20 h-2 rounded-full overflow-hidden">
                                                                <div
                                                                    className="bg-ui-primary h-full rounded-full"
                                                                    style={{ width: `${Math.min(Math.max(p.sharePercent, 2), 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[11px] font-bold text-ui-primary min-w-[32px] text-right">
                                                                {p.sharePercent}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-ui-secondary italic">
                                                Brak wyrobów spełniających kryteria wyszukiwania
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
