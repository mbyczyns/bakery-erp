"use client";

import React, { useState, useEffect } from "react";
import { User, Sliders, Save, ShieldCheck, Droplet, Loader2, CheckCircle2, Coins, Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ZespolSection from "@/components/ZespolSection";
import { PRICE_ROUNDING_OPTIONS, PriceRoundingOption } from "@/lib/price-rounding";
import {
    DEFAULT_OPENING_HOURS,
    WeekdayKey,
    WEEKDAY_KEYS,
    WEEKDAY_LABELS,
    DayOpeningHours,
} from "@/lib/settings-types";

export default function KonfiguracjaPage() {
    const { user } = useAuth();
    const isManagerOrAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";

    // Stan konfiguracji stawki wody
    const [waterPrice, setWaterPrice] = useState<string>("");
    const [isLoadingWater, setIsLoadingWater] = useState<boolean>(true);
    const [isSavingWater, setIsSavingWater] = useState<boolean>(false);
    const [waterSaveSuccess, setWaterSaveSuccess] = useState<boolean>(false);

    // Stan konfiguracji zaokrąglania cen
    const [priceRounding, setPriceRounding] = useState<PriceRoundingOption>("none");
    const [isLoadingRounding, setIsLoadingRounding] = useState<boolean>(true);
    const [isSavingRounding, setIsSavingRounding] = useState<boolean>(false);
    const [roundingSaveSuccess, setRoundingSaveSuccess] = useState<boolean>(false);

    // Stan konfiguracji godzin otwarcia piekarni
    const [openingHours, setOpeningHours] = useState<Record<WeekdayKey, DayOpeningHours>>(DEFAULT_OPENING_HOURS);
    const [isLoadingOpeningHours, setIsLoadingOpeningHours] = useState<boolean>(true);
    const [isSavingOpeningHours, setIsSavingOpeningHours] = useState<boolean>(false);
    const [openingHoursSaveSuccess, setOpeningHoursSaveSuccess] = useState<boolean>(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch("/api/konfiguracja");
                if (res.ok) {
                    const data = await res.json();
                    if (data.waterPricePerLiter !== undefined) {
                        setWaterPrice(String(data.waterPricePerLiter));
                    }
                    if (data.priceRounding !== undefined) {
                        setPriceRounding(data.priceRounding as PriceRoundingOption);
                    }
                    if (data.openingHours) {
                        setOpeningHours(data.openingHours);
                    }
                }
            } catch (err) {
                console.error("Błąd pobierania konfiguracji:", err);
            } finally {
                setIsLoadingWater(false);
                setIsLoadingRounding(false);
                setIsLoadingOpeningHours(false);
            }
        };

        fetchConfig();
    }, []);

    const handleSaveWaterPrice = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedPrice = parseFloat(waterPrice.replace(",", "."));
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            alert("Podaj prawidłową stawkę za litr wody (np. 0.02 lub 0.05)");
            return;
        }

        setIsSavingWater(true);
        setWaterSaveSuccess(false);
        try {
            const res = await fetch("/api/konfiguracja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ waterPricePerLiter: parsedPrice }),
            });

            if (res.ok) {
                setWaterSaveSuccess(true);
                setTimeout(() => setWaterSaveSuccess(false), 3500);
            } else {
                const data = await res.json();
                alert(`Błąd zapisu: ${data.error || "Nie udało się zapisać stawki wody"}`);
            }
        } catch (err) {
            console.error("Błąd zapisu stawki wody:", err);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSavingWater(false);
        }
    };

    const handleSavePriceRounding = async (selectedOption: PriceRoundingOption) => {
        setPriceRounding(selectedOption);
        setIsSavingRounding(true);
        setRoundingSaveSuccess(false);
        try {
            const res = await fetch("/api/konfiguracja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priceRounding: selectedOption }),
            });

            if (res.ok) {
                setRoundingSaveSuccess(true);
                setTimeout(() => setRoundingSaveSuccess(false), 3000);
            } else {
                const data = await res.json();
                alert(`Błąd zapisu zaokrąglenia cen: ${data.error || "Nie udało się zapisać"}`);
            }
        } catch (err) {
            console.error("Błąd zapisu zaokrąglenia cen:", err);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSavingRounding(false);
        }
    };

    const handleOpeningHourChange = (
        day: WeekdayKey,
        field: keyof DayOpeningHours,
        value: boolean | string
    ) => {
        setOpeningHours((prev) => ({
            ...prev,
            [day]: {
                ...prev[day],
                [field]: value,
            },
        }));
    };

    const handleSaveOpeningHours = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingOpeningHours(true);
        setOpeningHoursSaveSuccess(false);
        try {
            const res = await fetch("/api/konfiguracja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ openingHours }),
            });

            if (res.ok) {
                setOpeningHoursSaveSuccess(true);
                setTimeout(() => setOpeningHoursSaveSuccess(false), 3500);
            } else {
                const data = await res.json();
                alert(`Błąd zapisu: ${data.error || "Nie udało się zapisać godzin otwarcia"}`);
            }
        } catch (err) {
            console.error("Błąd zapisu godzin otwarcia:", err);
            alert("Błąd połączenia z serwerem.");
        } finally {
            setIsSavingOpeningHours(false);
        }
    };

    const handleApplyWeekdayPreset = (openTime: string, closeTime: string) => {
        setOpeningHours((prev) => ({
            ...prev,
            monday: { ...prev.monday, isOpen: true, openTime, closeTime },
            tuesday: { ...prev.tuesday, isOpen: true, openTime, closeTime },
            wednesday: { ...prev.wednesday, isOpen: true, openTime, closeTime },
            thursday: { ...prev.thursday, isOpen: true, openTime, closeTime },
            friday: { ...prev.friday, isOpen: true, openTime, closeTime },
        }));
    };

    return (
        <div className="min-h-screen bg-ui-white text-ui-primary pb-20 relative">

            {/* Nagłówek strony */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ui-black">Konfiguracja</h1>
                </div>
            </div>

            {/* Kontener na sekcje ustawień */}
            <div className="space-y-6 w-full">

                {/* SEKCJA 1: Zaokrąglanie cen sprzedaży */}
                <div className="bg-ui-white rounded-2xl p-4 sm:p-6 shadow-xs border border-ui-accent hover:border-ui-secondary transition-all duration-300">
                    <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-ui-accent/30 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 p-2 rounded-lg text-ui-secondary">
                                <Coins size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-ui-black">Zaokrąglanie cen sprzedaży</h2>
                            </div>
                        </div>

                        {roundingSaveSuccess && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 animate-fade-in">
                                <CheckCircle2 size={15} />
                                Zapisano ustawienie!
                            </span>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-4 text-xs text-blue-950 leading-relaxed">
                            <p>
                                Wybrana opcja zaokrąglenia cen jest stosowana w całym systemie (w kalkulatorze cen w przepisach) oraz <strong>determinuje powiadomienia o podwyżkach surowców</strong>. Sugestie wzrostu cen wyrobów pojawią się tylko wtedy, gdy wzrost kosztu produkcji wymusza podwyżkę ceny sprzedaży o co najmniej wybraną kwotę zaokrąglenia.
                            </p>
                        </div>

                        {/* Siatka wyboru reguły zaokrąglenia */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-1">
                            {PRICE_ROUNDING_OPTIONS.map((opt) => {
                                const isSelected = priceRounding === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        disabled={isSavingRounding || isLoadingRounding}
                                        onClick={() => handleSavePriceRounding(opt.id)}
                                        className={`relative p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer group ${isSelected
                                            ? "bg-amber-50/80 border-amber-500 shadow-sm ring-1 ring-amber-500"
                                            : "bg-ui-white border-ui-accent hover:border-amber-400/80 hover:bg-amber-50/20"
                                            }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-sm font-bold ${isSelected ? "text-amber-950" : "text-ui-black"}`}>
                                                    {opt.label}
                                                </span>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${isSelected
                                                    ? "border-amber-600 bg-amber-600"
                                                    : "border-ui-accent bg-white group-hover:border-amber-400"
                                                    }`}>
                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-ui-secondary leading-snug mb-3">
                                                {opt.description}
                                            </p>
                                        </div>

                                        <div className="pt-2 border-t border-ui-accent/40 flex items-center justify-between text-[11px]">
                                            <span className="text-ui-secondary font-medium">Przykład:</span>
                                            <span className="font-bold text-ui-black bg-white px-2 py-0.5 rounded border border-ui-accent/60">
                                                {opt.example}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* SEKCJA 2: Stawka wody i surowce specjalne */}
                <div className="bg-ui-white rounded-2xl p-4 sm:p-6 shadow-xs border border-ui-accent hover:border-ui-secondary transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4 sm:mb-6 border-b border-ui-accent/30 pb-3">
                        <div className="bg-blue-50 p-2 rounded-lg text-ui-secondary">
                            <Droplet size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-ui-black">Koszt wody</h2>
                        </div>
                    </div>

                    <form onSubmit={handleSaveWaterPrice} className="space-y-4">
                        <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-4 text-xs text-blue-950 leading-relaxed">
                            <p>
                                Woda oraz dolewka wody nie pochodzą z faktur zakupu surowców. Wpisana poniżej stawka za 1 litr zostanie automatycznie przypisana do tych składników w bazie i uwzględniona we wszystkich kalkulacjach foodcostu wyrobów oraz półproduktów.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">
                                    Cena wody brutto za litr (zł / l)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="np. 0.02"
                                        value={isLoadingWater ? "..." : waterPrice}
                                        disabled={isLoadingWater}
                                        onChange={(e) => setWaterPrice(e.target.value)}
                                        className="w-full bg-ui-white border border-ui-accent rounded-xl pl-4 pr-14 py-2.5 text-sm font-black text-ui-black focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all shadow-xs"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ui-secondary pointer-events-none">
                                        zł / l
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            {waterSaveSuccess ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 animate-fade-in">
                                    <CheckCircle2 size={15} />
                                    Zapisano i przeliczono foodcosty!
                                </span>
                            ) : (
                                <span />
                            )}

                            <button
                                type="submit"
                                disabled={isSavingWater || isLoadingWater}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors duration-200 cursor-pointer"
                            >
                                {isSavingWater ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Zapisywanie...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} />
                                        Zapisz cenę wody
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* SEKCJA: Godziny otwarcia piekarni */}
                <div className="bg-ui-white rounded-2xl p-4 sm:p-6 shadow-xs border border-ui-accent hover:border-ui-secondary transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 border-b border-ui-accent/30 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 p-2 rounded-lg text-ui-secondary">
                                <Clock size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-ui-black">Godziny otwarcia piekarni</h2>
                            </div>
                        </div>

                        {openingHoursSaveSuccess && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 animate-fade-in">
                                <CheckCircle2 size={15} />
                                Zapisano godziny otwarcia!
                            </span>
                        )}
                    </div>

                    <form onSubmit={handleSaveOpeningHours} className="space-y-5">

                        {/* Tabela / Lista dni tygodnia */}
                        <div className="border border-ui-accent rounded-xl overflow-hidden divide-y divide-ui-accent/40">
                            {WEEKDAY_KEYS.map((key) => {
                                const config = openingHours[key] || DEFAULT_OPENING_HOURS[key];
                                const label = WEEKDAY_LABELS[key];
                                const isSunday = key === "sunday";
                                const isSaturday = key === "saturday";

                                return (
                                    <div
                                        key={key}
                                        className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${config.isOpen ? "bg-white" : "bg-ui-accent/10 opacity-75"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-[160px]">
                                            <input
                                                type="checkbox"
                                                id={`open-${key}`}
                                                checked={config.isOpen}
                                                onChange={(e) => handleOpeningHourChange(key, "isOpen", e.target.checked)}
                                                className="w-4 h-4 text-ui-primary rounded border-ui-accent focus:ring-ui-secondary cursor-pointer"
                                            />
                                            <label
                                                htmlFor={`open-${key}`}
                                                className={`text-sm font-bold cursor-pointer select-none ${config.isOpen ? "text-ui-black" : "text-ui-secondary line-through"
                                                    }`}
                                            >
                                                {label}
                                            </label>

                                        </div>

                                        {config.isOpen ? (
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs text-ui-secondary font-medium">Od:</span>
                                                    <input
                                                        type="time"
                                                        value={config.openTime}
                                                        onChange={(e) => handleOpeningHourChange(key, "openTime", e.target.value)}
                                                        className="px-2.5 py-1.5 rounded-lg border border-ui-accent bg-white text-xs font-bold text-ui-black focus:outline-none focus:ring-2 focus:ring-ui-secondary shadow-2xs"
                                                    />
                                                </div>
                                                <span className="text-ui-secondary text-xs">—</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs text-ui-secondary font-medium">Do (zamknięcie):</span>
                                                    <input
                                                        type="time"
                                                        value={config.closeTime}
                                                        onChange={(e) => handleOpeningHourChange(key, "closeTime", e.target.value)}
                                                        className="px-2.5 py-1.5 rounded-lg border border-ui-primary/60 bg-amber-50/50 text-xs font-black text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary shadow-2xs"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs font-semibold text-ui-secondary italic">
                                                Piekarnia nieczynna w ten dzień
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Przycisk zapisu */}
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={isSavingOpeningHours || isLoadingOpeningHours}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors duration-200 cursor-pointer"
                            >
                                {isSavingOpeningHours ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Zapisywanie...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} />
                                        Zapisz godziny otwarcia
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* SEKCJA 2: Konto zalogowanego użytkownika */}
                <div className="bg-ui-white rounded-2xl p-4 sm:p-6 shadow-xs border border-ui-accent hover:border-ui-secondary transition-all duration-300">

                    {/* Nagłówek sekcji */}
                    <div className="flex items-center gap-3 mb-4 sm:mb-6 border-b border-ui-accent/30 pb-3">
                        <div className="bg-ui-accent/20 p-2 rounded-lg text-ui-primary">
                            <User size={20} className="text-ui-secondary" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-ui-black">Konto użytkownika</h2>
                        </div>
                    </div>

                    {/* Wizualna wizytówka zalogowanego użytkownika */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-ui-accent/10 border border-ui-accent/40 rounded-xl p-3.5 sm:p-4 mb-6 sm:mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-ui-primary text-ui-white font-bold text-base sm:text-lg rounded-full flex items-center justify-center shadow-xs shrink-0">
                                {(user?.name || user?.login || "U").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-ui-black text-sm sm:text-base truncate">{user?.name || user?.login || "Użytkownik"}</h3>
                                <p className="text-xs text-ui-primary/60 truncate">Login: <span className="font-semibold text-ui-primary">{user?.login}</span></p>
                            </div>
                        </div>

                        {/* Status roli użytkownika */}
                        <div className="flex items-center gap-1.5 bg-ui-white border border-ui-secondary/35 text-ui-secondary px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs w-fit">
                            <ShieldCheck size={14} />
                            Rola: {user?.role || "USER"}
                        </div>
                    </div>

                    {/* Pola formularza zmiany hasła */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Aktualne hasło</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-ui-secondary">Nowe hasło</label>
                            <input
                                type="password"
                                placeholder="Min. 8 znaków"
                                className="bg-ui-white border border-ui-accent rounded-xl px-4 py-2.5 text-sm text-ui-primary focus:outline-none focus:border-ui-secondary focus:ring-1 focus:ring-ui-secondary transition-all"
                            />
                        </div>
                    </div>

                    {/* Przycisk akcji */}
                    <div className="flex justify-end mt-5 sm:mt-6">
                        <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors duration-200 cursor-pointer">
                            <Save size={14} />
                            Zmień hasło
                        </button>
                    </div>
                </div>

                {/* SEKCJA 3: Zespół i pracownicy (Dostępna TYLKO dla Managerów i Administratorów) */}
                {isManagerOrAdmin && (
                    <ZespolSection />
                )}

            </div>
        </div>
    );
}