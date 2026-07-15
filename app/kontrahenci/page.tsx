"use client";

import React, { useState } from "react";
import { Plus, Search, Phone, Mail, MapPin, Package, FileText, X, UserIcon } from "lucide-react";

// 1. Rozbudowane mock dane - dodano pole "typ" oraz Nabywców
const mockKontrahenci = [
    {
        id: 1,
        typ: "DOSTAWCA",
        nazwa: "Młyn Nowofalowy S.A.",
        nip: "1234567890",
        telefon: "+48 601 234 567",
        email: "zamowienia@mlynnowofalowy.pl",
        adresUlica: "Ul. Młyńska 12",
        adresKod: "00-001",
        adresMiejscowosc: "Warszawa",
        adresKraj: "Polska",
        osobaKontaktowa: "Maria Nowak",
        ostatniaDostawa: "10.07.2026",
        warunkiPlatnosci: "Przelew 14 dni",
        kontoBankowe: "PL 12 1140 2004 0000 3002 0123 4567"
    },
    {
        id: 2,
        typ: "DOSTAWCA",
        nazwa: "Spółdzielnia Mleczarska Wiejskie Eko",
        telefon: "+48 502 987 654",
        nip: "8765432109",
        email: "biuro@wiejskieeko.pl",
        adresUlica: "Ul. Kasztanowa 54",
        adresKod: "00-001",
        adresMiejscowosc: "Warszawa",
        adresKraj: "Polska",
        osobaKontaktowa: "Karolina Kowalska",
        ostatniaDostawa: "08.07.2026",
        warunkiPlatnosci: "Przelew 7 dni",
        kontoBankowe: "PL 98 1020 4027 0000 1002 0345 6789"
    },
    {
        id: 3,
        typ: "NABYWCA",
        nazwa: "Sklep Spożywczy U Krysi",
        telefon: "+48 555 111 222",
        nip: "9988776655",
        email: "sklep.krysia@gmail.com",
        adresUlica: "Ul. Słoneczna 17",
        adresKod: "00-001",
        adresMiejscowosc: "Warszawa",
        adresKraj: "Polska",
        osobaKontaktowa: "Krystyna Bąk",
        ostatniaDostawa: "12.07.2026",
        warunkiPlatnosci: "Przelew 7 dni",
        kontoBankowe: "PL 11 2222 3333 4444 5555 6666 7777"
    },
    {
        id: 4,
        typ: "DOSTAWCA",
        nazwa: "Hurtownia Bakal-Max",
        telefon: "+48 733 445 566",
        nip: "5544332211",
        email: "m.wisniewski@bakalmax.pl",
        adresUlica: "Ul. Bakaliowa 4",
        adresKod: "00-001",
        adresMiejscowosc: "Warszawa",
        adresKraj: "Polska",
        osobaKontaktowa: "Mariusz Wiśniewski",
        ostatniaDostawa: "28.06.2026",
        warunkiPlatnosci: "Gotówka przy odbiorze",
        kontoBankowe: "Brak danych"
    },
    {
        id: 5,
        typ: "NABYWCA",
        nazwa: "Restauracja Złoty Róg",
        telefon: "+48 666 777 888",
        nip: "1122112211",
        email: "faktury@zlotyrog.pl",
        adresUlica: "Ul. Smaczna 25",
        adresKod: "00-001",
        adresMiejscowosc: "Warszawa",
        adresKraj: "Polska",
        osobaKontaktowa: "Tomasz Kowalczyk",
        ostatniaDostawa: "13.07.2026",
        warunkiPlatnosci: "Przelew 14 dni",
        kontoBankowe: "PL 99 8888 7777 6666 5555 4444 3333"
    },
    {
        id: 6,
        typ: "DOSTAWCA",
        nazwa: "EcoCukier Sp. z o.o.",
        telefon: "+48 667 112 233",
        email: "kontakt@ecocukier.com",
        adresUlica: "Ul. Słodka 8",
        adresKod: "00-001",
        adresMiejscowosc: "Warszawa",
        adresKraj: "Polska",
        osobaKontaktowa: "Andrzej Kasprzak",
        nip: "1122334455",
        ostatniaDostawa: "02.07.2026",
        warunkiPlatnosci: "Przelew 30 dni",
        kontoBankowe: "PL 44 1160 2202 0000 0003 1234 5678"
    },
];

type Kontrahent = typeof mockKontrahenci[0];
type FilterType = "WSZYSCY" | "NABYWCA" | "DOSTAWCA";

export default function DostawcyPage() {
    const [selectedSupplier, setSelectedSupplier] = useState<Kontrahent | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterType>("WSZYSCY");

    // Logika zliczania
    const countWszyscy = mockKontrahenci.length;
    const countNabywcy = mockKontrahenci.filter(k => k.typ === "NABYWCA").length;
    const countDostawcy = mockKontrahenci.filter(k => k.typ === "DOSTAWCA").length;

    // Logika filtrowania listy
    const filteredKontrahenci = mockKontrahenci.filter(k => {
        if (activeFilter === "WSZYSCY") return true;
        return k.typ === activeFilter;
    });

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary relative pb-10">

            {/* Nagłówek strony */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Dostawcy i Nabywcy
                    </h1>
                </div>

                <button className="flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm w-full sm:w-auto">
                    <Plus size={18} />
                    Dodaj kontrahenta
                </button>
            </div>

            {/* Przełącznik (Segmented Control) wg screenshota */}
            <div className="mb-6 overflow-x-auto pb-2 sm:pb-0">
                <div className="inline-flex items-center p-1 bg-ui-accent/15 rounded-xl">
                    <button
                        onClick={() => setActiveFilter("WSZYSCY")}
                        className={`flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeFilter === "WSZYSCY"
                            ? "bg-ui-white text-ui-primary shadow-sm"
                            : "text-ui-primary/60 hover:text-ui-primary/80"
                            }`}
                    >
                        Wszyscy <span className="font-normal opacity-60">({countWszyscy})</span>
                    </button>

                    <button
                        onClick={() => setActiveFilter("NABYWCA")}
                        className={`flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeFilter === "NABYWCA"
                            ? "bg-ui-white text-ui-primary shadow-sm"
                            : "text-ui-primary/60 hover:text-ui-primary/80"
                            }`}
                    >
                        Nabywcy <span className="font-normal opacity-60">({countNabywcy})</span>
                    </button>

                    <button
                        onClick={() => setActiveFilter("DOSTAWCA")}
                        className={`flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeFilter === "DOSTAWCA"
                            ? "bg-ui-white text-ui-primary shadow-sm"
                            : "text-ui-primary/60 hover:text-ui-primary/80"
                            }`}
                    >
                        Dostawcy <span className="font-normal opacity-60">({countDostawcy})</span>
                    </button>
                </div>
            </div>

            {/* Pasek wyszukiwania */}
            <div className="bg-ui-white rounded-2xl p-4 shadow-sm border border-ui-accent flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 text-ui-black/50" size={18} />
                    <input
                        type="text"
                        placeholder="Szukaj po nazwie lub NIP-ie..."
                        className="w-full bg-ui-white pl-10 pr-4 py-3 rounded-xl border border-ui-accent text-sm focus:outline-none focus:border-ui-secondary placeholder-ui-primary/50"
                    />
                </div>
            </div>

            {/* Siatka z kartami dostawców */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredKontrahenci.map((kontrahent) => (
                    <div
                        key={kontrahent.id}
                        onClick={() => setSelectedSupplier(kontrahent)}
                        className="bg-ui-white rounded-2xl p-6 shadow-sm border border-ui-accent hover:border-ui-secondary hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
                    >
                        {/* Tag wskazujący typ (Nabywca/Dostawca) */}
                        <div className="mb-3">
                            <span className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${kontrahent.typ === 'DOSTAWCA' ? 'bg-ui-secondary/10 text-ui-secondary' : 'bg-ui-primary/10 text-ui-primary'
                                }`}>
                                {kontrahent.typ}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-ui-primary leading-snug mb-4">
                            {kontrahent.nazwa}
                        </h3>

                        <div className="space-y-2.5 mb-2 text-sm border-t border-ui-accent/30 pt-4">
                            <div className="flex items-center gap-3 text-ui-black">
                                <Phone size={16} className="text-ui-secondary" />
                                <span>{kontrahent.telefon}</span>
                            </div>
                            <div className="flex items-center gap-3 text-ui-black/80 text-xs mt-3">
                                <Mail size={16} className="text-ui-secondary" />
                                <span className="truncate">{kontrahent.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-ui-black/80 text-xs mt-3">
                                <FileText size={16} className="text-ui-secondary" />
                                <span>NIP: {kontrahent.nip}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Komunikat gdy lista jest pusta */}
                {filteredKontrahenci.length === 0 && (
                    <div className="col-span-full py-10 text-center text-ui-primary/60">
                        Brak kontrahentów w tej kategorii.
                    </div>
                )}
            </div>

            {/* DUŻE WYSKAKUJĄCE OKNO (MODAL) */}
            {selectedSupplier && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">

                    {/* Przyciemnione tło */}
                    <div
                        className="absolute inset-0 bg-ui-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setSelectedSupplier(null)}
                    />

                    {/* Kontener Modala */}
                    <div className="relative bg-ui-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

                        {/* Nagłówek Modala */}
                        <div className="px-6 py-5 border-b border-ui-accent flex items-start justify-between bg-ui-white">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${selectedSupplier.typ === 'NABYWCA' ? 'bg-ui-secondary/10 text-ui-secondary' : 'bg-ui-primary/10 text-ui-primary'
                                        }`}>
                                        {selectedSupplier.typ}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-ui-black pr-4">
                                    {selectedSupplier.nazwa}
                                </h2>
                                <div className="flex items-center gap-2 text-sm text-ui-black/60 mt-1">
                                    <FileText size={14} />
                                    <span>NIP: {selectedSupplier.nip}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedSupplier(null)}
                                className="p-2 hover:bg-ui-accent rounded-full text-ui-black/50 hover:text-ui-black transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Ciało Modala */}
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="flex items-start gap-3 text-ui-black text-sm">
                                    <Phone size={18} className="text-ui-secondary shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Telefon</p>
                                        <p className="text-ui-black/80">{selectedSupplier.telefon}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 text-ui-black text-sm">
                                    <Mail size={18} className="text-ui-secondary shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">E-mail</p>
                                        <p className="text-ui-black/80 truncate">{selectedSupplier.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 text-ui-black text-sm">
                                    <UserIcon size={18} className="text-ui-secondary shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Osoba kontaktowa</p>
                                        <p className="text-ui-black/80">{selectedSupplier.osobaKontaktowa}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 text-ui-black text-sm">

                                    <MapPin size={18} className="text-ui-secondary shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Adres</p>
                                        <p className="text-ui-black/80">{selectedSupplier.adresUlica}, {selectedSupplier.adresKod} {selectedSupplier.adresMiejscowosc}</p>
                                    </div>
                                </div>
                            </div>


                        </div>

                        {/* Stopka Modala z przyciskami */}
                        <div className="px-6 py-4 bg-ui-accent/10 border-t border-ui-accent flex flex-col sm:flex-row justify-end gap-3">
                            <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-white border border-ui-secondary text-ui-primary px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-ui-accent transition-colors shadow-sm">
                                <Package size={16} />
                                Zobacz ofertę
                            </button>
                            <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-primary text-ui-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-ui-primary/90 transition-opacity shadow-sm">
                                <FileText size={16} />
                                Przeglądaj faktury
                            </button>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
} 