"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Loader2, Package, TrendingUp,
    ShoppingCart, Medal, History, Truck, Scale,
    ChevronDown, ChevronUp, CalendarDays, BarChart3,
    Sparkles, ArrowRight, Pencil, X, CheckCircle2,
    FileText, ExternalLink, Receipt
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

const POLISH_MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const POLISH_MONTHS_FULL = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

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

    // Stan modalu podglądu faktury
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
    const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
    const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);

    // Stan edycji składnika
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [editUnit, setEditUnit] = useState("kg");
    const [editType, setEditType] = useState<string>("OTHER");
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    // Oś czasu dla wykresu cen z etykietami miesięcy
    const priceChartTimeline = React.useMemo(() => {
        if (!data?.priceHistory || data.priceHistory.length === 0) {
            return { chartData: [], ticks: [], minTime: 0, maxTime: 0 };
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let startYear = currentYear;
        let startMonth = currentMonth - 5;
        if (startMonth < 0) {
            startMonth += 12;
            startYear -= 1;
        }

        // Sprawdź czy najstarszy zakup nie jest wcześniejszy
        const oldestTimestamp = Math.min(...data.priceHistory.map((p: any) => new Date(p.date).getTime()));
        const oldestDate = new Date(oldestTimestamp);
        const sixMonthsAgoTime = new Date(startYear, startMonth, 1).getTime();
        if (oldestDate.getTime() < sixMonthsAgoTime) {
            startYear = oldestDate.getFullYear();
            startMonth = oldestDate.getMonth();
        }

        const minTime = new Date(startYear, startMonth, 1).getTime();
        const maxTime = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();

        const ticks: number[] = [];
        let currY = startYear;
        let currM = startMonth;
        while (currY < currentYear || (currY === currentYear && currM <= currentMonth)) {
            ticks.push(new Date(currY, currM, 15).getTime());
            currM++;
            if (currM > 11) {
                currM = 0;
                currY++;
            }
        }

        const chartData = data.priceHistory.map((p: any) => {
            const d = new Date(p.date);
            return {
                ...p,
                timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).getTime(),
            };
        }).sort((a: any, b: any) => a.timestamp - b.timestamp);

        return { chartData, ticks, minTime, maxTime };
    }, [data?.priceHistory]);

    const handleOpenInvoiceModal = async (invoiceId: string) => {
        if (!invoiceId) return;
        setLoadingInvoiceId(invoiceId);
        setIsLoadingInvoice(true);
        try {
            const res = await fetch(`/api/faktury/${invoiceId}/details`);
            if (res.ok) {
                const json = await res.json();
                setSelectedInvoice(json.invoice);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`Błąd pobierania faktury: ${err.error || "Nie udało się pobrać szczegółów faktury"}`);
            }
        } catch (err) {
            console.error("Błąd pobierania faktury:", err);
            alert("Wystąpił błąd podczas pobierania danych faktury.");
        } finally {
            setIsLoadingInvoice(false);
            setLoadingInvoiceId(null);
        }
    };

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
            setEditName(responseData.name);
            setEditUnit(responseData.unit || "kg");
            setEditType(responseData.rawType || "OTHER");
        } catch (err) {
            console.error("Błąd ładowania szczegółów:", err);
            setError("Nie udało się połączyć z serwerem.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchIngredientDetails();
        }
    }, [id]);

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editName.trim()) {
            alert("Wprowadź nazwę składnika.");
            return;
        }

        setIsSubmittingEdit(true);
        try {
            const res = await fetch(`/api/skladniki/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName.trim(),
                    unit: editUnit,
                    type: editType,
                }),
            });

            if (res.ok) {
                setIsEditModalOpen(false);
                await fetchIngredientDetails();
            } else {
                const err = await res.json();
                alert(`Błąd: ${err.error || "Nie udało się zaktualizować składnika"}`);
            }
        } catch (err) {
            console.error("Błąd aktualizacji:", err);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSubmittingEdit(false);
        }
    };

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
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="text-xs font-bold text-ui-secondary bg-white px-3 py-1 rounded-lg border border-ui-accent shadow-sm tracking-wider">
                                    {data.type}
                                </span>
                                <span className="ml-2 text-xs font-normal text-ui-secondary bg-ui-accent/30 px-2 py-0.5 rounded-md">
                                    {data.unit}
                                </span>

                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setEditName(data.name);
                                setEditUnit(data.unit || "kg");
                                setEditType(data.rawType || "OTHER");
                                setIsEditModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                            <Pencil size={15} />
                            Edytuj składnik
                        </button>
                    </div>
                </div>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-3 col-span-2 gap-6 mb-6">
                <div className="bg-white border border-ui-accent rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
                    <div className="p-5 border-b border-ui-accent bg-emerald-50/30">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                            <Truck size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
                            Dostawcy
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
                                    <div className="text-right">
                                        <div className={`font-bold ${sup.isBest ? "text-emerald-700 text-sm" : "text-ui-primary text-sm"}`}>
                                            {sup.lastPrice.toFixed(2)} zł <span className="text-[10px] font-normal text-ui-secondary">netto</span>
                                        </div>
                                        <div className="text-[10px] text-ui-secondary font-medium">
                                            {(sup.lastPrice * 1.05).toFixed(2)} zł brutto
                                        </div>
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
                            <History size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" />
                            Historia zakupów
                        </h3>
                        {data.deliveriesHistory && data.deliveriesHistory.length > 0 && (
                            <span className="text-[11px] font-semibold text-ui-secondary bg-ui-accent/20 px-2 py-0.5 rounded-full">
                                {data.deliveriesHistory.length} {data.deliveriesHistory.length === 1 ? "faktura" : "faktury"}
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
                                    <th className="p-4 text-right">Cena Brutto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/40">
                                {data.deliveriesHistory && data.deliveriesHistory.length > 0 ? (
                                    (showAllHistory ? data.deliveriesHistory : data.deliveriesHistory.slice(0, 5)).map((del: any) => {
                                        const priceNet = del.priceNet ?? del.price;
                                        const priceGross = del.priceGross ?? (del.price ? del.price * (1 + (del.vatRate ?? 0) / 100) : 0);

                                        return (
                                            <tr key={del.id} className="hover:bg-ui-accent/5 transition-colors">
                                                <td className="p-4 text-ui-black whitespace-nowrap">{formatDate(del.date)}</td>
                                                <td className="p-4 text-ui-primary">
                                                    <div className="truncate max-w-[200px]" title={del.supplier}>
                                                        {del.supplier}
                                                    </div>
                                                    {del.invoiceId ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenInvoiceModal(del.invoiceId)}
                                                            className="inline-flex items-center gap-1.5 text-[11px] text-ui-primary hover:ui-secondary font-mono font-bold mt-1 px-2 py-0.5 rounded-lg bg-ui-accent/15 hover:bg-ui-accent/30 border border-ui-accent/50 transition-colors cursor-pointer group shadow-2xs text-left"
                                                            title="Kliknij, aby otworzyć podgląd faktury"
                                                        >
                                                            <FileText size={12} className="text-ui-secondary group-hover:text-ui-secondary shrink-0" />
                                                            <span>{del.doc}</span>
                                                        </button>
                                                    ) : (
                                                        <div className="text-[10px] text-ui-secondary font-mono mt-0.5">{del.doc}</div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center text-ui-black whitespace-nowrap">{del.quantity} {data.unit}</td>
                                                <td className="p-4 text-right  font-semibold text-ui-black whitespace-nowrap">
                                                    {typeof priceNet === "number" ? `${priceNet.toFixed(2)} zł` : "—"}
                                                </td>
                                                <td className="p-4 text-right font-semibold text-ui-black whitespace-nowrap">
                                                    {typeof priceGross === "number" && priceGross > 0 ? `${priceGross.toFixed(2)} zł` : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-xs text-ui-secondary italic">
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

                {/* Wykres historii cen zakupu (1/3 szerokości) */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-sm lg:col-span-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <TrendingUp size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" /> Historia cen zakupu
                            </h3>
                            {data.priceHistory && data.priceHistory.length > 0 && (
                                <span className="text-[11px] font-semibold text-ui-secondary bg-ui-accent/20 px-2 py-0.5 rounded-full">
                                    {data.priceHistory.length} {data.priceHistory.length === 1 ? "zakup" : data.priceHistory.length < 5 ? "zakupy" : "zakupów"}
                                </span>
                            )}
                        </div>
                        {data.priceHistory && data.priceHistory.length > 0 ? (
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={priceChartTimeline.chartData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            type="number"
                                            dataKey="timestamp"
                                            domain={[priceChartTimeline.minTime, priceChartTimeline.maxTime]}
                                            ticks={priceChartTimeline.ticks}
                                            tickFormatter={(ts) => {
                                                const d = new Date(ts);
                                                return POLISH_MONTHS[d.getMonth()];
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: '#6B7280' }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: '#6B7280' }}
                                            tickFormatter={(value) => `${Number(value).toFixed(2)}`}
                                            domain={['auto', 'auto']}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const point = payload[0].payload;
                                                    return (
                                                        <div className="bg-white border border-ui-accent rounded-xl p-3 shadow-lg text-xs">
                                                            <div className="font-bold text-ui-black border-b border-ui-accent/40 pb-1 mb-1.5 flex items-center justify-between gap-3">
                                                                <span>{point.displayDate || formatDate(point.date)}</span>
                                                                {point.doc && (
                                                                    <span className="text-[10px] font-mono text-ui-secondary font-normal">
                                                                        {point.doc}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {point.supplier && (
                                                                <div className="text-ui-primary text-[11px] font-medium mb-1 truncate max-w-[200px]" title={point.supplier}>
                                                                    {point.supplier}
                                                                </div>
                                                            )}
                                                            <div className="flex items-center justify-between gap-4 text-ui-black mb-0.5">
                                                                <span>Cena netto:</span>
                                                                <span className="font-semibold text-[#265ff0]">{Number(point.priceNet ?? point.price).toFixed(2)} zł <span className="text-[10px] font-normal text-ui-secondary">/ {data.unit}</span></span>
                                                            </div>
                                                            {point.priceGross ? (
                                                                <div className="flex items-center justify-between gap-4 text-ui-black mb-0.5">
                                                                    <span>Cena brutto:</span>
                                                                    <span className="font-semibold">{Number(point.priceGross).toFixed(2)} zł <span className="text-[10px] font-normal text-ui-secondary">/ {data.unit}</span></span>
                                                                </div>
                                                            ) : null}
                                                            {point.quantity ? (
                                                                <div className="flex items-center justify-between gap-4 text-ui-secondary text-[11px] mt-1 pt-1 border-t border-ui-accent/30">
                                                                    <span>Ilość:</span>
                                                                    <span className="font-medium text-ui-black">{point.quantity} {data.unit}</span>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="priceNet"
                                            name="Cena netto"
                                            stroke="#265ff0"
                                            strokeWidth={2.5}
                                            dot={{ r: 4.5, fill: '#265ff0', strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 6.5, fill: '#265ff0', strokeWidth: 2, stroke: '#fff' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-xs text-ui-secondary italic">
                                Brak historii zakupów dla tego składnika
                            </div>
                        )}
                    </div>
                </div>

                {/* Zużycie vs Zakupy (2/3 szerokości) */}
                <div className="bg-white border border-ui-accent rounded-2xl p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-ui-secondary flex items-center gap-2">
                                <Scale size={30} className="p-1.5 bg-ui-secondary/20 rounded-lg text-ui-secondary shadow-sm" /> Zakupy / Zużycie
                            </h3>
                            <button
                                onClick={() => setIsConsumptionModalOpen(true)}
                                className="flex items-center gap-1 text-xs font-semibold border border-ui-accent hover:bg-ui-accent/30 text-ui-primary px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const dataPoint = payload[0]?.payload;
                                                let tooltipTitle = dataPoint?.fullLabel;
                                                if (!tooltipTitle) {
                                                    const mIdx = POLISH_MONTHS.indexOf(label);
                                                    if (mIdx !== -1) {
                                                        const year = dataPoint?.year || new Date().getFullYear();
                                                        tooltipTitle = `${POLISH_MONTHS_FULL[mIdx]} ${year}`;
                                                    } else {
                                                        tooltipTitle = label;
                                                    }
                                                }

                                                return (
                                                    <div className="bg-white border border-ui-accent rounded-xl p-3 shadow-lg text-xs min-w-[190px]">
                                                        <div className="font-bold text-ui-black border-b border-ui-accent/40 pb-1 mb-2">
                                                            {tooltipTitle}
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 text-[#3B82F6] mb-1.5">
                                                            <span className="font-medium">Zakupiono:</span>
                                                            <span className="font-bold">{dataPoint?.purchased ?? 0} {data.unit}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 text-[#059669] mb-1">
                                                            <span className="font-medium">Zużyto:</span>
                                                            <span className="font-bold">{dataPoint?.consumed ?? 0} {data.unit}</span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />

                                    <Legend
                                        wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: '500' }}
                                        iconType="circle"
                                        payload={[
                                            { value: 'Zakupiono', type: 'circle', id: 'purchased', color: '#3B82F6' },
                                            { value: 'Zużyto', type: 'circle', id: 'consumed', color: '#059669' }
                                        ]}
                                    />

                                    <Bar dataKey="purchased" name="Zakupiono" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="consumed" name="Zużyto" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} />
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

            {/* MODAL EDYCJI SKŁADNIKA */}
            {isEditModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsEditModalOpen(false)}
                >
                    <div
                        className="bg-ui-white w-full max-w-md rounded-2xl shadow-2xl border border-ui-accent overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-ui-accent bg-ui-accent/10 flex items-center justify-between">
                            <h2 className="flex items-center gap-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                                <Pencil size={18} className="text-amber-900" />
                                Edytuj składnik
                            </h2>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-1 rounded-full hover:bg-ui-accent/20 text-ui-secondary hover:text-ui-primary transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase mb-1.5">
                                    Nazwa składnika
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full h-[42px] bg-ui-white border border-ui-accent rounded-xl px-4 text-sm focus:outline-none focus:border-ui-secondary transition-all font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ui-secondary uppercase mb-1.5">
                                        Typ Składnika
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={editType}
                                            onChange={(e) => setEditType(e.target.value)}
                                            className="w-full h-[42px] appearance-none bg-ui-white border border-ui-accent rounded-xl pl-4 pr-10 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary cursor-pointer transition-all font-medium"
                                        >
                                            <option value="FLOUR">Mąka</option>
                                            <option value="FRUIT">Owoce/Warzywa/Bakalie</option>
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
                                            value={editUnit}
                                            onChange={(e) => setEditUnit(e.target.value)}
                                            className="w-full h-[42px] appearance-none bg-ui-white border border-ui-accent rounded-xl pl-4 pr-10 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary cursor-pointer transition-all font-medium"
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
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-ui-accent text-ui-primary font-semibold text-xs hover:bg-ui-accent/30 transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingEdit}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmittingEdit && <Loader2 size={14} className="animate-spin" />}
                                    <CheckCircle2 size={16} />
                                    Zapisz zmiany
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PODGLĄDU FAKTURY */}
            {selectedInvoice && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
                    onClick={() => setSelectedInvoice(null)}
                >
                    <div
                        className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-ui-accent flex flex-col relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Nagłówek modalu faktury */}
                        <div className="border-b border-ui-accent p-4 sm:p-5 flex items-start justify-between bg-ui-accent/10 shrink-0">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-white rounded-xl text-ui-primary border border-ui-accent/50 shadow-2xs mt-0.5">
                                    <FileText size={22} className="text-ui-primary" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-lg sm:text-xl font-bold text-ui-black">
                                            {selectedInvoice.invoiceNumber}
                                        </h2>
                                        {selectedInvoice.isSales && (
                                            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                                Sprzedaż
                                            </span>
                                        )}
                                        {selectedInvoice.status === "VERIFIED" && (
                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                                Zweryfikowana
                                            </span>
                                        )}
                                        {selectedInvoice.status === "NEW" && (
                                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                                Nowa (Do weryfikacji)
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-ui-secondary mt-1 font-medium">
                                        Dostawca: <strong className="text-ui-black">{selectedInvoice.contractor?.name || "Nieznany"}</strong>
                                        {selectedInvoice.contractor?.nip && (
                                            <span className="ml-1 text-ui-secondary">(NIP: {selectedInvoice.contractor.nip})</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="p-1.5 hover:bg-ui-accent/30 text-ui-secondary hover:text-ui-black rounded-full transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Ciało modalu */}
                        <div className="p-4 sm:p-6 space-y-5 text-sm flex-1 bg-white overflow-y-auto min-h-0">
                            {/* Karty podsumowania faktury */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-ui-accent/10 p-3.5 rounded-xl border border-ui-accent/40 text-xs">
                                <div>
                                    <span className="text-[10px] text-ui-secondary uppercase font-bold block">Data wystawienia:</span>
                                    <span className="text-ui-black font-extrabold text-sm">{formatDate(selectedInvoice.issuedDate)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-ui-secondary uppercase font-bold block">Wartość Netto:</span>
                                    <span className="text-ui-black font-extrabold text-sm">{Number(selectedInvoice.netAmount || 0).toFixed(2)} zł</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-ui-secondary uppercase font-bold block">Wartość VAT:</span>
                                    <span className="text-ui-secondary font-bold text-sm">{Number(selectedInvoice.vatAmount || 0).toFixed(2)} zł</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-ui-secondary uppercase font-bold block">Wartość Brutto:</span>
                                    <span className="text-ui-primary font-black text-sm">{Number(selectedInvoice.grossAmount || 0).toFixed(2)} zł</span>
                                </div>
                            </div>

                            {/* Tabela pozycji na fakturze */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-ui-secondary">
                                        Pozycje na fakturze ({selectedInvoice.positions?.length || 0})
                                    </h3>
                                    <span className="text-[11px] text-ui-secondary">
                                        Podgląd dla składnika: <strong className="text-ui-black">{data.name}</strong>
                                    </span>
                                </div>

                                <div className="border border-ui-accent rounded-xl overflow-hidden shadow-2xs">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-ui-accent/15 text-ui-secondary font-bold uppercase text-[10px] border-b border-ui-accent">
                                                    <th className="py-2.5 px-3">Lp.</th>
                                                    <th className="py-2.5 px-3 text-left">Nazwa artykułu z faktury</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Ilość</th>
                                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Cena Netto</th>
                                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Wartość Netto</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">VAT</th>
                                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Wartość Brutto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-ui-accent/30">
                                                {selectedInvoice.positions && selectedInvoice.positions.length > 0 ? (
                                                    selectedInvoice.positions.map((pos: any, idx: number) => {
                                                        const isMatchingThisIngredient = pos.product?.ingredientId === id;
                                                        return (
                                                            <tr
                                                                key={pos.id || idx}
                                                                className={`transition-colors ${isMatchingThisIngredient
                                                                    ? "bg-amber-50/90 font-medium"
                                                                    : "hover:bg-ui-accent/5"
                                                                    }`}
                                                            >
                                                                <td className="py-2.5 px-3 text-ui-secondary font-mono text-[11px]">{idx + 1}</td>
                                                                <td className="py-2.5 px-3 text-ui-black font-semibold">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span>{pos.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center font-bold text-ui-black whitespace-nowrap">
                                                                    {pos.quantity} {pos.unit || "szt"}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                                    <div className="font-medium text-ui-black">{Number(pos.netPrice || 0).toFixed(2)} zł <span className="text-[10px] text-ui-secondary">netto</span></div>
                                                                    <div className="text-[10px] text-ui-secondary">{(Number(pos.netPrice || 0) * (1 + (parseFloat(pos.vatRate || "5") || 5) / 100)).toFixed(2)} zł brutto</div>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-medium text-ui-black whitespace-nowrap">
                                                                    {Number(pos.netAmount || (Number(pos.quantity || 0) * Number(pos.netPrice || 0))).toFixed(2)} zł
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center text-ui-secondary whitespace-nowrap">
                                                                    {pos.vatRate ? `${pos.vatRate}%` : "—"}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-black text-ui-primary whitespace-nowrap">
                                                                    {Number(pos.grossAmount || 0).toFixed(2)} zł
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={7} className="p-6 text-center text-xs text-ui-secondary italic">
                                                            Brak szczegółowych pozycji na fakturze.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stopka modalu */}
                        <div className="p-3.5 px-5 border-t border-ui-accent bg-ui-accent/10 flex items-center justify-between shrink-0">
                            <div className="text-xs text-ui-secondary font-mono truncate max-w-md">
                                {selectedInvoice.ksefNumber ? `KSeF: ${selectedInvoice.ksefNumber}` : "Faktura wprowadzona ręcznie"}
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedInvoice(null)}
                                className="px-4 py-2 text-xs font-bold text-ui-secondary hover:text-ui-black border border-ui-accent bg-white rounded-xl transition-colors cursor-pointer"
                            >
                                Zamknij
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}