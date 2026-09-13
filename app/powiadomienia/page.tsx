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
    ArrowUpRight,
    ChefHat,
    DollarSign,
    Sparkles,
    Calendar,
    Building2,
    Clock,
    X,
    Pencil,
    Loader2,
    Check,
    Tag,
    Eye,
    ReceiptEuro
} from "lucide-react";

type FilterTab = "ALL" | "INVOICES" | "PRICE_INCREASES";

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

interface NotificationSummary {
    totalCount: number;
    unmappedInvoicesCount: number;
    priceAlertsCount: number;
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
        affectedProductsCount: 0,
    });
    const [invoices, setInvoices] = useState<UnmappedInvoiceAlert[]>([]);
    const [priceAlerts, setPriceAlerts] = useState<PriceIncreaseAlert[]>([]);

    // Modal szybkiej edycji ceny sprzedaży produktu
    const [priceEditModal, setPriceEditModal] = useState<{
        isOpen: boolean;
        productId: string;
        productName: string;
        currentPrice: number;
        suggestedPrice: number;
        newPrice: string;
        ingredientName: string;
        costIncrease: number;
    } | null>(null);
    const [isSavingPrice, setIsSavingPrice] = useState(false);
    const [priceSaveSuccess, setPriceSaveSuccess] = useState(false);

    const fetchNotifications = async (showRefreshAnim = false) => {
        if (showRefreshAnim) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const res = await fetch("/api/powiadomienia");
            if (res.ok) {
                const data = await res.json();
                setSummary(data.summary || { totalCount: 0, unmappedInvoicesCount: 0, priceAlertsCount: 0, affectedProductsCount: 0 });
                setInvoices(data.unmappedInvoices || []);
                setPriceAlerts(data.priceAlerts || []);
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
                setSummary((prev) => ({
                    ...prev,
                    totalCount: Math.max(0, prev.totalCount - 1),
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
                setSummary({ totalCount: 0, unmappedInvoicesCount: 0, priceAlertsCount: 0, affectedProductsCount: 0 });
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

    // Zapis nowej ceny sprzedaży produktu
    const handleSaveNewProductPrice = async () => {
        if (!priceEditModal) return;
        const parsedPrice = parseFloat(priceEditModal.newPrice.replace(",", "."));
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            alert("Wprowadź prawidłową cenę wyrobu.");
            return;
        }

        setIsSavingPrice(true);
        setPriceSaveSuccess(false);

        try {
            const res = await fetch(`/api/przepisy/${priceEditModal.productId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sellingPrice: parsedPrice }),
            });

            if (res.ok) {
                setPriceSaveSuccess(true);
                // Aktualizujemy lokalny stan wyrobów w alertach
                setPriceAlerts((prev) =>
                    prev.map((pa) => ({
                        ...pa,
                        affectedProducts: pa.affectedProducts.map((prod) =>
                            prod.productId === priceEditModal.productId
                                ? { ...prod, currentSellingPrice: parsedPrice }
                                : prod
                        ),
                    }))
                );

                setTimeout(() => {
                    setPriceEditModal(null);
                    setPriceSaveSuccess(false);
                }, 900);
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error || "Nie udało się zaktualizować ceny"}`);
            }
        } catch (error) {
            console.error("Błąd zapisu nowej ceny:", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSavingPrice(false);
        }
    };

    const activeInvoices = invoices.filter((i) => !i.isDismissed);
    const activePriceAlerts = priceAlerts.filter((p) => !p.isDismissed);

    const hasAnyDismissed = invoices.some((i) => i.isDismissed) || priceAlerts.some((p) => p.isDismissed);

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 max-w-7xl mx-auto">
            {/* ========================================================= */}
            {/* NAGŁÓWEK STRONY I AKCJE                                   */}
            {/* ========================================================= */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black flex items-center gap-3">
                        <div className="relative">
                            <Bell className="text-ui-primary" size={32} />
                            {summary.totalCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                            )}
                        </div>
                        Powiadomienia
                    </h1>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {hasAnyDismissed && (
                        <button
                            onClick={handleRestoreAll}
                            className="px-3.5 py-2 text-xs font-semibold text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20 rounded-xl transition-colors cursor-pointer border border-ui-accent"
                        >
                            Przywróć ukryte
                        </button>
                    )}

                    {summary.totalCount > 0 && (
                        <button
                            onClick={handleDismissAll}
                            className="px-3.5 py-2 text-xs font-semibold text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20 rounded-xl transition-colors cursor-pointer border border-ui-accent"
                        >
                            Oznacz wszystkie jako przeczytane
                        </button>
                    )}

                    <button
                        onClick={() => fetchNotifications(true)}
                        disabled={isRefreshing || isLoading}
                        className="flex items-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-4 py-2.5 rounded-xl font-semibold shadow-sm transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                        <RotateCw size={15} className={isRefreshing ? "animate-spin text-emerald-600" : ""} />
                        Odśwież
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* KARTY PODSUMOWUJĄCE (KPIs)                                */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Wszystkie powiadomienia */}
                <div
                    onClick={() => setActiveTab("ALL")}
                    className={`bg-white border rounded-2xl p-5 shadow-sm transition-all cursor-pointer ${activeTab === "ALL" ? "border-ui-primary ring-2 ring-ui-primary/20 bg-ui-primary/5" : "border-ui-accent hover:border-ui-secondary"}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Wszystkie alerty</span>
                        <div className="p-2.5 rounded-xl bg-ui-primary/10 text-ui-primary">
                            <Bell size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-ui-black mt-2">
                        {summary.totalCount}
                    </div>
                    <div className="text-xs text-ui-secondary mt-1">
                        {summary.totalCount === 0 ? "Brak aktywnych alertów" : "Wymagających Twojej reakcji"}
                    </div>
                </div>

                {/* Faktury do zmapowania */}
                <div
                    onClick={() => setActiveTab("INVOICES")}
                    className={`bg-white border rounded-2xl p-5 shadow-sm transition-all cursor-pointer ${activeTab === "INVOICES" ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30" : "border-ui-accent hover:border-amber-300"}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Do zmapowania</span>
                        <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                            <FileText size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-ui-black mt-2">
                        {summary.unmappedInvoicesCount}
                    </div>
                    <div className="text-xs text-ui-secondary mt-1">
                        Faktur oczekujących na weryfikację
                    </div>
                </div>

                {/* Wzrosty cen składników */}
                <div
                    onClick={() => setActiveTab("PRICE_INCREASES")}
                    className={`bg-white border rounded-2xl p-5 shadow-sm transition-all cursor-pointer ${activeTab === "PRICE_INCREASES" ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/30" : "border-ui-accent hover:border-rose-300"}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Wzrosty cen surowców</span>
                        <div className="p-2.5 rounded-xl bg-rose-100 text-rose-800">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-rose-950 mt-2">
                        {summary.priceAlertsCount}
                    </div>
                    <div className="text-xs text-ui-secondary mt-1">
                        Składników z podwyższoną ceną
                    </div>
                </div>

                {/* Wyroby do rekalkulacji */}
                <div
                    onClick={() => setActiveTab("PRICE_INCREASES")}
                    className="bg-white border border-ui-accent rounded-2xl p-5 shadow-sm hover:border-emerald-300 transition-all cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Wyroby do rewizji cen</span>
                        <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                            <ChefHat size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-emerald-950 mt-2">
                        {summary.affectedProductsCount}
                    </div>
                    <div className="text-xs text-ui-secondary mt-1">
                        Produktów dotkniętych podwyżkami
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* ZAKŁADKI FILTROWANIA                                      */}
            {/* ========================================================= */}
            <div className="flex items-center gap-2 border-b border-ui-accent/60 pb-3 mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab("ALL")}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${activeTab === "ALL"
                        ? "bg-ui-primary text-white shadow-sm"
                        : "text-ui-secondary hover:text-ui-primary hover:bg-ui-accent/20"
                        }`}
                >
                    Wszystkie powiadomienia ({summary.totalCount})
                </button>

                <button
                    onClick={() => setActiveTab("INVOICES")}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === "INVOICES"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-ui-secondary hover:text-amber-800 hover:bg-amber-50"
                        }`}
                >
                    <FileText size={14} />
                    Faktury do zmapowania ({summary.unmappedInvoicesCount})
                </button>

                <button
                    onClick={() => setActiveTab("PRICE_INCREASES")}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === "PRICE_INCREASES"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-ui-secondary hover:text-rose-800 hover:bg-rose-50"
                        }`}
                >
                    <TrendingUp size={14} />
                    Wzrosty cen składników ({summary.priceAlertsCount})
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
            ) : summary.totalCount === 0 && (activeTab === "ALL" || (activeTab === "INVOICES" && activeInvoices.length === 0) || (activeTab === "PRICE_INCREASES" && activePriceAlerts.length === 0)) ? (
                <div className="bg-emerald-50/40 border border-emerald-200 rounded-3xl p-12 text-center my-8">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-4 shadow-sm">
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-emerald-950 mb-1">Wszystko jest aktualne!</h3>
                    <p className="text-sm text-emerald-800 max-w-md mx-auto">
                        Wszystkie faktury zostały zweryfikowane i zmapowane, a w ostatnim okresie nie odnotowano nowych podwyżek cen składników.
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
                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
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
                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
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

                                                            <div className="mt-3 pt-2 border-t border-ui-accent/30 flex items-center justify-between gap-2">
                                                                <button
                                                                    onClick={() => router.push(`/przepisy/${prod.productId}`)}
                                                                    className="text-[11px] font-semibold text-ui-secondary hover:text-ui-primary transition-colors cursor-pointer"
                                                                >
                                                                    Otwórz przepis
                                                                </button>

                                                                <button
                                                                    onClick={() =>
                                                                        setPriceEditModal({
                                                                            isOpen: true,
                                                                            productId: prod.productId,
                                                                            productName: prod.productName,
                                                                            currentPrice: prod.currentSellingPrice,
                                                                            suggestedPrice: prod.suggestedSellingPrice,
                                                                            newPrice: String(prod.suggestedSellingPrice),
                                                                            ingredientName: pa.ingredientName,
                                                                            costIncrease: prod.foodCostIncrease,
                                                                        })
                                                                    }
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                                                                >
                                                                    <Pencil size={12} />
                                                                    Zmień cenę
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
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL SZYBKIEJ ZMIANY CENY SPRZEDAŻY WYROBU              */}
            {/* ========================================================= */}
            {priceEditModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setPriceEditModal(null)}
                >
                    <div
                        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-ui-accent overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                            <h2 className="text-base font-bold text-ui-black flex items-center gap-2">
                                <Tag size={18} className="text-ui-primary" />
                                Zmiana ceny sprzedaży wyrobu
                            </h2>
                            <button
                                onClick={() => setPriceEditModal(null)}
                                className="p-1 rounded-full hover:bg-ui-accent/20 text-ui-secondary hover:text-ui-primary transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-ui-accent/10 rounded-2xl p-4 border border-ui-accent/60">
                                <div className="text-xs text-ui-secondary font-medium">Produkt:</div>
                                <div className="text-lg font-bold text-ui-black">{priceEditModal.productName}</div>
                                <div className="text-xs text-rose-700 font-semibold mt-1">
                                    Powód: Wzrost ceny składnika <strong>{priceEditModal.ingredientName}</strong> (+{priceEditModal.costIncrease.toFixed(2)} zł/szt.)
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-xl bg-ui-white border border-ui-accent">
                                    <div className="text-ui-secondary">Dotychczasowa cena:</div>
                                    <div className="text-base font-bold text-ui-black mt-0.5">
                                        {priceEditModal.currentPrice.toFixed(2)} zł
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                    <div className="text-emerald-800">Sugerowana nowa cena:</div>
                                    <div className="text-base font-black text-emerald-950 mt-0.5">
                                        {priceEditModal.suggestedPrice.toFixed(2)} zł
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase mb-1.5">
                                    Nowa cena sprzedaży brutto (zł):
                                </label>
                                <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    value={priceEditModal.newPrice}
                                    onChange={(e) =>
                                        setPriceEditModal({
                                            ...priceEditModal,
                                            newPrice: e.target.value,
                                        })
                                    }
                                    className="w-full h-11 bg-ui-white border border-ui-accent rounded-xl px-4 text-base font-black text-ui-black focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                />
                            </div>

                            <div className="pt-4 border-t border-ui-accent flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPriceEditModal(null)}
                                    className="px-4 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold text-xs hover:bg-ui-accent/30 transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveNewProductPrice}
                                    disabled={isSavingPrice}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${priceSaveSuccess ? "bg-emerald-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                                >
                                    {isSavingPrice ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Zapisywanie...
                                        </>
                                    ) : priceSaveSuccess ? (
                                        <>
                                            <Check size={14} />
                                            Zaktualizowano cenę!
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={14} />
                                            Zapisz nową cenę
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
