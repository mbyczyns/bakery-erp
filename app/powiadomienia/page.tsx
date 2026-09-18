"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Bell,
    FileText,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    RotateCw,
    ArrowRight,
    ChefHat,
    Clock,
    X,
    Loader2,
    ReceiptEuro,
    ShoppingCart,
    Trash2
} from "lucide-react";

type FilterTab = "ALL" | "INVOICES" | "PRICE_INCREASES" | "ORDER_REMINDERS";

interface UnmappedInvoiceAlert {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    contractorName: string;
    issuedDate: string;
    grossAmount: number;
    totalPositionsCount: number;
    unmappedPositionsCount: number;
    status: string;
    isDismissed: boolean;
}

interface AffectedProduct {
    productId: string;
    productName: string;
    productType: string;
    currentSellingPrice: number;
    currentProductionCost: number;
    amountUsed: number;
    unit: string;
    foodCostIncrease: number;
    suggestedSellingPrice: number;
    isDirect: boolean;
}

interface PriceIncreaseAlert {
    id: string;
    ingredientId: string;
    ingredientName: string;
    ingredientUnit: string;
    oldPrice: number;
    newPrice: number;
    priceDifference: number;
    percentIncrease: number;
    lastSupplierName: string;
    lastPurchaseDate: string;
    lastInvoiceNumber: string;
    affectedProducts: AffectedProduct[];
    isDismissed: boolean;
}

interface OrderReminderAlert {
    id: string;
    ingredientId: string;
    ingredientName: string;
    ingredientUnit: string;
    lastPurchaseDate: string;
    lastPurchaseQuantity: number;
    consumedQuantity: number;
    remainingQuantity: number;
    percentUsed: number;
    lastSupplierName: string;
    lastInvoiceNumber: string;
    isDismissed: boolean;
}

interface NotificationSummary {
    totalCount: number;
    unmappedInvoicesCount: number;
    priceAlertsCount: number;
    orderRemindersCount: number;
    affectedProductsCount: number;
}

// Helper do formatowania waluty
function formatCurrency(val: number): string {
    return `${val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

// Helper do formatowania daty
function formatDate(dateStr?: string): string {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

const CATEGORY_NAMES: Record<string, string> = {
    BREAD: "Chleb",
    ROLL: "Bułka",
    SWEET: "Słodkie",
    SAVORY: "Wytrawne",
};

export default function PowiadomieniaPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

    const [summary, setSummary] = useState<NotificationSummary>({
        totalCount: 0,
        unmappedInvoicesCount: 0,
        priceAlertsCount: 0,
        orderRemindersCount: 0,
        affectedProductsCount: 0,
    });
    const [invoices, setInvoices] = useState<UnmappedInvoiceAlert[]>([]);
    const [priceAlerts, setPriceAlerts] = useState<PriceIncreaseAlert[]>([]);
    const [orderReminders, setOrderReminders] = useState<OrderReminderAlert[]>([]);

    const fetchNotifications = async (showRefreshAnim = false) => {
        if (showRefreshAnim) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const res = await fetch("/api/powiadomienia");
            if (res.ok) {
                const data = await res.json();
                const fetchedPriceAlerts: PriceIncreaseAlert[] = (data.priceAlerts || []).filter(
                    (p: PriceIncreaseAlert) => p.priceDifference > 0 && p.percentIncrease > 0
                );
                const fetchedInvoices: UnmappedInvoiceAlert[] = data.unmappedInvoices || [];
                const fetchedOrderReminders: OrderReminderAlert[] = data.orderReminders || [];

                const activeInvCount = fetchedInvoices.filter((i) => !i.isDismissed).length;
                const activePriceCount = fetchedPriceAlerts.filter((p) => !p.isDismissed).length;
                const activeOrderCount = fetchedOrderReminders.filter((o) => !o.isDismissed).length;
                const totalAffProd = fetchedPriceAlerts
                    .filter((p) => !p.isDismissed)
                    .reduce((sum, p) => sum + p.affectedProducts.length, 0);

                setSummary({
                    totalCount: activeInvCount + activePriceCount + activeOrderCount,
                    unmappedInvoicesCount: activeInvCount,
                    priceAlertsCount: activePriceCount,
                    orderRemindersCount: activeOrderCount,
                    affectedProductsCount: totalAffProd,
                });
                setInvoices(fetchedInvoices);
                setPriceAlerts(fetchedPriceAlerts);
                setOrderReminders(fetchedOrderReminders);
            }
        } catch (error) {
            console.error("Błąd pobierania powiadomień:", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    // Oznaczanie powiadomienia jako ukryte
    const handleDismiss = async (alertId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            const res = await fetch("/api/powiadomienia", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "DISMISS", alertId }),
            });
            if (res.ok) {
                setInvoices((prev) => prev.map((inv) => inv.id === alertId ? { ...inv, isDismissed: true } : inv));
                setPriceAlerts((prev) => prev.map((pa) => pa.id === alertId ? { ...pa, isDismissed: true } : pa));
                setOrderReminders((prev) => prev.map((ord) => ord.id === alertId ? { ...ord, isDismissed: true } : ord));
                setSummary((prev) => ({
                    ...prev,
                    totalCount: Math.max(0, prev.totalCount - 1),
                    orderRemindersCount: alertId.startsWith("order-") ? Math.max(0, prev.orderRemindersCount - 1) : prev.orderRemindersCount,
                    priceAlertsCount: alertId.startsWith("price-") ? Math.max(0, prev.priceAlertsCount - 1) : prev.priceAlertsCount,
                    unmappedInvoicesCount: alertId.startsWith("inv-") ? Math.max(0, prev.unmappedInvoicesCount - 1) : prev.unmappedInvoicesCount,
                }));
            }
        } catch (err) {
            console.error("Błąd ukrywania powiadomienia:", err);
        }
    };

    // Ukrycie wszystkich powiadomień
    const handleDismissAll = async () => {
        const allIds = [
            ...invoices.filter((i) => !i.isDismissed).map((i) => i.id),
            ...priceAlerts.filter((p) => !p.isDismissed).map((p) => p.id),
            ...orderReminders.filter((o) => !o.isDismissed).map((o) => o.id),
        ];
        if (allIds.length === 0) return;

        try {
            const res = await fetch("/api/powiadomienia", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "DISMISS_ALL", alertIds: allIds }),
            });
            if (res.ok) {
                setInvoices((prev) => prev.map((inv) => ({ ...inv, isDismissed: true })));
                setPriceAlerts((prev) => prev.map((pa) => ({ ...pa, isDismissed: true })));
                setOrderReminders((prev) => prev.map((ord) => ({ ...ord, isDismissed: true })));
                setSummary({
                    totalCount: 0,
                    unmappedInvoicesCount: 0,
                    priceAlertsCount: 0,
                    orderRemindersCount: 0,
                    affectedProductsCount: 0
                });
            }
        } catch (err) {
            console.error("Błąd ukrywania wszystkich powiadomień:", err);
        }
    };

    // Przywrócenie ukrytych powiadomień
    const handleRestoreAll = async () => {
        try {
            const res = await fetch("/api/powiadomienia", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "RESTORE_ALL" }),
            });
            if (res.ok) {
                fetchNotifications(true);
            }
        } catch (err) {
            console.error("Błąd przywracania powiadomień:", err);
        }
    };

    const activeInvoices = invoices.filter((i) => !i.isDismissed);
    const activePriceAlerts = priceAlerts.filter(
        (p) => !p.isDismissed && p.priceDifference > 0 && p.percentIncrease > 0
    );
    const activeOrderReminders = orderReminders.filter((o) => !o.isDismissed);

    const hasAnyDismissed =
        invoices.some((i) => i.isDismissed) ||
        priceAlerts.some((p) => p.isDismissed && p.priceDifference > 0 && p.percentIncrease > 0) ||
        orderReminders.some((o) => o.isDismissed);

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 max-w-7xl mx-auto">
            {/* ========================================================= */}
            {/* NAGŁÓWEK STRONY I AKCJE                                   */}
            {/* ========================================================= */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ui-black flex items-center gap-2.5 sm:gap-3">
                        <div className="relative">
                            <Bell className="text-ui-primary" size={28} />
                            {summary.totalCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                            )}
                        </div>
                        Powiadomienia
                    </h1>
                </div>

                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                    {hasAnyDismissed && (
                        <button
                            onClick={handleRestoreAll}
                            className="flex-1 sm:flex-none text-center px-3 py-2 text-xs font-semibold text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20 rounded-xl transition-colors cursor-pointer border border-ui-accent"
                        >
                            Przywróć ukryte
                        </button>
                    )}

                    {summary.totalCount > 0 && (
                        <button
                            onClick={handleDismissAll}
                            className="flex-1 sm:flex-none text-center px-3 py-2 text-xs font-semibold text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20 rounded-xl transition-colors cursor-pointer border border-ui-accent"
                        >
                            Oznacz jako przeczytane
                        </button>
                    )}

                    <button
                        onClick={() => fetchNotifications(true)}
                        disabled={isRefreshing || isLoading}
                        className="flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-semibold shadow-xs transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                        <RotateCw size={14} className={isRefreshing ? "animate-spin text-emerald-600" : ""} />
                        <span>Odśwież</span>
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* KARTY PODSUMOWUJĄCE (KPIs) – 2x2 na mobile, 4 w rzędzie na desktop */}
            {/* ========================================================= */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {/* Wszystkie powiadomienia */}
                <div
                    onClick={() => setActiveTab("ALL")}
                    className={`bg-white border rounded-2xl p-3.5 sm:p-5 shadow-xs transition-all cursor-pointer ${activeTab === "ALL" ? "border-ui-primary ring-2 ring-ui-primary/20 bg-ui-primary/5" : "border-ui-accent hover:border-ui-secondary"}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-ui-secondary truncate">Wszystkie alerty</span>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-ui-primary/10 text-ui-primary shrink-0">
                            <Bell size={18} />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-ui-black mt-1 sm:mt-2">
                        {summary.totalCount}
                    </div>
                    <div className="text-[10px] sm:text-xs text-ui-secondary mt-0.5 sm:mt-1 truncate">
                        {summary.totalCount === 0 ? "Brak aktywnych" : "Wymagających reakcji"}
                    </div>
                </div>

                {/* Faktury do zmapowania */}
                <div
                    onClick={() => setActiveTab("INVOICES")}
                    className={`bg-white border rounded-2xl p-3.5 sm:p-5 shadow-xs transition-all cursor-pointer ${activeTab === "INVOICES" ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30" : "border-ui-accent hover:border-ui-primary"}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-ui-secondary truncate">Do zmapowania</span>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-ui-primary/10 text-ui-primary shrink-0">
                            <FileText size={18} />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-ui-black mt-1 sm:mt-2">
                        {summary.unmappedInvoicesCount}
                    </div>
                    <div className="text-[10px] sm:text-xs text-ui-secondary mt-0.5 sm:mt-1 truncate">
                        Faktur do weryfikacji
                    </div>
                </div>

                {/* Wzrosty cen składników */}
                <div
                    onClick={() => setActiveTab("PRICE_INCREASES")}
                    className={`bg-white border rounded-2xl p-3.5 sm:p-5 shadow-xs transition-all cursor-pointer ${activeTab === "PRICE_INCREASES" ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/30" : "border-ui-accent hover:border-ui-primary"}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-ui-secondary truncate">Wzrosty cen</span>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-ui-primary/10 text-ui-primary shrink-0">
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-ui-black mt-1 sm:mt-2">
                        {summary.priceAlertsCount}
                    </div>
                    <div className="text-[10px] sm:text-xs text-ui-secondary mt-0.5 sm:mt-1 truncate">
                        Składników z podwyżką
                    </div>
                </div>

                {/* Niski stan / Zamówienia surowców */}
                <div
                    onClick={() => setActiveTab("ORDER_REMINDERS")}
                    className={`bg-white border rounded-2xl p-3.5 sm:p-5 shadow-xs transition-all cursor-pointer ${activeTab === "ORDER_REMINDERS" ? "border-amber-600 ring-2 ring-amber-600/20 bg-amber-50/40" : "border-ui-accent hover:border-ui-primary"}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-ui-secondary truncate">Zamówienia</span>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-ui-primary/10 text-ui-primary shrink-0">
                            <ShoppingCart size={18} />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-ui-black mt-1 sm:mt-2">
                        {summary.orderRemindersCount}
                    </div>
                    <div className="text-[10px] sm:text-xs text-ui-secondary mt-0.5 sm:mt-1 truncate">
                        Surowców &gt;80% zużycia
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* ZAKŁADKI FILTROWANIA (Przewijany pasek na telefonach)      */}
            {/* ========================================================= */}
            <div className="flex items-center gap-1.5 sm:gap-2 border-b border-ui-accent/60 pb-3 mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab("ALL")}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${activeTab === "ALL"
                        ? "bg-ui-primary text-white shadow-xs"
                        : "text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20"
                        }`}
                >
                    Wszystkie ({summary.totalCount})
                </button>

                <button
                    onClick={() => setActiveTab("INVOICES")}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${activeTab === "INVOICES"
                        ? "bg-ui-primary text-white shadow-xs"
                        : "text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20"
                        }`}
                >
                    <FileText size={14} />
                    Faktury ({summary.unmappedInvoicesCount})
                </button>

                <button
                    onClick={() => setActiveTab("PRICE_INCREASES")}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${activeTab === "PRICE_INCREASES"
                        ? "bg-ui-primary text-white shadow-xs"
                        : "text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20"
                        }`}
                >
                    <TrendingUp size={14} />
                    Wzrosty cen ({summary.priceAlertsCount})
                </button>

                <button
                    onClick={() => setActiveTab("ORDER_REMINDERS")}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${activeTab === "ORDER_REMINDERS"
                        ? "bg-ui-primary text-white shadow-xs"
                        : "text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20"
                        }`}
                >
                    <ShoppingCart size={14} />
                    Zamówienia surowców ({summary.orderRemindersCount})
                </button>
            </div>

            {/* ========================================================= */}
            {/* TREŚĆ POWIADOMIEŃ                                         */}
            {/* ========================================================= */}
            {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-ui-secondary gap-3">
                    <Loader2 size={32} className="animate-spin text-emerald-600" />
                    <p className="text-sm font-medium">Analizowanie powiadomień i bazy danych...</p>
                </div>
            ) : summary.totalCount === 0 && (
                activeTab === "ALL" ||
                (activeTab === "INVOICES" && activeInvoices.length === 0) ||
                (activeTab === "PRICE_INCREASES" && activePriceAlerts.length === 0) ||
                (activeTab === "ORDER_REMINDERS" && activeOrderReminders.length === 0)
            ) ? (
                <div className="bg-emerald-50/40 border border-emerald-200 rounded-3xl p-12 text-center my-8">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-4 shadow-sm">
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-emerald-950 mb-1">Wszystko jest aktualne!</h3>
                    <p className="text-sm text-emerald-800 max-w-md mx-auto">
                        Wszystkie faktury są zmapowane, brak nieobsłużonych podwyżek cen, a stan magazynowy surowców spożywczych jest zabezpieczony.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* ===================================================== */}
                    {/* SEKCJA 1: FAKTURY DO ZMAPOWANIA                       */}
                    {/* ===================================================== */}
                    {(activeTab === "ALL" || activeTab === "INVOICES") && activeInvoices.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-ui-black flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                                        <FileText size={18} />
                                    </div>
                                    Faktury oczekujące na zmapowanie ({activeInvoices.length})
                                </h2>
                                <button
                                    onClick={() => router.push("/faktury")}
                                    className="text-xs font-bold text-ui-secondary hover:text-ui-primary hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    Przejdź do listy faktur <ArrowRight size={14} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeInvoices.map((inv) => (
                                    <div
                                        key={inv.id}
                                        className="bg-white border border-amber-200 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative group"
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 uppercase tracking-wider">
                                                        {inv.status === "WAITING" ? "Do weryfikacji" : "Niezmapowana"}
                                                    </span>
                                                    {inv.unmappedPositionsCount > 0 && (
                                                        <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                                            {inv.unmappedPositionsCount} pozycji bez surowca
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-base font-black text-ui-black mt-2">
                                                    {inv.contractorName}
                                                </h3>
                                                <div className="text-xs text-ui-secondary font-medium mt-0.5">
                                                    Faktura: <strong className="text-ui-primary">{inv.invoiceNumber}</strong>
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => handleDismiss(inv.id, e)}
                                                className="p-1 text-ui-secondary/40 hover:text-ui-primary hover:bg-ui-accent/20 rounded-lg transition-colors cursor-pointer"
                                                title="Ukryj powiadomienie"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 py-3 my-2 border-y border-ui-accent/40 text-xs">
                                            <div>
                                                <span className="text-ui-secondary block text-[11px]">Data wystawienia:</span>
                                                <span className="font-semibold text-ui-black">{formatDate(inv.issuedDate)}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-ui-secondary block text-[11px]">Kwota brutto:</span>
                                                <span className="font-black text-ui-black text-sm">{formatCurrency(inv.grossAmount)}</span>
                                            </div>
                                        </div>

                                        <div className="pt-2 flex items-center justify-between">
                                            <span className="text-xs text-ui-secondary font-medium">
                                                Łącznie pozycji: <strong>{inv.totalPositionsCount}</strong>
                                            </span>
                                            <button
                                                onClick={() => router.push(`/faktury`)}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                                            >
                                                <ReceiptEuro size={14} />
                                                Mapuj fakturę
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ===================================================== */}
                    {/* SEKCJA 2: WZROSTY CEN SKŁADNIKÓW I WPŁYW NA FOOD COST */}
                    {/* ===================================================== */}
                    {(activeTab === "ALL" || activeTab === "PRICE_INCREASES") && activePriceAlerts.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-ui-black flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-800">
                                        <TrendingUp size={18} />
                                    </div>
                                    Wzrosty cen składników i sugerowane korekty wyrobów ({activePriceAlerts.length})
                                </h2>
                                <button
                                    onClick={() => router.push("/przepisy")}
                                    className="text-xs font-bold text-ui-secondary hover:text-ui-primary hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    Przejdź do bazy przepisów <ArrowRight size={14} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {activePriceAlerts.map((pa) => (
                                    <div
                                        key={pa.id}
                                        className="bg-white border border-rose-200 rounded-2xl p-6 shadow-sm relative overflow-hidden"
                                    >
                                        {/* Górny pasek z podsumowaniem podwyżki surowca */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ui-accent/40">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0 font-bold">
                                                    <TrendingUp size={22} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-lg font-bold text-ui-black">
                                                            {pa.ingredientName}
                                                        </h3>
                                                        <span className="text-xs font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-md">
                                                            +{pa.percentIncrease}%
                                                        </span>
                                                        <span className="text-xs text-ui-secondary">
                                                            (wzrost o +{pa.priceDifference.toFixed(2)} zł / {pa.ingredientUnit})
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-ui-secondary flex items-center gap-3 mt-1 flex-wrap">
                                                        <span>Dostawca: <b className="text-ui-primary">{pa.lastSupplierName}</b></span>
                                                        <span>• Faktura: <b>{pa.lastInvoiceNumber}</b></span>
                                                        <span>• Data: <b>{formatDate(pa.lastPurchaseDate)}</b></span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 self-end sm:self-center">
                                                <div className="text-right">
                                                    <div className="text-[11px] text-ui-secondary font-semibold">Cena zakupu netto:</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-ui-secondary line-through font-medium">
                                                            {pa.oldPrice.toFixed(2)} zł
                                                        </span>
                                                        <ArrowRight size={13} className="text-rose-600" />
                                                        <span className="text-base font-black text-rose-950">
                                                            {pa.newPrice.toFixed(2)} zł / {pa.ingredientUnit}
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => handleDismiss(pa.id, e)}
                                                    className="p-1.5 text-ui-secondary/40 hover:text-ui-primary hover:bg-ui-accent/20 rounded-lg transition-colors cursor-pointer"
                                                    title="Ukryj powiadomienie"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Lista wyrobów piekarniczych wykorzystujących ten składnik */}
                                        <div className="mt-4">
                                            <div className="text-xs font-bold text-ui-secondary uppercase tracking-wider mb-3 flex items-center justify-between">
                                                <span>
                                                    Wyroby wykorzystujące ten składnik ({pa.affectedProducts.length}) – sugerowana modyfikacja cen:
                                                </span>
                                            </div>

                                            {pa.affectedProducts.length === 0 ? (
                                                <div className="text-xs text-ui-secondary italic py-2">
                                                    Ten surowiec nie jest obecnie przypisany do żadnego aktywnego przepisu.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {pa.affectedProducts.map((prod) => (
                                                        <div
                                                            key={prod.productId}
                                                            className="bg-ui-accent/10 border border-ui-accent rounded-xl p-3.5 flex flex-col justify-between hover:bg-ui-accent/15 transition-all"
                                                        >
                                                            <div>
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="font-bold text-sm text-ui-black truncate">
                                                                        {prod.productName}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-ui-secondary bg-white px-2 py-0.5 rounded-md border border-ui-accent/60 shrink-0">
                                                                        {CATEGORY_NAMES[prod.productType] || prod.productType}
                                                                    </span>
                                                                </div>

                                                                <div className="mt-2 space-y-1 text-xs">
                                                                    <div className="flex items-center justify-between text-ui-secondary">
                                                                        <span>Zużycie surowca:</span>
                                                                        <span className="font-semibold text-ui-black">
                                                                            {prod.amountUsed} {prod.unit} / szt.
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-rose-800">
                                                                        <span>Wzrost kosztu sztuki:</span>
                                                                        <span className="font-bold">
                                                                            +{prod.foodCostIncrease.toFixed(2)} zł
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between pt-1 border-t border-ui-accent/40">
                                                                        <span className="text-ui-secondary">Obecna cena:</span>
                                                                        <span className="font-bold text-ui-black">
                                                                            {prod.currentSellingPrice.toFixed(2)} zł
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-emerald-900 bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-200/60">
                                                                        <span className="font-medium text-[11px]">Sugerowana cena:</span>
                                                                        <span className="font-black text-xs">
                                                                            {prod.suggestedSellingPrice.toFixed(2)} zł
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 pt-2.5 border-t border-ui-accent/30">
                                                                <button
                                                                    onClick={() => router.push(`/przepisy/${prod.productId}`)}
                                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                                                >
                                                                    <span>Otwórz przepis i kalkulację foodcost</span>
                                                                    <ArrowRight size={13} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ===================================================== */}
                    {/* SEKCJA 3: PRZYPOMNIENIA O ZAMÓWIENIU SUROWCÓW (>80%) */}
                    {/* ===================================================== */}
                    {(activeTab === "ALL" || activeTab === "ORDER_REMINDERS") && activeOrderReminders.length >= 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-ui-black flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                                        <ShoppingCart size={18} />
                                    </div>
                                    Przypomnienia o złożeniu zamówienia surowców ({activeOrderReminders.length})
                                </h2>
                                <span className="text-xs text-ui-secondary font-medium hidden sm:inline">
                                    Zużyto ponad 80% surowca z ostatniej dostawy
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeOrderReminders.map((ord) => (
                                    <div
                                        key={ord.id}
                                        className="bg-white border border-amber-300/80 rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
                                    >
                                        <div>
                                            {/* Nagłówek karty */}
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0 font-bold">
                                                        <ShoppingCart size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="text-base sm:text-lg font-black text-ui-black">
                                                                {ord.ingredientName}
                                                            </h3>
                                                            <span
                                                                className={`text-xs font-black px-2.5 py-0.5 rounded-md ${ord.percentUsed >= 100
                                                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                                                    : "bg-amber-100 text-amber-900 border border-amber-200"
                                                                    }`}
                                                            >
                                                                Zużyto: {ord.percentUsed}%
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-ui-secondary font-medium mt-0.5">
                                                            Dostawca: <strong className="text-ui-primary">{ord.lastSupplierName}</strong>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => handleDismiss(ord.id, e)}
                                                    className="p-1.5 text-ui-secondary/40 hover:text-ui-primary hover:bg-ui-accent/20 rounded-lg transition-colors cursor-pointer"
                                                    title="Usuń powiadomienie"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>

                                            {/* Pasek postępu zużycia */}
                                            <div className="mt-3">
                                                <div className="w-full bg-ui-accent/20 h-2.5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${ord.percentUsed >= 100 ? "bg-rose-600" : "bg-amber-500"
                                                            }`}
                                                        style={{ width: `${Math.min(ord.percentUsed, 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Siatka wskaźników */}
                                            <div className="grid grid-cols-3 gap-2 py-3 my-3 border-y border-ui-accent/40 text-xs">
                                                <div>
                                                    <span className="text-ui-secondary block text-[11px]">Ostatni zakup:</span>
                                                    <span className="font-bold text-ui-black text-xs sm:text-sm">
                                                        {ord.lastPurchaseQuantity} {ord.ingredientUnit}
                                                    </span>
                                                    <span className="text-[10px] text-ui-secondary block truncate mt-0.5">
                                                        {formatDate(ord.lastPurchaseDate)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-ui-secondary block text-[11px]">Zużyto na prod.:</span>
                                                    <span
                                                        className={`font-bold text-xs sm:text-sm ${ord.percentUsed >= 100 ? "text-rose-700" : "text-amber-900"
                                                            }`}
                                                    >
                                                        {ord.consumedQuantity} {ord.ingredientUnit}
                                                    </span>
                                                    <span className="text-[10px] text-ui-secondary block truncate mt-0.5">
                                                        {ord.percentUsed}% dostawy
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-ui-secondary block text-[11px]">Pozostało:</span>
                                                    <span className="font-black text-ui-black text-xs sm:text-sm">
                                                        ~{ord.remainingQuantity} {ord.ingredientUnit}
                                                    </span>
                                                    <span className="text-[10px] text-ui-secondary block truncate mt-0.5">
                                                        {ord.remainingQuantity <= 0 ? "Brak w zapasie" : "Szacunkowo"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dolny pasek z przyciskiem usunięcia */}
                                        <div className="pt-1 flex items-center justify-between gap-2 text-xs">
                                            <span className="text-[11px] text-ui-secondary leading-snug">
                                                Faktura: <strong>{ord.lastInvoiceNumber || "-"}</strong>
                                            </span>
                                            <button
                                                onClick={(e) => handleDismiss(ord.id, e)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-ui-accent/20 hover:bg-rose-50 text-ui-secondary hover:text-rose-700 rounded-xl text-xs font-semibold border border-ui-accent transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={13} />
                                                <span>Usuń powiadomienie</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
