"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Download,
    Search,
    X,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    Check,
    Eye,
    ChevronDown,
    FileText,
    Plus,
    Trash2,
    Edit2
} from "lucide-react";

type InvoiceStatus = "WAITING" | "IMPORTED" | "REJECTED";

interface PositionItem {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    unit: string;
    netPrice: number;
    netAmount: number;
    vatRate: string;
    grossAmount: number;
    categoryId?: string;
    ingredientId?: string;
    multiplier?: number;
}

interface Document {
    id: string;
    type: string;
    docNumber: string;
    issueDate: string;
    netAmount: number;
    grossAmount: number;
    contractorId: string;
    contractorName: string;
    status: InvoiceStatus;
    notes?: string;
    positions: PositionItem[];
}

interface DictionaryCategory {
    id: string;
    name: string;
}

interface DictionaryIngredient {
    id: string;
    name: string;
    unit: string;
}

interface DictionaryContractor {
    id: string;
    name: string;
    nip: string;
}

// =========================================================================
// PODKOMPONENT: CategorySelect
// =========================================================================
interface CategorySelectProps {
    categories: DictionaryCategory[];
    value: string;
    onChange: (val: string) => void;
    primaryCatId?: string;
}

function CategorySelect({ categories, value, onChange, primaryCatId }: CategorySelectProps) {
    const [isOpen, setIsOpen] = useState(false);

    const orderedCategories = React.useMemo(() => {
        const primary = categories.find((c) => c.id === primaryCatId);
        const others = categories.filter((c) => c.id !== primaryCatId);

        return [
            ...(primary ? [primary] : []),
            ...others
        ];
    }, [categories, primaryCatId]);

    const selectedCategory = categories.find((c) => c.id === value);
    const isPrimary = value === primaryCatId;

    return (
        <div className={`relative w-full ${isOpen ? "z-50" : "z-10"}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border border-ui-accent bg-ui-white hover:bg-ui-accent/10 transition-all shadow-sm cursor-pointer text-xs ${isPrimary ? "text-ui-black" : "text-ui-primary"}`}
            >
                <span className="truncate">
                    {selectedCategory ? selectedCategory.name : "Wybierz kategorię"}
                </span>
                <ChevronDown size={14} className="shrink-0 ml-1 opacity-60" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-ui-white border border-ui-accent rounded-xl shadow-2xl z-50 p-1.5 flex flex-col gap-1 animate-fade-in">
                        {orderedCategories.map((cat) => {
                            const isSelected = cat.id === value;

                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(cat.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer hover:bg-ui-accent/15 text-ui-black ${isSelected ? "bg-ui-accent/10" : ""}`}
                                >
                                    <span className="truncate">{cat.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

// =========================================================================
// PODKOMPONENT: SearchableIngredientSelect (Wyszukiwarka surowca)
// =========================================================================
interface SearchableSelectProps {
    ingredients: DictionaryIngredient[];
    value?: string;
    placeholder: string;
    onChange: (ingredientId: string) => void;
    onAddNew?: (searchPhrase: string) => void;
}

function SearchableIngredientSelect({ ingredients, value, placeholder, onChange, onAddNew }: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selectedItem = ingredients.find((i) => i.id === value);
    const filtered = ingredients.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className={`relative w-full ${isOpen ? "z-50" : "z-10"}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-ui-accent bg-ui-white text-ui-black text-xs transition-all shadow-sm cursor-pointer hover:bg-ui-accent/10"
            >
                <span className="truncate">
                    {selectedItem ? `${selectedItem.name} (${selectedItem.unit})` : placeholder}
                </span>
                <ChevronDown size={14} className="shrink-0 ml-1 opacity-60" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-ui-white border border-ui-accent rounded-xl shadow-2xl z-50 p-2 max-h-60 flex flex-col gap-1.5 animate-fade-in">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 text-ui-secondary" size={13} />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Wyszukaj surowiec..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-ui-accent/10 rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                            />
                        </div>

                        <div className="overflow-y-auto divide-y divide-ui-accent/30 pr-1 flex-1 min-h-[40px]">
                            {filtered.length === 0 ? (
                                <div className="text-center py-3 text-ui-secondary text-[11px] italic">
                                    Brak wyników
                                </div>
                            ) : (
                                filtered.map((ing) => (
                                    <button
                                        key={ing.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(ing.id);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer hover:bg-ui-accent/15 text-ui-black ${value === ing.id ? "bg-ui-accent/10" : ""
                                            }`}
                                    >
                                        <span className="truncate">{ing.name}</span>
                                        <span className="text-[10px] text-ui-secondary font-mono ml-2">[{ing.unit}]</span>
                                    </button>
                                ))
                            )}
                        </div>

                        {onAddNew && (
                            <div className="border-t border-ui-accent/30 pt-1.5 mt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onAddNew(search);
                                    }}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-ui-primary bg-ui-accent/10 hover:bg-ui-accent/20 transition-colors cursor-pointer"
                                >
                                    <Plus size={14} /> Dodaj nowy surowiec
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// =========================================================================
// PODKOMPONENT: SearchableContractorSelect (Wyszukiwarka dostawcy)
// =========================================================================
interface SearchableContractorSelectProps {
    contractors: DictionaryContractor[];
    value?: string;
    onChange: (contractorId: string, contractorName: string) => void;
}

function SearchableContractorSelect({ contractors, value, onChange }: SearchableContractorSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selectedItem = contractors.find((c) => c.id === value);
    const filtered = contractors.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.nip && c.nip.includes(search))
    );

    return (
        <div className={`relative w-full ${isOpen ? "z-50" : "z-10"}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-ui-accent/10 border border-transparent hover:border-ui-primary rounded-xl px-4 py-2.5 text-sm font-bold text-ui-black focus:outline-none transition-all flex items-center justify-between text-left cursor-pointer h-[42px]"
            >
                <span className={`truncate ${!selectedItem ? "text-ui-secondary font-medium" : ""}`}>
                    {selectedItem ? selectedItem.name : "Wybierz dostawcę..."}
                </span>
                <ChevronDown size={16} className="shrink-0 ml-2 opacity-50" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-2 bg-ui-white border border-ui-accent rounded-xl shadow-2xl z-50 p-2 max-h-60 flex flex-col gap-2 animate-fade-in">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-ui-secondary" size={16} />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Wyszukaj po nazwie lub NIP..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-ui-accent/10 rounded-lg pl-9 pr-3 py-2 text-sm font-semibold focus:outline-none"
                            />
                        </div>

                        <div className="overflow-y-auto divide-y divide-ui-accent/30 pr-1 flex-1">
                            {filtered.length === 0 ? (
                                <div className="text-center py-4 text-ui-secondary text-xs italic">
                                    Brak dostawcy. Dodaj go w bazie kontrahentów.
                                </div>
                            ) : (
                                filtered.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(c.id, c.name);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex flex-col transition-colors cursor-pointer hover:bg-ui-accent/15 text-ui-black ${value === c.id ? "bg-ui-accent/10" : ""
                                            }`}
                                    >
                                        <span className="font-bold truncate">{c.name}</span>
                                        {c.nip && <span className="text-xs text-ui-secondary font-mono mt-0.5">NIP: {c.nip}</span>}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}


// =========================================================================
// STRONA GŁÓWNA: FakturyPage
// =========================================================================
export default function FakturyPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<InvoiceStatus>("WAITING");
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [verifyingDoc, setVerifyingDoc] = useState<Document | null>(null);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);

    const [categories, setCategories] = useState<DictionaryCategory[]>([]);
    const [ingredients, setIngredients] = useState<DictionaryIngredient[]>([]);
    const [contractors, setContractors] = useState<DictionaryContractor[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/faktury");
            if (res.ok) {
                const data = await res.json();
                setDocuments(data || []);
            }
        } catch (error) {
            console.error("Błąd podczas pobierania faktur:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDictionaries = async () => {
        try {
            const res = await fetch("/api/dictionaries");
            if (res.ok) {
                const data = await res.json();
                setCategories(data.categories || []);
                setIngredients(data.ingredients || []);
                setContractors(data.contractors || []);
            }
        } catch (error) {
            console.error("Błąd podczas pobierania słowników:", error);
        }
    };

    useEffect(() => {
        fetchInvoices();
        fetchDictionaries();
    }, []);

    const handleSyncKsef = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch("/api/faktury/sync-ksef", { method: "POST" });
            const data = await res.json();

            if (res.ok) {
                alert(`Sukces! ${data.message}`);
                await fetchInvoices();
            } else {
                alert(`Błąd synchronizacji: ${data.error || data.details}`);
            }
        } catch (error) {
            console.error("Błąd KSeF API:", error);
            alert("Nie udało się połączyć z serwerem KSeF.");
        } finally {
            setIsSyncing(false);
        }
    };

    const loadInvoiceDetails = async (doc: Document, targetModal: "VERIFY" | "VIEW") => {
        setLoadingDocId(doc.id);
        try {
            const res = await fetch(`/api/faktury/${doc.id}/details`);
            if (res.ok) {
                const data = await res.json();
                const invData = data.invoice;

                const fullDoc: Document = {
                    ...doc,
                    positions: (invData.positions || []).map((pos: any) => ({
                        id: pos.id,
                        productId: pos.productId,
                        name: pos.name,
                        quantity: Number(pos.quantity || 0),
                        unit: pos.unit || "szt",
                        netPrice: Number(pos.netPrice || 0),
                        netAmount: Number(pos.netAmount || 0),
                        vatRate: String(pos.vatRate || "23"),
                        grossAmount: Number(pos.grossAmount || 0),
                        categoryId: pos.product?.categoryId || undefined,
                        ingredientId: pos.product?.ingredientId || undefined,
                        multiplier: pos.product?.multiplier ? Number(pos.product.multiplier) : undefined,
                    })),
                };

                if (targetModal === "VERIFY") {
                    setVerifyingDoc(fullDoc);
                } else {
                    setSelectedDoc(fullDoc);
                }
            } else {
                const err = await res.json();
                alert(`Błąd pobierania pozycji: ${err.error || err.details}`);
            }
        } catch (error) {
            console.error("Błąd pobierania szczegółów faktury:", error);
            alert("Nie udało się pobrać pozycji faktury.");
        } finally {
            setLoadingDocId(null);
        }
    };

    const waitingCount = documents.filter((d) => d.status === "WAITING").length;
    const importedCount = documents.filter((d) => d.status === "IMPORTED").length;
    const rejectedCount = documents.filter((d) => d.status === "REJECTED").length;

    const filteredDocs = documents
        .filter((doc) => doc.status === activeTab)
        .filter(
            (doc) =>
                (doc.docNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (doc.contractorName || "").toLowerCase().includes(searchTerm.toLowerCase())
        );

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Faktury i Dokumenty Kosztowe
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsManualModalOpen(true)}
                        className="flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm cursor-pointer"
                    >
                        <Plus size={18} />
                        Dodaj ręcznie
                    </button>
                    <button
                        onClick={handleSyncKsef}
                        disabled={isSyncing}
                        className="flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
                    >
                        {isSyncing ? (
                            <>
                                <Loader2 size={18} className="animate-spin text-ui-secondary" />
                                Pobieram z KSeF...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Pobierz z KSeF
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap border-b border-ui-accent mb-6 gap-2">
                <button
                    onClick={() => setActiveTab("WAITING")}
                    className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "WAITING"
                        ? "border-amber-500 text-amber-700 bg-amber-50/50 rounded-t-xl"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    <Clock size={16} />
                    Do weryfikacji
                    {waitingCount > 0 && (
                        <span className="bg-amber-200 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold">
                            {waitingCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab("IMPORTED")}
                    className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "IMPORTED"
                        ? "border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    <CheckCircle2 size={16} />
                    Zaakceptowane
                    <span className="bg-ui-accent/30 text-ui-primary text-xs px-2 py-0.5 rounded-full font-bold">
                        {importedCount}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab("REJECTED")}
                    className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "REJECTED"
                        ? "border-rose-500 text-rose-700 bg-rose-50/50 rounded-t-xl"
                        : "border-transparent text-ui-secondary hover:text-ui-primary"
                        }`}
                >
                    <XCircle size={16} />
                    Odrzucone
                    <span className="bg-ui-accent/30 text-ui-primary text-xs px-2 py-0.5 rounded-full font-bold">
                        {rejectedCount}
                    </span>
                </button>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder="Wyszukaj po numerze faktury lub nazwie dostawcy..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary transition-all text-sm"
                />
            </div>

            <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                                <th className="p-4 text-left">Numer Faktury</th>
                                <th className="p-1">Dostawca</th>
                                <th className="p-4 max-w-[80px] leading-tight text-left">Wystawiono</th>
                                <th className="p-4 text-left">Kwota Brutto</th>
                                <th className="p-4 text-center">Akcja</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ui-accent/40">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-ui-secondary text-sm">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={20} className="animate-spin" />
                                            Ładowanie listy faktur z bazy danych...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredDocs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-ui-secondary italic text-sm">
                                        Brak faktur w wybranej zakładce.
                                    </td>
                                </tr>
                            ) : (
                                filteredDocs.map((doc) => {
                                    const isThisLoading = loadingDocId === doc.id;

                                    return (
                                        <tr key={doc.id} className="hover:bg-ui-accent/5 transition-colors">
                                            <td className="p-4 font-semibold text-ui-black text-sm text-left">
                                                <div className="flex items-center gap-2">
                                                    {doc.docNumber}
                                                    {doc.type === "MANUAL" && (
                                                        <span className="text-[9px] bg-ui-accent/20 text-ui-secondary border border-ui-accent/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                            Ręczna
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-1 text-ui-primary font-medium text-sm max-w-xs truncate text-left">{doc.contractorName}</td>
                                            <td className="p-4 text-ui-primary text-sm font-medium text-left">{doc.issueDate}</td>
                                            <td className="p-4 text-left font-bold text-ui-black text-sm">{Number(doc.grossAmount || 0).toFixed(2)} zł</td>
                                            <td className="p-4 text-center">
                                                {doc.status === "WAITING" ? (
                                                    <button
                                                        onClick={() => loadInvoiceDetails(doc, "VERIFY")}
                                                        disabled={isThisLoading}
                                                        className="bg-ui-primary hover:bg-ui-primary/80 text-white text-xs px-3.5 py-2 rounded-lg font-semibold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto disabled:opacity-60"
                                                    >
                                                        {isThisLoading ? (
                                                            <>
                                                                <Loader2 size={14} className="animate-spin" />
                                                                Pobieram...
                                                            </>
                                                        ) : (
                                                            "Weryfikuj"
                                                        )}
                                                    </button>
                                                ) : doc.status === "IMPORTED" ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => loadInvoiceDetails(doc, "VIEW")}
                                                            disabled={isThisLoading}
                                                            className="border border-ui-accent hover:bg-ui-accent/20 text-ui-primary text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
                                                            title="Podgląd"
                                                        >
                                                            {isThisLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                                                        </button>
                                                        <button
                                                            onClick={() => loadInvoiceDetails(doc, "VERIFY")}
                                                            disabled={isThisLoading}
                                                            className="border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
                                                            title="Edytuj mapowanie"
                                                        >
                                                            {isThisLoading ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => loadInvoiceDetails(doc, "VIEW")}
                                                        disabled={isThisLoading}
                                                        className="border border-ui-accent hover:bg-ui-accent/20 text-ui-primary text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto disabled:opacity-60"
                                                    >
                                                        {isThisLoading ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Eye size={14} />
                                                                Podgląd
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {verifyingDoc && (
                <VerificationModal
                    doc={verifyingDoc}
                    categories={categories}
                    ingredients={ingredients}
                    onClose={() => setVerifyingDoc(null)}
                    onSuccess={async () => {
                        setVerifyingDoc(null);
                        await fetchInvoices();
                    }}
                    onRefreshDictionaries={fetchDictionaries}
                />
            )}

            {isManualModalOpen && (
                <ManualInvoiceModal
                    categories={categories}
                    ingredients={ingredients}
                    contractors={contractors}
                    onClose={() => setIsManualModalOpen(false)}
                    onSuccess={async () => {
                        setIsManualModalOpen(false);
                        await fetchInvoices();
                    }}
                    onRefreshDictionaries={fetchDictionaries}
                />
            )}

            {selectedDoc && (
                <div
                    className="fixed inset-0 z-[100] overflow-y-auto flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedDoc(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-3xl rounded-2xl shadow-xl border border-ui-accent flex flex-col my-8 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-b border-ui-accent p-5 flex items-start justify-between bg-ui-white rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-ui-primary">{selectedDoc.docNumber}</h2>
                                <p className="text-xs text-ui-secondary mt-1">{selectedDoc.contractorName}</p>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} className="p-2 bg-ui-accent/20 hover:bg-ui-accent/40 text-ui-primary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 text-sm flex-1 bg-ui-white rounded-b-2xl">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-ui-accent/10 p-4 rounded-xl border border-ui-accent/40">
                                <div>
                                    <span className="text-xs text-ui-secondary font-bold block">Data wystawienia:</span>
                                    <span className="text-ui-primary">{selectedDoc.issueDate}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-ui-secondary font-bold block">Wartość Netto:</span>
                                    <span className="text-ui-primary">{Number(selectedDoc.netAmount || 0).toFixed(2)} zł</span>
                                </div>
                                <div>
                                    <span className="text-xs text-ui-secondary font-bold block">Wartość Brutto:</span>
                                    <span className="font-bold text-ui-primary">{Number(selectedDoc.grossAmount || 0).toFixed(2)} zł</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary mb-3">
                                    Pozycje na fakturze ({selectedDoc.positions?.length || 0})
                                </h3>
                                <div className="border border-ui-accent rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="bg-ui-accent/20 text-ui-secondary font-bold uppercase border-b border-ui-accent">
                                                <th className="p-3 text-left">Nazwa artykułu</th>
                                                <th className="p-3 text-center whitespace-nowrap w-auto">Ilość</th>
                                                <th className="p-3 text-right">Cena Netto</th>
                                                <th className="p-3 text-right">Wartość Brutto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-ui-accent/40">
                                            {selectedDoc.positions?.map((pos) => (
                                                <tr key={pos.id} className="hover:bg-ui-accent/5">
                                                    <td className="p-3 font-semibold text-ui-black text-left">{pos.name}</td>
                                                    <td className="p-3 text-center font-bold text-ui-primary whitespace-nowrap">
                                                        {pos.quantity} {pos.unit}
                                                    </td>
                                                    <td className="p-3 text-right text-ui-primary/80">{Number(pos.netPrice || 0).toFixed(2)} zł</td>
                                                    <td className="p-3 text-right font-bold text-ui-black">{Number(pos.grossAmount || 0).toFixed(2)} zł</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =========================================================================
// PODKOMPONENT: VerificationModal
// =========================================================================
interface VerificationModalProps {
    doc: Document;
    categories: DictionaryCategory[];
    ingredients: DictionaryIngredient[];
    onClose: () => void;
    onSuccess: () => void;
    onRefreshDictionaries: () => void;
}

function VerificationModal({ doc, categories, ingredients, onClose, onSuccess, onRefreshDictionaries }: VerificationModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    const [newIngredientConfig, setNewIngredientConfig] = useState<{
        isOpen: boolean;
        targetProductId: string | null;
        initialName: string;
    }>({ isOpen: false, targetProductId: null, initialName: "" });

    const foodCategory = categories.find((c) => c.name.toLowerCase() === "produkty spożywcze");
    const defaultCategoryId = foodCategory?.id || categories[0]?.id || "";

    const [mappingState, setMappingState] = useState<
        Record<string, { categoryId: string; ingredientId?: string; multiplier: string }>
    >(() => {
        const initialState: Record<string, { categoryId: string; ingredientId?: string; multiplier: string }> = {};
        (doc.positions || []).forEach((pos) => {
            initialState[pos.productId] = {
                categoryId: pos.categoryId || defaultCategoryId,
                ingredientId: pos.ingredientId || undefined,
                multiplier: pos.multiplier ? String(pos.multiplier) : "1",
            };
        });
        return initialState;
    });

    const handleCategoryChange = (productId: string, categoryId: string) => {
        setMappingState((prev) => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                categoryId,
                ingredientId: categoryId === foodCategory?.id
                    ? prev[productId]?.ingredientId
                    : undefined,
                multiplier: "1",
            },
        }));
    };

    const handleIngredientChange = (productId: string, ingredientId: string) => {
        setMappingState((prev) => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                ingredientId: ingredientId || undefined,
                multiplier: "1",
            },
        }));
    };

    const handleMultiplierChange = (productId: string, value: string) => {
        const filteredValue = value.replace(/[^0-9.,]/g, '');
        setMappingState((prev) => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                multiplier: filteredValue,
            },
        }));
    };

    const handleApprove = async () => {
        const missingMappings = doc.positions.some(pos => {
            const mapping = mappingState[pos.productId];
            if (!mapping) return true;
            const isFoodCategory = mapping.categoryId === foodCategory?.id;
            return isFoodCategory && !mapping.ingredientId;
        });

        if (missingMappings) {
            alert("Uwaga!\nNie przypisano surowca do wszystkich pozycji spożywczych.");
            return;
        }

        setIsSubmitting(true);
        try {
            const itemsMapping = Object.entries(mappingState).map(([productId, val]) => {
                const parsedMultiplier = parseFloat(val.multiplier.replace(',', '.')) || 1;
                return {
                    productId,
                    categoryId: val.categoryId,
                    ingredientId: val.ingredientId || null,
                    multiplier: parsedMultiplier,
                };
            });

            const res = await fetch(`/api/faktury/${doc.id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemsMapping }),
            });

            if (res.ok) {
                alert("Zmiany zostały pomyślnie zapisane!");
                onSuccess();
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error || err.details}`);
            }
        } catch (error) {
            console.error("Błąd podczas akceptacji:", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!confirm("Czy na pewno chcesz odrzucić tę fakturę?")) return;

        setIsRejecting(true);
        try {
            const res = await fetch(`/api/faktury/${doc.id}/reject`, { method: "POST" });
            if (res.ok) {
                alert("Faktura została odrzucona.");
                onSuccess();
            } else {
                alert("Nie udało się odrzucić faktury.");
            }
        } catch (error) {
            console.error("Błąd odrzucania:", error);
        } finally {
            setIsRejecting(false);
        }
    };

    const handleCreateIngredient = async (name: string, unit: string, type: string) => {
        try {
            const res = await fetch("/api/skladniki", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, unit, type })
            });

            if (res.ok) {
                const newIngredient = await res.json();
                onRefreshDictionaries();

                if (newIngredientConfig.targetProductId) {
                    handleIngredientChange(newIngredientConfig.targetProductId, newIngredient.id);
                }

                setNewIngredientConfig({ isOpen: false, targetProductId: null, initialName: "" });
            } else {
                alert("Wystąpił błąd podczas zapisywania nowego surowca.");
            }
        } catch (err) {
            console.error("Błąd tworzenia surowca:", err);
            alert("Błąd połączenia z serwerem przy tworzeniu surowca.");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-ui-white w-full max-w-5xl rounded-2xl shadow-2xl border border-ui-accent flex flex-col my-8 relative">

                <div className="px-6 py-6 border-b border-ui-accent flex flex-col sm:flex-row items-start sm:items-center justify-between bg-ui-white rounded-t-2xl gap-4">
                    <div className="flex items-start gap-4">
                        <div className="bg-ui-accent/20 p-3 rounded-2xl text-ui-primary hidden sm:block mt-1">
                            <FileText size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-ui-black tracking-tight flex items-center gap-2">
                                {doc.contractorName}
                                {doc.status === "IMPORTED" && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md uppercase tracking-wider">Edycja</span>
                                )}
                            </h2>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-sm font text-ui-primary">
                                    KSeF: {doc.docNumber}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-ui-secondary uppercase tracking-wider">
                                Do zapłaty (Brutto)
                            </div>
                            <div className="text-3xl font-black text-ui-black mt-0.5">{Number(doc.grossAmount || 0).toFixed(2)} zł</div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer self-start sm:self-center">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4 flex-1">
                    <div className="border border-ui-accent rounded-xl shadow-sm overflow-visible">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase border-b border-ui-accent">
                                    <th className="p-3.5 w-1/3 text-left">Nazwa</th>
                                    <th className="p-3.5 text-center whitespace-nowrap w-auto">Ilość</th>
                                    <th className="p-3.5 w-[30%] text-left">Kategoria</th>
                                    <th className="p-3.5 w-[35%] text-left">Surowiec</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/40">
                                {(doc.positions || []).map((pos) => {
                                    const currentMapping = mappingState[pos.productId] || { categoryId: defaultCategoryId, multiplier: "1" };
                                    const isFoodCategory = currentMapping.categoryId === foodCategory?.id;

                                    const selectedIngredient = ingredients.find(i => i.id === currentMapping.ingredientId);
                                    const needsMultiplier = selectedIngredient && selectedIngredient.unit !== pos.unit;

                                    return (
                                        <tr key={pos.id} className="hover:bg-ui-accent/5 transition-colors">
                                            <td className="p-3.5 text-left">
                                                <div className="font-bold text-ui-black text-sm">{pos.name}</div>
                                            </td>

                                            <td className="p-3.5 text-center whitespace-nowrap align-center">
                                                <div className=" text-ui-primary text-sm">{pos.quantity} {pos.unit}</div>
                                            </td>

                                            <td className="p-3.5 align-center text-left">
                                                <CategorySelect
                                                    categories={categories}
                                                    value={currentMapping.categoryId}
                                                    primaryCatId={foodCategory?.id}
                                                    onChange={(newCatId) => handleCategoryChange(pos.productId, newCatId)}
                                                />
                                            </td>

                                            <td className="p-3.5 align-center text-left">
                                                {(() => {
                                                    let SelectorComponent = null;

                                                    if (isFoodCategory) {
                                                        SelectorComponent = (
                                                            <SearchableIngredientSelect
                                                                ingredients={ingredients}
                                                                value={currentMapping.ingredientId}
                                                                placeholder="-- Wyszukaj surowiec --"
                                                                onChange={(id) => handleIngredientChange(pos.productId, id)}
                                                                onAddNew={(phrase) => setNewIngredientConfig({
                                                                    isOpen: true,
                                                                    targetProductId: pos.productId,
                                                                    initialName: phrase || pos.name
                                                                })}
                                                            />
                                                        );
                                                    } else {
                                                        SelectorComponent = (
                                                            <div className="text-[11px] text-black px-3 py-2 bg-white border shadow-sm border-ui-accent rounded-xl block text-center font-medium animate-fade-in">
                                                                -
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="flex flex-col gap-2">
                                                            {SelectorComponent}

                                                            {needsMultiplier && (
                                                                <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200 p-2 rounded-xl animate-fade-in">
                                                                    <span className="text-[10px] font-bold text-black leading-tight">
                                                                        1 {pos.unit} =
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <input
                                                                            type="text"
                                                                            value={currentMapping.multiplier}
                                                                            onChange={(e) => handleMultiplierChange(pos.productId, e.target.value)}
                                                                            className="w-16 bg-ui-white border border-blue-300 rounded-lg px-2 py-1 text-center text-xs font-bold text-blue-950 focus:outline-none focus:border-blue-500 transition-colors"
                                                                        />
                                                                        <span className="text-[10px] font-bold text-black">{selectedIngredient.unit}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-ui-accent flex flex-col sm:flex-row justify-between items-center gap-3 bg-ui-white rounded-b-2xl">
                    {doc.status === "WAITING" ? (
                        <button
                            type="button"
                            onClick={handleReject}
                            disabled={isRejecting || isSubmitting}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                            <XCircle size={16} />
                            Odrzuć fakturę
                        </button>
                    ) : (
                        <div></div>
                    )}

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold hover:bg-ui-accent/20 transition-colors text-xs cursor-pointer"
                        >
                            Anuluj
                        </button>
                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={isSubmitting || isRejecting}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            {doc.status === "IMPORTED" ? "Zapisz poprawki" : "Zatwierdź"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-modal: Dodawanie nowego surowca */}
            {newIngredientConfig.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-ui-white w-full max-w-sm rounded-2xl shadow-2xl border border-ui-accent p-6">
                        <h3 className="text-lg font-bold text-ui-black mb-4">Dodaj nowy surowiec</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary mb-1">Nazwa w systemie</label>
                                <input
                                    type="text"
                                    value={newIngredientConfig.initialName}
                                    onChange={(e) => setNewIngredientConfig(prev => ({ ...prev, initialName: e.target.value }))}
                                    className="w-full bg-ui-accent/10 rounded-lg px-3 py-2 text-sm font-semibold border border-transparent focus:border-ui-primary focus:outline-none transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary mb-1">Typ</label>
                                    <div className="relative">
                                        <select
                                            defaultValue="OTHER"
                                            id="manual-new-ing-type"
                                            className="w-full bg-ui-accent/10 rounded-lg px-3 py-2 text-sm font-semibold border border-transparent focus:border-ui-primary focus:outline-none transition-all appearance-none"
                                        >
                                            <option value="FLOUR">Mąka</option>
                                            <option value="FRUIT">Owoce / Warzywa</option>
                                            <option value="DAIRY">Nabiał</option>
                                            <option value="OTHER">Inne</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary mb-1">Jednostka</label>
                                    <div className="relative">
                                        <select
                                            defaultValue="kg"
                                            id="manual-new-ing-unit"
                                            className="w-full bg-ui-accent/10 rounded-lg px-3 py-2 text-sm font-semibold border border-transparent focus:border-ui-primary focus:outline-none transition-all appearance-none"
                                        >
                                            <option value="kg">kg (kilogramy)</option>
                                            <option value="l">l (litr)</option>
                                            <option value="szt">szt (sztuka)</option>
                                            <option value="opak">opak (opakowanie)</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => setNewIngredientConfig({ ...newIngredientConfig, isOpen: false })}
                                className="flex-1 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold hover:bg-ui-accent/20 text-xs transition-colors cursor-pointer"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={() => {
                                    const unitSelect = document.getElementById("manual-new-ing-unit") as HTMLSelectElement;
                                    const typeSelect = document.getElementById("manual-new-ing-type") as HTMLSelectElement;
                                    handleCreateIngredient(newIngredientConfig.initialName, unitSelect.value, typeSelect.value);
                                }}
                                className="flex-1 py-2 rounded-xl bg-ui-primary text-white font-bold hover:bg-ui-primary/90 text-xs transition-colors shadow-sm cursor-pointer"
                            >
                                Zapisz i Wybierz
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =========================================================================
// NOWY PODKOMPONENT: ManualInvoiceModal
// =========================================================================
interface ManualInvoiceModalProps {
    categories: DictionaryCategory[];
    ingredients: DictionaryIngredient[];
    contractors: DictionaryContractor[];
    onClose: () => void;
    onSuccess: () => void;
    onRefreshDictionaries: () => void;
}

function ManualInvoiceModal({ categories, ingredients, contractors, onClose, onSuccess, onRefreshDictionaries }: ManualInvoiceModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [header, setHeader] = useState({
        docNumber: "",
        contractorId: "",
        contractorName: "",
        issueDate: new Date().toISOString().split("T")[0],
    });

    const foodCategory = categories.find((c) => c.name.toLowerCase() === "produkty spożywcze");
    const defaultCategoryId = foodCategory?.id || categories[0]?.id || "";

    interface ManualRow {
        id: string; // Tmp ID
        name: string;
        quantity: string;
        unit: string;
        netPrice: string;
        categoryId: string;
        ingredientId?: string;
        multiplier: string;
        vatRate: string;
    }

    const [rows, setRows] = useState<ManualRow[]>([
        {
            id: Date.now().toString(),
            name: "",
            quantity: "1",
            unit: "szt",
            netPrice: "0.00",
            categoryId: defaultCategoryId,
            multiplier: "1",
            vatRate: "23"
        }
    ]);

    const [newIngredientConfig, setNewIngredientConfig] = useState<{
        isOpen: boolean;
        targetRowId: string | null;
        initialName: string;
    }>({ isOpen: false, targetRowId: null, initialName: "" });

    const addRow = () => {
        setRows([...rows, {
            id: Date.now().toString() + Math.random().toString(),
            name: "",
            quantity: "1",
            unit: "szt",
            netPrice: "0.00",
            categoryId: defaultCategoryId,
            multiplier: "1",
            vatRate: "23"
        }]);
    };

    const removeRow = (id: string) => {
        setRows(rows.filter(r => r.id !== id));
    };

    const updateRow = (id: string, field: keyof ManualRow, value: any) => {
        setRows(rows.map(r => {
            if (r.id !== id) return r;
            const updated = { ...r, [field]: value };

            if (field === "categoryId") {
                updated.multiplier = "1";
                if (value !== foodCategory?.id) {
                    updated.ingredientId = undefined;
                }
            }
            if (field === "ingredientId") {
                updated.multiplier = "1";
            }
            return updated;
        }));
    };

    const totalNet = rows.reduce((acc, row) => acc + ((parseFloat(row.quantity) || 0) * (parseFloat(row.netPrice) || 0)), 0);
    const totalGross = rows.reduce((acc, row) => {
        const q = parseFloat(row.quantity) || 0;
        const n = parseFloat(row.netPrice) || 0;
        const vat = parseFloat(row.vatRate) || 23;
        return acc + (q * n * (1 + (vat / 100)));
    }, 0);

    const handleSave = async () => {
        if (!header.docNumber || !header.contractorId) {
            alert("Wprowadź numer dokumentu i wybierz dostawcę z listy.");
            return;
        }
        if (rows.length === 0) {
            alert("Dodaj co najmniej jedną pozycję na dokumencie.");
            return;
        }

        const missingMappings = rows.some(row => {
            if (!row.name || parseFloat(row.quantity) <= 0 || parseFloat(row.netPrice) < 0) return true;
            const isFoodCategory = row.categoryId === foodCategory?.id;
            return isFoodCategory && !row.ingredientId;
        });

        if (missingMappings) {
            alert("Uzupełnij wszystkie dane pozycji (nazwa, ilość > 0) i przypisz surowiec tam, gdzie kategoria tego wymaga.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                header: {
                    docNumber: header.docNumber,
                    contractorId: header.contractorId, // Serwer otrzyma czyste ID kontrahenta
                    issueDate: header.issueDate
                },
                positions: rows.map(r => ({
                    name: r.name,
                    quantity: parseFloat(r.quantity.replace(',', '.')) || 1,
                    unit: r.unit,
                    netPrice: parseFloat(r.netPrice.replace(',', '.')) || 0,
                    vatRate: parseFloat(r.vatRate) || 23,
                    categoryId: r.categoryId,
                    ingredientId: r.ingredientId || null,
                    multiplier: parseFloat(r.multiplier.replace(',', '.')) || 1
                }))
            };

            const res = await fetch(`/api/faktury/manual`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                alert("Dokument został utworzony i pomyślnie zmapowany!");
                onSuccess();
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error || err.details}`);
            }
        } catch (error) {
            console.error("Błąd podczas zapisywania:", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateIngredient = async (name: string, unit: string, type: string) => {
        try {
            const res = await fetch("/api/skladniki", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, unit, type })
            });

            if (res.ok) {
                const newIngredient = await res.json();
                onRefreshDictionaries();

                if (newIngredientConfig.targetRowId) {
                    updateRow(newIngredientConfig.targetRowId, "ingredientId", newIngredient.id);
                }

                setNewIngredientConfig({ isOpen: false, targetRowId: null, initialName: "" });
            } else {
                alert("Wystąpił błąd podczas zapisywania nowego surowca.");
            }
        } catch (err) {
            alert("Błąd połączenia z serwerem przy tworzeniu surowca.");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-ui-white w-full max-w-6xl rounded-2xl shadow-2xl border border-ui-accent flex flex-col my-8 relative">

                <div className="px-6 py-6 border-b border-ui-accent bg-ui-white rounded-t-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-ui-accent/20 p-2.5 rounded-xl text-ui-primary">
                                <Plus size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-ui-black">Ręczne dodanie dokumentu</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-ui-secondary uppercase tracking-wider mb-1">Dostawca / Sklep</label>
                            <SearchableContractorSelect
                                contractors={contractors}
                                value={header.contractorId}
                                onChange={(id, name) => setHeader({ ...header, contractorId: id, contractorName: name })}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-ui-secondary uppercase tracking-wider mb-1">Numer dokumentu</label>
                            <input
                                type="text"
                                placeholder="..."
                                value={header.docNumber}
                                onChange={(e) => setHeader({ ...header, docNumber: e.target.value })}
                                className="w-full bg-ui-accent/10 border border-transparent focus:border-ui-primary rounded-xl px-4 py-2.5 text-sm text-ui-black focus:outline-none transition-all h-[42px]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-ui-secondary uppercase tracking-wider mb-1">Data Wystawienia</label>
                            <input
                                type="date"
                                value={header.issueDate}
                                onChange={(e) => setHeader({ ...header, issueDate: e.target.value })}
                                className="w-full bg-ui-accent/10 border border-transparent focus:border-ui-primary rounded-xl px-4 py-2.5 text-sm text-ui-black focus:outline-none transition-all h-[42px]"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4 flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Pozycje Kosztowe</h3>
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-ui-secondary uppercase mr-3">Wartość całkowita:</span>
                            <span className="text-lg font-black text-ui-black">{totalGross.toFixed(2)} zł</span>
                        </div>
                    </div>

                    <div className="border border-ui-accent rounded-xl shadow-sm overflow-visible">
                        <table className="w-full text-left text-xs border-collapse sm:min-w-[800px]">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary font-bold uppercase border-b border-ui-accent">
                                    <th className="p-3.5 w-1/4 text-left">Nazwa artykułu</th>
                                    <th className="p-3.5 text-center w-20">Ilość</th>
                                    <th className="p-3.5 text-center w-20">Jedn.</th>
                                    <th className="p-3.5 text-center w-24">Cena Netto</th>
                                    <th className="p-3.5 text-center w-16">VAT %</th>
                                    <th className="p-3.5 w-[22%] text-left">Kategoria</th>
                                    <th className="p-3.5 w-[25%] text-left">Surowiec</th>
                                    <th className="p-3.5 text-center w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/40">
                                {rows.map((row) => {
                                    const isFoodCategory = row.categoryId === foodCategory?.id;

                                    const selectedIngredient = ingredients.find(i => i.id === row.ingredientId);
                                    const needsMultiplier = selectedIngredient && selectedIngredient.unit !== row.unit;

                                    return (
                                        <tr key={row.id} className="hover:bg-ui-accent/5 transition-colors">
                                            <td className="p-2 align-top">
                                                <input
                                                    type="text"
                                                    placeholder="Nazwa..."
                                                    value={row.name}
                                                    onChange={e => updateRow(row.id, "name", e.target.value)}
                                                    className="w-full px-2.5 py-2 border border-ui-accent rounded-lg focus:border-ui-primary focus:outline-none bg-ui-white text-ui-black font-semibold"
                                                />
                                            </td>

                                            <td className="p-2 align-top">
                                                <input
                                                    type="text"
                                                    value={row.quantity}
                                                    onChange={e => updateRow(row.id, "quantity", e.target.value.replace(/[^0-9.,]/g, ''))}
                                                    className="w-full px-2 py-2 border border-ui-accent rounded-lg focus:border-ui-primary focus:outline-none text-center bg-ui-white text-ui-black "
                                                />
                                            </td>

                                            <td className="p-2 align-top">
                                                <input
                                                    type="text"
                                                    value={row.unit}
                                                    onChange={e => updateRow(row.id, "unit", e.target.value)}
                                                    className="w-full px-2 py-2 border border-ui-accent rounded-lg focus:border-ui-primary focus:outline-none text-center bg-ui-white text-ui-black"
                                                />
                                            </td>

                                            <td className="p-2 align-top">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={row.netPrice}
                                                        onChange={e => updateRow(row.id, "netPrice", e.target.value.replace(/[^0-9.,]/g, ''))}
                                                        className="w-full pl-2 pr-6 py-2 border border-ui-accent rounded-lg focus:border-ui-primary focus:outline-none text-right bg-ui-white text-ui-black "
                                                    />
                                                    <span className="absolute right-2 top-2.5 text-[10px] text-ui-secondary font-bold">zł</span>
                                                </div>
                                            </td>

                                            <td className="p-2 align-top">
                                                <input
                                                    type="text"
                                                    value={row.vatRate}
                                                    onChange={e => updateRow(row.id, "vatRate", e.target.value.replace(/[^0-9]/g, ''))}
                                                    className="w-full px-1 py-2 border border-ui-accent rounded-lg focus:border-ui-primary focus:outline-none text-center bg-ui-white text-ui-black font"
                                                />
                                            </td>

                                            <td className="p-2 align-top text-left">
                                                <CategorySelect
                                                    categories={categories}
                                                    value={row.categoryId}
                                                    primaryCatId={foodCategory?.id}
                                                    onChange={(newCatId) => updateRow(row.id, "categoryId", newCatId)}
                                                />
                                            </td>

                                            <td className="p-2 align-top text-left">
                                                {(() => {
                                                    let SelectorComponent = null;

                                                    if (isFoodCategory) {
                                                        SelectorComponent = (
                                                            <SearchableIngredientSelect
                                                                ingredients={ingredients}
                                                                value={row.ingredientId}
                                                                placeholder="-- Wyszukaj surowiec --"
                                                                onChange={(id) => updateRow(row.id, "ingredientId", id)}
                                                                onAddNew={(phrase) => setNewIngredientConfig({
                                                                    isOpen: true,
                                                                    targetRowId: row.id,
                                                                    initialName: phrase || row.name
                                                                })}
                                                            />
                                                        );
                                                    } else {
                                                        SelectorComponent = (
                                                            <div className="text-[11px] text-black px-3 py-2 bg-white border shadow-sm border-ui-accent rounded-xl block text-center">
                                                                Brak / Ogólne
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="flex flex-col gap-1.5">
                                                            {SelectorComponent}
                                                            {needsMultiplier && (
                                                                <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200 p-1.5 rounded-lg">
                                                                    <span className="text-[9px] font-bold text-blue-900 leading-tight">
                                                                        1 {row.unit} =
                                                                    </span>
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="text"
                                                                            value={row.multiplier}
                                                                            onChange={(e) => updateRow(row.id, "multiplier", e.target.value.replace(/[^0-9.,]/g, ''))}
                                                                            className="w-12 bg-ui-white border border-blue-300 rounded px-1.5 py-0.5 text-center text-xs text-blue-950 focus:outline-none"
                                                                        />
                                                                        <span className="text-[9px] font-bold text-blue-900">{selectedIngredient.unit}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            <td className="p-2 align-top text-center">
                                                {rows.length > 1 && (
                                                    <button
                                                        onClick={() => removeRow(row.id)}
                                                        className="p-2 text-ui-secondary hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer mt-0.5"
                                                        title="Usuń pozycję"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-ui-primary bg-ui-accent/10 hover:bg-ui-accent/20 rounded-lg transition-colors cursor-pointer"
                    >
                        <Plus size={14} /> Dodaj kolejną pozycję
                    </button>
                </div>

                <div className="px-6 py-4 border-t border-ui-accent flex flex-col sm:flex-row justify-end items-center gap-3 bg-ui-white rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold hover:bg-ui-accent/20 transition-colors text-xs cursor-pointer"
                    >
                        Anuluj
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Dodaj
                    </button>
                </div>
            </div>

            {newIngredientConfig.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-ui-white w-full max-w-sm rounded-2xl shadow-2xl border border-ui-accent p-6">
                        <h3 className="text-lg font-bold text-ui-black mb-4">Dodaj nowy surowiec</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary mb-1">Nazwa w systemie</label>
                                <input
                                    type="text"
                                    value={newIngredientConfig.initialName}
                                    onChange={(e) => setNewIngredientConfig(prev => ({ ...prev, initialName: e.target.value }))}
                                    className="w-full bg-ui-accent/10 rounded-lg px-3 py-2 text-sm font-semibold border border-transparent focus:border-ui-primary focus:outline-none transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary mb-1">Typ</label>
                                    <div className="relative">
                                        <select
                                            defaultValue="OTHER"
                                            id="manual-new-ing-type"
                                            className="w-full bg-ui-accent/10 rounded-lg px-3 py-2 text-sm font-semibold border border-transparent focus:border-ui-primary focus:outline-none transition-all appearance-none"
                                        >
                                            <option value="FLOUR">Mąka</option>
                                            <option value="FRUIT">Owoce / Warzywa</option>
                                            <option value="DAIRY">Nabiał</option>
                                            <option value="OTHER">Inne</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary mb-1">Jednostka</label>
                                    <div className="relative">
                                        <select
                                            defaultValue="kg"
                                            id="manual-new-ing-unit"
                                            className="w-full bg-ui-accent/10 rounded-lg px-3 py-2 text-sm font-semibold border border-transparent focus:border-ui-primary focus:outline-none transition-all appearance-none"
                                        >
                                            <option value="kg">kg (kilogramy)</option>
                                            <option value="l">l (litr)</option>
                                            <option value="szt">szt (sztuka)</option>
                                            <option value="opak">opak (opakowanie)</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => setNewIngredientConfig({ ...newIngredientConfig, isOpen: false })}
                                className="flex-1 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold hover:bg-ui-accent/20 text-xs transition-colors cursor-pointer"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={() => {
                                    const unitSelect = document.getElementById("manual-new-ing-unit") as HTMLSelectElement;
                                    const typeSelect = document.getElementById("manual-new-ing-type") as HTMLSelectElement;
                                    handleCreateIngredient(newIngredientConfig.initialName, unitSelect.value, typeSelect.value);
                                }}
                                className="flex-1 py-2 rounded-xl bg-ui-primary text-white font-bold hover:bg-ui-primary/90 text-xs transition-colors shadow-sm cursor-pointer"
                            >
                                Zapisz i Wybierz
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}