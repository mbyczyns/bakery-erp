"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    CheckCircle2,
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
    RotateCcw,
    TrendingUp,
    BarChart3,
    CalendarDays,
    Pencil,
    X,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

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
    vatRate?: number;
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
    lastGrossPrice?: number;
    lastVatRate?: number;
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
    const [orderNotes, setOrderNotes] = useState<string>("");
    const [customShoppingListText, setCustomShoppingListText] = useState<string>("");

    // -------------------------------------------------------------
    // STAN EDYCJI WŁASNEJ NAZWY KONTRAHENTA
    // -------------------------------------------------------------
    const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
    const [customNameInput, setCustomNameInput] = useState("");
    const [isSavingCustomName, setIsSavingCustomName] = useState(false);

    // -------------------------------------------------------------
    // STAN EDYCJI WŁASNYCH UWAG / NOTATEK KONTRAHENTA
    // -------------------------------------------------------------
    const [isEditNotesModalOpen, setIsEditNotesModalOpen] = useState(false);
    const [notesInput, setNotesInput] = useState("");
    const [isSavingNotes, setIsSavingNotes] = useState(false);

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

    // Obsługa edycji własnych uwag / notatek kontrahenta
    const handleOpenEditNotesModal = () => {
        if (!data) return;
        setNotesInput(data.contractor.notes || "");
        setIsEditNotesModalOpen(true);
    };

    const handleSaveNotes = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!data) return;
        setIsSavingNotes(true);
        try {
            const cleanNotes = notesInput.trim();
            const res = await fetch(`/api/kontrahenci/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    notes: cleanNotes.length > 0 ? cleanNotes : null,
                }),
            });

            if (res.ok) {
                const updatedNotes = cleanNotes.length > 0 ? cleanNotes : null;
                setData((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        contractor: {
                            ...prev.contractor,
                            notes: updatedNotes,
                        },
                    };
                });
                setIsEditNotesModalOpen(false);
            } else {
                alert("Wystąpił błąd podczas zapisywania uwag.");
            }
        } catch (err) {
            console.error("Błąd aktualizacji uwag:", err);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSavingNotes(false);
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

    // Agregacja wydatków w poszczególnych miesiącach dla wykresu kolumnowego
    const monthlySpendingData = useMemo(() => {
        if (!data || !data.invoices || data.invoices.length === 0) return [];

        const monthNamesShort = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
        const monthNamesFull = [
            "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
            "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
        ];

        // Map: "YYYY-MM" -> { gross: number, net: number, count: number, year: number, monthIdx: number }
        const monthlyMap = new Map<string, { gross: number; net: number; count: number; year: number; monthIdx: number }>();

        data.invoices.forEach((inv) => {
            if (!inv.issuedDate) return;
            const dateParts = inv.issuedDate.split("-");
            if (dateParts.length < 2) return;
            const year = parseInt(dateParts[0], 10);
            const monthIdx = parseInt(dateParts[1], 10) - 1; // 0-11
            if (isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return;

            const key = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
            const gross = Number(inv.grossAmount || 0);
            const net = Number(inv.netAmount || 0);

            if (!monthlyMap.has(key)) {
                monthlyMap.set(key, { gross, net, count: 1, year, monthIdx });
            } else {
                const item = monthlyMap.get(key)!;
                item.gross += gross;
                item.net += net;
                item.count += 1;
            }
        });

        if (monthlyMap.size === 0) return [];

        // Sortowanie chronologiczne kluczy YYYY-MM
        const keys = Array.from(monthlyMap.keys()).sort();
        const firstKey = keys[0];
        const lastKey = keys[keys.length - 1];

        const [startYear, startMonth] = firstKey.split("-").map(Number);
        const [endYear, endMonth] = lastKey.split("-").map(Number);

        const result = [];
        let curYear = startYear;
        let curMonth = startMonth;

        while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
            const key = `${curYear}-${String(curMonth).padStart(2, "0")}`;
            const monthIdx = curMonth - 1;
            const entry = monthlyMap.get(key);
            const shortYear = String(curYear).slice(2);

            result.push({
                key,
                month: `${monthNamesShort[monthIdx]} ${shortYear}`,
                fullMonth: `${monthNamesFull[monthIdx]} ${curYear}`,
                gross: entry ? Math.round(entry.gross * 100) / 100 : 0,
                net: entry ? Math.round(entry.net * 100) / 100 : 0,
                count: entry ? entry.count : 0,
            });

            curMonth++;
            if (curMonth > 12) {
                curMonth = 1;
                curYear++;
            }
        }

        return result;
    }, [data]);

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

    // Automatyczna synchronizacja wygenerowanej treści z edytowalnym polem tekstowym
    useEffect(() => {
        setCustomShoppingListText(generatedShoppingListText);
    }, [generatedShoppingListText]);

    // Kopiowanie do schowka
    const handleCopyList = () => {
        if (!customShoppingListText) return;
        navigator.clipboard.writeText(customShoppingListText);
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-ui-white flex items-center justify-center pb-20">
                <div className="flex flex-col items-center gap-3 text-ui-secondary">
                    <Loader2 size={32} className="animate-spin text-ui-secondary" />
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
                <div className="flex flex-col lg:flex-row lg:items-stretch justify-between gap-6">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ui-black">
                                {contractor.customName || contractor.name}
                            </h1>
                            <button
                                onClick={handleOpenEditNameModal}
                                className="flex items-center gap-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Zmień własną nazwę kontrahenta"
                            >
                                <Edit3 size={13} className="text-amber-900" />
                                Zmień nazwę
                            </button>
                        </div>

                        {/* Informacja o oficjalnej nazwie z faktury */}
                        <div className="text-xs text-ui-secondary flex flex-wrap items-center gap-2 mt-3.5">
                            <span className="font-medium text-ui-black">Nazwa z faktury:</span>
                            <span className="text-ui-black font-medium">{contractor.name}</span>
                            {contractor.customName && contractor.customName !== contractor.name && (
                                <span className="text-[10px] font-bold bg-ui-white text-ui-accent border border-ui-accent px-1.5 py-0.2 rounded">
                                    Własna nazwa aktywna
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-3.5">
                            {contractor.nip && (
                                <span className="text-xs text-ui-black">
                                    NIP: {contractor.nip}
                                </span>
                            )}
                        </div>

                        {/* Dane kontaktowe w tagach */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3.5 text-xs text-ui-black">
                            {contractor.address && contractor.address !== 'Pobrano z KSeF' && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin size={14} className="text-ui-black shrink-0" />
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

                    {/* KAFELEK ŁĄCZNYCH WYDATKÓW W PRAWYM GÓRNYM ROGU */}
                    <div className="bg-ui-accent/10 border border-ui-accent/60 rounded-2xl p-5 text-left shrink-0 w-full lg:w-auto min-w-[260px] flex flex-col justify-between self-stretch">
                        <div className="flex items-center justify-between gap-2 text-ui-secondary">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Łączne wydatki</span>
                            <Coins size={18} className="text-ui-secondary" />
                        </div>
                        <div className="mt-4">
                            <div className="text-2xl sm:text-3xl font-black text-ui-primary">
                                {stats.totalGross.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} <span className="text-xs font-semibold text-ui-black">zł brutto</span>
                            </div>
                            <p className="text-xs text-ui-black mt-1">
                                <b className="text-ui-primary">{stats.totalNet.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</b> netto
                            </p>
                        </div>
                    </div>
                </div>

                {/* Notatka wewnętrzna / własne uwagi */}
                {contractor.notes ? (
                    <div className="mt-5 p-4 bg-ui-accent/10 border border-ui-accent/40 rounded-xl text-xs flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <span className="font-bold text-ui-secondary uppercase tracking-wider text-[10px] flex items-center gap-1.5 mb-1.5">
                                <FileText size={13} className="text-ui-secondary" />
                                Uwagi:
                            </span>
                            <p className="text-ui-black/90 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">{contractor.notes}</p>
                        </div>
                        <button
                            onClick={handleOpenEditNotesModal}
                            className="flex items-center gap-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Edytuj uwagi"
                        >
                            <Pencil size={12} />
                            Edytuj
                        </button>
                    </div>
                ) : (
                    <div className="mt-4">
                        <button
                            onClick={handleOpenEditNotesModal}
                            className="flex items-center gap-1 text-xs font-semibold border border-ui-accent hover:bg-ui-accent/30 text-ui-primary px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                            <FileText size={13} />
                            + Dodaj uwagi / notatki do kontrahenta
                        </button>
                    </div>
                )}
            </div>



            {/* ========================================================= */}
            {/* WYKRES KOLUMNOWY: WYDATKI MIESIĘCZNE U DOSTAWCY           */}
            {/* ========================================================= */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl p-5 shadow-sm mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                            <TrendingUp size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" /> Wydatki miesięczne
                        </h3>

                    </div>
                    {monthlySpendingData.length > 0 && (
                        <div className="text-xs font-semibold text-ui-primary bg-ui-accent/15 px-3 py-1.5 rounded-xl self-start sm:self-auto flex items-center gap-1.5">
                            <Calendar size={13} className="text-ui-secondary" />
                            <span>Okres:  {monthlySpendingData[0].month} – {monthlySpendingData[monthlySpendingData.length - 1].month}</span>
                        </div>
                    )}
                </div>

                {monthlySpendingData.length === 0 ? (
                    <div className="h-44 flex flex-col items-center justify-center text-ui-secondary text-xs gap-2 border border-dashed border-ui-accent/60 rounded-xl bg-ui-accent/5">
                        <CalendarDays size={26} className="opacity-40" />
                        <span className="font-semibold">Brak zarejestrowanych faktur dla tego dostawcy</span>
                    </div>
                ) : (
                    <div className="h-[260px] w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlySpendingData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#6B7280' }}
                                    dy={8}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#6B7280' }}
                                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)} tys. zł` : `${val} zł`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(229, 231, 235, 0.4)' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const item = payload[0]?.payload;
                                            return (
                                                <div className="bg-ui-white border border-ui-accent rounded-xl p-3.5 shadow-xl text-xs min-w-[190px]">
                                                    <div className="font-black text-ui-black border-b border-ui-accent/40 pb-1.5 mb-2 flex items-center justify-between">
                                                        <span>{item.fullMonth}</span>

                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between gap-3 text-[11px]">
                                                            <span className="text-ui-black">Wydatki brutto:</span>
                                                            <span className=" text-ui-black">
                                                                {item.gross.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-3 text-[11px]">
                                                            <span className="text-ui-black">Wydatki netto:</span>
                                                            <span className=" text-ui-black">
                                                                {item.net.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey="gross"
                                    name="Wydatki brutto"
                                    fill="#0c8ac9"
                                    radius={[5, 5, 0, 0]}
                                    maxBarSize={48}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* ZAKŁADKI: PRODUKTY / FAKTURY / GENERATOR LISTY ZAKUPÓW    */}
            {/* ========================================================= */}
            <div className="flex gap-1.5 sm:gap-2 border-b border-ui-accent pb-px mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab("PRODUCTS")}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "PRODUCTS"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <ShoppingBag size={15} />
                    <span>Produkty</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${activeTab === "PRODUCTS"
                        ? "bg-ui-secondary text-ui-white"
                        : "bg-ui-accent/25 text-ui-primary/70"
                        }`}>
                        {data.purchasedProducts.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab("INVOICES")}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "INVOICES"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <Receipt size={15} />
                    <span>Ostatnie faktury</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${activeTab === "INVOICES"
                        ? "bg-ui-secondary text-ui-white"
                        : "bg-ui-accent/25 text-ui-primary/70"
                        }`}>
                        {invoices.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab("SHOPPING_LIST")}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${activeTab === "SHOPPING_LIST"
                        ? "border-ui-secondary text-ui-secondary font-bold"
                        : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                        }`}
                >
                    <ShoppingCart size={15} />
                    <span>Lista zakupów</span>
                    {selectedCount > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${activeTab === "SHOPPING_LIST"
                            ? "bg-ui-secondary text-ui-white"
                            : "bg-ui-accent/25 text-ui-primary/70"
                            }`}>
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
                                        <th className="py-3 px-3 text-left">Ostatnia cena</th>
                                        <th className="py-3 px-3 text-left">Kupiona ilość</th>
                                        <th className="py-3 px-3 text-left">Wydano łącznie</th>
                                        <th className="py-3 px-3 text-left">Ostatni zakup</th>
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
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-ui-black text-sm">{prod.name}</span>
                                                        <span className="text-xs font-normal text-ui-secondary bg-ui-accent/30 px-2 py-0.5 rounded-md">
                                                            {prod.unit}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Ostatnia cena */}
                                                <td className="py-3 px-3 text-left">
                                                    {prod.lastPrice > 0 ? (
                                                        <div>
                                                            <div className="text-ui-black">{prod.lastPrice.toFixed(2)} zł netto</div>
                                                            <div className="text-ui-black">
                                                                {(prod.lastGrossPrice ?? (prod.lastPrice * (1 + (prod.lastVatRate ?? 23) / 100))).toFixed(2)} zł brutto

                                                            </div>
                                                        </div>
                                                    ) : "—"}
                                                </td>

                                                {/* Kupiona ilość */}
                                                <td className="py-3 px-3 text-left font-medium text-ui-black">
                                                    {prod.totalQuantity > 0 ? `${prod.totalQuantity.toLocaleString("pl-PL")} ${prod.unit}` : "—"}
                                                </td>

                                                {/* Wydano łącznie */}
                                                <td className="py-3 px-3 text-left text-ui-black">
                                                    {prod.totalSpent > 0 ? `${prod.totalSpent.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł` : "—"}
                                                </td>

                                                {/* Data ostatniego zakupu */}
                                                <td className="py-3 px-3 text-left text-ui-black  font-medium">
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
                                                <div className="p-2 bg-ui-accent/20 text-ui-secondary rounded-xl">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <div className="text-sm text-ui-black flex flex-wrap items-center gap-2">
                                                        <span>{inv.invoiceNumber}</span>
                                                    </div>
                                                    <div className="text-[11px] text-ui-black flex items-center gap-3 mt-0.5">
                                                        <span>{formatDate(inv.issuedDate)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-6">
                                                <div className="text-right">
                                                    <div className="text-sm text-ui-black">
                                                        {inv.netAmount.toFixed(2)} zł netto
                                                    </div>
                                                    <div className="text-sm text-ui-black">
                                                        {inv.grossAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł brutto
                                                    </div>
                                                    <div className="text-sm text-ui-black">
                                                        VAT: {inv.vatAmount.toFixed(2)} zł
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
                                                                <th className="py-2 px-3 text-right">Cena jednostkowa</th>
                                                                <th className="py-2 px-3 text-right">Wartość brutto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-ui-accent/40">
                                                            {inv.positions.map((pos) => (
                                                                <tr key={pos.id} className="hover:bg-ui-accent/5">
                                                                    <td className="py-2.5 px-3 text-ui-black">
                                                                        {pos.name}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right">
                                                                        {pos.quantity} {pos.unit}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right">
                                                                        <div className="text-ui-black">{pos.netPrice.toFixed(2)} zł <span className="text-ui-black">netto</span></div>
                                                                        <div className="text-ui-black">
                                                                            {(pos.quantity > 0 && pos.grossAmount > 0
                                                                                ? pos.grossAmount / pos.quantity
                                                                                : pos.netPrice * (1 + (pos.vatRate ?? 23) / 100)
                                                                            ).toFixed(2)} zł brutto
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right text-ui-black">
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
                                            <th className="py-2.5 px-3 text-left">Ostatnia cena</th>
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

                                            const grossPrice = prod.lastGrossPrice ?? (prod.lastPrice > 0 ? Number((prod.lastPrice * (1 + (prod.lastVatRate ?? 23) / 100)).toFixed(2)) : 0);
                                            const vatRate = prod.lastVatRate ?? 23;

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
                                                        <div className="text-ui-black text-sm">{prod.name}</div>
                                                    </td>

                                                    <td
                                                        className="py-2.5 px-3 text-left whitespace-nowrap cursor-pointer"
                                                        onClick={() => toggleProductSelection(prod.id, prod.unit)}
                                                    >
                                                        {prod.lastPrice > 0 ? (
                                                            <div>
                                                                <div className="text-ui-black">{prod.lastPrice.toFixed(2)} zł netto</div>
                                                                <div className="text-ui-black">
                                                                    {grossPrice.toFixed(2)} zł brutto
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-ui-secondary">—</span>
                                                        )}
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
                                                                    className="w-16 bg-ui-white border border-ui-accent rounded-lg px-2 py-1 text-center text-xs text-ui-black focus:outline-none focus:border-ui-primary shadow-sm"
                                                                />
                                                                <select
                                                                    value={itemState.unit === "l" ? "litry" : itemState.unit}
                                                                    onChange={(e) =>
                                                                        updateItemUnit(prod.id, e.target.value)
                                                                    }
                                                                >
                                                                    <option value="szt">szt</option>
                                                                    <option value="litry">litry</option>
                                                                    <option value="kg">kg</option>
                                                                    <option value="opak">opak</option>
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-normal text-ui-secondary bg-ui-accent/30 px-2 py-0.5 rounded-md">
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
                            <div className="flex items-center justify-between mb-3 gap-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-ui-primary tracking-wider">
                                        Treść zamówienia
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {customShoppingListText !== generatedShoppingListText && (
                                        <button
                                            type="button"
                                            onClick={() => setCustomShoppingListText(generatedShoppingListText)}
                                            title="Przywróć domyślnie wygenerowaną treść zamówienia"
                                            className="text-[11px] text-ui-secondary hover:text-ui-black flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                                        >
                                            <RotateCcw size={12} />
                                            Przywróć
                                        </button>
                                    )}
                                    <span className="text-xs font-bold bg-ui-accent/20 text-ui-primary px-2 py-0.5 rounded-full">
                                        {selectedCount} pozycji
                                    </span>
                                </div>
                            </div>

                            <div className="relative">
                                <textarea
                                    rows={14}
                                    value={customShoppingListText}
                                    onChange={(e) => setCustomShoppingListText(e.target.value)}
                                    placeholder="Wybierz produkty z listy po lewej lub wpisz treść zamówienia ręcznie..."
                                    className="w-full bg-ui-white border border-ui-accent/60 rounded-xl p-3.5 text-xs text-ui-black font-mono leading-relaxed focus:outline-none focus:border-ui-primary focus:ring-1 focus:ring-ui-primary/30 shadow-inner resize-y transition-all"
                                />
                            </div>
                            <p className="text-[11px] text-ui-secondary mt-1.5 leading-normal">
                                Możesz bezpośrednio w tym polu modyfikować treść, dopisywać własne produkty lub zmieniać treść wiadomości przed skopiowaniem.
                            </p>
                        </div>

                        {/* Przyciski akcji: Kopiuj / Wyślij */}
                        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5">
                            <button
                                onClick={handleCopyList}
                                disabled={!customShoppingListText.trim()}
                                className={`flex-1 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer ${copiedToClipboard
                                    ? "bg-ui-accent text-white"
                                    : "bg-ui-primary hover:bg-ui-primary/80 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    )}&body=${encodeURIComponent(customShoppingListText)}`}
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
            {/* ========================================================= */}
            {/* MODAL EDYCJI WŁASNYCH UWAG / NOTATEK KONTRAHENTA           */}
            {/* ========================================================= */}
            {isEditNotesModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsEditNotesModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-ui-accent p-6 space-y-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-ui-accent pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-ui-black">
                                        Uwagi i notatki
                                    </h3>
                                    <p className="text-[11px] text-ui-secondary font-medium truncate max-w-xs sm:max-w-sm">
                                        {contractor.displayName || contractor.customName || contractor.name}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditNotesModalOpen(false)}
                                className="p-1 hover:bg-ui-accent/20 rounded-full text-ui-secondary cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNotes} className="space-y-4">
                            <div>
                                <textarea
                                    rows={5}
                                    value={notesInput}
                                    onChange={(e) => setNotesInput(e.target.value)}
                                    placeholder="np. Warunki dostaw, dni przywozu towaru, rabaty, dane kierowcy, godziny kontaktu..."
                                    className="w-full bg-ui-white border border-ui-accent rounded-xl p-3.5 text-xs sm:text-sm text-ui-black focus:outline-none focus:border-ui-accent shadow-sm leading-relaxed"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-ui-accent/30">
                                {notesInput.trim().length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNotesInput("");
                                        }}
                                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                                    >
                                        Wyczyść treść
                                    </button>
                                ) : (
                                    <div />
                                )}

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditNotesModalOpen(false)}
                                        className="px-3.5 py-2 rounded-xl border border-ui-accent text-ui-secondary hover:text-ui-black text-xs font-semibold cursor-pointer"
                                    >
                                        Anuluj
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingNotes}
                                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {isSavingNotes ? (
                                            <>
                                                <Loader2 size={13} className="animate-spin" />
                                                Zapisywanie...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={16} />
                                                Zapisz  </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div >
            )
            }
        </div >
    );
}
