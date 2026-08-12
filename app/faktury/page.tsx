"use client";

import React, { useState, useEffect } from "react";
import {
    Download,
    Search,
    X,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Layers,
    Check,
    Eye
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
    type?: "FLOUR" | "OTHER";
}

export default function FakturyPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<InvoiceStatus>("WAITING");
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [verifyingDoc, setVerifyingDoc] = useState<Document | null>(null);

    const [categories, setCategories] = useState<DictionaryCategory[]>([]);
    const [ingredients, setIngredients] = useState<DictionaryIngredient[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

    // 1. Pobieranie listy nagłówków faktur
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

    // 2. Pobieranie słowników (Kategorie i Surowce)
    const fetchDictionaries = async () => {
        try {
            const res = await fetch("/api/dictionaries");
            if (res.ok) {
                const data = await res.json();
                setCategories(data.categories || []);
                setIngredients(data.ingredients || []);
            }
        } catch (error) {
            console.error("Błąd podczas pobierania słowników:", error);
        }
    };

    useEffect(() => {
        fetchInvoices();
        fetchDictionaries();
    }, []);

    // 3. Synchronizacja nagłówków z KSeF (Lekki request)
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

    // 4. Pobieranie pozycji ON-DEMAND (z Bazy lub z KSeF)
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

    const getStatusBadge = (status: InvoiceStatus) => {
        switch (status) {
            case "WAITING":
                return {
                    styles: "bg-amber-50 text-amber-700 border-amber-200",
                    icon: <Clock size={14} />,
                };
            case "IMPORTED":
                return {
                    styles: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    icon: <CheckCircle2 size={14} />,
                };
            case "REJECTED":
                return {
                    styles: "bg-rose-50 text-rose-700 border-rose-200",
                    icon: <XCircle size={14} />,
                };
        }
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">
            {/* Nagłówek */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Faktury i Dokumenty Kosztowe
                    </h1>
                    <p className="text-ui-black/60 text-sm mt-1">
                        Pobieraj faktury z KSeF, weryfikuj pozycje w trybie na żądanie i przypisuj surowce do receptur.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSyncKsef}
                        disabled={isSyncing}
                        className="flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
                    >
                        {isSyncing ? (
                            <>
                                <Loader2 size={18} className="animate-spin text-ui-secondary" />
                                Pobieram nagłówki z KSeF...
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

            {/* Zakładki */}
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

            {/* Wyszukiwarka */}
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

            {/* Tabela Faktur */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                                <th className="p-4">Numer Faktury</th>
                                <th className="p-4">Dostawca</th>
                                <th className="p-4 max-w-[80px] leading-tight">Wystawiono</th>
                                <th className="p-4 text-right">Kwota Brutto</th>
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
                                    const badge = getStatusBadge(doc.status);
                                    const isThisLoading = loadingDocId === doc.id;

                                    return (
                                        <tr key={doc.id} className="hover:bg-ui-accent/5 transition-colors">
                                            <td className="p-4 font-semibold text-ui-black text-sm">{doc.docNumber}</td>
                                            <td className="p-4 text-ui-primary font-medium text-sm max-w-xs truncate">{doc.contractorName}</td>
                                            <td className="p-4 text-ui-primary/70 text-xs font-medium">{doc.issueDate}</td>
                                            <td className="p-4 text-right font-bold text-ui-black text-sm">{Number(doc.grossAmount || 0).toFixed(2)} zł</td>
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
                                                                Pobieram pozycje...
                                                            </>
                                                        ) : (
                                                            "Weryfikuj"
                                                        )}
                                                    </button>
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

            {/* MODAL 1: Weryfikacja i Mapowanie Faktury */}
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
                />
            )}

            {/* MODAL 2: Podgląd Faktury */}
            {selectedDoc && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedDoc(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden border border-ui-accent max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-b border-ui-accent p-5 flex items-start justify-between bg-ui-white">
                            <div>
                                <h2 className="text-xl font-bold text-ui-primary">{selectedDoc.docNumber}</h2>
                                <p className="text-xs text-ui-secondary mt-1">{selectedDoc.contractorName}</p>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} className="p-2 bg-ui-accent/20 hover:bg-ui-accent/40 text-ui-primary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-ui-accent/10 p-4 rounded-xl border border-ui-accent/40">
                                <div>
                                    <span className="text-xs text-ui-secondary font-bold block">Data wystawienia:</span>
                                    <span className="font-bold text-ui-black">{selectedDoc.issueDate}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-ui-secondary font-bold block">Wartość Netto:</span>
                                    <span className="font-bold text-ui-black">{Number(selectedDoc.netAmount || 0).toFixed(2)} zł</span>
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
                                                <th className="p-3">Nazwa artykułu</th>
                                                <th className="p-3 text-center">Ilość</th>
                                                <th className="p-3 text-right">Cena Netto</th>
                                                <th className="p-3 text-right">Wartość Brutto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-ui-accent/40">
                                            {selectedDoc.positions?.map((pos) => (
                                                <tr key={pos.id} className="hover:bg-ui-accent/5">
                                                    <td className="p-3 font-semibold text-ui-black">{pos.name}</td>
                                                    <td className="p-3 text-center font-bold text-ui-primary">
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
// PODKOMPONENT: VerificationModal (Mapowanie Pozycji)
// =========================================================================
interface VerificationModalProps {
    doc: Document;
    categories: DictionaryCategory[];
    ingredients: DictionaryIngredient[];
    onClose: () => void;
    onSuccess: () => void;
}

function VerificationModal({ doc, categories, ingredients, onClose, onSuccess }: VerificationModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    const [mappingState, setMappingState] = useState<
        Record<string, { categoryId: string; ingredientId?: string }>
    >(() => {
        const initialState: Record<string, { categoryId: string; ingredientId?: string }> = {};
        const defaultCategory = categories[0]?.id || "";

        (doc.positions || []).forEach((pos) => {
            initialState[pos.productId] = {
                categoryId: pos.categoryId || defaultCategory,
                ingredientId: pos.ingredientId || undefined,
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
                ingredientId: isFoodCategory(categoryId) ? prev[productId]?.ingredientId : undefined,
            },
        }));
    };

    const handleIngredientChange = (productId: string, ingredientId: string) => {
        setMappingState((prev) => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                ingredientId: ingredientId || undefined,
            },
        }));
    };

    const isFoodCategory = (categoryId: string) => {
        const cat = categories.find((c) => c.id === categoryId);
        if (!cat) return false;
        const nameLower = cat.name.toLowerCase();
        return nameLower.includes("spożywcze") || nameLower.includes("mąki") || nameLower.includes("surowce") || nameLower.includes("materiały");
    };

    const handleApprove = async () => {
        setIsSubmitting(true);
        try {
            const itemsMapping = Object.entries(mappingState).map(([productId, val]) => ({
                productId,
                categoryId: val.categoryId,
                ingredientId: val.ingredientId || null,
            }));

            const res = await fetch(`/api/faktury/${doc.id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemsMapping }),
            });

            if (res.ok) {
                alert("Faktura została pomyślnie zmapowana i zaakceptowana!");
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-ui-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-ui-accent max-h-[90vh] flex flex-col">
                <div className="px-6 py-5 border-b border-ui-accent flex items-center justify-between bg-amber-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-xl text-amber-800">
                            <AlertCircle size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-ui-black">Weryfikacja Faktury z KSeF</h2>
                            <p className="text-xs text-ui-black/60">
                                {doc.docNumber} • {doc.contractorName} • Brutto: <b>{Number(doc.grossAmount || 0).toFixed(2)} zł</b>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-ui-accent/20 rounded-full transition-colors text-ui-primary">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                        <Layers size={16} className="text-blue-600 mt-0.5 shrink-0" />
                        <div>
                            <b>Pozycje z faktury ({doc.positions?.length || 0}):</b>
                            <br />Dla każdej pozycji z faktury dobierz kategorię oraz surowiec bazowy piekarni (`Ingredient`) potrzebny do Food Costu.
                        </div>
                    </div>

                    <div className="border border-ui-accent rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-ui-accent/20 text-ui-secondary font-bold uppercase border-b border-ui-accent">
                                    <th className="p-3.5 w-1/3">Pozycja z KSeF</th>
                                    <th className="p-3.5 text-center">Ilość & Cena</th>
                                    <th className="p-3.5 w-1/4">1. Kategoria Pozycji</th>
                                    <th className="p-3.5 w-1/3">2. Surowiec Piekarni (Food Cost)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/40">
                                {(doc.positions || []).map((pos) => {
                                    const currentMapping = mappingState[pos.productId] || { categoryId: categories[0]?.id || "" };

                                    return (
                                        <tr key={pos.id} className="hover:bg-ui-accent/5">
                                            <td className="p-3.5">
                                                <div className="font-bold text-ui-black">{pos.name}</div>
                                                <div className="text-[10px] text-ui-secondary mt-0.5">ID: {pos.productId.substring(0, 8)}...</div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <div className="font-semibold text-ui-primary">{pos.quantity} {pos.unit}</div>
                                                <div className="text-[11px] text-ui-secondary">{Number(pos.netPrice || 0).toFixed(2)} zł / szt netto</div>
                                            </td>
                                            <td className="p-3.5">
                                                <select
                                                    value={currentMapping.categoryId}
                                                    onChange={(e) => handleCategoryChange(pos.productId, e.target.value)}
                                                    className="w-full bg-ui-white border border-ui-accent rounded-lg px-2.5 py-2 text-xs font-semibold text-ui-primary focus:outline-none focus:border-ui-secondary cursor-pointer"
                                                >
                                                    {categories.map((cat) => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-3.5">
                                                {(() => {
                                                    const selectedCategory = categories.find(c => c.id === currentMapping.categoryId);

                                                    const FLOUR_CATEGORY_ID = categories.find(c => c.name === "Mąka")?.id;
                                                    const FOOD_CATEGORY_ID = categories.find(c => c.name === "Produkty spożywcze")?.id;

                                                    if (selectedCategory?.id === FLOUR_CATEGORY_ID) {
                                                        const flourIngredients = ingredients.filter(ing => ing.type === "FLOUR");

                                                        return (
                                                            <select
                                                                value={currentMapping.ingredientId || ""}
                                                                onChange={(e) => handleIngredientChange(pos.productId, e.target.value)}
                                                                className="w-full bg-amber-50/80 border border-amber-300 rounded-lg px-2.5 py-2 text-xs font-bold text-amber-900 focus:outline-none cursor-pointer"
                                                            >
                                                                <option value="">-- Wybierz Mąkę --</option>
                                                                {flourIngredients.map((ing) => (
                                                                    <option key={ing.id} value={ing.id}>
                                                                        {ing.name} ({ing.unit})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        );
                                                    }

                                                    if (selectedCategory?.id === FOOD_CATEGORY_ID) {
                                                        const foodIngredients = ingredients.filter(ing => ing.type === "OTHER");

                                                        return (
                                                            <select
                                                                value={currentMapping.ingredientId || ""}
                                                                onChange={(e) => handleIngredientChange(pos.productId, e.target.value)}
                                                                className="w-full bg-emerald-50/80 border border-emerald-300 rounded-lg px-2.5 py-2 text-xs font-bold text-emerald-900 focus:outline-none cursor-pointer"
                                                            >
                                                                <option value="">-- Wybierz Surowiec Spożywczy --</option>
                                                                {foodIngredients.map((ing) => (
                                                                    <option key={ing.id} value={ing.id}>
                                                                        {ing.name} ({ing.unit})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        );
                                                    }

                                                    return (
                                                        <span className="text-[11px] text-ui-secondary italic px-2 py-1 bg-ui-accent/10 rounded-md block text-center">
                                                            Wydatek ogólny / brak surowca
                                                        </span>
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

                <div className="px-6 py-4 border-t border-ui-accent flex flex-col sm:flex-row justify-between items-center gap-3 bg-ui-white">
                    <button
                        type="button"
                        onClick={handleReject}
                        disabled={isRejecting || isSubmitting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                        <XCircle size={16} />
                        Odrzuć fakturę
                    </button>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold hover:bg-ui-accent/20 transition-colors text-xs"
                        >
                            Anuluj
                        </button>
                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={isSubmitting || isRejecting}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Zatwierdź i Zmapuj Pozycje
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}