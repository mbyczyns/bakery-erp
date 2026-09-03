"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Calendar as CalendarIcon,
    Plus,
    Clock,
    Coins,
    Receipt,
    PackageCheck,
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Eye,
    Edit3,
    Layers,
    Wheat,
    Croissant,
    Pizza,
    TrendingUp,
    TrendingDown,
    List,
    CalendarDays,
    X,
    Loader2,
    Check,
    Sparkles,
    AlertTriangle,
} from "lucide-react";

type ProductType = "BREAD" | "ROLL" | "SWEET" | "SAVORY";

interface BakeryProduct {
    id: string;
    name: string;
    type: ProductType;
    productionCost: number | string;
    sellingPrice: number | string;
}

interface DaySummary {
    date: string;
    totalProduced: number;
    totalSold: number;
    bakerySalesIncome: number;
    fiscalIncome: number;
    hasReport: boolean;
    productsCount: number;
}

interface MonthStats {
    monthProduced: number;
    monthSold: number;
    monthBakeryIncome: number;
    monthFiscalIncome: number;
    missingReportsCount: number;
    totalDaysInMonth: number;
}

interface ProductionDetailItem {
    bakeryProductId: string;
    producedAmount: string;
    soldAmount: string;
    soldOutTime: string;
}

const CATEGORY_MAP: Record<ProductType, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    BREAD: { label: "Chleby", icon: Wheat },
    ROLL: { label: "Bułki", icon: Layers },
    SWEET: { label: "Słodkie Wypieki", icon: Croissant },
    SAVORY: { label: "Słone Wypieki", icon: Pizza },
};

const POLISH_MONTHS = [
    "Styczeń",
    "Luty",
    "Marzec",
    "Kwiecień",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpień",
    "Wrzesień",
    "Październik",
    "Listopad",
    "Grudzień",
];

const WEEKDAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const SHORT_WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

export default function ProdukcjaPage() {
    // -------------------------------------------------------------
    // GŁÓWNY STAN STRONY
    // -------------------------------------------------------------
    const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
    const [currentMonth, setCurrentMonth] = useState<string>(todayStr.slice(0, 7)); // "YYYY-MM"

    // Widoki: "LIST" | "CALENDAR"
    const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");
    // Grupowanie na liście: "DAYS" | "WEEKS" | "MONTHS"
    const [listGrouping, setListGrouping] = useState<"DAYS" | "WEEKS" | "MONTHS">("DAYS");

    const [daysSummary, setDaysSummary] = useState<DaySummary[]>([]);
    const [stats, setStats] = useState<MonthStats>({
        monthProduced: 0,
        monthSold: 0,
        monthBakeryIncome: 0,
        monthFiscalIncome: 0,
        missingReportsCount: 0,
        totalDaysInMonth: 30,
    });
    const [isLoadingSummary, setIsLoadingSummary] = useState(true);

    // -------------------------------------------------------------
    // MODAL FORMULARZA RAPORTU (Nowy raport / Edycja)
    // -------------------------------------------------------------
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formDate, setFormDate] = useState<string>(todayStr);
    const [formFiscalIncome, setFormFiscalIncome] = useState<string>("");
    const [allProducts, setAllProducts] = useState<BakeryProduct[]>([]);
    const [formItems, setFormItems] = useState<Record<string, ProductionDetailItem>>({});
    const [isLoadingFormData, setIsLoadingFormData] = useState(false);
    const [isSavingForm, setIsSavingForm] = useState(false);
    const [formSaveSuccess, setFormSaveSuccess] = useState(false);

    // -------------------------------------------------------------
    // MODAL SZCZEGÓŁOWEGO PODGLĄDU DNIA
    // -------------------------------------------------------------
    const [previewDate, setPreviewDate] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState<{
        date: string;
        products: BakeryProduct[];
        productions: any[];
        fiscalIncome: number;
        soldOutTimes: Record<string, string>;
    } | null>(null);

    // -------------------------------------------------------------
    // POBIERANIE DANYCH ZBIORCZYCH DLA MIESIĄCA
    // -------------------------------------------------------------
    const fetchSummary = async (month: string) => {
        setIsLoadingSummary(true);
        try {
            const res = await fetch(`/api/produkcja?mode=summary&month=${month}`);
            if (res.ok) {
                const data = await res.json();
                setDaysSummary(data.days || []);
                if (data.stats) {
                    setStats(data.stats);
                }
            }
        } catch (error) {
            console.error("Błąd podczas pobierania podsumowania produkcji:", error);
        } finally {
            setIsLoadingSummary(false);
        }
    };

    useEffect(() => {
        fetchSummary(currentMonth);
    }, [currentMonth]);

    // Nawigacja po miesiącach
    const handlePrevMonth = () => {
        const [y, m] = currentMonth.split("-").map(Number);
        const prev = new Date(Date.UTC(y, m - 2, 1));
        setCurrentMonth(prev.toISOString().slice(0, 7));
    };

    const handleNextMonth = () => {
        const [y, m] = currentMonth.split("-").map(Number);
        const next = new Date(Date.UTC(y, m, 1));
        setCurrentMonth(next.toISOString().slice(0, 7));
    };

    // -------------------------------------------------------------
    // OBSŁUGA FORMULARZA RAPORTU (Nowy raport / Edycja)
    // -------------------------------------------------------------
    const openNewReportModal = (initialDate?: string) => {
        const dateToSet = initialDate || todayStr;
        setFormDate(dateToSet);
        setIsFormModalOpen(true);
        setFormSaveSuccess(false);
        loadReportForDate(dateToSet);
    };

    const loadReportForDate = async (dateToLoad: string) => {
        setIsLoadingFormData(true);
        try {
            const res = await fetch(`/api/produkcja?date=${dateToLoad}`);
            if (res.ok) {
                const data = await res.json();
                const productsList: BakeryProduct[] = data.products || [];
                setAllProducts(productsList);

                // Utarg fiskalny
                setFormFiscalIncome(data.fiscalIncome > 0 ? String(data.fiscalIncome) : "");

                // Wypełnianie pozycji produktów
                const itemsMap: Record<string, ProductionDetailItem> = {};
                productsList.forEach((prod) => {
                    const existing = (data.productions || []).find(
                        (p: any) => p.bakeryProductId === prod.id
                    );
                    const soldOut = (data.soldOutTimes && data.soldOutTimes[prod.id]) || "";

                    itemsMap[prod.id] = {
                        bakeryProductId: prod.id,
                        producedAmount: existing ? String(existing.producedAmount) : "",
                        soldAmount: existing ? String(existing.soldAmount) : "",
                        soldOutTime: soldOut,
                    };
                });
                setFormItems(itemsMap);
            }
        } catch (error) {
            console.error("Błąd ładowania danych raportu:", error);
        } finally {
            setIsLoadingFormData(false);
        }
    };

    // Zmiana wartości w formularzu
    const handleFormItemChange = (
        productId: string,
        field: "producedAmount" | "soldAmount" | "soldOutTime",
        val: string
    ) => {
        setFormItems((prev) => {
            const current = prev[productId] || {
                bakeryProductId: productId,
                producedAmount: "",
                soldAmount: "",
                soldOutTime: "",
            };

            const updated = { ...current, [field]: val };

            // Jeśli sprzedano mniej niż wyprodukowano, wyczyść godzinę wyprzedania
            if (field === "soldAmount" || field === "producedAmount") {
                const prodNum = parseInt(field === "producedAmount" ? val : current.producedAmount, 10) || 0;
                const soldNum = parseInt(field === "soldAmount" ? val : current.soldAmount, 10) || 0;
                if (soldNum < prodNum) {
                    updated.soldOutTime = "";
                }
            }

            return {
                ...prev,
                [productId]: updated,
            };
        });
    };

    // Zapis raportu dziennego
    const handleSaveReportForm = async () => {
        setIsSavingForm(true);
        setFormSaveSuccess(false);

        try {
            const itemsToSave = Object.values(formItems).map((item) => ({
                bakeryProductId: item.bakeryProductId,
                producedAmount: parseInt(item.producedAmount, 10) || 0,
                soldAmount: parseInt(item.soldAmount, 10) || 0,
                soldOutTime: item.soldOutTime || "",
            }));

            const res = await fetch("/api/produkcja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: formDate,
                    fiscalIncome: parseFloat(formFiscalIncome.replace(",", ".")) || 0,
                    items: itemsToSave,
                }),
            });

            if (res.ok) {
                setFormSaveSuccess(true);
                await fetchSummary(currentMonth);
                setTimeout(() => {
                    setFormSaveSuccess(false);
                    setIsFormModalOpen(false);
                }, 1200);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`Błąd zapisu raportu: ${err.error || "Wystąpił problem"}`);
            }
        } catch (error) {
            console.error("Błąd podczas zapisywania raportu:", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSavingForm(false);
        }
    };

    // Podsumowania live w formularzu
    const formLiveStats = useMemo(() => {
        let totalProduced = 0;
        let totalSold = 0;
        let estimatedBakeryIncome = 0;

        const priceMap = new Map<string, number>();
        allProducts.forEach((p) => priceMap.set(p.id, Number(p.sellingPrice || 0)));

        Object.values(formItems).forEach((item) => {
            const prod = parseInt(item.producedAmount, 10) || 0;
            const sold = parseInt(item.soldAmount, 10) || 0;
            const price = priceMap.get(item.bakeryProductId) || 0;

            totalProduced += prod;
            totalSold += sold;
            estimatedBakeryIncome += sold * price;
        });

        const fiscalVal = parseFloat(formFiscalIncome.replace(",", ".")) || 0;

        return {
            totalProduced,
            totalSold,
            estimatedBakeryIncome,
            fiscalVal,
            diff: fiscalVal - estimatedBakeryIncome,
        };
    }, [formItems, allProducts, formFiscalIncome]);

    // -------------------------------------------------------------
    // OBSŁUGA SZCZEGÓŁOWEGO PODGLĄDU DNIA
    // -------------------------------------------------------------
    const openDayPreview = async (dateToPreview: string) => {
        setPreviewDate(dateToPreview);
        setPreviewLoading(true);
        try {
            const res = await fetch(`/api/produkcja?date=${dateToPreview}`);
            if (res.ok) {
                const data = await res.json();
                setPreviewData(data);
            }
        } catch (error) {
            console.error("Błąd podczas ładowania podglądu dnia:", error);
        } finally {
            setPreviewLoading(false);
        }
    };

    // -------------------------------------------------------------
    // GRUPOWANIE DANYCH DLA LISTY (DNI / TYGODNIE / MIESIĄCE)
    // -------------------------------------------------------------
    const groupedListData = useMemo(() => {
        if (listGrouping === "DAYS") {
            return daysSummary;
        }

        if (listGrouping === "WEEKS") {
            const weeksMap: Record<
                string,
                {
                    weekId: string;
                    label: string;
                    totalProduced: number;
                    totalSold: number;
                    bakerySalesIncome: number;
                    fiscalIncome: number;
                    daysCount: number;
                    days: DaySummary[];
                }
            > = {};

            daysSummary.forEach((day) => {
                const dObj = new Date(day.date);
                // Obliczanie numeru tygodnia
                const d = new Date(Date.UTC(dObj.getUTCFullYear(), dObj.getUTCMonth(), dObj.getUTCDate()));
                d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
                const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

                const weekId = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;

                if (!weeksMap[weekId]) {
                    weeksMap[weekId] = {
                        weekId,
                        label: `Tydzień ${weekNo} (${currentMonth})`,
                        totalProduced: 0,
                        totalSold: 0,
                        bakerySalesIncome: 0,
                        fiscalIncome: 0,
                        daysCount: 0,
                        days: [],
                    };
                }

                weeksMap[weekId].totalProduced += day.totalProduced;
                weeksMap[weekId].totalSold += day.totalSold;
                weeksMap[weekId].bakerySalesIncome += day.bakerySalesIncome;
                weeksMap[weekId].fiscalIncome += day.fiscalIncome;
                if (day.hasReport) weeksMap[weekId].daysCount++;
                weeksMap[weekId].days.push(day);
            });

            return Object.values(weeksMap);
        }

        // MONTHS
        return [
            {
                monthId: currentMonth,
                label: `${POLISH_MONTHS[parseInt(currentMonth.split("-")[1], 10) - 1]} ${currentMonth.split("-")[0]}`,
                totalProduced: stats.monthProduced,
                totalSold: stats.monthSold,
                bakerySalesIncome: stats.monthBakeryIncome,
                fiscalIncome: stats.monthFiscalIncome,
                daysWithReport: daysSummary.filter((d) => d.hasReport).length,
                missingReportsCount: stats.missingReportsCount,
            },
        ];
    }, [daysSummary, listGrouping, currentMonth, stats]);

    // -------------------------------------------------------------
    // GENEROWANIE SIATKI KALENDARZA
    // -------------------------------------------------------------
    const calendarGrid = useMemo(() => {
        const [y, m] = currentMonth.split("-").map(Number);
        const firstDayOfMonth = new Date(Date.UTC(y, m - 1, 1));
        const lastDayOfMonth = new Date(Date.UTC(y, m, 0));

        const daysInMonth = lastDayOfMonth.getUTCDate();
        // getUTCDay(): 0 = Niedziela, 1 = Poniedziałek, ..., 6 = Sobota
        const startDayOfWeek = (firstDayOfMonth.getUTCDay() + 6) % 7; // Pon = 0, ..., Nd = 6

        const cells: Array<{
            dateStr?: string;
            dayNumber?: number;
            isCurrentMonth: boolean;
            isSunday?: boolean;
            isPastOrToday?: boolean;
            dayData?: DaySummary;
        }> = [];

        // Puste komórki przed 1. dniem miesiąca
        for (let i = 0; i < startDayOfWeek; i++) {
            cells.push({ isCurrentMonth: false });
        }

        // Dni bieżącego miesiąca
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentMonth}-${String(d).padStart(2, "0")}`;
            const dObj = new Date(dateStr);
            const isSunday = dObj.getUTCDay() === 0;
            const isPastOrToday = dateStr <= todayStr;
            const dayData = daysSummary.find((item) => item.date === dateStr);

            cells.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: true,
                isSunday,
                isPastOrToday,
                dayData,
            });
        }

        return cells;
    }, [currentMonth, daysSummary, todayStr]);

    const formattedMonthName = useMemo(() => {
        const [y, m] = currentMonth.split("-").map(Number);
        return `${POLISH_MONTHS[m - 1]} ${y}`;
    }, [currentMonth]);

    const categoriesList: ProductType[] = ["BREAD", "ROLL", "SWEET", "SAVORY"];

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-24">
            {/* ========================================================= */}
            {/* GÓRNY PASEK: NAGŁÓWEK, STATYSTYKI MIESIĘCZNE, PRZYCISKI  */}
            {/* ========================================================= */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Produkcja i sprzedaż
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Przełącznik widoków: Lista / Kalendarz */}
                    <div className="flex items-center bg-ui-accent/15 p-1 rounded-xl border border-ui-accent/50">
                        <button
                            onClick={() => setViewMode("LIST")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "LIST"
                                ? "bg-ui-white text-ui-black shadow-sm"
                                : "text-ui-secondary hover:text-ui-primary"
                                }`}
                        >
                            <List size={15} />
                            Lista
                        </button>
                        <button
                            onClick={() => setViewMode("CALENDAR")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "CALENDAR"
                                ? "bg-ui-white text-ui-black shadow-sm"
                                : "text-ui-secondary hover:text-ui-primary"
                                }`}
                        >
                            <CalendarDays size={15} />
                            Kalendarz
                        </button>
                    </div>

                    {/* Nawigator Miesiąca */}
                    <div className="flex items-center gap-1 bg-ui-white border border-ui-accent rounded-xl px-2 py-1 shadow-sm">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-ui-accent/20 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            title="Poprzedni miesiąc"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-bold text-ui-black px-2 min-w-28 text-center">
                            {formattedMonthName}
                        </span>
                        <button
                            onClick={handleNextMonth}
                            className="p-1.5 hover:bg-ui-accent/20 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            title="Następny miesiąc"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Przycisk: Nowy Raport */}
                    <button
                        onClick={() => openNewReportModal(todayStr)}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                    >
                        <Plus size={18} />
                        Nowy raport
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* KARTY PODSUMOWANIA KPI (MIESIĘCZNE)                       */}
            {/* ========================================================= */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* 1. Utarg ze sprzedaży wypieków */}
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Utarg z wypieków</span>
                        <Coins size={18} className="text-amber-600" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-amber-950">
                            {stats.monthBakeryIncome.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} <span className="text-xs font-semibold">zł</span>
                        </div>
                    </div>
                </div>

                {/* 2. Utarg z kasy fiskalnej */}
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Kasa fiskalna</span>
                        <Receipt size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-emerald-950">
                            {stats.monthFiscalIncome.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} <span className="text-xs font-semibold">zł</span>
                        </div>
                    </div>
                </div>


                {/* 4. Brakujące raporty */}
                <div className={`border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-colors ${stats.missingReportsCount > 0
                    ? "bg-rose-50/50 border-rose-200"
                    : "bg-emerald-50/50 border-emerald-200"
                    }`}>
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Brakujące raporty</span>
                        {stats.missingReportsCount > 0 ? (
                            <AlertTriangle size={18} className="text-rose-600" />
                        ) : (
                            <CheckCircle2 size={18} className="text-emerald-600" />
                        )}
                    </div>
                    <div>
                        <div className={`text-2xl font-black ${stats.missingReportsCount > 0 ? "text-rose-700" : "text-emerald-800"}`}>
                            {stats.missingReportsCount} {stats.missingReportsCount === 1 ? "dzień" : "dni"}
                        </div>
                        <p className="text-[11px] text-ui-secondary mt-1">
                            {stats.missingReportsCount > 0
                                ? "Wymaga uzupełnienia w kalendarzu"
                                : "Wszystkie dni robocze uzupełnione!"}
                        </p>
                    </div>
                </div>
            </div>

            {viewMode === "LIST" && (
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 shadow-sm">
                    {/* Pasek filtrowania grupowania */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ui-secondary uppercase tracking-wider">
                                Grupowanie:
                            </span>
                            <div className="flex items-center gap-1 bg-ui-accent/15 p-1 rounded-xl">
                                <button
                                    onClick={() => setListGrouping("DAYS")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${listGrouping === "DAYS"
                                        ? "bg-ui-white text-ui-black shadow-sm"
                                        : "text-ui-secondary hover:text-ui-black"
                                        }`}
                                >
                                    Dni
                                </button>
                                <button
                                    onClick={() => setListGrouping("WEEKS")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${listGrouping === "WEEKS"
                                        ? "bg-ui-white text-ui-black shadow-sm"
                                        : "text-ui-secondary hover:text-ui-black"
                                        }`}
                                >
                                    Tygodnie
                                </button>
                                <button
                                    onClick={() => setListGrouping("MONTHS")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${listGrouping === "MONTHS"
                                        ? "bg-ui-white text-ui-black shadow-sm"
                                        : "text-ui-secondary hover:text-ui-black"
                                        }`}
                                >
                                    Miesiące
                                </button>
                            </div>
                        </div>

                        <span className="text-xs text-ui-secondary">
                            Wyświetlono {groupedListData.length} pozycji
                        </span>
                    </div>

                    {isLoadingSummary ? (
                        <div className="py-20 flex items-center justify-center gap-3 text-ui-secondary text-sm">
                            <Loader2 size={22} className="animate-spin text-amber-600" />
                            Ładowanie raportów produkcyjnych...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider text-[10px] border-b border-ui-accent">
                                        <th className="py-3 px-3">Data / Okres</th>
                                        <th className="py-3 px-3 text-right">Wyprodukowano</th>
                                        <th className="py-3 px-3 text-right">Sprzedano</th>
                                        <th className="py-3 px-3 text-right">Utarg z wypieków</th>
                                        <th className="py-3 px-3 text-right">Kasa fiskalna</th>
                                        <th className="py-3 px-3 text-right">Różnica</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/40">
                                    {listGrouping === "DAYS" &&
                                        (groupedListData as DaySummary[]).map((day) => {
                                            const dObj = new Date(day.date);
                                            const dayOfWeek = dObj.getUTCDay();
                                            const isSunday = dayOfWeek === 0;
                                            const diff = day.fiscalIncome - day.bakerySalesIncome;
                                            const efficiency =
                                                day.totalProduced > 0
                                                    ? (day.totalSold / day.totalProduced) * 100
                                                    : 0;

                                            return (
                                                <tr
                                                    key={day.date}
                                                    onClick={() => day.hasReport && openDayPreview(day.date)}
                                                    className={`hover:bg-ui-accent/5 transition-colors cursor-pointer ${!day.hasReport && !isSunday && day.date <= todayStr
                                                        ? "bg-rose-50/20"
                                                        : ""
                                                        }`}
                                                >
                                                    <td className="py-3.5 px-3">
                                                        <div className="font-bold text-ui-black text-sm">
                                                            {day.date}
                                                        </div>
                                                        <div className="text-[11px] text-ui-secondary">
                                                            {WEEKDAY_NAMES[(dayOfWeek + 6) % 7]}
                                                            {isSunday && " (Piekarnia nieczynna)"}
                                                        </div>
                                                    </td>

                                                    <td className="py-3.5 px-3 text-right font-medium text-ui-black">
                                                        {day.totalProduced > 0 ? `${day.totalProduced} szt.` : "—"}
                                                    </td>

                                                    <td className="py-3.5 px-3 text-right font-bold text-ui-black">
                                                        {day.totalSold > 0 ? (
                                                            <>
                                                                {day.totalSold} szt.{" "}
                                                                <span className="text-[10px] font-normal text-ui-secondary">
                                                                    ({efficiency.toFixed(0)}%)
                                                                </span>
                                                            </>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>

                                                    <td className="py-3.5 px-3 text-right font-bold text-amber-950">
                                                        {day.bakerySalesIncome > 0
                                                            ? `${day.bakerySalesIncome.toFixed(2)} zł`
                                                            : "—"}
                                                    </td>

                                                    <td className="py-3.5 px-3 text-right font-bold text-emerald-950">
                                                        {day.fiscalIncome > 0
                                                            ? `${day.fiscalIncome.toFixed(2)} zł`
                                                            : "—"}
                                                    </td>

                                                    <td className="py-3.5 px-3 text-right font-semibold">
                                                        {day.hasReport && day.fiscalIncome > 0 ? (
                                                            <span
                                                                className={`text-[11px] ${diff >= 0 ? "text-emerald-700" : "text-rose-700"
                                                                    }`}
                                                            >
                                                                {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} zł
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                    {listGrouping === "WEEKS" &&
                                        (groupedListData as any[]).map((week) => {
                                            const diff = week.fiscalIncome - week.bakerySalesIncome;
                                            return (
                                                <tr key={week.weekId} className="hover:bg-ui-accent/5 transition-colors">
                                                    <td className="py-3.5 px-3">
                                                        <div className="font-bold text-ui-black text-sm">{week.label}</div>
                                                        <div className="text-[11px] text-ui-secondary">
                                                            Raportów w tygodniu: {week.daysCount} / 6
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-3 text-right font-medium text-ui-black">
                                                        {week.totalProduced} szt.
                                                    </td>
                                                    <td className="py-3.5 px-3 text-right font-bold text-ui-black">
                                                        {week.totalSold} szt.
                                                    </td>
                                                    <td className="py-3.5 px-3 text-right font-bold text-amber-950">
                                                        {week.bakerySalesIncome.toFixed(2)} zł
                                                    </td>
                                                    <td className="py-3.5 px-3 text-right font-bold text-emerald-950">
                                                        {week.fiscalIncome.toFixed(2)} zł
                                                    </td>
                                                    <td className="py-3.5 px-3 text-right font-semibold">
                                                        <span className={diff >= 0 ? "text-emerald-700" : "text-rose-700"}>
                                                            {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} zł
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-3 text-center">
                                                        <span className="text-[11px] font-bold text-ui-secondary">
                                                            {week.daysCount === 6 ? "Komplet" : `${week.daysCount}/6 dni`}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-3 text-center text-ui-secondary text-[11px]">
                                                        Zestawienie tygodniowe
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                    {listGrouping === "MONTHS" &&
                                        (groupedListData as any[]).map((mItem) => (
                                            <tr key={mItem.monthId} className="hover:bg-ui-accent/5 transition-colors">
                                                <td className="py-4 px-3 font-bold text-ui-black text-base">
                                                    {mItem.label}
                                                </td>
                                                <td className="py-4 px-3 text-right font-medium text-ui-black text-sm">
                                                    {mItem.totalProduced} szt.
                                                </td>
                                                <td className="py-4 px-3 text-right font-bold text-ui-black text-sm">
                                                    {mItem.totalSold} szt.
                                                </td>
                                                <td className="py-4 px-3 text-right font-black text-amber-950 text-sm">
                                                    {mItem.bakerySalesIncome.toFixed(2)} zł
                                                </td>
                                                <td className="py-4 px-3 text-right font-black text-emerald-950 text-sm">
                                                    {mItem.fiscalIncome.toFixed(2)} zł
                                                </td>
                                                <td className="py-4 px-3 text-right font-bold text-xs">
                                                    {(mItem.fiscalIncome - mItem.bakerySalesIncome).toFixed(2)} zł
                                                </td>
                                                <td className="py-4 px-3 text-center">
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                                                        {mItem.daysWithReport} dni z raportem
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================= */}
            {/* WIDOK 2: KALENDARZ MIESIĘCZNY                            */}
            {/* ========================================================= */}
            {viewMode === "CALENDAR" && (
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 shadow-sm">
                    {/* Nagłówki Dni Tygodnia */}
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-ui-secondary uppercase tracking-wider">
                        {SHORT_WEEKDAYS.map((wd, i) => (
                            <div key={wd} className={`py-2 rounded-lg ${i === 6 ? "text-ui-secondary/50" : ""}`}>
                                {wd}
                            </div>
                        ))}
                    </div>

                    {/* Siatka Komórek Kalendarza */}
                    <div className="grid grid-cols-7 gap-2">
                        {calendarGrid.map((cell, idx) => {
                            if (!cell.isCurrentMonth) {
                                return (
                                    <div
                                        key={`empty-${idx}`}
                                        className="h-28 sm:h-32 rounded-xl bg-ui-accent/5 border border-dashed border-ui-accent/30 opacity-30"
                                    />
                                );
                            }

                            const hasData = cell.dayData && cell.dayData.hasReport;
                            const isMissing = !hasData && cell.isPastOrToday && !cell.isSunday;

                            return (
                                <div
                                    key={cell.dateStr}
                                    onClick={() => {
                                        if (hasData) {
                                            openDayPreview(cell.dateStr!);
                                        } else if (cell.isPastOrToday && !cell.isSunday) {
                                            openNewReportModal(cell.dateStr);
                                        }
                                    }}
                                    className={`h-28 sm:h-32 rounded-xl p-2.5 border flex flex-col justify-between transition-all duration-200 cursor-pointer relative group ${hasData
                                        ? "bg-ui-white border-amber-300/80 hover:border-amber-500 hover:shadow-md"
                                        : isMissing
                                            ? "bg-rose-50/50 border-rose-300 hover:border-rose-500 hover:bg-rose-50"
                                            : cell.isSunday
                                                ? "bg-ui-accent/10 border-ui-accent/40 opacity-60 cursor-default"
                                                : "bg-ui-white border-ui-accent/60 opacity-60"
                                        }`}
                                >
                                    {/* Górny pasek komórki: numer dnia + badge */}
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={`text-xs sm:text-sm font-black ${cell.dateStr === todayStr
                                                ? "w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-sm"
                                                : "text-ui-black"
                                                }`}
                                        >
                                            {cell.dayNumber}
                                        </span>

                                        {hasData ? (
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Raport wprowadzony" />
                                        ) : isMissing ? (
                                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                                Brak!
                                            </span>
                                        ) : cell.isSunday ? (
                                            <span className="text-[9px] font-bold text-ui-secondary">Nd</span>
                                        ) : null}
                                    </div>

                                    {/* Środek / Dół komórki */}
                                    {hasData ? (
                                        <div className="space-y-0.5 mt-1 text-left">
                                            <div className="text-[10px] sm:text-xs font-bold text-amber-950 truncate">
                                                Wypieki: <b>{cell.dayData!.bakerySalesIncome.toFixed(0)} zł</b>
                                            </div>
                                            <div className="text-[10px] sm:text-xs font-bold text-emerald-950 truncate">
                                                Kasa: <b>{cell.dayData!.fiscalIncome.toFixed(0)} zł</b>
                                            </div>
                                            <div className="text-[9px] text-ui-secondary hidden sm:block">
                                                {cell.dayData!.totalSold} / {cell.dayData!.totalProduced} szt.
                                            </div>
                                        </div>
                                    ) : isMissing ? (
                                        <div className="text-center py-1">
                                            <span className="text-[11px] font-bold text-rose-700 block group-hover:underline">
                                                + Uzupełnij
                                            </span>
                                        </div>
                                    ) : cell.isSunday ? (
                                        <div className="text-[10px] text-ui-secondary/70 italic text-center">
                                            Nieczynne
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-ui-secondary/50 text-center">
                                            Brak danych
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 1: FORMULARZ RAPORTU (Nowy raport / Edycja)        */}
            {/* ========================================================= */}
            {isFormModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsFormModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Nagłówek Modalu */}
                        <div className="p-5 border-b border-ui-accent bg-amber-50/60 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 text-amber-900 rounded-xl">
                                    <Edit3 size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-ui-black">
                                        Raport dzienny
                                    </h2>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsFormModalOpen(false)}
                                className="p-1.5 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Pasek Wyboru Daty i Utargu z Kasy Fiskalnej */}
                        <div className="p-5 border-b border-ui-accent/60 bg-ui-accent/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Wybór daty */}
                            <div>
                                <label className="block text-xs font-bold text-ui-black uppercase tracking-wider mb-1.5">
                                    Data raportu:
                                </label>
                                <div className="flex items-center gap-2 bg-ui-white border border-ui-accent rounded-xl px-3 py-2 shadow-sm">
                                    <CalendarIcon size={16} className="text-amber-800" />
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={(e) => {
                                            const newDate = e.target.value;
                                            setFormDate(newDate);
                                            loadReportForDate(newDate);
                                        }}
                                        className="w-full bg-transparent font-extrabold text-sm text-ui-black focus:outline-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Utarg z kasy fiskalnej */}
                            <div>
                                <label className="block text-xs font-bold text-ui-black uppercase tracking-wider mb-1.5">
                                    Utarg z kasy fiskalnej (PLN):
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="np. 3450.00"
                                        value={formFiscalIncome}
                                        onChange={(e) => setFormFiscalIncome(e.target.value)}
                                        className="w-full h-10 border border-ui-accent rounded-xl pl-3.5 pr-12 text-sm font-extrabold text-ui-black bg-ui-white focus:outline-none focus:border-emerald-600 shadow-sm"
                                    />
                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ui-secondary pointer-events-none">
                                        zł brutto
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Podsumowanie Live w Formularzu */}
                        <div className="bg-emerald-50/50 border-b border-emerald-200/60 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-4">
                                <span>
                                    Wyprodukowano: <b>{formLiveStats.totalProduced} szt.</b>
                                </span>
                                <span>
                                    Sprzedano: <b>{formLiveStats.totalSold} szt.</b>
                                </span>
                                <span>
                                    Utarg wypieki: <b>{formLiveStats.estimatedBakeryIncome.toFixed(2)} zł</b>
                                </span>
                            </div>
                            {formLiveStats.fiscalVal > 0 && (
                                <div className="font-bold">
                                    Różnica (Kasa - Wypieki):{" "}
                                    <span
                                        className={
                                            formLiveStats.diff >= 0 ? "text-emerald-700" : "text-rose-700"
                                        }
                                    >
                                        {formLiveStats.diff >= 0
                                            ? `+${formLiveStats.diff.toFixed(2)}`
                                            : formLiveStats.diff.toFixed(2)}{" "}
                                        zł
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Zawartość Formularza: Lista Wyrobów z Podziałem na Kategorie */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-6">
                            {isLoadingFormData ? (
                                <div className="py-20 flex items-center justify-center gap-3 text-ui-secondary text-sm">
                                    <Loader2 size={22} className="animate-spin text-amber-600" />
                                    Wczytywanie wyrobów i danych dla dnia {formDate}...
                                </div>
                            ) : (
                                categoriesList.map((catKey) => {
                                    const catMeta = CATEGORY_MAP[catKey];
                                    const Icon = catMeta.icon;
                                    const catProducts = allProducts.filter((p) => p.type === catKey);

                                    if (catProducts.length === 0) return null;

                                    return (
                                        <div key={catKey} className="border border-ui-accent rounded-xl overflow-hidden shadow-sm">
                                            {/* Nagłówek kategorii */}
                                            <div className="bg-ui-accent/20 px-4 py-2.5 flex items-center gap-2 border-b border-ui-accent">
                                                <Icon size={16} className="text-amber-900" />
                                                <h3 className="text-xs font-extrabold uppercase tracking-wider text-ui-black">
                                                    {catMeta.label} ({catProducts.length})
                                                </h3>
                                            </div>

                                            {/* Tabela wyrobów w kategorii */}
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="border-b border-ui-accent/60 text-ui-secondary font-bold uppercase text-[9px]">
                                                        <th className="py-2.5 px-3">Wyrób & Cena</th>
                                                        <th className="py-2.5 px-3 text-center w-28">Wyprodukowano</th>
                                                        <th className="py-2.5 px-3 text-center w-28">Sprzedano</th>
                                                        <th className="py-2.5 px-3 text-left w-48">
                                                            Godzina wyprzedania (100%)
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-ui-accent/40">
                                                    {catProducts.map((prod) => {
                                                        const item = formItems[prod.id] || {
                                                            bakeryProductId: prod.id,
                                                            producedAmount: "",
                                                            soldAmount: "",
                                                            soldOutTime: "",
                                                        };

                                                        const prodAmt = parseInt(item.producedAmount, 10) || 0;
                                                        const soldAmt = parseInt(item.soldAmount, 10) || 0;
                                                        const isSoldOut = prodAmt > 0 && soldAmt === prodAmt;

                                                        return (
                                                            <tr key={prod.id} className="hover:bg-ui-accent/5 transition-colors">
                                                                <td className="py-3 px-3">
                                                                    <div className="font-bold text-ui-black text-sm">
                                                                        {prod.name}
                                                                    </div>
                                                                    <div className="text-[11px] text-ui-secondary">
                                                                        Cena: <b>{Number(prod.sellingPrice || 0).toFixed(2)} zł</b>
                                                                    </div>
                                                                </td>

                                                                {/* Wyprodukowano */}
                                                                <td className="py-3 px-3 text-center">
                                                                    <div className="relative inline-block w-24">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            placeholder="0"
                                                                            value={item.producedAmount}
                                                                            onChange={(e) =>
                                                                                handleFormItemChange(
                                                                                    prod.id,
                                                                                    "producedAmount",
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            className="w-full bg-amber-50/50 border border-amber-300 rounded-lg px-2 py-1.5 text-center font-extrabold text-sm text-amber-950 focus:outline-none focus:border-amber-600"
                                                                        />
                                                                        <span className="absolute right-2 top-2 text-[10px] text-amber-900/60 pointer-events-none font-bold">
                                                                            szt
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                {/* Sprzedano */}
                                                                <td className="py-3 px-3 text-center">
                                                                    <div className="relative inline-block w-24">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            placeholder="0"
                                                                            value={item.soldAmount}
                                                                            onChange={(e) =>
                                                                                handleFormItemChange(
                                                                                    prod.id,
                                                                                    "soldAmount",
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            className="w-full bg-emerald-50/50 border border-emerald-300 rounded-lg px-2 py-1.5 text-center font-extrabold text-sm text-emerald-950 focus:outline-none focus:border-emerald-600"
                                                                        />
                                                                        <span className="absolute right-2 top-2 text-[10px] text-emerald-900/60 pointer-events-none font-bold">
                                                                            szt
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                {/* Godzina wyprzedania */}
                                                                <td className="py-3 px-3">
                                                                    {isSoldOut ? (
                                                                        <div className="flex items-center gap-1.5 animate-fade-in">
                                                                            <Clock size={14} className="text-emerald-700 shrink-0" />
                                                                            <input
                                                                                type="time"
                                                                                value={item.soldOutTime}
                                                                                onChange={(e) =>
                                                                                    handleFormItemChange(
                                                                                        prod.id,
                                                                                        "soldOutTime",
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                className="w-24 bg-emerald-100/70 border border-emerald-400 text-emerald-950 font-bold text-xs rounded-lg px-2 py-1 focus:outline-none"
                                                                            />
                                                                            <span className="text-[10px] font-bold text-emerald-800">
                                                                                Wyprzedano!
                                                                            </span>
                                                                        </div>
                                                                    ) : prodAmt > 0 && soldAmt < prodAmt ? (
                                                                        <span className="text-[11px] text-ui-secondary font-medium">
                                                                            Zostało: <b>{prodAmt - soldAmt} szt.</b>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[11px] text-ui-secondary/50 italic">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Stopka Formularza */}
                        <div className="p-4 border-t border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                            <button
                                onClick={() => setIsFormModalOpen(false)}
                                className="px-4 py-2 rounded-xl border border-ui-accent text-ui-secondary hover:text-ui-primary font-semibold text-xs transition-colors cursor-pointer"
                            >
                                Anuluj
                            </button>

                            <button
                                onClick={handleSaveReportForm}
                                disabled={isSavingForm || isLoadingFormData}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer ${formSaveSuccess
                                    ? "bg-emerald-700 text-white"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                                    }`}
                            >
                                {isSavingForm ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Zapisywanie raportu...
                                    </>
                                ) : formSaveSuccess ? (
                                    <>
                                        <Check size={16} />
                                        Zapisano pomyślnie!
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Zapisz Raport Dzienny
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 2: SZCZEGÓŁOWY PODGLĄD DNIA                         */}
            {/* ========================================================= */}
            {previewDate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setPreviewDate(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Nagłówek Podglądu */}
                        <div className="p-5 border-b border-ui-accent bg-amber-50/60 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-ui-black">
                                    Raport Dzienny: {previewDate}
                                </h2>
                                <p className="text-xs text-ui-secondary">
                                    Szczegółowe ilości wyrobów, godziny wyprzedania oraz zestawienie utargów
                                </p>
                            </div>
                            <button
                                onClick={() => setPreviewDate(null)}
                                className="p-1.5 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Zawartość Podglądu */}
                        {previewLoading || !previewData ? (
                            <div className="p-16 flex items-center justify-center gap-3 text-ui-secondary text-sm">
                                <Loader2 size={22} className="animate-spin text-amber-600" />
                                Ładowanie szczegółów dnia...
                            </div>
                        ) : (
                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* Kafelki Finansowe Dnia */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                                        <div className="text-[10px] font-bold uppercase text-amber-800">
                                            Utarg z wypieków
                                        </div>
                                        <div className="text-xl font-black text-amber-950 mt-0.5">
                                            {previewData.productions
                                                .reduce((acc: number, item: any) => {
                                                    const prod = previewData.products.find((p) => p.id === item.bakeryProductId);
                                                    return acc + (item.soldAmount || 0) * Number(prod?.sellingPrice || 0);
                                                }, 0)
                                                .toFixed(2)}{" "}
                                            zł
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                                        <div className="text-[10px] font-bold uppercase text-emerald-800">
                                            Kasa fiskalna
                                        </div>
                                        <div className="text-xl font-black text-emerald-950 mt-0.5">
                                            {previewData.fiscalIncome.toFixed(2)} zł
                                        </div>
                                    </div>

                                    <div className="bg-ui-accent/10 border border-ui-accent/40 rounded-xl p-3.5">
                                        <div className="text-[10px] font-bold uppercase text-ui-secondary">
                                            Różnica (Kasa vs Wypieki)
                                        </div>
                                        {(() => {
                                            const bakerySum = previewData.productions.reduce((acc: number, item: any) => {
                                                const prod = previewData.products.find((p) => p.id === item.bakeryProductId);
                                                return acc + (item.soldAmount || 0) * Number(prod?.sellingPrice || 0);
                                            }, 0);
                                            const diff = previewData.fiscalIncome - bakerySum;
                                            return (
                                                <div
                                                    className={`text-xl font-black mt-0.5 ${diff >= 0 ? "text-emerald-700" : "text-rose-700"
                                                        }`}
                                                >
                                                    {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} zł
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Tabela Wyrobów w danym dniu */}
                                <div className="border border-ui-accent rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-ui-accent/20 text-ui-secondary font-bold uppercase text-[10px] border-b border-ui-accent">
                                                <th className="py-2.5 px-3">Wyrób</th>
                                                <th className="py-2.5 px-3 text-right">Wyprodukowano</th>
                                                <th className="py-2.5 px-3 text-right">Sprzedano</th>
                                                <th className="py-2.5 px-3 text-right">Niesprzedane</th>
                                                <th className="py-2.5 px-3 text-center">Godzina wyprzedania</th>
                                                <th className="py-2.5 px-3 text-right">Wartość sprzedaży</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-ui-accent/40">
                                            {previewData.products.map((prod) => {
                                                const item = previewData.productions.find(
                                                    (p: any) => p.bakeryProductId === prod.id
                                                );
                                                const produced = item ? item.producedAmount : 0;
                                                const sold = item ? item.soldAmount : 0;
                                                const unsold = produced - sold;
                                                const soldOutTime = previewData.soldOutTimes[prod.id];
                                                const value = sold * Number(prod.sellingPrice || 0);

                                                if (produced === 0 && sold === 0) return null;

                                                return (
                                                    <tr key={prod.id} className="hover:bg-ui-accent/5 transition-colors">
                                                        <td className="py-3 px-3 font-bold text-ui-black">
                                                            {prod.name}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-amber-950 font-semibold">
                                                            {produced} szt.
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-emerald-950 font-bold">
                                                            {sold} szt.
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-rose-700 font-medium">
                                                            {unsold > 0 ? `-${unsold} szt.` : "0"}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            {soldOutTime ? (
                                                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                                                                    <Clock size={12} />
                                                                    {soldOutTime}
                                                                </span>
                                                            ) : produced > 0 && unsold === 0 ? (
                                                                <span className="text-emerald-700 text-[11px] font-semibold">
                                                                    Wyprzedano
                                                                </span>
                                                            ) : (
                                                                <span className="text-ui-secondary/40 text-[11px]">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-extrabold text-ui-black">
                                                            {value.toFixed(2)} zł
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Stopka Podglądu z Przyciskiem Edycji */}
                        <div className="p-4 border-t border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                            <button
                                onClick={() => setPreviewDate(null)}
                                className="px-4 py-2 rounded-xl border border-ui-accent text-ui-secondary hover:text-ui-primary font-semibold text-xs transition-colors cursor-pointer"
                            >
                                Zamknij
                            </button>

                            <button
                                onClick={() => {
                                    const dateToEdit = previewDate!;
                                    setPreviewDate(null);
                                    openNewReportModal(dateToEdit);
                                }}
                                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                            >
                                <Edit3 size={15} />
                                Edytuj ten raport
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}