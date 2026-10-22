import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const EXTRAS_FILE = path.join(process.cwd(), "data", "production-extras.json");
const WEEKLY_PLANS_FILE = path.join(process.cwd(), "data", "weekly-plans.json");

function getExtras(): Record<string, { fiscalIncome?: number; soldOutTimes?: Record<string, string> }> {
    try {
        if (!fs.existsSync(EXTRAS_FILE)) return {};
        const raw = fs.readFileSync(EXTRAS_FILE, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function getWeeklyPlans(): Record<string, { savedAt: string; amounts: Record<string, Record<string, number>> }> {
    try {
        if (!fs.existsSync(WEEKLY_PLANS_FILE)) return {};
        const raw = fs.readFileSync(WEEKLY_PLANS_FILE, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function saveWeeklyPlans(data: any) {
    try {
        const dir = path.dirname(WEEKLY_PLANS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(WEEKLY_PLANS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.error("Błąd zapisu weekly-plans.json:", e);
    }
}

// Funkcja pomocnicza: zamiana "HH:MM" na minuty od północy
function timeToMinutes(timeStr?: string | null): number | null {
    if (!timeStr || typeof timeStr !== "string") return null;
    const clean = timeStr.trim();
    const match = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
}

// -------------------------------------------------------------
// KROK 2: KOREKTA NIEZREALIZOWANEGO POPYTU NA PODSTAWIE soldOutTime
// -------------------------------------------------------------
function calculateUnmetDemandMultiplier(dayOfWeek: number, soldOutTimeStr?: string | null): { multiplier: number; reason: string } {
    // dayOfWeek: 1 = Poniedziałek, ..., 5 = Piątek, 6 = Sobota, 0 = Niedziela
    const minutes = timeToMinutes(soldOutTimeStr);

    // DNI POWSZEDNIE (Poniedziałek – Piątek: 07:00 – 18:00)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (minutes !== null) {
            if (minutes < 12 * 60) {
                // Wyprzedane przed 12:00 -> +25%
                return { multiplier: 1.25, reason: `Wyprzedane przed 12:00 (${soldOutTimeStr}) -> +25% popytu` };
            } else if (minutes >= 12 * 60 && minutes < 15 * 60) {
                // Wyprzedane między 12:00 a 15:00 -> +10%
                return { multiplier: 1.15, reason: `Wyprzedane między 12:00 a 15:00 (${soldOutTimeStr}) -> +10% popytu` };
            } else if (minutes >= 15 * 60 && minutes < 17 * 60) {
                // Wyprzedane między 15:00 a 17:00 -> +5%
                return { multiplier: 1.05, reason: `Wyprzedane między 15:00 a 17:00 (${soldOutTimeStr}) -> +5% popytu` };
            } else {
                // Wyprzedane po 17:00 -> 1.00
                return { multiplier: 1.00, reason: `Wyprzedane po 17:00 (${soldOutTimeStr}) -> popyt w 100% zaspokojony` };
            }
        }
        return { multiplier: 1.00, reason: "Brak wcześniejszego wyprzedania -> popyt zaspokojony" };
    }

    // SOBOTA (07:00 – 16:00)
    if (dayOfWeek === 6) {
        if (minutes !== null) {
            if (minutes < 10 * 60) {
                // Wyprzedane przed 10:00 -> +25%
                return { multiplier: 1.25, reason: `Wyprzedane w sobotę przed 11:00 (${soldOutTimeStr}) -> +30% popytu` };
            } else if (minutes >= 10 * 60 && minutes < 13 * 60) {
                // Wyprzedane między 10:00 a 13:00 -> +15%
                return { multiplier: 1.10, reason: `Wyprzedane w sobotę między 11:00 a 13:30 (${soldOutTimeStr}) -> +15% popytu` };
            } else if (minutes >= 13 * 60 && minutes < 15 * 60) {
                // Wyprzedane między 13:00 a 15:00 -> +5%
                return { multiplier: 1.05, reason: `Wyprzedane w sobotę między 13:30 a 15:30 (${soldOutTimeStr}) -> +5% popytu` };
            } else {
                // Wyprzedane po 15:00 -> 1.00
                return { multiplier: 1.00, reason: `Wyprzedane w sobotę po 15:30 (${soldOutTimeStr}) -> popyt zaspokojony` };
            }
        }
        return { multiplier: 1.00, reason: "Brak wcześniejszego wyprzedania w sobotę -> popyt zaspokojony" };
    }

    return { multiplier: 1.00, reason: "Standardowy popyt" };
}

const WEEKDAY_NAMES_PL = [
    "Niedziela",
    "Poniedziałek",
    "Wtorek",
    "Środa",
    "Czwartek",
    "Piątek",
    "Sobota"
];

// Funkcja pomocnicza: wyliczanie planu dla pojedynczego dnia
async function computeDailyPlan(targetDateStr: string, products: any[], extras: any) {
    const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);
    if (isNaN(targetDate.getTime())) {
        throw new Error("Nieprawidłowy format daty (oczekiwano YYYY-MM-DD)");
    }

    const dayOfWeek = targetDate.getUTCDay(); // 0 = Niedziela, 1 = Pon, ..., 6 = Sob
    const dayName = WEEKDAY_NAMES_PL[dayOfWeek];

    // Sprawdzenie czy lokal jest otwarty w ten dzień (Niedziela: zamknięte / brak planu)
    if (dayOfWeek === 0) {
        return {
            targetDate: targetDateStr,
            dayOfWeek,
            dayName,
            isClosed: true,
            message: "W niedziele piekarnia jest nieczynna – brak sugerowanego planu produkcji.",
            suggestions: [],
            historyDays: [],
            totals: { totalUnits: 0, estimatedRevenue: 0, estimatedProductionCost: 0, estimatedProfit: 0, productsCount: 0 }
        };
    }

    // KROK 1: WYZNACZENIE 4 POPRZEDNICH TYGODNI DLA TEGO DNIA TYGODNIA
    const BASE_WEIGHTS = [0.40, 0.30, 0.20, 0.10]; // T-1, T-2, T-3, T-4
    const historicalWeeksInfo: Array<{
        weekIndex: number; // 1 to 4
        weekLabel: string; // T-1, T-2, ...
        dateStr: string;
        dateObj: Date;
        rawWeight: number;
        hasData: boolean;
        fiscalIncome: number;
        bakeryIncome: number;
        effectiveIncome: number;
        isAnomaly: boolean;
        anomalyReason?: string;
    }> = [];

    for (let i = 1; i <= 4; i++) {
        const histDate = new Date(targetDate.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const histDateStr = histDate.toISOString().split("T")[0];
        historicalWeeksInfo.push({
            weekIndex: i,
            weekLabel: `T-${i}`,
            dateStr: histDateStr,
            dateObj: histDate,
            rawWeight: BASE_WEIGHTS[i - 1],
            hasData: false,
            fiscalIncome: 0,
            bakeryIncome: 0,
            effectiveIncome: 0,
            isAnomaly: false,
        });
    }

    // Pobieramy wpisy produkcji dla wszystkich 4 dat historycznych
    const histDatesList = historicalWeeksInfo.map((w) => w.dateObj);
    const historicalProductions = await prisma.dailyProduction.findMany({
        where: {
            date: { in: histDatesList },
        },
        include: {
            bakeryProduct: true,
        },
    });

    // Pobieramy ewentualne DailyIncome z bazy
    let dbIncomes: Array<{ date: Date; incomeAmount: any }> = [];
    try {
        if ((prisma as any).dailyIncome) {
            dbIncomes = await (prisma as any).dailyIncome.findMany({
                where: {
                    date: { in: histDatesList },
                },
            });
        }
    } catch {
        dbIncomes = [];
    }

    const dbIncomeMap = new Map<string, number>();
    dbIncomes.forEach((inc) => {
        const dStr = new Date(inc.date).toISOString().split("T")[0];
        dbIncomeMap.set(dStr, Number(inc.incomeAmount || 0));
    });

    // Mapa produkcji: dateStr -> (productId -> { produced, sold, soldOutTime, salesIncome })
    const productionsByDateAndProduct: Record<string, Record<string, {
        producedAmount: number;
        soldAmount: number;
        soldOutTime?: string;
        salesIncome: number;
    }>> = {};

    historicalProductions.forEach((prod) => {
        const dStr = new Date(prod.date).toISOString().split("T")[0];
        if (!productionsByDateAndProduct[dStr]) {
            productionsByDateAndProduct[dStr] = {};
        }

        const pId = prod.bakeryProductId;
        const extraSoldOut = extras[dStr]?.soldOutTimes?.[pId] || prod.soldOutTime || "";
        const price = Number(prod.bakeryProduct?.sellingPrice || 0);
        const sold = prod.soldAmount || 0;
        const produced = prod.producedAmount || 0;

        productionsByDateAndProduct[dStr][pId] = {
            producedAmount: produced,
            soldAmount: sold,
            soldOutTime: extraSoldOut,
            salesIncome: sold * price,
        };
    });

    // Obliczamy sumy utargów i sprawdzamy dostępność danych dla każdego dnia historycznego
    historicalWeeksInfo.forEach((w) => {
        const dayProdMap = productionsByDateAndProduct[w.dateStr];
        let bakeryInc = 0;
        let totalSoldUnits = 0;

        if (dayProdMap) {
            Object.values(dayProdMap).forEach((p) => {
                bakeryInc += p.salesIncome;
                totalSoldUnits += p.soldAmount;
            });
        }

        const fiscalFromDb = dbIncomeMap.get(w.dateStr) || 0;
        const fiscalFromExtras = extras[w.dateStr]?.fiscalIncome || 0;
        const fiscalInc = fiscalFromDb > 0 ? fiscalFromDb : fiscalFromExtras;

        w.bakeryIncome = bakeryInc;
        w.fiscalIncome = fiscalInc;
        w.effectiveIncome = fiscalInc > 0 ? fiscalInc : bakeryInc;

        if (totalSoldUnits > 0 || bakeryInc > 0 || fiscalInc > 0 || dayProdMap) {
            w.hasData = true;
        } else {
            w.rawWeight = 0;
        }
    });

    const availableWeeksCount = historicalWeeksInfo.filter((w) => w.hasData).length;

    // KROK 4: WYKRYWANIE ANOMALII PRZY UŻYCIU DailyIncome / Utargu
    const validIncomeDays = historicalWeeksInfo.filter((w) => w.hasData && w.effectiveIncome > 0);
    let averageDayIncome = 0;
    if (validIncomeDays.length > 0) {
        averageDayIncome = validIncomeDays.reduce((sum, w) => sum + w.effectiveIncome, 0) / validIncomeDays.length;
    }

    const anomalies: Array<{ date: string; weekLabel: string; income: number; deviationPercent: number; reason: string }> = [];

    historicalWeeksInfo.forEach((w) => {
        if (w.hasData && averageDayIncome > 0 && w.effectiveIncome > 0) {
            const diffRatio = (w.effectiveIncome - averageDayIncome) / averageDayIncome;
            if (Math.abs(diffRatio) > 0.40) {
                w.isAnomaly = true;
                const percentStr = (diffRatio > 0 ? "+" : "") + Math.round(diffRatio * 100) + "%";
                const reason = `Utarg ${w.effectiveIncome.toLocaleString("pl-PL")} zł odbiega o ${percentStr} od średniej (${Math.round(averageDayIncome).toLocaleString("pl-PL")} zł). Zmniejszono wagę o 50%.`;
                w.anomalyReason = reason;
                w.rawWeight = w.rawWeight * 0.5;

                anomalies.push({
                    date: w.dateStr,
                    weekLabel: w.weekLabel,
                    income: w.effectiveIncome,
                    deviationPercent: Math.round(diffRatio * 100),
                    reason,
                });
            }
        }
    });

    // KROK 3 & NORMALIZACJA WAG
    const sumRawWeights = historicalWeeksInfo.reduce((sum, w) => sum + w.rawWeight, 0);

    const normalizedHistoricalWeeks = historicalWeeksInfo.map((w) => {
        const normalizedWeight = sumRawWeights > 0 ? w.rawWeight / sumRawWeights : 0;
        return {
            ...w,
            normalizedWeight: Math.round(normalizedWeight * 1000) / 1000,
        };
    });

    // KROK 2 & 3: WYLICZENIE SUGEROWANEGO POPYTU DLA KAŻDEGO PRODUKTU
    let totalSuggestedUnits = 0;
    let estimatedRevenue = 0;
    let estimatedProductionCost = 0;

    const productSuggestions = products.map((product) => {
        const price = Number(product.sellingPrice || 0);
        const cost = Number(product.productionCost || 0);

        const historyBreakdown: Array<{
            weekLabel: string;
            dateStr: string;
            producedAmount: number;
            soldAmount: number;
            soldOutTime?: string;
            unmetMultiplier: number;
            adjustmentReason: string;
            adjustedDemand: number;
            weight: number;
            contribution: number;
            isAnomaly: boolean;
        }> = [];

        let weightedDemandSum = 0;

        normalizedHistoricalWeeks.forEach((hw) => {
            const dayProd = productionsByDateAndProduct[hw.dateStr]?.[product.id];
            const produced = dayProd?.producedAmount || 0;
            const sold = dayProd?.soldAmount || 0;
            const soldOutTime = dayProd?.soldOutTime;

            const { multiplier, reason } = calculateUnmetDemandMultiplier(dayOfWeek, soldOutTime);
            const adjustedDemand = sold * multiplier;
            const contribution = adjustedDemand * hw.normalizedWeight;

            weightedDemandSum += contribution;

            historyBreakdown.push({
                weekLabel: hw.weekLabel,
                dateStr: hw.dateStr,
                producedAmount: produced,
                soldAmount: sold,
                soldOutTime: soldOutTime || undefined,
                unmetMultiplier: multiplier,
                adjustmentReason: reason,
                adjustedDemand: Math.round(adjustedDemand * 100) / 100,
                weight: hw.normalizedWeight,
                contribution: Math.round(contribution * 100) / 100,
                isAnomaly: hw.isAnomaly,
            });
        });

        const rawDemand = Math.round(weightedDemandSum * 100) / 100;
        const suggestedAmount = Math.max(0, Math.round(weightedDemandSum));

        totalSuggestedUnits += suggestedAmount;
        estimatedRevenue += suggestedAmount * price;
        estimatedProductionCost += suggestedAmount * cost;

        return {
            id: product.id,
            name: product.name,
            type: product.type,
            sellingPrice: price,
            productionCost: cost,
            suggestedAmount,
            rawDemand,
            history: historyBreakdown,
        };
    });

    productSuggestions.sort((a, b) => b.suggestedAmount - a.suggestedAmount || a.name.localeCompare(b.name));

    let warningMessage: string | null = null;
    if (availableWeeksCount === 0) {
        warningMessage = "Brak jakichkolwiek danych historycznych dla tego dnia tygodnia z ostatnich 4 tygodni. Wyniki mogą wynosić 0.";
    } else if (availableWeeksCount < 4) {
        warningMessage = `Niepełna historia danych (dostępne tylko ${availableWeeksCount}/4 tygodnie). Wagi zostały znormalizowane, jednak dokładność prognozy może być niższa.`;
    }

    return {
        targetDate: targetDateStr,
        dayOfWeek,
        dayName,
        isClosed: false,
        dataQuality: {
            availableWeeksCount,
            hasFullHistory: availableWeeksCount === 4,
            warningMessage,
            averageHistoricalIncome: Math.round(averageDayIncome),
            anomaliesCount: anomalies.length,
            anomalies,
        },
        historicalWeeks: normalizedHistoricalWeeks.map((w) => ({
            weekLabel: w.weekLabel,
            date: w.dateStr,
            hasData: w.hasData,
            fiscalIncome: w.fiscalIncome,
            bakeryIncome: w.bakeryIncome,
            effectiveIncome: w.effectiveIncome,
            isAnomaly: w.isAnomaly,
            anomalyReason: w.anomalyReason,
            weight: w.normalizedWeight,
        })),
        totals: {
            totalUnits: totalSuggestedUnits,
            estimatedRevenue: Math.round(estimatedRevenue * 100) / 100,
            estimatedProductionCost: Math.round(estimatedProductionCost * 100) / 100,
            estimatedProfit: Math.round((estimatedRevenue - estimatedProductionCost) * 100) / 100,
            productsCount: products.length,
        },
        suggestions: productSuggestions,
    };
}

// GET: /api/produkcja/plan?date=YYYY-MM-DD lub /api/produkcja/plan?weekStart=YYYY-MM-DD
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const weekStartParam = searchParams.get("weekStart");
        const extras = getExtras();

        const products = await prisma.bakeryProduct.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                type: true,
                sellingPrice: true,
                productionCost: true,
            },
        });

        // WARIANT 1: PLAN NA CAŁY TYDZIEŃ (od poniedziałku do soboty, 6 dni)
        if (weekStartParam) {
            const startParsed = new Date(`${weekStartParam}T00:00:00.000Z`);
            if (isNaN(startParsed.getTime())) {
                return NextResponse.json({ error: "Nieprawidłowy format daty weekStart (oczekiwano YYYY-MM-DD)" }, { status: 400 });
            }

            const resetParam = searchParams.get("reset") === "true";
            const savedPlans = getWeeklyPlans();
            const savedPlan = !resetParam ? savedPlans[weekStartParam] : null;

            // Generujemy 6 dni: Poniedziałek do Soboty
            const weekDates: string[] = [];
            for (let i = 0; i < 6; i++) {
                const cur = new Date(startParsed.getTime() + i * 24 * 60 * 60 * 1000);
                weekDates.push(cur.toISOString().split("T")[0]);
            }

            // Obliczamy plan dla każdego z 6 dni
            const dayPlans = await Promise.all(
                weekDates.map((dStr) => computeDailyPlan(dStr, products, extras))
            );

            const CATEGORY_ORDER = ["BREAD", "ROLL", "SWEET", "SAVORY"];
            const CATEGORY_NAMES: Record<string, string> = {
                BREAD: "Chleby",
                ROLL: "Bułki",
                SWEET: "Wypieki słodkie",
                SAVORY: "Wypieki słone",
            };

            const productMap: Record<string, {
                id: string;
                name: string;
                type: string;
                sellingPrice: number;
                dailyAmounts: Record<string, number>;
                weeklyTotal: number;
            }> = {};

            products.forEach((p) => {
                productMap[p.id] = {
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    sellingPrice: Number(p.sellingPrice || 0),
                    dailyAmounts: {},
                    weeklyTotal: 0,
                };
            });

            const daysData = dayPlans.map((dp, idx) => {
                const dateStr = weekDates[idx];
                dp.suggestions.forEach((s: any) => {
                    if (productMap[s.id]) {
                        const savedVal = savedPlan?.amounts?.[s.id]?.[dateStr];
                        const amount = savedVal !== undefined ? savedVal : s.suggestedAmount;
                        productMap[s.id].dailyAmounts[dateStr] = amount;
                    }
                });
                return {
                    dateStr,
                    dayOfWeek: dp.dayOfWeek,
                    dayName: dp.dayName,
                    dayShort: ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"][dp.dayOfWeek],
                    dateFormatted: `${dateStr.slice(8, 10)}.${dateStr.slice(5, 7)}`,
                    totalUnits: dp.totals.totalUnits,
                    estimatedRevenue: dp.totals.estimatedRevenue,
                };
            });

            // Upewnij się, że każdy produkt ma poprawnie wyliczoną sumę tygodnia
            Object.values(productMap).forEach((p) => {
                let total = 0;
                weekDates.forEach((dStr) => {
                    const savedVal = savedPlan?.amounts?.[p.id]?.[dStr];
                    if (savedVal !== undefined) {
                        p.dailyAmounts[dStr] = savedVal;
                    } else if (p.dailyAmounts[dStr] === undefined) {
                        p.dailyAmounts[dStr] = 0;
                    }
                    total += p.dailyAmounts[dStr] || 0;
                });
                p.weeklyTotal = total;
            });

            // Grupowanie wyrobów wg kategorii z podsumowaniami
            const categories = CATEGORY_ORDER.map((catKey) => {
                const catProducts = Object.values(productMap).filter((p) => p.type === catKey);
                catProducts.sort((a, b) => b.weeklyTotal - a.weeklyTotal || a.name.localeCompare(b.name));

                const categoryDailyTotals: Record<string, number> = {};
                let categoryWeeklyTotal = 0;
                weekDates.forEach((dStr) => {
                    const daySum = catProducts.reduce((sum, p) => sum + (p.dailyAmounts[dStr] || 0), 0);
                    categoryDailyTotals[dStr] = daySum;
                    categoryWeeklyTotal += daySum;
                });

                return {
                    key: catKey,
                    label: CATEGORY_NAMES[catKey] || catKey,
                    products: catProducts,
                    dailyTotals: categoryDailyTotals,
                    weeklyTotal: categoryWeeklyTotal,
                };
            });

            const grandDailyTotals: Record<string, number> = {};
            let grandWeeklyTotal = 0;
            let totalEstimatedRevenue = 0;

            weekDates.forEach((dStr) => {
                const daySum = Object.values(productMap).reduce((sum, p) => sum + (p.dailyAmounts[dStr] || 0), 0);
                grandDailyTotals[dStr] = daySum;
                grandWeeklyTotal += daySum;
            });

            dayPlans.forEach((dp) => {
                totalEstimatedRevenue += dp.totals.estimatedRevenue;
            });

            return NextResponse.json({
                weekStart: weekDates[0],
                weekEnd: weekDates[5],
                days: daysData,
                categories,
                grandDailyTotals,
                grandWeeklyTotal,
                totalEstimatedRevenue: Math.round(totalEstimatedRevenue * 100) / 100,
                isCustomSaved: Boolean(savedPlan),
                savedAt: savedPlan?.savedAt || null,
            });
        }

        // WARIANT 2: PLAN NA POJEDYNCZY DZIEŃ (domyślny)
        const todayStr = new Date().toISOString().split("T")[0];
        const targetDateStr = searchParams.get("date") || todayStr;
        const plan = await computeDailyPlan(targetDateStr, products, extras);
        return NextResponse.json(plan);
    } catch (error: any) {
        console.error("Błąd generowania sugerowanego planu produkcji:", error);
        return NextResponse.json({ error: "Błąd serwera podczas wyliczania planu", details: error.message }, { status: 500 });
    }
}

// POST: /api/produkcja/plan - Zapis ręcznie edytowanego planu tygodniowego
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { weekStart, amounts } = body;
        if (!weekStart || !amounts) {
            return NextResponse.json({ error: "Brak parametru weekStart lub amounts" }, { status: 400 });
        }
        const savedPlans = getWeeklyPlans();
        const nowIso = new Date().toISOString();
        savedPlans[weekStart] = {
            savedAt: nowIso,
            amounts,
        };
        saveWeeklyPlans(savedPlans);
        return NextResponse.json({ success: true, savedAt: nowIso });
    } catch (error: any) {
        console.error("Błąd zapisu planu tygodniowego:", error);
        return NextResponse.json({ error: "Błąd serwera podczas zapisu", details: error.message }, { status: 500 });
    }
}
