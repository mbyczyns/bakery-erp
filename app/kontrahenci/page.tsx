"use client";

import React, { useState, useEffect } from "react";
import {
    Plus,
    Search,
    X,
    Save,
    Building2,
    Mail,
    Phone,
    User,
    FileText,
    MapPin,
    Eye,
    Calendar,
    Loader2,
    ChevronRight,
    ExternalLink
} from "lucide-react";
import { useRouter } from "next/navigation";

// Typy zgodne z Prisma
type ContractorType = "SUPPLIER" | "CUSTOMER" | "OTHER";

interface Contractor {
    id: string;
    type: ContractorType;
    name: string;
    customName?: string | null;
    displayName?: string;
    nip: string;
    address?: string;
    email?: string;
    phone?: string;
    contactPerson?: string;
    notes?: string;
    createdAt: Date;
    lastPurchaseDate?: string | null;
}

export default function KontrahenciPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Stany dla danych z bazy
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Typ pomocniczy dla obsługi zakładki "Wszyscy"
    type TabType = ContractorType | "ALL";

    // Stan aktywnej zakładki ustawiony domyślnie na "ALL" (Wszyscy)
    const [activeTab, setActiveTab] = useState<TabType>("ALL");

    // Pobieranie danych z API
    const fetchContractors = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/kontrahenci");
            if (res.ok) {
                const data = await res.json();
                setContractors(data);
            } else {
                console.error("Błąd podczas pobierania kontrahentów");
            }
        } catch (error) {
            console.error("Błąd połączenia z serwerem", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchContractors();
    }, []);

    // Filtrowanie kontrahentów: najpierw po typie (kontrahent typu OTHER widoczny u dostawców i odbiorców), potem po wyszukiwarce
    const filteredContractors = contractors
        .filter(c => {
            if (activeTab === "ALL") return true;
            if (activeTab === "SUPPLIER") return c.type === "SUPPLIER" || c.type === "OTHER";
            if (activeTab === "CUSTOMER") return c.type === "CUSTOMER" || c.type === "OTHER";
            return c.type === activeTab;
        })
        .filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.customName && c.customName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            c.nip.includes(searchTerm) ||
            (c.address && c.address !== 'Pobrano z KSeF' && c.address.toLowerCase().includes(searchTerm.toLowerCase()))
        );

    // Licznik dla zakładek
    const getCountForType = (type: TabType) => {
        if (type === "ALL") return contractors.length;
        if (type === "SUPPLIER") return contractors.filter(c => c.type === "SUPPLIER" || c.type === "OTHER").length;
        if (type === "CUSTOMER") return contractors.filter(c => c.type === "CUSTOMER" || c.type === "OTHER").length;
        return contractors.filter(c => c.type === type).length;
    };

    // Obsługa zapisu z modalu do bazy danych
    const handleSaveContractor = async (newContractorData: Omit<Contractor, "id" | "createdAt">) => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/kontrahenci", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newContractorData),
            });

            if (res.ok) {
                const savedContractor = await res.json();
                setContractors([savedContractor, ...contractors]);
                setActiveTab(savedContractor.type);
                setIsAddModalOpen(false);
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error}`);
            }
        } catch (error) {
            console.error("Błąd podczas zapisu", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSaving(false);
        }
    };

    const getBadgeProps = (type: ContractorType) => {
        switch (type) {
            case "SUPPLIER":
                return { label: "Dostawca", styles: "bg-blue-50 text-blue-600 border-blue-200" };
            case "CUSTOMER":
                return { label: "Odbiorca", styles: "bg-emerald-50 text-emerald-700 border-emerald-200" };
            case "OTHER":
                return { label: "Dostawca / Odbiorca", styles: "bg-purple-50 text-purple-700 border-purple-200" };
            default:
                return { label: "Inny", styles: "bg-gray-50 text-gray-600 border-gray-200" };
        }
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">

            {/* Nagłówek */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">Kontrahenci</h1>

                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm w-full sm:w-auto cursor-pointer"
                >
                    <Plus size={18} />
                    <span>Dodaj kontrahenta</span>
                </button>
            </div>

            {/* Zakładki */}
            <div className="flex gap-2 border-b border-ui-accent pb-px mb-6 overflow-x-auto scrollbar-none">
                {([
                    { type: "ALL", label: "Wszyscy" },
                    { type: "SUPPLIER", label: "Dostawcy" },
                    { type: "CUSTOMER", label: "Odbiorcy" },
                    { type: "OTHER", label: "Inni" }
                ] as { type: TabType; label: string }[]).map((tab) => {
                    const isActive = activeTab === tab.type;
                    const count = getCountForType(tab.type);

                    return (
                        <button
                            key={tab.type}
                            onClick={() => setActiveTab(tab.type)}
                            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all duration-200 whitespace-nowrap cursor-pointer
                                ${isActive
                                    ? "border-ui-secondary text-ui-secondary"
                                    : "border-transparent text-ui-primary/60 hover:text-ui-primary"
                                }`}
                        >
                            {tab.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                                ${isActive
                                    ? "bg-ui-secondary text-ui-white"
                                    : "bg-ui-accent/25 text-ui-primary/70"
                                }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Wyszukiwarka */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder={
                        activeTab === "ALL"
                            ? "Szukaj wśród wszystkich kontrahentów (nazwa, NIP, adres)..."
                            : `Szukaj w zakładce ${activeTab === "SUPPLIER" ? "dostawcy" : activeTab === "CUSTOMER" ? "odbiorcy" : "inni"}...`
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3.5 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all text-sm"
                />
            </div>

            {/* WIDOK LISTY / TABELA */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left border-collapse table-fixed">
                        <colgroup>
                            <col style={{ width: '45%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '20%' }} />
                        </colgroup>

                        <thead>
                            <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                                <th className="p-4 text-left">Nazwa Kontrahenta</th>
                                <th className="p-4 text-left">NIP</th>
                                <th className="p-4 text-left">Typ</th>
                                <th className="p-4 text-left">Ostatnie zakupy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ui-accent/40 text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-ui-secondary">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={18} className="animate-spin text-ui-primary" />
                                            Ładowanie bazy kontrahentów...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredContractors.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-ui-secondary italic">
                                        Brak kontrahentów w wybranej zakładce.
                                    </td>
                                </tr>
                            ) : (
                                filteredContractors.map((c) => {
                                    const badge = getBadgeProps(c.type);

                                    return (
                                        <tr
                                            key={c.id}
                                            onClick={() => router.push(`/kontrahenci/${c.id}`)}
                                            className="hover:bg-ui-accent/5 transition-colors cursor-pointer group"
                                        >
                                            {/* Nazwa */}
                                            <td className="p-4 font-bold text-ui-black group-hover:text-ui-primary transition-colors">
                                                <div className="truncate pr-4 text-sm" title={c.displayName || c.customName || c.name}>
                                                    {c.displayName || c.customName || c.name}
                                                </div>
                                                {c.customName && c.customName !== c.name && (
                                                    <div className="text-[11px] font-normal text-ui-secondary truncate" title={c.name}>
                                                        Faktura: {c.name}
                                                    </div>
                                                )}
                                                {c.contactPerson && (
                                                    <div className="text-xs font-normal text-ui-secondary flex items-center gap-1 mt-0.5 truncate">
                                                        <User size={12} className="shrink-0" /> {c.contactPerson}
                                                    </div>
                                                )}
                                            </td>

                                            {/* NIP */}
                                            <td className="p-4 font-mono text-sm text-ui-black">
                                                {c.nip}
                                            </td>

                                            {/* Typ relacji */}
                                            <td className="p-4">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1 rounded-md border ${badge.styles} inline-block whitespace-nowrap`}>
                                                    {badge.label}
                                                </span>
                                            </td>

                                            {/* Ostatnie zakupy */}
                                            <td className="p-4 text-xs text-ui-secondary">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <Calendar size={14} className="text-ui-secondary/70 shrink-0" />
                                                    <span>
                                                        {c.lastPurchaseDate
                                                            ? new Date(c.lastPurchaseDate).toLocaleDateString('pl-PL', {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit'
                                                            })
                                                            : "Brak historii"}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL: Kreator */}
            <AddContractorModal
                isOpen={isAddModalOpen}
                isSaving={isSaving}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveContractor}
            />

        </div>
    );
}

// =========================================================================
// PODKOMPONENT: AddContractorModal
// =========================================================================
interface AddContractorModalProps {
    isOpen: boolean;
    isSaving: boolean;
    onClose: () => void;
    onSave: (data: Omit<Contractor, "id" | "createdAt">) => void;
}

function AddContractorModal({ isOpen, isSaving, onClose, onSave }: AddContractorModalProps) {
    const [type, setType] = useState<ContractorType>("SUPPLIER");
    const [name, setName] = useState("");
    const [nip, setNip] = useState("");
    const [address, setAddress] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [contactPerson, setContactPerson] = useState("");
    const [notes, setNotes] = useState("");

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        onSave({
            type,
            name,
            nip,
            address: address.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            contactPerson: contactPerson.trim() || undefined,
            notes: notes.trim() || undefined
        });

        setName("");
        setNip("");
        setAddress("");
        setEmail("");
        setPhone("");
        setContactPerson("");
        setNotes("");
        setType("SUPPLIER");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="absolute inset-0 bg-ui-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-ui-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-ui-accent animate-scale-up">

                <div className="px-6 py-5 border-b border-ui-accent flex items-center justify-between bg-ui-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                            <Building2 size={20} className="text-ui-secondary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-ui-black">Nowy kontrahent</h2>
                            <p className="text-xs text-ui-black/50">Uzupełnij dane identyfikacyjne firmy i dane teleadresowe.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="p-2 hover:bg-ui-accent rounded-full text-ui-black/50 hover:text-ui-black transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* WYBÓR TYPU */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Typ relacji biznesowej</label>
                        <div className="grid grid-cols-3 gap-2 bg-ui-accent/10 p-1.5 rounded-xl border border-ui-accent/40">
                            {(["SUPPLIER", "CUSTOMER", "OTHER"] as ContractorType[]).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    className={`py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer
                                        ${type === t
                                            ? "bg-ui-primary text-ui-white shadow-sm"
                                            : "text-ui-primary/60 hover:text-ui-primary hover:bg-ui-white/50"
                                        }`}
                                >
                                    {t === "SUPPLIER" ? "Dostawca" : t === "CUSTOMER" ? "Odbiorca" : "Inny"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* DANE PODSTAWOWE */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Nazwa firmy / Kontrahenta</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="np. Zakłady Młynarskie Poznań"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">NIP</label>
                            <input
                                type="text"
                                required
                                pattern="\d{10}"
                                title="NIP musi składać się z dokładnie 10 cyfr"
                                value={nip}
                                onChange={(e) => setNip(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                placeholder="10 cyfr bez kresek"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>
                    </div>

                    {/* ADRES */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                            <MapPin size={12} /> Adres siedziby <span className="text-ui-secondary/40 font-normal lowercase">(opcjonalnie)</span>
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="ul. Chlebowa 10, 60-100 Poznań"
                            className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                        />
                    </div>

                    {/* DANE TELEADRESOWE */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                                <Mail size={12} /> Adres e-mail <span className="text-ui-secondary/40 font-normal lowercase">(opcjonalnie)</span>
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="biuro@kontrahent.pl"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                                <Phone size={12} /> Numer telefonu <span className="text-ui-secondary/40 font-normal lowercase">(opcjonalnie)</span>
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+48 123 456 789"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>
                    </div>

                    {/* OSOBA KONTAKTOWA */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                            <User size={12} /> Osoba kontaktowa <span className="text-ui-secondary/40 font-normal lowercase">(opcjonalnie)</span>
                        </label>
                        <input
                            type="text"
                            value={contactPerson}
                            onChange={(e) => setContactPerson(e.target.value)}
                            placeholder="Imię i nazwisko przedstawiciela..."
                            className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                        />
                    </div>

                    {/* UWAGI */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-1">
                            <FileText size={12} /> Uwagi wewnętrzne <span className="text-ui-secondary/40 font-normal lowercase">(opcjonalnie)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Zapisz istotne informacje o współpracy, dostawach, upustach cenowych..."
                            rows={3}
                            className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all resize-none"
                        />
                    </div>

                    {/* Stopka Modala */}
                    <div className="pt-4 border-t border-ui-accent flex flex-col sm:flex-row justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-ui-secondary text-ui-primary font-semibold hover:bg-ui-accent/20 transition-colors text-sm cursor-pointer disabled:opacity-50"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-6 py-2.5 rounded-xl font-semibold shadow-sm transition-colors text-sm cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Zapisz w bazie
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}