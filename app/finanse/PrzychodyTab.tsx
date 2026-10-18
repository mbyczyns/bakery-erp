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
    Layers,
    Croissant,
    Pizza,
    Receipt,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Loader2,
    PieChart as PieIcon,
    RefreshCw,
    Search,
    Building2,
    CheckCircle2,
    Info,
    Hamburger,
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
    PieChart,
    Pie,
    Cell,
} from "recharts";

type Granularity = "DAILY" | "WEEKLY" | "MONTHLY" | "PRODUCTS" | "INVOICES";
type PeriodPreset = "CURRENT_MONTH" | "PREV_MONTH" | "7D" | "14D" | "30D" | "90D" | "YEAR" | "ALL";
type BakeryCategory = "ALL" | "BREAD" | "ROLL" | "SWEET" | "SAVORY";

const MONTH_NAMES = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

interface DayProductDetail {
    productId: string;
    productName: string;
    productType: string;
    producedAmount: number;
    soldAmount: number;
    sellingPrice: number;
    salesIncome: number;
}

interface SalesInvoicePosition {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    netPrice: number;
    netAmount: number;
    grossAmount: number;
}

interface SalesInvoiceItem {
    id: string;
    invoiceNumber: string;
    ksefNumber: string;
    contractorId: string;
    contractorName: string;
    issuedDate: string;
    dueDate: string;
    status: string;
    grossAmount: number;
    netAmount: number;
    vatAmount: number;
    positionsCount: number;
    positions: SalesInvoicePosition[];
}

interface ContractorSalesItem {
    contractorId: string;
    contractorName: string;
    totalGross: number;
    totalNet: number;
    invoicesCount: number;
    lastInvoiceDate: string;
    sharePercent: number;
}

interface DailyRecord {
    date: string;
    dayOfWeek: string;
    shortDay: string;
    isWeekend: boolean;
    bakerySalesIncome: number;
    fiscalIncome: number;
    otherIncome: number;
    totalIncome: number;
    bakerySharePercent: number;
    otherSharePercent: number;
    totalProduced: number;
    totalSold: number;
    sellThroughRate: number;
    hasReport: boolean;
    isClosed?: boolean;
    closedReason?: string;
    noSales?: boolean;
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
    otherSharePercent: number;
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
    retailIncome: number;
    bakerySalesIncome: number;
    otherIncome: number;
    salesInvoicesGross: number;
    salesInvoicesNet: number;
    salesInvoicesCount: number;
    salesInvoices: SalesInvoiceItem[];
    totalIncome: number;
    bakerySharePercent: number;
    otherSharePercent: number;
    salesInvoicesSharePercent: number;
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

const CATEGORY_MAP: Record<string, {
    label: string;
    color: string;
    badge: string;
    headerBg: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
    BREAD: {
        label: "Chleby",
        color: "#d97706",
        badge: "bg-amber-100 text-amber-800 border-amber-300",
        headerBg: "text-amber-800 bg-amber-50 border-amber-200",
        icon: Wheat,
    },
    ROLL: {
        label: "Bułki",
        color: "#059669",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
        headerBg: "text-emerald-800 bg-emerald-50 border-emerald-200",
        icon: Hamburger,
    },
    SWEET: {
        label: "Wypieki słodkie",
        color: "#db2777",
        badge: "bg-pink-100 text-pink-800 border-pink-300",
        headerBg: "text-pink-800 bg-pink-50 border-pink-200",
        icon: Croissant,
    },
    SAVORY: {
        label: "Wypieki słone",
        color: "#9333ea",
        badge: "bg-purple-100 text-purple-800 border-purple-300",
        headerBg: "text-purple-800 bg-purple-50 border-purple-200",
        icon: Pizza,
    },
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

function formatWeekDateRange(startDate: string, endDate: string): string {
    if (!startDate || !endDate) return "";
    const sParts = startDate.split("-");
    const eParts = endDate.split("-");
    if (sParts.length === 3 && eParts.length === 3) {
        if (sParts[0] === eParts[0]) {
            return `${sParts[2]}.${sParts[1]} - ${eParts[2]}.${eParts[1]}.${eParts[0]}`;
        }
        return `${sParts[2]}.${sParts[1]}.${sParts[0]} - ${eParts[2]}.${eParts[1]}.${eParts[0]}`;
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
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
        salesInvoices: SalesInvoiceItem[];
        contractorSalesRanking: ContractorSalesItem[];
        stats: any;
    } | null>(null);

    const [view, setView] = useState<Granularity>("DAILY");
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("CURRENT_MONTH");
    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
    const [selectedCategory, setSelectedCategory] = useState<BakeryCategory>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

    const formattedSelectedMonth = useMemo(() => {
        if (!selectedMonth) return "";
        const [yStr, mStr] = selectedMonth.split("-");
        const mIdx = parseInt(mStr, 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
            return `${MONTH_NAMES[mIdx]} ${yStr}`;
        }
        return selectedMonth;
    }, [selectedMonth]);

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

    const toggleInvoice = (id: string) => {
        setExpandedInvoices((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleMonth = (id: string) => {
        setExpandedMonths((prev) => ({ ...prev, [id]: !prev[id] }));
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

    // Faktury dla aktualnie wybranego miesiąca (z selektora)
    const currentMonthInvoices = useMemo(() => {
        if (!data?.salesInvoices) return [];
        return data.salesInvoices.filter((inv) => inv.issuedDate.startsWith(selectedMonth));
    }, [data?.salesInvoices, selectedMonth]);

    const currentMonthInvoicesGross = useMemo(() => {
        return currentMonthInvoices.reduce((acc, inv) => acc + inv.grossAmount, 0);
    }, [currentMonthInvoices]);

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
        } else if (periodPreset === "7D") {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - 7);
            list = list.filter((d) => new Date(d.date) >= dateLimit);
        } else if (periodPreset === "14D") {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - 14);
            list = list.filter((d) => new Date(d.date) >= dateLimit);
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

        // Sortowanie chronologiczne: od pierwszego do ostatniego dnia miesiąca / okresu
        list.sort((a, b) => a.date.localeCompare(b.date));

        return list;
    }, [data?.dailyData, periodPreset, selectedMonth, currentMonthKey, searchQuery]);

    // --- FILTROWANIE DANYCH TYGODNIOWYCH ---
    const filteredWeeklyData = useMemo(() => {
        if (!data?.weeklyData) return [];
        let list = [...data.weeklyData];

        if (periodPreset === "7D" || periodPreset === "14D") {
            list = list.slice(0, 4);
        } else if (periodPreset === "CURRENT_MONTH" || periodPreset === "PREV_MONTH" || periodPreset === "30D") {
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

        // Sortowanie chronologiczne tygodni od najwcześniejszego do najpóźniejszego
        list.sort((a, b) => a.startDate.localeCompare(b.startDate));

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

        // Sortowanie chronologiczne miesięcy od pierwszego do ostatniego
        list.sort((a, b) => a.key.localeCompare(b.key));

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

    // --- FILTROWANIE FAKTUR SPRZEDAŻOWYCH ---
    const filteredSalesInvoices = useMemo(() => {
        if (!data?.salesInvoices) return [];
        let list = [...data.salesInvoices];

        if (periodPreset === "CURRENT_MONTH") {
            list = list.filter((inv) => inv.issuedDate.startsWith(selectedMonth));
        } else if (periodPreset === "PREV_MONTH") {
            const [yStr, mStr] = currentMonthKey.split("-");
            let y = parseInt(yStr, 10);
            let m = parseInt(mStr, 10) - 1;
            if (m === 0) {
                m = 12;
                y -= 1;
            }
            const prevKey = `${y}-${String(m).padStart(2, "0")}`;
            list = list.filter((inv) => inv.issuedDate.startsWith(prevKey));
        } else if (periodPreset === "7D") {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - 7);
            list = list.filter((inv) => new Date(inv.issuedDate) >= dateLimit);
        } else if (periodPreset === "14D") {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - 14);
            list = list.filter((inv) => new Date(inv.issuedDate) >= dateLimit);
        } else if (periodPreset === "30D") {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - 30);
            list = list.filter((inv) => new Date(inv.issuedDate) >= dateLimit);
        } else if (periodPreset === "90D") {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - 90);
            list = list.filter((inv) => new Date(inv.issuedDate) >= dateLimit);
        } else if (periodPreset === "YEAR") {
            const currentYear = new Date().getFullYear().toString();
            list = list.filter((inv) => inv.issuedDate.startsWith(currentYear));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (inv) =>
                    inv.invoiceNumber.toLowerCase().includes(q) ||
                    inv.contractorName.toLowerCase().includes(q) ||
                    inv.issuedDate.includes(q) ||
                    inv.positions.some((p) => p.name.toLowerCase().includes(q))
            );
        }

        // Sortowanie chronologiczne faktur od najwcześniejszej do najpóźniejszej
        list.sort((a, b) => a.issuedDate.localeCompare(b.issuedDate));

        return list;
    }, [data?.salesInvoices, periodPreset, selectedMonth, currentMonthKey, searchQuery]);

    // --- DYNAMICZNE PODSUMOWANIE KPI ---
    const activeStats = useMemo(() => {
        let totalIncome = 0;
        let bakerySalesIncome = 0;
        let otherIncome = 0;
        let salesInvoicesGross = 0;
        let totalSold = 0;
        let totalProduced = 0;
        let daysCount = 0;
        let peakAmount = 0;
        let peakLabel = "-";

        if (view === "DAILY") {
            daysCount = filteredDailyData.filter((d) => d.hasReport && !d.noSales && !d.isClosed).length;
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
            salesInvoicesGross = currentMonthInvoicesGross;
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
                salesInvoicesGross += m.salesInvoicesGross;
                totalSold += m.totalSold;
                totalProduced += m.totalProduced;

                if (m.totalIncome > peakAmount) {
                    peakAmount = m.totalIncome;
                    peakLabel = m.label;
                }
            });
        } else if (view === "INVOICES") {
            salesInvoicesGross = filteredSalesInvoices.reduce((acc, inv) => acc + inv.grossAmount, 0);
            totalIncome = salesInvoicesGross;
        } else {
            totalIncome = data?.stats?.grandTotalIncome || 0;
            bakerySalesIncome = data?.stats?.grandTotalBakeryIncome || 0;
            otherIncome = data?.stats?.grandTotalOtherIncome || 0;
            salesInvoicesGross = data?.stats?.grandTotalSalesInvoicesGross || 0;
            totalSold = data?.stats?.grandTotalSold || 0;
            totalProduced = data?.stats?.grandTotalProduced || 0;
            daysCount = data?.stats?.daysWithReportCount || 1;
        }

        const bakeryShare = totalIncome > 0 ? (bakerySalesIncome / totalIncome) * 100 : 0;
        const otherShare = totalIncome > 0 ? (otherIncome / totalIncome) * 100 : 0;
        const invoicesShare = totalIncome > 0 ? (salesInvoicesGross / totalIncome) * 100 : 0;
        const avgDaily = daysCount > 0 ? (view === "MONTHLY" ? (totalIncome - salesInvoicesGross) / daysCount : totalIncome / daysCount) : 0;
        const sellThrough = totalProduced > 0 ? (totalSold / totalProduced) * 100 : 0;

        return {
            totalIncome: Math.round(totalIncome * 100) / 100,
            bakerySalesIncome: Math.round(bakerySalesIncome * 100) / 100,
            otherIncome: Math.round(otherIncome * 100) / 100,
            salesInvoicesGross: Math.round(salesInvoicesGross * 100) / 100,
            bakerySharePercent: Math.round(bakeryShare * 10) / 10,
            otherSharePercent: Math.round(otherShare * 10) / 10,
            salesInvoicesSharePercent: Math.round(invoicesShare * 10) / 10,
            avgDailyIncome: Math.round(avgDaily * 100) / 100,
            totalSold,
            totalProduced,
            sellThroughRate: Math.round(sellThrough * 10) / 10,
            daysCount,
            peakAmount: Math.round(peakAmount * 100) / 100,
            peakLabel,
        };
    }, [view, filteredDailyData, filteredWeeklyData, filteredMonthlyData, filteredSalesInvoices, currentMonthInvoicesGross, data?.stats]);

    // Dane do wykresu słupkowego
    const chartData = useMemo(() => {
        if (view === "DAILY") {
            // W widoku dziennym wykres pokazuje czysty utarg detaliczny ze sklepu (Pieczywo + Inne)
            return filteredDailyData.map((d) => ({
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
            // W widoku tygodniowym wykres pokazuje utarg tygodniowy ze sklepu
            return filteredWeeklyData.map((w) => ({
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
            // W widoku MIESIĘCZNYM wykres uwzględnia faktury sprzedażowe na cały miesiąc
            return filteredMonthlyData.map((m) => ({
                label: m.shortLabel,
                fullLabel: m.label,
                bakery: m.bakerySalesIncome,
                other: m.otherIncome,
                invoices: m.salesInvoicesGross,
                total: m.totalIncome,
                avgDaily: m.avgDailyIncome,
                soldUnits: m.totalSold,
                invoicesCount: m.salesInvoicesCount,
            }));
        }
        return [];
    }, [view, filteredDailyData, filteredWeeklyData, filteredMonthlyData]);

    // Dane do wykresu kołowego źródeł
    const pieSourceData = useMemo(() => {
        if (activeStats.totalIncome === 0) return [];
        const res = [];
        if (activeStats.bakerySalesIncome > 0) {
            res.push({ name: "Sprzedaż pieczywa", value: activeStats.bakerySalesIncome, color: "#042043" });
        }
        if (activeStats.otherIncome > 0) {
            res.push({ name: "Inne przychody (detal)", value: activeStats.otherIncome, color: "#38bdf8" });
        }
        if (view === "MONTHLY" && activeStats.salesInvoicesGross > 0) {
            res.push({ name: "Faktury sprzedażowe", value: activeStats.salesInvoicesGross, color: "#10b981" });
        }
        return res;
    }, [activeStats, view]);

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
                        Przychody
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
                        <span className="px-3 text-xs font-bold text-ui-primary min-w-[130px] text-center">
                            {formattedSelectedMonth}
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
            <div className="bg-white border border-ui-accent rounded-2xl p-2.5 sm:p-3 shadow-xs flex items-center justify-between gap-3 overflow-x-auto">
                <div className="flex items-center gap-1 p-1 bg-ui-accent/10 rounded-xl border border-ui-accent/30 shrink-0">
                    <button
                        onClick={() => setView("DAILY")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${view === "DAILY"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <Calendar size={14} />
                        Dzienne
                    </button>
                    <button
                        onClick={() => setView("WEEKLY")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${view === "WEEKLY"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <BarChart3 size={14} />
                        Tygodniowe
                    </button>
                    <button
                        onClick={() => setView("MONTHLY")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${view === "MONTHLY"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <CalendarDays size={14} />
                        Miesięczne (z fakturami)
                    </button>
                    <button
                        onClick={() => setView("PRODUCTS")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${view === "PRODUCTS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <Wheat size={14} />
                        Struktura wyrobów ({data?.productRanking.length || 0})
                    </button>
                    <button
                        onClick={() => setView("INVOICES")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${view === "INVOICES"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <Receipt size={14} className={view === "INVOICES" ? "text-ui-primary" : ""} />
                        Faktury sprzedażowe ({data?.salesInvoices.length || 0})
                    </button>
                </div>

                {/* Filtry zakresów (rozwijany pasek) i wyszukiwarka przesunięte na prawo w jednej linii */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {view !== "PRODUCTS" && (
                        <div className="relative">
                            <select
                                value={periodPreset}
                                onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
                                className="bg-ui-white border border-ui-accent text-ui-primary text-xs font-semibold rounded-lg pl-2.5 pr-7 py-1.5 shadow-2xs focus:outline-none focus:border-ui-secondary transition-all cursor-pointer appearance-none min-w-[155px]"
                            >
                                <option value="CURRENT_MONTH">Wybrany miesiąc ({formattedSelectedMonth})</option>
                                <option value="PREV_MONTH">Poprzedni miesiąc</option>
                                <option value="7D">Ostatnie 7 dni</option>
                                <option value="14D">Ostatnie 14 dni</option>
                                <option value="30D">Ostatnie 30 dni</option>
                                <option value="90D">Ostatnie 90 dni</option>
                                <option value="YEAR">Bieżący rok</option>
                                <option value="ALL">Wszystko (pełna historia)</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-ui-secondary">
                                <ChevronDown size={13} />
                            </div>
                        </div>
                    )}

                    {view === "PRODUCTS" && (
                        <div className="relative">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value as BakeryCategory)}
                                className="bg-ui-white border border-ui-accent text-ui-primary text-xs font-semibold rounded-lg pl-2.5 pr-7 py-1.5 shadow-2xs focus:outline-none focus:border-ui-secondary transition-all cursor-pointer appearance-none min-w-[150px]"
                            >
                                <option value="ALL">Wszystkie kategorie</option>
                                <option value="BREAD">Chleby</option>
                                <option value="ROLL">Bułki</option>
                                <option value="SWEET">Słodkie</option>
                                <option value="SAVORY">Słone</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-ui-secondary">
                                <ChevronDown size={13} />
                            </div>
                        </div>
                    )}

                    {/* Wyszukiwarka */}
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2 text-ui-secondary" />
                        <input
                            type="text"
                            placeholder={view === "INVOICES" ? "Szukaj faktury..." : "Szukaj..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="text-xs pl-7 pr-2.5 py-1.5 rounded-lg border border-ui-accent bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-secondary w-32 sm:w-40 lg:w-48"
                        />
                    </div>
                </div>
            </div>

            {/* ---------------- KARTY PODSUMOWANIA KPI ---------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KARTA 1: UTARG ZE SPRZEDAŻY */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            {view === "MONTHLY" ? "Łączny przychód (z fakturami) " : "Utarg z kasy "}
                        </span>

                        <DollarSign size={15} className="text-ui-secondary" />

                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-bold text-ui-primary tracking-tight">
                        {formatCurrency(activeStats.totalIncome)}
                    </div>
                </div>

                {/* KARTA 2: SPRZEDAŻ PIECZYWA */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">

                                Pieczywo i wypieki
                            </span>
                            <Wheat size={15} className="text-ui-secondary" />
                        </div>
                        <div className="mt-2 text-2xl sm:text-3xl font-bold text-ui-primary tracking-tight">
                            {formatCurrency(activeStats.bakerySalesIncome)}
                        </div>
                    </div>
                </div>

                {/* KARTA 3: INNE PRZYCHODY (DETAL) */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">

                                Pozostałe produkty
                            </span>
                            <ShoppingBag size={15} className="text-ui-secondary" />
                        </div>
                        <div className="mt-2 text-2xl sm:text-3xl font-bold text-ui-primary tracking-tight">
                            {formatCurrency(activeStats.otherIncome)}
                        </div>
                    </div>
                </div>

                {/* KARTA 4: FAKTURY SPRZEDAŻOWE (MIESIĘCZNE) */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                Sprzedaż na faktury (przelewy)

                            </span>
                            <Receipt size={15} className="text-ui-secondary" />
                        </div>
                        <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-950 tracking-tight">
                            {formatCurrency(view === "DAILY" ? currentMonthInvoicesGross : activeStats.salesInvoicesGross)}
                        </div>
                    </div>
                </div>
            </div>

            {/* ---------------- SEKCJA WYKRESÓW ---------------- */}
            {view !== "PRODUCTS" && view !== "INVOICES" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Główny wykres słupkowy skumulowany (2/3 szerokości) */}
                    <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <BarChart3 size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
                                {view === "DAILY" && "Dzienny utarg ze sklepu (Pieczywo + Inne z kasy)"}
                                {view === "WEEKLY" && "Tygodniowy utarg ze sklepu (Pieczywo + Inne)"}
                                {view === "MONTHLY" && "Miesięczny przychód (Sklep + Faktury sprzedażowe"}
                            </h3>
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
                                        tickFormatter={(val) => `${(val / 1000).toFixed(0)} tys.`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: "rgba(229, 231, 235, 0.4)" }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const pt = payload[0].payload;
                                                return (
                                                    <div className="bg-white border border-ui-accent/80 rounded-2xl p-4 shadow-xl text-xs min-w-[240px]">
                                                        <div className="font-extrabold text-sm text-ui-black border-b border-ui-accent/40 pb-1.5 mb-2.5">
                                                            {pt.fullLabel || (pt.dayOfWeek ? `${pt.dayOfWeek}, ${formatDate(pt.fullDate || "")}` : label)}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between text-ui-black border-b border-ui-accent/20 pb-1">
                                                                <span>Przychód łączny:</span>
                                                                <span>{formatCurrency(pt.total)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-ui-black ">
                                                                <span className="flex items-center gap-1">
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#042043]" />
                                                                    Sprzedaż pieczywa:
                                                                </span>
                                                                <span>{formatCurrency(pt.bakery)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-ui-black">
                                                                <span className="flex items-center gap-1">
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                                                                    Inne z kasy:
                                                                </span>
                                                                <span>{formatCurrency(pt.other)}</span>
                                                            </div>
                                                            {view === "MONTHLY" && pt.invoices > 0 && (
                                                                <div className="flex items-center justify-between text-ui-black">
                                                                    <span className="flex items-center gap-1">
                                                                        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                                                                        Faktury sprzedażowe:
                                                                    </span>
                                                                    <span>{formatCurrency(pt.invoices)}</span>
                                                                </div>
                                                            )}
                                                            {pt.soldUnits > 0 && (
                                                                <div className="flex items-center justify-between text-ui-black pt-1 border-t border-ui-accent/20">
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
                                        formatter={(val) => {
                                            if (val === "bakery") return "Sprzedaż pieczywa";
                                            if (val === "other") return "Inne z kasy";
                                            if (val === "invoices") return "Faktury sprzedażowe";
                                            return val;
                                        }}
                                    />
                                    <Bar dataKey="bakery" stackId="a" fill="#042043" radius={[0, 0, 0, 0]} maxBarSize={36} />
                                    <Bar
                                        dataKey="other"
                                        stackId="a"
                                        fill="#38bdf8"
                                        radius={view === "MONTHLY" ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                                        maxBarSize={36}
                                    />
                                    {view === "MONTHLY" && (
                                        <Bar dataKey="invoices" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Wykres kołowy struktury przychodów (1/3 szerokości) */}
                    <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <PieIcon size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
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
                                        nameKey="name"
                                    >
                                        {pieSourceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const item = payload[0];
                                                const dataPoint = item.payload;
                                                const name = dataPoint?.name || item.name;
                                                const val = Number(item.value ?? dataPoint?.value ?? 0);
                                                const total = activeStats.totalIncome || 1;
                                                const percent = Math.round((val / total) * 1000) / 10;
                                                const color = dataPoint?.color || item.color;

                                                return (
                                                    <div className="bg-white text-ui-black p-3 rounded-xl shadow-xl border border-ui-accent/60 text-xs min-w-[190px]">
                                                        <div className="font-bold text-xs border-b border-ui-accent/40 pb-1.5 text-ui-primary flex items-center gap-2 mb-1.5">
                                                            {color && (
                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                                                    style={{ backgroundColor: color }}
                                                                />
                                                            )}
                                                            <span className="leading-snug">{name}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-ui-secondary font-medium">Przychód:</span>
                                                            <span className="font-bold text-ui-black">{formatCurrency(val)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs pt-1 border-t border-ui-accent/30 mt-1">
                                                            <span className="text-ui-secondary font-medium">Udział:</span>
                                                            <span className="font-bold text-ui-primary">{percent}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className={`grid ${view === "MONTHLY" ? "grid-cols-3" : "grid-cols-2"} gap-1.5 pt-2 border-t border-ui-accent/30 text-xs`}>
                            <div className="p-2 rounded-xl bg-ui-accent/10">
                                <div className="text-[10px] text-ui-secondary font-bold">Pieczywo:</div>
                                <div className="font-bold text-ui-secondary text-xs sm:text-sm">{formatCurrency(activeStats.bakerySalesIncome)}</div>
                                <div className="text-[9px] sm:text-[10px] text-ui-secondary truncate">{activeStats.bakerySharePercent}%</div>
                            </div>
                            <div className="p-2 rounded-xl bg-ui-accent/10">
                                <div className="text-[10px] text-ui-primary font-bold">Inne z kasy:</div>
                                <div className="font-bold text-ui-primary text-xs sm:text-sm">{formatCurrency(activeStats.otherIncome)}</div>
                                <div className="text-[9px] sm:text-[10px] text-ui-primary truncate">
                                    {activeStats.otherSharePercent}%</div>
                            </div>
                            {view === "MONTHLY" && (
                                <div className="p-2 rounded-xl bg-emerald-50">
                                    <div className="text-[10px] text-emerald-900 font-bold">Faktury sprzedażowe:</div>
                                    <div className="font-bold text-emerald-950 text-xs sm:text-sm">{formatCurrency(activeStats.salesInvoicesGross)}</div>
                                    <div className="text-[9px] sm:text-[10px] text-emerald-800 truncate">{activeStats.salesInvoicesSharePercent}%</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ---------------- TABELE SZCZEGÓŁOWE ---------------- */}

            {/* 1. TABELA DZIENNA (CZYSTY UTARG DZIENNY ZE SKLEPU) */}
            {view === "DAILY" && (
                <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <Calendar size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" /> Dzienny rejestr utargu i sprzedaży
                            </h3>

                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                    <th className="p-3.5">Data</th>
                                    <th className="p-3.5">Dzień</th>
                                    <th className="p-3.5 text-right">Sprzedaż pieczywa</th>
                                    <th className="p-3.5 text-right">Inne z kasy</th>
                                    <th className="p-3.5 text-right">Utarg dzienny</th>
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
                                                    <td className="p-3.5 text-ui-black">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span>{formatDate(d.date)}</span>
                                                            {(d.noSales || d.isClosed) && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                                    {d.closedReason || "Brak sprzedaży"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-ui-black">
                                                        {d.dayOfWeek}
                                                    </td>
                                                    <td className="p-3.5 text-right font-bold text-ui-primary">
                                                        {formatCurrency(d.bakerySalesIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-bold text-[#38bdf8]">
                                                        {formatCurrency(d.otherIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-bold text-ui-black">
                                                        {formatCurrency(d.totalIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        {d.totalSold > 0 ? d.totalSold.toLocaleString("pl-PL") : "—"}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        {d.totalProduced > 0 ? (
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
                                                        ) : (
                                                            <span className="text-ui-secondary/40">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-center text-ui-secondary">
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </td>
                                                </tr>

                                                {/* ROZWINIĘCIE DNIA ZE SZCZEGÓŁAMI WYROBÓW */}
                                                {isExpanded && (
                                                    <tr className="bg-ui-accent/5">
                                                        <td colSpan={9} className="p-4 sm:p-5 border-b border-ui-accent/30">
                                                            {d.products.length > 0 ? (
                                                                <div className="space-y-3.5">
                                                                    {Object.entries(CATEGORY_MAP).map(([catKey, catMeta]) => {
                                                                        const catProducts = d.products.filter((p) => p.productType === catKey);
                                                                        if (catProducts.length === 0) return null;

                                                                        const catProducedTotal = catProducts.reduce((sum, p) => sum + (p.producedAmount || 0), 0);
                                                                        const catSoldTotal = catProducts.reduce((sum, p) => sum + (p.soldAmount || 0), 0);
                                                                        const catRevenueTotal = catProducts.reduce((sum, p) => sum + (p.salesIncome || 0), 0);
                                                                        const Icon = catMeta.icon;

                                                                        return (
                                                                            <div key={catKey} className="border border-ui-accent rounded-xl overflow-hidden shadow-2xs bg-white">
                                                                                {/* Pasek nagłówka kategorii */}
                                                                                <div className={`px-4 py-2.5 font-bold text-xs flex flex-wrap items-center justify-between gap-2 border-b ${catMeta.headerBg}`}>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Icon size={16} />
                                                                                        <span className="uppercase tracking-wider">
                                                                                            {catMeta.label} ({catProducts.length})
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold">
                                                                                        <span>Wypiek: <span className="text-ui-black">{catProducedTotal} szt.</span></span>
                                                                                        <span>Sprzedaż: <span className="text-ui-black">{catSoldTotal} szt.</span></span>
                                                                                        <span>Przychód: <span className="text-ui-black">{formatCurrency(catRevenueTotal)}</span></span>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Tabela produktów w kategorii */}
                                                                                <div className="overflow-x-auto">
                                                                                    <table className="w-full text-left text-xs border-collapse table-fixed min-w-[700px]">
                                                                                        <colgroup>
                                                                                            <col className="w-[32%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[13%]" />
                                                                                        </colgroup>
                                                                                        <thead>
                                                                                            <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase text-[10px] border-b border-ui-accent/30">
                                                                                                <th className="py-2.5 px-3">Nazwa wyrobu</th>
                                                                                                <th className="py-2.5 px-3 text-right">Cena jedn.</th>
                                                                                                <th className="py-2.5 px-3 text-right">Wypieczono</th>
                                                                                                <th className="py-2.5 px-3 text-right">Sprzedano</th>
                                                                                                <th className="py-2.5 px-3 text-right">Niesprzedane</th>
                                                                                                <th className="py-2.5 px-3 text-right">Skuteczność</th>
                                                                                                <th className="py-2.5 px-3 text-right">Przychód</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-ui-accent/20 font-medium">
                                                                                            {catProducts.map((prod) => {
                                                                                                const unsold = Math.max(0, (prod.producedAmount || 0) - (prod.soldAmount || 0));
                                                                                                const efficiency = prod.producedAmount > 0
                                                                                                    ? Math.min(100, Math.round((prod.soldAmount / prod.producedAmount) * 100))
                                                                                                    : 100;

                                                                                                return (
                                                                                                    <tr key={prod.productId} className="hover:bg-ui-accent/5 transition-colors">
                                                                                                        <td className="py-2.5 px-3 text-ui-black break-words leading-snug">
                                                                                                            {prod.productName}
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right text-ui-black tabular-nums">
                                                                                                            {prod.sellingPrice.toFixed(2)} zł
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right text-ui-black tabular-nums">
                                                                                                            {prod.producedAmount} szt.
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right text-emerald-600  tabular-nums">
                                                                                                            {prod.soldAmount} szt.
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right text-rose-600  tabular-nums">
                                                                                                            {unsold > 0 ? `-${unsold} szt.` : "0 szt."}
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right tabular-nums">
                                                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${efficiency >= 90
                                                                                                                ? "bg-emerald-100 text-emerald-800"
                                                                                                                : efficiency >= 70
                                                                                                                    ? "bg-amber-100 text-amber-800"
                                                                                                                    : "bg-rose-100 text-rose-800"
                                                                                                                }`}>
                                                                                                                {efficiency}%
                                                                                                            </span>
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right font-semibold text-ui-primary tabular-nums">
                                                                                                            {formatCurrency(prod.salesIncome)}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}

                                                                    {/* Ewentualne wyroby spoza 4 głównych kategorii */}
                                                                    {(() => {
                                                                        const knownKeys = Object.keys(CATEGORY_MAP);
                                                                        const otherProducts = d.products.filter((p) => !knownKeys.includes(p.productType));
                                                                        if (otherProducts.length === 0) return null;

                                                                        const otherProducedTotal = otherProducts.reduce((sum, p) => sum + (p.producedAmount || 0), 0);
                                                                        const otherSoldTotal = otherProducts.reduce((sum, p) => sum + (p.soldAmount || 0), 0);
                                                                        const otherRevenueTotal = otherProducts.reduce((sum, p) => sum + (p.salesIncome || 0), 0);

                                                                        return (
                                                                            <div className="border border-ui-accent rounded-xl overflow-hidden shadow-2xs bg-white">
                                                                                <div className="px-4 py-2.5 font-bold text-xs flex flex-wrap items-center justify-between gap-2 border-b text-slate-800 bg-slate-100 border-slate-200">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Layers size={16} />
                                                                                        <span className="uppercase tracking-wider">
                                                                                            Inne wyroby ({otherProducts.length})
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold">
                                                                                        <span>Wypiek: <strong className="font-bold">{otherProducedTotal} szt.</strong></span>
                                                                                        <span>Sprzedaż: <strong className="font-bold">{otherSoldTotal} szt.</strong></span>
                                                                                        <span>Przychód: <strong className="font-black text-ui-black">{formatCurrency(otherRevenueTotal)}</strong></span>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="overflow-x-auto">
                                                                                    <table className="w-full text-left text-xs border-collapse table-fixed min-w-[700px]">
                                                                                        <colgroup>
                                                                                            <col className="w-[32%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[11%]" />
                                                                                            <col className="w-[13%]" />
                                                                                        </colgroup>
                                                                                        <thead>
                                                                                            <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase text-[10px] border-b border-ui-accent/30">
                                                                                                <th className="py-2.5 px-3">Nazwa wyrobu</th>
                                                                                                <th className="py-2.5 px-3 text-right">Cena jedn.</th>
                                                                                                <th className="py-2.5 px-3 text-right">Wypieczono</th>
                                                                                                <th className="py-2.5 px-3 text-right">Sprzedano</th>
                                                                                                <th className="py-2.5 px-3 text-right">Niesprzedane</th>
                                                                                                <th className="py-2.5 px-3 text-right">Skuteczność</th>
                                                                                                <th className="py-2.5 px-3 text-right">Przychód</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-ui-accent/20 font-medium">
                                                                                            {otherProducts.map((prod) => {
                                                                                                const unsold = Math.max(0, (prod.producedAmount || 0) - (prod.soldAmount || 0));
                                                                                                const efficiency = prod.producedAmount > 0
                                                                                                    ? Math.min(100, Math.round((prod.soldAmount / prod.producedAmount) * 100))
                                                                                                    : 100;

                                                                                                return (
                                                                                                    <tr key={prod.productId} className="hover:bg-ui-accent/5 transition-colors">
                                                                                                        <td className="py-2.5 px-3 font-semibold text-ui-black break-words leading-snug">
                                                                                                            {prod.productName}
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right text-ui-secondary tabular-nums">
                                                                                                            {prod.sellingPrice.toFixed(2)} zł
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right text-ui-secondary tabular-nums">
                                                                                                            {prod.producedAmount} szt.
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right font-bold text-ui-black tabular-nums">
                                                                                                            {prod.soldAmount} szt.
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right text-rose-600 font-semibold tabular-nums">
                                                                                                            {unsold > 0 ? `-${unsold} szt.` : "0 szt."}
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right tabular-nums">
                                                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${efficiency >= 90
                                                                                                                ? "bg-emerald-100 text-emerald-800"
                                                                                                                : efficiency >= 70
                                                                                                                    ? "bg-amber-100 text-amber-800"
                                                                                                                    : "bg-rose-100 text-rose-800"
                                                                                                                }`}>
                                                                                                                {efficiency}%
                                                                                                            </span>
                                                                                                        </td>
                                                                                                        <td className="py-2.5 px-3 text-right font-semibold text-ui-primary tabular-nums">
                                                                                                            {formatCurrency(prod.salesIncome)}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-6 text-xs text-ui-secondary  bg-white rounded-xl border border-ui-accent/30">
                                                                    {d.noSales || d.isClosed ? (
                                                                        <span className="font-semibold text-slate-600">
                                                                            W tym dniu nie prowadzono sprzedaży ({d.closedReason || "brak sprzedaży"})
                                                                        </span>
                                                                    ) : (
                                                                        "Brak wpisów jednostkowych sprzedaży w tym dniu"
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-ui-secondary ">
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
                            <BarChart3 size={14} /> Tygodniowy rejestr utargu ze sklepu
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                    <th className="p-3.5 whitespace-nowrap">Okres</th>
                                    <th className="p-3.5 text-center">Dni z danymi</th>
                                    <th className="p-3.5 text-right">Sprzedaż pieczywa</th>
                                    <th className="p-3.5 text-right">Inne z kasy</th>
                                    <th className="p-3.5 text-right">Utarg tygodniowy</th>
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
                                            <td className="p-3.5 whitespace-nowrap">
                                                <div className="text-ui-black">Tydzień {w.weekNumber}</div>
                                                <div className="text-[11px] text-ui-black mt-0.5">
                                                    {formatWeekDateRange(w.startDate, w.endDate)}
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-ui-accent/15 text-ui-black text-[11px]">
                                                    {w.daysWithReport} / 7 dni
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right text-ui-black">
                                                {formatCurrency(w.bakerySalesIncome)}
                                            </td>
                                            <td className="p-3.5 text-right text-ui-black">
                                                {formatCurrency(w.otherIncome)}
                                            </td>
                                            <td className="p-3.5 text-right text-ui-black ">
                                                {formatCurrency(w.totalIncome)}
                                            </td>
                                            <td className="p-3.5 text-right text-ui-black">
                                                {formatCurrency(w.avgDailyIncome)}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ui-accent/20 text-ui-primary text-[11px]">
                                                    {w.bakerySharePercent}%
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center text-ui-black">
                                                {w.totalSold > 0 ? w.totalSold.toLocaleString("pl-PL") : "—"}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                {w.totalProduced > 0 ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                        {w.sellThroughRate}%
                                                    </span>
                                                ) : (
                                                    <span className="text-ui-secondary/40">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-ui-secondary ">
                                            Brak danych dla wybranego okresu
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. TABELA MIESIĘCZNA (TUTAJ WŁICZANE SĄ FAKTURY SPRZEDAŻOWE) */}
            {view === "MONTHLY" && (
                <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <CalendarDays size={14} /> Miesięczne zestawienie przychodów (Sklep + Faktury)
                            </h3>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                    <th className="p-3.5">Miesiąc</th>
                                    <th className="p-3.5 text-center">Dni z danymi</th>
                                    <th className="p-3.5 text-right">Sprzedaż pieczywa</th>
                                    <th className="p-3.5 text-right">Inne z kasy</th>
                                    <th className="p-3.5 text-right">Faktury sprzedażowe</th>
                                    <th className="p-3.5 text-right">Przychód całkowity</th>
                                    <th className="p-3.5 text-right">Śr. dzienna (sklep)</th>
                                    <th className="p-3.5 text-center">Sprzedane sztuki</th>
                                    <th className="p-3.5 text-center w-10">Faktury</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/30 font-medium">
                                {filteredMonthlyData.length > 0 ? (
                                    filteredMonthlyData.map((m) => {
                                        const isExpanded = !!expandedMonths[m.key];
                                        return (
                                            <React.Fragment key={m.key}>
                                                <tr
                                                    onClick={() => m.salesInvoicesCount > 0 && toggleMonth(m.key)}
                                                    className={`hover:bg-ui-accent/5 transition-colors ${m.salesInvoicesCount > 0 ? "cursor-pointer" : ""
                                                        } ${isExpanded ? "bg-ui-accent/10" : ""}`}
                                                >
                                                    <td className="p-3.5  text-ui-black">
                                                        {m.label}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ui-accent/15 text-ui-black text-[11px]">
                                                            {m.daysWithReport} / {m.daysInMonth} dni
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-right text-ui-black">
                                                        {formatCurrency(m.bakerySalesIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-right text-ui-black">
                                                        {formatCurrency(m.otherIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-right">
                                                        {m.salesInvoicesGross > 0 ? (
                                                            <div className="flex items-center justify-end gap-1.5 text-ui-black">
                                                                <span>{formatCurrency(m.salesInvoicesGross)}</span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-ui-black ">
                                                                    {m.salesInvoicesCount}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-ui-secondary/40 font-normal">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-right text-ui-black">
                                                        {formatCurrency(m.totalIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-right text-ui-black">
                                                        {formatCurrency(m.avgDailyIncome)}
                                                    </td>
                                                    <td className="p-3.5 text-center text-ui-black">
                                                        {m.totalSold > 0 ? m.totalSold.toLocaleString("pl-PL") : "—"} szt.
                                                    </td>
                                                    <td className="p-3.5 text-center text-ui-secondary">
                                                        {m.salesInvoicesCount > 0 ? (
                                                            isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                                                        ) : (
                                                            <span className="text-ui-secondary/30">—</span>
                                                        )}
                                                    </td>
                                                </tr>

                                                {/* ROZWINIĘCIE FAKTUR SPRZEDAŻOWYCH DANEGO MIESIĄCA */}
                                                {isExpanded && m.salesInvoices.length > 0 && (
                                                    <tr className="bg-ui-accent/5">
                                                        <td colSpan={9} className="p-4 border-b border-ui-accent/30 space-y-2.5">
                                                            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 uppercase">
                                                                <span className="flex items-center gap-1.5">
                                                                    <Receipt size={14} className="text-emerald-700" />
                                                                    Faktury sprzedażowe w miesiącu {m.label}:
                                                                </span>
                                                                <span className="bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-md font-bold">
                                                                    Suma brutto: {formatCurrency(m.salesInvoicesGross)} (netto: {formatCurrency(m.salesInvoicesNet)})
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                                {m.salesInvoices.map((inv) => (
                                                                    <div
                                                                        key={inv.id}
                                                                        className="p-3 rounded-xl bg-white border border-emerald-200 shadow-2xs space-y-1.5"
                                                                    >
                                                                        <div className="flex items-start justify-between gap-1">
                                                                            <div>
                                                                                <div className="font-bold text-ui-black text-xs flex items-center gap-1">
                                                                                    <Building2 size={12} className="text-emerald-700 shrink-0" />
                                                                                    {inv.contractorName}
                                                                                </div>
                                                                                <div className="text-[10px] text-ui-secondary mt-0.5">
                                                                                    Nr: <strong>{inv.invoiceNumber}</strong> • Data: {formatDate(inv.issuedDate)}
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="font-bold text-emerald-950 text-xs">
                                                                                    {formatCurrency(inv.grossAmount)}
                                                                                </div>
                                                                                <div className="text-[9px] text-ui-secondary">
                                                                                    netto: {formatCurrency(inv.netAmount)}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-ui-secondary ">
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
                                    <div className="mt-2 text-xl font-bold text-ui-black">
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
                                <Wheat size={14} /> Ranking wyrobów według generowanego przychodu
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                        <th className="p-3.5 w-12 text-center">#</th>
                                        <th className="p-3.5">Nazwa wyrobu</th>
                                        <th className="p-3.5">Kategoria</th>
                                        <th className="p-3.5 text-right">Cena jedn.</th>
                                        <th className="p-3.5 text-center">Sprzedaż (szt.)</th>
                                        <th className="p-3.5 text-center">Produkcja (szt.)</th>
                                        <th className="p-3.5 text-center">Wyprzedanie (%)</th>
                                        <th className="p-3.5 text-right">Łączny przychód</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/30 font-medium">
                                    {filteredProductRanking.length > 0 ? (
                                        filteredProductRanking.map((p, idx) => {
                                            const catInfo = CATEGORY_MAP[p.productType];
                                            return (
                                                <tr key={p.productId} className="hover:bg-ui-accent/5 transition-colors">
                                                    <td className="p-3.5 text-center font-bold text-ui-secondary">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="p-3.5 text-ui-black">
                                                        {p.productName}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catInfo?.badge || "bg-ui-accent/15 text-ui-primary border-ui-accent/30"}`}>
                                                            {catInfo?.label || p.productType}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-right text-ui-black">
                                                        {p.sellingPrice.toFixed(2)} zł
                                                    </td>
                                                    <td className="p-3.5 text-center text-ui-black">
                                                        {p.totalSold.toLocaleString("pl-PL")}
                                                    </td>
                                                    <td className="p-3.5 text-center text-ui-black">
                                                        {p.totalProduced.toLocaleString("pl-PL")}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                            {p.sellThroughRate}%
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-right text-ui-black">
                                                        {formatCurrency(p.totalRevenue)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-ui-secondary ">
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

            {/* 5. SEKCJA FAKTUR SPRZEDAŻOWYCH (DEDYKOWANY WIDOK) */}
            {view === "INVOICES" && (
                <div className="space-y-6">
                    {/* Tabela wszystkich faktur sprzedażowych */}
                    <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <Receipt size={14} className="text-ui-secondary" /> Rejestr faktur sprzedażowych
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                        <th className="p-3.5">Data wystawienia</th>
                                        <th className="p-3.5">Nr dokumentu</th>
                                        <th className="p-3.5">Kontrahent</th>
                                        <th className="p-3.5 text-right">Wartość netto</th>
                                        <th className="p-3.5 text-right">VAT</th>
                                        <th className="p-3.5 text-right">Wartość brutto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/30 font-medium">
                                    {filteredSalesInvoices.length > 0 ? (
                                        filteredSalesInvoices.map((inv) => {
                                            const isExpanded = !!expandedInvoices[inv.id];
                                            return (
                                                <React.Fragment key={inv.id}>
                                                    <tr
                                                        onClick={() => toggleInvoice(inv.id)}
                                                        className={`hover:bg-ui-accent/10 transition-colors cursor-pointer ${isExpanded ? "bg-ui-accent/10" : ""
                                                            }`}
                                                    >
                                                        <td className="p-3.5 text-ui-black">
                                                            {formatDate(inv.issuedDate)}
                                                        </td>
                                                        <td className="p-3.5  text-ui-primary">
                                                            {inv.invoiceNumber}
                                                        </td>
                                                        <td className="p-3.5 text-ui-black">
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{inv.contractorName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3.5 text-right text-ui-black">
                                                            {formatCurrency(inv.netAmount)}
                                                        </td>
                                                        <td className="p-3.5 text-right text-ui-black">
                                                            {formatCurrency(inv.vatAmount)}
                                                        </td>
                                                        <td className="p-3.5 text-right text-ui-black">
                                                            {formatCurrency(inv.grossAmount)}
                                                        </td>
                                                    </tr>

                                                    {/* Pozycje faktury */}
                                                    {isExpanded && (
                                                        <tr className="bg-ui-accent/5">
                                                            <td colSpan={8} className="p-4 border-b border-ui-accent/30">
                                                                <div className="space-y-2">
                                                                    <div className="text-[11px] font-bold text-ui-secondary uppercase flex items-center justify-between">
                                                                        <span>Pozycje faktury {inv.invoiceNumber} ({inv.contractorName}):</span>
                                                                        {inv.ksefNumber && (
                                                                            <span className="text-emerald-800 text-[10px]">
                                                                                Nr KSeF: {inv.ksefNumber}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="bg-white rounded-xl border border-ui-accent/50 overflow-hidden">
                                                                        <table className="w-full text-left text-xs border-collapse">
                                                                            <thead>
                                                                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold text-[10px] uppercase border-b border-ui-accent/30">
                                                                                    <th className="p-2.5">Pozycja / Towar</th>
                                                                                    <th className="p-2.5 text-center w-24">Ilość</th>
                                                                                    <th className="p-2.5 text-right w-28">Cena netto</th>
                                                                                    <th className="p-2.5 text-right w-28">Wartość netto</th>
                                                                                    <th className="p-2.5 text-right w-28">Wartość brutto</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-ui-accent/20">
                                                                                {inv.positions.map((p, idx) => (
                                                                                    <tr key={idx} className="hover:bg-ui-accent/5">
                                                                                        <td className="p-2.5 font-bold text-ui-black">{p.name}</td>
                                                                                        <td className="p-2.5 text-center font-semibold text-ui-secondary">
                                                                                            {p.quantity} {p.unit}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-right font-semibold text-ui-secondary">
                                                                                            {formatCurrency(p.netPrice)}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-right font-semibold text-ui-secondary">
                                                                                            {formatCurrency(p.netAmount)}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-right font-bold text-ui-primary">
                                                                                            {formatCurrency(p.grossAmount)}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
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
                                            <td colSpan={8} className="p-8 text-center text-ui-secondary ">
                                                Brak faktur sprzedażowych w wybranym okresie
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
