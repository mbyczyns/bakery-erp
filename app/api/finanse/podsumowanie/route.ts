import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { ensureCleanCostTypes } from "../../koszty/types/route";

const prisma = new PrismaClient();

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

const POLISH_MONTHS_FULL = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

const MONTH_SHORT_NAMES = [
    "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
    "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"
];

export async function GET(request: NextRequest) {
    try {
        await ensureCleanCostTypes();

        const { searchParams } = new URL(request.url);
        const currentYear = new Date().getFullYear();
        const yearParam = searchParams.get("year");
        const selectedYear = yearParam ? parseInt(yearParam, 10) : currentYear;

        const extras = getExtras();

        // 1. Pobierz produkty piekarnicze
        const products = await prisma.bakeryProduct.findMany({
            select: {
                id: true,
                name: true,
                type: true,
                sellingPrice: true,
                productionCost: true,
            },
        });

        const productMap = new Map<string, { id: string; name: string; type: string; sellingPrice: number }>();
        products.forEach((p) => {
            productMap.set(p.id, {
                id: p.id,
                name: p.name,
                type: p.type,
                sellingPrice: Number(p.sellingPrice || 0),
            });
        });

        // 2. Pobierz produkcję dzienną dla wybranego roku
        const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
        const yearEnd = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999));

        const productions = await prisma.dailyProduction.findMany({
            where: {
                date: {
                    gte: yearStart,
                    lte: yearEnd,
                },
            },
            orderBy: { date: "asc" },
        });

        // 3. Pobierz utargi dzienne z bazy lub extras
        let dbIncomes: Array<{ date: Date; incomeAmount: any }> = [];
        try {
            if ((prisma as any).dailyIncome) {
                dbIncomes = await (prisma as any).dailyIncome.findMany({
                    where: {
                        date: {
                            gte: yearStart,
                            lte: yearEnd,
                        },
                    },
                    orderBy: { date: "asc" },
                });
            }
        } catch {
            dbIncomes = [];
        }

        const fiscalIncomeMap = new Map<string, number>();
        Object.entries(extras).forEach(([dKey, val]) => {
            if (dKey.startsWith(String(selectedYear)) && val.fiscalIncome && val.fiscalIncome > 0) {
                fiscalIncomeMap.set(dKey, Number(val.fiscalIncome));
            }
        });
        dbIncomes.forEach((inc) => {
            const dStr = new Date(inc.date).toISOString().split("T")[0];
            const amt = Number(inc.incomeAmount || 0);
            if (amt > 0) {
                fiscalIncomeMap.set(dStr, amt);
            }
        });

        // 4. Przychody detaliczne piekarni wg miesięcy
        const monthlyRetailBakery = new Array(12).fill(0);
        const monthlyRetailOther = new Array(12).fill(0);
        const monthlyRetailTotal = new Array(12).fill(0);
        const monthlyCategoryRevenues = Array.from({ length: 12 }, () => ({
            BREAD: 0,
            ROLL: 0,
            SWEET: 0,
            SAVORY: 0,
        }));

        // Mapa dni do wyliczenia dziennego utargu piekarni
        const dailyBakeryMap = new Map<string, { bakerySales: number; categoryBreakdown: { BREAD: number; ROLL: number; SWEET: number; SAVORY: number } }>();

        productions.forEach((prod) => {
            const dateStr = new Date(prod.date).toISOString().split("T")[0];
            let d = dailyBakeryMap.get(dateStr);
            if (!d) {
                d = { bakerySales: 0, categoryBreakdown: { BREAD: 0, ROLL: 0, SWEET: 0, SAVORY: 0 } };
                dailyBakeryMap.set(dateStr, d);
            }

            const pInfo = productMap.get(prod.bakeryProductId);
            const sold = Number(prod.soldAmount || 0);
            const price = pInfo ? pInfo.sellingPrice : 0;
            const salesIncome = sold * price;

            d.bakerySales += salesIncome;
            const cat = (pInfo?.type || "BREAD") as "BREAD" | "ROLL" | "SWEET" | "SAVORY";
            if (d.categoryBreakdown[cat] !== undefined) {
                d.categoryBreakdown[cat] += salesIncome;
            }
        });

        // Scal z danymi fiskalnymi dla wszystkich zarejestrowanych dni w roku
        const allDaysInYear = new Set([...Array.from(dailyBakeryMap.keys()), ...Array.from(fiscalIncomeMap.keys())]);
        allDaysInYear.forEach((dateStr) => {
            const dObj = new Date(dateStr);
            if (dObj.getFullYear() !== selectedYear) return;
            const mIdx = dObj.getMonth();

            const dData = dailyBakeryMap.get(dateStr) || { bakerySales: 0, categoryBreakdown: { BREAD: 0, ROLL: 0, SWEET: 0, SAVORY: 0 } };
            const fiscal = fiscalIncomeMap.get(dateStr) || 0;

            const bakeryIncome = dData.bakerySales;
            const retailTotal = Math.max(fiscal, bakeryIncome);
            const otherIncome = Math.max(0, fiscal - bakeryIncome);

            monthlyRetailBakery[mIdx] += bakeryIncome;
            monthlyRetailOther[mIdx] += otherIncome;
            monthlyRetailTotal[mIdx] += retailTotal;

            monthlyCategoryRevenues[mIdx].BREAD += dData.categoryBreakdown.BREAD;
            monthlyCategoryRevenues[mIdx].ROLL += dData.categoryBreakdown.ROLL;
            monthlyCategoryRevenues[mIdx].SWEET += dData.categoryBreakdown.SWEET;
            monthlyCategoryRevenues[mIdx].SAVORY += dData.categoryBreakdown.SAVORY;
        });

        // 5. Faktury sprzedażowe B2B (isSales: true)
        const salesInvoices = await prisma.invoice.findMany({
            where: {
                isSales: true,
                status: { not: "REJECTED" },
                issuedDate: {
                    gte: yearStart,
                    lte: yearEnd,
                },
            },
            select: {
                issuedDate: true,
                grossAmount: true,
                netAmount: true,
            },
        });

        const monthlySalesInvoicesGross = new Array(12).fill(0);
        const monthlySalesInvoicesNet = new Array(12).fill(0);

        salesInvoices.forEach((inv) => {
            const invDate = new Date(inv.issuedDate);
            const mIdx = invDate.getMonth();
            monthlySalesInvoicesGross[mIdx] += Number(inv.grossAmount || 0);
            monthlySalesInvoicesNet[mIdx] += Number(inv.netAmount || 0);
        });

        // 6. Faktury kosztowe (isSales: false)
        const costInvoices = await prisma.invoice.findMany({
            where: {
                isSales: false,
                status: { not: "REJECTED" },
                issuedDate: {
                    gte: yearStart,
                    lte: yearEnd,
                },
            },
            include: {
                positions: {
                    include: {
                        product: {
                            include: {
                                category: true,
                                ingredient: true,
                            },
                        },
                    },
                },
            },
        });

        const monthlyCostInvoicesGross = new Array(12).fill(0);
        const monthlyCostInvoicesNet = new Array(12).fill(0);
        const costInvoiceCategoryMap = new Map<string, { total: number; monthlyValues: number[] }>();

        costInvoices.forEach((inv) => {
            const invDate = new Date(inv.issuedDate);
            const mIdx = invDate.getMonth();
            const gross = Number(inv.grossAmount || 0);
            const net = Number(inv.netAmount || 0);

            monthlyCostInvoicesGross[mIdx] += gross;
            monthlyCostInvoicesNet[mIdx] += net;

            if (inv.positions && inv.positions.length > 0) {
                inv.positions.forEach((pos) => {
                    const catName = pos.product?.category?.name || "Bez kategorii";
                    const posGross = Number(pos.grossAmount || 0);
                    let entry = costInvoiceCategoryMap.get(catName);
                    if (!entry) {
                        entry = { total: 0, monthlyValues: new Array(12).fill(0) };
                        costInvoiceCategoryMap.set(catName, entry);
                    }
                    entry.total += posGross;
                    entry.monthlyValues[mIdx] += posGross;
                });
            } else {
                const catName = "Bez kategorii";
                let entry = costInvoiceCategoryMap.get(catName);
                if (!entry) {
                    entry = { total: 0, monthlyValues: new Array(12).fill(0) };
                    costInvoiceCategoryMap.set(catName, entry);
                }
                entry.total += gross;
                entry.monthlyValues[mIdx] += gross;
            }
        });

        // 7. Koszty pozafakturowe (MonthlyCost + CostType)
        const costTypes = await prisma.costType.findMany({
            orderBy: { name: "asc" },
        });

        const monthlyCostsDb = await prisma.monthlyCost.findMany({
            where: {
                monthDate: {
                    gte: yearStart,
                    lte: yearEnd,
                },
            },
            include: {
                costType: true,
            },
        });

        const monthlyOperationalCosts = new Array(12).fill(0);
        const costTypeTotalsMap = new Map<string, { id: string; name: string; total: number; monthlyValues: number[] }>();

        costTypes.forEach((ct) => {
            costTypeTotalsMap.set(ct.id, { id: ct.id, name: ct.name, total: 0, monthlyValues: new Array(12).fill(0) });
        });

        monthlyCostsDb.forEach((mc) => {
            const mDate = new Date(mc.monthDate);
            const mIdx = mDate.getUTCMonth();
            const val = Number(mc.value || 0);
            monthlyOperationalCosts[mIdx] += val;

            const existing = costTypeTotalsMap.get(mc.costTypeId);
            if (existing) {
                existing.total += val;
                existing.monthlyValues[mIdx] += val;
            }
        });

        // 8. Zbuduj miesięczną macierz podsumowania
        const now = new Date();
        const currentYearNum = now.getFullYear();
        const currentMonthIdx = now.getMonth();

        const monthlyData = MONTH_NAMES_MAP(selectedYear).map((mInfo, idx) => {
            const retailBakery = Math.round(monthlyRetailBakery[idx] * 100) / 100;
            const retailOther = Math.round(monthlyRetailOther[idx] * 100) / 100;
            const retailTotal = Math.round(monthlyRetailTotal[idx] * 100) / 100;
            const salesInvGross = Math.round(monthlySalesInvoicesGross[idx] * 100) / 100;
            const salesInvNet = Math.round(monthlySalesInvoicesNet[idx] * 100) / 100;

            const totalRevenue = Math.round((retailTotal + salesInvGross) * 100) / 100;

            const costInvGross = Math.round(monthlyCostInvoicesGross[idx] * 100) / 100;
            const costInvNet = Math.round(monthlyCostInvoicesNet[idx] * 100) / 100;
            const costOp = Math.round(monthlyOperationalCosts[idx] * 100) / 100;

            const totalCost = Math.round((costInvGross + costOp) * 100) / 100;
            const netProfit = Math.round((totalRevenue - totalCost) * 100) / 100;
            const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;
            const isCurrentMonth = selectedYear === currentYearNum && idx === currentMonthIdx;
            const hasData = totalRevenue > 0 || totalCost > 0;
            const monthPrefix = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
            const activeDaysInMonth = Array.from(allDaysInYear).filter((d) => d.startsWith(monthPrefix)).length;

            return {
                monthIndex: idx,
                monthKey: `${selectedYear}-${String(idx + 1).padStart(2, "0")}`,
                monthName: mInfo.name,
                shortMonth: mInfo.short,
                year: selectedYear,
                // Przychody
                retailBakeryRevenue: retailBakery,
                retailOtherRevenue: retailOther,
                retailTotalRevenue: retailTotal,
                salesInvoicesGross: salesInvGross,
                salesInvoicesNet: salesInvNet,
                totalRevenue,
                // Koszty
                costInvoicesGross: costInvGross,
                costInvoicesNet: costInvNet,
                costOperational: costOp,
                totalCost,
                // Wynik
                netProfit,
                profitMargin,
                isCurrentMonth,
                hasData,
                activeDaysCount: activeDaysInMonth,
                categoryRevenues: {
                    BREAD: Math.round(monthlyCategoryRevenues[idx].BREAD * 100) / 100,
                    ROLL: Math.round(monthlyCategoryRevenues[idx].ROLL * 100) / 100,
                    SWEET: Math.round(monthlyCategoryRevenues[idx].SWEET * 100) / 100,
                    SAVORY: Math.round(monthlyCategoryRevenues[idx].SAVORY * 100) / 100,
                },
            };
        });

        // 9. Roczne podsumowania i KPI
        const grandTotalRevenue = Math.round(monthlyData.reduce((acc, m) => acc + m.totalRevenue, 0) * 100) / 100;
        const grandTotalCost = Math.round(monthlyData.reduce((acc, m) => acc + m.totalCost, 0) * 100) / 100;
        const grandNetProfit = Math.round((grandTotalRevenue - grandTotalCost) * 100) / 100;
        const grandProfitMargin = grandTotalRevenue > 0 ? Math.round((grandNetProfit / grandTotalRevenue) * 1000) / 10 : 0;

        const monthsWithData = monthlyData.filter((m) => m.hasData);
        const activeMonthsCount = Math.max(1, monthsWithData.length);

        const activeDaysCount = Array.from(allDaysInYear).filter((d) => d.startsWith(String(selectedYear))).length;
        const totalDaysForAvg = activeDaysCount > 0 ? activeDaysCount : activeMonthsCount * 30;

        const avgMonthlyRevenue = Math.round((grandTotalRevenue / activeMonthsCount) * 100) / 100;
        const avgMonthlyCost = Math.round((grandTotalCost / activeMonthsCount) * 100) / 100;
        const avgMonthlyProfit = Math.round((grandNetProfit / activeMonthsCount) * 100) / 100;
        const avgDailyProfit = totalDaysForAvg > 0 ? Math.round((grandNetProfit / totalDaysForAvg) * 100) / 100 : 0;

        // Najlepszy i najgorszy miesiąc
        let bestMonth = monthsWithData.length > 0
            ? [...monthsWithData].sort((a, b) => b.netProfit - a.netProfit)[0]
            : null;

        let worstMonth = monthsWithData.length > 0
            ? [...monthsWithData].sort((a, b) => a.netProfit - b.netProfit)[0]
            : null;

        // 10. Struktura przychodów
        const grandBakeryRevenue = Math.round(monthlyData.reduce((acc, m) => acc + m.retailBakeryRevenue, 0) * 100) / 100;
        const grandOtherRevenue = Math.round(monthlyData.reduce((acc, m) => acc + m.retailOtherRevenue, 0) * 100) / 100;
        const grandSalesInvGross = Math.round(monthlyData.reduce((acc, m) => acc + m.salesInvoicesGross, 0) * 100) / 100;

        const revenueStructure = [
            {
                id: "bakery",
                name: "Pieczywo i wypieki",
                value: grandBakeryRevenue,
                sharePercent: grandTotalRevenue > 0 ? Math.round((grandBakeryRevenue / grandTotalRevenue) * 1000) / 10 : 0,
                color: "#10b981", // emerald-500
            },
            {
                id: "other_retail",
                name: "Przychody z pozostałych produktów i wczorajszego pieczywa",
                value: grandOtherRevenue,
                sharePercent: grandTotalRevenue > 0 ? Math.round((grandOtherRevenue / grandTotalRevenue) * 1000) / 10 : 0,
                color: "#06b6d4", // cyan-500
            },
            {
                id: "sales_invoices",
                name: "Sprzedaż na faktury (przelewy)",
                value: grandSalesInvGross,
                sharePercent: grandTotalRevenue > 0 ? Math.round((grandSalesInvGross / grandTotalRevenue) * 1000) / 10 : 0,
                color: "#8b5cf6", // purple-500
            },
        ].filter((i) => i.value > 0);

        // Kategorie wyrobów
        const grandCategoryBread = Math.round(monthlyData.reduce((acc, m) => acc + m.categoryRevenues.BREAD, 0) * 100) / 100;
        const grandCategoryRoll = Math.round(monthlyData.reduce((acc, m) => acc + m.categoryRevenues.ROLL, 0) * 100) / 100;
        const grandCategorySweet = Math.round(monthlyData.reduce((acc, m) => acc + m.categoryRevenues.SWEET, 0) * 100) / 100;
        const grandCategorySavory = Math.round(monthlyData.reduce((acc, m) => acc + m.categoryRevenues.SAVORY, 0) * 100) / 100;

        const bakeryCategoriesBreakdown = [
            { id: "BREAD", name: "Chleby", value: grandCategoryBread, color: "#d97706" },
            { id: "ROLL", name: "Bułki", value: grandCategoryRoll, color: "#9333ea" },
            { id: "SWEET", name: "Słodkie wypieki", value: grandCategorySweet, color: "#ec4899" },
            { id: "SAVORY", name: "Słone wypieki", value: grandCategorySavory, color: "#6366f1" },
        ].filter((c) => c.value > 0);

        // 11. Struktura kosztów (Pozafakturowe + Faktury)
        const grandOperationalCosts = Math.round(monthlyData.reduce((acc, m) => acc + m.costOperational, 0) * 100) / 100;
        const grandCostInvoicesGross = Math.round(monthlyData.reduce((acc, m) => acc + m.costInvoicesGross, 0) * 100) / 100;

        const operationalCostItems = Array.from(costTypeTotalsMap.values())
            .filter((i) => i.total > 0)
            .map((i) => ({
                id: `op_${i.id}`,
                name: i.name,
                source: "OPERATIONAL" as const,
                sourceLabel: "Koszty stałe / operacyjne",
                value: Math.round(i.total * 100) / 100,
                monthlyValues: i.monthlyValues.map((v) => Math.round(v * 100) / 100),
                sharePercent: grandTotalCost > 0 ? Math.round((i.total / grandTotalCost) * 1000) / 10 : 0,
            }));

        const invoiceCostItems = Array.from(costInvoiceCategoryMap.entries())
            .filter(([_, entry]) => entry.total > 0)
            .map(([name, entry]) => ({
                id: `inv_${name}`,
                name,
                source: "INVOICE" as const,
                sourceLabel: "Faktury kosztowe",
                value: Math.round(entry.total * 100) / 100,
                monthlyValues: entry.monthlyValues.map((v) => Math.round(v * 100) / 100),
                sharePercent: grandTotalCost > 0 ? Math.round((entry.total / grandTotalCost) * 1000) / 10 : 0,
            }));

        const allCostBreakdown = [...operationalCostItems, ...invoiceCostItems].sort((a, b) => b.value - a.value);

        // Dostępne lata w bazie
        const availableYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

        return NextResponse.json({
            year: selectedYear,
            kpis: {
                totalRevenue: grandTotalRevenue,
                totalCost: grandTotalCost,
                netProfit: grandNetProfit,
                profitMargin: grandProfitMargin,
                avgMonthlyRevenue,
                avgMonthlyCost,
                avgMonthlyProfit,
                avgDailyProfit,
                activeMonthsCount,
                activeDaysCount,
                grandBakeryRevenue,
                grandOtherRevenue,
                grandSalesInvGross,
                grandOperationalCosts,
                grandCostInvoicesGross,
                bestMonth: bestMonth
                    ? {
                        monthKey: bestMonth.monthKey,
                        monthName: bestMonth.monthName,
                        netProfit: bestMonth.netProfit,
                        totalRevenue: bestMonth.totalRevenue,
                        totalCost: bestMonth.totalCost,
                        profitMargin: bestMonth.profitMargin,
                    }
                    : null,
                worstMonth: worstMonth
                    ? {
                        monthKey: worstMonth.monthKey,
                        monthName: worstMonth.monthName,
                        netProfit: worstMonth.netProfit,
                        totalRevenue: worstMonth.totalRevenue,
                        totalCost: worstMonth.totalCost,
                        profitMargin: worstMonth.profitMargin,
                    }
                    : null,
            },
            monthlyData,
            revenueStructure,
            bakeryCategoriesBreakdown,
            costStructure: {
                grandOperationalCosts,
                grandCostInvoicesGross,
                operationalSharePercent: grandTotalCost > 0 ? Math.round((grandOperationalCosts / grandTotalCost) * 1000) / 10 : 0,
                invoicesSharePercent: grandTotalCost > 0 ? Math.round((grandCostInvoicesGross / grandTotalCost) * 1000) / 10 : 0,
                items: allCostBreakdown,
            },
            availableYears,
        });
    } catch (error: any) {
        console.error("Błąd pobierania podsumowania finansowego:", error);
        return NextResponse.json(
            { error: "Błąd serwera podczas generowania podsumowania", details: error.message },
            { status: 500 }
        );
    }
}

function MONTH_NAMES_MAP(year: number) {
    return POLISH_MONTHS_FULL.map((name, idx) => ({
        name: `${name} ${year}`,
        short: MONTH_SHORT_NAMES[idx],
    }));
}
