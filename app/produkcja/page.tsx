"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Calendar as CalendarIcon,
    Plus,
    Clock,
    Coins,
    Receipt,
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Edit3,
    Layers,
    Wheat,
    Croissant,
    Pizza,
    List,
    CalendarDays,
    X,
    Loader2,
    Check,
    Star,
    Sparkles,
    AlertTriangle,
    Search,
    Copy,
    FileText,
    Flame,
    DoorClosed,
    DoorOpen,
    CalendarOff,
    Ban,
    ArrowRight,
    BarChart3,
    TrendingUp,
    Info,
    RotateCcw,
    Hamburger,
    Printer,
    FileDown,
    Save
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

type ProductType = "BREAD" | "ROLL" | "SWEET" | "SAVORY";
type ActiveReportTab = "CALENDAR" | "LAST_7_DAYS" | "LAST_WEEKS" | "LAST_MONTHS";

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
    carriedOverAmount?: number;
    totalAssortment?: number;
    soldAmount: number;
    salesIncome: number;
    soldOutTime?: string;
}

interface DaySummary {
    date: string;
    totalProduced: number;
    totalCarriedOver?: number;
    totalAssortment?: number;
    totalSold: number;
    bakerySalesIncome: number;
    fiscalIncome: number;
    hasReport: boolean;
    isClosed?: boolean;
    closedReason?: string;
    productsCount: number;
    products?: DayProductItem[];
}

interface MonthStats {
    monthProduced: number;
    monthCarriedOver?: number;
    monthAssortment?: number;
    monthSold: number;
    monthBakeryIncome: number;
    monthFiscalIncome: number;
    monthTotalIncome?: number;
    missingReportsCount: number;
    totalDaysInMonth: number;
}

interface AggregatedProduct {
    productId: string;
    productName: string;
    productType: string;
    sellingPrice: number;
    producedAmount: number;
    carriedOverAmount: number;
    totalAssortment: number;
    soldAmount: number;
    salesIncome: number;
    sellThroughRate: number;
}

interface ProductionDetailItem {
    bakeryProductId: string;
    producedAmount: string;
    carriedOverAmount: string;
    leftoverAmount: string;
    soldAmount: string;
    soldOutTime: string;
    statusInput?: string;
}


interface WeeklyPlanDay {
    dateStr: string;
    dayOfWeek: number;
    dayName: string;
    dayShort: string;
    dateFormatted: string;
    totalUnits: number;
    estimatedRevenue: number;
}

interface WeeklyPlanProduct {
    id: string;
    name: string;
    type: string;
    sellingPrice: number;
    dailyAmounts: Record<string, number>;
    weeklyTotal: number;
}

interface WeeklyPlanCategory {
    key: string;
    label: string;
    products: WeeklyPlanProduct[];
    dailyTotals: Record<string, number>;
    weeklyTotal: number;
}

interface WeeklyPlanData {
    weekStart: string;
    weekEnd: string;
    days: WeeklyPlanDay[];
    categories: WeeklyPlanCategory[];
    grandDailyTotals: Record<string, number>;
    grandWeeklyTotal: number;
    totalEstimatedRevenue: number;
    isCustomSaved?: boolean;
    savedAt?: string | null;
}

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
    BREAD: "Chleby",
    ROLL: "Bułki",
    SWEET: "Wypieki słodkie",
    SAVORY: "Wypieki słone",
};

const CATEGORY_MAP: Record<ProductType, { label: string; icon: React.ReactNode; color: string; badge: string }> = {
    BREAD: {
        label: "Chleby",
        icon: <Wheat size={16} className="text-amber-600" />,
        color: "text-amber-700 bg-amber-50 border-amber-200",
        badge: "bg-amber-100 text-amber-800 border-amber-300",
    },
    ROLL: {
        label: "Bułki",
        icon: <Hamburger size={16} className="text-emerald-600" />,
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
    SWEET: {
        label: "Wypieki słodkie",
        icon: <Croissant size={16} className="text-pink-600" />,
        color: "text-pink-700 bg-pink-50 border-pink-200",
        badge: "bg-pink-100 text-pink-800 border-pink-300",
    },
    SAVORY: {
        label: "Wypieki słone",
        icon: <Pizza size={16} className="text-purple-600" />,
        color: "text-purple-700 bg-purple-50 border-purple-200",
        badge: "bg-purple-100 text-purple-800 border-purple-300",
    },
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

const WEEKDAY_NAMES = [
    "Poniedziałek",
    "Wtorek",
    "Środa",
    "Czwartek",
    "Piątek",
    "Sobota",
    "Niedziela",
];

const SHORT_WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        minimumFractionDigits: 2,
    }).format(amount);
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

const POLISH_DAYS_FULL = [
    "Niedziela",
    "Poniedziałek",
    "Wtorek",
    "Środa",
    "Czwartek",
    "Piątek",
    "Sobota",
];

function formatDateWithWeekday(dateStr: string): string {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return formatDate(dateStr);
    const [y, m, d] = parts;
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dayName = POLISH_DAYS_FULL[dateObj.getUTCDay()];
    return `${dayName}, ${formatDate(dateStr)}`;
}

const POLISH_MONTHS_GENITIVE = [
    "stycznia",
    "lutego",
    "marca",
    "kwietnia",
    "maja",
    "czerwca",
    "lipca",
    "sierpnia",
    "września",
    "października",
    "listopada",
    "grudnia",
];

function formatDailyReportLabel(dateStr: string): string {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dayName = POLISH_DAYS_FULL[dateObj.getUTCDay()];
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${dayName} (${dd}.${mm}.${y})`;
}

function formatWeeklyReportLabel(startDateStr: string, endDateStr: string): string {
    if (!startDateStr || !endDateStr) return "";
    const [sY, sM, sD] = startDateStr.split("-").map(Number);
    const [eY, eM, eD] = endDateStr.split("-").map(Number);
    if (!sY || !sM || !sD || !eY || !eM || !eD) return `${startDateStr} - ${endDateStr}`;

    const startDay = String(sD).padStart(2, "0");
    const startMonth = POLISH_MONTHS_GENITIVE[sM - 1];
    const endDay = String(eD).padStart(2, "0");
    const endMonth = POLISH_MONTHS_GENITIVE[eM - 1];

    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

function getReportTableLabel(b: any, isDays: boolean, isWeeks: boolean): string {
    if (isDays && b?.startDate) {
        return formatDailyReportLabel(b.startDate);
    }
    if (isWeeks && b?.startDate && b?.endDate) {
        return formatWeeklyReportLabel(b.startDate, b.endDate);
    }
    return b?.label || "";
}

export default function ProdukcjaPage() {
    const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
    const tomorrowStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split("T")[0];
    }, []);

    const [currentMonth, setCurrentMonth] = useState<string>(todayStr.slice(0, 7)); // "YYYY-MM"

    // Główne 4 zakładki: "CALENDAR" (domyślny), "LAST_7_DAYS", "LAST_WEEKS", "LAST_MONTHS"
    const [activeTab, setActiveTab] = useState<ActiveReportTab>("CALENDAR");

    // Stan analityki dla dni (raporty dzienne)
    const [daysOffset, setDaysOffset] = useState<number>(0);
    const [daysCount, setDaysCount] = useState<number>(7);
    const [daysCustomRange, setDaysCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [daysInputStart, setDaysInputStart] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return d.toISOString().split("T")[0];
    });
    const [daysInputEnd, setDaysInputEnd] = useState<string>(todayStr);
    const [daysAnalytics, setDaysAnalytics] = useState<any>(null);
    const [isLoadingDaysAnalytics, setIsLoadingDaysAnalytics] = useState<boolean>(false);

    // Stan analityki dla ostatnich tygodni (raporty tygodniowe)
    const [weeksOffset, setWeeksOffset] = useState<number>(0);
    const [weeksCount, setWeeksCount] = useState<number>(6);
    const [weeksCustomRange, setWeeksCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [weeksInputStart, setWeeksInputStart] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 35);
        return d.toISOString().split("T")[0];
    });
    const [weeksInputEnd, setWeeksInputEnd] = useState<string>(todayStr);
    const [weeksAnalytics, setWeeksAnalytics] = useState<any>(null);
    const [isLoadingWeeksAnalytics, setIsLoadingWeeksAnalytics] = useState<boolean>(false);

    // Stan analityki dla ostatnich miesięcy (raporty miesięczne)
    const [monthsOffset, setMonthsOffset] = useState<number>(0);
    const [monthsCount, setMonthsCount] = useState<number>(6);
    const [monthsCustomRange, setMonthsCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [monthsInputStart, setMonthsInputStart] = useState<string>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 5);
        return d.toISOString().split("T")[0].slice(0, 7);
    });
    const [monthsInputEnd, setMonthsInputEnd] = useState<string>(todayStr.slice(0, 7));
    const [monthsAnalytics, setMonthsAnalytics] = useState<any>(null);
    const [isLoadingMonthsAnalytics, setIsLoadingMonthsAnalytics] = useState<boolean>(false);

    const [daysSummary, setDaysSummary] = useState<DaySummary[]>([]);
    const [monthlyProductsData, setMonthlyProductsData] = useState<AggregatedProduct[]>([]);
    const [stats, setStats] = useState<MonthStats>({
        monthProduced: 0,
        monthSold: 0,
        monthBakeryIncome: 0,
        monthFiscalIncome: 0,
        monthTotalIncome: 0,
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
    const [copyingCategory, setCopyingCategory] = useState<string | null>(null);
    const [transferringProductId, setTransferringProductId] = useState<string | null>(null);
    const [transferredProductIds, setTransferredProductIds] = useState<Record<string, boolean>>({});
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);
    const [formDefaultClosingTime, setFormDefaultClosingTime] = useState<string>("18:00");
    const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<string[]>([]);
    const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(true);
    const [formIsNoSalesDay, setFormIsNoSalesDay] = useState<boolean>(false);
    const [showProductsEvenIfNoSales, setShowProductsEvenIfNoSales] = useState<boolean>(false);

    const handleToggleFavorite = async (recipeId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const isCurrentlyFav = favoriteRecipeIds.includes(recipeId);
        const updated = isCurrentlyFav
            ? favoriteRecipeIds.filter((id) => id !== recipeId)
            : [...favoriteRecipeIds, recipeId];

        setFavoriteRecipeIds(updated);

        try {
            await fetch("/api/przepisy/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: recipeId }),
            });
        } catch (err) {
            console.error("Błąd zapisu ulubionego przepisu:", err);
        }
    };

    // -------------------------------------------------------------
    // MODAL OZNACZANIA DNIA ZAMKNIĘTEGO (Remont, Święto itp.)
    // -------------------------------------------------------------
    const [closedDayModal, setClosedDayModal] = useState<{
        isOpen: boolean;
        date: string;
        isClosed: boolean;
        reason: string;
        isSaving: boolean;
    } | null>(null);

    const handleOpenClosedDayModal = (date: string, currentlyClosed: boolean, currentReason?: string) => {
        setClosedDayModal({
            isOpen: true,
            date,
            isClosed: !currentlyClosed,
            reason: currentReason || "Remont piekarni",
            isSaving: false,
        });
    };

    const handleSaveClosedDay = async (date: string, isClosed: boolean, reason: string) => {
        if (closedDayModal) {
            setClosedDayModal((prev) => (prev ? { ...prev, isSaving: true } : null));
        }
        try {
            const res = await fetch("/api/produkcja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "toggle_closed_day",
                    date,
                    isClosed,
                    reason,
                }),
            });

            if (res.ok) {
                setDaysSummary((prev) =>
                    prev.map((d) =>
                        d.date === date
                            ? { ...d, isClosed, closedReason: isClosed ? reason : "" }
                            : d
                    )
                );
                setClosedDayModal(null);
                fetchSummary(currentMonth);
                refreshActiveAnalytics();
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error || "Nie udało się zaktualizować statusu dnia"}`);
            }
        } catch (err) {
            console.error("Błąd zapisu dnia zamkniętego:", err);
            alert("Błąd połączenia z serwerem.");
        } finally {
            if (closedDayModal) {
                setClosedDayModal((prev) => (prev ? { ...prev, isSaving: false } : null));
            }
        }
    };

    // -------------------------------------------------------------
    // MODAL SUGEROWANEGO TYGODNIOWEGO PLANU PRODUKCJI
    // -------------------------------------------------------------
    const [isWeeklyPlanModalOpen, setIsWeeklyPlanModalOpen] = useState<boolean>(false);
    const [weeklyPlanStart, setWeeklyPlanStart] = useState<string>("");
    const [weeklyPlanData, setWeeklyPlanData] = useState<WeeklyPlanData | null>(null);
    const [isLoadingWeeklyPlan, setIsLoadingWeeklyPlan] = useState<boolean>(false);
    const [isSavingPlan, setIsSavingPlan] = useState<boolean>(false);
    const [isPlanSavedSuccessfully, setIsPlanSavedSuccessfully] = useState<boolean>(false);

    // -------------------------------------------------------------
    // MODAL SZCZEGÓŁOWEGO PODGLĄDU OKRESU (Dzień / Tydzień / Miesiąc)
    // -------------------------------------------------------------
    const [periodPreviewModal, setPeriodPreviewModal] = useState<{
        isOpen: boolean;
        title: string;
        subtitle: string;
        products: any[];
        totalProduced: number;
        totalSold: number;
        bakeryIncome: number;
        fiscalIncome: number;
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
                setMonthlyProductsData(data.monthlyProducts || []);
                if (data.stats) {
                    setStats(data.stats);
                }
                if (data.products) {
                    setAllProducts(data.products);
                }
                if (data.favoriteRecipeIds) {
                    setFavoriteRecipeIds(data.favoriteRecipeIds);
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

    // Nawigacja po miesiącach w kalendarzu
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
    // POBIERANIE DANYCH ANALITYCZNYCH (7 DNI / TYGODNIE / MIESIĄCE)
    // -------------------------------------------------------------
    const fetchAnalytics = async (
        type: "days" | "weeks" | "months",
        count: number,
        offset: number,
        customRange?: { startDate: string; endDate: string } | null
    ) => {
        try {
            if (type === "days") setIsLoadingDaysAnalytics(true);
            if (type === "weeks") setIsLoadingWeeksAnalytics(true);
            if (type === "months") setIsLoadingMonthsAnalytics(true);

            let url = `/api/produkcja?mode=analytics&type=${type}`;
            if (customRange && customRange.startDate && customRange.endDate) {
                url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
            } else {
                url += `&count=${count}&offset=${offset}`;
            }

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (type === "days") setDaysAnalytics(data);
                if (type === "weeks") setWeeksAnalytics(data);
                if (type === "months") setMonthsAnalytics(data);
            }
        } catch (e) {
            console.error("Błąd pobierania analityki:", e);
        } finally {
            if (type === "days") setIsLoadingDaysAnalytics(false);
            if (type === "weeks") setIsLoadingWeeksAnalytics(false);
            if (type === "months") setIsLoadingMonthsAnalytics(false);
        }
    };

    const refreshActiveAnalytics = () => {
        if (activeTab === "LAST_7_DAYS") {
            fetchAnalytics("days", daysCount, daysOffset, daysCustomRange);
        } else if (activeTab === "LAST_WEEKS") {
            fetchAnalytics("weeks", weeksCount, weeksOffset, weeksCustomRange);
        } else if (activeTab === "LAST_MONTHS") {
            fetchAnalytics("months", monthsCount, monthsOffset, monthsCustomRange);
        }
    };

    useEffect(() => {
        if (activeTab === "LAST_7_DAYS") {
            fetchAnalytics("days", daysCount, daysOffset, daysCustomRange);
        } else if (activeTab === "LAST_WEEKS") {
            fetchAnalytics("weeks", weeksCount, weeksOffset, weeksCustomRange);
        } else if (activeTab === "LAST_MONTHS") {
            fetchAnalytics("months", monthsCount, monthsOffset, monthsCustomRange);
        }
    }, [
        activeTab,
        daysCount,
        daysOffset,
        daysCustomRange,
        weeksCount,
        weeksOffset,
        weeksCustomRange,
        monthsCount,
        monthsOffset,
        monthsCustomRange,
    ]);

    // -------------------------------------------------------------
    // OBSŁUGA FORMULARZA RAPORTU DZIENNEGO
    // -------------------------------------------------------------
    const openNewReportModal = async (defaultDate?: string, prefillProducedMap?: Record<string, number>) => {
        const dateToUse = defaultDate || todayStr;
        setFormDate(dateToUse);
        setIsFormModalOpen(true);
        setIsLoadingFormData(true);
        setFormSaveSuccess(false);
        setFeedbackMessage(null);
        setTransferringProductId(null);
        setTransferredProductIds({});

        try {
            const res = await fetch(`/api/produkcja?date=${dateToUse}`);
            if (res.ok) {
                const data = await res.json();
                const isNoSales = Boolean(data.isClosed || data.noSales || (data.closedReason === "Brak sprzedaży"));
                setFormIsNoSalesDay(isNoSales);
                setShowProductsEvenIfNoSales(false);
                setAllProducts(data.products || []);
                if (data.favoriteRecipeIds) {
                    setFavoriteRecipeIds(data.favoriteRecipeIds);
                }

                setFormFiscalIncome(data.fiscalIncome > 0 ? String(data.fiscalIncome) : "");

                const isManualReportSaved = Boolean(
                    data.hasReport ||
                    data.fiscalIncome > 0 ||
                    data.noSales ||
                    data.isClosed ||
                    (data.productions || []).some(
                        (p: any) => Number(p.producedAmount) > 0 || Number(p.soldAmount) > 0 || (p.soldOutTime && String(p.soldOutTime).trim())
                    )
                );

                const itemsMap: Record<string, ProductionDetailItem> = {};
                (data.products || []).forEach((prod: BakeryProduct) => {
                    const existingProd = (data.productions || []).find(
                        (p: any) => p.bakeryProductId === prod.id
                    );

                    let initProduced = "";
                    let initCarriedOver = "";
                    if (existingProd) {
                        if (Number(existingProd.producedAmount) > 0) {
                            initProduced = String(existingProd.producedAmount);
                        }
                        if (Number(existingProd.carriedOverAmount) > 0) {
                            initCarriedOver = String(existingProd.carriedOverAmount);
                        }
                    } else if (prefillProducedMap && prefillProducedMap[prod.id] !== undefined) {
                        initProduced = String(prefillProducedMap[prod.id]);
                    }

                    let initSold = "";
                    let initLeftover = "";
                    let initStatus = "";
                    const existingSoldOut = data.soldOutTimes?.[prod.id] || existingProd?.soldOutTime || "";

                    if (existingProd && isManualReportSaved) {
                        const pVal = Number(existingProd.producedAmount) || 0;
                        const cVal = Number(existingProd.carriedOverAmount) || 0;
                        const totalAssort = pVal + cVal;
                        const sVal = Number(existingProd.soldAmount) || 0;

                        if (existingSoldOut && existingSoldOut.trim() !== "") {
                            initSold = String(sVal > 0 ? sVal : totalAssort);
                            initLeftover = "0";
                            initStatus = existingSoldOut.trim();
                        } else if (totalAssort > 0 && sVal < totalAssort) {
                            const left = Math.max(0, Math.round((totalAssort - sVal) * 100) / 100);
                            const actualUnsold = cVal > 0 ? Math.max(0, Math.round((left - cVal) * 100) / 100) : left;

                            if (sVal <= 0 || actualUnsold <= 0) {
                                initSold = "";
                                initLeftover = "";
                                initStatus = "";
                            } else {
                                initSold = String(sVal);
                                initLeftover = String(actualUnsold);
                                initStatus = String(actualUnsold);
                            }
                        } else if (sVal > 0) {
                            initSold = String(sVal);
                            initLeftover = "0";
                            initStatus = "";
                        }
                    }

                    itemsMap[prod.id] = {
                        bakeryProductId: prod.id,
                        producedAmount: initProduced,
                        carriedOverAmount: initCarriedOver,
                        leftoverAmount: initLeftover,
                        soldAmount: initSold,
                        soldOutTime: existingSoldOut,
                        statusInput: initStatus,
                    };
                });
                setFormItems(itemsMap);
                if (data.defaultClosingTime) {
                    setFormDefaultClosingTime(data.defaultClosingTime);
                }
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
        setFormItems((prev) => {
            const current = prev[productId] || {
                bakeryProductId: productId,
                producedAmount: "",
                carriedOverAmount: "",
                leftoverAmount: "",
                soldAmount: "",
                soldOutTime: "",
                statusInput: "",
            };

            const updated = { ...current, [field]: value };

            const parseNum = (val: string) => {
                if (val === "" || val === undefined || val === null) return null;
                const parsed = parseFloat(String(val).replace(",", "."));
                return isNaN(parsed) ? null : parsed;
            };

            const prod = parseNum(field === "producedAmount" ? value : current.producedAmount) || 0;
            const carriedOver = parseNum(field === "carriedOverAmount" ? value : current.carriedOverAmount) || 0;
            const totalAssort = prod + carriedOver;
            const hasAssortment = (field === "producedAmount" ? value : current.producedAmount) !== "" || (field === "carriedOverAmount" ? value : current.carriedOverAmount) !== "";

            if (field === "producedAmount" || field === "carriedOverAmount") {
                const sInput = (current.statusInput || "").trim();
                if (hasAssortment) {
                    if (sInput.includes(":")) {
                        updated.leftoverAmount = "0";
                        updated.soldOutTime = sInput;
                        updated.soldAmount = String(totalAssort);
                    } else if (sInput !== "") {
                        const clean = sInput.toLowerCase().replace("szt.", "").replace("szt", "").trim();
                        const left = parseNum(clean);
                        if (left !== null) {
                            const newSold = Math.max(0, Math.round((totalAssort - left) * 100) / 100);
                            updated.soldAmount = String(newSold);
                            updated.leftoverAmount = String(left);
                            updated.soldOutTime = left === 0 ? (formDefaultClosingTime || "18:00") : "";
                        }
                    } else {
                        updated.soldAmount = totalAssort > 0 ? String(totalAssort) : "";
                    }
                }
            }

            return {
                ...prev,
                [productId]: updated,
            };
        });
    };

    const handleStatusInputChange = (productId: string, rawVal: string) => {
        setFormItems((prev) => {
            const current = prev[productId] || {
                bakeryProductId: productId,
                producedAmount: "",
                carriedOverAmount: "",
                leftoverAmount: "",
                soldAmount: "",
                soldOutTime: "",
                statusInput: "",
            };

            const prod = parseFloat(String(current.producedAmount || "0").replace(",", ".")) || 0;
            const carried = parseFloat(String(current.carriedOverAmount || "0").replace(",", ".")) || 0;
            const total = prod + carried;
            const hasAssortment = (current.producedAmount !== "" && current.producedAmount !== "0") || (current.carriedOverAmount !== "" && current.carriedOverAmount !== "0");

            const updated: ProductionDetailItem = {
                ...current,
                statusInput: rawVal,
            };

            const trimmed = rawVal.trim();

            if (trimmed === "") {
                updated.leftoverAmount = "";
                updated.soldOutTime = "";
                updated.soldAmount = hasAssortment && total > 0 ? String(total) : "";
            } else if (trimmed.includes(":")) {
                // DWUKROPEK -> wszystko się wyprzedało o tej godzinie!
                updated.leftoverAmount = "0";
                updated.soldOutTime = trimmed;
                updated.soldAmount = hasAssortment ? String(total) : "";
            } else {
                // BRAK DWUKROPKA -> zwykła liczba, czyli ile zostało!
                const clean = trimmed.toLowerCase().replace("szt.", "").replace("szt", "").trim();
                const parsedLeft = parseFloat(clean.replace(",", "."));
                if (!isNaN(parsedLeft)) {
                    updated.leftoverAmount = String(parsedLeft);
                    updated.soldOutTime = "";
                    if (hasAssortment) {
                        const sold = Math.max(0, Math.round((total - parsedLeft) * 100) / 100);
                        updated.soldAmount = String(sold);
                        if (parsedLeft === 0 && total > 0) {
                            updated.soldOutTime = formDefaultClosingTime || "18:00";
                        }
                    }
                } else {
                    updated.leftoverAmount = trimmed;
                }
            }

            return {
                ...prev,
                [productId]: updated,
            };
        });
    };

    const handleSaveReportFormInternal = async () => {
        const defaultClosing = formDefaultClosingTime || "18:00";
        const updatedFormItems = { ...formItems };

        const itemsPayload = Object.values(formItems).map((it) => {
            if (formIsNoSalesDay) {
                return {
                    bakeryProductId: it.bakeryProductId,
                    producedAmount: 0,
                    carriedOverAmount: 0,
                    soldAmount: 0,
                    soldOutTime: null,
                };
            }

            const prod = parseFloat(String(it.producedAmount || "0").replace(",", ".")) || 0;
            const carried = parseFloat(String(it.carriedOverAmount || "0").replace(",", ".")) || 0;
            const total = prod + carried;
            let sold = parseFloat(String(it.soldAmount || "0").replace(",", ".")) || 0;
            let soldOutTime = it.soldOutTime ? String(it.soldOutTime).trim() : "";
            const statusVal = it.statusInput !== undefined ? it.statusInput.trim() : (it.soldOutTime || it.leftoverAmount || "");

            if (statusVal.includes(":")) {
                sold = total;
                soldOutTime = statusVal;
                updatedFormItems[it.bakeryProductId] = {
                    ...it,
                    leftoverAmount: "0",
                    soldAmount: String(sold),
                    soldOutTime: soldOutTime,
                    statusInput: statusVal,
                };
            } else if (statusVal !== "") {
                const clean = statusVal.toLowerCase().replace("szt.", "").replace("szt", "").trim();
                const left = parseFloat(clean.replace(",", ".")) || 0;
                sold = Math.max(0, Math.round((total - left) * 100) / 100);
                soldOutTime = left === 0 ? defaultClosing : "";
                updatedFormItems[it.bakeryProductId] = {
                    ...it,
                    leftoverAmount: String(left),
                    soldAmount: String(sold),
                    soldOutTime: soldOutTime,
                    statusInput: statusVal,
                };
            } else {
                // Puste pole: jeśli wyprodukowano X sztuk, domyślnie wyprzedano całość z godziną zamknięcia
                if (total > 0) {
                    sold = total;
                    soldOutTime = defaultClosing;
                    updatedFormItems[it.bakeryProductId] = {
                        ...it,
                        leftoverAmount: "0",
                        soldAmount: String(sold),
                        soldOutTime: soldOutTime,
                        statusInput: "",
                    };
                }
            }

            return {
                bakeryProductId: it.bakeryProductId,
                producedAmount: prod,
                carriedOverAmount: carried,
                soldAmount: sold,
                soldOutTime: soldOutTime || null,
            };
        });

        if (!formIsNoSalesDay) {
            setFormItems(updatedFormItems);
        }

        const fiscalVal = formIsNoSalesDay ? 0 : (parseFloat(formFiscalIncome.replace(",", ".")) || 0);

        const res = await fetch("/api/produkcja", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                date: formDate,
                items: itemsPayload,
                fiscalIncome: fiscalVal,
                isNoSalesDay: formIsNoSalesDay,
            }),
        });
        return res;
    };

    const handleSaveReportForm = async () => {
        setIsSavingForm(true);
        setFormSaveSuccess(false);
        setFeedbackMessage(null);

        try {
            const res = await handleSaveReportFormInternal();

            if (res.ok) {
                setFormSaveSuccess(true);
                setTimeout(() => {
                    setIsFormModalOpen(false);
                    setFormSaveSuccess(false);
                    fetchSummary(currentMonth);
                    refreshActiveAnalytics();
                }, 800);
            }
        } catch (error) {
            console.error("Błąd podczas zapisu raportu:", error);
        } finally {
            setIsSavingForm(false);
        }
    };

    const handleCopyCategoryPreviousDayProduction = async (catKey: string, catLabel?: string) => {
        setCopyingCategory(catKey);
        setFeedbackMessage(null);

        const d = new Date(formDate);
        d.setDate(d.getDate() - 1);
        const prevDateStr = d.toISOString().split("T")[0];

        try {
            const res = await fetch(`/api/produkcja?date=${prevDateStr}`);
            if (res.ok) {
                const data = await res.json();
                const productions = data.productions || [];
                let copiedCount = 0;

                setFormItems((prev) => {
                    const updated = { ...prev };
                    const catProducts = allProducts.filter((prod) => prod.type === catKey);

                    catProducts.forEach((prod) => {
                        const prevProd = productions.find((p: any) => p.bakeryProductId === prod.id);
                        const prevProduced = prevProd ? Number(prevProd.producedAmount) : 0;

                        if (prevProduced > 0) {
                            copiedCount++;
                            const current = updated[prod.id] || {
                                bakeryProductId: prod.id,
                                producedAmount: "",
                                carriedOverAmount: "",
                                leftoverAmount: "",
                                soldAmount: "",
                                soldOutTime: "",
                            };

                            const carried = parseFloat(String(current.carriedOverAmount || "0").replace(",", ".")) || 0;
                            const totalAssort = prevProduced + carried;
                            const left = current.leftoverAmount !== "" ? (parseFloat(String(current.leftoverAmount).replace(",", ".")) || 0) : null;

                            let sVal = current.soldAmount;
                            if (left !== null) {
                                sVal = String(Math.max(0, Math.round((totalAssort - left) * 100) / 100));
                            }

                            updated[prod.id] = {
                                ...current,
                                producedAmount: String(prevProduced),
                                soldAmount: sVal,
                            };
                        }
                    });
                    return updated;
                });

                const label = catLabel || catKey;
                if (copiedCount > 0) {
                    setFeedbackMessage({
                        type: "success",
                        text: `Skopiowano produkcję kategorii ${label} (${copiedCount} pozycji) z dnia ${formatDate(prevDateStr)}.`,
                    });
                } else {
                    setFeedbackMessage({
                        type: "info",
                        text: `Brak zapisanej produkcji dla kategorii ${label} w dniu ${formatDate(prevDateStr)}.`,
                    });
                }
            }
        } catch (err) {
            console.error("Błąd kopiowania produkcji kategorii z poprzedniego dnia:", err);
            setFeedbackMessage({
                type: "error",
                text: "Nie udało się pobrać danych z poprzedniego dnia.",
            });
        } finally {
            setCopyingCategory(null);
        }
    };

    const handleTransferProductLeftover = async (product: BakeryProduct) => {
        const it = formItems[product.id];
        if (!it) return;
        const leftAmt = parseFloat(String(it.leftoverAmount || "0").replace(",", ".")) || 0;
        if (leftAmt <= 0) return;

        setTransferringProductId(product.id);
        setFeedbackMessage(null);

        const d = new Date(formDate);
        d.setDate(d.getDate() + 1);
        const nextDateStr = d.toISOString().split("T")[0];

        try {
            await handleSaveReportFormInternal();

            const res = await fetch("/api/produkcja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "transfer_leftovers",
                    targetDate: nextDateStr,
                    items: [{
                        bakeryProductId: product.id,
                        leftoverAmount: it.leftoverAmount,
                    }],
                }),
            });

            if (res.ok) {
                setTransferredProductIds((prev) => ({ ...prev, [product.id]: true }));
                setFeedbackMessage({
                    type: "success",
                    text: `Pomyślnie przeniesiono ${leftAmt.toLocaleString("pl-PL")} szt. (${product.name}) na dzień ${formatDate(nextDateStr)}!`,
                });
                fetchSummary(currentMonth);
                refreshActiveAnalytics();
            } else {
                const errData = await res.json();
                setFeedbackMessage({
                    type: "error",
                    text: errData.error || `Nie udało się przenieść produktu ${product.name}.`,
                });
            }
        } catch (err) {
            console.error("Błąd przenoszenia produktu:", err);
            setFeedbackMessage({
                type: "error",
                text: "Wystąpił błąd podczas komunikacji z serwerem.",
            });
        } finally {
            setTransferringProductId(null);
        }
    };

    // Lista wszystkich produktów posortowanych kategoriami
    const allFormProducts = useMemo(() => {
        const list: BakeryProduct[] = [];
        Object.keys(CATEGORY_MAP).forEach((catKey) => {
            const prods = allProducts.filter((p) => p.type === catKey);
            list.push(...prods);
        });
        const knownIds = new Set(list.map((p) => p.id));
        allProducts.forEach((p) => {
            if (!knownIds.has(p.id)) {
                list.push(p);
            }
        });
        return list;
    }, [allProducts]);

    // Lista produktów widocznych w formularzu raportu (z uwzględnieniem filtra ulubionych z gwiazdką)
    const formOrderedProducts = useMemo(() => {
        if (!showOnlyFavorites || favoriteRecipeIds.length === 0) {
            return allFormProducts;
        }

        return allFormProducts.filter((p) => {
            if (favoriteRecipeIds.includes(p.id)) return true;
            // Nie ukrywaj produktu, jeśli użytkownik wpisał w nim jakiekolwiek dane dla tego dnia
            const it = formItems[p.id];
            if (it) {
                const pVal = parseFloat(String(it.producedAmount || "0").replace(",", ".")) || 0;
                const cVal = parseFloat(String(it.carriedOverAmount || "0").replace(",", ".")) || 0;
                const sVal = parseFloat(String(it.soldAmount || "0").replace(",", ".")) || 0;
                const lVal = parseFloat(String(it.leftoverAmount || "0").replace(",", ".")) || 0;
                if (pVal > 0 || cVal > 0 || sVal > 0 || lVal > 0 || (it.soldOutTime && it.soldOutTime.trim() !== "") || (it.statusInput && it.statusInput.trim() !== "")) {
                    return true;
                }
            }
            return false;
        });
    }, [allFormProducts, showOnlyFavorites, favoriteRecipeIds, formItems]);

    // Obsługa nawigacji strzałkami (góra, dół, lewo, prawo) oraz Enter w tabeli raportu
    const handleGridKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        rowIndex: number,
        colIndex: number
    ) => {
        const totalRows = formOrderedProducts.length;
        if (totalRows === 0) return;

        const focusInput = (el: HTMLInputElement | null) => {
            if (el) {
                el.focus();
                el.select();
                el.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
        };

        if (e.key === "ArrowDown" || e.key === "Enter") {
            e.preventDefault();
            const nextRow = (rowIndex + 1) % totalRows;
            const target = document.querySelector<HTMLInputElement>(
                `input[data-row="${nextRow}"][data-col="${colIndex}"]`
            );
            focusInput(target);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevRow = (rowIndex - 1 + totalRows) % totalRows;
            const target = document.querySelector<HTMLInputElement>(
                `input[data-row="${prevRow}"][data-col="${colIndex}"]`
            );
            focusInput(target);
        } else if (e.key === "ArrowRight") {
            if (colIndex === 0) {
                e.preventDefault();
                const target = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex}"][data-col="1"]`
                );
                focusInput(target);
            } else if (colIndex === 1 && rowIndex < totalRows - 1) {
                e.preventDefault();
                const target = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex + 1}"][data-col="0"]`
                );
                focusInput(target);
            }
        } else if (e.key === "ArrowLeft") {
            if (colIndex === 1) {
                e.preventDefault();
                const target = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex}"][data-col="0"]`
                );
                focusInput(target);
            } else if (colIndex === 0 && rowIndex > 0) {
                e.preventDefault();
                const target = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex - 1}"][data-col="1"]`
                );
                focusInput(target);
            }
        }
    };



    // -------------------------------------------------------------
    // OBSŁUGA TYGODNIOWEGO PLANU PRODUKCJI
    // -------------------------------------------------------------
    const getUpcomingMondayStr = (refDateStr: string = todayStr): string => {
        const [y, m, d] = refDateStr.split("-").map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        const day = date.getUTCDay(); // 0 = Nd, 1 = Pon, ..., 6 = Sob

        let daysToAdd = (8 - day) % 7;
        if (daysToAdd === 0) daysToAdd = 7;

        let targetUtc: number;
        if (day >= 1 && day <= 2) {
            // Poniedziałek lub wtorek: bieżący poniedziałek
            targetUtc = date.getTime() - (day - 1) * 24 * 60 * 60 * 1000;
        } else {
            // Od środy wzwyż lub niedziela: poniedziałek nadchodzącego tygodnia
            targetUtc = date.getTime() + daysToAdd * 24 * 60 * 60 * 1000;
        }
        return new Date(targetUtc).toISOString().split("T")[0];
    };

    const fetchWeeklyPlan = async (mondayStr: string) => {
        setIsLoadingWeeklyPlan(true);
        try {
            const res = await fetch(`/api/produkcja/plan?weekStart=${mondayStr}`);
            if (res.ok) {
                const data = await res.json();
                setWeeklyPlanData(data);
            }
        } catch (err) {
            console.error("Błąd pobierania planu tygodniowego:", err);
        } finally {
            setIsLoadingWeeklyPlan(false);
        }
    };

    const openWeeklyPlanModal = (startDate?: string) => {
        const monday = startDate || weeklyPlanStart || getUpcomingMondayStr();
        setWeeklyPlanStart(monday);
        setIsWeeklyPlanModalOpen(true);
        fetchWeeklyPlan(monday);
    };

    const handleShiftWeek = (weeksDelta: number) => {
        if (!weeklyPlanStart) return;
        const [y, m, d] = weeklyPlanStart.split("-").map(Number);
        const date = new Date(Date.UTC(y, m - 1, d + weeksDelta * 7));
        const newMondayStr = date.toISOString().split("T")[0];
        setWeeklyPlanStart(newMondayStr);
        fetchWeeklyPlan(newMondayStr);
    };

    const handleQuantityChange = (productId: string, dateStr: string, rawVal: string) => {
        const cleanStr = rawVal.replace(/[^\d]/g, "");
        const numVal = cleanStr === "" ? 0 : parseInt(cleanStr, 10);

        setWeeklyPlanData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                categories: prev.categories.map((cat) => ({
                    ...cat,
                    products: cat.products.map((p) => {
                        if (p.id !== productId) return p;
                        return {
                            ...p,
                            dailyAmounts: {
                                ...p.dailyAmounts,
                                [dateStr]: numVal,
                            },
                        };
                    }),
                })),
            };
        });
    };

    const handleSaveWeeklyPlan = async () => {
        if (!weeklyPlanData) return;
        setIsSavingPlan(true);
        try {
            const amounts: Record<string, Record<string, number>> = {};
            weeklyPlanData.categories.forEach((cat) => {
                cat.products.forEach((p) => {
                    amounts[p.id] = { ...p.dailyAmounts };
                });
            });

            const res = await fetch("/api/produkcja/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weekStart: weeklyPlanData.weekStart,
                    amounts,
                }),
            });

            if (res.ok) {
                const resJson = await res.json();
                setWeeklyPlanData((prev) => prev ? { ...prev, isCustomSaved: true, savedAt: resJson.savedAt } : null);
                setIsPlanSavedSuccessfully(true);
                setTimeout(() => {
                    setIsPlanSavedSuccessfully(false);
                }, 2500);
            } else {
                alert("Wystąpił błąd podczas zapisywania planu tygodniowego.");
            }
        } catch (err) {
            console.error("Błąd zapisu planu tygodniowego:", err);
            alert("Nie udało się połączyć z serwerem.");
        } finally {
            setIsSavingPlan(false);
        }
    };

    const handleResetToSuggested = async () => {
        if (!weeklyPlanStart) return;
        if (!window.confirm("Czy na pewno chcesz przywrócić sugerowany plan wyliczony automatycznie z historii sprzedaży? Wszelkie ręczne zmiany dla tego tygodnia zostaną nadpisane.")) return;
        setIsLoadingWeeklyPlan(true);
        try {
            const res = await fetch(`/api/produkcja/plan?weekStart=${weeklyPlanStart}&reset=true`);
            if (res.ok) {
                const data = await res.json();
                setWeeklyPlanData(data);
            }
        } catch (err) {
            console.error("Błąd resetowania planu tygodniowego:", err);
        } finally {
            setIsLoadingWeeklyPlan(false);
        }
    };

    const handlePrintOrDownloadPdf = () => {
        if (!weeklyPlanData) return;

        const { weekStart, weekEnd, days, categories, grandDailyTotals, grandWeeklyTotal, totalEstimatedRevenue } = weeklyPlanData;
        const formattedRange = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;
        const docTitle = `Plan_produkcji_${weekStart}_do_${weekEnd}`;

        const tableHeaderHtml = `
            <thead>
                <tr>
                    <th style="width: 28%; text-align: left; padding: 6px 8px;">Wyrób / Produkt</th>
                    ${days.map((d) => `<th style="width: 10%; text-align: center; padding: 6px 4px;">${d.dayShort}<br /><span style="font-weight: 400; font-size: 8.5px; color: #555;">${d.dateFormatted}</span></th>`).join("")}
                </tr>
            </thead>
        `;

        const categoryRowsHtml = categories.map((cat) => {
            const categoryHeader = `
                <tr style="background-color: #e2e8f0; font-weight: bold; border-top: 1.5px solid #334155;">
                    <td colspan="${days.length + 1}" style="text-align: left; padding: 5px 8px; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: #0f172a;">
                        ${cat.label} 
                    </td>
                </tr>
            `;

            const productRows = cat.products.map((p) => `
                <tr>
                    <td style="text-align: left; padding: 4px 8px; font-weight: 500;">
                        ${p.name}
                    </td>
                    ${days.map((d) => {
                const amt = p.dailyAmounts[d.dateStr] || 0;
                return `<td style="text-align: center; padding: 4px; ${amt === 0 ? "color: #94a3b8;" : "font-weight: 600; color: #0f172a;"}">${amt > 0 ? amt : "—"}</td>`;
            }).join("")}
                </tr>
            `).join("");



            return categoryHeader + productRows;
        }).join("");


        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>${docTitle}</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 8mm 10mm;
                    }
                    * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                        color: #0f172a;
                        background: #fff;
                        margin: 0;
                        padding: 0;
                        font-size: 9.5px;
                        line-height: 1.3;
                    }
                    .doc-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 6px;
                        margin-bottom: 8px;
                    }
                    .brand {
                        font-size: 15px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: -0.01em;
                    }
                    .doc-subtitle {
                        font-size: 11px;
                        color: #475569;
                        margin-top: 1px;
                    }
                    .doc-meta {
                        text-align: right;
                        font-size: 9px;
                        color: #64748b;
                    }
                    .kpis {
                        display: flex;
                        gap: 12px;
                        margin-bottom: 8px;
                    }
                    .kpi-card {
                        border: 1px solid #e2e8f0;
                        background: #f8fafc;
                        padding: 4px 10px;
                        border-radius: 4px;
                    }
                    .kpi-title { font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 700; }
                    .kpi-num { font-size: 12px; font-weight: 800; color: #0f172a; }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9px;
                    }
                    th, td {
                        border: 1px solid #cbd5e1;
                    }
                    th {
                        background-color: #f1f5f9;
                        font-size: 9px;
                        padding: 4px 6px;
                    }
                    .doc-footer {
                        margin-top: 10px;
                        display: flex;
                        justify-content: space-between;
                        font-size: 8.5px;
                        color: #64748b;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 6px;
                    }
                    .signature-box {
                        display: flex;
                        gap: 40px;
                        margin-top: 12px;
                        font-size: 8.5px;
                        color: #475569;
                    }
                    .sig-line {
                        border-bottom: 1px dotted #94a3b8;
                        width: 140px;
                        display: inline-block;
                        margin-left: 6px;
                    }
                </style>
            </head>
            <body>
                <div class="doc-header">
                    <div>
                        <div class="brand">Tygodniowy plan produkcji</div>
                        <div class="doc-subtitle">${formattedRange}</div>
                    </div>
                    <div class="doc-meta">
                        Wygenerowano: ${new Date().toLocaleString("pl-PL")}<br />
                    </div>
                </div>

                <table>
                    ${tableHeaderHtml}
                    <tbody>
                        ${categoryRowsHtml}
                    </tbody>
                </table>

            </body>
            </html>
        `;

        const printWin = window.open("", "_blank");
        if (printWin) {
            printWin.document.write(html);
            printWin.document.close();
            printWin.focus();
            setTimeout(() => {
                printWin.print();
            }, 300);
        }
    };

    // -------------------------------------------------------------
    // PRZYGOTOWANIE KALENDARZA (Siatka 7 kolumn)
    // -------------------------------------------------------------
    const calendarGrid = useMemo(() => {
        const [yearStr, monthNumStr] = currentMonth.split("-");
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthNumStr, 10);

        const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
        const totalDays = lastDayOfMonth.getUTCDate();

        // Dzień tygodnia 1. dnia miesiąca: 0 (Pon) do 6 (Nd)
        let startDayOfWeek = firstDayOfMonth.getUTCDay();
        startDayOfWeek = (startDayOfWeek + 6) % 7;

        const cells = [];
        // Puste komórki przed 1. dniem
        for (let i = 0; i < startDayOfWeek; i++) {
            cells.push({ isCurrentMonth: false });
        }

        // Komórki dni miesiąca
        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${currentMonth}-${String(d).padStart(2, "0")}`;
            const dayData = daysSummary.find((item) => item.date === dateStr);
            const dateObj = new Date(`${dateStr}T00:00:00.000Z`);
            const isSunday = dateObj.getUTCDay() === 0;
            const isPastOrToday = dateStr <= todayStr;

            cells.push({
                isCurrentMonth: true,
                dayNumber: d,
                dateStr,
                dayData,
                isSunday,
                isPastOrToday,
            });
        }

        return cells;
    }, [currentMonth, daysSummary, todayStr]);

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative space-y-6">
            {/* ---------------- GÓRNY NAGŁÓWEK STRONY ---------------- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ui-black">
                        Produkcja i sprzedaż
                    </h1>
                </div>

                {/* Górne przyciski akcji i selektor miesiąca */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => openWeeklyPlanModal()}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm cursor-pointer"
                        title="Wygeneruj sugerowany plan produkcji na cały nadchodzący tydzień (poniedziałek – sobota)"
                    >
                        <Sparkles size={16} className="text-ui-secondary" />
                        <span>Tygodniowy plan produkcji</span>
                    </button>

                    <div className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-2 border border-ui-accent bg-ui-accent/20 text-ui-primary px-3 py-1.5 sm:py-1 rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-ui-accent/15 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            title="Poprzedni miesiąc"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-2 text-xs sm:text-sm font-bold min-w-[110px] text-center">
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

            {/* ---------------- KARTY PODSUMOWANIA MIESIĄCA (Gdy aktywny Kalendarz) ---------------- */}
            {activeTab === "CALENDAR" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* KARTA 1: UTARG Z WYPIEKÓW */}
                    <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    Utarg ze sprzedaży ({POLISH_MONTHS[parseInt(currentMonth.split("-")[1], 10) - 1]})
                                </span>
                                <Coins size={18} className="text-ui-secondary" />
                            </div>
                            <div className="mt-2 text-2xl sm:text-3xl font-black text-ui-primary tracking-tight">
                                {formatCurrency(stats.monthTotalIncome !== undefined && stats.monthTotalIncome > 0 ? stats.monthTotalIncome : (stats.monthFiscalIncome > 0 ? stats.monthFiscalIncome : stats.monthBakeryIncome))}
                            </div>
                        </div>
                    </div>

                    {/* KARTA 2: STATUS RAPORTÓW */}
                    <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    Kompletność raportów
                                </span>
                                <CheckCircle2 size={18} className="text-ui-secondary" />
                            </div>
                            <div className="mt-2 text-2xl sm:text-3xl font-black text-ui-primary tracking-tight">
                                {daysSummary.filter((d) => d.hasReport).length}{" "}
                                <span className="text-sm text-ui-secondary font-normal">dni z raportem</span>
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
            )}

            {/* ---------------- 4 GŁÓWNE ZAKŁADKI STRONY RAPORTÓW ---------------- */}
            <div className="flex gap-1.5 sm:gap-2 border-b border-ui-accent pb-px mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab("CALENDAR")}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "CALENDAR"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <CalendarIcon size={15} />
                    <span>Kalendarz</span>
                </button>

                <button
                    onClick={() => {
                        setActiveTab("LAST_7_DAYS");
                        setDaysOffset(0);
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "LAST_7_DAYS"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <span>Raporty dzienne</span>
                </button>

                <button
                    onClick={() => {
                        setActiveTab("LAST_WEEKS");
                        setWeeksOffset(0);
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "LAST_WEEKS"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <span>Raporty tygodniowe</span>
                </button>

                <button
                    onClick={() => {
                        setActiveTab("LAST_MONTHS");
                        setMonthsOffset(0);
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "LAST_MONTHS"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <span>Raporty miesięczne</span>
                </button>
            </div>

            {/* ========================================================= */}
            {/* ZAKŁADKA 1: KALENDARZ (WIDOK DOMYŚLNY)                    */}
            {/* ========================================================= */}
            {activeTab === "CALENDAR" && (
                <div className="bg-white border border-ui-accent rounded-2xl p-4 sm:p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-ui-accent/30">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-xl font-bold text-ui-primary">
                                {POLISH_MONTHS[parseInt(currentMonth.split("-")[1], 10) - 1]} {currentMonth.split("-")[0]}
                            </h2>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] sm:text-xs text-ui-black">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                <span>Produkcja i utarg</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                <span>Tylko utarg</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></span>
                                <span>Brak raportu</span>
                            </div>
                        </div>
                    </div>

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
                                        className="h-20 sm:h-24 rounded-2xl bg-ui-accent/5 border border-dashed border-ui-accent/20 opacity-30"
                                    />
                                );
                            }

                            const isClosed = Boolean(cell.dayData && cell.dayData.isClosed);
                            const totalProduced = Number(cell.dayData?.totalProduced || 0);
                            const totalSold = Number(cell.dayData?.totalSold || 0);
                            const hasProduction = Boolean(
                                cell.dayData && (
                                    (cell.dayData.totalProduced || 0) > 0 ||
                                    (cell.dayData.totalSold || 0) > 0
                                )
                            );
                            const income = Number(cell.dayData?.fiscalIncome || cell.dayData?.bakerySalesIncome || 0);
                            const hasIncome = income > 0;
                            const isOnlyIncome = !isClosed && hasIncome && !hasProduction;
                            const hasFullProduction = !isClosed && hasProduction;
                            const hasData = hasFullProduction || isOnlyIncome;
                            const isMissing = !hasData && cell.isPastOrToday && !cell.isSunday && !isClosed;

                            return (
                                <div
                                    key={cell.dateStr}
                                    onClick={() => {
                                        if (cell.isPastOrToday) {
                                            openNewReportModal(cell.dateStr);
                                        } else if (isClosed) {
                                            handleOpenClosedDayModal(cell.dateStr!, true, cell.dayData?.closedReason);
                                        }
                                    }}
                                    className={`h-20 sm:h-24 rounded-2xl p-2.5 border transition-all flex flex-col justify-between cursor-pointer ${isClosed
                                        ? "bg-slate-100/70 border-slate-200 text-slate-500 hover:border-slate-300"
                                        : hasFullProduction
                                            ? "bg-emerald-50/40 border-emerald-300/80 hover:border-emerald-500 hover:shadow-md ring-1 ring-emerald-200/50"
                                            : isOnlyIncome
                                                ? "bg-amber-50/40 border-amber-300/80 hover:border-amber-400 hover:shadow-xs ring-1 ring-amber-200/40"
                                                : isMissing
                                                    ? "bg-rose-50/50 border-rose-300 hover:border-rose-400 hover:shadow-xs"
                                                    : cell.isSunday
                                                        ? "bg-slate-100/50 border-slate-200/60 opacity-40 cursor-default"
                                                        : "bg-ui-white border-ui-accent/30 hover:border-amber-400"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={`text-xs font-black px-2 py-0.5 rounded-lg ${cell.dateStr === todayStr
                                                ? "bg-ui-primary text-white"
                                                : isClosed || cell.isSunday
                                                    ? "text-slate-600 bg-slate-200/70"
                                                    : hasFullProduction
                                                        ? "text-emerald-900 bg-emerald-100"
                                                        : isOnlyIncome
                                                            ? "text-amber-900 bg-amber-100"
                                                            : isMissing
                                                                ? "text-rose-900 bg-rose-100"
                                                                : "text-ui-black bg-ui-accent/15"
                                                }`}
                                        >
                                            {cell.dayNumber}
                                        </span>
                                        {isClosed && (
                                            <span className="text-[10px] font-bold text-slate-500">
                                                Zamknięte
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div className="text-right">
                                            {income > 0 ? (
                                                <div className="text-xs sm:text-sm font-black text-ui-primary">
                                                    {formatCurrency(income)}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* ZAKŁADKI 2, 3, 4: ANALITYKA I WYKRESY (7 DNI, TYG, MIES)   */}
            {/* ========================================================= */}
            {activeTab !== "CALENDAR" && (() => {
                const isDays = activeTab === "LAST_7_DAYS";
                const isWeeks = activeTab === "LAST_WEEKS";
                const isMonths = activeTab === "LAST_MONTHS";

                const currentAnalytics = isDays ? daysAnalytics : isWeeks ? weeksAnalytics : monthsAnalytics;
                const isLoadingCurrent = isDays ? isLoadingDaysAnalytics : isWeeks ? isLoadingWeeksAnalytics : isLoadingMonthsAnalytics;
                const offsetVal = isDays ? daysOffset : isWeeks ? weeksOffset : monthsOffset;
                const setOffsetFn = isDays ? setDaysOffset : isWeeks ? setWeeksOffset : setMonthsOffset;
                const countVal = isDays ? daysCount : isWeeks ? weeksCount : monthsCount;
                const setCountFn = isDays ? setDaysCount : isWeeks ? setWeeksCount : setMonthsCount;
                const customRange = isDays ? daysCustomRange : isWeeks ? weeksCustomRange : monthsCustomRange;
                const setCustomRangeFn = isDays ? setDaysCustomRange : isWeeks ? setWeeksCustomRange : setMonthsCustomRange;
                const inputStart = isDays ? daysInputStart : isWeeks ? weeksInputStart : monthsInputStart;
                const setInputStartFn = isDays ? setDaysInputStart : isWeeks ? setWeeksInputStart : setMonthsInputStart;
                const inputEnd = isDays ? daysInputEnd : isWeeks ? weeksInputEnd : monthsInputEnd;
                const setInputEndFn = isDays ? setDaysInputEnd : isWeeks ? setWeeksInputEnd : setMonthsInputEnd;

                const tabTitle = isDays ? "Raporty dzienne" : isWeeks ? "Raporty tygodniowe" : "Raporty miesięczne";
                const buckets = currentAnalytics?.buckets || [];
                const totalStats = currentAnalytics?.totalStats || {
                    totalProduced: 0,
                    totalSold: 0,
                    totalUnsold: 0,
                    totalIncome: 0,
                    sellThroughRate: 0,
                };

                // Transformacja danych dla Recharts (Grouped + Stacked)
                const chartData = buckets.map((b: any) => ({
                    id: b.id,
                    label: b.label,
                    subLabel: b.subLabel,
                    startDate: b.startDate,
                    endDate: b.endDate,
                    rawBucket: b,
                    // Chleby
                    BREAD_sold: b.BREAD?.sold || 0,
                    BREAD_unsold: b.BREAD?.unsold || 0,
                    BREAD_produced: b.BREAD?.produced || 0,
                    // Bułki
                    ROLL_sold: b.ROLL?.sold || 0,
                    ROLL_unsold: b.ROLL?.unsold || 0,
                    ROLL_produced: b.ROLL?.produced || 0,
                    // Słodkie
                    SWEET_sold: b.SWEET?.sold || 0,
                    SWEET_unsold: b.SWEET?.unsold || 0,
                    SWEET_produced: b.SWEET?.produced || 0,
                    // Słone
                    SAVORY_sold: b.SAVORY?.sold || 0,
                    SAVORY_unsold: b.SAVORY?.unsold || 0,
                    SAVORY_produced: b.SAVORY?.produced || 0,
                }));

                // Własny Tooltip dla Recharts
                const CustomChartTooltip = ({ active, payload }: any) => {
                    if (!active || !payload || !payload.length) return null;
                    const itemData = payload[0]?.payload;
                    const raw = itemData?.rawBucket;
                    if (!raw) return null;

                    const categories = [
                        { key: "BREAD", label: "Chleby", color: "#D97706", lightColor: "#FDE68A", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900" },
                        { key: "ROLL", label: "Bułki", color: "#059669", lightColor: "#A7F3D0", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" },
                        { key: "SWEET", label: "Wypieki słodkie", color: "#DB2777", lightColor: "#FBCFE8", bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-900" },
                        { key: "SAVORY", label: "Wypieki słone", color: "#9333EA", lightColor: "#E9D5FF", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-900" },
                    ];

                    return (
                        <div className="bg-white/95 backdrop-blur-md border border-ui-accent rounded-2xl p-4 shadow-xl text-xs min-w-[280px] max-w-[340px] z-50">
                            <div className="border-b border-ui-accent/40 pb-2 mb-2.5">
                                <div className="font-extrabold text-sm text-ui-black">
                                    {itemData.startDate === itemData.endDate
                                        ? formatDateWithWeekday(itemData.startDate)
                                        : `${formatDate(itemData.startDate)} - ${formatDate(itemData.endDate)}`}
                                </div>
                            </div>

                            {/* Podsumowanie ogólne okresu */}
                            <div className="grid grid-cols-2 gap-2 mb-3 bg-ui-accent/10 p-2 rounded-xl border border-ui-accent/30">
                                <div>
                                    <div className="text-[10px] text-ui-secondary font-medium">Utarg</div>
                                    <div className="text-xs text-ui-primary">{formatCurrency(raw.totalIncome)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-ui-secondary font-medium">Wyprodukowano</div>
                                    <div className="text-xs text-ui-black">{raw.totalProduced.toLocaleString("pl-PL")} szt.</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-ui-secondary font-medium">Sprzedano</div>
                                    <div className="text-xs text-emerald-700">
                                        {raw.totalSold.toLocaleString("pl-PL")} szt. ({raw.sellThroughRate}%)
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-ui-secondary font-medium">Niesprzedane</div>
                                    <div className="text-xs text-rose-700">{raw.totalUnsold.toLocaleString("pl-PL")} szt. ({raw.totalProduced > 0 ? Math.round((raw.totalUnsold / raw.totalProduced) * 1000) / 10 : 0}%)</div>
                                </div>

                            </div>

                            {/* Szczegóły 4 kategorii */}
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-ui-secondary">Podział na kategorie:</div>
                                {categories.map((c) => {
                                    const catData = raw[c.key] || { produced: 0, sold: 0, unsold: 0, income: 0 };
                                    const rate = catData.produced > 0 ? Math.round((catData.sold / catData.produced) * 100) : 0;
                                    return (
                                        <div key={c.key} className={`p-1.5 rounded-lg border ${c.bg} ${c.border} flex items-center justify-between`}>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                                                <span className={`font-bold ${c.text}`}>{c.label}:</span>
                                            </div>
                                            <div className="text-right">
                                                <span className=" text-ui-black">{catData.sold}</span>
                                                <span className="text-ui-black"> / {catData.produced} szt.</span>
                                                {catData.produced > 0 && (
                                                    <span className="ml-1 text-[10px] font-bold text-ui-black">({rate}%)</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                };

                return (
                    <div className="space-y-6">
                        {/* 1. PASEK NAWIGACJI PO OKRESACH I WYBÓR ZAKRESU */}
                        <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2.5 bg-ui-secondary/20 rounded-xl text-ui-secondary shadow-sm">
                                        <BarChart3 size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-sm sm:text-base font-extrabold text-ui-black">
                                            {tabTitle}
                                        </h2>
                                        <div className="text-xs text-ui-secondary font-medium flex items-center gap-1.5 flex-wrap">
                                            {currentAnalytics?.startDate && currentAnalytics?.endDate ? (
                                                <>
                                                    <span><b>{formatDate(currentAnalytics.startDate)}</b> do <b>{formatDate(currentAnalytics.endDate)}</b></span>
                                                    <span className="text-[10px] bg-ui-accent/30 text-ui-primary font-bold px-2 py-0.5 rounded-full">
                                                        {buckets.length} {isDays ? (buckets.length === 1 ? "dzień" : buckets.length < 5 ? "dni" : "dni") : isWeeks ? (buckets.length === 1 ? "tydzień" : buckets.length < 5 ? "tygodnie" : "tygodni") : (buckets.length === 1 ? "miesiąc" : buckets.length < 5 ? "miesiące" : "miesięcy")}
                                                    </span>
                                                </>
                                            ) : (
                                                "Analiza słupkowa produkcji i sprzedaży"
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Selektor zakresu (rozwijana lista) */}
                                <div className="relative">
                                    <select
                                        value={
                                            isDays
                                                ? customRange
                                                    ? customRange.startDate === `${todayStr.slice(0, 7)}-01` && customRange.endDate === todayStr
                                                        ? "THIS_MONTH"
                                                        : "CUSTOM"
                                                    : String(countVal)
                                                : isWeeks
                                                    ? customRange
                                                        ? "CUSTOM"
                                                        : String(countVal)
                                                    : customRange
                                                        ? customRange.startDate === `${todayStr.slice(0, 4)}-01` && customRange.endDate === `${todayStr.slice(0, 4)}-12`
                                                            ? "THIS_YEAR"
                                                            : "CUSTOM"
                                                        : String(countVal)
                                        }
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (isDays) {
                                                if (val === "THIS_MONTH") {
                                                    const s = `${todayStr.slice(0, 7)}-01`;
                                                    const eStr = todayStr;
                                                    setInputStartFn(s);
                                                    setInputEndFn(eStr);
                                                    setCustomRangeFn({ startDate: s, endDate: eStr });
                                                } else if (val === "CUSTOM") {
                                                    setCustomRangeFn({ startDate: inputStart, endDate: inputEnd });
                                                } else {
                                                    setCustomRangeFn(null);
                                                    setOffsetFn(0);
                                                    setCountFn(parseInt(val, 10));
                                                }
                                            } else if (isWeeks) {
                                                if (val === "CUSTOM") {
                                                    setCustomRangeFn({ startDate: inputStart, endDate: inputEnd });
                                                } else {
                                                    setCustomRangeFn(null);
                                                    setOffsetFn(0);
                                                    setCountFn(parseInt(val, 10));
                                                }
                                            } else if (isMonths) {
                                                if (val === "THIS_YEAR") {
                                                    const s = `${todayStr.slice(0, 4)}-01`;
                                                    const eStr = `${todayStr.slice(0, 4)}-12`;
                                                    setInputStartFn(s);
                                                    setInputEndFn(eStr);
                                                    setCustomRangeFn({ startDate: s, endDate: eStr });
                                                } else if (val === "CUSTOM") {
                                                    setCustomRangeFn({ startDate: inputStart, endDate: inputEnd });
                                                } else {
                                                    setCustomRangeFn(null);
                                                    setOffsetFn(0);
                                                    setCountFn(parseInt(val, 10));
                                                }
                                            }
                                        }}
                                        className="bg-ui-white border border-ui-accent text-ui-primary text-xs font-semibold rounded-lg pl-2.5 pr-7 py-1 sm:py-1.5 shadow-2xs focus:outline-none focus:border-ui-secondary transition-all cursor-pointer appearance-none min-w-[140px]"
                                    >
                                        {isDays && (
                                            <>
                                                <option value="7">Ostatnie 7 dni</option>
                                                <option value="14">Ostatnie 14 dni</option>
                                                <option value="30">Ostatnie 30 dni</option>
                                                <option value="THIS_MONTH">Bieżący miesiąc</option>
                                                <option value="CUSTOM">Własny zakres dat...</option>
                                            </>
                                        )}
                                        {isWeeks && (
                                            <>
                                                <option value="4">Ostatnie 4 tygodnie</option>
                                                <option value="6">Ostatnie 6 tygodni</option>
                                                <option value="8">Ostatnie 8 tygodni</option>
                                                <option value="12">Ostatnie 12 tygodni</option>
                                                <option value="CUSTOM">Własny zakres dat...</option>
                                            </>
                                        )}
                                        {isMonths && (
                                            <>
                                                <option value="3">Ostatnie 3 miesiące</option>
                                                <option value="6">Ostatnie 6 miesięcy</option>
                                                <option value="12">Ostatnie 12 miesięcy</option>
                                                <option value="THIS_YEAR">Bieżący rok</option>
                                                <option value="CUSTOM">Własny zakres dat...</option>
                                            </>
                                        )}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-ui-secondary">
                                        <ChevronDown size={13} />
                                    </div>
                                </div>
                            </div>

                            {/* Wiersz drugorzędny: Kontrolki nawigacji paginacji lub selektor własnego zakresu dat */}
                            <div className="pt-2.5 border-t border-ui-accent/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                                {customRange ? (
                                    <div className="flex flex-wrap items-center gap-2.5 w-full justify-between">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-ui-secondary">Zakres od:</span>
                                            <input
                                                type={isMonths ? "month" : "date"}
                                                value={inputStart}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInputStartFn(val);
                                                    if (val && inputEnd && val <= inputEnd) {
                                                        setCustomRangeFn({ startDate: val, endDate: inputEnd });
                                                    }
                                                }}
                                                className="bg-ui-white border border-ui-accent rounded-lg px-2.5 py-1 font-bold text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-2xs"
                                            />
                                            <span className="font-bold text-ui-secondary">do:</span>
                                            <input
                                                type={isMonths ? "month" : "date"}
                                                value={inputEnd}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInputEndFn(val);
                                                    if (inputStart && val && inputStart <= val) {
                                                        setCustomRangeFn({ startDate: inputStart, endDate: val });
                                                    }
                                                }}
                                                className="bg-ui-white border border-ui-accent rounded-lg px-2.5 py-1 font-bold text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-2xs"
                                            />

                                            <button
                                                onClick={() => {
                                                    if (inputStart && inputEnd && inputStart <= inputEnd) {
                                                        setCustomRangeFn({ startDate: inputStart, endDate: inputEnd });
                                                    } else {
                                                        alert("Wprowadź poprawny zakres (data początkowa nie może być późniejsza niż końcowa).");
                                                    }
                                                }}
                                                className="px-3 py-1 bg-ui-primary text-white font-bold rounded-lg hover:bg-ui-primary/90 transition-colors shadow-2xs cursor-pointer"
                                            >
                                                Zastosuj
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setCustomRangeFn(null);
                                                setOffsetFn(0);
                                            }}
                                            className="flex items-center gap-1 text-ui-secondary hover:text-ui-primary font-semibold transition-colors cursor-pointer"
                                        >
                                            <RotateCcw size={12} />
                                            <span>Wróć do standardowych okresów</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setOffsetFn(offsetVal + 1)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-white text-ui-primary rounded-lg font-bold shadow-2xs hover:bg-ui-accent/20 transition-all cursor-pointer border border-ui-accent/40"
                                                title="Generuj wykres dla wcześniejszego okresu"
                                            >
                                                <ChevronLeft size={14} />
                                                <span>Wcześniejsze</span>
                                            </button>

                                            {offsetVal > 0 && (
                                                <button
                                                    onClick={() => setOffsetFn(0)}
                                                    className="px-2.5 py-1.5 font-bold text-ui-secondary hover:text-ui-primary transition-colors cursor-pointer"
                                                    title="Wróć do aktualnego okresu"
                                                >
                                                    <RotateCcw size={13} className="inline mr-1" />
                                                    Bieżące
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setOffsetFn(Math.max(0, offsetVal - 1))}
                                                disabled={offsetVal === 0}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all ${offsetVal === 0
                                                    ? "text-ui-secondary/40 bg-transparent cursor-not-allowed"
                                                    : "bg-white text-ui-primary shadow-2xs hover:bg-ui-accent/20 cursor-pointer border border-ui-accent/40"
                                                    }`}
                                                title="Następny okres"
                                            >
                                                <span>Późniejsze</span>
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>



                        {/* 3. GŁÓWNY WYKRES SŁUPKOWY */}
                        <div className="bg-white border border-ui-accent rounded-2xl p-5 sm:p-6 shadow-xs">
                            <div className="flex items-center justify-center">
                                {/* 2. LEGENDA KATEGORII I ODCIENI */}

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Chleby */}
                                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center gap-3">
                                        <div className="flex flex-col w-5 h-8 rounded overflow-hidden border border-amber-400/50 shrink-0 shadow-xs">
                                            <div className="flex-1 bg-[#FDE68A]" title="Niesprzedane (jaśniejszy)" />
                                            <div className="h-5 bg-[#D97706]" title="Sprzedane (ciemniejszy)" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-extrabold text-amber-900 flex items-center gap-1">
                                                <Wheat size={13} className="text-amber-700" /> Chleby
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bułki */}
                                    <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-3">
                                        <div className="flex flex-col w-5 h-8 rounded overflow-hidden border border-emerald-400/50 shrink-0 shadow-xs">
                                            <div className="flex-1 bg-[#A7F3D0]" title="Niesprzedane (jaśniejszy)" />
                                            <div className="h-5 bg-[#059669]" title="Sprzedane (ciemniejszy)" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                                                <Hamburger size={13} className="text-emerald-700" /> Bułki
                                            </div>
                                        </div>
                                    </div>

                                    {/* Słodkie */}
                                    <div className="p-2.5 rounded-xl bg-pink-50/60 border border-pink-200/80 flex items-center gap-3">
                                        <div className="flex flex-col w-5 h-8 rounded overflow-hidden border border-pink-400/50 shrink-0 shadow-xs">
                                            <div className="flex-1 bg-[#FBCFE8]" title="Niesprzedane (jaśniejszy)" />
                                            <div className="h-5 bg-[#DB2777]" title="Sprzedane (ciemniejszy)" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-extrabold text-pink-900 flex items-center gap-1">
                                                <Croissant size={13} className="text-pink-700" /> Wypieki słodkie
                                            </div>
                                        </div>
                                    </div>

                                    {/* Słone */}
                                    <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/80 flex items-center gap-3">
                                        <div className="flex flex-col w-5 h-8 rounded overflow-hidden border border-purple-400/50 shrink-0 shadow-xs">
                                            <div className="flex-1 bg-[#E9D5FF]" title="Niesprzedane (jaśniejszy)" />
                                            <div className="h-5 bg-[#9333EA]" title="Sprzedane (ciemniejszy)" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-extrabold text-purple-900 flex items-center gap-1">
                                                <Pizza size={13} className="text-purple-700" /> Wypieki słone
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {isLoadingCurrent && (
                                <div className="flex items-center gap-1.5 text-xs text-ui-secondary font-bold">
                                    <Loader2 size={14} className="animate-spin text-ui-secondary" /> Ładowanie danych...
                                </div>
                            )}

                            {chartData.length === 0 ? (
                                <div className="p-16 text-center text-ui-secondary text-sm">
                                    Brak danych produkcyjnych dla wybranego zakresu.
                                </div>
                            ) : (
                                <div className="w-full h-80 sm:h-96">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={chartData}
                                            margin={{ top: 20, right: 10, left: -10, bottom: 20 }}
                                            barGap={4}
                                            barCategoryGap="18%"
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                            <XAxis
                                                dataKey="label"
                                                tickLine={false}
                                                axisLine={{ stroke: "#CBD5E1" }}
                                                tick={{ fill: "#475569", fontSize: 11, fontWeight: 700 }}
                                                dy={6}
                                            />
                                            <YAxis
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: "#64748B", fontSize: 10 }}
                                                unit=" szt."
                                            />
                                            <RechartsTooltip content={<CustomChartTooltip />} />

                                            {/* SŁUPEK 1: CHLEBY (Sprzedane ciemny + Niesprzedane jasny) */}
                                            <Bar dataKey="BREAD_sold" stackId="BREAD" fill="#D97706" name="Chleby (Sprzedaż)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="BREAD_unsold" stackId="BREAD" fill="#FDE68A" name="Chleby (Niesprzedane)" radius={[4, 4, 0, 0]} />

                                            {/* SŁUPEK 2: BUŁKI (Sprzedane ciemny + Niesprzedane jasny) */}
                                            <Bar dataKey="ROLL_sold" stackId="ROLL" fill="#059669" name="Bułki (Sprzedaż)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="ROLL_unsold" stackId="ROLL" fill="#A7F3D0" name="Bułki (Niesprzedane)" radius={[4, 4, 0, 0]} />

                                            {/* SŁUPEK 3: SŁODKIE (Sprzedane ciemny + Niesprzedane jasny) */}
                                            <Bar dataKey="SWEET_sold" stackId="SWEET" fill="#DB2777" name="Słodkie (Sprzedaż)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="SWEET_unsold" stackId="SWEET" fill="#FBCFE8" name="Słodkie (Niesprzedane)" radius={[4, 4, 0, 0]} />

                                            {/* SŁUPEK 4: SŁONE (Sprzedane ciemny + Niesprzedane jasny) */}
                                            <Bar dataKey="SAVORY_sold" stackId="SAVORY" fill="#9333EA" name="Słone (Sprzedaż)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="SAVORY_unsold" stackId="SAVORY" fill="#E9D5FF" name="Słone (Niesprzedane)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* 4. KARTY STATYSTYK OKRESU (KPI) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                                    Wyprodukowano
                                    <Wheat size={14} className="text-ui-secondary" />
                                </div>
                                <div className="mt-2 text-xl sm:text-2xl font-black text-ui-black">
                                    {totalStats.totalProduced.toLocaleString("pl-PL")}{" "}szt.
                                </div>
                            </div>

                            <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                                    Sprzedano
                                    <CheckCircle2 size={14} className="text-ui-secondary" />
                                </div>
                                <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-700">
                                    {totalStats.totalSold.toLocaleString("pl-PL")} szt.
                                    <span className="text-xs font-semibold text-emerald-800/80 ml-2">
                                        ({Math.round(totalStats.sellThroughRate)}%)
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                                    Niesprzedane
                                    <AlertCircle size={14} className="text-ui-secondary" />
                                </div>
                                <div className="mt-2 text-xl sm:text-2xl font-black text-rose-700">
                                    {totalStats.totalUnsold.toLocaleString("pl-PL")}{" "} szt.
                                    <span className="text-xs font-semibold text-rose-600/70 ml-2">
                                        ({Math.round(100 - totalStats.sellThroughRate)}%)
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                                    Utarg ze sprzedaży
                                    <Coins size={14} className="text-ui-secondary" />
                                </div>
                                <div className="mt-2 text-xl sm:text-2xl font-black text-ui-primary">
                                    {formatCurrency(totalStats.totalIncome)}
                                </div>
                            </div>
                        </div>

                        {/* 5. TABELA ZESTAWIENIA LICZBOWEGO Z PODZIAŁEM NA KATEGORIE */}
                        <div className="bg-white border border-ui-accent rounded-2xl overflow-hidden shadow-xs">
                            <div className="p-4 border-b border-ui-accent/40 flex items-center justify-between">
                                <h3 className="text-xs sm:text-sm font-extrabold text-ui-black">
                                    {tabTitle}
                                </h3>

                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-center text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider text-[10px] border-b border-ui-accent">
                                            <th className="py-3 px-3.5 text-center sticky left-0 bg-ui-accent/10">Okres / Data</th>
                                            <th className="py-3 px-2 text-center">
                                                <span className="text-amber-800">Chleby</span>
                                            </th>
                                            <th className="py-3 px-2 text-center">
                                                <span className="text-emerald-800">Bułki</span>
                                            </th>
                                            <th className="py-3 px-2 text-center">
                                                <span className="text-pink-800">Wypieki słodkie</span>
                                            </th>
                                            <th className="py-3 px-2 text-center">
                                                <span className="text-purple-800">Wypieki słone</span>
                                            </th>
                                            <th className="py-3 px-3 text-center text-amber-800 bg-amber-500/10">Produkcja</th>
                                            <th className="py-3 px-3 text-center text-emerald-700 bg-emerald-500/10">Sprzedaż</th>
                                            <th className="py-3 px-3 text-center text-rose-700 bg-rose-500/10">Straty</th>
                                            <th className="py-3 px-2.5 text-center">Skuteczność</th>
                                            <th className="py-3 px-3.5 text-center">Utarg</th>
                                            <th className="py-3 px-3 text-center">Akcja</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/30">
                                        {buckets.map((b: any) => {
                                            const loss = Math.max(0, (b.totalProduced || 0) - (b.totalSold || 0));
                                            return (
                                                <tr
                                                    key={b.id}
                                                    onClick={() => {
                                                        if (isDays) {
                                                            openNewReportModal(b.startDate);
                                                        } else {
                                                            setPeriodPreviewModal({
                                                                isOpen: true,
                                                                title: getReportTableLabel(b, isDays, isWeeks),
                                                                subtitle: b.startDate === b.endDate ? formatDate(b.startDate) : `${formatDate(b.startDate)} do ${formatDate(b.endDate)}`,
                                                                products: b.products || [],
                                                                totalProduced: b.totalProduced,
                                                                totalSold: b.totalSold,
                                                                bakeryIncome: b.totalIncome,
                                                                fiscalIncome: 0,
                                                            });
                                                        }
                                                    }}
                                                    className="hover:bg-ui-accent/10 transition-colors cursor-pointer"
                                                >
                                                    <td className="py-3 px-3.5 text-sm text-ui-black text-left sticky left-0 bg-ui-accent/10">
                                                        <div>{getReportTableLabel(b, isDays, isWeeks)}</div>
                                                    </td>

                                                    {/* Chleby */}
                                                    <td className="py-3 px-2 text-center font-semibold text-sm">
                                                        <span className="text-amber-800">{b.BREAD?.sold || 0}</span>
                                                        <span className="text-ui-black font-normal"> / {b.BREAD?.produced || 0}</span>
                                                    </td>

                                                    {/* Bułki */}
                                                    <td className="py-3 px-2 text-center font-semibold text-sm">
                                                        <span className="text-emerald-800">{b.ROLL?.sold || 0}</span>
                                                        <span className="text-ui-black font-normal"> / {b.ROLL?.produced || 0}</span>
                                                    </td>

                                                    {/* Słodkie */}
                                                    <td className="py-3 px-2 text-center font-semibold text-sm">
                                                        <span className="text-pink-800">{b.SWEET?.sold || 0}</span>
                                                        <span className="text-ui-black font-normal"> / {b.SWEET?.produced || 0}</span>
                                                    </td>

                                                    {/* Słone */}
                                                    <td className="py-3 px-2 text-center font-semibold text-sm">
                                                        <span className="text-purple-800">{b.SAVORY?.sold || 0}</span>
                                                        <span className="text-ui-black font-normal"> / {b.SAVORY?.produced || 0}</span>
                                                    </td>

                                                    {/* Razem prod */}
                                                    <td className="py-3 px-3 text-center text-amber-900 bg-amber-500/5 text-sm">
                                                        {b.totalProduced.toLocaleString("pl-PL")} szt.
                                                    </td>

                                                    {/* Razem sprz */}
                                                    <td className="py-3 px-3 text-center text-emerald-700 bg-emerald-500/5 text-sm">
                                                        {b.totalSold.toLocaleString("pl-PL")} szt.
                                                    </td>

                                                    {/* Straty */}
                                                    <td className="py-3 px-3 text-center text-rose-700 bg-rose-500/5 text-sm">
                                                        {loss > 0 ? `-${loss.toLocaleString("pl-PL")} szt.` : "0 szt."}
                                                    </td>

                                                    {/* Skuteczność */}
                                                    <td className="py-3 px-2.5 text-center">
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                            {b.sellThroughRate}%
                                                        </span>
                                                    </td>

                                                    {/* Utarg */}
                                                    <td className="py-3 px-3.5 text-center font-semibold text-ui-primary text-sm">
                                                        {formatCurrency(b.totalIncome)}
                                                    </td>

                                                    {/* Akcja */}
                                                    <td className="py-3 px-3 text-center">
                                                        <span className="inline-flex items-center justify-center text-center text-xs font-semibold border border-ui-accent hover:bg-ui-accent/30 text-ui-primary px-3 py-1 rounded-lg transition-colors cursor-pointer w-full max-w-[80px]">
                                                            {isDays ? "Raport" : "Wyroby"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-ui-accent/20 font-black text-ui-black border-t-2 border-ui-accent auto-ml">
                                            <td className="py-3.5 px-3.5 uppercase text-xs">
                                                Podsumowanie okresu
                                            </td>
                                            <td className="py-3.5 px-2 text-center text-sm text-amber-900 font-extrabold">
                                                {buckets.reduce((acc: number, b: any) => acc + (b.BREAD?.sold || 0), 0)} / {buckets.reduce((acc: number, b: any) => acc + (b.BREAD?.produced || 0), 0)}
                                            </td>
                                            <td className="py-3.5 px-2 text-center text-sm text-emerald-900 font-extrabold">
                                                {buckets.reduce((acc: number, b: any) => acc + (b.ROLL?.sold || 0), 0)} / {buckets.reduce((acc: number, b: any) => acc + (b.ROLL?.produced || 0), 0)}
                                            </td>
                                            <td className="py-3.5 px-2 text-center text-sm text-pink-900 font-extrabold">
                                                {buckets.reduce((acc: number, b: any) => acc + (b.SWEET?.sold || 0), 0)} / {buckets.reduce((acc: number, b: any) => acc + (b.SWEET?.produced || 0), 0)}
                                            </td>
                                            <td className="py-3.5 px-2 text-center text-sm text-purple-900 font-extrabold">
                                                {buckets.reduce((acc: number, b: any) => acc + (b.SAVORY?.sold || 0), 0)} / {buckets.reduce((acc: number, b: any) => acc + (b.SAVORY?.produced || 0), 0)}
                                            </td>
                                            <td className="py-3.5 px-3 text-center text-sm text-amber-900 bg-amber-500/10 font-black">
                                                {totalStats.totalProduced.toLocaleString("pl-PL")} szt.
                                            </td>
                                            <td className="py-3.5 px-3 text-center text-sm text-emerald-700 bg-emerald-500/10 font-black">
                                                {totalStats.totalSold.toLocaleString("pl-PL")} szt.
                                            </td>
                                            <td className="py-3.5 px-3 text-center text-sm text-rose-700 bg-rose-500/10 font-black">
                                                {(() => {
                                                    const totalLoss = Math.max(0, (totalStats.totalProduced || 0) - (totalStats.totalSold || 0));
                                                    return totalLoss > 0 ? `-${totalLoss.toLocaleString("pl-PL")} szt.` : "0 szt.";
                                                })()}
                                            </td>
                                            <td className="py-3.5 px-2.5 text-center font-bold text-emerald-800">
                                                {totalStats.sellThroughRate}%
                                            </td>
                                            <td className="py-3.5 px-3.5 text-center text-sm text-ui-primary font-black">
                                                {formatCurrency(totalStats.totalIncome)}
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                —
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ========================================================= */}
            {/* MODAL 1: FORMULARZ WPROWADZANIA RAPORTU                   */}
            {/* ========================================================= */}
            {isFormModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsFormModalOpen(false)}
                >
                    <div
                        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Nagłówek Formularza */}
                        <div className="p-4 sm:p-5 border-b border-ui-accent bg-ui-accent/10 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base sm:text-lg font-extrabold text-ui-black flex items-center gap-2">
                                    Raport: <span className="font-bold text-ui-black">{formatDate(formDate)}</span>
                                </h2>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowOnlyFavorites((prev) => !prev)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer border ${showOnlyFavorites && favoriteRecipeIds.length > 0
                                        ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                                        : "bg-white text-ui-primary border-ui-accent hover:bg-ui-accent/30"
                                        }`}
                                    title={showOnlyFavorites ? "Kliknij, aby odkryć wszystkie przepisy w raporcie" : "Kliknij, aby ukryć rzadko używane przepisy"}
                                >
                                    <Star
                                        size={13}
                                        className={showOnlyFavorites && favoriteRecipeIds.length > 0 ? "text-amber-500 fill-amber-400" : "text-ui-secondary"}
                                    />
                                    <span>
                                        {showOnlyFavorites && favoriteRecipeIds.length > 0
                                            ? `Tylko oznaczone (${formOrderedProducts.length}/${allProducts.length})`
                                            : `Wszystkie wyroby (${allProducts.length})`}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormIsNoSalesDay((prev) => {
                                            const next = !prev;
                                            if (next) {
                                                setFormFiscalIncome("0");
                                                setShowProductsEvenIfNoSales(false);
                                            }
                                            return next;
                                        });
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer border ${formIsNoSalesDay
                                        ? "bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100"
                                        : "bg-white text-ui-primary border-ui-accent hover:bg-ui-accent/30"
                                        }`}
                                    title={formIsNoSalesDay ? "Kliknij, aby przywrócić normalny dzień" : "Oznacz ten dzień jako brak sprzedaży"}
                                >
                                    <Ban
                                        size={13}
                                        className={formIsNoSalesDay ? "text-rose-600" : "text-ui-secondary"}
                                    />
                                    <span>Brak sprzedaży</span>
                                </button>

                                <button
                                    onClick={() => setIsFormModalOpen(false)}
                                    className="p-1.5 hover:bg-ui-accent/20 rounded-full text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Informacja zwrotna */}
                        {feedbackMessage && (
                            <div className={`p-3 text-xs font-bold border-b flex items-center gap-2 ${feedbackMessage.type === "success"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : feedbackMessage.type === "error"
                                    ? "bg-rose-50 text-rose-800 border-rose-200"
                                    : "bg-sky-50 text-sky-800 border-sky-200"
                                }`}>
                                {feedbackMessage.type === "success" && <CheckCircle2 size={16} />}
                                {feedbackMessage.type === "error" && <AlertCircle size={16} />}
                                {feedbackMessage.type === "info" && <Info size={16} />}
                                <span>{feedbackMessage.text}</span>
                            </div>
                        )}

                        {/* Ciało Formularza (Tabela produktów) */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                            {isLoadingFormData ? (
                                <div className="p-20 flex flex-col items-center justify-center gap-3 text-ui-secondary text-sm">
                                    <Loader2 size={28} className="animate-spin text-ui-secondary" />
                                    Wczytywanie pozycji wypieków...
                                </div>
                            ) : (
                                <div className="space-y-6">

                                    {formIsNoSalesDay && !showProductsEvenIfNoSales ? (
                                        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-600">
                                                <Ban size={22} className="text-slate-500" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-ui-black">Dzień oznaczony jako brak sprzedaży</h4>
                                                <p className="text-xs text-ui-secondary max-w-md mx-auto mt-1 leading-relaxed">
                                                    Wartości utargu i sprzedaży dla tego dnia zostaną zapisane jako 0. Dzień w kalendarzu będzie oznaczony jako bez sprzedaży i nie będzie wykazywany jako zaległy raport.
                                                </p>
                                            </div>
                                            <div className="pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowProductsEvenIfNoSales(true)}
                                                    className="text-xs text-ui-secondary hover:text-ui-black underline font-semibold transition-colors cursor-pointer"
                                                >
                                                    Pokaż / edytuj pozycje wyrobów (opcjonalnie)
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {formIsNoSalesDay && showProductsEvenIfNoSales && (
                                                <div className="flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowProductsEvenIfNoSales(false)}
                                                        className="text-xs text-ui-secondary hover:text-ui-black underline font-semibold cursor-pointer"
                                                    >
                                                        Zwiń listę wyrobów
                                                    </button>
                                                </div>
                                            )}

                                            {/* Pole Utargu z Kasy Fiskalnej */}
                                            <div className="bg-ui-accent/15 border border-ui-accent rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-xs font-bold text-ui-black flex items-center gap-1.5">
                                                        <Receipt size={16} className="text-ui-primary" />
                                                        Utarg z kasy fiskalnej:
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={formFiscalIncome}
                                                        onChange={(e) => setFormFiscalIncome(e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-32 px-3 py-1.5 bg-white border border-ui-accent rounded-xl text-sm font-black text-ui-primary text-right focus:outline-none focus:border-ui-primary shadow-2xs"
                                                    />
                                                    <span className="text-xs font-bold text-ui-secondary">zł</span>
                                                </div>
                                            </div>

                                            {/* Podział na kategorie w formularzu */}
                                            {Object.entries(CATEGORY_MAP).map(([catKey, catMeta]) => {
                                                const catProducts = formOrderedProducts.filter((p) => p.type === catKey);
                                                const totalInCat = allFormProducts.filter((p) => p.type === catKey).length;
                                                if (catProducts.length === 0) return null;

                                                return (
                                                    <div key={catKey} className="border border-ui-accent rounded-xl overflow-hidden shadow-2xs">
                                                        <div className={`px-4 py-2 font-bold text-xs flex items-center justify-between border-b ${catMeta.color}`}>
                                                            <div className="flex items-center gap-2">
                                                                {catMeta.icon}
                                                                <span>
                                                                    {catMeta.label.toUpperCase()} ({catProducts.length}{catProducts.length < totalInCat ? ` z ${totalInCat}` : ""})
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopyCategoryPreviousDayProduction(catKey, catMeta.label)}
                                                                disabled={copyingCategory === catKey}
                                                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs  bg-white text-ui-primary border border-ui-accent hover:bg-ui-accent/30 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                                                                title={`Skopiuj wyprodukowane ilości dla: ${catMeta.label} z poprzedniego dnia`}
                                                            >
                                                                {copyingCategory === catKey ? (
                                                                    <Loader2 size={13} className="animate-spin text-ui-secondary" />
                                                                ) : (
                                                                    <Copy size={13} className="text-ui-secondary" />
                                                                )}
                                                                <span className="font-semibold">Skopiuj z wczoraj</span>
                                                            </button>
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[700px]">
                                                                <colgroup>
                                                                    <col className="w-[42%]" />
                                                                    <col className="w-[11%]" />
                                                                    <col className="w-[12%]" />
                                                                    <col className="w-[15%]" />
                                                                    <col className="w-[10%]" />
                                                                    <col className="w-[10%]" />
                                                                </colgroup>
                                                                <thead>
                                                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase text-[10px] border-b border-ui-accent">
                                                                        <th className="py-2.5 px-3">Nazwa wyrobu</th>
                                                                        <th className="py-2.5 px-1.5 text-right">Z wczoraj</th>
                                                                        <th className="py-2.5 px-1.5 text-right">Wyprodukowano</th>
                                                                        <th className="py-2.5 px-1.5 text-center" title="Wpisz liczbę niesprzedanych produktów lub godzinę, o której wyprzedano wszystko">
                                                                            Zostało / Godzina
                                                                        </th>
                                                                        <th className="py-2.5 px-1.5 text-right">Sprzedano</th>
                                                                        <th className="py-2.5 px-1 text-center">Przenieś na jutro</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-ui-accent/20">
                                                                    {catProducts.map((prod) => {
                                                                        const rowIndex = formOrderedProducts.findIndex((p) => p.id === prod.id);
                                                                        const it = formItems[prod.id] || {
                                                                            bakeryProductId: prod.id,
                                                                            producedAmount: "",
                                                                            carriedOverAmount: "",
                                                                            leftoverAmount: "",
                                                                            soldAmount: "",
                                                                            soldOutTime: "",
                                                                            statusInput: "",
                                                                        };

                                                                        const pVal = parseFloat(String(it.producedAmount || "0").replace(",", ".")) || 0;
                                                                        const cVal = parseFloat(String(it.carriedOverAmount || "0").replace(",", ".")) || 0;
                                                                        const displayStatus = it.statusInput !== undefined
                                                                            ? it.statusInput
                                                                            : (it.soldOutTime || (it.leftoverAmount && it.leftoverAmount !== "0" ? it.leftoverAmount : ""));
                                                                        const isColonTime = displayStatus.includes(":");
                                                                        const leftVal = isColonTime ? 0 : (parseFloat(String(it.leftoverAmount || "0").replace(",", ".")) || 0);
                                                                        const isTransferred = !!transferredProductIds[prod.id];
                                                                        const isTransferring = transferringProductId === prod.id;
                                                                        const isFav = favoriteRecipeIds.includes(prod.id);

                                                                        return (
                                                                            <tr
                                                                                key={prod.id}
                                                                                className="hover:bg-ui-accent/10 focus-within:bg-ui-accent/25 focus-within:hover:bg-ui-accent/30 transition-colors"
                                                                            >
                                                                                <td className="py-2 px-3 font-semibold text-ui-black">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => handleToggleFavorite(prod.id, e)}
                                                                                            className="p-1 rounded-md hover:bg-amber-100/60 transition-colors text-ui-secondary hover:text-amber-600 cursor-pointer shrink-0"
                                                                                            title={isFav ? "Oznaczono gwiazdką (widoczne w raporcie). Kliknij, aby usunąć gwiazdkę." : "Brak gwiazdki. Kliknij, aby oznaczyć jako stały wyrób w raporcie."}
                                                                                        >
                                                                                            <Star
                                                                                                size={14}
                                                                                                className={isFav ? "text-amber-500 fill-amber-400" : "text-gray-300 hover:text-amber-400"}
                                                                                            />
                                                                                        </button>
                                                                                        <span className="font-semibold text-ui-black leading-tight break-words">{prod.name}</span>
                                                                                        <span className="text-[10px] text-ui-secondary font-normal shrink-0">
                                                                                            ({formatCurrency(Number(prod.sellingPrice))} brutto / {formatCurrency(Number(prod.sellingPrice) / 1.05)} netto)
                                                                                        </span>
                                                                                    </div>
                                                                                </td>

                                                                                {/* Z wczoraj */}
                                                                                <td className="py-2 px-1.5 text-right">
                                                                                    {cVal > 0 ? (
                                                                                        <span className="font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                                                                            {cVal}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-ui-secondary/50">—</span>
                                                                                    )}
                                                                                </td>

                                                                                {/* Wyprodukowano (Input col 0) */}
                                                                                <td className="py-2 px-1.5 text-right">
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        data-row={rowIndex}
                                                                                        data-col="0"
                                                                                        value={it.producedAmount}
                                                                                        onChange={(e) => handleFormItemChange(prod.id, "producedAmount", e.target.value)}
                                                                                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, 0)}
                                                                                        placeholder="0"
                                                                                        className="w-14 sm:w-16 text-right px-1.5 py-1 bg-white border border-ui-accent rounded-lg text-xs font-bold text-ui-black focus:outline-none focus:border-ui-primary focus:ring-1 focus:ring-ui-primary shadow-2xs"
                                                                                    />
                                                                                </td>

                                                                                {/* Zostało / Godzina (Input col 1) */}
                                                                                <td className="py-2 px-1.5 text-center">
                                                                                    <input
                                                                                        type="text"
                                                                                        data-row={rowIndex}
                                                                                        data-col="1"
                                                                                        value={displayStatus}
                                                                                        onChange={(e) => handleStatusInputChange(prod.id, e.target.value)}
                                                                                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, 1)}
                                                                                        placeholder={
                                                                                            pVal + cVal > 0
                                                                                                ? (formDefaultClosingTime || "18:00")
                                                                                                : ""
                                                                                        }
                                                                                        title="Wpisz liczbę jeśli zostało (np. 5), lub godzinę z dwukropkiem (np. 14:30) jeśli wszystko wyprzedano"
                                                                                        className="w-20 sm:w-24 text-center px-1.5 py-1 bg-white border border-ui-accent rounded-lg text-xs font-bold text-ui-black focus:outline-none focus:border-ui-primary focus:ring-1 focus:ring-ui-primary shadow-2xs"
                                                                                    />
                                                                                </td>

                                                                                {/* Sprzedano */}
                                                                                <td className="py-2 px-1.5 text-right font-semibold text-emerald-700">
                                                                                    {it.soldAmount ? (
                                                                                        `${it.soldAmount} szt.`
                                                                                    ) : pVal + cVal > 0 && (!displayStatus || displayStatus.trim() === "") ? (
                                                                                        <span className="text-emerald-600/70 font-medium" title="Domyślnie wyprzedano całość (brak wpisanych pozostałości)">
                                                                                            {pVal + cVal} szt.
                                                                                        </span>
                                                                                    ) : (
                                                                                        "—"
                                                                                    )}
                                                                                </td>

                                                                                {/* Przenieś na jutro */}
                                                                                <td className="py-2 px-1 text-center">
                                                                                    {leftVal > 0 ? (
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={isTransferred || isTransferring}
                                                                                            onClick={() => handleTransferProductLeftover(prod)}
                                                                                            className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${isTransferred
                                                                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default"
                                                                                                : "bg-sky-50 text-sky-800 border border-sky-300 hover:bg-sky-100 shadow-2xs"
                                                                                                }`}
                                                                                        >
                                                                                            {isTransferring ? (
                                                                                                <Loader2 size={12} className="animate-spin inline mr-1" />
                                                                                            ) : isTransferred ? (
                                                                                                <Check size={12} className="inline mr-1" />
                                                                                            ) : (
                                                                                                <ArrowRight size={12} className="inline mr-1" />
                                                                                            )}
                                                                                            {isTransferred ? "Przeniesiono" : "Przenieś"}
                                                                                        </button>
                                                                                    ) : (
                                                                                        <span className="text-ui-secondary/40 text-[11px]">—</span>
                                                                                    )}
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
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Stopka Formularza */}
                        <div className="p-4 border-t border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setIsFormModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-ui-secondary hover:text-ui-black border border-ui-accent bg-white rounded-xl transition-colors cursor-pointer"
                            >
                                Anuluj
                            </button>

                            <button
                                type="button"
                                disabled={isSavingForm}
                                onClick={handleSaveReportForm}
                                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50 ${formIsNoSalesDay
                                    ? "bg-slate-800 hover:bg-slate-900 text-white"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
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
                                        {formIsNoSalesDay ? "Zapisz dzień bez sprzedaży" : "Zapisz raport"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* ========================================================= */}
            {/* MODAL 2: TYGODNIOWY PLAN PRODUKCJI (TABELA + PDF)        */}
            {/* ========================================================= */}
            {isWeeklyPlanModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsWeeklyPlanModalOpen(false)}
                >
                    <div
                        className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* NAGŁÓWEK MODALU */}
                        <div className="p-4 sm:p-5 border-b border-ui-accent bg-ui-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <Sparkles size={22} className="text-ui-secondary shrink-0" />
                                <div>
                                    <h2 className="text-base sm:text-lg font-extrabold text-ui-black">
                                        Tygodniowy plan produkcji
                                    </h2>
                                    {weeklyPlanData && (
                                        <p className="text-xs text-ui-black">
                                            {formatDate(weeklyPlanData.weekStart)} – {formatDate(weeklyPlanData.weekEnd)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* NAWIGACJA TYGODNIAMI I AKCJE */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center bg-white border border-ui-accent rounded-xl p-0.5 shadow-2xs">
                                    <button
                                        onClick={() => handleShiftWeek(-1)}
                                        className="p-1.5 hover:bg-ui-accent/15 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                                        title="Poprzedni tydzień"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const m = getUpcomingMondayStr();
                                            setWeeklyPlanStart(m);
                                            fetchWeeklyPlan(m);
                                        }}
                                        className="px-2.5 py-1 text-xs font-semibold text-ui-primary hover:text-amber-700 transition-colors cursor-pointer"
                                        title="Skocz do nadchodzącego tygodnia"
                                    >
                                        Bieżący / Nadchodzący
                                    </button>
                                    <button
                                        onClick={() => handleShiftWeek(1)}
                                        className="p-1.5 hover:bg-ui-accent/15 rounded-lg text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                                        title="Następny tydzień"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                {weeklyPlanData?.isCustomSaved && (
                                    <button
                                        onClick={handleResetToSuggested}
                                        disabled={isLoadingWeeklyPlan || isSavingPlan}
                                        className="flex items-center gap-1 text-xs font-semibold border bg-white border-ui-accent hover:bg-ui-accent/30 text-ui-secondary hover:text-ui-black px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                        title="Przywróć wartości wyliczone automatycznie"
                                    >
                                        <RotateCcw size={13} />
                                        <span className="hidden sm:inline">Przywróć sugerowane</span>
                                    </button>
                                )}

                                <button
                                    onClick={handleSaveWeeklyPlan}
                                    disabled={!weeklyPlanData || isLoadingWeeklyPlan || isSavingPlan}
                                    className="flex items-center gap-1.5 text-xs font-semibold border bg-white border-ui-accent hover:bg-ui-accent/30 text-ui-primary px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title="Zapisz zedytowany plan"
                                >
                                    {isPlanSavedSuccessfully ? (
                                        <>
                                            <Check size={14} className="text-emerald-600 stroke-[2.5]" />
                                            <span className="text-emerald-700 font-bold">Zapisano!</span>
                                        </>
                                    ) : (
                                        <>
                                            {isSavingPlan ? (
                                                <Loader2 size={14} className="animate-spin text-ui-secondary" />
                                            ) : (
                                                <Save size={14} className="text-ui-secondary" />
                                            )}
                                            <span>Zapisz</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handlePrintOrDownloadPdf}
                                    disabled={!weeklyPlanData || isLoadingWeeklyPlan}
                                    className="flex items-center gap-1 text-xs font-semibold border bg-white border-ui-accent hover:bg-ui-accent/30 text-ui-primary px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                    title="Zapisz do pliku PDF lub wydrukuj tabelę dla piekarni"
                                >
                                    <Printer size={14} className="text-ui-secondary" />
                                    <span >Pobierz PDF / Drukuj</span>
                                </button>

                                <button
                                    onClick={() => setIsWeeklyPlanModalOpen(false)}
                                    className="p-2 hover:bg-amber-100 rounded-full text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                                    title="Zamknij"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* TREŚĆ MODALU */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {isLoadingWeeklyPlan ? (
                                <div className="p-20 flex flex-col items-center justify-center gap-3 text-ui-secondary text-sm">
                                    <Loader2 size={30} className="animate-spin text-amber-600" />
                                    Generowanie rekomendacji produkcyjnych na cały tydzień...
                                </div>
                            ) : weeklyPlanData ? (
                                <div className="space-y-4">

                                    {/* TABELA PLANU TYGODNIOWEGO Z PODZIAŁEM NA KATEGORIE */}
                                    <div className="overflow-x-auto border border-ui-accent/40 rounded-2xl bg-white shadow-2xs">
                                        <table className="w-full text-xs text-left border-collapse min-w-[760px]">
                                            <colgroup>
                                                <col className="w-[30%]" />
                                                <col className="w-[10%]" />
                                                <col className="w-[10%]" />
                                                <col className="w-[10%]" />
                                                <col className="w-[10%]" />
                                                <col className="w-[10%]" />
                                                <col className="w-[10%]" />
                                            </colgroup>
                                            <thead>
                                                <tr className="bg-ui-accent/10 border-b border-ui-accent/30 text-ui-secondary">
                                                    <th className="py-2.5 px-3.5 font-bold text-ui-black"></th>
                                                    {weeklyPlanData.days.map((d) => (
                                                        <th key={d.dateStr} className="py-2.5 px-2 text-center">
                                                            <div className="font-bold text-ui-black">{d.dayShort}</div>
                                                            <div className="text-[11px] text-ui-black font-normal">{d.dateFormatted}</div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {weeklyPlanData.categories.map((cat) => {
                                                    const catMeta = CATEGORY_MAP[cat.key as ProductType];
                                                    return (
                                                        <React.Fragment key={cat.key}>
                                                            {/* WIERSZ NAGŁÓWKA KATEGORII */}
                                                            <tr className="bg-ui-accent/15 border-t border-b border-ui-accent/40">
                                                                <td colSpan={7} className="py-2 px-3.5">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2 font-bold text-ui-black tracking-wide text-xs">
                                                                            {catMeta?.icon}
                                                                            <span>{cat.label.toUpperCase()}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {/* WIERSZE PRODUKTÓW W KATEGORII */}
                                                            {cat.products.map((prod) => (
                                                                <tr
                                                                    key={prod.id}
                                                                    className="border-b border-ui-accent/20 hover:bg-amber-50/30 transition-colors"
                                                                >
                                                                    <td className="py-2 px-3.5 font-normal text-ui-black">
                                                                        <div>{prod.name}</div>
                                                                        <div className="text-[10px] text-ui-secondary">{formatCurrency(prod.sellingPrice)}</div>
                                                                    </td>
                                                                    {weeklyPlanData.days.map((d) => {
                                                                        const val = prod.dailyAmounts[d.dateStr];
                                                                        const displayVal = val === undefined || val === 0 ? "" : String(val);
                                                                        return (
                                                                            <td key={d.dateStr} className="py-1 px-1.5 text-center">
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="numeric"
                                                                                    pattern="[0-9]*"
                                                                                    value={displayVal}
                                                                                    placeholder="—"
                                                                                    onChange={(e) => handleQuantityChange(prod.id, d.dateStr, e.target.value)}
                                                                                    className="w-14 sm:w-16 mx-auto text-center py-1 px-1 text-xs text-ui-black bg-ui-accent/10 hover:bg-ui-accent/20 focus:bg-white border border-transparent focus:border-ui-primary rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-ui-primary font-medium"
                                                                                />
                                                                            </td>
                                                                        );
                                                                    })}

                                                                </tr>
                                                            ))}

                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )
            }

            {/* ========================================================= */}
            {/* MODAL 3: PODGLĄD WYROBÓW DLA DANEGO OKRESU               */}
            {/* ========================================================= */}
            {
                periodPreviewModal && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                        onClick={() => setPeriodPreviewModal(null)}
                    >
                        <div
                            className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[85vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 sm:p-5 border-b border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                                <div>
                                    <h2 className="text-base sm:text-lg font-extrabold text-ui-black">
                                        {periodPreviewModal.title}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setPeriodPreviewModal(null)}
                                    className="p-1.5 hover:bg-ui-accent/20 rounded-full text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-4 bg-ui-accent/5 border-b border-ui-accent grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="bg-white p-2.5 rounded-xl border border-ui-accent">
                                    <div className="text-ui-secondary font-medium text-[10px]">Wyprodukowano</div>
                                    <div className="font-extrabold text-ui-black text-sm">{periodPreviewModal.totalProduced} szt.</div>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl border border-ui-accent">
                                    <div className="text-ui-secondary font-medium text-[10px]">Sprzedano</div>
                                    <div className="font-extrabold text-emerald-700 text-sm">{periodPreviewModal.totalSold} szt.</div>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl border border-ui-accent">
                                    <div className="text-ui-secondary font-medium text-[10px]">Łączny Utarg</div>
                                    <div className="font-black text-ui-primary text-sm">{formatCurrency(periodPreviewModal.bakeryIncome)}</div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                                {periodPreviewModal.products.length === 0 ? (
                                    <div className="p-12 text-center text-ui-secondary text-sm">
                                        Brak szczegółowych danych pozycji wyrobów dla tego okresu.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                                            <thead>
                                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase text-[10px] border-b border-ui-accent">
                                                    <th className="py-2.5 px-3">Wyrób</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Kategoria</th>
                                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Wyprodukowano</th>
                                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Sprzedano</th>
                                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Niesprzedane</th>
                                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Utarg</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-ui-accent/20">
                                                {periodPreviewModal.products.map((p: any) => (
                                                    <tr key={p.id || p.productId || p.name} className="hover:bg-ui-accent/5">
                                                        <td className="py-2.5 px-3 text-ui-black font-medium">
                                                            {p.name || p.productName}
                                                        </td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                                            <span className="px-2 py-0.5 rounded text-[10px] bg-ui-accent/20 text-ui-primary whitespace-nowrap inline-block">
                                                                {PRODUCT_TYPE_LABELS[p.type as ProductType] || p.type}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right text-ui-black whitespace-nowrap">
                                                            {p.produced || p.producedAmount} szt.
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right text-emerald-700 whitespace-nowrap">
                                                            {p.sold || p.soldAmount} szt.
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right text-rose-700 whitespace-nowrap">
                                                            {p.unsold !== undefined ? p.unsold : Math.max(0, (p.produced || p.producedAmount || 0) - (p.sold || p.soldAmount || 0))} szt.
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right text-ui-black whitespace-nowrap">
                                                            {formatCurrency(p.income || p.salesIncome || 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ========================================================= */}
            {/* MODAL 4: OZNACZANIE DNIA ZAMKNIĘTEGO                      */}
            {/* ========================================================= */}
            {
                closedDayModal && closedDayModal.isOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                        onClick={() => setClosedDayModal(null)}
                    >
                        <div
                            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-ui-accent flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-5 border-b border-ui-accent bg-slate-100/70 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <DoorClosed size={20} className="text-slate-700" />
                                    <div>
                                        <h2 className="text-base font-extrabold text-ui-black">
                                            {closedDayModal.isClosed ? "Oznacz dzień jako zamknięty" : "Przywróć dzień roboczy"}
                                        </h2>
                                        <p className="text-xs text-ui-secondary">
                                            Data: <span className="font-bold text-ui-black">{formatDate(closedDayModal.date)}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setClosedDayModal(null)}
                                    className="p-1.5 hover:bg-slate-200 rounded-full text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {closedDayModal.isClosed ? (
                                    <>
                                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 leading-relaxed">
                                            <p>
                                                W oznaczony dzień piekarnia jest nieczynna (np. z powodu remontu lub święta). Dzień ten <strong>nie będzie traktowany jako brakujący raport</strong> w podsumowaniach miesięcznych.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-ui-secondary uppercase mb-1.5">
                                                Szybki powód zamknięcia:
                                            </label>
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {["Brak sprzedaży", "Święto ustawowe", "Dzień wolny", "Remont piekarni", "Przerwa techniczna"].map((reasonPreset) => (
                                                    <button
                                                        key={reasonPreset}
                                                        type="button"
                                                        onClick={() =>
                                                            setClosedDayModal((prev) => (prev ? { ...prev, reason: reasonPreset } : null))
                                                        }
                                                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${closedDayModal.reason === reasonPreset
                                                            ? "bg-slate-800 text-white border-slate-800 shadow-2xs"
                                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                                            }`}
                                                    >
                                                        {reasonPreset}
                                                    </button>
                                                ))}
                                            </div>

                                            <label className="block text-xs font-bold text-ui-secondary uppercase mb-1.5">
                                                Własny powód / notatka:
                                            </label>
                                            <input
                                                type="text"
                                                value={closedDayModal.reason}
                                                onChange={(e) =>
                                                    setClosedDayModal((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                                                }
                                                placeholder="np. Remont pieca"
                                                className="w-full bg-white border border-ui-accent rounded-xl px-3.5 py-2 text-sm text-ui-black font-medium focus:outline-none focus:border-slate-800 shadow-2xs"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-950 leading-relaxed">
                                        <p>
                                            Piekarnia zostanie oznaczona jako <strong>czynna</strong> w dniu {formatDate(closedDayModal.date)}. Wymagany będzie standardowy raport produkcji/sprzedaży.
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-ui-accent">
                                    <button
                                        type="button"
                                        onClick={() => setClosedDayModal(null)}
                                        className="px-4 py-2 text-xs font-bold text-ui-secondary hover:text-ui-black border border-ui-accent rounded-xl transition-colors cursor-pointer"
                                    >
                                        Anuluj
                                    </button>
                                    <button
                                        type="button"
                                        disabled={closedDayModal.isSaving}
                                        onClick={() =>
                                            handleSaveClosedDay(
                                                closedDayModal.date,
                                                closedDayModal.isClosed,
                                                closedDayModal.reason
                                            )
                                        }
                                        className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                    >
                                        {closedDayModal.isSaving && <Loader2 size={13} className="animate-spin" />}
                                        {closedDayModal.isClosed ? "Zatwierdź zamknięcie dnia" : "Przywróć jako dzień otwarty"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}