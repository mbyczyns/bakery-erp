"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
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
        return (val / 1_000_000).toFixed(1) + "M zł";
    }
    if (Math.abs(val) >= 1_000) {
        return (val / 1_000).toFixed(1) + "k zł";
    }
    return val.toFixed(0) + " zł";
}

export default function PodsumowanieTab() {
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [viewMode, setViewMode] = useState<"12M" | "6M" | "QUARTERS">("12M");
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
    }, [selectedYear]);

    // Filtrowane dane dla wykresów w zależności od viewMode
    const filteredChartData = useMemo(() => {
        if (!data) return [];
        if (viewMode === "6M") {
            const currentMonthIdx = new Date().getMonth();
            const startIdx = Math.max(0, currentMonthIdx - 5);
            return data.monthlyData.slice(startIdx, startIdx + 6);
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
    }, [data, viewMode]);

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
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-ui-accent/40 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                        <Scale size={24} />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-black text-ui-black tracking-tight">
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
                        <span className="px-3 text-xs sm:text-sm font-black text-ui-black">
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

                    {/* Tryb widoku (12M, 6M, Kwartały) */}
                    <div className="flex items-center bg-ui-accent/15 p-1 rounded-xl border border-ui-accent/40 text-xs font-black">
                        <button
                            onClick={() => setViewMode("12M")}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "12M"
                                ? "bg-white text-ui-black shadow-xs font-black"
                                : "text-ui-secondary hover:text-ui-primary"
                                }`}
                        >
                            12 Miesięcy
                        </button>
                        <button
                            onClick={() => setViewMode("6M")}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "6M"
                                ? "bg-white text-ui-black shadow-xs font-black"
                                : "text-ui-secondary hover:text-ui-primary"
                                }`}
                        >
                            6 Miesięcy
                        </button>
                        <button
                            onClick={() => setViewMode("QUARTERS")}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "QUARTERS"
                                ? "bg-white text-ui-black shadow-xs font-black"
                                : "text-ui-secondary hover:text-ui-primary"
                                }`}
                        >
                            Kwartały
                        </button>
                    </div>

                    {/* Przycisk odświeżenia */}
                    <button
                        onClick={() => fetchData(selectedYear)}
                        disabled={loading}
                        className="p-2.5 bg-ui-accent/15 hover:bg-ui-accent/30 text-ui-primary rounded-xl border border-ui-accent/40 transition-colors cursor-pointer disabled:opacity-50"
                        title="Odśwież dane"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin text-ui-accent" : ""} />
                    </button>
                </div>
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
                        <div className="bg-white p-5 rounded-2xl border border-ui-accent/40 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-extrabold text-ui-secondary uppercase tracking-wider">
                                    Przychody Całkowite
                                </span>
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <TrendingUp size={18} />
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl sm:text-3xl font-black text-ui-black tracking-tight text-emerald-600">
                                    {formatPLN(kpis?.totalRevenue || 0)}
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-ui-accent/20 flex flex-col gap-1 text-xs font-bold text-ui-secondary">
                                    <div className="flex justify-between">
                                        <span>Sprzedaż w sklepie:</span>
                                        <span className="text-ui-black font-extrabold">
                                            {formatPLN((kpis?.grandBakeryRevenue || 0) + (kpis?.grandOtherRevenue || 0))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Faktury B2B (sprzedaż):</span>
                                        <span className="text-ui-black font-extrabold">
                                            {formatPLN(kpis?.grandSalesInvGross || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KARTA 2: KOSZTY ŁĄCZNIE */}
                        <div className="bg-white p-5 rounded-2xl border border-ui-accent/40 shadow-xs hover:border-rose-300 transition-all flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-extrabold text-ui-secondary uppercase tracking-wider">
                                    Koszty Całkowite
                                </span>
                                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                                    <TrendingDown size={18} />
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl sm:text-3xl font-black text-ui-black tracking-tight text-rose-600">
                                    {formatPLN(kpis?.totalCost || 0)}
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-ui-accent/20 flex flex-col gap-1 text-xs font-bold text-ui-secondary">
                                    <div className="flex justify-between">
                                        <span>Faktury kosztowe:</span>
                                        <span className="text-ui-black font-extrabold">
                                            {formatPLN(kpis?.grandCostInvoicesGross || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Koszty stałe / operacyjne:</span>
                                        <span className="text-ui-black font-extrabold">
                                            {formatPLN(kpis?.grandOperationalCosts || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KARTA 3: WYNIK FINANSOWY (ZYSK NETTO / STRATA) */}
                        <div
                            className={`p-5 rounded-2xl border shadow-xs transition-all flex flex-col justify-between ${(kpis?.netProfit || 0) >= 0
                                ? "bg-gradient-to-br from-emerald-500/10 via-white to-emerald-500/5 border-emerald-300"
                                : "bg-gradient-to-br from-rose-500/10 via-white to-rose-500/5 border-rose-300"
                                }`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-extrabold text-ui-secondary uppercase tracking-wider">
                                    Wynik Finansowy (Zysk)
                                </span>
                                <div
                                    className={`p-2 rounded-xl ${(kpis?.netProfit || 0) >= 0
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-rose-100 text-rose-700"
                                        }`}
                                >
                                    <PiggyBank size={18} />
                                </div>
                            </div>
                            <div>
                                <div
                                    className={`text-2xl sm:text-3xl font-black tracking-tight ${(kpis?.netProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                                        }`}
                                >
                                    {(kpis?.netProfit || 0) >= 0 ? "+" : ""}
                                    {formatPLN(kpis?.netProfit || 0)}
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-ui-accent/20 flex items-center justify-between text-xs font-bold text-ui-secondary">
                                    <span>Średnio na miesiąc:</span>
                                    <span className="text-ui-black font-extrabold">
                                        {formatPLN(kpis?.avgMonthlyProfit || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* KARTA 4: RENTOWNOŚĆ / MARŻA ZYSKU */}
                        <div className="bg-white p-5 rounded-2xl border border-ui-accent/40 shadow-xs hover:border-ui-primary/40 transition-all flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-extrabold text-ui-secondary uppercase tracking-wider">
                                    Marża Rentowności
                                </span>
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                    <Percent size={18} />
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl sm:text-3xl font-black text-ui-black tracking-tight flex items-baseline gap-2">
                                    <span>{kpis?.profitMargin || 0}%</span>
                                    <span className="text-xs font-bold text-ui-secondary">
                                        {(kpis?.profitMargin || 0) >= 15
                                            ? "Wysoka"
                                            : (kpis?.profitMargin || 0) > 0
                                                ? "Stabilna"
                                                : "Ujemna"}
                                    </span>
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-ui-accent/20 flex flex-col gap-1 text-xs font-bold text-ui-secondary">
                                    <div className="flex justify-between items-center">
                                        <span>Najlepszy miesiąc:</span>
                                        <span className="text-emerald-700 font-extrabold">
                                            {kpis?.bestMonth ? `${kpis.bestMonth.monthName.split(" ")[0]} (${formatCompactPLN(kpis.bestMonth.netProfit)})` : "—"}
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
                                <h3 className="text-base sm:text-lg font-black text-ui-black flex items-center gap-2">
                                    <BarChart3 size={20} className="text-emerald-600" />
                                    Zestawienie {selectedYear}
                                </h3>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-black">
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
                                        tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }}
                                        axisLine={{ stroke: "#e2e8f0" }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => formatCompactPLN(val)}
                                        tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={65}
                                    />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const item = payload[0].payload;
                                                return (
                                                    <div className="bg-ui-black text-white p-3.5 rounded-xl shadow-xl text-xs font-bold space-y-1.5 border border-white/10 min-w-[200px]">
                                                        <div className="font-extrabold text-sm border-b border-white/20 pb-1 text-ui-accent">
                                                            {item.monthName || label}
                                                        </div>
                                                        <div className="flex justify-between items-center text-emerald-400">
                                                            <span>Przychody:</span>
                                                            <span className="font-extrabold">{formatPLN(item.totalRevenue || 0)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-rose-400">
                                                            <span>Koszty:</span>
                                                            <span className="font-extrabold">{formatPLN(item.totalCost || 0)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-1 border-t border-white/20 text-white">
                                                            <span>Wynik (Zysk):</span>
                                                            <span className={`font-black ${(item.netProfit || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                                                {formatPLN(item.netProfit || 0)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-amber-300 text-[11px]">
                                                            <span>Marża:</span>
                                                            <span className="font-extrabold">{item.profitMargin || 0}%</span>
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
                                        <PieIcon size={18} className="text-emerald-600" />
                                        Struktura przychodów w {selectedYear}
                                    </h3>
                                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                        {formatPLN(kpis?.totalRevenue || 0)}
                                    </span>
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
                                                contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", color: "#fff", fontWeight: 700, fontSize: "12px" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-2.5">
                                    {data.revenueStructure.map((item) => (
                                        <div key={item.id} className="p-2.5 bg-ui-accent/10 rounded-xl flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                <span className="font-bold text-ui-black truncate max-w-[130px]">{item.name}</span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-black text-ui-black">{formatCompactPLN(item.value)}</div>
                                                <div className="text-[10px] font-extrabold text-ui-secondary">{item.sharePercent}%</div>
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
                                    <h3 className="text-base font-black text-ui-black flex items-center gap-2">
                                        <PieIcon size={18} className="text-rose-600" />
                                        Struktura Kosztów w {selectedYear}
                                    </h3>
                                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                                        {formatPLN(kpis?.totalCost || 0)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                    {/* Filtr kosztów */}
                                    <div className="flex items-center gap-1 text-[11px] font-black bg-ui-accent/15 p-0.5 rounded-lg">
                                        <button
                                            onClick={() => setActiveCostView("ALL")}
                                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${activeCostView === "ALL" ? "bg-white text-ui-black shadow-xs" : "text-ui-secondary"
                                                }`}
                                        >
                                            Wszystko
                                        </button>
                                        <button
                                            onClick={() => setActiveCostView("OPERATIONAL")}
                                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${activeCostView === "OPERATIONAL" ? "bg-white text-ui-black shadow-xs" : "text-ui-secondary"
                                                }`}
                                        >
                                            Stałe
                                        </button>
                                        <button
                                            onClick={() => setActiveCostView("INVOICES")}
                                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${activeCostView === "INVOICES" ? "bg-white text-ui-black shadow-xs" : "text-ui-secondary"
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
                                                data={filteredCostItems.slice(0, 8)}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={75}
                                                paddingAngle={4}
                                            >
                                                {filteredCostItems.slice(0, 8).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COST_COLORS[index % COST_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: any) => [formatPLN(Number(value)), "Koszt"]}
                                                contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", color: "#fff", fontWeight: 700, fontSize: "12px" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                    {filteredCostItems.slice(0, 7).map((item, idx) => (
                                        <div key={item.id} className="p-2 bg-ui-accent/10 rounded-xl flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COST_COLORS[idx % COST_COLORS.length] }} />
                                                <span className="font-bold text-ui-black truncate text-[11px]">{item.name}</span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-black text-ui-black text-[11px]">{formatCompactPLN(item.value)}</div>
                                                <div className="text-[9px] font-extrabold text-ui-secondary">{item.sharePercent}%</div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredCostItems.length > 7 && (
                                        <div className="text-[10px] text-center font-extrabold text-ui-secondary pt-1">
                                            + {filteredCostItems.length - 7} innych pozycji kosztowych
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ---------------- SZCZEGÓŁOWA TABELA MIESIĘCZNA (P&L RACHUNEK ZYSKÓW I STRAT) ---------------- */}
                    <div className="bg-white rounded-2xl border border-ui-accent/40 shadow-xs overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-ui-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-ui-black flex items-center gap-2">
                                    <Receipt size={20} className="text-ui-primary" />
                                    Rachunek Zysków i Strat (P&L) w rozbiciu miesięcznym
                                </h3>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-ui-accent/15 border-b border-ui-accent/30 text-ui-secondary uppercase font-black tracking-wider text-[11px]">
                                        <th className="py-3 px-4">Miesiąc</th>
                                        <th className="py-3 px-4 text-right">Utarg</th>
                                        <th className="py-3 px-4 text-right">Faktury wystawione</th>
                                        <th className="py-3 px-4 text-right text-emerald-700 bg-emerald-500/10">Przychody łącznie</th>
                                        <th className="py-3 px-4 text-right">Koszty Stałe</th>
                                        <th className="py-3 px-4 text-right">Faktury kosztowe</th>
                                        <th className="py-3 px-4 text-right text-rose-700 bg-rose-500/10">Koszty łącznie</th>
                                        <th className="py-3 px-4 text-right font-black">Zysk netto</th>
                                        <th className="py-3 px-4 text-right">Marża %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/20 font-bold text-ui-primary">
                                    {data.monthlyData.map((m) => (
                                        <tr
                                            key={m.monthKey}
                                            className={`hover:bg-ui-accent/10 transition-colors ${m.isCurrentMonth ? "bg-amber-500/5 font-extrabold" : ""
                                                }`}
                                        >
                                            <td className="py-3.5 px-4 font-black text-ui-black flex items-center gap-2">
                                                <span>{m.monthName}</span>
                                                {m.isCurrentMonth && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-black">
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-ui-secondary">
                                                {m.retailTotalRevenue > 0 ? formatPLN(m.retailTotalRevenue) : "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-ui-secondary">
                                                {m.salesInvoicesGross > 0 ? formatPLN(m.salesInvoicesGross) : "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-black text-emerald-700 bg-emerald-500/5">
                                                {m.totalRevenue > 0 ? formatPLN(m.totalRevenue) : "0,00 zł"}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-ui-secondary">
                                                {m.costOperational > 0 ? formatPLN(m.costOperational) : "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-ui-secondary">
                                                {m.costInvoicesGross > 0 ? formatPLN(m.costInvoicesGross) : "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-black text-rose-700 bg-rose-500/5">
                                                {m.totalCost > 0 ? formatPLN(m.totalCost) : "0,00 zł"}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-black">
                                                <span
                                                    className={`px-2 py-1 rounded-lg ${m.netProfit >= 0
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : "bg-rose-100 text-rose-800"
                                                        }`}
                                                >
                                                    {m.netProfit >= 0 ? "+" : ""}
                                                    {formatPLN(m.netProfit)}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <span
                                                    className={`font-black ${m.profitMargin >= 15
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
                                        <td className="py-4 px-4 uppercase tracking-wider">RAZEM {selectedYear}</td>
                                        <td className="py-4 px-4 text-right text-ui-primary/80">
                                            {formatPLN((kpis?.grandBakeryRevenue || 0) + (kpis?.grandOtherRevenue || 0))}
                                        </td>
                                        <td className="py-4 px-4 text-right text-ui-primary/80">
                                            {formatPLN(kpis?.grandSalesInvGross || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-right text-emerald-400 bg-white/10">
                                            {formatPLN(kpis?.totalRevenue || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-right text-ui-primary">
                                            {formatPLN(kpis?.grandOperationalCosts || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-right text-ui-primary">
                                            {formatPLN(kpis?.grandCostInvoicesGross || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-right text-rose-400 bg-white/10">
                                            {formatPLN(kpis?.totalCost || 0)}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <span className={`px-2.5 py-1 rounded-lg text-sm font-black ${(kpis?.netProfit || 0) >= 0 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                                                {(kpis?.netProfit || 0) >= 0 ? "+" : ""}
                                                {formatPLN(kpis?.netProfit || 0)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right text-amber-300">
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
