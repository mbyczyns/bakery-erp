"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    DollarSign,
    Calendar,
    BarChart3,
    CalendarDays,
    Settings,
    Plus,
    Copy,
    Save,
    Trash2,
    Edit3,
    TrendingUp,
    TrendingDown,
    ChevronLeft,
    ChevronRight,
    Loader2,
    PieChart as PieIcon,
    RefreshCw,
    Briefcase,
    ShieldCheck,
    FileSpreadsheet,
    CheckCircle2,
    Layers,
    Receipt,
    ShoppingBag,
    Boxes,
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
    PieChart,
    Pie,
    Cell
} from "recharts";

type Granularity = "MONTHLY_FORM" | "YEARLY_MATRIX" | "CHARTS" | "SETTINGS";
type PieFilterMode = "ALL" | "INVOICES" | "OPERATIONAL";

interface CostType {
    id: string;
    name: string;
}

interface MonthlyCostItem {
    costTypeId: string;
    costTypeName: string;
    value: number;
    sharePercent?: number;
    shareOfTotalPercent?: number;
}

interface InvoiceCategoryItem {
    name: string;
    gross: number;
    net: number;
    count: number;
    itemsCount: number;
    sharePercent: number;
}

interface CombinedCostItem {
    id: string;
    name: string;
    source: "OPERATIONAL" | "INVOICE";
    sourceLabel: string;
    value: number;
    netValue?: number;
    sharePercent: number;
}

interface YearlyMatrixRow {
    costTypeId: string;
    costTypeName: string;
    months: number[];
    total: number;
}

const COMBINED_PALETTE = [
    "#042043", // Ciemnoniebieski (Wypłaty)
    "#0c8ac9", // Błękitny (ZUS)
    "#f59e0b", // Złoty / Amber (PIT)
    "#10b981", // Szmaragdowy
    "#6366f1", // Indygo
    "#ec4899", // Różowy
    "#8b5cf6", // Fioletowy
    "#14b8a6", // Morski
    "#f97316", // Pomarańczowy
    "#06b6d4", // Cyjan
    "#84cc16", // Limonkowy
    "#64748b", // Slate
];

const MONTH_NAMES = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

const MONTH_SHORT = [
    "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
    "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"
];

function formatCurrency(amount: number): string {
    return (amount || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

function getCategoryIcon(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes("wypłat") || lower.includes("wynagrodz") || lower.includes("pracown")) return Briefcase;
    if (lower.includes("zus") || lower.includes("ubezpiecz")) return ShieldCheck;
    if (lower.includes("pit") || lower.includes("podatek") || lower.includes("cit")) return FileSpreadsheet;
    return Layers;
}

export default function KosztyTab() {
    const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
    const currentMonthKey = useMemo(() => todayStr.slice(0, 7), [todayStr]);

    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
    const [view, setView] = useState<Granularity>("MONTHLY_FORM");
    const [pieFilter, setPieFilter] = useState<PieFilterMode>("ALL");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Stan danych z API
    const [costData, setCostData] = useState<any>(null);

    // Stan edycji formularza miesięcznego: { [costTypeId]: string }
    const [formValues, setFormValues] = useState<Record<string, string>>({});

    // Stan dodawania nowej kategorii
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState("");

    // Pobieranie danych kosztów
    const fetchCosts = async (monthToFetch = selectedMonth) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/koszty?month=${monthToFetch}`);
            if (res.ok) {
                const json = await res.json();
                setCostData(json);

                // Zainicjalizuj formularz
                const initialForm: Record<string, string> = {};
                json.currentMonth?.items?.forEach((item: MonthlyCostItem) => {
                    initialForm[item.costTypeId] = item.value > 0 ? item.value.toString() : "";
                });
                setFormValues(initialForm);
            }
        } catch (err) {
            console.error("Błąd ładowania kosztów:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCosts(selectedMonth);
    }, [selectedMonth]);

    // Obsługa zmiany miesiąca
    const handlePrevMonth = () => {
        const [yStr, mStr] = selectedMonth.split("-");
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) - 1;
        if (m === 0) {
            m = 12;
            y -= 1;
        }
        setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
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
    };

    // Zmiana wartości w formularzu
    const handleInputChange = (costTypeId: string, value: string) => {
        setFormValues((prev) => ({
            ...prev,
            [costTypeId]: value,
        }));
    };

    // Suma na żywo z formularza pozafakturowego
    const liveOpTotal = useMemo(() => {
        let total = 0;
        Object.values(formValues).forEach((val) => {
            const num = parseFloat(val);
            if (!isNaN(num) && num > 0) total += num;
        });
        return Math.round(total * 100) / 100;
    }, [formValues]);

    // Łączna suma firmy na żywo (Formularz pozafakturowy + Faktury)
    const liveGrandEnterpriseTotal = useMemo(() => {
        const invTotal = costData?.invoicesSummary?.grossTotal || 0;
        return Math.round((liveOpTotal + invTotal) * 100) / 100;
    }, [liveOpTotal, costData?.invoicesSummary?.grossTotal]);

    // Zapis kosztów
    const handleSaveCosts = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            const costsToSave = Object.entries(formValues).map(([costTypeId, valStr]) => ({
                costTypeId,
                value: parseFloat(valStr) || 0,
            }));

            const res = await fetch("/api/koszty", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    month: selectedMonth,
                    costs: costsToSave,
                }),
            });

            if (res.ok) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
                await fetchCosts(selectedMonth);
            }
        } catch (err) {
            console.error("Błąd zapisu kosztów:", err);
        } finally {
            setIsSaving(false);
        }
    };

    // Kopiowanie z poprzedniego miesiąca
    const handleCopyFromPrevMonth = () => {
        if (!costData?.previousMonth?.items) return;
        const newVals: Record<string, string> = {};
        costData.previousMonth.items.forEach((item: MonthlyCostItem) => {
            if (item.value > 0) {
                newVals[item.costTypeId] = item.value.toString();
            }
        });
        setFormValues((prev) => ({ ...prev, ...newVals }));
    };

    // Czyszczenie formularza
    const handleClearForm = () => {
        const cleared: Record<string, string> = {};
        Object.keys(formValues).forEach((k) => {
            cleared[k] = "";
        });
        setFormValues(cleared);
    };

    // Dodawanie nowej kategorii
    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        try {
            const res = await fetch("/api/koszty/types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newCategoryName.trim() }),
            });

            if (res.ok) {
                setNewCategoryName("");
                setIsAddingCategory(false);
                await fetchCosts(selectedMonth);
            } else {
                const err = await res.json();
                alert(err.error || "Wystąpił błąd");
            }
        } catch (err) {
            console.error("Błąd dodawania kategorii:", err);
        }
    };

    // Edycja kategorii
    const handleUpdateCategory = async (id: string) => {
        if (!editingCategoryName.trim()) return;

        try {
            const res = await fetch("/api/koszty/types", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, name: editingCategoryName.trim() }),
            });

            if (res.ok) {
                setEditingCategoryId(null);
                setEditingCategoryName("");
                await fetchCosts(selectedMonth);
            }
        } catch (err) {
            console.error("Błąd aktualizacji kategorii:", err);
        }
    };

    // Usuwanie kategorii
    const handleDeleteCategory = async (id: string, name: string) => {
        if (!confirm(`Czy na pewno chcesz usunąć kategorię "${name}" i powiązane z nią wpisy?`)) return;

        try {
            const res = await fetch(`/api/koszty/types?id=${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                await fetchCosts(selectedMonth);
            }
        } catch (err) {
            console.error("Błąd usuwania kategorii:", err);
        }
    };

    // Dynamiczne dane do dużego wykresu kołowego
    const pieChartItems = useMemo(() => {
        if (!costData) return [];

        const combined: CombinedCostItem[] = [];

        // 1. Koszty pozafakturowe z formularza na żywo
        costData.costTypes?.forEach((type: CostType) => {
            const val = parseFloat(formValues[type.id] || "0") || 0;
            if (val > 0) {
                combined.push({
                    id: `op_${type.id}`,
                    name: type.name,
                    source: "OPERATIONAL",
                    sourceLabel: "Koszty pozafakturowe",
                    value: val,
                    sharePercent: 0,
                });
            }
        });

        // 2. Kategorie z faktur
        const invCategories: InvoiceCategoryItem[] = costData.invoicesSummary?.categories || [];
        invCategories.forEach((cat) => {
            if (cat.gross > 0) {
                combined.push({
                    id: `inv_${cat.name}`,
                    name: cat.name,
                    source: "INVOICE",
                    sourceLabel: "Faktury kosztowe",
                    value: cat.gross,
                    netValue: cat.net,
                    sharePercent: 0,
                });
            }
        });

        let filtered = combined;
        if (pieFilter === "OPERATIONAL") {
            filtered = combined.filter((i) => i.source === "OPERATIONAL");
        } else if (pieFilter === "INVOICES") {
            filtered = combined.filter((i) => i.source === "INVOICE");
        }

        const sum = filtered.reduce((acc, curr) => acc + curr.value, 0);

        return filtered
            .map((item, idx) => ({
                ...item,
                sharePercent: sum > 0 ? Math.round((item.value / sum) * 1000) / 10 : 0,
                color: COMBINED_PALETTE[idx % COMBINED_PALETTE.length],
            }))
            .sort((a, b) => b.value - a.value);
    }, [costData, formValues, pieFilter]);

    if (isLoading && !costData) {
        return (
            <div className="py-20 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-ui-secondary">
                    <Loader2 size={36} className="animate-spin text-ui-secondary" />
                    <p className="font-bold text-sm tracking-wide">Ładowanie modułu kosztów...</p>
                </div>
            </div>
        );
    }

    const invoicesGross = costData?.invoicesSummary?.grossTotal || 0;
    const invoicesNet = costData?.invoicesSummary?.netTotal || 0;
    const invoicesCount = costData?.invoicesSummary?.count || 0;
    const invoiceCategoriesList: InvoiceCategoryItem[] = costData?.invoicesSummary?.categories || [];

    return (
        <div className="space-y-6">
            {/* ---------------- NAGŁÓWEK KOSZTÓW: SELEKTOR MIESIĄCA ---------------- */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-ui-black flex items-center gap-2">
                        <TrendingDown size={20} className="text-ui-primary" />
                        Koszty przedsiębiorstwa
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white border border-ui-accent rounded-xl shadow-xs p-1">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-ui-accent/15 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            title="Poprzedni miesiąc"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 text-xs font-black text-ui-primary min-w-[120px] text-center">
                            {costData?.monthName} {costData?.year}
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
                        onClick={() => fetchCosts(selectedMonth)}
                        className="p-2.5 bg-white border border-ui-accent rounded-xl text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/15 transition-colors shadow-xs cursor-pointer"
                        title="Odśwież dane"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* ---------------- PRZEŁĄCZNIK WIDOKÓW (TABS) ---------------- */}
            <div className="bg-white border border-ui-accent rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-ui-accent/10 rounded-xl border border-ui-accent/30">
                    <button
                        onClick={() => setView("MONTHLY_FORM")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${view === "MONTHLY_FORM"
                                ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                                : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <Calendar size={14} />
                        Widok miesięczny ({costData?.monthName || ""})
                    </button>
                    <button
                        onClick={() => setView("YEARLY_MATRIX")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${view === "YEARLY_MATRIX"
                                ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                                : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <CalendarDays size={14} />
                        Zestawienie roczne {costData?.year}
                    </button>
                    <button
                        onClick={() => setView("CHARTS")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${view === "CHARTS"
                                ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                                : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <BarChart3 size={14} />
                        Wykresy roczne
                    </button>
                    <button
                        onClick={() => setView("SETTINGS")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${view === "SETTINGS"
                                ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                                : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <Settings size={14} />
                        Kategorie ({costData?.costTypes?.length || 0})
                    </button>
                </div>

                {view === "MONTHLY_FORM" && (
                    <div className="flex items-center gap-2">
                        {costData?.previousMonth?.total > 0 && (
                            <button
                                onClick={handleCopyFromPrevMonth}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-ui-accent bg-ui-accent/10 hover:bg-ui-accent/20 text-ui-primary font-bold text-xs transition-colors cursor-pointer"
                                title={`Skopiuj ${formatCurrency(costData.previousMonth.total)} z poprzedniego miesiąca`}
                            >
                                <Copy size={13} />
                                Skopiuj z poprzedniego m-ca
                            </button>
                        )}
                        <button
                            onClick={handleClearForm}
                            className="px-3 py-1.5 rounded-xl border border-ui-accent/60 text-ui-secondary hover:text-ui-black hover:bg-ui-accent/10 font-bold text-xs transition-colors cursor-pointer"
                        >
                            Wyczyść
                        </button>
                    </div>
                )}
            </div>

            {/* ---------------- KARTY PODSUMOWANIA KPI ---------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* KARTA 1: ŁĄCZNE KOSZTY FIRMY */}
                <div className="bg-gradient-to-br from-ui-primary to-slate-900 text-white rounded-2xl p-5 shadow-sm">
                    <div className="text-[11px] uppercase font-bold text-ui-accent tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <DollarSign size={15} className="text-ui-accent" />
                            Łączne koszty firmy
                        </span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md font-semibold">
                            {costData?.monthName}
                        </span>
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {formatCurrency(liveGrandEnterpriseTotal)}
                    </div>
                    <div className="text-[11px] text-ui-accent/80 mt-1 flex items-center justify-between font-medium">
                        <span>Płace/ZUS/PIT + Faktury</span>
                    </div>
                </div>

                {/* KARTA 2: KOSZTY POZAFAKTUROWE */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Briefcase size={15} className="text-ui-primary" />
                                Koszty pozafakturowe
                            </span>
                            <span className="text-[10px] font-black text-ui-primary bg-ui-accent/20 px-2 py-0.5 rounded-md">
                                {liveGrandEnterpriseTotal > 0 ? Math.round((liveOpTotal / liveGrandEnterpriseTotal) * 100) : 0}%
                            </span>
                        </div>
                        <div className="mt-2 text-xl font-black text-ui-black tracking-tight">
                            {formatCurrency(liveOpTotal)}
                        </div>
                    </div>
                    <div className="text-[11px] text-ui-secondary font-semibold mt-2 flex items-center justify-between">
                        <span>Wypłaty, ZUS, PIT</span>
                        {costData?.stats?.momChangePercent !== 0 && (
                            <span className={costData?.stats?.momChangePercent > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                                {costData?.stats?.momChangePercent > 0 ? `+${costData.stats.momChangePercent}%` : `${costData.stats.momChangePercent}%`} MoM
                            </span>
                        )}
                    </div>
                </div>

                {/* KARTA 3: FAKTURY KOSZTOWE */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Receipt size={15} className="text-emerald-600" />
                                Faktury kosztowe
                            </span>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {liveGrandEnterpriseTotal > 0 ? Math.round((invoicesGross / liveGrandEnterpriseTotal) * 100) : 0}%
                            </span>
                        </div>
                        <div className="mt-2 text-xl font-black text-ui-black tracking-tight">
                            {formatCurrency(invoicesGross)}
                        </div>
                    </div>
                    <div className="text-[11px] text-ui-secondary font-semibold mt-2 flex items-center justify-between">
                        <span>Netto: {formatCurrency(invoicesNet)}</span>
                        <span>{invoicesCount} dok.</span>
                    </div>
                </div>
            </div>

            {/* ---------------- 1. WIDOK MIESIĘCZNY (ZMNIEJSZONA LISTA + DUŻY WYKRES KOŁOWY + FAKTURY) ---------------- */}
            {view === "MONTHLY_FORM" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* LEWA KOLUMNA: ZWARTA LISTA KATEGORII POZAFAKTUROWYCH (5/12) */}
                        <div className="lg:col-span-5 bg-white border border-ui-accent rounded-2xl shadow-xs overflow-hidden">
                            <div className="p-3.5 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1.5">
                                        <Briefcase size={14} className="text-ui-primary" />
                                        Koszty pozafakturowe ({costData?.monthName})
                                    </h3>
                                    <p className="text-[11px] text-ui-secondary mt-0.5">
                                        Wypłaty, ZUS, PIT oraz kategorie własne
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setIsAddingCategory(true)}
                                        className="p-1.5 bg-white hover:bg-ui-accent/15 border border-ui-accent rounded-lg text-ui-primary transition-colors cursor-pointer"
                                        title="Dodaj nową kategorię"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    <button
                                        onClick={handleSaveCosts}
                                        disabled={isSaving}
                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${saveSuccess
                                                ? "bg-emerald-600 hover:bg-emerald-700"
                                                : "bg-ui-primary hover:bg-slate-900"
                                            }`}
                                    >
                                        {isSaving ? (
                                            <Loader2 size={13} className="animate-spin" />
                                        ) : saveSuccess ? (
                                            <CheckCircle2 size={13} />
                                        ) : (
                                            <Save size={13} />
                                        )}
                                        {saveSuccess ? "Zapisano" : "Zapisz"}
                                    </button>
                                </div>
                            </div>

                            {/* Szybki formularz dodawania kategorii */}
                            {isAddingCategory && (
                                <form onSubmit={handleAddCategory} className="p-3 bg-ui-accent/10 border-b border-ui-accent/40 flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nazwa nowej kategorii..."
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        autoFocus
                                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-ui-accent bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ui-secondary"
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 py-1.5 bg-ui-primary text-white rounded-lg text-xs font-bold hover:bg-slate-900 cursor-pointer"
                                    >
                                        Dodaj
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddingCategory(false);
                                            setNewCategoryName("");
                                        }}
                                        className="px-2 py-1.5 text-xs font-semibold text-ui-secondary hover:text-ui-black cursor-pointer"
                                    >
                                        Anuluj
                                    </button>
                                </form>
                            )}

                            {/* ZWARTA LISTA POZYCJI */}
                            <div className="p-3.5 divide-y divide-ui-accent/30 space-y-2.5">
                                {costData?.costTypes?.map((type: CostType) => {
                                    const Icon = getCategoryIcon(type.name);
                                    const currentVal = formValues[type.id] || "";
                                    const numVal = parseFloat(currentVal) || 0;
                                    const share = liveOpTotal > 0 ? Math.round((numVal / liveOpTotal) * 1000) / 10 : 0;

                                    return (
                                        <div
                                            key={type.id}
                                            className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-ui-accent/15 text-ui-primary flex items-center justify-center shrink-0">
                                                    <Icon size={15} />
                                                </div>
                                                <div className="truncate">
                                                    <div className="font-bold text-xs text-ui-black truncate">{type.name}</div>
                                                    <div className="text-[10px] text-ui-secondary">
                                                        {numVal > 0 ? `${share}% płac/ZUS/PIT` : "Brak kwoty"}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="0.00"
                                                        value={currentVal}
                                                        onChange={(e) => handleInputChange(type.id, e.target.value)}
                                                        className="w-32 text-right pr-7 pl-2.5 py-1.5 rounded-lg border border-ui-accent bg-white text-ui-black font-black text-xs focus:outline-none focus:ring-2 focus:ring-ui-secondary"
                                                    />
                                                    <span className="absolute right-2 top-2 text-[10px] font-semibold text-ui-secondary pointer-events-none">
                                                        zł
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Dolny pasek podsumowania formularza */}
                            <div className="p-3 border-t border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                                <div className="text-xs font-bold text-ui-secondary">
                                    Suma pozafakturowa:
                                </div>
                                <span className="text-base font-black text-ui-black">{formatCurrency(liveOpTotal)}</span>
                            </div>
                        </div>

                        {/* PRAWA KOLUMNA: DUŻY WYKRES KOŁOWY Z WSZYSTKIMI KOSZTAMI (7/12) */}
                        <div className="lg:col-span-7 bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-ui-accent/40 mb-4">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                            <PieIcon size={16} className="text-ui-primary" />
                                            Struktura wszystkich kosztów ({costData?.monthName})
                                        </h3>
                                        <p className="text-[11px] text-ui-secondary mt-0.5">
                                            Pozafakturowe + Pozycje i kategorie z faktur
                                        </p>
                                    </div>

                                    {/* Filtry wykresu kołowego */}
                                    <div className="flex items-center gap-1 p-0.5 bg-ui-accent/15 rounded-lg border border-ui-accent/30 text-[11px] font-bold">
                                        <button
                                            onClick={() => setPieFilter("ALL")}
                                            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${pieFilter === "ALL" ? "bg-white text-ui-primary shadow-2xs" : "text-ui-secondary hover:text-ui-primary"
                                                }`}
                                        >
                                            Wszystko
                                        </button>
                                        <button
                                            onClick={() => setPieFilter("INVOICES")}
                                            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${pieFilter === "INVOICES" ? "bg-white text-ui-primary shadow-2xs" : "text-ui-secondary hover:text-ui-primary"
                                                }`}
                                        >
                                            Faktury
                                        </button>
                                        <button
                                            onClick={() => setPieFilter("OPERATIONAL")}
                                            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${pieFilter === "OPERATIONAL" ? "bg-white text-ui-primary shadow-2xs" : "text-ui-secondary hover:text-ui-primary"
                                                }`}
                                        >
                                            Płace/ZUS/PIT
                                        </button>
                                    </div>
                                </div>

                                {/* DUŻY WYKRES KOŁOWY / DONUT */}
                                {pieChartItems.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                        <div className="md:col-span-6 h-[260px] w-full flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieChartItems}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={55}
                                                        outerRadius={95}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                    >
                                                        {pieChartItems.map((entry: any, index: number) => (
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

                                        {/* Lista legendy z podziałem */}
                                        <div className="md:col-span-6 space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                            {pieChartItems.map((item: any) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-ui-accent/10 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2 truncate pr-2">
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                                            style={{ backgroundColor: item.color }}
                                                        />
                                                        <div className="truncate">
                                                            <span className="text-ui-primary font-semibold truncate block">
                                                                {item.name}
                                                            </span>
                                                            <span className="text-[10px] text-ui-secondary">
                                                                {item.sourceLabel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="font-bold text-ui-black whitespace-nowrap text-right">
                                                        {formatCurrency(item.value)}{" "}
                                                        <span className="text-[10px] text-ui-secondary block font-medium">
                                                            {item.sharePercent}%
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-[220px] flex items-center justify-center text-xs text-ui-secondary italic">
                                        Brak zarejestrowanych kosztów w wybranym filtrze
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-ui-accent/40 flex items-center justify-between text-xs font-bold text-ui-secondary">
                                <span>Razem w wybranym filtrze:</span>
                                <span className="text-base font-black text-ui-black">
                                    {formatCurrency(
                                        pieFilter === "ALL"
                                            ? liveGrandEnterpriseTotal
                                            : pieFilter === "INVOICES"
                                                ? invoicesGross
                                                : liveOpTotal
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ---------------- PODZIAŁ POZYCJI Z FAKTUR NA TYPY I KATEGORIE ---------------- */}
                    <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                    <ShoppingBag size={15} className="text-emerald-600" />
                                    Podział pozycji z faktur kosztowych za {costData?.monthName} {costData?.year}
                                </h3>
                                <p className="text-[11px] text-ui-secondary mt-0.5">
                                    Zestawienie kategorii produktów na fakturach zakupu
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-ui-secondary">
                                    Dokumenty: <strong className="text-ui-black">{invoicesCount}</strong>
                                </span>
                                <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl">
                                    Suma brutto: {formatCurrency(invoicesGross)}
                                </span>
                            </div>
                        </div>

                        {invoiceCategoriesList.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                            <th className="p-3.5 min-w-[200px]">Kategoria produktu na fakturze</th>
                                            <th className="p-3.5 text-right min-w-[90px]">Liczba pozycji</th>
                                            <th className="p-3.5 text-right min-w-[120px]">Kwota Netto</th>
                                            <th className="p-3.5 text-right min-w-[120px]">Kwota Brutto</th>
                                            <th className="p-3.5 text-right min-w-[100px]">Udział w fakturach</th>
                                            <th className="p-3.5 text-right min-w-[110px] bg-ui-accent/15 font-black text-ui-black">
                                                Udział w kosztach firmy
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/30 font-medium">
                                        {invoiceCategoriesList.map((cat, idx) => {
                                            const shareOfAll = liveGrandEnterpriseTotal > 0
                                                ? Math.round((cat.gross / liveGrandEnterpriseTotal) * 1000) / 10
                                                : 0;

                                            return (
                                                <tr key={idx} className="hover:bg-ui-accent/5 transition-colors">
                                                    <td className="p-3.5 font-bold text-ui-black flex items-center gap-2">
                                                        <Boxes size={14} className="text-ui-secondary" />
                                                        {cat.name}
                                                    </td>
                                                    <td className="p-3.5 text-right text-ui-secondary font-semibold">
                                                        {cat.itemsCount || cat.count}
                                                    </td>
                                                    <td className="p-3.5 text-right font-semibold text-ui-secondary">
                                                        {formatCurrency(cat.net)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-bold text-ui-black">
                                                        {formatCurrency(cat.gross)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-semibold text-emerald-700">
                                                        {cat.sharePercent}%
                                                    </td>
                                                    <td className="p-3.5 text-right font-black text-ui-primary bg-ui-accent/5">
                                                        {shareOfAll}%
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-ui-accent/15 font-black text-ui-black border-t border-ui-accent/40">
                                            <td className="p-3.5">RAZEM FAKTURY</td>
                                            <td className="p-3.5 text-right">
                                                {invoiceCategoriesList.reduce((acc, c) => acc + (c.itemsCount || c.count), 0)}
                                            </td>
                                            <td className="p-3.5 text-right">{formatCurrency(invoicesNet)}</td>
                                            <td className="p-3.5 text-right">{formatCurrency(invoicesGross)}</td>
                                            <td className="p-3.5 text-right">100%</td>
                                            <td className="p-3.5 text-right bg-ui-accent/20">
                                                {liveGrandEnterpriseTotal > 0 ? Math.round((invoicesGross / liveGrandEnterpriseTotal) * 100) : 0}%
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-xs text-ui-secondary italic">
                                Brak zarejestrowanych faktur kosztowych w wybranym miesiącu ({costData?.monthName} {costData?.year})
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ---------------- 2. ZESTAWIENIE ROCZNE (MACIERZ) ---------------- */}
            {view === "YEARLY_MATRIX" && (
                <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <CalendarDays size={14} />
                                Roczne zestawienie kosztów pozafakturowych – Rok {costData?.year}
                            </h3>
                            <p className="text-[11px] text-ui-secondary mt-0.5">
                                Wypłaty, ZUS, PIT oraz kategorie własne w ujęciu 12 miesięcy
                            </p>
                        </div>
                        <span className="text-xs font-black text-ui-primary bg-ui-accent/20 px-3 py-1 rounded-xl">
                            Razem w roku: {formatCurrency(costData?.stats?.grandYearOpTotal || 0)}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider border-b border-ui-accent/30">
                                    <th className="p-3.5 sticky left-0 bg-ui-white z-10 min-w-[200px]">Kategoria kosztu</th>
                                    {MONTH_SHORT.map((m) => (
                                        <th key={m} className="p-3.5 text-right min-w-[85px]">
                                            {m}
                                        </th>
                                    ))}
                                    <th className="p-3.5 text-right font-black text-ui-black min-w-[110px] bg-ui-accent/15">
                                        Suma roczna
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/30 font-medium">
                                {costData?.yearlyMatrix?.map((row: YearlyMatrixRow) => (
                                    <tr key={row.costTypeId} className="hover:bg-ui-accent/5 transition-colors">
                                        <td className="p-3.5 font-bold text-ui-black sticky left-0 bg-white z-10 truncate">
                                            {row.costTypeName}
                                        </td>
                                        {row.months.map((val, mIdx) => (
                                            <td
                                                key={mIdx}
                                                className={`p-3.5 text-right ${val > 0 ? "font-bold text-ui-primary" : "text-ui-secondary/40"}`}
                                            >
                                                {val > 0 ? val.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "-"}
                                            </td>
                                        ))}
                                        <td className="p-3.5 text-right font-black text-ui-black bg-ui-accent/5">
                                            {formatCurrency(row.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-ui-accent/15 font-black text-ui-black border-t border-ui-accent/40">
                                    <td className="p-3.5 sticky left-0 bg-ui-accent/15 z-10">SUMA MIESIĄCA</td>
                                    {costData?.monthlyOpTotals?.map((tot: number, mIdx: number) => (
                                        <td key={mIdx} className="p-3.5 text-right">
                                            {tot > 0 ? tot.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "-"}
                                        </td>
                                    ))}
                                    <td className="p-3.5 text-right bg-ui-accent/25 text-ui-primary">
                                        {formatCurrency(costData?.stats?.grandYearOpTotal || 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ---------------- 3. WYKRESY ROCZNE ---------------- */}
            {view === "CHARTS" && (
                <div className="space-y-6">
                    <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                    <BarChart3 size={15} />
                                    Porównanie kosztów w roku {costData?.year}: Płace/ZUS/PIT vs Faktury
                                </h3>
                                <p className="text-[11px] text-ui-secondary mt-0.5">
                                    Słupki skumulowane kosztów przedsiębiorstwa
                                </p>
                            </div>
                        </div>

                        <div className="h-[340px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={costData?.monthlyChartData || []} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="month" tick={{ fill: "#6B7280", fontSize: 11 }} />
                                    <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} />
                                    <Tooltip
                                        formatter={(val: number) => formatCurrency(val)}
                                        contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", fontWeight: "bold", fontSize: "12px" }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px", fontWeight: "600" }} />
                                    <Bar dataKey="operationalTotal" name="Koszty pozafakturowe (Płace/ZUS/PIT)" fill="#042043" stackId="a" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="invoiceGross" name="Faktury kosztowe (Brutto)" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* ---------------- 4. ZARZĄDZANIE KATEGORIAMI ---------------- */}
            {view === "SETTINGS" && (
                <div className="bg-white border border-ui-accent rounded-2xl p-6 shadow-xs max-w-2xl mx-auto">
                    <div className="flex items-center justify-between pb-4 border-b border-ui-accent/50 mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-ui-black flex items-center gap-2">
                                <Settings size={16} />
                                Kategorie kosztów pozafakturowych
                            </h3>
                            <p className="text-xs text-ui-secondary mt-1">
                                Dodawaj nowe kategorie (np. premie, inne) i edytuj istniejące
                            </p>
                        </div>
                    </div>

                    {/* Formularz nowej kategorii */}
                    <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            placeholder="Wpisz nazwę nowej kategorii..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-ui-accent bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ui-secondary"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-ui-primary text-white rounded-xl text-xs font-bold hover:bg-slate-900 cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                        >
                            <Plus size={14} />
                            Dodaj
                        </button>
                    </form>

                    {/* Lista kategorii */}
                    <div className="divide-y divide-ui-accent/30 space-y-2">
                        {costData?.costTypes?.map((type: CostType) => {
                            const isEditing = editingCategoryId === type.id;
                            const isDefault = ["Wypłaty pracowników", "Składki ZUS", "Podatek PIT"].includes(type.name);

                            return (
                                <div key={type.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <input
                                                type="text"
                                                value={editingCategoryName}
                                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-ui-accent bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ui-secondary"
                                            />
                                            <button
                                                onClick={() => handleUpdateCategory(type.id)}
                                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                                            >
                                                Zapisz
                                            </button>
                                            <button
                                                onClick={() => setEditingCategoryId(null)}
                                                className="px-2 py-1.5 text-xs text-ui-secondary hover:text-ui-black cursor-pointer"
                                            >
                                                Anuluj
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-2 h-2 rounded-full bg-ui-secondary" />
                                                <span className="font-bold text-xs text-ui-black">{type.name}</span>
                                                {isDefault && (
                                                    <span className="text-[10px] bg-ui-accent/20 text-ui-secondary px-2 py-0.5 rounded-md font-semibold">
                                                        Domyślna
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setEditingCategoryId(type.id);
                                                        setEditingCategoryName(type.name);
                                                    }}
                                                    className="p-1.5 text-ui-secondary hover:text-ui-black hover:bg-ui-accent/15 rounded-lg transition-colors cursor-pointer"
                                                    title="Edytuj nazwę"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                {!isDefault && (
                                                    <button
                                                        onClick={() => handleDeleteCategory(type.id, type.name)}
                                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Usuń kategorię"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
