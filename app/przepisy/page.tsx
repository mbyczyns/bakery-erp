"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Wheat,
    Croissant,
    Pizza,
    FileText,
    Search,
    X,
    Scale,
    Plus,
    Trash2,
    Save,
    Tag,
    Hamburger,
    Layers
} from "lucide-react";

// =========================================================================
// 1. STRUKTURA PRODUKTÓW ZGODNA Z PRISMA (SUROWCE / BAZA PRODUKTÓW)
// =========================================================================
const mockProductsDb = [
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445501",
        name: "Mąka pszenna typ 750",
        price: 3.20,
        unit: "kg",
        supplierId: "mlyn-nowofalowy-uuid",
        createdAt: new Date("2026-07-01")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445502",
        name: "Mąka żytnia typ 2000",
        price: 3.50,
        unit: "kg",
        supplierId: "mlyn-nowofalowy-uuid",
        createdAt: new Date("2026-07-01")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445503",
        name: "Drożdże świeże",
        price: 12.00,
        unit: "kg",
        supplierId: "mleczarnia-eko-uuid",
        createdAt: new Date("2026-07-02")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445504",
        name: "Sól kamienna drobna",
        price: 1.50,
        unit: "kg",
        supplierId: "bakal-max-uuid",
        createdAt: new Date("2026-06-28")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445505",
        name: "Masło ekstra 82%",
        price: 32.00,
        unit: "kg",
        supplierId: "mleczarnia-eko-uuid",
        createdAt: new Date("2026-07-05")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445506",
        name: "Cukier biały kryształ",
        price: 4.50,
        unit: "kg",
        supplierId: "ecocukier-uuid",
        createdAt: new Date("2026-07-04")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445507",
        name: "Woda wodociągowa",
        price: 0.10,
        unit: "l",
        supplierId: "inne-media-uuid",
        createdAt: new Date("2026-01-01")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445508",
        name: "Mleko spożywcze 3.2%",
        price: 3.00,
        unit: "l",
        supplierId: "mleczarnia-eko-uuid",
        createdAt: new Date("2026-07-05")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445509",
        name: "Żółtka jaj kurzych",
        price: 0.80,
        unit: "szt",
        supplierId: "mleczarnia-eko-uuid",
        createdAt: new Date("2026-07-06")
    },
    {
        id: "e6f9b8c0-82a1-4d9f-bd93-112233445510",
        name: "Konfitura z dzikiej róży",
        price: 15.00,
        unit: "kg",
        supplierId: "bakal-max-uuid",
        createdAt: new Date("2026-07-01")
    },
];

// =========================================================================
// 2. TYPY DLA TYPESCRIPTU
// =========================================================================
type Skladnik = { nazwa: string; ilosc: string; jednostka: string };
type Produkt = {
    id: number;
    nazwa: string;
    standardowyWypiek: number;
    foodcostSztuka: number;
    cena: number;
    skladnikiNaSztuke: Skladnik[]
};

// Początkowe dane receptur
const poczatkoweReceptury = [
    {
        kategoria: "Chleby",
        ikona: Wheat,
        produkty: [
            {
                id: 101, nazwa: "Chleb Wiejski 500g", standardowyWypiek: 60, foodcostSztuka: 1.85, cena: 5.99,
                skladnikiNaSztuke: [
                    { nazwa: "Mąka pszenna typ 750", ilosc: "0.350", jednostka: "kg" },
                    { nazwa: "Woda wodociągowa", ilosc: "0.200", jednostka: "l" },
                    { nazwa: "Sól kamienna drobna", ilosc: "0.010", jednostka: "kg" }
                ]
            },
            {
                id: 102, nazwa: "Chleb Żytni 100%", standardowyWypiek: 40, foodcostSztuka: 2.15, cena: 5.99,
                skladnikiNaSztuke: [
                    { nazwa: "Mąka żytnia typ 2000", ilosc: "0.400", jednostka: "kg" },
                    { nazwa: "Woda wodociągowa", ilosc: "0.250", jednostka: "l" },
                    { nazwa: "Sól kamienna drobna", ilosc: "0.012", jednostka: "kg" }
                ]
            },
        ],
    },
    {
        kategoria: "Bułki",
        ikona: Hamburger,
        produkty: [
            {
                id: 201, nazwa: "Kajzerka Tradycyjna", standardowyWypiek: 300, foodcostSztuka: 0.28, cena: 0.99,
                skladnikiNaSztuke: [
                    { nazwa: "Mąka pszenna typ 750", ilosc: "0.050", jednostka: "kg" },
                    { nazwa: "Woda wodociągowa", ilosc: "0.025", jednostka: "l" },
                    { nazwa: "Drożdże świeże", ilosc: "0.002", jednostka: "kg" }
                ]
            },
        ],
    },
    {
        kategoria: "Słodkie wypieki",
        ikona: Croissant,
        produkty: [
            {
                id: 301, nazwa: "Pączek z konfiturą", standardowyWypiek: 100, foodcostSztuka: 1.12, cena: 3.99,
                skladnikiNaSztuke: [
                    { nazwa: "Mąka pszenna typ 750", ilosc: "0.045", jednostka: "kg" },
                    { nazwa: "Mleko spożywcze 3.2%", ilosc: "0.020", jednostka: "l" },
                    { nazwa: "Masło ekstra 82%", ilosc: "0.010", jednostka: "kg" },
                    { nazwa: "Żółtka jaj kurzych", ilosc: "0.5", jednostka: "szt" },
                    { nazwa: "Konfitura z dzikiej róży", ilosc: "0.025", jednostka: "kg" }
                ]
            },
        ],
    },
    {
        kategoria: "Półprodukty",
        ikona: Layers,
        produkty: [
            {
                id: 501, nazwa: "Zakwas żytni (baza)", standardowyWypiek: 5, foodcostSztuka: 1.80, cena: 0.00,
                skladnikiNaSztuke: [
                    { nazwa: "Mąka żytnia typ 2000", ilosc: "0.500", jednostka: "kg" },
                    { nazwa: "Woda wodociągowa", ilosc: "0.500", jednostka: "l" }
                ]
            }
        ]
    }
];

export default function RecepturyPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<Produkt | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [receptury, setReceptury] = useState(poczatkoweReceptury);

    const pofiltrowaneMenu = receptury.map(sekcja => ({
        ...sekcja,
        produkty: sekcja.produkty.filter(produkt =>
            produkt.nazwa.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(sekcja => sekcja.produkty.length > 0);

    const handleSaveRecipe = (newRecipeData: any) => {
        let lacznyKosztPartii = 0;

        newRecipeData.ingredients.forEach((ing: any) => {
            const surowiecDb = mockProductsDb.find(s => s.id === ing.productId);
            if (surowiecDb) {
                lacznyKosztPartii += (parseFloat(ing.amount) || 0) * surowiecDb.price;
            }
        });

        const obliczonyFoodcostSztuki = lacznyKosztPartii / (newRecipeData.standardBatch || 1);

        const skladnikiNaSztuke = newRecipeData.ingredients.map((ing: any) => {
            const surowiecDb = mockProductsDb.find(s => s.id === ing.productId);
            const iloscNaSztuke = (parseFloat(ing.amount) || 0) / (newRecipeData.standardBatch || 1);
            return {
                nazwa: surowiecDb ? surowiecDb.name : "Nieznany składnik",
                ilosc: iloscNaSztuke.toFixed(3).replace(/\.?0+$/, ""),
                jednostka: ing.unit
            };
        });

        const nowyProdukt: Produkt = {
            id: Date.now(),
            nazwa: newRecipeData.name,
            standardowyWypiek: newRecipeData.standardBatch,
            foodcostSztuka: obliczonyFoodcostSztuki,
            cena: newRecipeData.sellingPrice,
            skladnikiNaSztuke: skladnikiNaSztuke
        };

        setReceptury(prevReceptury =>
            prevReceptury.map(sekcja => {
                if (sekcja.kategoria === newRecipeData.category) {
                    return {
                        ...sekcja,
                        produkty: [...sekcja.produkty, nowyProdukt]
                    };
                }
                return sekcja;
            })
        );
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">

            {/* Nagłówek */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">Przepisy i Foodcost</h1>
                    <p className="text-ui-black text-sm mt-1">
                        Zarządzaj składem wyrobów i monitoruj koszty produkcji.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            console.log("kliknięto")
                            setIsAddModalOpen(true)
                        }}
                        className="flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm w-full sm:w-auto"
                    >
                        <FileText size={18} />
                        <span>Składniki</span>
                    </button>
                    <button
                        onClick={() => {
                            console.log("kliknięto")
                            setIsAddModalOpen(true)
                        }}
                        className="flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm w-full sm:w-auto"
                    >
                        <FileText size={18} />
                        <span>Nowy przepis</span>
                    </button>
                </div>
            </div>

            {/* Wyszukiwarka */}
            <div className="relative mb-8">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder="Szukaj wyrobu lub półproduktu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3.5 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                />
            </div>

            {/* Renderowanie listy */}
            <div className="space-y-8">
                {pofiltrowaneMenu.length === 0 ? (
                    <div className="text-center py-10 text-ui-secondary">
                        Nie znaleziono żadnych pozycji.
                    </div>
                ) : (
                    pofiltrowaneMenu.map((sekcja) => {
                        const Icon = sekcja.ikona;
                        const jestPolproduktem = sekcja.kategoria === "Półprodukty";

                        return (
                            <div key={sekcja.kategoria} className="animate-fade-in">
                                <div className="flex items-center gap-3 mb-4 border-b border-ui-accent pb-2">
                                    <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                                        <Icon size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold text-ui-black">{sekcja.kategoria}</h2>
                                </div>

                                <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                                    {sekcja.produkty.map((produkt, index) => (
                                        <div
                                            key={produkt.id}
                                            onClick={() => setSelectedProduct(produkt)}
                                            className={`flex items-center justify-between p-4 cursor-pointer hover:bg-ui-accent/10 transition-colors
                                                ${index !== sekcja.produkty.length - 1 ? 'border-b border-ui-accent' : ''}
                                            `}
                                        >
                                            <div>
                                                <h3 className="font-semibold text-ui-primary">{produkt.nazwa}</h3>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-[10px] uppercase font-bold text-ui-secondary">
                                                        {jestPolproduktem ? "Koszt wytworzenia (1 kg/l)" : "Koszt produkcji 1 szt."}
                                                    </p>
                                                    <p className="font-bold text-ui-primary">{produkt.foodcostSztuka.toFixed(2)} zł</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 hidden sm:block">
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold text-ui-secondary">Cena detaliczna</p>
                                                    <p className="font-bold text-ui-primary">
                                                        {jestPolproduktem ? "—" : `${produkt.cena.toFixed(2)} zł`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* MODAL 1: Szczegóły przepisu */}
            {selectedProduct && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedProduct(null)}
                >
                    <div
                        className="bg-ui-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-ui-accent"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-ui-white border-b border-ui-accent p-5 flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-ui-primary">{selectedProduct.nazwa}</h2>
                                <div className="flex items-center gap-1 text-xs text-ui-secondary mt-1">
                                    <Scale size={14} />
                                    <span>Standardowa szarża przepisu: {selectedProduct.standardowyWypiek} szt. / kg</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="p-2 bg-ui-accent/20 hover:bg-ui-accent/40 text-ui-primary rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="bg-ui-accent/10 border border-ui-accent rounded-xl p-4 flex items-center justify-between mb-6">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-ui-secondary">
                                        Koszt surowców (jednostkowy)
                                    </span>
                                    <div className="flex items-baseline gap-1 text-ui-primary">
                                        <span className="text-3xl font-extrabold">{selectedProduct.foodcostSztuka.toFixed(2)}</span>
                                        <span className="text-sm font-semibold">zł</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-ui-secondary">
                                        Cena detaliczna
                                    </span>
                                    <div className="flex items-baseline gap-1 text-ui-primary">
                                        <span className="text-3xl font-extrabold">
                                            {selectedProduct.cena > 0 ? selectedProduct.cena.toFixed(2) : "—"}
                                        </span>
                                        {selectedProduct.cena > 0 && <span className="text-sm font-semibold">zł</span>}
                                    </div>
                                </div>
                            </div>

                            <h4 className="text-xs font-bold uppercase tracking-wider text-ui-secondary mb-4">
                                Proporcje na jednostkę wyjściową
                            </h4>
                            <ul className="space-y-3">
                                {selectedProduct.skladnikiNaSztuke.map((skladnik, index) => (
                                    <li key={index} className="flex justify-between items-end border-b border-dashed border-ui-accent pb-1.5">
                                        <span className="text-sm text-ui-primary font-medium">{skladnik.nazwa}</span>
                                        <div className="text-sm">
                                            <span className="font-bold text-ui-primary">{skladnik.ilosc}</span>
                                            <span className="text-ui-secondary ml-1">{skladnik.jednostka}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-8 flex gap-3">
                                <button className="flex-1 bg-ui-white border border-ui-accent hover:bg-ui-accent/20 text-ui-primary text-sm font-medium py-3 rounded-xl transition-colors">
                                    Edytuj przepis
                                </button>
                                <button className="flex-1 bg-ui-primary hover:bg-ui-primary/90 text-ui-white text-sm font-medium py-3 rounded-xl transition-colors shadow-sm">
                                    Przelicz na partię
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: Kreator przepisu */}
            <AddRecipeModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveRecipe}
            />

        </div>
    );
}

// =========================================================================
// PODKOMPONENT: AddRecipeModal (Z WYSZUKIWARKĄ SUROWCÓW IN-LINE / AUTOCOMPLETE)
// =========================================================================
interface AddRecipeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newRecipe: any) => void;
}

// Interfejs opisujący pojedynczy wiersz dynamicznego przepisu
interface FormSkladnik {
    productId: string;    // Wybrane ID z mockProductsDb
    searchText: string;   // Aktualny ciąg wpisany w wyszukiwarkę wiersza
    amount: string;       // Wpisana ilość
    unit: string;         // Zaciągnięta jednostka miary
    isDropdownOpen: boolean; // Kontrola wyświetlania panelu podpowiedzi
}

function AddRecipeModal({ isOpen, onClose, onSave }: AddRecipeModalProps) {
    const [nazwa, setNazwa] = useState("");
    const [cenaSprzedazy, setCenaSprzedazy] = useState("");
    const [kategoria, setKategoria] = useState("Chleby");
    const [standardBatch, setStandardBatch] = useState<number>(1);

    // Dynamiczna lista składników z nową strukturą autouzupełniania
    const [skladniki, setSkladniki] = useState<FormSkladnik[]>([
        { productId: "", searchText: "", amount: "", unit: "kg", isDropdownOpen: false }
    ]);

    const modalRef = useRef<HTMLDivElement>(null);

    // Kliknięcie poza panelem podpowiedzi zamyka wszystkie listy autocomplete
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                setSkladniki(prev => prev.map(s => ({ ...s, isDropdownOpen: false })));
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isOpen) return null;

    // Obsługa wpisywania tekstu w wyszukiwarkę danego wiersza
    const handleSearchTextChange = (index: number, val: string) => {
        const noweSkladniki = [...skladniki];
        noweSkladniki[index].searchText = val;
        noweSkladniki[index].isDropdownOpen = true;

        // Jeśli użytkownik skasował tekst, czyścimy też przypisany produkt
        if (val === "") {
            noweSkladniki[index].productId = "";
        }
        setSkladniki(noweSkladniki);
    };

    // Wybranie produktu z listy wyszukiwarki
    const handleSelectProduct = (index: number, product: typeof mockProductsDb[0]) => {
        const noweSkladniki = [...skladniki];
        noweSkladniki[index].productId = product.id;
        noweSkladniki[index].searchText = product.name;
        noweSkladniki[index].unit = product.unit;
        noweSkladniki[index].isDropdownOpen = false;
        setSkladniki(noweSkladniki);
    };

    // Obsługa zmiany ilości
    const handleIloscChange = (index: number, amount: string) => {
        const noweSkladniki = [...skladniki];
        noweSkladniki[index].amount = amount;
        setSkladniki(noweSkladniki);
    };

    const handleDodajSkladnik = () => {
        setSkladniki([
            ...skladniki,
            { productId: "", searchText: "", amount: "", unit: "kg", isDropdownOpen: false }
        ]);
    };

    const handleUsunSkladnik = (indexToRemove: number) => {
        if (skladniki.length === 1) return;
        setSkladniki(skladniki.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const recipeData = {
            name: nazwa,
            sellingPrice: kategoria === "Półprodukty" ? 0 : (parseFloat(cenaSprzedazy) || 0),
            standardBatch: standardBatch,
            category: kategoria,
            ingredients: skladniki.filter(s => s.productId && s.amount)
        };

        onSave(recipeData);
        onClose();

        // Reset stanów
        setNazwa("");
        setCenaSprzedazy("");
        setStandardBatch(1);
        setSkladniki([{ productId: "", searchText: "", amount: "", unit: "kg", isDropdownOpen: false }]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="absolute inset-0 bg-ui-black/40 backdrop-blur-sm" onClick={onClose} />

            <div
                ref={modalRef}
                className="relative bg-ui-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-ui-accent"
            >

                <div className="px-6 py-5 border-b border-ui-accent flex items-center justify-between bg-ui-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                            <Plus size={20} className="text-ui-secondary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-ui-black">Nowy przepis (Receptura)</h2>
                            <p className="text-xs text-ui-black/50">Wyszukuj surowce wpisując ich nazwy w pola składników.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-ui-accent rounded-full text-ui-black/50 hover:text-ui-black transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Sekcja podstawowa */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Nazwa przepisu / półproduktu</label>
                            <input
                                type="text"
                                required
                                value={nazwa}
                                onChange={(e) => setNazwa(e.target.value)}
                                placeholder="np. Zakwas żytni / Chleb Wiejski Pradawny"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Kategoria</label>
                            <select
                                value={kategoria}
                                onChange={(e) => setKategoria(e.target.value)}
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary cursor-pointer"
                            >
                                <option value="Chleby">Chleby</option>
                                <option value="Bułki">Bułki</option>
                                <option value="Słodkie wypieki">Słodkie wypieki</option>
                                <option value="Słone wypieki">Słone wypieki</option>
                                <option value="Półprodukty">Półprodukty</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">
                                {kategoria === "Półprodukty" ? "Cena sprzedaży (Nie dotyczy)" : "Cena sprzedaży (brutto)"}
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    required={kategoria !== "Półprodukty"}
                                    disabled={kategoria === "Półprodukty"}
                                    value={kategoria === "Półprodukty" ? "" : cenaSprzedazy}
                                    onChange={(e) => setCenaSprzedazy(e.target.value)}
                                    placeholder={kategoria === "Półprodukty" ? "—" : "0.00"}
                                    className="w-full bg-ui-white border border-ui-accent rounded-xl pl-4 pr-10 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all disabled:opacity-50 disabled:bg-ui-accent/10"
                                />
                                {kategoria !== "Półprodukty" && (
                                    <span className="absolute right-4 top-3 text-sm text-ui-primary/50 pointer-events-none">zł</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Wielkość partii */}
                    <div className="bg-ui-accent/10 border border-ui-accent/40 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <Scale size={20} className="text-ui-secondary shrink-0 mt-0.5" />
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                                <div className="sm:col-span-2">
                                    <h4 className="font-bold text-ui-black text-sm">Wielkość szarży (partii)</h4>
                                    <p className="text-xs text-ui-black/60">
                                        {kategoria === "Półprodukty"
                                            ? "Określ, ile kilogramów / litrów półproduktu uzyskasz z poniższych składników."
                                            : "Określ, na ile sztuk gotowego wyrobu przewidujesz poniższą wagę składników."
                                        }
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-ui-secondary">Przepis na:</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={standardBatch}
                                            onChange={(e) => setStandardBatch(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-full bg-ui-white border border-ui-accent rounded-lg px-3 py-2 text-center text-ui-primary font-bold focus:outline-none focus:border-ui-secondary"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-ui-secondary pointer-events-none">
                                            {kategoria === "Półprodukty" ? "kg/l" : "szt."}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sekcja dynamicznej listy surowców */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-ui-accent/30 pb-2">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-ui-black/60">Składniki i proporcje</h3>
                            <button
                                type="button"
                                onClick={handleDodajSkladnik}
                                className="flex items-center gap-1.5 text-xs font-semibold text-ui-secondary hover:text-ui-primary transition-colors"
                            >
                                <Plus size={16} />
                                Dodaj surowiec
                            </button>
                        </div>

                        {/* Wiersze składników */}
                        <div className="space-y-3">
                            {skladniki.map((skladnik, index) => {
                                // Filtrowanie surowców z bazy w locie na podstawie wpisanego tekstu
                                const pofiltrowaneSurowce = mockProductsDb.filter(s =>
                                    s.name.toLowerCase().includes(skladnik.searchText.toLowerCase())
                                );

                                return (
                                    <div key={index} className="flex items-center gap-3 bg-ui-white border border-ui-accent rounded-xl p-3 shadow-sm hover:border-ui-secondary/50 transition-colors relative">

                                        {/* Wyszukiwarka Autocomplete */}
                                        <div className="flex-1 min-w-[150px] relative">
                                            <input
                                                type="text"
                                                required
                                                placeholder="Wpisz nazwę surowca..."
                                                value={skladnik.searchText}
                                                onFocus={() => {
                                                    const nowe = [...skladniki];
                                                    nowe[index].isDropdownOpen = true;
                                                    setSkladniki(nowe);
                                                }}
                                                onChange={(e) => handleSearchTextChange(index, e.target.value)}
                                                className="w-full bg-ui-white border border-ui-accent rounded-lg px-3 py-2 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary font-medium"
                                            />

                                            {/* Panel podpowiedzi (Dropdown Combobox) */}
                                            {skladnik.isDropdownOpen && skladnik.searchText.length > 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-1.5 bg-ui-white border border-ui-accent rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-ui-accent/40 animate-fade-in">
                                                    {pofiltrowaneSurowce.length > 0 ? (
                                                        pofiltrowaneSurowce.map((s) => (
                                                            <div
                                                                key={s.id}
                                                                onClick={() => handleSelectProduct(index, s)}
                                                                className="px-4 py-2.5 text-xs text-ui-primary hover:bg-ui-accent/15 cursor-pointer flex justify-between items-center transition-colors"
                                                            >
                                                                <span className="font-bold text-ui-black">{s.name}</span>
                                                                <span className="text-ui-secondary/80 font-semibold bg-ui-accent/10 px-2 py-0.5 rounded-md">
                                                                    {s.price.toFixed(2)} zł / {s.unit}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="px-4 py-3 text-xs text-ui-secondary/70 italic bg-ui-white">
                                                            Brak pasujących surowców w bazie
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Pole wpisywania ilości */}
                                        <div className="w-28 sm:w-32 relative shrink-0">
                                            <input
                                                type="number"
                                                step="0.001"
                                                min="0.001"
                                                required
                                                placeholder="Ilość"
                                                value={skladnik.amount}
                                                onChange={(e) => handleIloscChange(index, e.target.value)}
                                                className="w-full bg-ui-white border border-ui-accent rounded-lg pl-3 pr-10 py-2 text-sm text-center font-semibold text-ui-primary focus:outline-none focus:border-ui-secondary"
                                            />
                                            <span className="absolute right-3 top-2 text-xs text-ui-primary/50 pointer-events-none">
                                                {skladnik.unit}
                                            </span>
                                        </div>

                                        {/* Usunięcie wiersza */}
                                        <button
                                            type="button"
                                            onClick={() => handleUsunSkladnik(index)}
                                            disabled={skladniki.length === 1}
                                            className="p-2 text-ui-black/30 hover:text-red-500 disabled:opacity-30 disabled:hover:text-ui-black/30 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                                        >
                                            <Trash2 size={16} />
                                        </button>

                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Przyciski */}
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
                            Stwórz recepturę
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}