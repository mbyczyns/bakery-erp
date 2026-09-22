import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { getCustomNamesMap } from "@/lib/contractor-names";

const prisma = new PrismaClient();

// Ścieżka do lokalnego pliku metadanych (fallback dla utargu fiskalnego)
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

const POLISH_WEEKDAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const POLISH_SHORT_WEEKDAYS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
const POLISH_MONTHS_FULL = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];
const MONTH_SHORT_NAMES = [
    "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
    "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"
];

function getISOWeekInfo(date: Date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const weekYear = d.getUTCFullYear();

    const monday = new Date(date);
    const day = monday.getDay();
    const diffToMonday = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const pad = (n: number) => String(n).padStart(2, "0");
    const formatD = (dt: Date) => `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}`;
    const label = `Tydzień ${weekNo} (${formatD(monday)} - ${formatD(sunday)}.${sunday.getFullYear()})`;
    const shortLabel = `T${weekNo} (${formatD(monday)}-${formatD(sunday)})`;
    const key = `${weekYear}-W${pad(weekNo)}`;

    return {
        key,
        weekNumber: weekNo,
        year: weekYear,
        label,
        shortLabel,
        startDate: monday.toISOString().split("T")[0],
        endDate: sunday.toISOString().split("T")[0],
        mondayDate: monday,
    };
}

export async function GET(request: NextRequest) {
    try {
        const extras = getExtras();
        const customNamesMap = getCustomNamesMap();

        // 1. Pobierz wszystkie wyroby piekarnicze
        const products = await prisma.bakeryProduct.findMany({
            select: {
                id: true,
                name: true,
                type: true,
                sellingPrice: true,
                productionCost: true,
            },
        });

        const productMap = new Map<
            string,
            { id: string; name: string; type: string; sellingPrice: number; productionCost: number }
        >();
        products.forEach((p) => {
            productMap.set(p.id, {
                id: p.id,
                name: p.name,
                type: p.type,
                sellingPrice: Number(p.sellingPrice || 0),
                productionCost: Number(p.productionCost || 0),
            });
        });

        // 2. Pobierz wszystkie wpisy DailyProduction
        const productions = await prisma.dailyProduction.findMany({
            orderBy: {
                date: "asc",
            },
        });

        // 3. Pobierz DailyIncome z bazy (lub fallback do extras)
        let dbIncomes: Array<{ date: Date; incomeAmount: any }> = [];
        try {
            if ((prisma as any).dailyIncome) {
                dbIncomes = await (prisma as any).dailyIncome.findMany({
                    orderBy: { date: "asc" },
                });
            }
        } catch {
            dbIncomes = [];
        }

        const fiscalIncomeMap = new Map<string, number>();
        // Wypełnij z extras
        Object.entries(extras).forEach(([dKey, val]) => {
            if (val.fiscalIncome && val.fiscalIncome > 0) {
                fiscalIncomeMap.set(dKey, Number(val.fiscalIncome));
            }
        });
        // Nadpisz z bazy danych jeśli istnieje
        dbIncomes.forEach((inc) => {
            const dStr = new Date(inc.date).toISOString().split("T")[0];
            const amt = Number(inc.incomeAmount || 0);
            if (amt > 0) {
                fiscalIncomeMap.set(dStr, amt);
            }
        });

        // 4. Pobierz FAKTURY SPRZEDAŻOWE (isSales: true)
        const salesInvoicesDb = await prisma.invoice.findMany({
            where: {
                isSales: true,
                status: { not: "REJECTED" },
            },
            include: {
                contractor: true,
                positions: true,
            },
            orderBy: {
                issuedDate: "desc",
            },
        });

        // Formatowanie faktur sprzedażowych
        interface SalesInvoiceFormatted {
            id: string;
            invoiceNumber: string;
            ksefNumber: string;
            contractorId: string;
            contractorName: string;
            issuedDate: string;
            dueDate: string;
            status: string;
            grossAmount: number;
            netAmount: number;
            vatAmount: number;
            positionsCount: number;
            positions: Array<{
                id: string;
                name: string;
                quantity: number;
                unit: string;
                netPrice: number;
                netAmount: number;
                grossAmount: number;
            }>;
        }

        const formattedSalesInvoices: SalesInvoiceFormatted[] = salesInvoicesDb.map((inv) => {
            const contractorName =
                customNamesMap[inv.contractorId] ||
                (inv.contractor as any)?.customName ||
                inv.contractor?.name ||
                "Nieznany kontrahent";

            const positions = (inv.positions || []).map((pos) => ({
                id: pos.id,
                name: pos.name,
                quantity: Number(pos.quantity || 0),
                unit: pos.unit || "szt",
                netPrice: Number(pos.netPrice || 0),
                netAmount: Number(pos.netAmount || 0),
                grossAmount: Number(pos.grossAmount || 0),
            }));

            return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                ksefNumber: inv.ksefNumber,
                contractorId: inv.contractorId,
                contractorName,
                issuedDate: inv.issuedDate ? new Date(inv.issuedDate).toISOString().split("T")[0] : "",
                dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : "",
                status: inv.status,
                grossAmount: Math.round(Number(inv.grossAmount || 0) * 100) / 100,
                netAmount: Math.round(Number(inv.netAmount || 0) * 100) / 100,
                vatAmount: Math.round(Number(inv.vatAmount || 0) * 100) / 100,
                positionsCount: positions.length,
                positions,
            };
        });

        // Mapa faktur sprzedażowych wg miesiąca: "YYYY-MM" -> SalesInvoiceFormatted[]
        const salesInvoicesByMonthMap = new Map<string, SalesInvoiceFormatted[]>();
        formattedSalesInvoices.forEach((inv) => {
            if (!inv.issuedDate) return;
            const ymKey = inv.issuedDate.slice(0, 7); // "YYYY-MM"
            const list = salesInvoicesByMonthMap.get(ymKey) || [];
            list.push(inv);
            salesInvoicesByMonthMap.set(ymKey, list);
        });

        // 5. Budujemy mapę dzienną (Dni zawierają WYŁĄCZNIE utarg detaliczny ze sklepu)
        interface DayProductDetail {
            productId: string;
            productName: string;
            productType: string;
            producedAmount: number;
            soldAmount: number;
            sellingPrice: number;
            salesIncome: number;
        }

        interface DailyAggregate {
            date: string; // YYYY-MM-DD
            dayOfWeek: string;
            shortDay: string;
            isWeekend: boolean;
            rawDate: Date;
            bakerySalesIncome: number;
            fiscalIncome: number;
            otherIncome: number;
            totalIncome: number;
            bakerySharePercent: number;
            otherSharePercent: number;
            totalProduced: number;
            totalSold: number;
            sellThroughRate: number;
            hasReport: boolean;
            categoryBreakdown: {
                BREAD: number;
                ROLL: number;
                SWEET: number;
                SAVORY: number;
            };
            products: DayProductDetail[];
        }

        const dailyMap = new Map<string, DailyAggregate>();

        const getOrCreateDaily = (dateObj: Date): DailyAggregate => {
            const dateStr = dateObj.toISOString().split("T")[0];
            let existing = dailyMap.get(dateStr);
            if (!existing) {
                const dayIndex = dateObj.getDay();
                const isWeekend = dayIndex === 0 || dayIndex === 6;
                const fiscal = fiscalIncomeMap.get(dateStr) || 0;
                existing = {
                    date: dateStr,
                    dayOfWeek: POLISH_WEEKDAYS[dayIndex],
                    shortDay: POLISH_SHORT_WEEKDAYS[dayIndex],
                    isWeekend,
                    rawDate: new Date(dateStr),
                    bakerySalesIncome: 0,
                    fiscalIncome: fiscal,
                    otherIncome: 0,
                    totalIncome: 0,
                    bakerySharePercent: 0,
                    otherSharePercent: 0,
                    totalProduced: 0,
                    totalSold: 0,
                    sellThroughRate: 0,
                    hasReport: fiscal > 0,
                    categoryBreakdown: {
                        BREAD: 0,
                        ROLL: 0,
                        SWEET: 0,
                        SAVORY: 0,
                    },
                    products: [],
                };
                dailyMap.set(dateStr, existing);
            }
            return existing;
        };

        // Zarejestruj wszystkie daty z utargów fiskalnych
        fiscalIncomeMap.forEach((_, dateStr) => {
            getOrCreateDaily(new Date(dateStr));
        });

        // Agregacja wpisów produkcji
        productions.forEach((prod) => {
            const prodDate = new Date(prod.date);
            const daily = getOrCreateDaily(prodDate);
            const pInfo = productMap.get(prod.bakeryProductId);

            const produced = Number(prod.producedAmount || 0);
            const sold = Number(prod.soldAmount || 0);
            const price = pInfo ? pInfo.sellingPrice : 0;
            const salesIncome = Math.round(sold * price * 100) / 100;

            if (produced > 0 || sold > 0) {
                daily.hasReport = true;
            }

            daily.totalProduced += produced;
            daily.totalSold += sold;
            daily.bakerySalesIncome += salesIncome;

            const cat = (pInfo?.type || "BREAD") as "BREAD" | "ROLL" | "SWEET" | "SAVORY";
            if (daily.categoryBreakdown[cat] !== undefined) {
                daily.categoryBreakdown[cat] += salesIncome;
            }

            if (pInfo && (produced > 0 || sold > 0)) {
                daily.products.push({
                    productId: pInfo.id,
                    productName: pInfo.name,
                    productType: pInfo.type,
                    producedAmount: produced,
                    soldAmount: sold,
                    sellingPrice: price,
                    salesIncome,
                });
            }
        });

        // Przeliczenie ostatecznych wartości dziennych (Utarg dzienny ze sprzedaży w piekarni)
        const allDailyData = Array.from(dailyMap.values()).map((d) => {
            d.bakerySalesIncome = Math.round(d.bakerySalesIncome * 100) / 100;
            d.fiscalIncome = Math.round(d.fiscalIncome * 100) / 100;

            // Utarg detaliczny / sklepik (kasa fiskalna lub wyliczenie ze sprzedanego pieczywa)
            const retailIncome = Math.max(d.fiscalIncome, d.bakerySalesIncome);
            const otherRetailIncome = Math.max(0, d.fiscalIncome - d.bakerySalesIncome);

            // Całkowity utarg danego dnia = utarg detaliczny (nie mieszamy tu faktur miesięcznych)
            const totalDayIncome = Math.round(retailIncome * 100) / 100;

            const bakeryShare = totalDayIncome > 0
                ? Math.round((d.bakerySalesIncome / totalDayIncome) * 1000) / 10
                : 0;
            const otherShare = totalDayIncome > 0
                ? Math.round((otherRetailIncome / totalDayIncome) * 1000) / 10
                : 0;

            const sellThrough = d.totalProduced > 0
                ? Math.round((d.totalSold / d.totalProduced) * 1000) / 10
                : 0;

            // Sortowanie produktów w danym dniu wg przychodu malejąco
            d.products.sort((a, b) => b.salesIncome - a.salesIncome);

            return {
                date: d.date,
                dayOfWeek: d.dayOfWeek,
                shortDay: d.shortDay,
                isWeekend: d.isWeekend,
                rawDate: d.rawDate,
                bakerySalesIncome: d.bakerySalesIncome,
                fiscalIncome: d.fiscalIncome,
                otherIncome: Math.round(otherRetailIncome * 100) / 100,
                totalIncome: totalDayIncome,
                bakerySharePercent: bakeryShare,
                otherSharePercent: otherShare,
                totalProduced: d.totalProduced,
                totalSold: d.totalSold,
                sellThroughRate: sellThrough,
                hasReport: d.hasReport,
                categoryBreakdown: {
                    BREAD: Math.round(d.categoryBreakdown.BREAD * 100) / 100,
                    ROLL: Math.round(d.categoryBreakdown.ROLL * 100) / 100,
                    SWEET: Math.round(d.categoryBreakdown.SWEET * 100) / 100,
                    SAVORY: Math.round(d.categoryBreakdown.SAVORY * 100) / 100,
                },
                products: d.products,
            };
        });

        allDailyData.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

        // 6. Agregacja tygodniowa (ISO weeks - retail store operations)
        const weeklyMap = new Map<
            string,
            {
                key: string;
                weekNumber: number;
                year: number;
                label: string;
                shortLabel: string;
                startDate: string;
                endDate: string;
                mondayDate: Date;
                totalIncome: number;
                bakerySalesIncome: number;
                otherIncome: number;
                totalProduced: number;
                totalSold: number;
                daysWithReport: number;
                categoryBreakdown: {
                    BREAD: number;
                    ROLL: number;
                    SWEET: number;
                    SAVORY: number;
                };
            }
        >();

        allDailyData.forEach((d) => {
            const wInfo = getISOWeekInfo(d.rawDate);
            let w = weeklyMap.get(wInfo.key);
            if (!w) {
                w = {
                    ...wInfo,
                    totalIncome: 0,
                    bakerySalesIncome: 0,
                    otherIncome: 0,
                    totalProduced: 0,
                    totalSold: 0,
                    daysWithReport: 0,
                    categoryBreakdown: {
                        BREAD: 0,
                        ROLL: 0,
                        SWEET: 0,
                        SAVORY: 0,
                    },
                };
                weeklyMap.set(wInfo.key, w);
            }

            w.totalIncome += d.totalIncome;
            w.bakerySalesIncome += d.bakerySalesIncome;
            w.otherIncome += d.otherIncome;
            w.totalProduced += d.totalProduced;
            w.totalSold += d.totalSold;
            if (d.hasReport) w.daysWithReport += 1;

            w.categoryBreakdown.BREAD += d.categoryBreakdown.BREAD;
            w.categoryBreakdown.ROLL += d.categoryBreakdown.ROLL;
            w.categoryBreakdown.SWEET += d.categoryBreakdown.SWEET;
            w.categoryBreakdown.SAVORY += d.categoryBreakdown.SAVORY;
        });

        const weeklyDataList = Array.from(weeklyMap.values()).map((w) => {
            const bakeryShare = w.totalIncome > 0
                ? Math.round((w.bakerySalesIncome / w.totalIncome) * 1000) / 10
                : 0;
            const otherShare = w.totalIncome > 0
                ? Math.round((w.otherIncome / w.totalIncome) * 1000) / 10
                : 0;

            const avgDaily = w.daysWithReport > 0
                ? Math.round((w.totalIncome / w.daysWithReport) * 100) / 100
                : Math.round((w.totalIncome / 7) * 100) / 100;
            const sellThrough = w.totalProduced > 0
                ? Math.round((w.totalSold / w.totalProduced) * 1000) / 10
                : 0;

            return {
                key: w.key,
                weekNumber: w.weekNumber,
                year: w.year,
                label: w.label,
                shortLabel: w.shortLabel,
                startDate: w.startDate,
                endDate: w.endDate,
                mondayDate: w.mondayDate,
                totalIncome: Math.round(w.totalIncome * 100) / 100,
                bakerySalesIncome: Math.round(w.bakerySalesIncome * 100) / 100,
                otherIncome: Math.round(w.otherIncome * 100) / 100,
                bakerySharePercent: bakeryShare,
                otherSharePercent: otherShare,
                avgDailyIncome: avgDaily,
                totalProduced: w.totalProduced,
                totalSold: w.totalSold,
                sellThroughRate: sellThrough,
                daysWithReport: w.daysWithReport,
                categoryBreakdown: {
                    BREAD: Math.round(w.categoryBreakdown.BREAD * 100) / 100,
                    ROLL: Math.round(w.categoryBreakdown.ROLL * 100) / 100,
                    SWEET: Math.round(w.categoryBreakdown.SWEET * 100) / 100,
                    SAVORY: Math.round(w.categoryBreakdown.SAVORY * 100) / 100,
                },
            };
        });

        weeklyDataList.sort((a, b) => b.mondayDate.getTime() - a.mondayDate.getTime());

        // 7. Agregacja miesięczna (TUTAJ WŁICZANE SĄ FAKTURY SPRZEDAŻOWE ZA CAŁY MIESIĄC)
        const monthlyMap = new Map<
            string,
            {
                key: string;
                year: number;
                monthIndex: number;
                label: string;
                shortLabel: string;
                monthDate: Date;
                retailIncome: number;
                bakerySalesIncome: number;
                otherIncome: number;
                salesInvoicesGross: number;
                salesInvoicesNet: number;
                salesInvoicesCount: number;
                salesInvoices: SalesInvoiceFormatted[];
                totalIncome: number;
                totalProduced: number;
                totalSold: number;
                daysWithReport: number;
                daysInMonth: number;
                categoryBreakdown: {
                    BREAD: number;
                    ROLL: number;
                    SWEET: number;
                    SAVORY: number;
                };
            }
        >();

        // Agregacja dni do miesięcy
        allDailyData.forEach((d) => {
            const ymKey = `${d.rawDate.getFullYear()}-${String(d.rawDate.getMonth() + 1).padStart(2, "0")}`;
            let m = monthlyMap.get(ymKey);
            if (!m) {
                const y = d.rawDate.getFullYear();
                const mIdx = d.rawDate.getMonth();
                const lastDayOfM = new Date(y, mIdx + 1, 0).getDate();
                m = {
                    key: ymKey,
                    year: y,
                    monthIndex: mIdx,
                    label: `${POLISH_MONTHS_FULL[mIdx]} ${y}`,
                    shortLabel: `${MONTH_SHORT_NAMES[mIdx]} ${String(y).slice(-2)}`,
                    monthDate: new Date(y, mIdx, 1),
                    retailIncome: 0,
                    bakerySalesIncome: 0,
                    otherIncome: 0,
                    salesInvoicesGross: 0,
                    salesInvoicesNet: 0,
                    salesInvoicesCount: 0,
                    salesInvoices: [],
                    totalIncome: 0,
                    totalProduced: 0,
                    totalSold: 0,
                    daysWithReport: 0,
                    daysInMonth: lastDayOfM,
                    categoryBreakdown: {
                        BREAD: 0,
                        ROLL: 0,
                        SWEET: 0,
                        SAVORY: 0,
                    },
                };
                monthlyMap.set(ymKey, m);
            }

            m.retailIncome += d.totalIncome;
            m.bakerySalesIncome += d.bakerySalesIncome;
            m.otherIncome += d.otherIncome;
            m.totalProduced += d.totalProduced;
            m.totalSold += d.totalSold;
            if (d.hasReport) m.daysWithReport += 1;

            m.categoryBreakdown.BREAD += d.categoryBreakdown.BREAD;
            m.categoryBreakdown.ROLL += d.categoryBreakdown.ROLL;
            m.categoryBreakdown.SWEET += d.categoryBreakdown.SWEET;
            m.categoryBreakdown.SAVORY += d.categoryBreakdown.SAVORY;
        });

        // Dołącz faktury sprzedażowe do odpowiednich miesięcy
        salesInvoicesByMonthMap.forEach((invoicesList, ymKey) => {
            let m = monthlyMap.get(ymKey);
            if (!m) {
                const [yStr, mStr] = ymKey.split("-");
                const y = parseInt(yStr, 10);
                const mIdx = parseInt(mStr, 10) - 1;
                const lastDayOfM = new Date(y, mIdx + 1, 0).getDate();
                m = {
                    key: ymKey,
                    year: y,
                    monthIndex: mIdx,
                    label: `${POLISH_MONTHS_FULL[mIdx]} ${y}`,
                    shortLabel: `${MONTH_SHORT_NAMES[mIdx]} ${String(y).slice(-2)}`,
                    monthDate: new Date(y, mIdx, 1),
                    retailIncome: 0,
                    bakerySalesIncome: 0,
                    otherIncome: 0,
                    salesInvoicesGross: 0,
                    salesInvoicesNet: 0,
                    salesInvoicesCount: 0,
                    salesInvoices: [],
                    totalIncome: 0,
                    totalProduced: 0,
                    totalSold: 0,
                    daysWithReport: 0,
                    daysInMonth: lastDayOfM,
                    categoryBreakdown: {
                        BREAD: 0,
                        ROLL: 0,
                        SWEET: 0,
                        SAVORY: 0,
                    },
                };
                monthlyMap.set(ymKey, m);
            }

            m.salesInvoices = invoicesList;
            m.salesInvoicesCount = invoicesList.length;
            m.salesInvoicesGross = invoicesList.reduce((acc, i) => acc + i.grossAmount, 0);
            m.salesInvoicesNet = invoicesList.reduce((acc, i) => acc + i.netAmount, 0);
        });

        const monthlyDataList = Array.from(monthlyMap.values()).map((m) => {
            m.retailIncome = Math.round(m.retailIncome * 100) / 100;
            m.bakerySalesIncome = Math.round(m.bakerySalesIncome * 100) / 100;
            m.otherIncome = Math.round(m.otherIncome * 100) / 100;
            m.salesInvoicesGross = Math.round(m.salesInvoicesGross * 100) / 100;
            m.salesInvoicesNet = Math.round(m.salesInvoicesNet * 100) / 100;

            // Łączny przychód miesiąca = Utarg ze sklepu (detal) + Faktury sprzedażowe
            const totalMonthIncome = Math.round((m.retailIncome + m.salesInvoicesGross) * 100) / 100;

            const bakeryShare = totalMonthIncome > 0
                ? Math.round((m.bakerySalesIncome / totalMonthIncome) * 1000) / 10
                : 0;
            const otherShare = totalMonthIncome > 0
                ? Math.round((m.otherIncome / totalMonthIncome) * 1000) / 10
                : 0;
            const invoicesShare = totalMonthIncome > 0
                ? Math.round((m.salesInvoicesGross / totalMonthIncome) * 1000) / 10
                : 0;

            const avgDailyRetail = m.daysWithReport > 0
                ? Math.round((m.retailIncome / m.daysWithReport) * 100) / 100
                : 0;
            const sellThrough = m.totalProduced > 0
                ? Math.round((m.totalSold / m.totalProduced) * 1000) / 10
                : 0;

            return {
                key: m.key,
                year: m.year,
                monthIndex: m.monthIndex,
                label: m.label,
                shortLabel: m.shortLabel,
                monthDate: m.monthDate,
                retailIncome: m.retailIncome,
                bakerySalesIncome: m.bakerySalesIncome,
                otherIncome: m.otherIncome,
                salesInvoicesGross: m.salesInvoicesGross,
                salesInvoicesNet: m.salesInvoicesNet,
                salesInvoicesCount: m.salesInvoicesCount,
                salesInvoices: m.salesInvoices,
                totalIncome: totalMonthIncome,
                bakerySharePercent: bakeryShare,
                otherSharePercent: otherShare,
                salesInvoicesSharePercent: invoicesShare,
                avgDailyIncome: avgDailyRetail,
                totalProduced: m.totalProduced,
                totalSold: m.totalSold,
                sellThroughRate: sellThrough,
                daysWithReport: m.daysWithReport,
                daysInMonth: m.daysInMonth,
                categoryBreakdown: {
                    BREAD: Math.round(m.categoryBreakdown.BREAD * 100) / 100,
                    ROLL: Math.round(m.categoryBreakdown.ROLL * 100) / 100,
                    SWEET: Math.round(m.categoryBreakdown.SWEET * 100) / 100,
                    SAVORY: Math.round(m.categoryBreakdown.SAVORY * 100) / 100,
                },
            };
        });

        monthlyDataList.sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime());

        // 8. Ranking wyrobów (Całkowity przychód wg wyrobu)
        const productRankingMap = new Map<
            string,
            {
                productId: string;
                productName: string;
                productType: string;
                sellingPrice: number;
                totalProduced: number;
                totalSold: number;
                totalRevenue: number;
            }
        >();

        let grandTotalBakeryIncome = 0;

        allDailyData.forEach((d) => {
            d.products.forEach((p) => {
                let pr = productRankingMap.get(p.productId);
                if (!pr) {
                    pr = {
                        productId: p.productId,
                        productName: p.productName,
                        productType: p.productType,
                        sellingPrice: p.sellingPrice,
                        totalProduced: 0,
                        totalSold: 0,
                        totalRevenue: 0,
                    };
                    productRankingMap.set(p.productId, pr);
                }
                pr.totalProduced += p.producedAmount;
                pr.totalSold += p.soldAmount;
                pr.totalRevenue += p.salesIncome;
                grandTotalBakeryIncome += p.salesIncome;
            });
        });

        const productRanking = Array.from(productRankingMap.values())
            .map((pr) => ({
                ...pr,
                totalRevenue: Math.round(pr.totalRevenue * 100) / 100,
                sharePercent: grandTotalBakeryIncome > 0
                    ? Math.round((pr.totalRevenue / grandTotalBakeryIncome) * 1000) / 10
                    : 0,
                sellThroughRate: pr.totalProduced > 0
                    ? Math.round((pr.totalSold / pr.totalProduced) * 1000) / 10
                    : 0,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);

        // 9. Podsumowanie kontrahentów z faktur sprzedażowych (B2B)
        const contractorSalesMap = new Map<
            string,
            {
                contractorId: string;
                contractorName: string;
                totalGross: number;
                totalNet: number;
                invoicesCount: number;
                lastInvoiceDate: string;
            }
        >();

        let grandTotalSalesInvoicesGross = 0;
        let grandTotalSalesInvoicesNet = 0;

        formattedSalesInvoices.forEach((inv) => {
            grandTotalSalesInvoicesGross += inv.grossAmount;
            grandTotalSalesInvoicesNet += inv.netAmount;

            let c = contractorSalesMap.get(inv.contractorId);
            if (!c) {
                c = {
                    contractorId: inv.contractorId,
                    contractorName: inv.contractorName,
                    totalGross: 0,
                    totalNet: 0,
                    invoicesCount: 0,
                    lastInvoiceDate: inv.issuedDate,
                };
                contractorSalesMap.set(inv.contractorId, c);
            }
            c.totalGross += inv.grossAmount;
            c.totalNet += inv.netAmount;
            c.invoicesCount += 1;
            if (inv.issuedDate > c.lastInvoiceDate) {
                c.lastInvoiceDate = inv.issuedDate;
            }
        });

        const contractorSalesRanking = Array.from(contractorSalesMap.values())
            .map((c) => ({
                ...c,
                totalGross: Math.round(c.totalGross * 100) / 100,
                totalNet: Math.round(c.totalNet * 100) / 100,
                sharePercent: grandTotalSalesInvoicesGross > 0
                    ? Math.round((c.totalGross / grandTotalSalesInvoicesGross) * 1000) / 10
                    : 0,
            }))
            .sort((a, b) => b.totalGross - a.totalGross);

        // 10. Podsumowanie kategorii wyrobów
        const categoryTotals = {
            BREAD: productRanking.filter((p) => p.productType === "BREAD").reduce((acc, p) => acc + p.totalRevenue, 0),
            ROLL: productRanking.filter((p) => p.productType === "ROLL").reduce((acc, p) => acc + p.totalRevenue, 0),
            SWEET: productRanking.filter((p) => p.productType === "SWEET").reduce((acc, p) => acc + p.totalRevenue, 0),
            SAVORY: productRanking.filter((p) => p.productType === "SAVORY").reduce((acc, p) => acc + p.totalRevenue, 0),
        };

        // 11. Ogólne KPI i statystyki
        const grandTotalRetailIncome = allDailyData.reduce((acc, d) => acc + d.totalIncome, 0);
        const grandTotalOtherIncome = allDailyData.reduce((acc, d) => acc + d.otherIncome, 0);
        const grandTotalSold = allDailyData.reduce((acc, d) => acc + d.totalSold, 0);
        const grandTotalProduced = allDailyData.reduce((acc, d) => acc + d.totalProduced, 0);
        const daysWithReportCount = allDailyData.filter((d) => d.hasReport).length;
        const grandTotalIncome = Math.round((grandTotalRetailIncome + grandTotalSalesInvoicesGross) * 100) / 100;

        // Szczytowy dzień (Peak)
        let peakDay: {
            date: string;
            dayOfWeek: string;
            amount: number;
            bakeryAmount: number;
            otherAmount: number;
        } | null = null;

        allDailyData.forEach((d) => {
            if (!peakDay || d.totalIncome > peakDay.amount) {
                if (d.totalIncome > 0) {
                    peakDay = {
                        date: d.date,
                        dayOfWeek: d.dayOfWeek,
                        amount: d.totalIncome,
                        bakeryAmount: d.bakerySalesIncome,
                        otherAmount: d.otherIncome,
                    };
                }
            }
        });

        const overallStats = {
            grandTotalIncome,
            grandTotalRetailIncome: Math.round(grandTotalRetailIncome * 100) / 100,
            grandTotalBakeryIncome: Math.round(grandTotalBakeryIncome * 100) / 100,
            grandTotalOtherIncome: Math.round(grandTotalOtherIncome * 100) / 100,
            grandTotalSalesInvoicesGross: Math.round(grandTotalSalesInvoicesGross * 100) / 100,
            grandTotalSalesInvoicesNet: Math.round(grandTotalSalesInvoicesNet * 100) / 100,
            grandTotalSalesInvoicesCount: formattedSalesInvoices.length,
            bakerySharePercent: grandTotalIncome > 0
                ? Math.round((grandTotalBakeryIncome / grandTotalIncome) * 1000) / 10
                : 0,
            otherSharePercent: grandTotalIncome > 0
                ? Math.round((grandTotalOtherIncome / grandTotalIncome) * 1000) / 10
                : 0,
            salesInvoicesSharePercent: grandTotalIncome > 0
                ? Math.round((grandTotalSalesInvoicesGross / grandTotalIncome) * 1000) / 10
                : 0,
            avgDailyIncome: daysWithReportCount > 0
                ? Math.round((grandTotalRetailIncome / daysWithReportCount) * 100) / 100
                : 0,
            grandTotalSold,
            grandTotalProduced,
            overallSellThroughRate: grandTotalProduced > 0
                ? Math.round((grandTotalSold / grandTotalProduced) * 1000) / 10
                : 0,
            daysWithReportCount,
            peakDay,
            topProduct: productRanking.length > 0 ? productRanking[0] : null,
            categoryTotals: {
                BREAD: Math.round(categoryTotals.BREAD * 100) / 100,
                ROLL: Math.round(categoryTotals.ROLL * 100) / 100,
                SWEET: Math.round(categoryTotals.SWEET * 100) / 100,
                SAVORY: Math.round(categoryTotals.SAVORY * 100) / 100,
            },
        };

        return NextResponse.json({
            dailyData: allDailyData,
            weeklyData: weeklyDataList,
            monthlyData: monthlyDataList,
            productRanking,
            salesInvoices: formattedSalesInvoices,
            contractorSalesRanking,
            stats: overallStats,
        });
    } catch (error: any) {
        console.error("Błąd pobierania analizy przychodów:", error);
        return NextResponse.json(
            { error: "Błąd serwera podczas pobierania danych przychodów", details: error.message },
            { status: 500 }
        );
    }
}
