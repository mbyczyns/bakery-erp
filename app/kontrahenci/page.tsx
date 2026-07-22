"use client";

import React, { useState } from "react";
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
    ExternalLink
} from "lucide-react";

// Typy zgodne z Prisma
type ContractorType = "SUPPLIER" | "CUSTOMER" | "OTHER";

interface Contractor {
    id: string;
    type: ContractorType;
    name: string;
    nip: string;
    address?: string;
    email?: string;
    phone?: string;
    contactPerson?: string;
    notes?: string;
    createdAt: Date;
}

// Początkowe mock-dane kontrahentów w bazie
const initialContractors: Contractor[] = [
    {
        id: "c1-uuid",
        type: "SUPPLIER",
        name: "Młyn Nowofalowy Sp. z o.o.",
        nip: "5210001234",
        address: "ul. Pszenna 15, 60-100 Poznań",
        email: "kontakt@mlynnowofalowy.pl",
        phone: "+48 601 202 303",
        contactPerson: "Andrzej Młynarz",
        notes: "Główny dostawca mąki typ 750 i 2000. Dostawy zawsze w środy rano.",
        createdAt: new Date("2026-07-01")
    },
    {
        id: "c2-uuid",
        type: "CUSTOMER",
        name: "Kawiarnia 'Ciepła Buła' s.c.",
        nip: "7771234567",
        address: "Rynek 12, 61-000 Poznań",
        email: "zamowienia@cieplabula.pl",
        phone: "+48 505 505 505",
        contactPerson: "Marta Słodka",
        notes: "Odbiór własny codziennie o 6:30. Faktura zbiorcza na koniec miesiąca.",
        createdAt: new Date("2026-07-03")
    }
];

export default function KontrahenciPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [contractors, setContractors] = useState<Contractor[]>(initialContractors);
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

    // Typ pomocniczy dla obsługi zakładki "Wszyscy"
    type TabType = ContractorType | "ALL";

    // Stan aktywnej zakładki ustawiony domyślnie na "ALL" (Wszyscy)
    const [activeTab, setActiveTab] = useState<TabType>("ALL");

    // Filtrowanie kontrahentów: najpierw po typie (jeśli activeTab to "ALL", to pomijamy ten krok), potem po wyszukiwarce
    const filteredContractors = contractors
        .filter(c => activeTab === "ALL" ? true : c.type === activeTab)
        .filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.nip.includes(searchTerm)
        );

    // Funkcja licząca ile elementów mamy w poszczególnych kategoriach na zakładkach
    const getCountForType = (type: TabType) => {
        if (type === "ALL") return contractors.length; // Zwraca sumę absolutnie wszystkich kontrahentów
        return contractors.filter(c => c.type === type).length;
    };

    // Obsługa zapisu z modalu
    const handleSaveContractor = (newContractorData: Omit<Contractor, "id" | "createdAt">) => {
        const newContractor: Contractor = {
            id: `c-${Date.now()}-uuid`,
            createdAt: new Date(),
            ...newContractorData
        };

        setContractors([newContractor, ...contractors]);

        // Automatycznie przełączamy na zakładkę dodanego kontrahenta, żeby użytkownik go zobaczył
        setActiveTab(newContractorData.type);
    };

    const getBadgeProps = (type: ContractorType) => {
        switch (type) {
            case "SUPPLIER":
                return { label: "Dostawca", styles: "bg-blue-50 text-blue-600 border-blue-200" };
            case "CUSTOMER":
                return { label: "Odbiorca", styles: "bg-green-50 text-green-600 border-green-200" };
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
                    <p className="text-ui-black text-sm mt-1">
                        Zarządzaj bazą swoich dostawców i odbiorców wypieków.
                    </p>
                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm w-full sm:w-auto"
                >
                    <Plus size={18} />
                    <span>Dodaj kontrahenta</span>
                </button>
            </div>

            {/* POPRAWIONY PASEK WYBORU ZAKŁADEK (Wszyscy, Dostawcy, Odbiorcy, Inni) */}
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
                            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all duration-200 whitespace-nowrap
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

            {/* Wyszukiwarka z dynamicznym placeholderem */}
            <div className="relative mb-8">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder={
                        activeTab === "ALL"
                            ? "Szukaj wśród wszystkich kontrahentów..."
                            : `Szukaj w zakładce ${activeTab === "SUPPLIER" ? "dostawcy" : activeTab === "CUSTOMER" ? "odbiorcy" : "inni"}...`
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3.5 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                />
            </div>

            {/* Siatka kontrahentów */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredContractors.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-ui-secondary italic">
                        Brak pasujących pozycji w wybranej zakładce.
                    </div>
                ) : (
                    filteredContractors.map((c) => {
                        const badge = getBadgeProps(c.type);
                        return (
                            <div
                                key={c.id}
                                onClick={() => setSelectedContractor(c)}
                                className="bg-ui-white border border-ui-accent hover:border-ui-secondary rounded-2xl p-5 shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <h3 className="font-bold text-ui-black text-lg line-clamp-1">{c.name}</h3>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${badge.styles} shrink-0`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-ui-primary/60">NIP: <strong className="text-ui-black">{c.nip}</strong></p>
                                    {c.address && (
                                        <p className="text-xs text-ui-primary/50 mt-1.5 flex items-center gap-1.5 line-clamp-1">
                                            <MapPin size={12} />
                                            {c.address}
                                        </p>
                                    )}
                                </div>

                                <div className="border-t border-ui-accent/40 mt-4 pt-3 flex items-center justify-between text-xs text-ui-secondary font-medium">
                                    <span>Szczegóły firmy</span>
                                    <ExternalLink size={12} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* MODAL 1: Podgląd szczegółów */}
            {selectedContractor && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedContractor(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-ui-accent"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-b border-ui-accent p-5 flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-ui-primary">{selectedContractor.name}</h2>
                                <p className="text-xs text-ui-secondary mt-1">NIP: {selectedContractor.nip}</p>
                            </div>
                            <button
                                onClick={() => setSelectedContractor(null)}
                                className="p-2 bg-ui-accent/20 hover:bg-ui-accent/40 text-ui-primary rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-sm">
                            <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                <span className="text-ui-secondary font-semibold">Typ relacji:</span>
                                <span className="font-bold text-ui-black">{getBadgeProps(selectedContractor.type).label}</span>
                            </div>
                            {selectedContractor.address && (
                                <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                    <span className="text-ui-secondary font-semibold shrink-0">Adres:</span>
                                    <span className="text-right text-ui-black font-medium">{selectedContractor.address}</span>
                                </div>
                            )}
                            {selectedContractor.email && (
                                <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                    <span className="text-ui-secondary font-semibold">E-mail:</span>
                                    <a href={`mailto:${selectedContractor.email}`} className="text-ui-primary hover:underline font-medium">{selectedContractor.email}</a>
                                </div>
                            )}
                            {selectedContractor.phone && (
                                <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                    <span className="text-ui-secondary font-semibold">Telefon:</span>
                                    <span className="text-ui-black font-medium">{selectedContractor.phone}</span>
                                </div>
                            )}
                            {selectedContractor.contactPerson && (
                                <div className="flex justify-between border-b border-ui-accent/30 pb-2">
                                    <span className="text-ui-secondary font-semibold">Osoba kontaktowa:</span>
                                    <span className="text-ui-black font-medium">{selectedContractor.contactPerson}</span>
                                </div>
                            )}
                            {selectedContractor.notes && (
                                <div className="bg-ui-accent/10 border border-ui-accent/40 rounded-xl p-3 text-xs mt-4">
                                    <p className="font-bold text-ui-secondary mb-1">Uwagi wewnętrzne:</p>
                                    <p className="text-ui-black/80 whitespace-pre-wrap">{selectedContractor.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: Kreator */}
            <AddContractorModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveContractor}
            />

        </div>
    );
}

// =========================================================================
// PODKOMPONENT: AddContractorModal (Formularz Prisma Contractor)
// =========================================================================
interface AddContractorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Contractor, "id" | "createdAt">) => void;
}

function AddContractorModal({ isOpen, onClose, onSave }: AddContractorModalProps) {
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

        onClose();
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
                        className="p-2 hover:bg-ui-accent rounded-full text-ui-black/50 hover:text-ui-black transition-colors"
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
                                    className={`py-2 rounded-lg text-xs font-bold transition-all duration-200
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
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-ui-secondary text-ui-primary font-semibold hover:bg-ui-accent/20 transition-colors text-sm"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-6 py-2.5 rounded-xl font-semibold shadow-sm transition-colors text-sm"
                        >
                            <Save size={16} />
                            Zapisz w bazie
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}