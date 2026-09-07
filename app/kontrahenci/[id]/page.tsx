"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    Receipt,
    ShoppingCart,
    ShoppingBag,
    Copy,
    Check,
    Search,
    Mail,
    Phone,
    MapPin,
    User,
    Calendar,
    Coins,
    FileText,
    ChevronDown,
    ChevronUp,
    Loader2,
    CheckSquare,
    Square,
    ExternalLink,
    Clock,
    FileCheck,
    AlertCircle,
    Package,
    Sparkles,
    Trash2,
    Edit3,
    X,
} from "lucide-react";

// Helper do formatowania daty: YYYY-MM-DD -> DD-MM-YYYY
function formatDate(dateStr?: string | Date | null): string {
    if (!dateStr) return "-";
    const str = typeof dateStr === "string" ? dateStr : dateStr.toISOString();
    const cleanDate = str.split("T")[0];
    const parts = cleanDate.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

interface InvoicePosition {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    netPrice: number;
    grossAmount: number;
}

interface InvoiceItem {
    id: string;
    invoiceNumber: string;
    ksefNumber: string;
    isSales?: boolean;
    issuedDate: string;
    dueDate: string;
    grossAmount: number;
    netAmount: number;
    vatAmount: number;
    status: string;
    positionsCount: number;
    positions: InvoicePosition[];
}

interface PurchasedProduct {
    id: string;
    name: string;
    unit: string;
    lastPrice: number;
    totalQuantity: number;
    totalSpent: number;
    purchaseCount: number;
    lastPurchasedDate: string;
}

interface ContractorDetails {
    id: string;
    type: "SUPPLIER" | "CUSTOMER" | "OTHER";
    name: string;
    customName?: string | null;
    displayName?: string;
    nip: string;
    address: string | null;
    email: string | null;
    phone: string | null;
    contactPerson: string | null;
    notes: string | null;
    createdAt: string;
}

interface ContractorData {
    contractor: ContractorDetails;
    stats: {
        totalGross: number;
        totalNet: number;
        totalVat: number;
        invoicesCount: number;
        averageInvoiceGross: number;
        lastPurchaseDate: string | null;
    };
    invoices: InvoiceItem[];
    purchasedProducts: PurchasedProduct[];
}

export default function ContractorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [data, setData] = useState<ContractorData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Aktywna zakładka: "PRODUCTS" | "INVOICES" | "SHOPPING_LIST"
    const [activeTab, setActiveTab] = useState<"PRODUCTS" | "INVOICES" | "SHOPPING_LIST">("PRODUCTS");

    // Rozwijanie pozycji konkretnej faktury
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

    // Wyszukiwarki
    const [productSearch, setProductSearch] = useState("");
    const [invoiceSearch, setInvoiceSearch] = useState("");

    // -------------------------------------------------------------
    // STAN LISTY ZAKUPÓW
    // -------------------------------------------------------------
    // Mapowanie: productId -> { selected: boolean, quantity: string, unit: string, note?: string }
    const [selectedItems, setSelectedItems] = useState<
        Record<string, { selected: boolean; quantity: string; unit: string; note: string }>
    >({});
    const [copiedToClipboard, setCopiedToClipboard] = useState(false);
    const [orderNotes, setOrderNotes] = useState();

    // -------------------------------------------------------------
    // STAN EDYCJI WŁASNEJ NAZWY KONTRAHENTA
    // -------------------------------------------------------------
    const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
    const [customNameInput, setCustomNameInput] = useState("");
    const [isSavingCustomName, setIsSavingCustomName] = useState(false);

    // Pobieranie danych kontrahenta
    const fetchContractorData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/kontrahenci/${id}`);
            if (!res.ok) {
                if (res.status === 404) {
                    setError("Nie znaleziono kontrahenta w bazie.");
                } else {
                    const err = await res.json().catch(() => ({}));
                    setError(err.error || "Wystąpił błąd podczas ładowania danych.");
                }
                return;
            }
            const json: ContractorData = await res.json();
            setData(json);

            // Inicjalizacja domyślnych jednostek dla listy zakupów
            const initialSelection: Record<string, { selected: boolean; quantity: string; unit: string; note: string }> = {};
            json.purchasedProducts.forEach((p) => {
                let u = (p.unit || "szt").toLowerCase();
                if (u === "l") u = "litry";
                if (!["szt", "litry", "kg", "opak"].includes(u)) u = "szt";
                initialSelection[p.id] = {
                    selected: false,
                    quantity: "1",
                    unit: u,
                    note: "",
                };
            });
            setSelectedItems(initialSelection);
        } catch (err: any) {
            console.error("Błąd ładowania danych kontrahenta:", err);
            setError("Błąd połączenia z serwerem.");
        } finally {
            setIsLoading(false);
        }
    };

    // Obsługa edycji własnej nazwy kontrahenta
    const handleOpenEditNameModal = () => {
        if (!data) return;
        setCustomNameInput(data.contractor.customName || data.contractor.name);
        setIsEditNameModalOpen(true);
    };

    const handleSaveCustomName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data) return;
        setIsSavingCustomName(true);
        try {
            const cleanName = customNameInput.trim();
            const res = await fetch(`/api/kontrahenci/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customName: cleanName === data.contractor.name ? null : cleanName,
                }),
            });

            if (res.ok) {
                const updatedCustom = cleanName === data.contractor.name ? null : cleanName;
                setData((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        contractor: {
                            ...prev.contractor,
                            customName: updatedCustom,
                            displayName: updatedCustom || prev.contractor.name,
                        },
                    };
                });
                setIsEditNameModalOpen(false);
            } else {
                alert("Wystąpił błąd podczas zapisywania nazwy.");
            }
        } catch (err) {
            console.error("Błąd aktualizacji nazwy:", err);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSavingCustomName(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchContractorData();
        }
    }, [id]);

    // Obsługa zaznaczania produktu do zamówienia
    const toggleProductSelection = (productId: string, defaultUnit: string) => {
        let u = (defaultUnit || "szt").toLowerCase();
        if (u === "l") u = "litry";
        if (!["szt", "litry", "kg", "opak"].includes(u)) u = "szt";
        setSelectedItems((prev) => {
            const current = prev[productId] || { selected: false, quantity: "1", unit: u, note: "" };
            return {
                ...prev,
                [productId]: {
                    ...current,
                    selected: !current.selected,
                },
            };
        });
    };

    const updateItemQuantity = (productId: string, quantity: string) => {
        setSelectedItems((prev) => {
            const current = prev[productId] || { selected: true, quantity: "1", unit: "kg", note: "" };
            return {
                ...prev,
                [productId]: {
                    ...current,
                    quantity,
                },
            };
        });
    };

    const updateItemUnit = (productId: string, unit: string) => {
        setSelectedItems((prev) => {
            const current = prev[productId] || { selected: true, quantity: "1", unit, note: "" };
            return {
                ...prev,
                [productId]: {
                    ...current,
                    unit,
                },
            };
        });
    };

    // Liczba zaznaczonych pozycji do zamówienia
    const selectedCount = useMemo(() => {
        return Object.values(selectedItems).filter((item) => item.selected).length;
    }, [selectedItems]);

    // Zaznacz / Odznacz wszystkie
    const handleSelectAll = (select: boolean) => {
        if (!data) return;
        setSelectedItems((prev) => {
            const updated = { ...prev };
            data.purchasedProducts.forEach((p) => {
                updated[p.id] = {
                    ...(updated[p.id] || { quantity: "1", unit: p.unit, note: "" }),
                    selected: select,
                };
            });
            return updated;
        });
    };

    // Filtrowane produkty
    const filteredProducts = useMemo(() => {
        if (!data) return [];
        return data.purchasedProducts.filter((p) =>
            p.name.toLowerCase().includes(productSearch.toLowerCase())
        );
    }, [data, productSearch]);

    // Filtrowane faktury
    const filteredInvoices = useMemo(() => {
        if (!data) return [];
        return data.invoices.filter(
            (inv) =>
                inv.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                inv.issuedDate.includes(invoiceSearch)
        );
    }, [data, invoiceSearch]);

    // Generowanie sformatowanego tekstu listy zakupów
    const generatedShoppingListText = useMemo(() => {
        if (!data) return "";

        const selectedList = data.purchasedProducts.filter(
            (p) => selectedItems[p.id]?.selected
        );

        if (selectedList.length === 0) {
            return "";
        }

        const dateFormatted = formatDate(new Date());
        const displayName = data.contractor.customName || data.contractor.name;
        const officialNameNotice =
            data.contractor.customName && data.contractor.customName !== data.contractor.name
                ? ` (${data.contractor.name})`
                : "";

        const header = `Dzień dobry, poproszę do piekarni MWS:\n`;

        const itemsText = selectedList
            .map((item) => {
                const config = selectedItems[item.id];
                const qtyStr = (config?.quantity || "1").trim();
                const unitStr = (config?.unit || item.unit || "szt").trim();
                const noteStr = config?.note ? ` (${config.note})` : "";

                const isPieces = ["szt", "szt.", "sztuka", "sztuk", "sztuki", "x"].includes(unitStr.toLowerCase());

                if (isPieces) {
                    const formattedQty = qtyStr.toLowerCase().endsWith("x") ? qtyStr : `${qtyStr}x`;
                    return `${formattedQty} ${item.name}${noteStr}`;
                } else {
                    return `${qtyStr} ${unitStr} ${item.name}${noteStr}`;
                }
            })
            .join("\n");

        const footer = `\n\n${orderNotes ? `Uwagi: ${orderNotes}\n` : ""}Dziękuję i pozdrawiam.\nMarta Chytrowska`;

        return `${header}\n${itemsText}${footer}`;
    }, [data, selectedItems, orderNotes]);

    // Kopiowanie do schowka
    const handleCopyList = () => {
        if (!generatedShoppingListText) return;
        navigator.clipboard.writeText(generatedShoppingListText);
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-ui-white flex items-center justify-center pb-20">
                <div className="flex flex-col items-center gap-3 text-ui-secondary">
                    <Loader2 size={32} className="animate-spin text-ui-accent" />
                    <p className="font-medium text-sm">Ładowanie karty kontrahenta i historii zakupów...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-ui-white p-6 max-w-4xl mx-auto">
                <button
                    onClick={() => router.push("/kontrahenci")}
                    className="flex items-center gap-2 text-ui-secondary hover:text-ui-primary font-semibold text-sm mb-6 transition-colors cursor-pointer"
                >
                    <ArrowLeft size={16} /> Powrót do listy kontrahentów
                </button>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
                    <AlertCircle size={36} className="text-rose-600 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-rose-900 mb-1">Błąd ładowania kontrahenta</h2>
                    <p className="text-sm text-rose-700 mb-4">{error || "Nie znaleziono kontrahenta."}</p>
                    <button
                        onClick={() => router.push("/kontrahenci")}
                        className="bg-ui-primary text-ui-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm hover:opacity-90 cursor-pointer"
                    >
                        Wróć do listy kontrahentów
                    </button>
                </div>
            </div>
        );
    }

    const { contractor, stats, invoices } = data;

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-24">
            {/* Przycisk powrotu */}
            <button
                onClick={() => router.push("/kontrahenci")}
                className="flex items-center gap-2 text-ui-secondary hover:text-ui-primary font-semibold text-sm mb-6 transition-colors cursor-pointer group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Powrót do bazy kontrahentów
            </button>

            {/* ========================================================= */}
            {/* NAGŁÓWEK KONTRAHENTA & DANE TELEADRESOWE                   */}
            {/* ========================================================= */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 sm:p-7 shadow-sm mb-8">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            {contractor.nip && (
                                <span className="text-xs  text-ui-secondary">
                                    NIP: <b className="text-ui-black">{contractor.nip}</b>
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ui-black">
                                {contractor.customName || contractor.name}
                            </h1>
                            <button
                                onClick={handleOpenEditNameModal}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary font-bold text-xs transition-colors cursor-pointer shadow-sm"
                                title="Zmień własną nazwę kontrahenta"
                            >
                                <Edit3 size={13} className="text-ui-accent" />
                                Zmień nazwę
                            </button>
                        </div>

                        {/* Informacja o oficjalnej nazwie z faktury */}
                        <div className="text-xs text-ui-secondary flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="font-semibold text-ui-secondary">Nazwa z faktury:</span>
                            <span className="text-ui-black font-medium">{contractor.name}</span>
                            {contractor.customName && contractor.customName !== contractor.name && (
                                <span className="text-[10px] font-bold bg-ui-white text-ui-accent border border-ui-accent px-1.5 py-0.2 rounded">
                                    Własna nazwa aktywna
                                </span>
                            )}
                        </div>

                        {/* Dane kontaktowe w tagach */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3.5 text-xs text-ui-secondary">
                            {contractor.address && contractor.address !== 'Pobrano z KSeF' && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin size={14} className="text-ui-accent shrink-0" />
                                    <span>{contractor.address}</span>
                                </div>
                            )}
                            {contractor.email && (
                                <div className="flex items-center gap-1.5">
                                    <Mail size={14} className="text-blue-700 shrink-0" />
                                    <a
                                        href={`mailto:${contractor.email}`}
                                        className="text-blue-700 hover:underline font-medium"
                                    >
                                        {contractor.email}
                                    </a>
                                </div>
                            )}
                            {contractor.phone && (
                                <div className="flex items-center gap-1.5">
                                    <Phone size={14} className="text-emerald-700 shrink-0" />
                                    <a
                                        href={`tel:${contractor.phone}`}
                                        className="text-emerald-700 hover:underline font-medium"
                                    >
                                        {contractor.phone}
                                    </a>
                                </div>
                            )}
                            {contractor.contactPerson && (
                                <div className="flex items-center gap-1.5">
                                    <User size={14} className="text-purple-700 shrink-0" />
                                    <span>Osoba kontaktowa: <b>{contractor.contactPerson}</b></span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Szybki przycisk przejścia do listy zakupów */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setActiveTab("SHOPPING_LIST")}
                            className="flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
                        >
                            <ShoppingCart size={17} />
                            Generuj listę zakupów
                            {selectedCount > 0 && (
                                <span className="bg-white text-ui-accent font-extrabold px-1.5 py-0.2 rounded-full text-[11px]">
                                    {selectedCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Notatka wewnętrzna jeśli istnieje */}
                {contractor.notes && (
                    <div className="mt-5 p-3.5 bg-ui-accent/10 border border-ui-accent/40 rounded-xl text-xs">
                        <span className="font-bold text-ui-secondary uppercase tracking-wider text-[10px] block mb-0.5">
                            Notatka wewnętrzna:
                        </span>
                        <p className="text-ui-black/90 whitespace-pre-wrap">{contractor.notes}</p>
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* KARTY STATYSTYK FINANSOWYCH (PODSUMOWANIE WYDATKÓW)       */}
            {/* ========================================================= */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* 1. Łączne wydatki brutto */}
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Łączne wydatki</span>
                        <Coins size={18} className="text-ui-primary" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-ui-primary">
                            {stats.totalGross.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} <span className="text-xs font-semibold">zł</span>
                        </div>
                        <p className="text-[11px] text-ui-secondary mt-1">
                            Netto: <b>{stats.totalNet.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</b>
                        </p>
                    </div>
                </div>

                {/* 2. Liczba faktur */}
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-ui-secondary mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Zarejestrowane faktury</span>
                        <Receipt size={18} className="text-ui-primary" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-ui-black">
                            {stats.invoicesCount} <span className="text-xs font-semibold text-ui-secondary">dokumentów</span>
                        </div>
                    </div>
                </div>

                {/* 3. Ostatnie zakupy */}

            </div>

            {/* ========================================================= */}
            {/* ZAKŁADKI: PRODUKTY / FAKTURY / GENERATOR LISTY ZAKUPÓW    */}
            {/* ========================================================= */}
            <div className="flex items-center gap-2 border-b border-ui-accent mb-6">
                <button
                    onClick={() => setActiveTab("PRODUCTS")}
                    className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "PRODUCTS"
                        ? "border-ui-primary text-ui-primary"
                        : "border-transparent text-ui-secondary hover:text-ui-black"
                        }`}
                >
                    <ShoppingBag size={16} />
                    Produkty ({data.purchasedProducts.length})
                </button>

                <button
                    onClick={() => setActiveTab("INVOICES")}
                    className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "INVOICES"
                        ? "border-ui-primary text-ui-primary"
                        : "border-transparent text-ui-secondary hover:text-ui-black"
                        }`}
                >
                    <Receipt size={16} />
                    Ostatnie faktury ({invoices.length})
                </button>

                <button
                    onClick={() => setActiveTab("SHOPPING_LIST")}
                    className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "SHOPPING_LIST"
                        ? "border-ui-accent text-ui-primary"
                        : "border-transparent text-ui-secondary hover:text-ui-black"
                        }`}
                >
                    <ShoppingCart size={16} />
                    Lista zakupów
                    {selectedCount > 0 && (
                        <span className="ml-1 bg-ui-accent text-white font-extrabold px-2 py-0.5 rounded-full text-[11px]">
                            {selectedCount}
                        </span>
                    )}
                </button>
            </div>

            {/* ========================================================= */}
            {/* ZAKŁADKA 1: PRODUKTY KONTRAHENTA                          */}
            {/* ========================================================= */}
            {activeTab === "PRODUCTS" && (
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 shadow-sm">
                    {/* Pasek filtrowania i akcji */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ui-secondary" />
                            <input
                                type="text"
                                placeholder="Szukaj produktu po nazwie..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full bg-ui-white border border-ui-accent rounded-xl pl-10 pr-4 py-2 text-xs text-ui-black focus:outline-none focus:border-ui-accent shadow-sm"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleSelectAll(true)}
                                className="px-3 py-1.5 rounded-lg border border-ui-accent text-ui-secondary hover:text-ui-black text-xs font-semibold transition-colors cursor-pointer"
                            >
                                Zaznacz wszystkie
                            </button>
                            <button
                                onClick={() => handleSelectAll(false)}
                                className="px-3 py-1.5 rounded-lg border border-ui-accent text-ui-secondary hover:text-ui-black text-xs font-semibold transition-colors cursor-pointer"
                            >
                                Odznacz wszystkie
                            </button>
                        </div>
                    </div>

                    {/* Tabela Produktów */}
                    {filteredProducts.length === 0 ? (
                        <div className="py-16 text-center text-ui-secondary text-sm">
                            Brak produktów spełniających kryteria wyszukiwania.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase tracking-wider text-[10px] border-b border-ui-accent">
                                        <th className="py-3 px-3 text-center w-12">Zamów</th>
                                        <th className="py-3 px-3">Nazwa Produktu</th>
                                        <th className="py-3 px-3 text-right">Ostatnia cena netto</th>
                                        <th className="py-3 px-3 text-right">Kupiona ilość</th>
                                        <th className="py-3 px-3 text-right">Wydano łącznie</th>
                                        <th className="py-3 px-3 text-right">Ostatni zakup</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ui-accent/40">
                                    {filteredProducts.map((prod) => {
                                        const isSelected = selectedItems[prod.id]?.selected || false;
                                        return (
                                            <tr
                                                key={prod.id}
                                                onClick={() => toggleProductSelection(prod.id, prod.unit)}
                                                className={`hover:bg-ui-accent/5 transition-colors cursor-pointer ${isSelected ? "bg-ui-accent/10" : ""
                                                    }`}
                                            >
                                                {/* Checkbox do zamówienia */}
                                                <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleProductSelection(prod.id, prod.unit)}
                                                        className="w-4 h-4 rounded border-ui-accent text-ui-accent focus:ring-ui-accent cursor-pointer"
                                                    />
                                                </td>

                                                {/* Nazwa */}
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-ui-black text-sm">{prod.name}</div>
                                                    <div className="text-[10px] text-ui-secondary">Jednostka: {prod.unit}</div>
                                                </td>

                                                {/* Ostatnia cena */}
                                                <td className="py-3 px-3 text-right font-bold text-ui-black">
                                                    {prod.lastPrice > 0 ? `${prod.lastPrice.toFixed(2)} zł / ${prod.unit}` : "—"}
                                                </td>

                                                {/* Kupiona ilość */}
                                                <td className="py-3 px-3 text-right font-medium text-ui-black">
                                                    {prod.totalQuantity > 0 ? `${prod.totalQuantity.toLocaleString("pl-PL")} ${prod.unit}` : "—"}
                                                </td>

                                                {/* Wydano łącznie */}
                                                <td className="py-3 px-3 text-right font-black text-ui-secondary">
                                                    {prod.totalSpent > 0 ? `${prod.totalSpent.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł` : "—"}
                                                </td>

                                                {/* Data ostatniego zakupu */}
                                                <td className="py-3 px-3 text-right text-ui-secondary font-medium">
                                                    {prod.lastPurchasedDate && prod.lastPurchasedDate !== "-" ? formatDate(prod.lastPurchasedDate) : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================= */}
            {/* ZAKŁADKA 2: OSTATNIE FAKTURY OD DOSTAWCY                  */}
            {/* ========================================================= */}
            {activeTab === "INVOICES" && (
                <div className="bg-ui-white border border-ui-accent rounded-2xl p-6 shadow-sm">
                    {/* Wyszukiwarka faktur */}
                    <div className="relative max-w-md mb-6">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ui-secondary" />
                        <input
                            type="text"
                            placeholder="Szukaj po numerze faktury lub dacie..."
                            value={invoiceSearch}
                            onChange={(e) => setInvoiceSearch(e.target.value)}
                            className="w-full bg-ui-white border border-ui-accent rounded-xl pl-10 pr-4 py-2 text-xs text-ui-black focus:outline-none focus:border-ui-accent shadow-sm"
                        />
                    </div>

                    {filteredInvoices.length === 0 ? (
                        <div className="py-16 text-center text-ui-secondary text-sm">
                            Brak faktur dla tego kontrahenta.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredInvoices.map((inv) => {
                                const isExpanded = expandedInvoiceId === inv.id;

                                return (
                                    <div
                                        key={inv.id}
                                        className="border border-ui-accent rounded-xl overflow-hidden shadow-sm transition-all"
                                    >
                                        {/* Wiersz nagłówka faktury */}
                                        <div
                                            onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                                            className="p-4 bg-ui-white hover:bg-ui-accent/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-ui-accent/20 text-ui-accent rounded-xl">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-extrabold text-sm text-ui-black flex flex-wrap items-center gap-2">
                                                        <span>Faktura nr {inv.invoiceNumber}</span>
                                                        {inv.isSales ? (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 uppercase tracking-wider">
                                                                Sprzedaż
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-ui-accent/20 text-ui-accent uppercase tracking-wider">
                                                                Zakup
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ui-accent/20 text-ui-secondary">
                                                            {inv.positionsCount} pozycji
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-ui-secondary flex items-center gap-3 mt-0.5">
                                                        <span>Wystawiono: <b>{formatDate(inv.issuedDate)}</b></span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-6">
                                                <div className="text-right">
                                                    <div className="text-base font-black text-ui-secondary">
                                                        {inv.grossAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                                                    </div>
                                                    <div className="text-[11px] text-ui-secondary">
                                                        netto: {inv.netAmount.toFixed(2)} zł | VAT: {inv.vatAmount.toFixed(2)} zł
                                                    </div>
                                                </div>

                                                <button className="p-1 hover:bg-ui-accent/20 rounded-lg text-ui-secondary">
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Rozwinięcie pozycji faktury */}
                                        {isExpanded && (
                                            <div className="p-4 bg-ui-accent/5 border-t border-ui-accent/60">
                                                <span className="text-[11px] font-bold text-ui-secondary uppercase tracking-wider block mb-2">
                                                    Pozycje na fakturze:
                                                </span>
                                                <div className="border border-ui-accent/60 rounded-xl overflow-hidden bg-ui-white">
                                                    <table className="w-full text-left text-xs">
                                                        <thead>
                                                            <tr className="bg-ui-accent/15 text-ui-secondary font-bold uppercase text-[9px] border-b border-ui-accent/60">
                                                                <th className="py-2 px-3">Pozycja</th>
                                                                <th className="py-2 px-3 text-right">Ilość</th>
                                                                <th className="py-2 px-3 text-right">Cena jedn. netto</th>
                                                                <th className="py-2 px-3 text-right">Wartość brutto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-ui-accent/40">
                                                            {inv.positions.map((pos) => (
                                                                <tr key={pos.id} className="hover:bg-ui-accent/5">
                                                                    <td className="py-2.5 px-3 font-semibold text-ui-black">
                                                                        {pos.name}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-medium">
                                                                        {pos.quantity} {pos.unit}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right text-ui-secondary">
                                                                        {pos.netPrice.toFixed(2)} zł
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-bold text-ui-black">
                                                                        {pos.grossAmount.toFixed(2)} zł
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================= */}
            {/* ZAKŁADKA 3: GENERATOR LISTY ZAKUPÓW                       */}
            {/* ========================================================= */}
            {activeTab === "SHOPPING_LIST" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Lewa kolumna: Wybór produktów i ilości */}
                    <div className="lg:col-span-7 bg-ui-white border border-ui-accent rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-ui-black">
                                        Wybierz produkty do zamówienia
                                    </h3>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleSelectAll(true)}
                                        className="px-2.5 py-1 rounded-lg border border-ui-accent text-ui-secondary hover:text-ui-black text-[11px] font-semibold"
                                    >
                                        Wszystkie
                                    </button>
                                    <button
                                        onClick={() => handleSelectAll(false)}
                                        className="px-2.5 py-1 rounded-lg border border-ui-accent text-ui-secondary hover:text-ui-black text-[11px] font-semibold"
                                    >
                                        Odznacz
                                    </button>
                                </div>
                            </div>

                            {/* Tabela do wpisywania ilości */}
                            <div className="border border-ui-accent rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-ui-accent/15">
                                        <tr className="border-b border-ui-accent text-ui-secondary font-bold uppercase text-[9px]">
                                            <th className="py-2.5 px-3 w-10 text-center">Wybór</th>
                                            <th className="py-2.5 px-3">Produkt</th>
                                            <th className="py-2.5 px-3 text-right w-44">Zamawiana ilość</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-accent/40">
                                        {data.purchasedProducts.map((prod) => {
                                            const itemState = selectedItems[prod.id] || {
                                                selected: false,
                                                quantity: "1",
                                                unit: prod.unit,
                                                note: "",
                                            };

                                            return (
                                                <tr
                                                    key={prod.id}
                                                    className={`hover:bg-ui-accent/5 transition-colors ${itemState.selected ? "bg-ui-accent/10" : ""
                                                        }`}
                                                >
                                                    <td className="py-2.5 px-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={itemState.selected}
                                                            onChange={() => toggleProductSelection(prod.id, prod.unit)}
                                                            className="w-4 h-4 rounded border-ui-accent text-ui-accent focus:ring-ui-accent cursor-pointer"
                                                        />
                                                    </td>

                                                    <td
                                                        className="py-2.5 px-3 cursor-pointer"
                                                        onClick={() => toggleProductSelection(prod.id, prod.unit)}
                                                    >
                                                        <div className="font-bold text-ui-black">{prod.name}</div>
                                                        <div className="text-[10px] text-ui-secondary">
                                                            Ostatnia cena: {prod.lastPrice > 0 ? `${prod.lastPrice.toFixed(2)} zł` : "—"}
                                                        </div>
                                                    </td>

                                                    <td className="py-2.5 px-3 text-right">
                                                        {itemState.selected ? (
                                                            <div className="flex items-center justify-end gap-1.5 animate-fade-in">
                                                                <input
                                                                    type="text"
                                                                    value={itemState.quantity}
                                                                    onChange={(e) =>
                                                                        updateItemQuantity(prod.id, e.target.value)
                                                                    }
                                                                    placeholder="ilość"
                                                                    className="w-16 bg-ui-white border border-ui-accent rounded-lg px-2 py-1 text-center font-bold text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-sm"
                                                                />
                                                                <select
                                                                    value={itemState.unit === "l" ? "litry" : itemState.unit}
                                                                    onChange={(e) =>
                                                                        updateItemUnit(prod.id, e.target.value)
                                                                    }
                                                                    className="bg-ui-white border border-ui-accent rounded-lg px-2 py-1 text-center font-semibold text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-sm cursor-pointer"
                                                                >
                                                                    <option value="szt">szt</option>
                                                                    <option value="litry">litry</option>
                                                                    <option value="kg">kg</option>
                                                                    <option value="opak">opak</option>
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-ui-secondary/50 font-medium">
                                                                {prod.unit}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pole uwag do zamówienia */}
                        <div className="mt-5">
                            <label className="block text-xs font-bold text-ui-secondary tracking-wider mb-1.5">
                                Dodatkowe uwagi do zamówienia:
                            </label>
                            <textarea
                                rows={2}
                                value={orderNotes}
                                onChange={(e) => setOrderNotes(e.target.value)}
                                placeholder="np. Proszę o dostawę do godziny 7:00..."
                                className="w-full bg-ui-white border border-ui-accent rounded-xl p-3 text-xs text-ui-black focus:outline-none focus:border-ui-accent transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Prawa kolumna: Podgląd gotowego tekstu do skopiowania */}
                    <div className="lg:col-span-5 bg-ui-accent/10 border border-ui-accent/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-ui-primary tracking-wider">
                                        Gotowa lista do skopiowania
                                    </h3>
                                </div>
                                <span className="text-xs font-bold bg-ui-accent/20 text-ui-primary px-2 py-0.5 rounded-full">
                                    {selectedCount} pozycji
                                </span>
                            </div>

                            <div className="relative">
                                <textarea
                                    readOnly
                                    rows={14}
                                    value={generatedShoppingListText}
                                    className="w-full bg-ui-white border border-ui-accent/40 rounded-lg p-3.5 text-xs text-ui-black font-mono leading-relaxed focus:outline-none shadow-inner resize-none"
                                />
                            </div>
                        </div>

                        {/* Przyciski akcji: Kopiuj / Wyślij */}
                        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5">
                            <button
                                onClick={handleCopyList}
                                disabled={selectedCount === 0}
                                className={`flex-1 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer ${copiedToClipboard
                                    ? "bg-ui-accent text-white"
                                    : "bg-ui-primary hover:bg-ui-primary/60 text-white "
                                    }`}
                            >
                                {copiedToClipboard ? (
                                    <>
                                        <Check size={17} />
                                        Skopiowano do schowka!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={17} />
                                        Kopiuj listę do schowka
                                    </>
                                )}
                            </button>

                            {contractor.email && (
                                <a
                                    href={`mailto:${contractor.email}?subject=${encodeURIComponent(
                                        `Zamówienie - Piekarnia MWS (${new Date().toLocaleDateString("pl-PL")})`
                                    )}&body=${encodeURIComponent(generatedShoppingListText)}`}
                                    className="px-4 py-3 rounded-xl border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 shrink-0"
                                    title="Otwórz w programie pocztowym"
                                >
                                    <Mail size={15} />
                                    Wyślij e-mail
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* ========================================================= */}
            {/* MODAL EDYCJI WŁASNEJ NAZWY KONTRAHENTA                    */}
            {/* ========================================================= */}
            {isEditNameModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsEditNameModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-ui-accent p-6 space-y-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-ui-accent pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-ui-accent/20 text-ui-accent rounded-xl">
                                    <Edit3 size={18} />
                                </div>
                                <h3 className="text-base font-bold text-ui-black">
                                    Własna nazwa kontrahenta
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsEditNameModalOpen(false)}
                                className="p-1 hover:bg-ui-accent/20 rounded-full text-ui-secondary cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCustomName} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1">
                                    Nazwa wyświetlana w programie:
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={customNameInput}
                                    onChange={(e) => setCustomNameInput(e.target.value)}
                                    placeholder={contractor.name}
                                    className="w-full bg-ui-white border border-ui-accent rounded-xl px-3.5 py-2.5 text-sm font-bold text-ui-black focus:outline-none focus:border-ui-accent shadow-sm"
                                />
                                <p className="text-[11px] text-ui-secondary mt-1.5 leading-normal">
                                    Domyślnie taka sama jak nazwa z faktury. Własna nazwa ułatwi Ci szybką identyfikację dostawcy w całym programie.
                                </p>
                            </div>

                            <div className="bg-ui-accent/10 border border-ui-accent/40 rounded-xl p-3 text-xs">
                                <span className="font-bold text-ui-secondary text-[10px] uppercase tracking-wider block mb-0.5">
                                    Oryginalna nazwa z faktury:
                                </span>
                                <span className="font-medium text-ui-black">{contractor.name}</span>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCustomNameInput(contractor.name)}
                                    className="text-xs font-semibold text-ui-accent hover:underline cursor-pointer"
                                >
                                    Przywróć z faktury
                                </button>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditNameModalOpen(false)}
                                        className="px-3 py-2 rounded-xl border border-ui-accent text-ui-secondary hover:text-ui-black text-xs font-semibold cursor-pointer"
                                    >
                                        Anuluj
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingCustomName}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ui-accent hover:bg-ui-accent/80 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                        {isSavingCustomName ? (
                                            <>
                                                <Loader2 size={13} className="animate-spin" />
                                                Zapisywanie...
                                            </>
                                        ) : (
                                            "Zapisz nazwę"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
