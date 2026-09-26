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
    Sparkles,
    AlertTriangle,
    Search,
    Copy,
    CheckCheck,
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
    RotateCcw
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
}

interface PlanSuggestionItem {
    id: string;
    name: string;
    type: ProductType;
    sellingPrice: number;
    suggestedAmount: number;
    roundedAmount: number;
    rawCalculatedAmount: number;
    roundingStep: number;
    basis: {
        recentHistoryCount: number;
        avgProduced: number;
        avgSold: number;
        avgSellThrough: number;
        soldOutEventsCount: number;
        bufferMultiplier: number;
    };
    explanation: string;
}

interface PlanApiResponse {
    targetDate: string;
    targetDayOfWeek: number;
    dayName: string;
    isClosed: boolean;
    closedReason?: string;
    isSunday: boolean;
    historicalDaysCount: number;
    historicalDaysUsed: string[];
    suggestions: PlanSuggestionItem[];
    totals: {
        totalUnits: number;
        estimatedRevenue: number;
    };
}

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
    BREAD: "Chleby",
    ROLL: "Bułki",
    SWEET: "Słodkie",
    SAVORY: "Słone / Przekąski",
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
        icon: <Layers size={16} className="text-sky-600" />,
        color: "text-sky-700 bg-sky-50 border-sky-200",
        badge: "bg-sky-100 text-sky-800 border-sky-300",
    },
    SWEET: {
        label: "Słodkie",
        icon: <Croissant size={16} className="text-pink-600" />,
        color: "text-pink-700 bg-pink-50 border-pink-200",
        badge: "bg-pink-100 text-pink-800 border-pink-300",
    },
    SAVORY: {
        label: "Słone / Przekąski",
        icon: <Pizza size={16} className="text-emerald-600" />,
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
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

    // Główne 4 zakładki: "CALENDAR" (domyślny), "LAST_7_DAYS", "LAST_WEEKS", "LAST_MONTHS"
    const [activeTab, setActiveTab] = useState<ActiveReportTab>("CALENDAR");

    // Stan analityki dla 7 dni (ostatni tydzień)
    const [daysOffset, setDaysOffset] = useState<number>(0);
    const [daysCount, setDaysCount] = useState<number>(7);
    const [daysAnalytics, setDaysAnalytics] = useState<any>(null);
    const [isLoadingDaysAnalytics, setIsLoadingDaysAnalytics] = useState<boolean>(false);

    // Stan analityki dla ostatnich tygodni
    const [weeksOffset, setWeeksOffset] = useState<number>(0);
    const [weeksCount, setWeeksCount] = useState<number>(6);
    const [weeksAnalytics, setWeeksAnalytics] = useState<any>(null);
    const [isLoadingWeeksAnalytics, setIsLoadingWeeksAnalytics] = useState<boolean>(false);

    // Stan analityki dla ostatnich miesięcy
    const [monthsOffset, setMonthsOffset] = useState<number>(0);
    const [monthsCount, setMonthsCount] = useState<number>(6);
    const [monthsAnalytics, setMonthsAnalytics] = useState<any>(null);
    const [isLoadingMonthsAnalytics, setIsLoadingMonthsAnalytics] = useState<boolean>(false);

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
    const [isCopyingPrevious, setIsCopyingPrevious] = useState(false);
    const [transferringProductId, setTransferringProductId] = useState<string | null>(null);
    const [transferredProductIds, setTransferredProductIds] = useState<Record<string, boolean>>({});
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);
    const [formDefaultClosingTime, setFormDefaultClosingTime] = useState<string>("18:00");

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
        products: any[];
        totalProduced: number;
        totalSold: number;
        bakeryIncome: number;
        fiscalIncome: number;
    } | null>(null);

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
    const fetchAnalytics = async (type: "days" | "weeks" | "months", count: number, offset: number) => {
        try {
            if (type === "days") setIsLoadingDaysAnalytics(true);
            if (type === "weeks") setIsLoadingWeeksAnalytics(true);
            if (type === "months") setIsLoadingMonthsAnalytics(true);

            const res = await fetch(`/api/produkcja?mode=analytics&type=${type}&count=${count}&offset=${offset}`);
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
            fetchAnalytics("days", daysCount, daysOffset);
        } else if (activeTab === "LAST_WEEKS") {
            fetchAnalytics("weeks", weeksCount, weeksOffset);
        } else if (activeTab === "LAST_MONTHS") {
            fetchAnalytics("months", monthsCount, monthsOffset);
        }
    };

    useEffect(() => {
        if (activeTab === "LAST_7_DAYS") {
            fetchAnalytics("days", daysCount, daysOffset);
        } else if (activeTab === "LAST_WEEKS") {
            fetchAnalytics("weeks", weeksCount, weeksOffset);
        } else if (activeTab === "LAST_MONTHS") {
            fetchAnalytics("months", monthsCount, monthsOffset);
        }
    }, [activeTab, daysCount, daysOffset, weeksCount, weeksOffset, monthsCount, monthsOffset]);

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
                setAllProducts(data.products || []);

                setFormFiscalIncome(data.fiscalIncome > 0 ? String(data.fiscalIncome) : "");

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
                    if (existingProd) {
                        const pVal = Number(existingProd.producedAmount) || 0;
                        const cVal = Number(existingProd.carriedOverAmount) || 0;
                        const totalAssort = pVal + cVal;
                        const sVal = Number(existingProd.soldAmount) || 0;
                        if (sVal > 0 || totalAssort > 0) {
                            initSold = String(sVal);
                            initLeftover = String(Math.max(0, Math.round((totalAssort - sVal) * 100) / 100));
                        }
                    }

                    itemsMap[prod.id] = {
                        bakeryProductId: prod.id,
                        producedAmount: initProduced,
                        carriedOverAmount: initCarriedOver,
                        leftoverAmount: initLeftover,
                        soldAmount: initSold,
                        soldOutTime: data.soldOutTimes?.[prod.id] || existingProd?.soldOutTime || "",
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

            if (field === "leftoverAmount") {
                const left = parseNum(value);
                if (hasAssortment && left !== null) {
                    const sold = Math.max(0, Math.round((totalAssort - left) * 100) / 100);
                    updated.soldAmount = String(sold);
                    if (left === 0 && totalAssort > 0 && (!updated.soldOutTime || updated.soldOutTime.trim() === "")) {
                        updated.soldOutTime = formDefaultClosingTime || "18:00";
                    }
                } else if (left === null && hasAssortment && current.soldAmount === "") {
                    updated.soldAmount = "";
                }
            } else if (field === "producedAmount" || field === "carriedOverAmount") {
                const left = parseNum(current.leftoverAmount);
                const sold = parseNum(current.soldAmount);

                if (hasAssortment) {
                    if (left !== null) {
                        const newSold = Math.max(0, Math.round((totalAssort - left) * 100) / 100);
                        updated.soldAmount = String(newSold);
                        if (left === 0 && totalAssort > 0 && (!updated.soldOutTime || updated.soldOutTime.trim() === "")) {
                            updated.soldOutTime = formDefaultClosingTime || "18:00";
                        }
                    } else if (sold !== null) {
                        const newLeft = Math.max(0, Math.round((totalAssort - sold) * 100) / 100);
                        updated.leftoverAmount = String(newLeft);
                        if (newLeft === 0 && totalAssort > 0 && (!updated.soldOutTime || updated.soldOutTime.trim() === "")) {
                            updated.soldOutTime = formDefaultClosingTime || "18:00";
                        }
                    }
                }
            } else if (field === "soldAmount") {
                const sold = parseNum(value);
                if (hasAssortment && sold !== null) {
                    const left = Math.max(0, Math.round((totalAssort - sold) * 100) / 100);
                    updated.leftoverAmount = String(left);
                    if (sold === totalAssort && totalAssort > 0 && (!updated.soldOutTime || updated.soldOutTime.trim() === "")) {
                        updated.soldOutTime = formDefaultClosingTime || "18:00";
                    }
                }
            } else if (field === "soldOutTime") {
                if (value && value.trim() !== "") {
                    // Wpisanie godziny wyprzedania automatycznie oznacza wyprzedanie wszystkiego
                    updated.leftoverAmount = "0";
                    if (hasAssortment && totalAssort > 0) {
                        updated.soldAmount = String(totalAssort);
                    }
                }
            }

            return {
                ...prev,
                [productId]: updated,
            };
        });
    };

    const handleSaveReportFormInternal = async () => {
        const itemsPayload = Object.values(formItems).map((it) => {
            const prod = parseFloat(String(it.producedAmount || "0").replace(",", ".")) || 0;
            const carried = parseFloat(String(it.carriedOverAmount || "0").replace(",", ".")) || 0;
            const total = prod + carried;
            let sold = parseFloat(String(it.soldAmount || "0").replace(",", ".")) || 0;

            // Jeśli wpisana godzina wyprzedania lub leftover wynosi 0 i soldAmount nie był wyliczony
            if ((it.soldOutTime && it.soldOutTime.trim() !== "") || it.leftoverAmount === "0") {
                if (sold === 0 && total > 0) {
                    sold = total;
                }
            }

            return {
                bakeryProductId: it.bakeryProductId,
                producedAmount: prod,
                carriedOverAmount: carried,
                soldAmount: sold,
                soldOutTime: it.soldOutTime || null,
            };
        });

        const fiscalVal = parseFloat(formFiscalIncome.replace(",", ".")) || 0;

        const res = await fetch("/api/produkcja", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                date: formDate,
                items: itemsPayload,
                fiscalIncome: fiscalVal,
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

    const handleCopyPreviousDayProduction = async () => {
        setIsCopyingPrevious(true);
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
                    allProducts.forEach((prod) => {
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

                if (copiedCount > 0) {
                    setFeedbackMessage({
                        type: "success",
                        text: `Skopiowano ilości produkcji (${copiedCount} pozycji) z dnia ${formatDate(prevDateStr)}.`,
                    });
                } else {
                    setFeedbackMessage({
                        type: "info",
                        text: `Brak zapisanej produkcji w dniu ${formatDate(prevDateStr)}.`,
                    });
                }
            }
        } catch (err) {
            console.error("Błąd kopiowania produkcji z poprzedniego dnia:", err);
            setFeedbackMessage({
                type: "error",
                text: "Nie udało się pobrać danych z poprzedniego dnia.",
            });
        } finally {
            setIsCopyingPrevious(false);
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

    // Lista wszystkich produktów w kolejności wyświetlania w formularzu raportu
    const formOrderedProducts = useMemo(() => {
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
            } else if (colIndex === 1) {
                const soldOutInput = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex}"][data-col="2"]`
                );
                if (soldOutInput) {
                    e.preventDefault();
                    focusInput(soldOutInput);
                } else if (rowIndex < totalRows - 1) {
                    e.preventDefault();
                    const target = document.querySelector<HTMLInputElement>(
                        `input[data-row="${rowIndex + 1}"][data-col="0"]`
                    );
                    focusInput(target);
                }
            } else if (colIndex === 2 && rowIndex < totalRows - 1) {
                e.preventDefault();
                const target = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex + 1}"][data-col="0"]`
                );
                focusInput(target);
            }
        } else if (e.key === "ArrowLeft") {
            if (colIndex === 2) {
                e.preventDefault();
                const target = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex}"][data-col="1"]`
                );
                focusInput(target);
            } else if (colIndex === 1) {
                e.preventDefault();
                const target = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex}"][data-col="0"]`
                );
                focusInput(target);
            } else if (colIndex === 0 && rowIndex > 0) {
                e.preventDefault();
                const prevSoldOut = document.querySelector<HTMLInputElement>(
                    `input[data-row="${rowIndex - 1}"][data-col="2"]`
                );
                if (prevSoldOut) {
                    focusInput(prevSoldOut);
                } else {
                    const target = document.querySelector<HTMLInputElement>(
                        `input[data-row="${rowIndex - 1}"][data-col="1"]`
                    );
                    focusInput(target);
                }
            }
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

        Object.keys(CATEGORY_MAP).forEach((catKey) => {
            const items = planData.suggestions.filter((s) => s.type === catKey && s.suggestedAmount > 0);
            if (items.length > 0) {
                text += `\n--- ${CATEGORY_MAP[catKey as ProductType].label.toUpperCase()} ---\n`;
                items.forEach((it) => {
                    text += `- ${it.name}: ${it.suggestedAmount} szt. (sugerowane: ${it.roundedAmount})\n`;
                });
            }
        });

        navigator.clipboard.writeText(text);
        setIsPlanCopied(true);
        setTimeout(() => setIsPlanCopied(false), 2500);
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
                        onClick={() => openProductionPlanModal()}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                        title="Wygeneruj sugerowany plan produkcji"
                    >
                        <Sparkles size={16} />
                        <span>Sugerowany plan</span>
                    </button>

                    <button
                        onClick={() => openNewReportModal()}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                    >
                        <Plus size={16} />
                        <span>Raport dzienny</span>
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
                                    <Coins size={15} className="text-ui-secondary" />
                                    Utarg ze sprzedaży wypieków ({POLISH_MONTHS[parseInt(currentMonth.split("-")[1], 10) - 1]})
                                </span>
                            </div>
                            <div className="mt-2 text-2xl sm:text-3xl font-black text-ui-primary tracking-tight">
                                {formatCurrency(stats.monthBakeryIncome)}
                            </div>
                        </div>
                    </div>

                    {/* KARTA 2: STATUS RAPORTÓW */}
                    <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 size={15} className="text-ui-secondary" />
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
            )}

            {/* ---------------- 4 GŁÓWNE ZAKŁADKI STRONY RAPORTÓW ---------------- */}
            <div className="bg-white border border-ui-accent rounded-2xl p-2 shadow-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-ui-accent/10 rounded-xl border border-ui-accent/30">
                    <button
                        onClick={() => setActiveTab("CALENDAR")}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "CALENDAR"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <CalendarIcon size={16} />
                        <span>Kalendarz</span>
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab("LAST_7_DAYS");
                            setDaysOffset(0);
                        }}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "LAST_7_DAYS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <span>Raporty dzienne</span>
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab("LAST_WEEKS");
                            setWeeksOffset(0);
                        }}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "LAST_WEEKS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <span>Raporty tygodniowe</span>
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab("LAST_MONTHS");
                            setMonthsOffset(0);
                        }}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "LAST_MONTHS"
                            ? "bg-white text-ui-primary shadow-xs border border-ui-accent/50"
                            : "text-ui-secondary hover:text-ui-primary"
                            }`}
                    >
                        <span>Raporty miesięczne</span>
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* ZAKŁADKA 1: KALENDARZ (WIDOK DOMYŚLNY)                    */}
            {/* ========================================================= */}
            {activeTab === "CALENDAR" && (
                <div className="bg-white border border-ui-accent rounded-2xl p-4 sm:p-6 shadow-xs">
                    <div className="flex items-center justify-center mb-4 pb-3 border-b border-ui-accent/30">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-xl font-bold text-ui-primary">
                                {POLISH_MONTHS[parseInt(currentMonth.split("-")[1], 10) - 1]} {currentMonth.split("-")[0]}
                            </h2>
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
                                        className="h-28 sm:h-32 rounded-xl bg-ui-accent/5 border border-dashed border-ui-accent/30 opacity-30"
                                    />
                                );
                            }

                            const isClosed = Boolean(cell.dayData && cell.dayData.isClosed);
                            const hasData = Boolean(cell.dayData && cell.dayData.hasReport);
                            const isMissing = !hasData && cell.isPastOrToday && !cell.isSunday && !isClosed;

                            return (
                                <div
                                    key={cell.dateStr}
                                    onClick={() => {
                                        if (isClosed) {
                                            handleOpenClosedDayModal(cell.dateStr!, true, cell.dayData?.closedReason);
                                        } else if (hasData || cell.isPastOrToday) {
                                            openNewReportModal(cell.dateStr);
                                        } else if (!cell.isSunday) {
                                            openProductionPlanModal(cell.dateStr);
                                        }
                                    }}
                                    className={`h-28 sm:h-32 rounded-2xl p-2.5 border transition-all flex flex-col justify-between cursor-pointer ${isClosed
                                        ? "bg-slate-50/80 border-slate-200/80 hover:border-slate-400"
                                        : hasData
                                            ? "bg-white border-ui-accent hover:border-ui-primary hover:shadow-md ring-1 ring-ui-accent/20"
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
                                                : isClosed
                                                    ? "text-slate-600 bg-slate-200/70"
                                                    : "text-ui-black bg-ui-accent/15"
                                                }`}
                                        >
                                            {cell.dayNumber}
                                        </span>
                                        {isClosed ? (
                                            <span className="text-[10px] font-bold text-slate-700 bg-slate-200/80 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                <DoorClosed size={10} className="text-slate-600" /> Zamknięte
                                            </span>
                                        ) : hasData ? (
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                                {cell.dayData?.productsCount || 0} poz.
                                            </span>
                                        ) : isMissing ? (
                                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-md">
                                                Brak raportu
                                            </span>
                                        ) : !cell.isSunday ? (
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                                <Sparkles size={10} /> Plan
                                            </span>
                                        ) : null}
                                    </div>

                                    {isClosed ? (
                                        <div className="text-center py-1">
                                            <div className="text-[11px] font-bold text-slate-700 line-clamp-1">
                                                {cell.dayData?.closedReason || "Dzień wolny"}
                                            </div>
                                            <div className="text-[9px] text-slate-400 mt-0.5">
                                                Kliknij, aby otworzyć
                                            </div>
                                        </div>
                                    ) : hasData ? (
                                        <div className="space-y-0.5 text-right">
                                            <div className="text-xs font-black text-ui-primary">
                                                {formatCurrency(cell.dayData?.bakerySalesIncome || 0)}
                                            </div>
                                        </div>
                                    ) : isMissing ? (
                                        <div className="text-center text-[10px] font-bold text-rose-600">
                                            Kliknij aby wpisać raport
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

                const tabTitle = isDays ? "Ostatnie 7 dni" : isWeeks ? "Ostatnie tygodnie" : "Ostatnie miesiące";
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
                        { key: "ROLL", label: "Bułki", color: "#0284C7", lightColor: "#BAE6FD", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-900" },
                        { key: "SWEET", label: "Słodkie", color: "#DB2777", lightColor: "#FBCFE8", bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-900" },
                        { key: "SAVORY", label: "Słone", color: "#059669", lightColor: "#A7F3D0", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" },
                    ];

                    return (
                        <div className="bg-white/95 backdrop-blur-md border border-ui-accent rounded-2xl p-4 shadow-xl text-xs min-w-[280px] max-w-[340px] z-50">
                            <div className="border-b border-ui-accent/40 pb-2 mb-2.5">
                                <div className="font-extrabold text-sm text-ui-black">{itemData.label}</div>
                                <div className="text-[11px] text-ui-secondary">{itemData.subLabel || `${itemData.startDate} - ${itemData.endDate}`}</div>
                            </div>

                            {/* Podsumowanie ogólne okresu */}
                            <div className="grid grid-cols-2 gap-2 mb-3 bg-ui-accent/10 p-2 rounded-xl border border-ui-accent/30">
                                <div>
                                    <div className="text-[10px] text-ui-secondary font-medium">Wyprodukowano</div>
                                    <div className="text-xs font-black text-ui-black">{raw.totalProduced.toLocaleString("pl-PL")} szt.</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-ui-secondary font-medium">Sprzedano</div>
                                    <div className="text-xs font-black text-emerald-700">
                                        {raw.totalSold.toLocaleString("pl-PL")} szt. ({raw.sellThroughRate}%)
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-ui-secondary font-medium">Niesprzedane</div>
                                    <div className="text-xs font-bold text-rose-700">{raw.totalUnsold.toLocaleString("pl-PL")} szt.</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-ui-secondary font-medium">Utarg</div>
                                    <div className="text-xs font-black text-ui-primary">{formatCurrency(raw.totalIncome)}</div>
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
                                                <span className="font-extrabold text-ui-black">{catData.sold}</span>
                                                <span className="text-ui-secondary"> / {catData.produced} szt.</span>
                                                {catData.produced > 0 && (
                                                    <span className="ml-1 text-[10px] font-bold text-emerald-800">({rate}%)</span>
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
                        {/* 1. PASEK NAWIGACJI PO OKRESACH */}
                        <div className="bg-white border border-ui-accent rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-ui-primary/10 text-ui-primary">
                                    <BarChart3 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-sm sm:text-base font-extrabold text-ui-black">
                                        {tabTitle}
                                    </h2>
                                    <div className="text-xs text-ui-secondary font-medium">
                                        {currentAnalytics?.startDate && currentAnalytics?.endDate
                                            ? `Zakres: ${currentAnalytics.startDate} do ${currentAnalytics.endDate}`
                                            : "Analiza słupkowa produkcji i sprzedaży"}
                                    </div>
                                </div>
                            </div>

                            {/* Kontrolki paginacji i liczby okresów */}
                            <div className="flex flex-wrap items-center gap-2">
                                {(isWeeks || isMonths) && (
                                    <div className="flex items-center gap-1 bg-ui-accent/15 p-1 rounded-xl border border-ui-accent/30 text-xs font-bold">
                                        <span className="px-2 text-ui-secondary text-[11px]">Liczba:</span>
                                        {(isWeeks ? [4, 6, 8, 12] : [4, 6, 12]).map((cnt) => (
                                            <button
                                                key={cnt}
                                                onClick={() => setCountFn(cnt)}
                                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${countVal === cnt
                                                    ? "bg-white text-ui-primary shadow-xs font-black"
                                                    : "text-ui-secondary hover:text-ui-primary"
                                                    }`}
                                            >
                                                {cnt} {isWeeks ? "tyg." : "mies."}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 bg-ui-accent/15 p-1 rounded-xl border border-ui-accent/30">
                                    <button
                                        onClick={() => setOffsetFn(offsetVal + 1)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white text-ui-primary rounded-lg text-xs font-bold shadow-xs hover:bg-ui-accent/20 transition-all cursor-pointer border border-ui-accent/40"
                                        title="Generuj wykres dla wcześniejszego okresu"
                                    >
                                        <ChevronLeft size={14} />
                                        <span>Wcześniejsze</span>
                                    </button>

                                    {offsetVal > 0 && (
                                        <button
                                            onClick={() => setOffsetFn(0)}
                                            className="px-2.5 py-1.5 text-xs font-bold text-ui-secondary hover:text-ui-primary transition-colors cursor-pointer"
                                            title="Wróć do aktualnego okresu"
                                        >
                                            <RotateCcw size={13} className="inline mr-1" />
                                            Bieżące
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setOffsetFn(Math.max(0, offsetVal - 1))}
                                        disabled={offsetVal === 0}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${offsetVal === 0
                                            ? "text-ui-secondary/40 bg-transparent cursor-not-allowed"
                                            : "bg-white text-ui-primary shadow-xs hover:bg-ui-accent/20 cursor-pointer border border-ui-accent/40"
                                            }`}
                                        title="Następny okres"
                                    >
                                        <span>Późniejsze</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 2. LEGENDA KATEGORII I ODCIENI */}
                        <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">

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
                                <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-200/80 flex items-center gap-3">
                                    <div className="flex flex-col w-5 h-8 rounded overflow-hidden border border-sky-400/50 shrink-0 shadow-xs">
                                        <div className="flex-1 bg-[#BAE6FD]" title="Niesprzedane (jaśniejszy)" />
                                        <div className="h-5 bg-[#0284C7]" title="Sprzedane (ciemniejszy)" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-extrabold text-sky-900 flex items-center gap-1">
                                            <Layers size={13} className="text-sky-700" /> Bułki
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
                                            <Croissant size={13} className="text-pink-700" /> Słodkie
                                        </div>
                                    </div>
                                </div>

                                {/* Słone */}
                                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-3">
                                    <div className="flex flex-col w-5 h-8 rounded overflow-hidden border border-emerald-400/50 shrink-0 shadow-xs">
                                        <div className="flex-1 bg-[#A7F3D0]" title="Niesprzedane (jaśniejszy)" />
                                        <div className="h-5 bg-[#059669]" title="Sprzedane (ciemniejszy)" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                                            <Pizza size={13} className="text-emerald-700" /> Słone
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. GŁÓWNY WYKRES SŁUPKOWY */}
                        <div className="bg-white border border-ui-accent rounded-2xl p-5 sm:p-6 shadow-xs">
                            <div className="flex items-center justify-center mb-4">
                                <h3 className="text-xs sm:text-sm font-extrabold text-ui-primary">
                                    Produkcja i sprzedaż
                                </h3>
                                {isLoadingCurrent && (
                                    <div className="flex items-center gap-1.5 text-xs text-ui-primary font-bold">
                                        <Loader2 size={14} className="animate-spin" /> Ładowanie danych...
                                    </div>
                                )}
                            </div>

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
                                            <Bar dataKey="ROLL_sold" stackId="ROLL" fill="#0284C7" name="Bułki (Sprzedaż)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="ROLL_unsold" stackId="ROLL" fill="#BAE6FD" name="Bułki (Niesprzedane)" radius={[4, 4, 0, 0]} />

                                            {/* SŁUPEK 3: SŁODKIE (Sprzedane ciemny + Niesprzedane jasny) */}
                                            <Bar dataKey="SWEET_sold" stackId="SWEET" fill="#DB2777" name="Słodkie (Sprzedaż)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="SWEET_unsold" stackId="SWEET" fill="#FBCFE8" name="Słodkie (Niesprzedane)" radius={[4, 4, 0, 0]} />

                                            {/* SŁUPEK 4: SŁONE (Sprzedane ciemny + Niesprzedane jasny) */}
                                            <Bar dataKey="SAVORY_sold" stackId="SAVORY" fill="#059669" name="Słone (Sprzedaż)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="SAVORY_unsold" stackId="SAVORY" fill="#A7F3D0" name="Słone (Niesprzedane)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* 4. KARTY STATYSTYK OKRESU (KPI) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center gap-1.5">
                                    <Wheat size={14} className="text-amber-600" />
                                    Wyprodukowano
                                </div>
                                <div className="mt-2 text-xl sm:text-2xl font-black text-ui-black">
                                    {totalStats.totalProduced.toLocaleString("pl-PL")}{" "}
                                    <span className="text-xs font-semibold text-ui-secondary">szt.</span>
                                </div>
                            </div>

                            <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="text-emerald-600" />
                                    Sprzedano (% skut.)
                                </div>
                                <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-700">
                                    {totalStats.totalSold.toLocaleString("pl-PL")}{" "}
                                    <span className="text-xs font-semibold text-emerald-800/80">
                                        ({totalStats.sellThroughRate}%)
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center gap-1.5">
                                    <AlertCircle size={14} className="text-rose-600" />
                                    Niesprzedane
                                </div>
                                <div className="mt-2 text-xl sm:text-2xl font-black text-rose-700">
                                    {totalStats.totalUnsold.toLocaleString("pl-PL")}{" "}
                                    <span className="text-xs font-semibold text-rose-600/70">szt.</span>
                                </div>
                            </div>

                            <div className="bg-white border border-ui-accent rounded-2xl p-4 shadow-xs">
                                <div className="text-[11px] uppercase font-bold text-ui-secondary tracking-wider flex items-center gap-1.5">
                                    <Coins size={14} className="text-ui-primary" />
                                    Utarg ze sprzedaży
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
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider text-[10px] border-b border-ui-accent">
                                            <th className="py-3 px-3.5">Okres / Data</th>
                                            <th className="py-3 px-2 text-right">
                                                <span className="text-amber-800">Chleby</span>
                                            </th>
                                            <th className="py-3 px-2 text-right">
                                                <span className="text-sky-800">Bułki</span>
                                            </th>
                                            <th className="py-3 px-2 text-right">
                                                <span className="text-pink-800">Słodkie</span>
                                            </th>
                                            <th className="py-3 px-2 text-right">
                                                <span className="text-emerald-800">Słone</span>
                                            </th>
                                            <th className="py-3 px-3 text-right">Produkcja</th>
                                            <th className="py-3 px-3 text-right">Sprzedaż</th>
                                            <th className="py-3 px-2.5 text-right">Skuteczność</th>
                                            <th className="py-3 px-3.5 text-right">Utarg</th>
                                            <th className="py-3 px-1 text-center">Akcja</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/30">
                                        {buckets.map((b: any) => {
                                            return (
                                                <tr
                                                    key={b.id}
                                                    onClick={() => {
                                                        if (isDays) {
                                                            openNewReportModal(b.startDate);
                                                        } else {
                                                            setPeriodPreviewModal({
                                                                isOpen: true,
                                                                title: b.label,
                                                                subtitle: b.subLabel || `${b.startDate} do ${b.endDate}`,
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
                                                    <td className="py-3 px-3.5 font-bold text-ui-black">
                                                        <div className="text-sm">{b.label}</div>
                                                        <div className="text-[11px] text-ui-secondary font-normal">{b.subLabel || `${b.startDate} do ${b.endDate}`}</div>
                                                    </td>

                                                    {/* Chleby */}
                                                    <td className="py-3 px-2 text-right font-semibold">
                                                        <span className="font-extrabold text-amber-800">{b.BREAD?.sold || 0}</span>
                                                        <span className="text-ui-secondary text-[11px]"> / {b.BREAD?.produced || 0}</span>
                                                    </td>

                                                    {/* Bułki */}
                                                    <td className="py-3 px-2 text-right font-semibold">
                                                        <span className="font-extrabold text-sky-800">{b.ROLL?.sold || 0}</span>
                                                        <span className="text-ui-secondary text-[11px]"> / {b.ROLL?.produced || 0}</span>
                                                    </td>

                                                    {/* Słodkie */}
                                                    <td className="py-3 px-2 text-right font-semibold">
                                                        <span className="font-extrabold text-pink-800">{b.SWEET?.sold || 0}</span>
                                                        <span className="text-ui-secondary text-[11px]"> / {b.SWEET?.produced || 0}</span>
                                                    </td>

                                                    {/* Słone */}
                                                    <td className="py-3 px-2 text-right font-semibold">
                                                        <span className="font-extrabold text-emerald-800">{b.SAVORY?.sold || 0}</span>
                                                        <span className="text-ui-secondary text-[11px]"> / {b.SAVORY?.produced || 0}</span>
                                                    </td>

                                                    {/* Razem prod */}
                                                    <td className="py-3 px-3 text-right font-bold text-ui-black text-sm">
                                                        {b.totalProduced.toLocaleString("pl-PL")} szt.
                                                    </td>

                                                    {/* Razem sprz */}
                                                    <td className="py-3 px-3 text-right font-bold text-emerald-700 text-sm">
                                                        {b.totalSold.toLocaleString("pl-PL")} szt.
                                                    </td>

                                                    {/* Skuteczność */}
                                                    <td className="py-3 px-2.5 text-right font-semibold">
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                            {b.sellThroughRate}%
                                                        </span>
                                                    </td>

                                                    {/* Utarg */}
                                                    <td className="py-3 px-3.5 text-right font-black text-ui-primary text-sm">
                                                        {formatCurrency(b.totalIncome)}
                                                    </td>

                                                    {/* Akcja */}
                                                    <td className="py-3 px-3 text-center">
                                                        <span className="flex items-center justify-center gap-1 text-xs font-semibold bg-ui-accent/15 hover:bg-ui-accent/10 text-ui-primary border border-ui-accent px-1 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm">
                                                            {isDays ? "Raport" : "Wyroby"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-ui-accent/20 font-black text-ui-black border-t-2 border-ui-accent">
                                            <td className="py-3.5 px-3.5 uppercase text-xs">
                                                Podsumowanie okresu
                                            </td>
                                            <td className="py-3.5 px-2 text-right text-amber-900 font-extrabold">
                                                {buckets.reduce((acc: number, b: any) => acc + (b.BREAD?.sold || 0), 0)} / {buckets.reduce((acc: number, b: any) => acc + (b.BREAD?.produced || 0), 0)}
                                            </td>
                                            <td className="py-3.5 px-2 text-right text-sky-900 font-extrabold">
                                                {buckets.reduce((acc: number, b: any) => acc + (b.ROLL?.sold || 0), 0)} / {buckets.reduce((acc: number, b: any) => acc + (b.ROLL?.produced || 0), 0)}
                                            </td>
                                            <td className="py-3.5 px-2 text-right text-pink-900 font-extrabold">
                                                {buckets.reduce((acc: number, b: any) => acc + (b.SWEET?.sold || 0), 0)} / {buckets.reduce((acc: number, b: any) => acc + (b.SWEET?.produced || 0), 0)}
                                            </td>
                                            <td className="py-3.5 px-2 text-right text-emerald-900 font-extrabold">
                                                {buckets.reduce((acc: number, b: any) => acc + (b.SAVORY?.sold || 0), 0)} / {buckets.reduce((acc: number, b: any) => acc + (b.SAVORY?.produced || 0), 0)}
                                            </td>
                                            <td className="py-3.5 px-3 text-right text-sm">
                                                {totalStats.totalProduced.toLocaleString("pl-PL")} szt.
                                            </td>
                                            <td className="py-3.5 px-3 text-right text-sm text-emerald-700">
                                                {totalStats.totalSold.toLocaleString("pl-PL")} szt.
                                            </td>
                                            <td className="py-3.5 px-2.5 text-right font-bold text-emerald-800">
                                                {totalStats.sellThroughRate}%
                                            </td>
                                            <td className="py-3.5 px-3.5 text-right text-sm text-ui-primary font-black">
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
                                    <FileText size={20} className="text-ui-primary" />
                                    Wprowadzanie raportu dziennego
                                </h2>
                                <p className="text-xs text-ui-secondary">
                                    Data raportu: <span className="font-bold text-ui-black">{formatDate(formDate)}</span>
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopyPreviousDayProduction}
                                    disabled={isCopyingPrevious}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-ui-primary border border-ui-accent hover:bg-ui-accent/30 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                                    title="Wypełnij kolumnę 'Wyprodukowano' ilościami z poprzedniego dnia"
                                >
                                    {isCopyingPrevious ? (
                                        <Loader2 size={13} className="animate-spin text-ui-primary" />
                                    ) : (
                                        <Copy size={13} />
                                    )}
                                    <span>Skopiuj prod. z wczoraj</span>
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
                                    <Loader2 size={28} className="animate-spin text-ui-primary" />
                                    Wczytywanie pozycji wypieków...
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Podział na kategorie w formularzu */}
                                    {Object.entries(CATEGORY_MAP).map(([catKey, catMeta]) => {
                                        const catProducts = formOrderedProducts.filter((p) => p.type === catKey);
                                        if (catProducts.length === 0) return null;

                                        return (
                                            <div key={catKey} className="border border-ui-accent rounded-xl overflow-hidden shadow-2xs">
                                                <div className={`px-4 py-2.5 font-bold text-xs flex items-center justify-between border-b ${catMeta.color}`}>
                                                    <div className="flex items-center gap-2">
                                                        {catMeta.icon}
                                                        <span>{catMeta.label.toUpperCase()} ({catProducts.length})</span>
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs border-collapse">
                                                        <thead>
                                                            <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase text-[10px] border-b border-ui-accent">
                                                                <th className="py-2.5 px-3">Nazwa wyrobu</th>
                                                                <th className="py-2.5 px-2 text-right">Z wczoraj</th>
                                                                <th className="py-2.5 px-2 text-right">Wyprodukowano</th>
                                                                <th className="py-2.5 px-2 text-right">Razem asort.</th>
                                                                <th className="py-2.5 px-2 text-right">Zostało</th>
                                                                <th className="py-2.5 px-2 text-right">Sprzedano</th>
                                                                <th className="py-2.5 px-2 text-center w-28">Godz. wyprzed.</th>
                                                                <th className="py-2.5 px-2 text-center w-28">Przenieś na jutro</th>
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
                                                                };

                                                                const pVal = parseFloat(String(it.producedAmount || "0").replace(",", ".")) || 0;
                                                                const cVal = parseFloat(String(it.carriedOverAmount || "0").replace(",", ".")) || 0;
                                                                const totalAssort = pVal + cVal;
                                                                const leftVal = parseFloat(String(it.leftoverAmount || "0").replace(",", ".")) || 0;
                                                                const isTransferred = !!transferredProductIds[prod.id];
                                                                const isTransferring = transferringProductId === prod.id;

                                                                return (
                                                                    <tr key={prod.id} className="hover:bg-ui-accent/5 transition-colors">
                                                                        <td className="py-2 px-3 font-semibold text-ui-black">
                                                                            {prod.name}
                                                                            <span className="text-[10px] text-ui-secondary font-normal ml-1">
                                                                                ({formatCurrency(Number(prod.sellingPrice))})
                                                                            </span>
                                                                        </td>

                                                                        {/* Z wczoraj */}
                                                                        <td className="py-2 px-2 text-right">
                                                                            {cVal > 0 ? (
                                                                                <span className="font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                                                                    {cVal}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-ui-secondary/50">—</span>
                                                                            )}
                                                                        </td>

                                                                        {/* Wyprodukowano (Input col 0) */}
                                                                        <td className="py-2 px-2 text-right">
                                                                            <input
                                                                                type="text"
                                                                                inputMode="decimal"
                                                                                data-row={rowIndex}
                                                                                data-col="0"
                                                                                value={it.producedAmount}
                                                                                onChange={(e) => handleFormItemChange(prod.id, "producedAmount", e.target.value)}
                                                                                onKeyDown={(e) => handleGridKeyDown(e, rowIndex, 0)}
                                                                                placeholder="0"
                                                                                className="w-16 sm:w-20 text-right px-2 py-1 bg-white border border-ui-accent rounded-lg text-xs font-bold text-ui-black focus:outline-none focus:border-ui-primary focus:ring-1 focus:ring-ui-primary shadow-2xs"
                                                                            />
                                                                        </td>

                                                                        {/* Razem asortyment */}
                                                                        <td className="py-2 px-2 text-right font-bold text-ui-black">
                                                                            {totalAssort > 0 ? totalAssort : "—"}
                                                                        </td>

                                                                        {/* Zostało (Input col 1) */}
                                                                        <td className="py-2 px-2 text-right">
                                                                            <input
                                                                                type="text"
                                                                                inputMode="decimal"
                                                                                data-row={rowIndex}
                                                                                data-col="1"
                                                                                value={it.leftoverAmount}
                                                                                onChange={(e) => handleFormItemChange(prod.id, "leftoverAmount", e.target.value)}
                                                                                onKeyDown={(e) => handleGridKeyDown(e, rowIndex, 1)}
                                                                                placeholder="0"
                                                                                className="w-16 sm:w-20 text-right px-2 py-1 bg-white border border-ui-accent rounded-lg text-xs font-bold text-ui-black focus:outline-none focus:border-ui-primary focus:ring-1 focus:ring-ui-primary shadow-2xs"
                                                                            />
                                                                        </td>

                                                                        {/* Sprzedano */}
                                                                        <td className="py-2 px-2 text-right font-black text-emerald-700">
                                                                            {it.soldAmount ? `${it.soldAmount} szt.` : "—"}
                                                                        </td>

                                                                        {/* Godzina wyprzedania (Input col 2) */}
                                                                        <td className="py-2 px-2 text-center">
                                                                            <input
                                                                                type="text"
                                                                                data-row={rowIndex}
                                                                                data-col="2"
                                                                                value={it.soldOutTime}
                                                                                onChange={(e) => handleFormItemChange(prod.id, "soldOutTime", e.target.value)}
                                                                                onKeyDown={(e) => handleGridKeyDown(e, rowIndex, 2)}
                                                                                placeholder="np. 14:30"
                                                                                className="w-20 text-center px-1.5 py-1 bg-white border border-ui-accent rounded-lg text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-2xs"
                                                                            />
                                                                        </td>

                                                                        {/* Przenieś na jutro */}
                                                                        <td className="py-2 px-2 text-center">
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

                                    {/* Pole Utargu z Kasy Fiskalnej */}
                                    <div className="bg-ui-accent/15 border border-ui-accent rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <div className="text-xs font-black text-ui-black flex items-center gap-1.5">
                                                <Receipt size={16} className="text-ui-primary" />
                                                Utarg z kasy fiskalnej (Raport dobowy):
                                            </div>
                                            <div className="text-[11px] text-ui-secondary">
                                                Opcjonalna kwota z raportu fiskalnego na koniec dnia w celu porównania ze sprzedażą wypieków.
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
                                className="flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-ui-primary hover:bg-ui-secondary rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
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
                                        Zapisz raport dzienny
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 2: SUGEROWANY PLAN PRODUKCJI                       */}
            {/* ========================================================= */}
            {isPlanModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsPlanModalOpen(false)}
                >
                    <div
                        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-5 border-b border-ui-accent bg-amber-500/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={22} className="text-amber-600" />
                                <div>
                                    <h2 className="text-base sm:text-lg font-extrabold text-ui-black">
                                        Sugerowany Plan Produkcji
                                    </h2>
                                    <p className="text-xs text-ui-secondary">
                                        Plan na dzień: <strong className="text-ui-black">{formatDate(planDate)}</strong> ({planData?.dayName || "—"})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPlanModalOpen(false)}
                                className="p-1.5 hover:bg-amber-100 rounded-full text-ui-secondary hover:text-ui-black transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {isLoadingPlan ? (
                                <div className="p-16 flex flex-col items-center justify-center gap-3 text-ui-secondary text-sm">
                                    <Loader2 size={28} className="animate-spin text-amber-600" />
                                    Generowanie rekomendacji produkcyjnych...
                                </div>
                            ) : planData ? (
                                <div className="space-y-4">
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="font-extrabold text-sm">
                                                Łącznie rekomendowana produkcja: {planData.totals?.totalUnits || 0} szt.
                                            </div>
                                            <div className="text-[11px] text-amber-900/80">
                                                Szacowany utarg: <strong>{formatCurrency(planData.totals?.estimatedRevenue || 0)}</strong> (analiza z {planData.historicalDaysCount} poprzednich takich samych dni tygodnia)
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleCopyPlanToClipboard}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                            >
                                                {isPlanCopied ? <CheckCheck size={14} className="text-emerald-700" /> : <Copy size={14} />}
                                                <span>{isPlanCopied ? "Skopiowano!" : "Kopiuj listę"}</span>
                                            </button>
                                            <button
                                                onClick={handleApplyPlanToReport}
                                                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                            >
                                                <Plus size={14} />
                                                <span>Wypełnij raport</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista sugerowanych wyrobów */}
                                    <div className="space-y-3">
                                        {planData.suggestions?.map((sug) => (
                                            <div
                                                key={sug.id}
                                                className="p-3 rounded-xl border border-ui-accent bg-white hover:border-amber-400 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                            >
                                                <div>
                                                    <div className="font-extrabold text-sm text-ui-black flex items-center gap-2">
                                                        <span>{sug.name}</span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-ui-accent/20 text-ui-primary border border-ui-accent/40">
                                                            {PRODUCT_TYPE_LABELS[sug.type] || sug.type}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-ui-secondary mt-0.5">
                                                        {sug.explanation}
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <div className="text-base font-black text-amber-800">
                                                        {sug.suggestedAmount} <span className="text-xs font-bold">szt.</span>
                                                    </div>
                                                    <div className="text-[10px] text-ui-secondary">
                                                        Wartość: {formatCurrency(sug.suggestedAmount * sug.sellingPrice)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 3: PODGLĄD WYROBÓW DLA DANEGO OKRESU               */}
            {/* ========================================================= */}
            {periodPreviewModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setPeriodPreviewModal(null)}
                >
                    <div
                        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-5 border-b border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-base sm:text-lg font-extrabold text-ui-black">
                                    {periodPreviewModal.title}
                                </h2>
                                <p className="text-xs text-ui-secondary">
                                    {periodPreviewModal.subtitle}
                                </p>
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
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase text-[10px] border-b border-ui-accent">
                                            <th className="py-2.5 px-3">Wyrób</th>
                                            <th className="py-2.5 px-2">Kategoria</th>
                                            <th className="py-2.5 px-2 text-right">Wyprodukowano</th>
                                            <th className="py-2.5 px-2 text-right">Sprzedano</th>
                                            <th className="py-2.5 px-2 text-right">Niesprzedane</th>
                                            <th className="py-2.5 px-3 text-right">Utarg</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/20">
                                        {periodPreviewModal.products.map((p: any) => (
                                            <tr key={p.id || p.productId || p.name} className="hover:bg-ui-accent/5">
                                                <td className="py-2.5 px-3 font-bold text-ui-black">
                                                    {p.name || p.productName}
                                                </td>
                                                <td className="py-2.5 px-2">
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-ui-accent/20 text-ui-primary">
                                                        {PRODUCT_TYPE_LABELS[p.type as ProductType] || p.type}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2 text-right font-medium text-ui-black">
                                                    {p.produced || p.producedAmount} szt.
                                                </td>
                                                <td className="py-2.5 px-2 text-right font-bold text-emerald-700">
                                                    {p.sold || p.soldAmount} szt.
                                                </td>
                                                <td className="py-2.5 px-2 text-right font-bold text-rose-700">
                                                    {p.unsold !== undefined ? p.unsold : Math.max(0, (p.produced || p.producedAmount || 0) - (p.sold || p.soldAmount || 0))} szt.
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-black text-ui-primary">
                                                    {formatCurrency(p.income || p.salesIncome || 0)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 4: OZNACZANIE DNIA ZAMKNIĘTEGO                      */}
            {/* ========================================================= */}
            {closedDayModal && closedDayModal.isOpen && (
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
                                            {["Remont piekarni", "Święto ustawowe", "Przerwa techniczna", "Dzień wolny"].map((reasonPreset) => (
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
            )}
        </div>
    );
}