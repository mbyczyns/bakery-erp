"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Plus,
    Download,
    Search,
    X,
    Save,
    FileText,
    Calendar,
    DollarSign,
    Building2,
    Tag,
    Layers,
    HelpCircle
} from "lucide-react";

// Typy dokumentów
type DocumentType = "FAKTURA" | "PARAGON" | "INNY";

interface Document {
    id: string;
    type: DocumentType;
    docNumber: string;
    issueDate: string;
    netAmount: number;
    grossAmount: number;
    contractorId: string;
    contractorName: string;
    category: string;
    notes?: string;
    createdAt: Date;
}

// Mockowa baza kontrahentów zaciągana do wyszukiwarki modalu
const mockContractors = [
    { id: "c1-uuid", name: "Młyn Nowofalowy Sp. z o.o.", nip: "5210001234", type: "SUPPLIER" },
    { id: "c2-uuid", name: "Kawiarnia 'Ciepła Buła' s.c.", nip: "7771234567", type: "CUSTOMER" },
    { id: "hydraulik-uuid", name: "Mariusz Kowalski (Hydraulik)", nip: "Brak - prywatnie", type: "OTHER" },
    { id: "hurtownia-opakowan-uuid", name: "Hurtownia Opakowań 'Box'", nip: "9998887766", type: "SUPPLIER" }
];

// Mockowe kategorie kosztów pobierane globalnie (np. z konfiguracji, którą robiliśmy wcześniej)
const mockCategories = [
    "Żywność",
    "Środki czystości",
    "Sprzęt i narzędzia",
    "Opakowania",
    "Media (Prąd, Gaz)",
    "Usługi i serwis",
    "Inne wydatki"
];

// Początkowa lista dodanych dokumentów
const initialDocuments: Document[] = [
    {
        id: "doc-1",
        type: "FAKTURA",
        docNumber: "FV/00125/2026",
        issueDate: "2026-07-12",
        netAmount: 1200.00,
        grossAmount: 1260.00,
        contractorId: "c1-uuid",
        contractorName: "Młyn Nowofalowy Sp. z o.o.",
        category: "Żywność",
        notes: "Dostawa mąki typ 750",
        createdAt: new Date()
    },
    {
        id: "doc-2",
        type: "PARAGON",
        docNumber: "PA-55412-OBI",
        issueDate: "2026-07-14",
        netAmount: 85.00,
        grossAmount: 104.55,
        contractorId: "hurtownia-opakowan-uuid",
        contractorName: "Market Budowlany OBI (zakup podręczny)",
        category: "Sprzęt i narzędzia",
        notes: "Klej montażowy i uszczelki do zmywarki",
        createdAt: new Date()
    }
];

export default function FakturyPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [documents, setDocuments] = useState<Document[]>(initialDocuments);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

    // Filtrowanie dokumentów po numerze lub kontrahencie
    const filteredDocs = documents.filter(doc =>
        doc.docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.contractorName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Zapytanie o zapis nowego dokumentu z modalu
    const handleSaveDocument = (newDocData: Omit<Document, "id" | "createdAt">) => {
        const newDoc: Document = {
            id: `doc-${Date.now()}`,
            createdAt: new Date(),
            ...newDocData
        };
        setDocuments([newDoc, ...documents]);
    };

    const getDocBadge = (type: DocumentType) => {
        switch (type) {
            case "FAKTURA":
                return { label: "Faktura", styles: "bg-blue-50 text-blue-600 border-blue-200" };
            case "PARAGON":
                return { label: "Paragon", styles: "bg-green-50 text-green-600 border-green-200" };
            default:
                return { label: "Dowód zakupu", styles: "bg-purple-50 text-purple-600 border-purple-200" };
        }
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">

            {/* Nagłówek strony */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Faktury i Paragony
                    </h1>
                    <p className="text-ui-black/60 text-sm mt-1">
                        Zarządzaj wydatkami i dokumentami kosztowymi piekarni.
                    </p>
                </div>

                {/* Przyciski po prawej stronie */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <button className="flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all duration-200 text-sm w-full sm:w-auto">
                        <Download size={18} />
                        Pobierz z KSeF
                    </button>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm w-full sm:w-auto"
                    >
                        <Plus size={18} />
                        Dodaj ręcznie
                    </button>
                </div>
            </div>

            {/* Wyszukiwarka */}
            <div className="relative mb-8">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder="Wyszukaj po numerze dokumentu lub nazwie firmy..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3.5 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                />
            </div>

            {/* Lista dokumentów w formie nowoczesnej tabeli */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                                <th className="p-4">Typ</th>
                                <th className="p-4">Numer</th>
                                <th className="p-4">Kontrahent</th>
                                <th className="p-4">Kategoria</th>
                                <th className="p-4">Data</th>
                                <th className="p-4 text-right">Kwota Brutto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ui-accent/40">
                            {filteredDocs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-ui-secondary italic text-sm">
                                        Brak dokumentów spełniających kryteria wyszukiwania.
                                    </td>
                                </tr>
                            ) : (
                                filteredDocs.map((doc) => {
                                    const badge = getDocBadge(doc.type);
                                    return (
                                        <tr
                                            key={doc.id}
                                            onClick={() => setSelectedDoc(doc)}
                                            className="hover:bg-ui-accent/5 cursor-pointer transition-colors"
                                        >
                                            <td className="p-4">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${badge.styles}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="p-4 font-semibold text-ui-black text-sm">{doc.docNumber}</td>
                                            <td className="p-4 text-ui-primary font-medium text-sm max-w-xs truncate">{doc.contractorName}</td>
                                            <td className="p-4 text-xs font-semibold text-ui-secondary">
                                                <span className="bg-ui-accent/20 text-ui-primary px-2.5 py-1 rounded-lg">
                                                    {doc.category}
                                                </span>
                                            </td>
                                            <td className="p-4 text-ui-primary/60 text-xs font-medium">{doc.issueDate}</td>
                                            <td className="p-4 text-right font-bold text-ui-black text-sm">{doc.grossAmount.toFixed(2)} zł</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL 1: Podgląd szczegółów zapisanego dokumentu */}
            {selectedDoc && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedDoc(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-ui-accent"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-b border-ui-accent p-5 flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-ui-primary">{selectedDoc.docNumber}</h2>
                                <p className="text-xs text-ui-secondary mt-1">Dodano ręcznie do systemu</p>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} className="p-2 bg-ui-accent/20 hover:bg-ui-accent/40 text-ui-primary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-sm">
                            <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                <span className="text-ui-secondary font-semibold">Typ dokumentu:</span>
                                <span className="font-bold text-ui-black">{getDocBadge(selectedDoc.type).label}</span>
                            </div>
                            <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                <span className="text-ui-secondary font-semibold">Kontrahent:</span>
                                <span className="font-bold text-ui-black text-right">{selectedDoc.contractorName}</span>
                            </div>
                            <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                <span className="text-ui-secondary font-semibold">Data wystawienia:</span>
                                <span className="font-bold text-ui-black">{selectedDoc.issueDate}</span>
                            </div>
                            <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                <span className="text-ui-secondary font-semibold">Kategoria kosztowa:</span>
                                <span className="font-bold text-ui-black">{selectedDoc.category}</span>
                            </div>
                            <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                <span className="text-ui-secondary font-semibold">Wartość Netto:</span>
                                <span className="font-bold text-ui-black">{selectedDoc.netAmount.toFixed(2)} zł</span>
                            </div>
                            <div className="flex justify-between border-b border-ui-accent/30 pb-2 bg-ui-accent/10 p-2 rounded-lg">
                                <span className="text-ui-secondary font-extrabold">Wartość Brutto:</span>
                                <span className="font-extrabold text-ui-primary">{selectedDoc.grossAmount.toFixed(2)} zł</span>
                            </div>
                            {selectedDoc.notes && (
                                <div className="bg-ui-accent/10 border border-ui-accent/40 rounded-xl p-3 text-xs mt-4">
                                    <p className="font-bold text-ui-secondary mb-1">Opis / Notatki:</p>
                                    <p className="text-ui-black/80 whitespace-pre-wrap">{selectedDoc.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: Kreator ręcznego dodawania dokumentów */}
            <AddDocumentModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveDocument}
            />

        </div>
    );
}

// =========================================================================
// PODKOMPONENT: AddDocumentModal (Kreator ręcznego wpisu)
// =========================================================================
interface AddDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Document, "id" | "createdAt">) => void;
}

function AddDocumentModal({ isOpen, onClose, onSave }: AddDocumentModalProps) {
    const [type, setType] = useState<DocumentType>("FAKTURA");
    const [docNumber, setDocNumber] = useState("");
    const [issueDate, setIssueDate] = useState("");
    const [netAmount, setNetAmount] = useState("");
    const [grossAmount, setGrossAmount] = useState("");
    const [category, setCategory] = useState(mockCategories[0]);
    const [notes, setNotes] = useState("");

    // Obsługa wyszukiwarki kontrahenta in-line (Combobox)
    const [contractorSearch, setContractorSearch] = useState("");
    const [selectedContractorId, setSelectedContractorId] = useState("");
    const [isContractorDropdownOpen, setIsContractorDropdownOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsContractorDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isOpen) return null;

    // Filtrowanie listy kontrahentów w locie
    const filteredContractors = mockContractors.filter(c =>
        c.name.toLowerCase().includes(contractorSearch.toLowerCase()) ||
        c.nip.includes(contractorSearch)
    );

    const handleSelectContractor = (id: string, name: string) => {
        setSelectedContractorId(id);
        setContractorSearch(name);
        setIsContractorDropdownOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Podstawowa walidacja wyboru kontrahenta
        if (!selectedContractorId) {
            alert("Proszę wybrać lub wpisać kontrahenta z listy!");
            return;
        }

        const selectedC = mockContractors.find(c => c.id === selectedContractorId);

        onSave({
            type,
            docNumber,
            issueDate,
            netAmount: parseFloat(netAmount) || 0,
            grossAmount: parseFloat(grossAmount) || 0,
            contractorId: selectedContractorId,
            contractorName: selectedC ? selectedC.name : contractorSearch,
            category,
            notes: notes.trim() || undefined
        });

        // Resetowanie formularza
        setType("FAKTURA");
        setDocNumber("");
        setIssueDate("");
        setNetAmount("");
        setGrossAmount("");
        setCategory(mockCategories[0]);
        setNotes("");
        setContractorSearch("");
        setSelectedContractorId("");

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="absolute inset-0 bg-ui-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-ui-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-ui-accent animate-scale-up">

                {/* Nagłówek */}
                <div className="px-6 py-5 border-b border-ui-accent flex items-center justify-between bg-ui-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                            <Plus size={20} className="text-ui-secondary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-ui-black">Dodaj wydatek (ręcznie)</h2>
                            <p className="text-xs text-ui-black/50">Wprowadź zakupy, które nie znajdują się w systemie KSeF.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-ui-accent rounded-full text-ui-black/50 hover:text-ui-black transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Formularz */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Wybór typu dokumentu (Segmented Control) */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Typ dokumentu</label>
                        <div className="grid grid-cols-3 gap-2 bg-ui-accent/10 p-1.5 rounded-xl border border-ui-accent/40">
                            {(["FAKTURA", "PARAGON", "INNY"] as DocumentType[]).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    className={`py-2 rounded-lg text-xs font-bold transition-all duration-200
                                        ${type === t
                                            ? "bg-ui-primary text-ui-white shadow-sm"
                                            : "text-ui-primary/60 hover:text-ui-primary hover:bg-ui-white/50"
                                        }`}
                                >
                                    {t === "FAKTURA" ? "Faktura" : t === "PARAGON" ? "Paragon" : "Inny dowód"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Wyszukiwarka kontrahentów in-line */}
                    <div ref={dropdownRef} className="flex flex-col gap-1.5 relative">
                        <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                            <Building2 size={12} /> Kontrahent / Wykonawca
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Wpisz nazwę firmy lub NIP..."
                            value={contractorSearch}
                            onFocus={() => setIsContractorDropdownOpen(true)}
                            onChange={(e) => {
                                setContractorSearch(e.target.value);
                                setSelectedContractorId(""); // Czyszczenie wyboru przy pisaniu
                                setIsContractorDropdownOpen(true);
                            }}
                            className="w-full bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                        />

                        {/* Dropdown podpowiedzi */}
                        {isContractorDropdownOpen && contractorSearch.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-ui-white border border-ui-accent rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-ui-accent/40 animate-fade-in">
                                {filteredContractors.length > 0 ? (
                                    filteredContractors.map((c) => (
                                        <div
                                            key={c.id}
                                            onClick={() => handleSelectContractor(c.id, c.name)}
                                            className="px-4 py-2.5 text-xs text-ui-primary hover:bg-ui-accent/15 cursor-pointer flex justify-between items-center transition-colors"
                                        >
                                            <span className="font-bold text-ui-black">{c.name}</span>
                                            <span className="text-[10px] text-ui-secondary font-semibold bg-ui-accent/10 px-2 py-0.5 rounded-md">
                                                NIP: {c.nip}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-xs text-ui-secondary/70 italic bg-ui-white">
                                        Nie znaleziono kontrahenta o tej nazwie w bazie.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Numer dokumentu i Data */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Numer dokumentu</label>
                            <input
                                type="text"
                                required
                                value={docNumber}
                                onChange={(e) => setDocNumber(e.target.value)}
                                placeholder={type === "FAKTURA" ? "np. FV/12/2026" : "np. PA-154-OBI"}
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                                <Calendar size={12} /> Data wystawienia / zakupu
                            </label>
                            <input
                                type="date"
                                required
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary transition-all"
                            />
                        </div>
                    </div>

                    {/* Kwoty: Netto i Brutto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Kwota Netto (zł)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={netAmount}
                                onChange={(e) => setNetAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Kwota Brutto (zł)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={grossAmount}
                                onChange={(e) => setGrossAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>
                    </div>

                    {/* Kategoria kosztowa */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                            <Tag size={12} /> Kategoria wydatku
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary cursor-pointer"
                        >
                            {mockCategories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Opis / Notatki */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                            <FileText size={12} /> Opis wydatku / Uwagi
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Opisz czego dotyczył zakup (np. Usługa hydrauliczna - zapłata gotówką, lub Import towarów z Czech)..."
                            rows={3}
                            className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all resize-none"
                        />
                    </div>

                    {/* Stopka Modala */}
                    <div className="pt-4 border-t border-ui-accent flex flex-col sm:flex-row justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-ui-secondary text-ui-primary font-semibold hover:bg-ui-accent/20 transition-colors text-sm"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-6 py-2.5 rounded-xl font-semibold shadow-sm transition-colors text-sm"
                        >
                            <Save size={16} />
                            Zapisz dokument
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}