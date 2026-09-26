import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { getSystemSettings, saveSystemSettings, getClosingTimeForDate } from "@/lib/settings";
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

            // Pobieramy wszystkie wyroby
            const products = await prisma.bakeryProduct.findMany({
                orderBy: { name: "asc" },
                select: { id: true, name: true, type: true, sellingPrice: true, productionCost: true },
            });
            const productMap = new Map<string, typeof products[0]>();
            products.forEach((p) => {
                productMap.set(p.id, p);
            });

            // Pobieramy wszystkie wpisy produkcji w danym miesiącu
            const monthlyProductions = await prisma.dailyProduction.findMany({
                where: {
                    date: {
                        gte: firstDay,
                        lte: lastDay,
                    },
                },
                include: {
                    bakeryProduct: true,
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
                dbIncomes = [];
            }

            const dbIncomeMap = new Map<string, number>();
            dbIncomes.forEach((inc) => {
                const dStr = new Date(inc.date).toISOString().split("T")[0];
                dbIncomeMap.set(dStr, Number(inc.incomeAmount || 0));
            });

            const settings = getSystemSettings();
            const closedDaysMap = settings.closedDays || {};

            // Agregacja po dniach
            const daysMap: Record<
                string,
                {
                    date: string;
                    totalProduced: number;
                    totalCarriedOver: number;
                    totalAssortment: number;
                    totalSold: number;
                    bakerySalesIncome: number;
                    fiscalIncome: number;
                    hasReport: boolean;
                    isClosed: boolean;
                    closedReason?: string;
                    productsCount: number;
                    products: Array<{
                        productId: string;
                        productName: string;
                        productType: string;
                        sellingPrice: number;
                        producedAmount: number;
                        carriedOverAmount: number;
                        totalAssortment: number;
                        soldAmount: number;
                        salesIncome: number;
                        soldOutTime?: string;
                    }>;
                }
            > = {};

            // Inicjalizacja każdego dnia miesiąca
            const daysInMonth = lastDay.getUTCDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dateKey = `${monthParam}-${String(d).padStart(2, "0")}`;
                const fiscalFromExtras = extras[dateKey]?.fiscalIncome || 0;
                const fiscalFromDb = dbIncomeMap.get(dateKey) || 0;
                const closedInfo = closedDaysMap[dateKey];

                daysMap[dateKey] = {
                    date: dateKey,
                    totalProduced: 0,
                    totalCarriedOver: 0,
                    totalAssortment: 0,
                    totalSold: 0,
                    bakerySalesIncome: 0,
                    fiscalIncome: fiscalFromDb > 0 ? fiscalFromDb : fiscalFromExtras,
                    hasReport: false,
                    isClosed: !!closedInfo?.isClosed,
                    closedReason: closedInfo?.reason || "",
                    productsCount: 0,
                    products: [],
                };
            }

            // Agregacja miesięczna per produkt
            const monthlyProductMap = new Map<string, {
                productId: string;
                productName: string;
                productType: string;
                sellingPrice: number;
                producedAmount: number;
                carriedOverAmount: number;
                totalAssortment: number;
                soldAmount: number;
                salesIncome: number;
            }>();

            products.forEach((p) => {
                monthlyProductMap.set(p.id, {
                    productId: p.id,
                    productName: p.name,
                    productType: p.type,
                    sellingPrice: Number(p.sellingPrice || 0),
                    producedAmount: 0,
                    carriedOverAmount: 0,
                    totalAssortment: 0,
                    soldAmount: 0,
                    salesIncome: 0,
                });
            });

            // Sumowanie wpisów produkcji
            monthlyProductions.forEach((prod) => {
                const dStr = new Date(prod.date).toISOString().split("T")[0];
                if (!daysMap[dStr]) {
                    daysMap[dStr] = {
                        date: dStr,
                        totalProduced: 0,
                        totalCarriedOver: 0,
                        totalAssortment: 0,
                        totalSold: 0,
                        bakerySalesIncome: 0,
                        fiscalIncome: dbIncomeMap.get(dStr) || extras[dStr]?.fiscalIncome || 0,
                        hasReport: false,
                        productsCount: 0,
                        products: [],
                    };
                }

                const product = productMap.get(prod.bakeryProductId) || prod.bakeryProduct;
                const price = Number(product?.sellingPrice || 0);
                const produced = Number(prod.producedAmount || 0);
                const carriedOver = Number((prod as any).carriedOverAmount || 0);
                const totalAssortment = produced + carriedOver;
                const sold = Number(prod.soldAmount || 0);
                const income = Math.round(sold * price * 100) / 100;
                const soldOutTime = extras[dStr]?.soldOutTimes?.[prod.bakeryProductId] || prod.soldOutTime || "";

                if (produced > 0 || carriedOver > 0 || sold > 0) {
                    daysMap[dStr].hasReport = true;
                    daysMap[dStr].totalProduced += produced;
                    daysMap[dStr].totalCarriedOver += carriedOver;
                    daysMap[dStr].totalAssortment += totalAssortment;
                    daysMap[dStr].totalSold += sold;
                    daysMap[dStr].bakerySalesIncome += income;
                    daysMap[dStr].productsCount += 1;

                    daysMap[dStr].products.push({
                        productId: prod.bakeryProductId,
                        productName: product?.name || "Produkt",
                        productType: product?.type || "BREAD",
                        sellingPrice: price,
                        producedAmount: produced,
                        carriedOverAmount: carriedOver,
                        totalAssortment: totalAssortment,
                        soldAmount: sold,
                        salesIncome: income,
                        soldOutTime: soldOutTime || undefined,
                    });

                    // Dodaj do podsumowania miesięcznego
                    const mProd = monthlyProductMap.get(prod.bakeryProductId);
                    if (mProd) {
                        mProd.producedAmount += produced;
                        mProd.carriedOverAmount += carriedOver;
                        mProd.totalAssortment += totalAssortment;
                        mProd.soldAmount += sold;
                        mProd.salesIncome += income;
                    }
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
            let monthCarriedOver = 0;
            let monthAssortment = 0;
            let monthSold = 0;
            let monthBakeryIncome = 0;
            let monthFiscalIncome = 0;
            let missingReportsCount = 0;

            const daysList = Object.values(daysMap).sort((a, b) => b.date.localeCompare(a.date));

            Object.values(daysMap).forEach((dayItem) => {
                monthProduced += dayItem.totalProduced;
                monthCarriedOver += dayItem.totalCarriedOver;
                monthAssortment += dayItem.totalAssortment;
                monthSold += dayItem.totalSold;
                monthBakeryIncome += dayItem.bakerySalesIncome;
                monthFiscalIncome += dayItem.fiscalIncome;

                const dObj = new Date(dayItem.date);
                const dayOfWeek = dObj.getUTCDay();
                const isPastOrToday = dayItem.date <= todayStr;
                const isSunday = dayOfWeek === 0;

                if (isPastOrToday && !isSunday && !dayItem.hasReport && !dayItem.isClosed) {
                    missingReportsCount++;
                }
            });

            const monthlyProducts = Array.from(monthlyProductMap.values()).map((p) => ({
                ...p,
                sellThroughRate: p.totalAssortment > 0 ? Math.round((p.soldAmount / p.totalAssortment) * 1000) / 10 : (p.producedAmount > 0 ? Math.round((p.soldAmount / p.producedAmount) * 1000) / 10 : 0),
            })).sort((a, b) => b.soldAmount - a.soldAmount);

            return NextResponse.json({
                month: monthParam,
                days: daysList,
                products,
                monthlyProducts,
                closedDays: closedDaysMap,
                openingHours: settings.openingHours,
                stats: {
                    monthProduced,
                    monthCarriedOver,
                    monthAssortment,
                    monthSold,
                    monthBakeryIncome,
                    monthFiscalIncome,
                    missingReportsCount,
                    totalDaysInMonth: daysInMonth,
                },
            });
        }

        // -------------------------------------------------------------
        // TRYB 3: ANALITYKA I WYKRESY (mode === "analytics")
        // Obsługa: ostatnie 7 dni, ostatnie tygodnie, ostatnie miesiące
        // -------------------------------------------------------------
        if (mode === "analytics") {
            const rangeType = searchParams.get("type") || "days"; // "days" | "weeks" | "months"
            const count = Math.min(24, Math.max(1, parseInt(searchParams.get("count") || (rangeType === "days" ? "7" : "6"), 10)));
            const offset = parseInt(searchParams.get("offset") || "0", 10);
            const anchorParam = searchParams.get("anchorDate") || new Date().toISOString().split("T")[0];

            interface CategoryMetric {
                produced: number;
                sold: number;
                unsold: number;
                income: number;
            }

            interface BucketData {
                id: string;
                label: string;
                subLabel?: string;
                startDate: string;
                endDate: string;
                isClosed?: boolean;
                hasReport?: boolean;
                BREAD: CategoryMetric;
                ROLL: CategoryMetric;
                SWEET: CategoryMetric;
                SAVORY: CategoryMetric;
                totalProduced: number;
                totalSold: number;
                totalUnsold: number;
                totalIncome: number;
                sellThroughRate: number;
                products: Array<{
                    id: string;
                    name: string;
                    type: string;
                    produced: number;
                    sold: number;
                    unsold: number;
                    income: number;
                }>;
            }

            const buckets: BucketData[] = [];
            const POLISH_DAYS_SHORT = ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
            const POLISH_MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

            if (rangeType === "days") {
                const anchorDate = new Date(`${anchorParam}T00:00:00.000Z`);
                const endTimestamp = anchorDate.getTime() - (offset * count * 86400000);
                
                for (let i = count - 1; i >= 0; i--) {
                    const currentD = new Date(endTimestamp - (i * 86400000));
                    const dStr = currentD.toISOString().split("T")[0];
                    const dayOfWeek = currentD.getUTCDay();
                    const dayNum = String(currentD.getUTCDate()).padStart(2, "0");
                    const monthNum = String(currentD.getUTCMonth() + 1).padStart(2, "0");
                    const label = `${POLISH_DAYS_SHORT[dayOfWeek]} ${dayNum}.${monthNum}`;

                    buckets.push({
                        id: dStr,
                        label,
                        subLabel: dStr,
                        startDate: dStr,
                        endDate: dStr,
                        BREAD: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        ROLL: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        SWEET: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        SAVORY: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        totalProduced: 0,
                        totalSold: 0,
                        totalUnsold: 0,
                        totalIncome: 0,
                        sellThroughRate: 0,
                        products: [],
                    });
                }
            } else if (rangeType === "weeks") {
                const anchorDate = new Date(`${anchorParam}T00:00:00.000Z`);
                const dayOfWeek = (anchorDate.getUTCDay() + 6) % 7;
                const currentWeekMonday = new Date(anchorDate.getTime() - (dayOfWeek * 86400000));
                const baseMondayTs = currentWeekMonday.getTime() - (offset * count * 7 * 86400000);

                for (let i = count - 1; i >= 0; i--) {
                    const mon = new Date(baseMondayTs - (i * 7 * 86400000));
                    const sun = new Date(mon.getTime() + (6 * 86400000));
                    const monStr = mon.toISOString().split("T")[0];
                    const sunStr = sun.toISOString().split("T")[0];
                    const label = `${String(mon.getUTCDate()).padStart(2, "0")}.${String(mon.getUTCMonth() + 1).padStart(2, "0")} - ${String(sun.getUTCDate()).padStart(2, "0")}.${String(sun.getUTCMonth() + 1).padStart(2, "0")}`;

                    buckets.push({
                        id: `W_${monStr}`,
                        label,
                        subLabel: `${monStr} do ${sunStr}`,
                        startDate: monStr,
                        endDate: sunStr,
                        BREAD: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        ROLL: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        SWEET: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        SAVORY: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        totalProduced: 0,
                        totalSold: 0,
                        totalUnsold: 0,
                        totalIncome: 0,
                        sellThroughRate: 0,
                        products: [],
                    });
                }
            } else if (rangeType === "months") {
                const anchorDate = new Date(`${anchorParam}T00:00:00.000Z`);
                const curYear = anchorDate.getUTCFullYear();
                const curMonth = anchorDate.getUTCMonth();

                for (let i = count - 1; i >= 0; i--) {
                    const totalMonthIndex = (curYear * 12 + curMonth) - (offset * count) - i;
                    const y = Math.floor(totalMonthIndex / 12);
                    const m = ((totalMonthIndex % 12) + 12) % 12;
                    
                    const firstDay = new Date(Date.UTC(y, m, 1));
                    const lastDay = new Date(Date.UTC(y, m + 1, 0));
                    const monStr = firstDay.toISOString().split("T")[0];
                    const sunStr = lastDay.toISOString().split("T")[0];
                    const label = `${POLISH_MONTHS_SHORT[m]} ${y}`;

                    buckets.push({
                        id: `M_${y}-${String(m + 1).padStart(2, "0")}`,
                        label,
                        subLabel: `${y}-${String(m + 1).padStart(2, "0")}`,
                        startDate: monStr,
                        endDate: sunStr,
                        BREAD: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        ROLL: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        SWEET: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        SAVORY: { produced: 0, sold: 0, unsold: 0, income: 0 },
                        totalProduced: 0,
                        totalSold: 0,
                        totalUnsold: 0,
                        totalIncome: 0,
                        sellThroughRate: 0,
                        products: [],
                    });
                }
            }

            if (buckets.length === 0) {
                return NextResponse.json({ buckets: [] });
            }

            const globalStartDate = new Date(`${buckets[0].startDate}T00:00:00.000Z`);
            const globalEndDate = new Date(`${buckets[buckets.length - 1].endDate}T23:59:59.999Z`);

            const productions = await prisma.dailyProduction.findMany({
                where: {
                    date: {
                        gte: globalStartDate,
                        lte: globalEndDate,
                    },
                },
                include: {
                    bakeryProduct: true,
                },
            });

            for (const prod of productions) {
                const pDateStr = new Date(prod.date).toISOString().split("T")[0];
                const bucket = buckets.find((b) => pDateStr >= b.startDate && pDateStr <= b.endDate);
                if (!bucket) continue;

                const cat = (prod.bakeryProduct?.type as "BREAD" | "ROLL" | "SWEET" | "SAVORY") || "BREAD";
                const produced = Number(prod.producedAmount || 0);
                const sold = Number(prod.soldAmount || 0);
                const price = Number(prod.bakeryProduct?.sellingPrice || 0);
                const income = Math.round(sold * price * 100) / 100;
                const unsold = Math.max(0, produced - sold);

                if (bucket[cat]) {
                    bucket[cat].produced += produced;
                    bucket[cat].sold += sold;
                    bucket[cat].unsold += unsold;
                    bucket[cat].income += income;
                }

                bucket.totalProduced += produced;
                bucket.totalSold += sold;
                bucket.totalUnsold += unsold;
                bucket.totalIncome += income;
                if (produced > 0 || sold > 0) {
                    bucket.hasReport = true;
                }

                let pEntry = bucket.products.find((p) => p.id === prod.bakeryProductId);
                if (!pEntry) {
                    pEntry = {
                        id: prod.bakeryProductId,
                        name: prod.bakeryProduct?.name || "Wyrób",
                        type: cat,
                        produced: 0,
                        sold: 0,
                        unsold: 0,
                        income: 0,
                    };
                    bucket.products.push(pEntry);
                }
                pEntry.produced += produced;
                pEntry.sold += sold;
                pEntry.unsold += unsold;
                pEntry.income += income;
            }

            let grandTotalProduced = 0;
            let grandTotalSold = 0;
            let grandTotalUnsold = 0;
            let grandTotalIncome = 0;

            for (const b of buckets) {
                b.sellThroughRate = b.totalProduced > 0 ? Math.round((b.totalSold / b.totalProduced) * 1000) / 10 : 0;
                b.products.sort((p1, p2) => p2.sold - p1.sold);

                grandTotalProduced += b.totalProduced;
                grandTotalSold += b.totalSold;
                grandTotalUnsold += b.totalUnsold;
                grandTotalIncome += b.totalIncome;
            }

            const grandSellThroughRate = grandTotalProduced > 0 ? Math.round((grandTotalSold / grandTotalProduced) * 1000) / 10 : 0;

            return NextResponse.json({
                rangeType,
                count,
                offset,
                startDate: buckets[0].startDate,
                endDate: buckets[buckets.length - 1].endDate,
                buckets,
                totalStats: {
                    totalProduced: grandTotalProduced,
                    totalSold: grandTotalSold,
                    totalUnsold: grandTotalUnsold,
                    totalIncome: grandTotalIncome,
                    sellThroughRate: grandSellThroughRate,
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
        const settings = getSystemSettings();
        const defaultClosingTime = getClosingTimeForDate(dateStr, settings);
        const closedInfo = settings.closedDays?.[dateStr];

        return NextResponse.json({
            date: dateStr,
            products,
            productions,
            fiscalIncome,
            soldOutTimes,
            defaultClosingTime,
            isClosed: !!closedInfo?.isClosed,
            closedReason: closedInfo?.reason || "",
            openingHours: settings.openingHours,
        });
    } catch (error: any) {
        console.error("Błąd pobierania raportu produkcji:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}

// POST: Zapis/Aktualizacja raportu w bazie lub przeniesienie niesprzedanych wyrobów
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const user = await getUserFromRequest(request);

        // -------------------------------------------------------------
        // OBSŁUGA OZNACZENIA / OZNACZENIA DNIA JAKO ZAMKNIĘTEGO (np. remont, święto)
        // -------------------------------------------------------------
        if (body.action === "toggle_closed_day" || body.action === "set_closed_day") {
            const { date: targetDateStr, isClosed, reason } = body;
            if (!targetDateStr) {
                return NextResponse.json({ error: "Brak daty" }, { status: 400 });
            }
            const settings = getSystemSettings();
            const closedDays = { ...(settings.closedDays || {}) };
            if (isClosed) {
                closedDays[targetDateStr] = {
                    isClosed: true,
                    reason: String(reason || "Dzień zamknięty (remont / święto)").trim(),
                    updatedAt: new Date().toISOString(),
                };
            } else {
                delete closedDays[targetDateStr];
            }
            saveSystemSettings({ closedDays });
            return NextResponse.json({
                success: true,
                date: targetDateStr,
                isClosed: !!isClosed,
                reason: isClosed ? closedDays[targetDateStr]?.reason : "",
                closedDays,
            });
        }

        // -------------------------------------------------------------
        // OBSŁUGA PRZENIESIENIA NIESPRZEDANYCH WYROBÓW NA NASTĘPNY DZIEŃ
        // -------------------------------------------------------------
        if (body.action === "transfer_leftovers") {
            const { targetDate: targetDateStr, items } = body;
            if (!targetDateStr || !Array.isArray(items)) {
                return NextResponse.json({ error: "Brak docelowej daty lub pozycji do przeniesienia" }, { status: 400 });
            }

            const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);

            const transferOps = items
                .map((item: any) => {
                    const carriedOver = Math.max(0, parseFloat(String(item.leftoverAmount || item.carriedOverAmount || "0").replace(",", ".")) || 0);
                    if (carriedOver <= 0) return null;

                    return prisma.dailyProduction.upsert({
                        where: {
                            date_bakeryProductId: {
                                date: targetDate,
                                bakeryProductId: item.bakeryProductId,
                            },
                        },
                        update: {
                            carriedOverAmount: carriedOver,
                            ...(user?.id ? { createdById: user.id } : {}),
                        },
                        create: {
                            date: targetDate,
                            bakeryProductId: item.bakeryProductId,
                            producedAmount: 0,
                            carriedOverAmount: carriedOver,
                            soldAmount: 0,
                            ...(user?.id ? { createdById: user.id } : {}),
                        },
                    });
                })
                .filter(Boolean);

            if (transferOps.length > 0) {
                await prisma.$transaction(transferOps as any);
            }

            return NextResponse.json({
                success: true,
                message: `Pomyślnie przeniesiono ${transferOps.length} pozycji na dzień ${targetDateStr}!`,
            });
        }

        // -------------------------------------------------------------
        // ZWYKŁY ZAPIS RAPORTU DZIENNEGO
        // -------------------------------------------------------------
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
                        data: {
                            incomeAmount: numFiscalIncome,
                            ...(user?.id ? { createdById: user.id } : {}),
                        },
                    });
                } else {
                    await (prisma as any).dailyIncome.create({
                        data: {
                            date: targetDate,
                            incomeAmount: numFiscalIncome,
                            ...(user?.id ? { createdById: user.id } : {}),
                        },
                    });
                }
            }
        } catch (e) {
            console.warn("Zapis do DailyIncome w DB pominięty (zapisano w metadanych):", e);
        }

        // 3. Zapis/Aktualizacja wpisów produkcji
        const operations = items.map((item: any) => {
            const producedAmt = Math.max(0, parseFloat(String(item.producedAmount).replace(",", ".")) || 0);
            const carriedOverAmt = Math.max(0, parseFloat(String(item.carriedOverAmount || "0").replace(",", ".")) || 0);
            const soldAmt = Math.max(0, parseFloat(String(item.soldAmount).replace(",", ".")) || 0);

            return prisma.dailyProduction.upsert({
                where: {
                    date_bakeryProductId: {
                        date: targetDate,
                        bakeryProductId: item.bakeryProductId,
                    },
                },
                update: {
                    producedAmount: producedAmt,
                    carriedOverAmount: carriedOverAmt,
                    soldAmount: soldAmt,
                    ...(user?.id ? { createdById: user.id } : {}),
                },
                create: {
                    date: targetDate,
                    bakeryProductId: item.bakeryProductId,
                    producedAmount: producedAmt,
                    carriedOverAmount: carriedOverAmt,
                    soldAmount: soldAmt,
                    ...(user?.id ? { createdById: user.id } : {}),
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