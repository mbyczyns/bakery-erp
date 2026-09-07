"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Loader2, Package, TrendingUp,
    ShoppingCart, Medal, History, Truck, Scale,
    ChevronDown, ChevronUp, CalendarDays, BarChart3,
    Sparkles, ArrowRight
} from "lucide-react";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import IngredientConsumptionModal from "./IngredientConsumptionModal";

// Helper do formatowania daty: YYYY-MM-DD -> DD-MM-YYYY
function formatDate(dateStr?: string | Date | null): string {
    if (!dateStr || dateStr === "-") return "-";
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

export default function SkladnikDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const router = useRouter();
    const { id } = React.use(params);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);

    useEffect(() => {
        const fetchIngredientDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/skladniki/${id}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setError("Nie znaleziono wybranego składnika.");
                    } else {
                        const errJson = await res.json().catch(() => ({}));
                        setError(errJson.error || "Wystąpił błąd podczas ładowania danych.");
                    }
                    setData(null);
                    return;
                }
                const responseData = await res.json();
                setData(responseData);
            } catch (err) {
                console.error("Błąd ładowania szczegółów:", err);
                setError("Nie udało się połączyć z serwerem.");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchIngredientDetails();
        }
    }, [id]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-ui-white flex items-center justify-center pb-20">
                <div className="flex flex-col items-center gap-3 text-ui-secondary">
                    <Loader2 size={32} className="animate-spin text-emerald-600" />
                    <p className="font-medium">Analizowanie danych składnika...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-ui-white text-ui-primary pb-20 pt-10 flex flex-col items-center justify-center">
                <p className="text-ui-secondary font-medium mb-4">{error || "Nie znaleziono składnika"}</p>
                <button
                    onClick={() => router.push("/skladniki")}
                    className="flex items-center gap-2 text-ui-primary hover:text-emerald-700 font-semibold text-sm transition-colors cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    Powrót do bazy składników
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20">
            {/* Przycisk powrotu */}
            <button
                onClick={() => router.push("/skladniki")}
                className="flex items-center gap-2 text-ui-secondary hover:text-ui-primary font-semibold text-sm mb-6 transition-colors cursor-pointer"
            >
                <ArrowLeft size={16} />
                Powrót do bazy składników
            </button>

            {/* Nagłówek i główne statystyki (KPIs) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-3 bg-ui-accent/10 border border-ui-accent rounded-2xl p-6 flex items-start gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-ui-black tracking-tight">
                                {data.name}
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs font-bold text-ui-secondary bg-white px-3 py-1 rounded-lg border border-ui-accent shadow-sm tracking-wider">
                                    {data.type}
                                </span>
                                <span className="text-xs font-semibold text-ui-primary bg-white/80 px-2.5 py-1 rounded-lg border border-ui-accent/50">
                                    Jednostka: <strong>{data.unit}</strong>
                                </span>
                                {data.stats?.avgDailyLast30Days > 0 && (
                                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                        Śr. dzienne (30 dni): <strong>{data.stats.avgDailyLast30Days} {data.unit}</strong>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 col-span-2 gap-6 mb-6">
                <div className="bg-white border border-ui-accent rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
                    <div className="p-5 border-b border-ui-accent bg-emerald-50/30">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                            <Truck size={16} /> Dostawcy
                        </h3>
                    </div>
                    <div className="p-3 flex-1">
                        {data.suppliersRanking && data.suppliersRanking.length > 0 ? (
                            data.suppliersRanking.map((sup: any, index: number) => (
                                <div key={sup.id} className={`flex items-center justify-between p-3 rounded-xl mb-1.5 ${sup.isBest ? "bg-emerald-50 border border-emerald-100" : "hover:bg-ui-accent/5"}`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {sup.isBest && <span className="flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] font-black">1</span>}
                                            {!sup.isBest && <span className="flex items-center justify-center w-5 h-5 bg-ui-accent text-ui-secondary rounded-full text-[10px] font-black">{index + 1}</span>}
                                            <span className={`text-sm ${sup.isBest ? "text-emerald-900" : "text-ui-black"}`}>{sup.name}</span>
                                        </div>
                                        <div className="text-[10px] text-ui-secondary font-semibold ml-7 mt-0.5">
                                            Ost. zakup: {sup.lastBuy && sup.lastBuy !== "Brak zakupów" ? formatDate(sup.lastBuy) : "Brak zakupów"}
                                        </div>
                                    </div>
                                    <div className={`font-bold ${sup.isBest ? "text-emerald-600 text-lg" : "text-ui-primary text-base"}`}>
                                        {sup.lastPrice.toFixed(2)} <span className="text-xs font-semibold opacity-70">zł</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-xs text-ui-secondary italic">
                                Brak przypisanych dostawców
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-ui-accent col-span-2 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
                    <div className="p-5 border-b border-ui-accent flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                            <History size={16} /> Historia zakupów
                        </h3>
                        {data.deliveriesHistory && data.deliveriesHistory.length > 0 && (
                            <span className="text-[11px] font-semibold text-ui-secondary bg-ui-accent/20 px-2 py-0.5 rounded-full">
                                {data.deliveriesHistory.length} {data.deliveriesHistory.length === 1 ? "wpis" : "wpisów"}
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider">
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Dostawca</th>
                                    <th className="p-4 text-center">Ilość</th>
                                    <th className="p-4 text-right">Cena Netto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/40">
                                {data.deliveriesHistory && data.deliveriesHistory.length > 0 ? (
                                    (showAllHistory ? data.deliveriesHistory : data.deliveriesHistory.slice(0, 5)).map((del: any) => (
                                        <tr key={del.id} className="hover:bg-ui-accent/5 transition-colors">
                                            <td className="p-4 font-semibold text-ui-black">{formatDate(del.date)}</td>
                                            <td className="p-4 text-ui-primary">
                                                <div className="truncate max-w-[250px]" title={del.supplier}>
                                                    {del.supplier}
                                                </div>
                                                <div className="text-[10px] text-ui-secondary font-mono mt-0.5">{del.doc}</div>
                                            </td>
                                            <td className="p-4 text-center text-ui-black whitespace-nowrap">{del.quantity} {data.unit}</td>
                                            <td className="p-4 text-right font-bold text-ui-black whitespace-nowrap">{del.price.toFixed(2)} zł</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-xs text-ui-secondary italic">
                                            Brak historii zakupów dla tego składnika
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Przycisk Pokaż więcej / Zwiń */}
                    {data.deliveriesHistory && data.deliveriesHistory.length > 5 && (
                        <div className="p-3 border-t border-ui-accent bg-ui-white flex items-center justify-center">
                            <button
                                onClick={() => setShowAllHistory(!showAllHistory)}
                                className="inline-flex items-center gap-1.5 text-xs text-ui-primary hover:text-black py-1.5 px-4 rounded-xl border border-ui-accent hover:bg-ui-accent/15 transition-all cursor-pointer shadow-sm"
                            >
                                {showAllHistory ? (
                                    <>
                                        <ChevronUp size={14} /> Pokaż mniej
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={14} /> Pokaż więcej ({data.deliveriesHistory.length - 5})
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* SEKCJA WYKRESÓW (1/3 i 2/3 szerokości) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

                {/* Uproszczony wykres cen (1/3 szerokości) */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-sm lg:col-span-1">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2 mb-6">
                        <TrendingUp size={16} /> Średni trend cen
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.priceHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `${value.toFixed(2)}`} />

                                <Tooltip
                                    formatter={(value: number) => [`${value.toFixed(2)} zł`, "Średnia cena"]}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontWeight: 'bold', fontSize: '12px' }}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="avgPrice"
                                    stroke="#265ff0ff"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: '#265ff0ff', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Zużycie vs Zakupy (2/3 szerokości) */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <Scale size={16} /> Zużycie / Zakupy
                            </h3>
                            <button
                                onClick={() => setIsConsumptionModalOpen(true)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                            >
                                <BarChart3 size={14} />
                                Szczegóły
                                <ArrowRight size={13} />
                            </button>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.volumeHistory} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />

                                    <Tooltip
                                        cursor={{ fill: 'rgba(229, 231, 235, 0.4)' }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontWeight: 'bold', fontSize: '12px' }}
                                        formatter={(value: number, name: string) => {
                                            if (name === "consumed") return [`${value} ${data.unit}`, "Zużyto"];
                                            if (name === "purchased") return [`${value} ${data.unit}`, "Zakupiono"];
                                            return [value, name];
                                        }}
                                    />

                                    <Legend
                                        wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: '500' }}
                                        iconType="circle"
                                        formatter={(value) => {
                                            if (value === "consumed") return "Zużyto";
                                            if (value === "purchased") return "Zakupiono";
                                            return value;
                                        }}
                                    />

                                    <Bar dataKey="consumed" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="purchased" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>

            {/* MODAL SZCZEGÓŁOWEGO PODGLĄDU ZUŻYCIA */}
            <IngredientConsumptionModal
                isOpen={isConsumptionModalOpen}
                onClose={() => setIsConsumptionModalOpen(false)}
                ingredientName={data.name}
                unit={data.unit}
                type={data.type}
                dailyHistory={data.dailyHistory || []}
                weeklyHistory={data.weeklyHistory || []}
                monthlyHistory={data.monthlyHistory || []}
                productRanking={data.productRanking || []}
            />
        </div>
    );
}