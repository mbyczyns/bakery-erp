"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import {
    Plus,
    Search,
    Loader2,
    X,
    Filter,
    ChevronDown
} from "lucide-react";

type IngredientType = "FLOUR" | "FRUIT" | "DAIRY" | "OTHER";
type FilterType = IngredientType | "ALL";

interface Ingredient {
    id: string;
    name: string;
    unit: string;
    type: IngredientType;
    calculatedPrice?: number | string;
    lastSupplierName?: string | null;
    lastPurchaseDate?: string | null;
    lastPurchasePrice?: number | string | null;
}

const TYPE_CONFIG: Record<IngredientType, { label: string; badge: string }> = {
    FLOUR: { label: "Mąka", badge: "bg-amber-50 text-amber-800 border-amber-200" },
    FRUIT: { label: "Owoce / Warzywa", badge: "bg-green-50 text-green-800 border-green-300" },
    DAIRY: { label: "Nabiał", badge: "bg-blue-50 text-blue-800 border-blue-200" },
    OTHER: { label: "Inne", badge: "bg-gray-50 text-gray-700 border-gray-200" }
};

export default function SkladnikiPage() {
    const router = useRouter();
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<FilterType>("ALL");

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newIngredientName, setNewIngredientName] = useState("");
    const [newIngredientUnit, setNewIngredientUnit] = useState("kg");
    const [newIngredientType, setNewIngredientType] = useState<IngredientType>("OTHER");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/skladniki");
            if (res.ok) {
                const data = await res.json();
                setIngredients(data.ingredients || []);
            }
        } catch (error) {
            console.error("Błąd podczas pobierania składników:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredIngredients = ingredients.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = selectedTypeFilter === "ALL" || item.type === selectedTypeFilter;
        return matchesSearch && matchesType;
    });

    const handleAddIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIngredientName.trim()) {
            alert("Wprowadź nazwę składnika");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/skladniki", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newIngredientName.trim(),
                    unit: newIngredientUnit,
                    type: newIngredientType,
                }),
            });

            if (res.ok) {
                setNewIngredientName("");
                setNewIngredientUnit("kg");
                setNewIngredientType("OTHER");
                setIsAddModalOpen(false);
                await fetchData();
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error || "Nie udało się dodać składnika"}`);
            }
        } catch (error) {
            console.error("Błąd podczas zapisywania składnika:", error);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Baza składników
                    </h1>
                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all cursor-pointer"
                >
                    <Plus size={18} />
                    Nowy składnik
                </button>
            </div>

            {/* Wyszukiwarka i filtr typów */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                    <input
                        type="text"
                        placeholder="Wyszukaj ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-ui-white pl-12 pr-4 py-3 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary transition-all text-sm"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select
                            value={selectedTypeFilter}
                            onChange={(e) => setSelectedTypeFilter(e.target.value as FilterType)}
                            className="bg-ui-white border border-ui-accent text-ui-primary text-sm rounded-xl pl-4 pr-10 py-3 shadow-sm focus:outline-none focus:border-ui-secondary transition-all cursor-pointer appearance-none"
                        >
                            <option value="ALL">Wszystkie typy</option>
                            <option value="FLOUR">Mąki</option>
                            <option value="FRUIT">Owoce / Warzywa</option>
                            <option value="DAIRY">Nabiał</option>
                            <option value="OTHER">Inne</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabela składników z kolumną Typ i nowymi polami z faktur */}
            <div className="bg-ui-white border border-ui-accent rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left border-collapse table-fixed">
                        <colgroup>
                            <col style={{ width: "30%" }} />
                            <col style={{ width: "15%" }} />
                            <col style={{ width: "35%" }} />
                            <col style={{ width: "20%" }} />
                        </colgroup>
                        <thead>
                            <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                                <th className="p-4">Nazwa Składnika</th>
                                <th className="p-4">Typ</th>
                                <th className="p-4">Ostatni Dostawca</th>
                                <th className="p-4 text-right">Cena (Jednostkowa)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ui-accent/40 text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-ui-secondary">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={18} className="animate-spin text-emerald-600" />
                                            Pobieranie składników...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredIngredients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-ui-secondary italic">
                                        Nie znaleziono składników.
                                    </td>
                                </tr>
                            ) : (
                                filteredIngredients.map((item) => {
                                    const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG.OTHER;

                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-ui-accent/5 transition-colors cursor-pointer group"
                                            onClick={() => router.push(`/skladniki/${item.id}`)}
                                        >
                                            <td className="p-4 font-bold text-ui-black group-hover:text-ui-primary transition-colors">
                                                <div className="truncate pr-2">
                                                    {item.name}
                                                    <span className="ml-2 text-xs font-normal text-ui-secondary bg-ui-accent/30 px-2 py-0.5 rounded-md">
                                                        {item.unit}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${typeInfo.badge} inline-block whitespace-nowrap`}>
                                                    {typeInfo.label}
                                                </span>
                                            </td>

                                            <td className="p-4 truncate">
                                                {item.lastSupplierName ? (
                                                    <div>
                                                        <div className="font-semibold text-ui-primary truncate">
                                                            {item.lastSupplierName}
                                                        </div>
                                                        {item.lastPurchaseDate && (
                                                            <div className="text-[10px] text-ui-secondary font-medium mt-0.5">
                                                                Ost. zakup: {new Date(item.lastPurchaseDate).toLocaleDateString('pl-PL')}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-ui-secondary italic text-sm">Brak historii</span>
                                                )}
                                            </td>

                                            <td className="p-4 text-right">
                                                {item.calculatedPrice ? (
                                                    <div>
                                                        <div className="font-bold text-ui-black whitespace-nowrap">
                                                            {Number(item.calculatedPrice).toFixed(2)} zł / {item.unit}
                                                        </div>
                                                        {item.lastPurchasePrice && (
                                                            <div className="text-[10px] text-ui-secondary font-medium mt-0.5">
                                                                Ost. faktura: {Number(item.lastPurchasePrice).toFixed(2)} zł
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-ui-secondary">—</span>
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

            {/* Modal dodawania składnika */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsAddModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-ui-accent"
                        onClick={(e) => e.stopPropagation()}
                    >

                        <form onSubmit={handleAddIngredient} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase mb-1.5">
                                    Nazwa
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="np. Mąka Pszenna Typ 750"
                                    value={newIngredientName}
                                    onChange={(e) => setNewIngredientName(e.target.value)}
                                    // Ujednolicona wysokość i zaokrąglenia
                                    className="w-full h-[42px] bg-ui-white border border-ui-accent rounded-xl px-4 text-sm focus:outline-none focus:border-ui-secondary transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary uppercase mb-1.5">
                                        Typ Składnika
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={newIngredientType}
                                            onChange={(e) => setNewIngredientType(e.target.value as IngredientType)}
                                            className="w-full h-[42px] appearance-none bg-ui-white border border-ui-accent rounded-xl pl-4 pr-10 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary cursor-pointer transition-all"
                                        >
                                            <option value="FLOUR">Mąka</option>
                                            <option value="FRUIT">Owoce / Warzywa</option>
                                            <option value="DAIRY">Nabiał</option>
                                            <option value="OTHER">Inne</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary uppercase mb-1.5">
                                        Jednostka Miary
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={newIngredientUnit}
                                            onChange={(e) => setNewIngredientUnit(e.target.value)}
                                            // Dodane h-[42px], appearance-none, pr-10 i pogrubiona czcionka text-sm
                                            className="w-full h-[42px] appearance-none bg-ui-white border border-ui-accent rounded-xl pl-4 pr-10 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary cursor-pointer transition-all"
                                        >
                                            <option value="kg">kg (kilogram)</option>
                                            <option value="l">l (litr)</option>
                                            <option value="szt">szt (sztuka)</option>
                                            <option value="g">g (gram)</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-ui-secondary">
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-ui-accent flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold text-xs hover:bg-ui-accent/30 transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                                    Zapisz
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}