"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    PieChart as PieIcon,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    Layers,
    Receipt,
    ShoppingBag,
    Building2,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Info,
    Percent,
    Wallet,
    Scale,
    PiggyBank,
    Award
} from "lucide-react";
import {
    ResponsiveContainer,
    ComposedChart,
    BarChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell
} from "recharts";

interface MonthlyData {
    monthIndex: number;
    monthKey: string;
    monthName: string;
    shortMonth: string;
    year: number;
    retailBakeryRevenue: number;
    retailOtherRevenue: number;
    retailTotalRevenue: number;
    salesInvoicesGross: number;
    salesInvoicesNet: number;
    totalRevenue: number;
    costInvoicesGross: number;
    costInvoicesNet: number;
    costOperational: number;
    totalCost: number;
    netProfit: number;
    profitMargin: number;
    isCurrentMonth: boolean;
    hasData: boolean;
    categoryRevenues: {
        BREAD: number;
        ROLL: number;
        SWEET: number;
        SAVORY: number;
    };
}

interface SummaryResponse {
    year: number;
    kpis: {
        totalRevenue: number;
        totalCost: number;
        netProfit: number;
        profitMargin: number;
        avgMonthlyRevenue: number;
        avgMonthlyCost: number;
        avgMonthlyProfit: number;
        activeMonthsCount: number;
        grandBakeryRevenue: number;
        grandOtherRevenue: number;
        grandSalesInvGross: number;
        grandOperationalCosts: number;
        grandCostInvoicesGross: number;
        bestMonth: {
            monthKey: string;
            monthName: string;
            netProfit: number;
            totalRevenue: number;
            totalCost: number;
            profitMargin: number;
        } | null;
        worstMonth: {
            monthKey: string;
            monthName: string;
            netProfit: number;
            totalRevenue: number;
            totalCost: number;
            profitMargin: number;
        } | null;
    };
    monthlyData: MonthlyData[];
    revenueStructure: Array<{
        id: string;
        name: string;
        value: number;
        sharePercent: number;
        color: string;
    }>;
    bakeryCategoriesBreakdown: Array<{
        id: string;
        name: string;
        value: number;
        color: string;
    }>;
    costStructure: {
        grandOperationalCosts: number;
        grandCostInvoicesGross: number;
        operationalSharePercent: number;
        invoicesSharePercent: number;
        items: Array<{
            id: string;
            name: string;
            source: "OPERATIONAL" | "INVOICE";
            sourceLabel: string;
            value: number;
            sharePercent: number;
        }>;
    };
    availableYears: number[];
}

const COST_COLORS = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308",
    "#84cc16", "#06b6d4", "#3b82f6", "#6366f1",
    "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"
];

function formatPLN(val: number): string {
    return new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        maximumFractionDigits: 2,
    }).format(val);
}

function formatCompactPLN(val: number): string {
    if (Math.abs(val) >= 1_000_000) {
        const mln = Math.round((val / 1_000_000) * 10) / 10;
        return `${mln.toLocaleString("pl-PL")} mln zł`;
    }
    if (Math.abs(val) >= 1_000) {
        const tys = Math.round((val / 1_000) * 10) / 10;
        return `${tys.toLocaleString("pl-PL")} tys. zł`;
    }
    return Math.round(val).toLocaleString("pl-PL") + " zł";
}

export default function PodsumowanieTab() {
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [viewMode, setViewMode] = useState<"12M" | "6M" | "QUARTERS" | "CUSTOM">("12M");
    const [customStartMonth, setCustomStartMonth] = useState<string>(`${new Date().getFullYear()}-01`);
    const [customEndMonth, setCustomEndMonth] = useState<string>(`${new Date().getFullYear()}-12`);
    const [data, setData] = useState<SummaryResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [activeCostView, setActiveCostView] = useState<"ALL" | "OPERATIONAL" | "INVOICES">("ALL");

    const fetchData = async (year: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/finanse/podsumowanie?year=${year}`);
            if (!res.ok) {
                throw new Error("Nie udało się pobrać danych podsumowania finansowego");
            }
            const json: SummaryResponse = await res.json();
            setData(json);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Błąd połączenia z serwerem");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedYear);
        setCustomStartMonth(`${selectedYear}-01`);
        setCustomEndMonth(`${selectedYear}-12`);
    }, [selectedYear]);

    // Filtrowane dane dla wykresów w zależności od viewMode
    const filteredChartData = useMemo(() => {
        if (!data) return [];
        if (viewMode === "6M") {
            const currentMonthIdx = new Date().getMonth();
            const startIdx = Math.max(0, currentMonthIdx - 5);
            return data.monthlyData.slice(startIdx, startIdx + 6);
        }
        if (viewMode === "CUSTOM") {
            const start = customStartMonth || `${selectedYear}-01`;
            const end = customEndMonth || `${selectedYear}-12`;
            const filtered = data.monthlyData.filter((m) => m.monthKey >= start && m.monthKey <= end);
            return filtered.length > 0 ? filtered : data.monthlyData;
        }
        if (viewMode === "QUARTERS") {
            // Grupowanie w kwartały Q1..Q4
            const quarters = [
                { name: "Q1", fullMonth: "I Kwartał", months: data.monthlyData.slice(0, 3) },
                { name: "Q2", fullMonth: "II Kwartał", months: data.monthlyData.slice(3, 6) },
                { name: "Q3", fullMonth: "III Kwartał", months: data.monthlyData.slice(6, 9) },
                { name: "Q4", fullMonth: "IV Kwartał", months: data.monthlyData.slice(9, 12) },
            ];

            return quarters.map((q) => {
                const totalRevenue = q.months.reduce((sum, m) => sum + m.totalRevenue, 0);
                const totalCost = q.months.reduce((sum, m) => sum + m.totalCost, 0);
                const netProfit = totalRevenue - totalCost;
                const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
                return {
                    shortMonth: q.name,
                    monthName: q.fullMonth,
                    totalRevenue: Math.round(totalRevenue * 100) / 100,
                    totalCost: Math.round(totalCost * 100) / 100,
                    netProfit: Math.round(netProfit * 100) / 100,
                    profitMargin: Math.round(profitMargin * 10) / 10,
                };
            });
        }
        return data.monthlyData;
    }, [data, viewMode, customStartMonth, customEndMonth, selectedYear]);

    // Filtrowana lista kosztów do wykresu struktury
    const filteredCostItems = useMemo(() => {
        if (!data?.costStructure?.items) return [];
        if (activeCostView === "OPERATIONAL") {
            return data.costStructure.items.filter((i) => i.source === "OPERATIONAL");
        }
        if (activeCostView === "INVOICES") {
            return data.costStructure.items.filter((i) => i.source === "INVOICE");
        }
        return data.costStructure.items;
    }, [data, activeCostView]);

    const kpis = data?.kpis;

    return (
        <div className="space-y-6">
            {/* ---------------- PASEK KONTROLNY / WYBÓR ROKU I WIDOKU ---------------- */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-ui-accent/40 shadow-xs flex flex-col gap-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm">
                            <Scale size={24} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-ui-black tracking-tight">
                                Podsumowanie finansowe
                            </h2>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Przełącznik lat */}
                        <div className="flex items-center bg-ui-accent/15 p-1 rounded-xl border border-ui-accent/40">
                            <button
                                onClick={() => setSelectedYear((prev) => prev - 1)}
                                className="p-1.5 hover:bg-white text-ui-secondary hover:text-ui-black rounded-lg transition-colors cursor-pointer"
                                title="Poprzedni rok"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 text-xs sm:text-sm font-bold text-ui-black">
                                {selectedYear}
                            </span>
                            <button
                                onClick={() => setSelectedYear((prev) => prev + 1)}
                                className="p-1.5 hover:bg-white text-ui-secondary hover:text-ui-black rounded-lg transition-colors cursor-pointer"
                                title="Następny rok"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Tryb widoku (12M, 6M, Kwartały, Własny zakres) */}
                        <div className="flex flex-wrap items-center bg-ui-accent/15 p-1 rounded-xl border border-ui-accent/40 text-xs font-bold gap-1">
                            <button
                                onClick={() => setViewMode("12M")}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "12M"
                                    ? "bg-white text-ui-black shadow-xs font-bold"
                                    : "text-ui-secondary hover:text-ui-primary"
                                    }`}
                            >
                                12 Miesięcy
                            </button>
                            <button
                                onClick={() => setViewMode("6M")}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "6M"
                                    ? "bg-white text-ui-black shadow-xs font-bold"
                                    : "text-ui-secondary hover:text-ui-primary"
                                    }`}
                            >
                                6 Miesięcy
                            </button>
                            <button
                                onClick={() => setViewMode("QUARTERS")}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "QUARTERS"
                                    ? "bg-white text-ui-black shadow-xs font-bold"
                                    : "text-ui-secondary hover:text-ui-primary"
                                    }`}
                            >
                                Kwartały
                            </button>
                            <button
                                onClick={() => {
                                    setViewMode("CUSTOM");
                                    if (!customStartMonth) setCustomStartMonth(`${selectedYear}-01`);
                                    if (!customEndMonth) setCustomEndMonth(`${selectedYear}-12`);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "CUSTOM"
                                    ? "bg-white text-ui-black shadow-xs font-bold"
                                    : "text-ui-secondary hover:text-ui-primary"
                                    }`}
                            >
                                <CalendarDays size={13} />
                                <span>Własny zakres</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-bar dla wyboru własnego zakresu miesięcy */}
                {viewMode === "CUSTOM" && (
                    <div className="pt-3 border-t border-ui-accent/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-ui-secondary">Zakres od:</span>
                            <input
                                type="month"
                                value={customStartMonth}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomStartMonth(val);
                                }}
                                className="bg-ui-white border border-ui-accent rounded-lg px-2.5 py-1 font-bold text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-2xs"
                            />
                            <span className="font-bold text-ui-secondary">do:</span>
                            <input
                                type="month"
                                value={customEndMonth}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomEndMonth(val);
                                }}
                                className="bg-ui-white border border-ui-accent rounded-lg px-2.5 py-1 font-bold text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-2xs"
                            />
                        </div>
                        <div className="text-xs text-ui-secondary font-semibold">
                            Wyświetlono: <b className="text-ui-black">{filteredChartData.length}</b> {filteredChartData.length === 1 ? "miesiąc" : filteredChartData.length < 5 ? "miesiące" : "miesięcy"} na wykresie
                        </div>
                    </div>
                )}
            </div>

            {/* ---------------- STAN ŁADOWANIA I BŁĘDU ---------------- */}
            {loading && !data && (
                <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-ui-accent/40 shadow-xs space-y-3">
                    <Loader2 size={36} className="animate-spin text-emerald-600" />
                    <p className="text-sm font-bold text-ui-secondary">Kalkulowanie zestawienia zysków i kosztów...</p>
                </div>
            )}

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
                    <AlertCircle size={20} className="shrink-0" />
                    <span className="text-xs sm:text-sm font-bold">{error}</span>
                </div>
            )}

            {data && (
                <>
                    {/* ---------------- 4 GŁÓWNE KARTY KPI (ZESTAWIENIE ZYSK vs KOSZT) ---------------- */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* KARTA 1: PRZYCHODY ŁĄCZNIE */}
                        <div className="bg-white p-5 rounded-2xl border border-ui-accent/40 shadow-xs hover:border-ui-secondary transition-all flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-bold text-ui-secondary uppercase tracking-wider">
                                    Przychody Całkowite
                                </span>
                                <div className="text-ui-secondary">
                                    <TrendingUp size={18} />
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl sm:text-3xl font-extrabold text-ui-primary tracking-tight text-emerald-600">
                                    {formatPLN(kpis?.totalRevenue || 0)}
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-ui-accent/20 flex flex-col gap-1 text-xs font-semibold text-ui-secondary">
                                    <div className="flex justify-between">
                                        <span>Sprzedaż w sklepie:</span>
                                        <span className="text-ui-black font-bold">
                                            {formatPLN((kpis?.grandBakeryRevenue || 0) + (kpis?.grandOtherRevenue || 0))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Faktury B2B (sprzedaż):</span>
                                        <span className="text-ui-black font-bold">
                                            {formatPLN(kpis?.grandSalesInvGross || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KARTA 2: KOSZTY ŁĄCZNIE */}
                        <div className="bg-white p-5 rounded-2xl border border-ui-accent/40 shadow-xs hover:border-ui-secondary transition-all flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-bold text-ui-secondary uppercase tracking-wider">
                                    Koszty Całkowite
                                </span>
                                <div className="text-ui-secondary">
                                    <TrendingDown size={18} />
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl sm:text-3xl font-extrabold text-ui-primary tracking-tight text-rose-600">
                                    {formatPLN(kpis?.totalCost || 0)}
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-ui-accent/20 flex flex-col gap-1 text-xs font-semibold text-ui-secondary">
                                    <div className="flex justify-between">
                                        <span>Faktury kosztowe:</span>
                                        <span className="text-ui-black font-bold">
                                            {formatPLN(kpis?.grandCostInvoicesGross || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Koszty stałe / operacyjne:</span>
                                        <span className="text-ui-black font-bold">
                                            {formatPLN(kpis?.grandOperationalCosts || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KARTA 3: WYNIK FINANSOWY (ZYSK NETTO / STRATA) */}
                        <div
                            className="bg-white p-5 rounded-2xl border border-ui-accent/40 shadow-xs hover:border-ui-secondary transition-all flex flex-col justify-between"
                        >
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-bold text-ui-secondary uppercase tracking-wider">
                                    Wynik Finansowy (Zysk)
                                </span>
                                <div className="text-ui-secondary">
                                    <PiggyBank size={18} />
                                </div>
                            </div>
                            <div>
                                <div
                                    className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${(kpis?.netProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                                        }`}
                                >
                                    {(kpis?.netProfit || 0) >= 0 ? "+" : ""}
                                    {formatPLN(kpis?.netProfit || 0)}
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-ui-accent/20 flex items-center justify-between text-xs font-semibold text-ui-secondary">
                                    <span>Średnio na miesiąc:</span>
                                    <span className="text-ui-black font-bold">
                                        {formatPLN(kpis?.avgMonthlyProfit || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* KARTA 4: RENTOWNOŚĆ / MARŻA ZYSKU */}
                        <div className="bg-white p-5 rounded-2xl border border-ui-accent/40 shadow-xs hover:border-ui-secondary transition-all flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-bold text-ui-secondary uppercase tracking-wider">
                                    Marża Rentowności
                                </span>
                                <div className="text-ui-secondary">
                                    <Percent size={18} />
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl sm:text-3xl font-extrabold text-ui-primary tracking-tight flex items-baseline gap-2">
                                    <span>{kpis?.profitMargin || 0}%</span>
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-ui-accent/20 flex flex-col gap-1 text-xs font-semibold text-ui-secondary">
                                    <div className="flex justify-between items-center">
                                        <span>Najlepszy:</span>
                                        <span className="text-emerald-700 font-bold">
                                            {kpis?.bestMonth ? `${kpis.bestMonth.monthName.split(" ")[0]} (${formatCompactPLN(kpis.bestMonth.netProfit)})` : "—"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Najgorszy:</span>
                                        <span className="text-rose-700 font-bold">
                                            {kpis?.worstMonth ? `${kpis.worstMonth.monthName.split(" ")[0]} (${formatCompactPLN(kpis.worstMonth.netProfit)})` : "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ---------------- GŁÓWNY WYKRES PORÓWNAWCZY: PRZYCHODY VS KOSZTY VS ZYSK ---------------- */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-ui-accent/40 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-ui-black flex items-center gap-2">
                                    <BarChart3 size={35} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
                                    Zestawienie finansowe {selectedYear}
                                </h3>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-semibold">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                                    <span>Przychody</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" />
                                    <span>Koszty</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-1 bg-ui-primary inline-block rounded-full" />
                                    <span>Zysk Netto</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-72 sm:h-96 w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={filteredChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="shortMonth"
                                        tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                                        axisLine={{ stroke: "#e2e8f0" }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => formatCompactPLN(val)}
                                        tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={65}
                                    />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const item = payload[0].payload;
                                                return (
                                                    <div className="bg-white text-ui-black p-3.5 rounded-2xl shadow-xl border border-ui-accent/60 text-xs font-medium space-y-2 min-w-[220px]">
                                                        <div className="font-bold text-sm border-b border-ui-accent/40 pb-1.5 text-ui-primary flex items-center justify-between">
                                                            <span>{item.monthName || label}</span>
                                                        </div>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-ui-secondary flex items-center gap-1.5 font-medium">
                                                                    <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
                                                                    Przychody:
                                                                </span>
                                                                <span className="font-bold text-emerald-600">{formatPLN(item.totalRevenue || 0)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-ui-secondary flex items-center gap-1.5 font-medium">
                                                                    <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block" />
                                                                    Koszty:
                                                                </span>
                                                                <span className="font-bold text-rose-600">{formatPLN(item.totalCost || 0)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="pt-1.5 border-t border-ui-accent/30 space-y-1 text-xs">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-ui-primary font-semibold">Wynik netto:</span>
                                                                <span className={`font-bold ${(item.netProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                                                    {(item.netProfit || 0) >= 0 ? "+" : ""}
                                                                    {formatPLN(item.netProfit || 0)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[11px]">
                                                                <span className="text-ui-secondary font-medium">Marża:</span>
                                                                <span className="font-bold text-amber-700">{item.profitMargin || 0}%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="totalRevenue" name="Przychody" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                    <Bar dataKey="totalCost" name="Koszty" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                    <Line
                                        type="monotone"
                                        dataKey="netProfit"
                                        name="Zysk Netto"
                                        stroke="#1e293b"
                                        strokeWidth={3}
                                        dot={{ fill: "#1e293b", r: 4, strokeWidth: 2, stroke: "#ffffff" }}
                                        activeDot={{ r: 6, fill: "#10b981" }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ---------------- STRUKTURA PRZYCHODÓW & STRUKTURA KOSZTÓW (2 KOLUMNY WYKRESÓW KOŁOWYCH) ---------------- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* WYKRES 1: STRUKTURA PRZYCHODÓW */}
                        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-ui-accent/40 shadow-xs space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-bold text-ui-primary flex items-center gap-2">
                                        <PieIcon size={35} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
                                        Struktura przychodów w {selectedYear}
                                    </h3>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center py-2">
                                <div className="h-48 sm:h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.revenueStructure}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={75}
                                                paddingAngle={4}
                                            >
                                                {data.revenueStructure.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: any) => [formatPLN(Number(value)), "Przychód"]}
                                                contentStyle={{
                                                    backgroundColor: "#ffffff",
                                                    borderRadius: "14px",
                                                    border: "1px solid rgba(226, 232, 240, 0.8)",
                                                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                                                    fontWeight: 600,
                                                    fontSize: "12px",
                                                    color: "#0f172a"
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-2.5">
                                    {data.revenueStructure.map((item) => (
                                        <div key={item.id} className="p-2.5 bg-ui-accent/10 rounded-xl flex items-center justify-between text-xs gap-3">
                                            <div className="flex items-start gap-2 min-w-0">
                                                <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: item.color }} />
                                                <span className="font-semibold text-ui-black break-words leading-snug text-xs">{item.name}</span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-bold text-ui-black">{formatCompactPLN(item.value)}</div>
                                                <div className="text-[10px] font-semibold text-ui-secondary">{item.sharePercent}%</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* WYKRES 2: STRUKTURA KOSZTÓW */}
                        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-ui-accent/40 shadow-xs space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-bold text-ui-black mb-3 flex items-center gap-2">
                                        <PieIcon size={35} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
                                        Struktura kosztów w {selectedYear}
                                    </h3>
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                    {/* Filtr kosztów */}
                                    <div className="flex items-center gap-1 text-[11px] font-bold bg-ui-accent/15 p-0.5 rounded-lg">
                                        <button
                                            onClick={() => setActiveCostView("ALL")}
                                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${activeCostView === "ALL" ? "bg-white text-ui-black shadow-xs font-bold" : "text-ui-secondary"
                                                }`}
                                        >
                                            Wszystko
                                        </button>
                                        <button
                                            onClick={() => setActiveCostView("OPERATIONAL")}
                                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${activeCostView === "OPERATIONAL" ? "bg-white text-ui-black shadow-xs font-bold" : "text-ui-secondary"
                                                }`}
                                        >
                                            Wynagrodzenia, podatki, ZUS
                                        </button>
                                        <button
                                            onClick={() => setActiveCostView("INVOICES")}
                                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${activeCostView === "INVOICES" ? "bg-white text-ui-black shadow-xs font-bold" : "text-ui-secondary"
                                                }`}
                                        >
                                            Faktury
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center py-2">
                                <div className="h-48 sm:h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={filteredCostItems}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={75}
                                                paddingAngle={4}
                                            >
                                                {filteredCostItems.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COST_COLORS[index % COST_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: any) => [formatPLN(Number(value)), "Koszt"]}
                                                contentStyle={{
                                                    backgroundColor: "#ffffff",
                                                    borderRadius: "14px",
                                                    border: "1px solid rgba(226, 232, 240, 0.8)",
                                                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                                                    fontWeight: 600,
                                                    fontSize: "12px",
                                                    color: "#0f172a"
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                    {filteredCostItems.map((item, idx) => (
                                        <div key={item.id} className="p-2 bg-ui-accent/10 rounded-xl flex items-center justify-between text-xs gap-2">
                                            <div className="flex items-start gap-2 min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: COST_COLORS[idx % COST_COLORS.length] }} />
                                                <span className="font-semibold text-ui-black break-words leading-tight text-[11px]">{item.name}</span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-bold text-ui-black text-[11px]">{formatCompactPLN(item.value)}</div>
                                                <div className="text-[9px] font-semibold text-ui-secondary">{item.sharePercent}%</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ---------------- SZCZEGÓŁOWA TABELA MIESIĘCZNA (P&L RACHUNEK ZYSKÓW I STRAT) ---------------- */}
                    <div className="bg-white rounded-2xl border border-ui-accent/40 shadow-xs overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-ui-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-ui-black flex items-center gap-2">
                                    <Receipt size={35} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
                                    Bilans zysków i strat
                                </h3>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-center border-collapse text-xs">
                                <thead>
                                    <tr className="bg-ui-accent/15 border-b border-ui-accent/30 text-ui-secondary uppercase font-bold tracking-wider text-[11px]">
                                        <th className="py-3 px-4 text-center">Miesiąc</th>
                                        <th className="py-3 px-4 text-center">Utarg</th>
                                        <th className="py-3 px-4 text-center">Sprzedaż na faktury</th>
                                        <th className="py-3 px-4 text-center text-emerald-700 bg-emerald-500/10">Przychody łącznie</th>
                                        <th className="py-3 px-4 text-center">Wynagrodzenia, podatki i ZUS-y</th>
                                        <th className="py-3 px-4 text-center">Faktury kosztowe</th>
                                        <th className="py-3 px-4 text-center text-rose-700 bg-rose-500/10">Koszty łącznie</th>
                                        <th className="py-3 px-4 text-center font-bold">Zysk netto</th>
                                        <th className="py-3 px-4 text-center">Marża %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/20 font-medium text-ui-primary">
                                    {data.monthlyData.map((m) => (
                                        <tr
                                            key={m.monthKey}
                                            className={`hover:bg-ui-accent/10 transition-colors ${m.isCurrentMonth ? "bg-ui-accent/10 font-semibold" : ""
                                                }`}
                                        >
                                            <td className="py-3.5 px-4 font-bold text-ui-black text-center">
                                                <span>{m.monthName}</span>
                                            </td>
                                            <td className="py-3.5 px-4 text-center text-ui-secondary">
                                                {m.retailTotalRevenue > 0 ? formatPLN(m.retailTotalRevenue) : "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-center text-ui-secondary">
                                                {m.salesInvoicesGross > 0 ? formatPLN(m.salesInvoicesGross) : "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-center font-bold text-emerald-700 bg-emerald-500/5">
                                                {m.totalRevenue > 0 ? formatPLN(m.totalRevenue) : "0,00 zł"}
                                            </td>
                                            <td className="py-3.5 px-4 text-center text-ui-secondary">
                                                {m.costOperational > 0 ? formatPLN(m.costOperational) : "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-center text-ui-secondary">
                                                {m.costInvoicesGross > 0 ? formatPLN(m.costInvoicesGross) : "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-center font-bold text-rose-700 bg-rose-500/5">
                                                {m.totalCost > 0 ? formatPLN(m.totalCost) : "0,00 zł"}
                                            </td>
                                            <td className="py-3.5 px-4 text-center font-bold">
                                                <span
                                                    className={`px-2 py-1 rounded-lg inline-block ${m.netProfit >= 0
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : "bg-rose-100 text-rose-800"
                                                        }`}
                                                >
                                                    {m.netProfit >= 0 ? "+" : ""}
                                                    {formatPLN(m.netProfit)}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span
                                                    className={`font-bold ${m.profitMargin >= 15
                                                        ? "text-emerald-700"
                                                        : m.profitMargin > 0
                                                            ? "text-amber-700"
                                                            : "text-rose-700"
                                                        }`}
                                                >
                                                    {m.totalRevenue > 0 ? `${m.profitMargin}%` : "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-ui-accent/20 text-ui-primary font-bold text-xs sm:text-sm">
                                        <td className="py-4 px-4 uppercase tracking-wider text-center">RAZEM {selectedYear}</td>
                                        <td className="py-4 px-4 text-center text-ui-primary/80">
                                            {formatPLN((kpis?.grandBakeryRevenue || 0) + (kpis?.grandOtherRevenue || 0))}
                                        </td>
                                        <td className="py-4 px-4 text-center text-ui-primary/80">
                                            {formatPLN(kpis?.grandSalesInvGross || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-center text-emerald-700 bg-emerald-500/10 font-black">
                                            {formatPLN(kpis?.totalRevenue || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-center text-ui-primary">
                                            {formatPLN(kpis?.grandOperationalCosts || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-center text-ui-primary">
                                            {formatPLN(kpis?.grandCostInvoicesGross || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-center text-rose-700 bg-rose-500/10 font-black">
                                            {formatPLN(kpis?.totalCost || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-sm font-bold inline-block ${(kpis?.netProfit || 0) >= 0 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                                                {(kpis?.netProfit || 0) >= 0 ? "+" : ""}
                                                {formatPLN(kpis?.netProfit || 0)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center text-amber-800 font-black">
                                            {kpis?.profitMargin || 0}%
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
