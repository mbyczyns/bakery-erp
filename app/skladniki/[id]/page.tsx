"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Loader2, Package, TrendingUp,
    ShoppingCart, Medal, History, Truck, Scale
} from "lucide-react";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

export default function SkladnikDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const router = useRouter();
    const { id } = React.use(params);

    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        // Tymczasowa symulacja pobierania danych z backendu
        const fetchIngredientDetails = async () => {
            setIsLoading(true);
            try {
                // Symulacja API
                setTimeout(() => {
                    setData({
                        id,
                        name: "Mąka Pszenna Typ 750",
                        type: "Mąka",
                        unit: "kg",
                        stats: {
                            currentPrice: 2.15,
                            priceTrend: "up",
                            avgMonthlyConsumption: 850,
                            bestSupplierName: "Młyny Szczecińskie",
                            bestSupplierPrice: 2.10
                        },
                        // NOWE: Uproszczony trend średniej ceny
                        priceHistory: [
                            { month: "Mar", avgPrice: 2.12 },
                            { month: "Kwi", avgPrice: 2.15 },
                            { month: "Maj", avgPrice: 2.21 },
                            { month: "Cze", avgPrice: 2.23 },
                            { month: "Lip", avgPrice: 2.25 },
                            { month: "Sie", avgPrice: 2.23 },
                        ],
                        // NOWE: Dane do wykresu kolumnowego Zużycie vs Zakupy
                        volumeHistory: [
                            { month: "Mar", consumed: 800, purchased: 900 },
                            { month: "Kwi", consumed: 820, purchased: 800 },
                            { month: "Maj", consumed: 850, purchased: 900 },
                            { month: "Cze", consumed: 900, purchased: 850 },
                            { month: "Lip", consumed: 880, purchased: 1000 },
                            { month: "Sie", consumed: 850, purchased: 650 },
                        ],
                        suppliersRanking: [
                            { id: "s1", name: "Młyny Szczecińskie", lastPrice: 2.10, isBest: true, lastBuy: "2026-08-10" },
                            { id: "s2", name: "Hurtownia MAKRO", lastPrice: 2.25, isBest: false, lastBuy: "2026-07-22" },
                            { id: "s3", name: "P.H.U. Jan Kowalski", lastPrice: 2.30, isBest: false, lastBuy: "2026-05-14" },
                        ],
                        deliveriesHistory: [
                            { id: "d1", date: "2026-08-10", supplier: "Młyny Szczecińskie", doc: "FS 123/08/2026", quantity: 500, price: 2.10 },
                            { id: "d2", date: "2026-07-22", supplier: "Hurtownia MAKRO", doc: "FV/456/26", quantity: 150, price: 2.25 },
                            { id: "d3", date: "2026-07-05", supplier: "Młyny Szczecińskie", doc: "FS 098/07/2026", quantity: 600, price: 2.05 },
                            { id: "d4", date: "2026-06-15", supplier: "Hurtownia MAKRO", doc: "FV/321/26", quantity: 100, price: 2.20 },
                        ]
                    });
                    setIsLoading(false);
                }, 800);
            } catch (error) {
                console.error("Błąd ładowania szczegółów:", error);
                setIsLoading(false);
            }
        };

        fetchIngredientDetails();
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

    if (!data) return null;

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
                                <span className="text-xs font-bold text-ui-secondary bg-white px-3 py-1 rounded-lg border border-ui-accent shadow-sm  tracking-wider">
                                    {data.type}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 col-span-2  gap-6 mb-6">
                <div className="bg-white border border-ui-accent rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
                    <div className="p-5 border-b border-ui-accent bg-emerald-50/30">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                            <Truck size={16} /> Dostawcy
                        </h3>
                    </div>
                    <div className="p-3 flex-1">
                        {data.suppliersRanking.map((sup: any, index: number) => (
                            <div key={sup.id} className={`flex items-center justify-between p-3 rounded-xl mb-1.5 ${sup.isBest ? "bg-emerald-50 border border-emerald-100" : "hover:bg-ui-accent/5"}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        {sup.isBest && <span className="flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] font-black">1</span>}
                                        {!sup.isBest && <span className="flex items-center justify-center w-5 h-5 bg-ui-accent text-ui-secondary rounded-full text-[10px] font-black">{index + 1}</span>}
                                        <span className={`text-sm ${sup.isBest ? "text-emerald-900" : "text-ui-black"}`}>{sup.name}</span>
                                    </div>
                                    <div className="text-[10px] text-ui-secondary font-semibold ml-7 mt-0.5">Ost. zakup: {sup.lastBuy}</div>
                                </div>
                                <div className={`font-bold ${sup.isBest ? "text-emerald-600 text-lg" : "text-ui-primary text-base"}`}>
                                    {sup.lastPrice.toFixed(2)} <span className="text-xs font-semibold opacity-70">zł</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white border border-ui-accent col-span-2 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
                    <div className="p-5 border-b border-ui-accent">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                            <History size={16} /> Historia zakupów
                        </h3>
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
                                {data.deliveriesHistory.map((del: any) => (
                                    <tr key={del.id} className="hover:bg-ui-accent/5 transition-colors">
                                        <td className="p-4 font-semibold text-ui-black">{del.date}</td>
                                        <td className="p-4 text-ui-primary">
                                            <div className="truncate max-w-[250px]" title={del.supplier}>
                                                {del.supplier}
                                            </div>
                                            <div className="text-[10px] text-ui-secondary font-mono mt-0.5">{del.doc}</div>
                                        </td>
                                        <td className="p-4 text-center  text-ui-black whitespace-nowrap">{del.quantity} {data.unit}</td>
                                        <td className="p-4 text-right font-bold text-ui-black whitespace-nowrap">{del.price.toFixed(2)} zł</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                                    stroke="#F59E0B"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: '#F59E0B', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Zużycie vs Zakupy (2/3 szerokości) */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-sm lg:col-span-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2 mb-6">
                        <Scale size={16} /> Zużycie / Zakupy
                    </h3>
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
                                        if (name === "consumed") return [`${value} ${data.unit}`, "Wydano do produkcji"];
                                        if (name === "purchased") return [`${value} ${data.unit}`, "Kupiono na fakturach"];
                                        return [value, name];
                                    }}
                                />

                                <Legend
                                    wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: '500' }}
                                    iconType="circle"
                                    formatter={(value) => {
                                        if (value === "consumed") return "Zużycie produkcyjne";
                                        if (value === "purchased") return "Zrealizowane zakupy";
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
    );
}