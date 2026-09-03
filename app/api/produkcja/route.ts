import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Ścieżka do lokalnego pliku metadanych (bezpieczny fallback dla soldOutTime i utargu fiskalnego)
const EXTRAS_FILE = path.join(process.cwd(), "data", "production-extras.json");

function getExtras(): Record<string, { fiscalIncome?: number; soldOutTimes?: Record<string, string> }> {
    try {
        if (!fs.existsSync(EXTRAS_FILE)) return {};
        const raw = fs.readFileSync(EXTRAS_FILE, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function saveExtras(data: Record<string, { fiscalIncome?: number; soldOutTimes?: Record<string, string> }>) {
    try {
        const dir = path.dirname(EXTRAS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(EXTRAS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.error("Błąd zapisu production-extras.json:", e);
    }
}

// GET: Pobieranie raportu (pojedynczy dzień lub podsumowanie zakresu/miesiąca dla listy i kalendarza)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get("mode");

        const extras = getExtras();

        // -------------------------------------------------------------
        // TRYB 1: PODSUMOWANIE DLA LISTY I KALENDARZA (mode === "summary")
        // -------------------------------------------------------------
        if (mode === "summary") {
            const todayStr = new Date().toISOString().split("T")[0];
            const monthParam = searchParams.get("month") || todayStr.slice(0, 7); // np. "2026-09"
            
            // Określenie zakresu dni miesiąca
            const [yearStr, monthNumStr] = monthParam.split("-");
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthNumStr, 10);
            
            const firstDay = new Date(Date.UTC(year, month - 1, 1));
            const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

            // Pobieramy wszystkie wyroby (aby znać aktualne ceny sprzedaży)
            const products = await prisma.bakeryProduct.findMany({
                select: { id: true, name: true, type: true, sellingPrice: true },
            });
            const productPriceMap = new Map<string, number>();
            products.forEach((p) => {
                productPriceMap.set(p.id, Number(p.sellingPrice || 0));
            });

            // Pobieramy wszystkie wpisy produkcji w danym miesiącu
            const monthlyProductions = await prisma.dailyProduction.findMany({
                where: {
                    date: {
                        gte: firstDay,
                        lte: lastDay,
                    },
                },
            });

            // Próba pobrania DailyIncome z bazy (jeśli tabela istnieje)
            let dbIncomes: Array<{ date: Date; incomeAmount: any }> = [];
            try {
                if ((prisma as any).dailyIncome) {
                    dbIncomes = await (prisma as any).dailyIncome.findMany({
                        where: {
                            date: {
                                gte: firstDay,
                                lte: lastDay,
                            },
                        },
                    });
                }
            } catch {
                // Tabela dailyIncome może jeszcze nie istnieć w DB przed db push
                dbIncomes = [];
            }

            const dbIncomeMap = new Map<string, number>();
            dbIncomes.forEach((inc) => {
                const dStr = new Date(inc.date).toISOString().split("T")[0];
                dbIncomeMap.set(dStr, Number(inc.incomeAmount || 0));
            });

            // Agregacja po dniach
            const daysMap: Record<
                string,
                {
                    date: string;
                    totalProduced: number;
                    totalSold: number;
                    bakerySalesIncome: number;
                    fiscalIncome: number;
                    hasReport: boolean;
                    productsCount: number;
                }
            > = {};

            // Inicjalizacja każdego dnia miesiąca
            const daysInMonth = lastDay.getUTCDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dateKey = `${monthParam}-${String(d).padStart(2, "0")}`;
                const fiscalFromExtras = extras[dateKey]?.fiscalIncome || 0;
                const fiscalFromDb = dbIncomeMap.get(dateKey) || 0;

                daysMap[dateKey] = {
                    date: dateKey,
                    totalProduced: 0,
                    totalSold: 0,
                    bakerySalesIncome: 0,
                    fiscalIncome: fiscalFromDb > 0 ? fiscalFromDb : fiscalFromExtras,
                    hasReport: false,
                    productsCount: 0,
                };
            }

            // Sumowanie wpisów produkcji
            monthlyProductions.forEach((prod) => {
                const dStr = new Date(prod.date).toISOString().split("T")[0];
                if (!daysMap[dStr]) {
                    daysMap[dStr] = {
                        date: dStr,
                        totalProduced: 0,
                        totalSold: 0,
                        bakerySalesIncome: 0,
                        fiscalIncome: dbIncomeMap.get(dStr) || extras[dStr]?.fiscalIncome || 0,
                        hasReport: false,
                        productsCount: 0,
                    };
                }

                const price = productPriceMap.get(prod.bakeryProductId) || 0;
                const produced = prod.producedAmount || 0;
                const sold = prod.soldAmount || 0;

                if (produced > 0 || sold > 0) {
                    daysMap[dStr].hasReport = true;
                    daysMap[dStr].totalProduced += produced;
                    daysMap[dStr].totalSold += sold;
                    daysMap[dStr].bakerySalesIncome += sold * price;
                    daysMap[dStr].productsCount += 1;
                }
            });

            // Jeśli dzień ma podany utarg fiskalny, oznaczamy go również jako posiadający raport
            Object.keys(daysMap).forEach((dKey) => {
                if (daysMap[dKey].fiscalIncome > 0) {
                    daysMap[dKey].hasReport = true;
                }
            });

            // Obliczenie KPI miesiąca
            let monthProduced = 0;
            let monthSold = 0;
            let monthBakeryIncome = 0;
            let monthFiscalIncome = 0;
            let missingReportsCount = 0;

            const daysList = Object.values(daysMap).sort((a, b) => b.date.localeCompare(a.date));

            Object.values(daysMap).forEach((dayItem) => {
                monthProduced += dayItem.totalProduced;
                monthSold += dayItem.totalSold;
                monthBakeryIncome += dayItem.bakerySalesIncome;
                monthFiscalIncome += dayItem.fiscalIncome;

                // Dni bez raportu: dni robocze/soboty od początku miesiąca do dzisiaj
                const dObj = new Date(dayItem.date);
                const dayOfWeek = dObj.getUTCDay(); // 0 = Niedziela
                const isPastOrToday = dayItem.date <= todayStr;
                const isSunday = dayOfWeek === 0;

                if (isPastOrToday && !isSunday && !dayItem.hasReport) {
                    missingReportsCount++;
                }
            });

            return NextResponse.json({
                month: monthParam,
                days: daysList,
                stats: {
                    monthProduced,
                    monthSold,
                    monthBakeryIncome,
                    monthFiscalIncome,
                    missingReportsCount,
                    totalDaysInMonth: daysInMonth,
                },
            });
        }

        // -------------------------------------------------------------
        // TRYB 2: SZCZEGÓŁOWY RAPORT POJEDYNCZEGO DNIA
        // -------------------------------------------------------------
        const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
        const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

        // 1. Wszystkie wyroby
        const products = await prisma.bakeryProduct.findMany({
            orderBy: { name: "asc" },
        });

        // 2. Raporty produkcyjne dla danej daty
        const productions = await prisma.dailyProduction.findMany({
            where: {
                date: targetDate,
            },
        });

        // 3. Utarg fiskalny i godziny wyprzedania
        let fiscalIncome = extras[dateStr]?.fiscalIncome || 0;
        try {
            if ((prisma as any).dailyIncome) {
                const dbInc = await (prisma as any).dailyIncome.findFirst({
                    where: { date: targetDate },
                });
                if (dbInc && Number(dbInc.incomeAmount) > 0) {
                    fiscalIncome = Number(dbInc.incomeAmount);
                }
            }
        } catch {
            // fallback do extras
        }

        const soldOutTimes = extras[dateStr]?.soldOutTimes || {};

        return NextResponse.json({
            date: dateStr,
            products,
            productions,
            fiscalIncome,
            soldOutTimes,
        });
    } catch (error: any) {
        console.error("Błąd pobierania raportu produkcji:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}

// POST: Zapis/Aktualizacja raportu w bazie
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { date, items, fiscalIncome } = body;

        if (!date || !Array.isArray(items)) {
            return NextResponse.json({ error: "Nieprawidłowe dane wejściowe" }, { status: 400 });
        }

        const targetDate = new Date(`${date}T00:00:00.000Z`);
        const numFiscalIncome = Math.max(0, parseFloat(String(fiscalIncome || "0").replace(",", ".")) || 0);

        // 1. Zapisujemy w lokalnym pliku extras (zapewnia natychmiastową trwałość godzin wyprzedania i utargu fiskalnego)
        const extras = getExtras();
        const soldOutTimesMap: Record<string, string> = {};

        items.forEach((item: any) => {
            if (item.soldOutTime && String(item.soldOutTime).trim()) {
                soldOutTimesMap[item.bakeryProductId] = String(item.soldOutTime).trim();
            }
        });

        extras[date] = {
            fiscalIncome: numFiscalIncome,
            soldOutTimes: soldOutTimesMap,
        };
        saveExtras(extras);

        // 2. Próba zapisu do tabeli DailyIncome w Postgresie (jeśli dostępna)
        try {
            if ((prisma as any).dailyIncome) {
                const existing = await (prisma as any).dailyIncome.findFirst({
                    where: { date: targetDate },
                });
                if (existing) {
                    await (prisma as any).dailyIncome.update({
                        where: { id: existing.id },
                        data: { incomeAmount: numFiscalIncome },
                    });
                } else {
                    await (prisma as any).dailyIncome.create({
                        data: { date: targetDate, incomeAmount: numFiscalIncome },
                    });
                }
            }
        } catch (e) {
            console.warn("Zapis do DailyIncome w DB pominięty (zapisano w metadanych):", e);
        }

        // 3. Zapis/Aktualizacja wpisów produkcji
        const operations = items.map((item: any) => {
            const producedAmt = Math.max(0, parseInt(item.producedAmount, 10) || 0);
            const soldAmt = Math.max(0, parseInt(item.soldAmount, 10) || 0);

            return prisma.dailyProduction.upsert({
                where: {
                    date_bakeryProductId: {
                        date: targetDate,
                        bakeryProductId: item.bakeryProductId,
                    },
                },
                update: {
                    producedAmount: producedAmt,
                    soldAmount: soldAmt,
                },
                create: {
                    date: targetDate,
                    bakeryProductId: item.bakeryProductId,
                    producedAmount: producedAmt,
                    soldAmount: soldAmt,
                },
            });
        });

        await prisma.$transaction(operations);

        return NextResponse.json({
            success: true,
            message: "Raport dzienny został pomyślnie zapisany!",
        });
    } catch (error: any) {
        console.error("Błąd zapisu raportu produkcji:", error);
        return NextResponse.json({ error: "Błąd zapisu w bazie danych", details: error.message }, { status: 500 });
    }
}