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
    ChevronDown,
    ChevronUp,
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
    Search,
    ShoppingBag,
    Boxes,
    Percent,
    Copy,
    ArrowRight,
    CheckCheck,
    Info,
    Calendar,
    Flame
} from "lucide-react";

type ProductType = "BREAD" | "ROLL" | "SWEET" | "SAVORY";
type ListGroupingType = "DAYS" | "WEEKS" | "MONTHS" | "PRODUCTS";

interface BakeryProduct {
    id: string;
    name: string;
    type: ProductType;
    productionCost: number | string;
    sellingPrice: number | string;
}

interface DayProductItem {
    productId: string;
    productName: string;
    productType: string;
    sellingPrice: number;
    producedAmount: number;
    soldAmount: number;
    salesIncome: number;
    soldOutTime?: string;
}

interface DaySummary {
    date: string;
    totalProduced: number;
    totalSold: number;
    bakerySalesIncome: number;
    fiscalIncome: number;
    hasReport: boolean;
    productsCount: number;
    products?: DayProductItem[];
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

interface AggregatedProduct {
    productId: string;
    productName: string;
    productType: string;
    sellingPrice: number;
    producedAmount: number;
    soldAmount: number;
    salesIncome: number;
    sellThroughRate: number;
}

interface WeekSummary {
    weekId: string;
    label: string;
    startDate: string;
    endDate: string;
    totalProduced: number;
    totalSold: number;
    bakerySalesIncome: number;
    fiscalIncome: number;
    daysCount: number;
    days: DaySummary[];
    products: AggregatedProduct[];
}

interface MonthGroupSummary {
    monthId: string;
    label: string;
    totalProduced: number;
    totalSold: number;
    bakerySalesIncome: number;
    fiscalIncome: number;
    daysWithReport: number;
    missingReportsCount: number;
    products: AggregatedProduct[];
}

// -------------------------------------------------------------
// INTERFEJSY DLA ALGORYTMU SUGEROWANEGO PLANU PRODUKCJI
// -------------------------------------------------------------
interface PlanHistoryWeek {
    weekLabel: string;
    date: string;
    hasData: boolean;
    fiscalIncome: number;
    bakeryIncome: number;
    effectiveIncome: number;
    isAnomaly: boolean;
    anomalyReason?: string;
    weight: number;
}

interface PlanProductHistoryItem {
    weekLabel: string;
    dateStr: string;
    producedAmount: number;
    soldAmount: number;
    soldOutTime?: string;
    unmetMultiplier: number;
    adjustmentReason: string;
    adjustedDemand: number;
    weight: number;
    contribution: number;
    isAnomaly: boolean;
}

interface PlanProductSuggestion {
    id: string;
    name: string;
    type: ProductType;
    sellingPrice: number;
    productionCost: number;
    suggestedAmount: number;
    rawDemand: number;
    history: PlanProductHistoryItem[];
}

interface PlanApiResponse {
    targetDate: string;
    dayOfWeek: number;
    dayName: string;
    isClosed: boolean;
    message?: string;
    dataQuality?: {
        availableWeeksCount: number;
        hasFullHistory: boolean;
        warningMessage: string | null;
        averageHistoricalIncome: number;
        anomaliesCount: number;
        anomalies: Array<{
            date: string;
            weekLabel: string;
            income: number;
            deviationPercent: number;
            reason: string;
        }>;
    };
    historicalWeeks?: PlanHistoryWeek[];
    totals?: {
        totalUnits: number;
        estimatedRevenue: number;
        estimatedProductionCost: number;
        estimatedProfit: number;
        productsCount: number;
    };
    suggestions: PlanProductSuggestion[];
}

const CATEGORY_MAP: Record<ProductType, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    BREAD: { label: "Chleby", icon: Wheat },
    ROLL: { label: "Bułki", icon: Layers },
    SWEET: { label: "Słodkie Wypieki", icon: Croissant },
    SAVORY: { label: "Słone Wypieki", icon: Pizza },
};

const POLISH_MONTHS = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

const WEEKDAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const SHORT_WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

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

export default function ProdukcjaPage() {
    const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
    const tomorrowStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split("T")[0];
    }, []);

    const [currentMonth, setCurrentMonth] = useState<string>(todayStr.slice(0, 7)); // "YYYY-MM"

    // Widoki: "LIST" | "CALENDAR"
    const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");
    // Grupowanie na liście: "DAYS" | "WEEKS" | "MONTHS" | "PRODUCTS"
    const [listGrouping, setListGrouping] = useState<ListGroupingType>("DAYS");

    const [daysSummary, setDaysSummary] = useState<DaySummary[]>([]);
    const [monthlyProductsData, setMonthlyProductsData] = useState<AggregatedProduct[]>([]);
    const [stats, setStats] = useState<MonthStats>({
        monthProduced: 0,
        monthSold: 0,
        monthBakeryIncome: 0,
        monthFiscalIncome: 0,
        missingReportsCount: 0,
        totalDaysInMonth: 30,
    });
    const [isLoadingSummary, setIsLoadingSummary] = useState(true);

    // Stan rozwiniętych wierszy akordeonu
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [productSearch, setProductSearch] = useState("");
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");

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
    // MODAL SUGEROWANEGO PLANU PRODUKCJI
    // -------------------------------------------------------------
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [planDate, setPlanDate] = useState<string>(tomorrowStr);
    const [planData, setPlanData] = useState<PlanApiResponse | null>(null);
    const [isLoadingPlan, setIsLoadingPlan] = useState(false);
    const [planSearch, setPlanSearch] = useState("");
    const [planCategoryFilter, setPlanCategoryFilter] = useState<string>("ALL");
    const [expandedPlanProducts, setExpandedPlanProducts] = useState<Record<string, boolean>>({});
    const [isPlanCopied, setIsPlanCopied] = useState(false);

    // -------------------------------------------------------------
    // MODAL SZCZEGÓŁOWEGO PODGLĄDU OKRESU (Dzień / Tydzień / Miesiąc)
    // -------------------------------------------------------------
    const [periodPreviewModal, setPeriodPreviewModal] = useState<{
        isOpen: boolean;
        title: string;
        subtitle: string;
        products: AggregatedProduct[];
        totalProduced: number;
        totalSold: number;
        bakeryIncome: number;
        fiscalIncome: number;
    } | null>(null);

    const toggleRow = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const togglePlanProduct = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedPlanProducts((prev) => ({ ...prev, [id]: !prev[id] }));
    };

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
                setMonthlyProductsData(data.monthlyProducts || []);
                if (data.stats) {
                    setStats(data.stats);
                }
                if (data.products) {
                    setAllProducts(data.products);
                }
            }
        } catch (error) {
            console.error("Błąd ładowania podsumowania produkcji:", error);
        } finally {
            setIsLoadingSummary(false);
        }
    };

    useEffect(() => {
        fetchSummary(currentMonth);
    }, [currentMonth]);

    // Nawigacja po miesiącach
    const handlePrevMonth = () => {
        const [yStr, mStr] = currentMonth.split("-");
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) - 1;
        if (m === 0) {
            m = 12;
            y -= 1;
        }
        setCurrentMonth(`${y}-${String(m).padStart(2, "0")}`);
    };

    const handleNextMonth = () => {
        const [yStr, mStr] = currentMonth.split("-");
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) + 1;
        if (m === 13) {
            m = 1;
            y += 1;
        }
        setCurrentMonth(`${y}-${String(m).padStart(2, "0")}`);
    };

    // -------------------------------------------------------------
    // OBSŁUGA FORMULARZA RAPORTU DZIENNEGO
    // -------------------------------------------------------------
    const openNewReportModal = async (defaultDate?: string, prefillProducedMap?: Record<string, number>) => {
        const dateToUse = defaultDate || todayStr;
        setFormDate(dateToUse);
        setIsFormModalOpen(true);
        setIsLoadingFormData(true);
        setFormSaveSuccess(false);

        try {
            const res = await fetch(`/api/produkcja?date=${dateToUse}`);
            if (res.ok) {
                const data = await res.json();
                setAllProducts(data.products || []);

                setFormFiscalIncome(data.fiscalIncome > 0 ? String(data.fiscalIncome) : "");

                const itemsMap: Record<string, ProductionDetailItem> = {};
                (data.products || []).forEach((prod: BakeryProduct) => {
                    const existingProd = (data.productions || []).find(
                        (p: any) => p.bakeryProductId === prod.id
                    );

                    let initProduced = "";
                    if (existingProd && existingProd.producedAmount > 0) {
                        initProduced = String(existingProd.producedAmount);
                    } else if (prefillProducedMap && prefillProducedMap[prod.id] !== undefined) {
                        initProduced = String(prefillProducedMap[prod.id]);
                    }

                    itemsMap[prod.id] = {
                        bakeryProductId: prod.id,
                        producedAmount: initProduced,
                        soldAmount: existingProd && existingProd.soldAmount > 0 ? String(existingProd.soldAmount) : "",
                        soldOutTime: data.soldOutTimes?.[prod.id] || existingProd?.soldOutTime || "",
                    };
                });
                setFormItems(itemsMap);
            }
        } catch (error) {
            console.error("Błąd podczas ładowania danych formularza:", error);
        } finally {
            setIsLoadingFormData(false);
        }
    };

    const handleFormItemChange = (
        productId: string,
        field: keyof ProductionDetailItem,
        value: string
    ) => {
        setFormItems((prev) => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [field]: value,
            },
        }));
    };

    const handleSaveReportForm = async () => {
        setIsSavingForm(true);
        setFormSaveSuccess(false);

        const itemsPayload = Object.values(formItems).map((it) => ({
            bakeryProductId: it.bakeryProductId,
            producedAmount: parseInt(it.producedAmount, 10) || 0,
            soldAmount: parseInt(it.soldAmount, 10) || 0,
            soldOutTime: it.soldOutTime || null,
        }));

        const fiscalVal = parseFloat(formFiscalIncome.replace(",", ".")) || 0;

        try {
            const res = await fetch("/api/produkcja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: formDate,
                    items: itemsPayload,
                    fiscalIncome: fiscalVal,
                }),
            });

            if (res.ok) {
                setFormSaveSuccess(true);
                setTimeout(() => {
                    setIsFormModalOpen(false);
                    setFormSaveSuccess(false);
                    fetchSummary(currentMonth);
                }, 800);
            }
        } catch (error) {
            console.error("Błąd podczas zapisu raportu:", error);
        } finally {
            setIsSavingForm(false);
        }
    };

    // -------------------------------------------------------------
    // OBSŁUGA SUGEROWANEGO PLANU PRODUKCJI
    // -------------------------------------------------------------
    const fetchProductionPlan = async (targetDate: string) => {
        setIsLoadingPlan(true);
        setIsPlanCopied(false);
        try {
            const res = await fetch(`/api/produkcja/plan?date=${targetDate}`);
            if (res.ok) {
                const data = await res.json();
                setPlanData(data);
            }
        } catch (error) {
            console.error("Błąd pobierania planu produkcji:", error);
        } finally {
            setIsLoadingPlan(false);
        }
    };

    const openProductionPlanModal = (targetDate?: string) => {
        const dateToUse = targetDate || planDate || tomorrowStr;
        setPlanDate(dateToUse);
        setIsPlanModalOpen(true);
        fetchProductionPlan(dateToUse);
    };

    const handleApplyPlanToReport = () => {
        if (!planData || planData.isClosed || !planData.suggestions) return;
        const prefillMap: Record<string, number> = {};
        planData.suggestions.forEach((s) => {
            if (s.suggestedAmount > 0) {
                prefillMap[s.id] = s.suggestedAmount;
            }
        });
        setIsPlanModalOpen(false);
        openNewReportModal(planData.targetDate, prefillMap);
    };

    const handleCopyPlanToClipboard = () => {
        if (!planData || !planData.suggestions) return;
        let text = `PLAN PRODUKCJI NA DZIEŃ: ${formatDate(planData.targetDate)} (${planData.dayName.toUpperCase()})\n`;
        text += `Łącznie sztuk do wypieku: ${planData.totals?.totalUnits || 0} szt.\n`;
        text += `Szacowany utarg: ${formatCurrency(planData.totals?.estimatedRevenue || 0)}\n\n`;
        text += `LISTA WYROBÓW:\n`;
        text += `------------------------------------\n`;

        planData.suggestions
            .filter((s) => s.suggestedAmount > 0)
            .forEach((s, idx) => {
                const cat = CATEGORY_MAP[s.type]?.label || s.type;
                text += `${idx + 1}. ${s.name} [${cat}]: ${s.suggestedAmount} szt. (Cena: ${s.sellingPrice.toFixed(2)} zł)\n`;
            });

        navigator.clipboard.writeText(text);
        setIsPlanCopied(true);
        setTimeout(() => setIsPlanCopied(false), 2500);
    };

    // -------------------------------------------------------------
    // GRUPOWANIE DANYCH DLA LISTY (DNI / TYGODNIE / MIESIĄCE / WYROBY)
    // -------------------------------------------------------------
    const weeksList = useMemo<WeekSummary[]>(() => {
        const weeksMap: Record<string, WeekSummary> = {};

        daysSummary.forEach((day) => {
            const dObj = new Date(day.date);
            const d = new Date(Date.UTC(dObj.getUTCFullYear(), dObj.getUTCMonth(), dObj.getUTCDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

            const weekId = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;

            if (!weeksMap[weekId]) {
                const weekStart = new Date(day.date);
                const dayOfWeek = (weekStart.getUTCDay() + 6) % 7; // 0 = Poniedziałek
                weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
                const weekEnd = new Date(weekStart);
                weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

                weeksMap[weekId] = {
                    weekId,
                    label: `Tydzień ${weekNo} (${currentMonth})`,
                    startDate: weekStart.toISOString().split("T")[0],
                    endDate: weekEnd.toISOString().split("T")[0],
                    totalProduced: 0,
                    totalSold: 0,
                    bakerySalesIncome: 0,
                    fiscalIncome: 0,
                    daysCount: 0,
                    days: [],
                    products: [],
                };
            }

            weeksMap[weekId].totalProduced += day.totalProduced;
            weeksMap[weekId].totalSold += day.totalSold;
            weeksMap[weekId].bakerySalesIncome += day.bakerySalesIncome;
            weeksMap[weekId].fiscalIncome += day.fiscalIncome;
            if (day.hasReport) weeksMap[weekId].daysCount++;
            weeksMap[weekId].days.push(day);
        });

        return Object.values(weeksMap).map((week) => {
            const prodAggMap = new Map<string, AggregatedProduct>();

            week.days.forEach((day) => {
                day.products?.forEach((p) => {
                    const existing = prodAggMap.get(p.productId) || {
                        productId: p.productId,
                        productName: p.productName,
                        productType: p.productType,
                        sellingPrice: p.sellingPrice,
                        producedAmount: 0,
                        soldAmount: 0,
                        salesIncome: 0,
                        sellThroughRate: 0,
                    };
                    existing.producedAmount += p.producedAmount;
                    existing.soldAmount += p.soldAmount;
                    existing.salesIncome += p.salesIncome;
                    prodAggMap.set(p.productId, existing);
                });
            });

            const productsList = Array.from(prodAggMap.values()).map((p) => ({
                ...p,
                sellThroughRate: p.producedAmount > 0 ? Math.round((p.soldAmount / p.producedAmount) * 1000) / 10 : 0,
            })).sort((a, b) => b.soldAmount - a.soldAmount);

            return {
                ...week,
                products: productsList,
            };
        });
    }, [daysSummary, currentMonth]);

    const monthsList = useMemo<MonthGroupSummary[]>(() => {
        const monthProdList = [...monthlyProductsData].sort((a, b) => b.soldAmount - a.soldAmount);

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
                products: monthProdList,
            },
        ];
    }, [currentMonth, stats, daysSummary, monthlyProductsData]);

    // Filtrowana lista produktów dla zakładki "PRODUCTS"
    const filteredProductsRanking = useMemo(() => {
        let list = [...monthlyProductsData];

        if (selectedCategoryFilter !== "ALL") {
            list = list.filter((p) => p.productType === selectedCategoryFilter);
        }

        if (productSearch.trim()) {
            const q = productSearch.toLowerCase();
            list = list.filter((p) => p.productName.toLowerCase().includes(q));
        }

        return list.sort((a, b) => b.soldAmount - a.soldAmount);
    }, [monthlyProductsData, selectedCategoryFilter, productSearch]);

    // Filtrowana lista produktów w modalu sugerowanego planu
    const filteredPlanSuggestions = useMemo(() => {
        if (!planData || !planData.suggestions) return [];
        let list = [...planData.suggestions];

        if (planCategoryFilter !== "ALL") {
            list = list.filter((p) => p.type === planCategoryFilter);
        }

        if (planSearch.trim()) {
            const q = planSearch.toLowerCase();
            list = list.filter((p) => p.name.toLowerCase().includes(q));
        }

        return list;
    }, [planData, planCategoryFilter, planSearch]);

    // -------------------------------------------------------------
    // GENEROWANIE SIATKI KALENDARZA
    // -------------------------------------------------------------
    const calendarGrid = useMemo(() => {
        const [y, m] = currentMonth.split("-").map(Number);
        const firstDayOfMonth = new Date(Date.UTC(y, m - 1, 1));
        const lastDayOfMonth = new Date(Date.UTC(y, m, 0));

        const daysInMonth = lastDayOfMonth.getUTCDate();
        const startDayOfWeek = (firstDayOfMonth.getUTCDay() + 6) % 7; // Pon = 0, ..., Nd = 6

        const cells: Array<{
            dateStr?: string;
            dayNumber?: number;
            isCurrentMonth: boolean;
            isSunday?: boolean;
            isPastOrToday?: boolean;
            dayData?: DaySummary;
        }> = [];

        for (let i = 0; i < startDayOfWeek; i++) {
            cells.push({ isCurrentMonth: false });
        }

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

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20">
            {/* ---------------- NAGŁÓWEK STRONY ---------------- */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-ui-black flex items-center gap-3">
                        Produkcja i sprzedaż
                    </h1>
                </div>

                {/* Akcje nagłówka: Sugerowany plan, Nowy raport, Miesiąc */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => openProductionPlanModal()}
                        className="flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
                    >
                        Sugerowany plan produkcji
                    </button>


                    <button
                        onClick={() => openNewReportModal()}
                        className="flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
                    >
                        <Plus size={16} />
                        Wprowadź raport dzienny
                    </button>

                    <div className="flex items-center bg-white border border-ui-accent rounded-xl shadow-xs p-1">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-ui-accent/15 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            title="Poprzedni miesiąc"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 text-xs font-black text-ui-primary min-w-[120px] text-center">
                            {POLISH_MONTHS[parseInt(currentMonth.split("-")[1], 10) - 1]} {currentMonth.split("-")[0]}
                        </span>
                        <button
                            onClick={handleNextMonth}
                            className="p-1.5 hover:bg-ui-accent/15 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            title="Następny miesiąc"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ---------------- KARTY PODSUMOWANIA MIESIĄCA (KPI) ---------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                {/* KARTA 3: UTARG Z WYPIEKÓW */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Wheat size={15} className="text-ui-primary" />
                                Utarg ze sprzedaży wypieków
                            </span>
                        </div>
                        <div className="mt-2 text-2xl sm:text-3xl font-black text-ui-primary tracking-tight">
                            {formatCurrency(stats.monthBakeryIncome)}
                        </div>
                    </div>
                    <div className="text-[11px] text-ui-secondary font-medium mt-2">
                        Kasa fiskalna: <strong>{formatCurrency(stats.monthFiscalIncome)}</strong>
                    </div>
                </div>

                {/* KARTA 4: STATUS RAPORTÓW */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-emerald-600" />
                                Kompletność raportów
                            </span>
                        </div>
                        <div className="mt-2 text-2xl sm:text-3xl font-black text-ui-black tracking-tight">
                            {daysSummary.filter((d) => d.hasReport).length}{" "}
                            <span className="text-sm font-semibold text-ui-secondary">dni z raportem</span>
                        </div>
                    </div>
                    <div className="text-[11px] font-semibold mt-2">
                        {stats.missingReportsCount > 0 ? (
                            <span className="text-rose-600 flex items-center gap-1">
                                <AlertTriangle size={13} />
                                Brak {stats.missingReportsCount} raportów w dniach roboczych
                            </span>
                        ) : (
                            <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 size={13} /> Wszystkie raporty uzupełnione
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ---------------- PRZEŁĄCZNIK WIDOKÓW I GRUPOWANIA ---------------- */}
            <div className="bg-white border border-ui-accent rounded-2xl p-3 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-3">
                {/* Lewa strona: Zakładki grupowania */}
                <div className="flex items-center gap-1.5 p-1 bg-ui-accent/10 rounded-xl border border-ui-accent/30">
                    <button
                        onClick={() => {
                            setViewMode("LIST");
                            setListGrouping("DAYS");
                        }}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "LIST" && listGrouping === "DAYS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <CalendarIcon size={14} />
                        Widok dzienny
                    </button>
                    <button
                        onClick={() => {
                            setViewMode("LIST");
                            setListGrouping("WEEKS");
                        }}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "LIST" && listGrouping === "WEEKS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <CalendarDays size={14} />
                        Widok tygodniowy ({weeksList.length} tyg.)
                    </button>
                    <button
                        onClick={() => {
                            setViewMode("LIST");
                            setListGrouping("MONTHS");
                        }}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "LIST" && listGrouping === "MONTHS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <List size={14} />
                        Podsumowanie miesiąca
                    </button>
                    <button
                        onClick={() => {
                            setViewMode("LIST");
                            setListGrouping("PRODUCTS");
                        }}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "LIST" && listGrouping === "PRODUCTS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <Wheat size={14} />
                        Sztuki wyrobów ({monthlyProductsData.length})
                    </button>
                    <button
                        onClick={() => setViewMode("CALENDAR")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "CALENDAR"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <CalendarDays size={14} />
                        Kalendarz
                    </button>
                </div>

                {/* Prawa strona: Filtry i wyszukiwarka */}
                <div className="flex items-center gap-2">
                    {listGrouping === "PRODUCTS" && (
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
                                    onClick={() => setSelectedCategoryFilter(c.id)}
                                    className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${selectedCategoryFilter === c.id
                                        ? "bg-ui-primary text-white shadow-xs"
                                        : "text-ui-secondary hover:bg-ui-accent/10"
                                        }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-ui-secondary" />
                        <input
                            type="text"
                            placeholder="Szukaj wyrobu lub daty..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-ui-accent bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-secondary w-48 sm:w-56"
                        />
                    </div>
                </div>
            </div>

            {/* ---------------- 1. TABELA LISTOWA (DNI / TYGODNIE / MIESIĄCE) ---------------- */}
            {viewMode === "LIST" && listGrouping !== "PRODUCTS" && (
                <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                    {isLoadingSummary ? (
                        <div className="p-16 flex items-center justify-center gap-3 text-ui-secondary text-sm">
                            <Loader2 size={24} className="animate-spin text-ui-primary" />
                            Ładowanie zestawienia produkcji...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider text-[10px] border-b border-ui-accent">
                                        <th className="py-3 px-3.5">Okres / Data</th>
                                        <th className="py-3 px-3.5 text-right">Wyprodukowano</th>
                                        <th className="py-3 px-3.5 text-right">Sprzedano</th>
                                        <th className="py-3 px-3.5 text-right">Skuteczność</th>
                                        <th className="py-3 px-3.5 text-right">Utarg z wypieków</th>
                                        <th className="py-3 px-3.5 text-right">Kasa fiskalna</th>
                                        <th className="py-3 px-3.5 text-right">Różnica</th>
                                        <th className="py-3 px-3.5 text-center w-28">Akcje / Wyroby</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/30">
                                    {/* --- 1.1 WIDOK DZIENNY --- */}
                                    {listGrouping === "DAYS" &&
                                        daysSummary
                                            .filter((day) => !productSearch.trim() || day.date.includes(productSearch.trim()) || day.products?.some(p => p.productName.toLowerCase().includes(productSearch.toLowerCase())))
                                            .map((day) => {
                                                const dObj = new Date(day.date);
                                                const dayOfWeek = dObj.getUTCDay();
                                                const isSunday = dayOfWeek === 0;
                                                const diff = day.fiscalIncome - day.bakerySalesIncome;
                                                const efficiency = day.totalProduced > 0 ? (day.totalSold / day.totalProduced) * 100 : 0;
                                                const isExpanded = !!expandedRows[day.date];

                                                return (
                                                    <React.Fragment key={day.date}>
                                                        <tr
                                                            onClick={() => toggleRow(day.date)}
                                                            className={`hover:bg-ui-accent/5 transition-colors cursor-pointer ${isExpanded ? "bg-ui-accent/10" : ""
                                                                } ${!day.hasReport && !isSunday && day.date <= todayStr ? "bg-rose-50/20" : ""}`}
                                                        >
                                                            <td className="py-3.5 px-3.5">
                                                                <div className="font-bold text-ui-black text-sm">{formatDate(day.date)}</div>
                                                                <div className="text-[11px] text-ui-secondary">
                                                                    {WEEKDAY_NAMES[(dayOfWeek + 6) % 7]}
                                                                    {isSunday && " (Piekarnia nieczynna)"}
                                                                </div>
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-medium text-ui-black text-sm">
                                                                {day.totalProduced > 0 ? `${day.totalProduced.toLocaleString("pl-PL")} szt.` : "—"}
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-bold text-ui-black text-sm">
                                                                {day.totalSold > 0 ? `${day.totalSold.toLocaleString("pl-PL")} szt.` : "—"}
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-semibold">
                                                                {day.totalProduced > 0 ? (
                                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                        {efficiency.toFixed(0)}%
                                                                    </span>
                                                                ) : "—"}
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-bold text-ui-primary text-sm">
                                                                {day.bakerySalesIncome > 0 ? formatCurrency(day.bakerySalesIncome) : "—"}
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-bold text-ui-primary text-sm">
                                                                {day.fiscalIncome > 0 ? formatCurrency(day.fiscalIncome) : "—"}
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-semibold">
                                                                {day.hasReport && day.fiscalIncome > 0 ? (
                                                                    <span className={`text-[11px] ${diff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                                                        {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} zł
                                                                    </span>
                                                                ) : "—"}
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-center">
                                                                <div className="inline-flex items-center gap-1.5 text-ui-secondary">
                                                                    {!isSunday && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                openProductionPlanModal(day.date);
                                                                            }}
                                                                            className="p-1 hover:bg-amber-100 hover:text-amber-800 rounded-lg transition-colors cursor-pointer"
                                                                            title="Sugerowany plan produkcji na ten dzień"
                                                                        >
                                                                            <Sparkles size={14} className="text-amber-600" />
                                                                        </button>
                                                                    )}
                                                                    <span className="text-[10px] font-bold">{day.products?.length || 0}</span>
                                                                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* ROZWINIĘCIE POZYCJI WYROBÓW DLA DNIA */}
                                                        {isExpanded && (
                                                            <tr className="bg-ui-accent/5">
                                                                <td colSpan={8} className="p-4 border-b border-ui-accent/30">
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center justify-between text-xs font-bold text-ui-secondary uppercase">
                                                                            <span>Wyroby wyprodukowane i sprzedane w dniu {formatDate(day.date)}:</span>
                                                                            <div className="flex items-center gap-3">
                                                                                {!isSunday && (
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            openProductionPlanModal(day.date);
                                                                                        }}
                                                                                        className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer"
                                                                                    >
                                                                                        <Sparkles size={13} /> Sugerowany plan dla tej daty
                                                                                    </button>
                                                                                )}
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        openNewReportModal(day.date);
                                                                                    }}
                                                                                    className="inline-flex items-center gap-1 text-[11px] text-ui-primary font-bold hover:underline cursor-pointer"
                                                                                >
                                                                                    <Edit3 size={12} /> Edytuj raport
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        {day.products && day.products.length > 0 ? (
                                                                            <div className="border border-ui-accent/50 rounded-xl overflow-hidden bg-white shadow-2xs">
                                                                                <table className="w-full text-left text-xs border-collapse">
                                                                                    <thead>
                                                                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold text-[10px] uppercase border-b border-ui-accent/30">
                                                                                            <th className="p-2.5">Nazwa wyrobu</th>
                                                                                            <th className="p-2.5 text-right">Cena jedn.</th>
                                                                                            <th className="p-2.5 text-right">Wyprodukowano</th>
                                                                                            <th className="p-2.5 text-right">Sprzedano</th>
                                                                                            <th className="p-2.5 text-right">Niesprzedane</th>
                                                                                            <th className="p-2.5 text-center">Wyprzedano o</th>
                                                                                            <th className="p-2.5 text-right">Przychód</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-ui-accent/30">
                                                                                        {day.products.map((p) => {
                                                                                            const unsold = p.producedAmount - p.soldAmount;
                                                                                            return (
                                                                                                <tr key={p.productId} className="hover:bg-ui-accent/5">
                                                                                                    <td className="p-2.5 font-bold text-ui-black">{p.productName}</td>
                                                                                                    <td className="p-2.5 text-right text-ui-secondary">{p.sellingPrice.toFixed(2)} zł</td>
                                                                                                    <td className="p-2.5 text-right font-semibold text-ui-black">{p.producedAmount} szt.</td>
                                                                                                    <td className="p-2.5 text-right font-black text-emerald-900">{p.soldAmount} szt.</td>
                                                                                                    <td className="p-2.5 text-right font-medium text-rose-700">
                                                                                                        {unsold > 0 ? `-${unsold} szt.` : "0"}
                                                                                                    </td>
                                                                                                    <td className="p-2.5 text-center">
                                                                                                        {p.soldOutTime ? (
                                                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[10px] font-bold">
                                                                                                                <Clock size={11} /> {p.soldOutTime}
                                                                                                            </span>
                                                                                                        ) : "—"}
                                                                                                    </td>
                                                                                                    <td className="p-2.5 text-right font-bold text-ui-primary">{formatCurrency(p.salesIncome)}</td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="p-4 text-center text-ui-secondary italic bg-white rounded-xl border border-ui-accent/30">
                                                                                Brak szczegółowych pozycji wyrobów w tym dniu
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}

                                    {/* --- 1.2 WIDOK TYGODNIOWY --- */}
                                    {listGrouping === "WEEKS" &&
                                        weeksList
                                            .filter((w) => !productSearch.trim() || w.label.toLowerCase().includes(productSearch.toLowerCase()) || w.products.some(p => p.productName.toLowerCase().includes(productSearch.toLowerCase())))
                                            .map((week) => {
                                                const diff = week.fiscalIncome - week.bakerySalesIncome;
                                                const efficiency = week.totalProduced > 0 ? (week.totalSold / week.totalProduced) * 100 : 0;
                                                const isExpanded = !!expandedRows[week.weekId];

                                                return (
                                                    <React.Fragment key={week.weekId}>
                                                        <tr
                                                            onClick={() => toggleRow(week.weekId)}
                                                            className={`hover:bg-ui-accent/5 transition-colors cursor-pointer ${isExpanded ? "bg-ui-accent/10" : ""
                                                                }`}
                                                        >
                                                            <td className="py-3.5 px-3.5">
                                                                <div className="font-bold text-ui-black text-sm">{week.label}</div>
                                                                <div className="text-[11px] text-ui-secondary">
                                                                    {formatDate(week.startDate)} — {formatDate(week.endDate)} ({week.daysCount}/6 dni)
                                                                </div>
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-medium text-ui-black text-sm">
                                                                {week.totalProduced.toLocaleString("pl-PL")} szt.
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-bold text-ui-black text-sm">
                                                                {week.totalSold.toLocaleString("pl-PL")} szt.
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-semibold">
                                                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                    {efficiency.toFixed(0)}%
                                                                </span>
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-bold text-ui-primary text-sm">
                                                                {formatCurrency(week.bakerySalesIncome)}
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-bold text-ui-primary text-sm">
                                                                {formatCurrency(week.fiscalIncome)}
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-right font-semibold">
                                                                <span className={`text-[11px] ${diff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                                                    {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} zł
                                                                </span>
                                                            </td>

                                                            <td className="py-3.5 px-3.5 text-center">
                                                                <div className="inline-flex items-center gap-1 text-ui-secondary">
                                                                    <span className="text-[10px] font-bold">{week.products.length} poz.</span>
                                                                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {isExpanded && (
                                                            <tr className="bg-ui-accent/5">
                                                                <td colSpan={8} className="p-4 border-b border-ui-accent/30">
                                                                    <div className="space-y-3">
                                                                        <div className="text-xs font-bold text-ui-secondary uppercase">
                                                                            Podsumowanie produkcji i sprzedaży produktów w {week.label}:
                                                                        </div>
                                                                        <div className="border border-ui-accent/50 rounded-xl overflow-hidden bg-white shadow-2xs">
                                                                            <table className="w-full text-left text-xs border-collapse">
                                                                                <thead>
                                                                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold text-[10px] uppercase border-b border-ui-accent/30">
                                                                                        <th className="p-2.5">Wyrób</th>
                                                                                        <th className="p-2.5">Kategoria</th>
                                                                                        <th className="p-2.5 text-right">Cena jedn.</th>
                                                                                        <th className="p-2.5 text-right">Wyprodukowano</th>
                                                                                        <th className="p-2.5 text-right">Sprzedano</th>
                                                                                        <th className="p-2.5 text-right">Niesprzedane</th>
                                                                                        <th className="p-2.5 text-center">Wskaźnik wyprzedania</th>
                                                                                        <th className="p-2.5 text-right">Utarg ze sprzedaży</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-ui-accent/30">
                                                                                    {week.products.map((p) => {
                                                                                        const unsold = p.producedAmount - p.soldAmount;
                                                                                        const cat = CATEGORY_MAP[p.productType as ProductType];
                                                                                        return (
                                                                                            <tr key={p.productId} className="hover:bg-ui-accent/5">
                                                                                                <td className="p-2.5 font-bold text-ui-black">{p.productName}</td>
                                                                                                <td className="p-2.5 text-ui-secondary text-[11px]">{cat?.label || p.productType}</td>
                                                                                                <td className="p-2.5 text-right text-ui-secondary">{p.sellingPrice.toFixed(2)} zł</td>
                                                                                                <td className="p-2.5 text-right font-semibold text-ui-black">{p.producedAmount.toLocaleString("pl-PL")} szt.</td>
                                                                                                <td className="p-2.5 text-right font-black text-emerald-950">{p.soldAmount.toLocaleString("pl-PL")} szt.</td>
                                                                                                <td className="p-2.5 text-right font-medium text-rose-700">
                                                                                                    {unsold > 0 ? `-${unsold.toLocaleString("pl-PL")} szt.` : "0"}
                                                                                                </td>
                                                                                                <td className="p-2.5 text-center">
                                                                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                                                        {p.sellThroughRate}%
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td className="p-2.5 text-right font-bold text-ui-primary">{formatCurrency(p.salesIncome)}</td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}

                                    {/* --- 1.3 WIDOK MIESIĘCZNY --- */}
                                    {listGrouping === "MONTHS" &&
                                        monthsList.map((mGroup) => {
                                            const isExpanded = true;
                                            return (
                                                <React.Fragment key={mGroup.monthId}>
                                                    <tr className="bg-ui-accent/10 font-bold">
                                                        <td className="py-3.5 px-3.5">
                                                            <div className="font-extrabold text-ui-black text-base">{mGroup.label}</div>
                                                            <div className="text-[11px] text-ui-secondary font-normal">
                                                                Zarejestrowane raporty z {mGroup.daysWithReport} dni
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-3.5 text-right font-extrabold text-ui-black text-sm">
                                                            {mGroup.totalProduced.toLocaleString("pl-PL")} szt.
                                                        </td>
                                                        <td className="py-3.5 px-3.5 text-right font-black text-emerald-950 text-sm">
                                                            {mGroup.totalSold.toLocaleString("pl-PL")} szt.
                                                        </td>
                                                        <td className="py-3.5 px-3.5 text-right font-semibold">
                                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                {mGroup.totalProduced > 0 ? ((mGroup.totalSold / mGroup.totalProduced) * 100).toFixed(1) : 0}%
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-3.5 text-right font-black text-ui-primary text-sm">
                                                            {formatCurrency(mGroup.bakerySalesIncome)}
                                                        </td>
                                                        <td className="py-3.5 px-3.5 text-right font-black text-ui-primary text-sm">
                                                            {formatCurrency(mGroup.fiscalIncome)}
                                                        </td>
                                                        <td className="py-3.5 px-3.5 text-right font-semibold">
                                                            <span className="text-[11px] text-ui-secondary">
                                                                {formatCurrency(mGroup.fiscalIncome - mGroup.bakerySalesIncome)}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-3.5 text-center">
                                                            <span className="text-[10px] font-bold text-ui-secondary">{mGroup.products.length} poz.</span>
                                                        </td>
                                                    </tr>

                                                    {/* Lista produktów dla miesiąca */}
                                                    <tr className="bg-ui-accent/5">
                                                        <td colSpan={8} className="p-4 border-b border-ui-accent/30">
                                                            <div className="space-y-3">
                                                                <div className="text-xs font-bold text-ui-secondary uppercase">
                                                                    Zbiorczy bilans wszystkich wyrobów w {mGroup.label}:
                                                                </div>
                                                                <div className="border border-ui-accent/50 rounded-xl overflow-hidden bg-white shadow-2xs">
                                                                    <table className="w-full text-left text-xs border-collapse">
                                                                        <thead>
                                                                            <tr className="bg-ui-accent/10 text-ui-secondary font-bold text-[10px] uppercase border-b border-ui-accent/30">
                                                                                <th className="p-2.5">Wyrób</th>
                                                                                <th className="p-2.5">Kategoria</th>
                                                                                <th className="p-2.5 text-right">Cena jedn.</th>
                                                                                <th className="p-2.5 text-right">Wyprodukowano (m-c)</th>
                                                                                <th className="p-2.5 text-right">Sprzedano (m-c)</th>
                                                                                <th className="p-2.5 text-right">Niesprzedane</th>
                                                                                <th className="p-2.5 text-center">Skuteczność</th>
                                                                                <th className="p-2.5 text-right">Łączny utarg</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-ui-accent/30">
                                                                            {mGroup.products.map((p) => {
                                                                                const unsold = p.producedAmount - p.soldAmount;
                                                                                const cat = CATEGORY_MAP[p.productType as ProductType];
                                                                                return (
                                                                                    <tr key={p.productId} className="hover:bg-ui-accent/5">
                                                                                        <td className="p-2.5 font-bold text-ui-black">{p.productName}</td>
                                                                                        <td className="p-2.5 text-ui-secondary text-[11px]">{cat?.label || p.productType}</td>
                                                                                        <td className="p-2.5 text-right text-ui-secondary">{p.sellingPrice.toFixed(2)} zł</td>
                                                                                        <td className="p-2.5 text-right font-semibold text-ui-black">{p.producedAmount.toLocaleString("pl-PL")} szt.</td>
                                                                                        <td className="p-2.5 text-right font-black text-emerald-950">{p.soldAmount.toLocaleString("pl-PL")} szt.</td>
                                                                                        <td className="p-2.5 text-right font-medium text-rose-700">
                                                                                            {unsold > 0 ? `-${unsold.toLocaleString("pl-PL")} szt.` : "0"}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-center">
                                                                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                                                {p.sellThroughRate}%
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="p-2.5 text-right font-bold text-ui-primary">{formatCurrency(p.salesIncome)}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ---------------- 2. WIDOK SZTUK WYROBÓW (RANKING ASORTYMENTU) ---------------- */}
            {viewMode === "LIST" && listGrouping === "PRODUCTS" && (
                <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-ui-accent bg-ui-accent/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="font-bold text-sm text-ui-black flex items-center gap-2">
                                <Wheat size={16} className="text-ui-primary" />
                                Ilość sztuk wyprodukowanych i sprzedanych w miesiącu
                            </h3>
                            <p className="text-xs text-ui-secondary mt-0.5">
                                Szczegółowe zestawienie wolumenów produkcji dla poszczególnych wyrobów piekarni
                            </p>
                        </div>
                        <div className="text-xs text-ui-secondary font-medium">
                            Pozycji w zestawieniu: <strong className="text-ui-black">{filteredProductsRanking.length}</strong>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider text-[10px] border-b border-ui-accent">
                                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                                    <th className="py-3 px-3.5">Wyrób</th>
                                    <th className="py-3 px-3.5">Kategoria</th>
                                    <th className="py-3 px-3.5 text-right">Cena sprzedaży</th>
                                    <th className="py-3 px-3.5 text-right">Wyprodukowano</th>
                                    <th className="py-3 px-3.5 text-right">Sprzedano</th>
                                    <th className="py-3 px-3.5 text-right">Niesprzedane / zwroty</th>
                                    <th className="py-3 px-3.5 text-center">Wskaźnik wyprzedania</th>
                                    <th className="py-3 px-3.5 text-right">Łączny utarg</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/30">
                                {filteredProductsRanking.length > 0 ? (
                                    filteredProductsRanking.map((p, idx) => {
                                        const catInfo = CATEGORY_MAP[p.productType as ProductType];
                                        const unsold = p.producedAmount - p.soldAmount;

                                        return (
                                            <tr key={p.productId} className="hover:bg-ui-accent/5 transition-colors">
                                                <td className="py-3.5 px-3.5 text-center font-bold text-ui-secondary text-xs">
                                                    {idx + 1}
                                                </td>
                                                <td className="py-3.5 px-3.5 font-bold text-ui-black text-sm">
                                                    {p.productName}
                                                </td>
                                                <td className="py-3.5 px-3.5">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-ui-accent/15 text-ui-primary">
                                                        {catInfo?.label || p.productType}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3.5 text-right font-semibold text-ui-secondary">
                                                    {p.sellingPrice.toFixed(2)} zł
                                                </td>
                                                <td className="py-3.5 px-3.5 text-right font-semibold text-ui-black text-sm">
                                                    {p.producedAmount.toLocaleString("pl-PL")} szt.
                                                </td>
                                                <td className="py-3.5 px-3.5 text-right font-black text-emerald-950 text-sm">
                                                    {p.soldAmount.toLocaleString("pl-PL")} szt.
                                                </td>
                                                <td className="py-3.5 px-3.5 text-right font-medium text-rose-700">
                                                    {unsold > 0 ? `-${unsold.toLocaleString("pl-PL")} szt.` : "0"}
                                                </td>
                                                <td className="py-3.5 px-3.5 text-center">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${p.sellThroughRate >= 90
                                                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                                            : p.sellThroughRate >= 75
                                                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                                                : "bg-amber-50 text-amber-800 border border-amber-200"
                                                            }`}
                                                    >
                                                        {p.sellThroughRate}%
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3.5 text-right font-black text-ui-primary text-sm">
                                                    {formatCurrency(p.salesIncome)}
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
                            <tfoot>
                                <tr className="bg-ui-accent/15 font-black text-ui-black border-t border-ui-accent/40">
                                    <td colSpan={4} className="py-3.5 px-3.5 text-xs">
                                        SUMA CAŁEGO MIESIĄCA
                                    </td>
                                    <td className="py-3.5 px-3.5 text-right text-sm">
                                        {stats.monthProduced.toLocaleString("pl-PL")} szt.
                                    </td>
                                    <td className="py-3.5 px-3.5 text-right text-sm text-emerald-950">
                                        {stats.monthSold.toLocaleString("pl-PL")} szt.
                                    </td>
                                    <td className="py-3.5 px-3.5 text-right text-sm text-rose-700">
                                        {Math.max(0, stats.monthProduced - stats.monthSold).toLocaleString("pl-PL")} szt.
                                    </td>
                                    <td className="py-3.5 px-3.5 text-center">
                                        {stats.monthProduced > 0 ? ((stats.monthSold / stats.monthProduced) * 100).toFixed(1) : 0}%
                                    </td>
                                    <td className="py-3.5 px-3.5 text-right text-sm text-ui-primary">
                                        {formatCurrency(stats.monthBakeryIncome)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ---------------- 3. WIDOK KALENDARZA ---------------- */}
            {viewMode === "CALENDAR" && (
                <div className="bg-white border border-ui-accent rounded-2xl p-6 shadow-xs">
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-ui-secondary uppercase tracking-wider">
                        {SHORT_WEEKDAYS.map((wd, i) => (
                            <div key={wd} className={`py-2 rounded-lg ${i === 6 ? "text-ui-secondary/50" : ""}`}>
                                {wd}
                            </div>
                        ))}
                    </div>

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
                                            toggleRow(cell.dateStr!);
                                            setViewMode("LIST");
                                            setListGrouping("DAYS");
                                        } else if (cell.isPastOrToday && !cell.isSunday) {
                                            openNewReportModal(cell.dateStr);
                                        } else if (!cell.isSunday) {
                                            openProductionPlanModal(cell.dateStr);
                                        }
                                    }}
                                    className={`h-28 sm:h-32 rounded-2xl p-2.5 border transition-all flex flex-col justify-between cursor-pointer ${hasData
                                        ? "bg-white border-ui-accent hover:border-ui-primary hover:shadow-md"
                                        : isMissing
                                            ? "bg-rose-50/40 border-rose-200 hover:border-rose-400"
                                            : cell.isSunday
                                                ? "bg-ui-accent/5 border-ui-accent/20 opacity-50 cursor-default"
                                                : "bg-ui-white border-ui-accent/30 hover:border-amber-400"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={`text-xs font-black px-2 py-0.5 rounded-lg ${cell.dateStr === todayStr
                                                ? "bg-ui-primary text-white"
                                                : "text-ui-black bg-ui-accent/15"
                                                }`}
                                        >
                                            {cell.dayNumber}
                                        </span>
                                        {hasData ? (
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                                {cell.dayData?.productsCount || 0} poz.
                                            </span>
                                        ) : isMissing ? (
                                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-md">
                                                Brak
                                            </span>
                                        ) : !cell.isSunday ? (
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                                <Sparkles size={10} /> Plan
                                            </span>
                                        ) : null}
                                    </div>

                                    {hasData ? (
                                        <div className="space-y-0.5 text-right">
                                            <div className="text-[11px] font-bold text-ui-black">
                                                {cell.dayData?.totalSold} / {cell.dayData?.totalProduced} szt.
                                            </div>
                                            <div className="text-xs font-black text-ui-primary">
                                                {formatCurrency(cell.dayData?.bakerySalesIncome || 0)}
                                            </div>
                                        </div>
                                    ) : isMissing ? (
                                        <div className="text-center text-[10px] font-bold text-rose-600">
                                            Kliknij aby dodać
                                        </div>
                                    ) : (
                                        <div className="text-center text-[10px] text-ui-secondary/60">
                                            {cell.isSunday ? "Nieczynne" : "Zaplanuj dzień"}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 1: FORMULARZ WPROWADZANIA RAPORTU                   */}
            {/* ========================================================= */}
            {isFormModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsFormModalOpen(false)}
                >
                    <div
                        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Nagłówek Formularza */}
                        <div className="p-5 border-b border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-ui-black flex items-center gap-2">
                                    <Edit3 size={20} className="text-ui-primary" />
                                    Raport dzienny: {formatDate(formDate)}
                                </h2>
                                <p className="text-xs text-ui-secondary mt-0.5">
                                    Wprowadź ilości wyprodukowane, sprzedane oraz godzinę wyprzedania
                                </p>
                            </div>
                            <button
                                onClick={() => setIsFormModalOpen(false)}
                                className="p-1.5 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Zawartość Formularza */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Panel Utargu Fiskalnego */}
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                                        <Receipt size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-emerald-950">Łączny utarg z kasy fiskalnej</div>
                                        <div className="text-[11px] text-emerald-800">
                                            Wpisz całkowity utarg zarejestrowany na kasie za ten dzień
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={formFiscalIncome}
                                        onChange={(e) => setFormFiscalIncome(e.target.value)}
                                        className="w-36 text-right px-3 py-2 bg-white border border-emerald-300 rounded-xl font-black text-emerald-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                    />
                                    <span className="text-xs font-bold text-emerald-900">zł</span>
                                </div>
                            </div>

                            {/* Tabela Produktów */}
                            {isLoadingFormData ? (
                                <div className="p-12 text-center text-xs text-ui-secondary">
                                    <Loader2 size={24} className="animate-spin mx-auto text-ui-primary mb-2" />
                                    Ładowanie listy produktów...
                                </div>
                            ) : (
                                Object.entries(CATEGORY_MAP).map(([catKey, catInfo]) => {
                                    const prods = allProducts.filter((p) => p.type === catKey);
                                    if (prods.length === 0) return null;
                                    const Icon = catInfo.icon;

                                    return (
                                        <div key={catKey} className="border border-ui-accent rounded-2xl overflow-hidden shadow-2xs">
                                            <div className="p-3 bg-ui-accent/15 border-b border-ui-accent flex items-center justify-between">
                                                <div className="font-bold text-xs text-ui-black flex items-center gap-2">
                                                    <Icon size={16} className="text-ui-primary" />
                                                    {catInfo.label} ({prods.length})
                                                </div>
                                            </div>
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-ui-accent/5 text-ui-secondary font-bold text-[10px] uppercase border-b border-ui-accent/30">
                                                        <th className="p-2.5">Wyrób</th>
                                                        <th className="p-2.5 text-right w-24">Cena</th>
                                                        <th className="p-2.5 text-center w-28">Wyprodukowano</th>
                                                        <th className="p-2.5 text-center w-28">Sprzedano</th>
                                                        <th className="p-2.5 text-left w-36">Godzina wyprzedania</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-ui-accent/30 font-medium">
                                                    {prods.map((prod) => {
                                                        const it = formItems[prod.id] || {
                                                            bakeryProductId: prod.id,
                                                            producedAmount: "",
                                                            soldAmount: "",
                                                            soldOutTime: "",
                                                        };
                                                        const prodAmt = parseInt(it.producedAmount, 10) || 0;
                                                        const soldAmt = parseInt(it.soldAmount, 10) || 0;
                                                        const isSoldOut = prodAmt > 0 && soldAmt >= prodAmt;

                                                        return (
                                                            <tr key={prod.id} className="hover:bg-ui-accent/5">
                                                                <td className="p-2.5 font-bold text-ui-black">{prod.name}</td>
                                                                <td className="p-2.5 text-right text-ui-secondary">{Number(prod.sellingPrice).toFixed(2)} zł</td>
                                                                <td className="p-2.5 text-center">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        placeholder="0"
                                                                        value={it.producedAmount}
                                                                        onChange={(e) => handleFormItemChange(prod.id, "producedAmount", e.target.value)}
                                                                        className="w-20 text-center px-2 py-1 rounded-lg border border-ui-accent bg-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-ui-secondary"
                                                                    />
                                                                </td>
                                                                <td className="p-2.5 text-center">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        placeholder="0"
                                                                        value={it.soldAmount}
                                                                        onChange={(e) => handleFormItemChange(prod.id, "soldAmount", e.target.value)}
                                                                        className="w-20 text-center px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50/50 font-black text-xs text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                                                    />
                                                                </td>
                                                                <td className="p-2.5">
                                                                    {isSoldOut ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Clock size={13} className="text-emerald-700 shrink-0" />
                                                                            <input
                                                                                type="time"
                                                                                value={it.soldOutTime}
                                                                                onChange={(e) => handleFormItemChange(prod.id, "soldOutTime", e.target.value)}
                                                                                className="px-2 py-0.5 rounded-lg border border-emerald-300 bg-emerald-100 text-xs font-bold text-emerald-950"
                                                                            />
                                                                        </div>
                                                                    ) : prodAmt > 0 && soldAmt < prodAmt ? (
                                                                        <span className="text-[11px] text-ui-secondary">Zostało: {prodAmt - soldAmt} szt.</span>
                                                                    ) : (
                                                                        <span className="text-[11px] text-ui-secondary/40">—</span>
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
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer ${formSaveSuccess ? "bg-emerald-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    }`}
                            >
                                {isSavingForm ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Zapisywanie...
                                    </>
                                ) : formSaveSuccess ? (
                                    <>
                                        <Check size={14} />
                                        Zapisano pomyślnie!
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        Zapisz raport dzienny
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 2: SUGEROWANY PLAN PRODUKCJI NA DANY DZIEŃ         */}
            {/* ========================================================= */}
            {isPlanModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsPlanModalOpen(false)}
                >
                    <div
                        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-ui-accent max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Nagłówek Modala Planu */}
                        <div className="p-6 border-b border-ui-accent bg-gradient-to-r from-ui-accent/20 via-white to-amber-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-ui-primary text-white rounded-xl shadow-xs">
                                        <Sparkles size={20} className="text-amber-300" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-extrabold text-ui-black tracking-tight">
                                            Sugerowany Plan Produkcji
                                        </h2>
                                        <p className="text-xs text-ui-secondary">
                                            Algorytm prognozowania wolumenów na podstawie 4 ostatnich tygodni, godzin wyprzedania oraz analizy anomalii
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Selektor daty dla planu */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-white border border-ui-accent rounded-xl shadow-xs p-1">
                                    <button
                                        onClick={() => {
                                            setPlanDate(todayStr);
                                            fetchProductionPlan(todayStr);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${planDate === todayStr ? "bg-ui-primary text-white" : "text-ui-secondary hover:text-ui-black"
                                            }`}
                                    >
                                        Dziś
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPlanDate(tomorrowStr);
                                            fetchProductionPlan(tomorrowStr);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${planDate === tomorrowStr ? "bg-ui-primary text-white" : "text-ui-secondary hover:text-ui-black"
                                            }`}
                                    >
                                        Jutro
                                    </button>
                                    <input
                                        type="date"
                                        value={planDate}
                                        onChange={(e) => {
                                            const newD = e.target.value;
                                            if (newD) {
                                                setPlanDate(newD);
                                                fetchProductionPlan(newD);
                                            }
                                        }}
                                        className="text-xs font-bold px-2.5 py-1 rounded-lg border-l border-ui-accent text-ui-primary bg-transparent focus:outline-none"
                                    />
                                </div>

                                <button
                                    onClick={() => setIsPlanModalOpen(false)}
                                    className="p-2 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-secondary hover:text-ui-black cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Zawartość Modala Planu */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {isLoadingPlan ? (
                                <div className="p-20 text-center text-ui-secondary text-sm">
                                    <Loader2 size={32} className="animate-spin mx-auto text-ui-primary mb-3" />
                                    <div className="font-bold text-ui-black text-base">Wyliczanie optymalnego planu wypieków...</div>
                                    <div className="text-xs text-ui-secondary mt-1">
                                        Analiza historii 4 tygodni, korygowanie utraconego popytu i detekcja anomalii utargu
                                    </div>
                                </div>
                            ) : planData?.isClosed ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
                                    <AlertCircle size={36} className="text-amber-600 mx-auto" />
                                    <h3 className="text-lg font-bold text-amber-950">
                                        {planData.dayName}, {formatDate(planData.targetDate)}: Piekarnia nieczynna
                                    </h3>
                                    <p className="text-xs text-amber-800 max-w-md mx-auto">
                                        W niedziele piekarnia nie prowadzi wypieków ani sprzedaży. Wybierz inny dzień tygodnia (Poniedziałek – Sobota).
                                    </p>
                                </div>
                            ) : planData ? (
                                <>
                                    {/* 1. KARTY KPI PLANU */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {/* Łączna liczba sztuk */}
                                        <div className="bg-gradient-to-br from-ui-primary/5 to-ui-primary/10 border border-ui-primary/20 rounded-2xl p-4 flex flex-col justify-between">
                                            <div className="text-[11px] uppercase font-bold text-ui-secondary flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 text-ui-primary">
                                                    <PackageCheck size={16} /> Sugerowana produkcja
                                                </span>
                                                <span className="text-[10px] font-black bg-ui-primary text-white px-2 py-0.5 rounded-md">
                                                    {planData.dayName}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-3xl font-black text-ui-black tracking-tight">
                                                {planData.totals?.totalUnits.toLocaleString("pl-PL")}{" "}
                                                <span className="text-base font-bold text-ui-secondary">szt.</span>
                                            </div>
                                            <div className="text-[11px] text-ui-secondary mt-1">
                                                Wypieki z {planData.totals?.productsCount || 0} pozycji asortymentowych
                                            </div>
                                        </div>

                                        {/* Szacowany utarg */}
                                        <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-300 rounded-2xl p-4 flex flex-col justify-between">
                                            <div className="text-[11px] uppercase font-bold text-emerald-800 flex items-center justify-between">
                                                <span className="flex items-center gap-1.5">
                                                    <Receipt size={16} /> Szacowany utarg
                                                </span>
                                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                                    Cena detaliczna
                                                </span>
                                            </div>
                                            <div className="mt-2 text-3xl font-black text-emerald-950 tracking-tight">
                                                {formatCurrency(planData.totals?.estimatedRevenue || 0)}
                                            </div>
                                            <div className="text-[11px] text-emerald-800 mt-1">
                                                Przy 100% zrealizowanej sprzedaży planu
                                            </div>
                                        </div>

                                        {/* Szacowany koszt i marża */}
                                        <div className="bg-white border border-ui-accent rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                                            <div className="text-[11px] uppercase font-bold text-ui-secondary flex items-center justify-between">
                                                <span className="flex items-center gap-1.5">
                                                    <Coins size={16} /> Koszt surowcowy / Marża
                                                </span>
                                            </div>
                                            <div className="mt-2 text-2xl font-black text-ui-black tracking-tight">
                                                {formatCurrency(planData.totals?.estimatedProfit || 0)}
                                            </div>
                                            <div className="text-[11px] text-ui-secondary mt-1">
                                                Koszt recepturowy: <strong>{formatCurrency(planData.totals?.estimatedProductionCost || 0)}</strong>
                                            </div>
                                        </div>

                                        {/* Jakość danych historycznych */}
                                        <div className="bg-white border border-ui-accent rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                                            <div className="text-[11px] uppercase font-bold text-ui-secondary flex items-center justify-between">
                                                <span className="flex items-center gap-1.5">
                                                    <CheckCheck size={16} /> Jakość prognozy
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${planData.dataQuality?.hasFullHistory ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                                    }`}>
                                                    {planData.dataQuality?.availableWeeksCount || 0}/4 tyg.
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xl font-extrabold text-ui-black">
                                                {planData.dataQuality?.hasFullHistory ? (
                                                    <span className="text-emerald-700 flex items-center gap-1.5">
                                                        <CheckCircle2 size={18} /> Pełna historia
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-700 flex items-center gap-1.5">
                                                        <AlertTriangle size={18} /> Częściowe dane
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-ui-secondary mt-1">
                                                {planData.dataQuality?.anomaliesCount ? `${planData.dataQuality.anomaliesCount} skorygowane anomalie` : "Wagi czasowe: 40/30/20/10%"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. OSTRZEŻENIA / ALERTY O JAKOŚCI DANYCH I ANOMALIACH */}
                                    {planData.dataQuality?.warningMessage && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
                                            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                                            <div className="text-xs text-amber-900 leading-relaxed">
                                                <strong>Uwaga dotycząca bazy danych:</strong> {planData.dataQuality.warningMessage}
                                            </div>
                                        </div>
                                    )}

                                    {planData.dataQuality?.anomalies && planData.dataQuality.anomalies.length > 0 && (
                                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2">
                                            <div className="text-xs font-bold text-rose-950 flex items-center gap-2">
                                                <Flame size={16} className="text-rose-600" />
                                                Wykryto anomalie utargu w dniach historycznych (automatycznie obniżono ich wagi o 50%):
                                            </div>
                                            <div className="space-y-1 pl-6 text-xs text-rose-800">
                                                {planData.dataQuality.anomalies.map((a, idx) => (
                                                    <div key={idx}>
                                                        • <strong>{a.weekLabel} ({formatDate(a.date)}):</strong> {a.reason}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. PODSUMOWANIE ANALIZOWANYCH TYGODNI */}
                                    <div className="bg-ui-accent/10 border border-ui-accent/40 rounded-2xl p-4">
                                        <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider mb-2.5 flex items-center justify-between">
                                            <span>Analizowane dni historyczne ({planData.dayName}):</span>
                                            <span className="text-[10px] text-ui-secondary font-medium">
                                                Śr. utarg historyczny: <strong>{formatCurrency(planData.dataQuality?.averageHistoricalIncome || 0)}</strong>
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {planData.historicalWeeks?.map((hw) => (
                                                <div
                                                    key={hw.weekLabel}
                                                    className={`bg-white border rounded-xl p-3 text-xs flex flex-col justify-between ${hw.isAnomaly
                                                        ? "border-rose-300 bg-rose-50/20"
                                                        : hw.hasData
                                                            ? "border-ui-accent/60"
                                                            : "border-dashed border-ui-accent/40 opacity-50"
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between font-bold">
                                                        <span className="text-ui-primary">{hw.weekLabel}</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-accent/20 text-ui-black">
                                                            waga: {(hw.weight * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 font-semibold text-ui-black">{formatDate(hw.date)}</div>
                                                    <div className="mt-1 text-[11px] text-ui-secondary flex items-center justify-between">
                                                        <span>Utarg:</span>
                                                        <strong className={hw.isAnomaly ? "text-rose-700" : "text-ui-primary"}>
                                                            {hw.hasData ? formatCurrency(hw.effectiveIncome) : "Brak danych"}
                                                        </strong>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4. FILTRY I WYSZUKIWARKA PRODUKTÓW W PLANIE */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
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
                                                    onClick={() => setPlanCategoryFilter(c.id)}
                                                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${planCategoryFilter === c.id
                                                        ? "bg-ui-primary text-white shadow-xs"
                                                        : "text-ui-secondary hover:bg-ui-accent/15"
                                                        }`}
                                                >
                                                    {c.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-2.5 text-ui-secondary" />
                                            <input
                                                type="text"
                                                placeholder="Szukaj wyrobu..."
                                                value={planSearch}
                                                onChange={(e) => setPlanSearch(e.target.value)}
                                                className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-ui-accent bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-secondary w-48 sm:w-64"
                                            />
                                        </div>
                                    </div>

                                    {/* 5. TABELA SUGEROWANEGO PLANU PRODUKCJI */}
                                    <div className="border border-ui-accent rounded-2xl overflow-hidden shadow-2xs">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-ui-accent/15 text-ui-secondary font-bold text-[10px] uppercase border-b border-ui-accent">
                                                    <th className="p-3">Wyrób</th>
                                                    <th className="p-3">Kategoria</th>
                                                    <th className="p-3 text-right">Cena</th>
                                                    <th className="p-3 text-right text-emerald-950 font-extrabold text-xs">
                                                        Sugerowana produkcja
                                                    </th>
                                                    <th className="p-3 text-right">Szacowany utarg</th>
                                                    <th className="p-3 text-center w-28">Szczegóły T-1..4</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-ui-accent/30 font-medium">
                                                {filteredPlanSuggestions.map((prod) => {
                                                    const isExpanded = !!expandedPlanProducts[prod.id];
                                                    const cat = CATEGORY_MAP[prod.type];
                                                    const prodRevenue = prod.suggestedAmount * prod.sellingPrice;

                                                    return (
                                                        <React.Fragment key={prod.id}>
                                                            <tr
                                                                onClick={() => togglePlanProduct(prod.id)}
                                                                className={`hover:bg-ui-accent/5 transition-colors cursor-pointer ${isExpanded ? "bg-ui-accent/10" : ""
                                                                    }`}
                                                            >
                                                                <td className="p-3 font-bold text-ui-black text-sm">
                                                                    {prod.name}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-ui-accent/15 text-ui-primary">
                                                                        {cat?.label || prod.type}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-right text-ui-secondary">
                                                                    {prod.sellingPrice.toFixed(2)} zł
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-950 font-black text-sm rounded-xl border border-emerald-300">
                                                                        {prod.suggestedAmount} szt.
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-right font-black text-ui-primary text-sm">
                                                                    {formatCurrency(prodRevenue)}
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-ui-secondary">
                                                                        <span>{prod.rawDemand.toFixed(1)}</span>
                                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {/* ROZWINIĘCIE SZCZEGÓŁÓW KALKULACJI DLA PRODUKTU */}
                                                            {isExpanded && (
                                                                <tr className="bg-ui-accent/5">
                                                                    <td colSpan={6} className="p-4 border-b border-ui-accent/30">
                                                                        <div className="space-y-2">
                                                                            <div className="text-[11px] font-bold text-ui-secondary uppercase flex items-center justify-between">
                                                                                <span>Szczegóły kalkulacji popytu dla: {prod.name}</span>
                                                                                <span className="text-ui-primary font-bold">
                                                                                    Średnia ważona: {prod.rawDemand} → Zaokrąglono do: {prod.suggestedAmount} szt.
                                                                                </span>
                                                                            </div>

                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                                                                {prod.history.map((hItem) => (
                                                                                    <div
                                                                                        key={hItem.weekLabel}
                                                                                        className={`p-3 rounded-xl border text-xs bg-white ${hItem.unmetMultiplier > 1
                                                                                            ? "border-emerald-300 bg-emerald-50/20"
                                                                                            : "border-ui-accent/50"
                                                                                            }`}
                                                                                    >
                                                                                        <div className="flex items-center justify-between font-bold text-ui-primary">
                                                                                            <span>{hItem.weekLabel} ({formatDate(hItem.dateStr)})</span>
                                                                                            <span className="text-[10px] text-ui-secondary">
                                                                                                waga: {(hItem.weight * 100).toFixed(0)}%
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="mt-1 text-[11px] space-y-0.5">
                                                                                            <div className="flex justify-between">
                                                                                                <span className="text-ui-secondary">Sprzedano:</span>
                                                                                                <strong>{hItem.soldAmount} szt.</strong>
                                                                                            </div>
                                                                                            <div className="flex justify-between">
                                                                                                <span className="text-ui-secondary">Wyprzedano o:</span>
                                                                                                <strong>{hItem.soldOutTime || "— (zostały)"}</strong>
                                                                                            </div>
                                                                                            {hItem.unmetMultiplier > 1 && (
                                                                                                <div className="flex justify-between text-emerald-800 font-bold">
                                                                                                    <span>Korekta popytu:</span>
                                                                                                    <span>+{Math.round((hItem.unmetMultiplier - 1) * 100)}%</span>
                                                                                                </div>
                                                                                            )}
                                                                                            <div className="flex justify-between border-t border-ui-accent/30 pt-1 font-bold">
                                                                                                <span>Popyt skorygowany:</span>
                                                                                                <span>{hItem.adjustedDemand} szt.</span>
                                                                                            </div>
                                                                                            <div className="flex justify-between text-[10px] text-ui-secondary">
                                                                                                <span>Wkład do planu:</span>
                                                                                                <span>+{hItem.contribution} szt.</span>
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
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* Stopka Modala Planu */}
                        <div className="p-5 border-t border-ui-accent bg-ui-accent/10 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopyPlanToClipboard}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-ui-accent bg-white text-ui-primary hover:bg-ui-accent/20 font-bold text-xs transition-colors cursor-pointer"
                                >
                                    {isPlanCopied ? (
                                        <>
                                            <Check size={14} className="text-emerald-600" />
                                            Skopiowano do schowka!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={14} />
                                            Kopiuj listę planu
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsPlanModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-ui-accent text-ui-secondary hover:text-ui-primary font-semibold text-xs transition-colors cursor-pointer"
                                >
                                    Zamknij
                                </button>

                                {planData && !planData.isClosed && (
                                    <button
                                        onClick={handleApplyPlanToReport}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
                                    >
                                        <ArrowRight size={15} />
                                        Wprowadź plan do raportu dziennego
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}