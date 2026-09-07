import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ensureCleanCostTypes } from "./types/route";

const prisma = new PrismaClient();

const MONTH_NAMES = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

const MONTH_SHORT = [
    "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
    "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"
];

export async function GET(request: NextRequest) {
    try {
        await ensureCleanCostTypes();

        const { searchParams } = new URL(request.url);
        const todayStr = new Date().toISOString().split("T")[0];
        const monthParam = searchParams.get("month") || todayStr.slice(0, 7); // np. "2026-09"
        
        const [yearStr, monthNumStr] = monthParam.split("-");
        const selectedYear = parseInt(yearStr, 10);
        const selectedMonthNum = parseInt(monthNumStr, 10); // 1-12
        const selectedMonthIndex = selectedMonthNum - 1; // 0-11

        // 1. Wszystkie kategorie kosztów pozafakturowych
        const costTypes = await prisma.costType.findMany({
            orderBy: { name: "asc" },
        });

        // 2. Pobierz wszystkie koszty pozafakturowe z bieżącego i poprzedniego roku
        const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
        const yearEnd = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999));

        const allYearCosts = await prisma.monthlyCost.findMany({
            where: {
                monthDate: {
                    gte: new Date(Date.UTC(selectedYear - 1, 0, 1)),
                    lte: yearEnd,
                },
            },
            include: {
                costType: true,
            },
            orderBy: {
                monthDate: "asc",
            },
        });

        // Mapa: "YYYY-MM:costTypeId" -> number
        const costMap = new Map<string, number>();
        allYearCosts.forEach((c) => {
            const d = new Date(c.monthDate);
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}:${c.costTypeId}`;
            costMap.set(key, Number(c.value || 0));
        });

        // 3. Pozycje kosztów pozafakturowych dla wybranego miesiąca
        const currentMonthKey = `${selectedYear}-${String(selectedMonthNum).padStart(2, "0")}`;
        let activeMonthOpTotal = 0;

        const currentMonthOpItems = costTypes.map((type) => {
            const val = costMap.get(`${currentMonthKey}:${type.id}`) || 0;
            activeMonthOpTotal += val;
            return {
                costTypeId: type.id,
                costTypeName: type.name,
                value: val,
            };
        });

        // 4. Poprzedni miesiąc (do MoM i kopiowania)
        let prevYear = selectedYear;
        let prevMonthNum = selectedMonthNum - 1;
        if (prevMonthNum === 0) {
            prevMonthNum = 12;
            prevYear -= 1;
        }
        const prevMonthKey = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`;
        let prevMonthOpTotal = 0;

        const prevMonthOpItems = costTypes.map((type) => {
            const val = costMap.get(`${prevMonthKey}:${type.id}`) || 0;
            prevMonthOpTotal += val;
            return {
                costTypeId: type.id,
                costTypeName: type.name,
                value: val,
            };
        });

        // 5. Pobierz FAKTURY KOSZTOWE (isSales: false) z całego roku
        const yearInvoices = await prisma.invoice.findMany({
            where: {
                isSales: false,
                issuedDate: {
                    gte: yearStart,
                    lte: yearEnd,
                },
            },
            include: {
                contractor: true,
                positions: {
                    include: {
                        product: {
                            include: {
                                category: true,
                            },
                        },
                    },
                },
            },
            orderBy: { issuedDate: "desc" },
        });

        // Faktury z wybranego miesiąca
        const startOfMonth = new Date(Date.UTC(selectedYear, selectedMonthIndex, 1));
        const endOfMonth = new Date(Date.UTC(selectedYear, selectedMonthIndex + 1, 0, 23, 59, 59, 999));

        let monthInvoicesGross = 0;
        let monthInvoicesNet = 0;
        let monthInvoicesVat = 0;
        let monthInvoicesCount = 0;

        const invoiceCategoryMap = new Map<string, { name: string; gross: number; net: number; count: number; itemsCount: number }>();

        // Miesięczne sumy faktur w roku (12 miesięcy)
        const yearMonthlyInvoicesGross = new Array(12).fill(0);
        const yearMonthlyInvoicesNet = new Array(12).fill(0);

        yearInvoices.forEach((inv) => {
            const invDate = new Date(inv.issuedDate);
            const mIdx = invDate.getUTCMonth();
            const invGross = Number(inv.grossAmount || 0);
            const invNet = Number(inv.netAmount || 0);
            const invVat = Number(inv.vatAmount || 0);

            if (invDate.getUTCFullYear() === selectedYear) {
                yearMonthlyInvoicesGross[mIdx] += invGross;
                yearMonthlyInvoicesNet[mIdx] += invNet;
            }

            // Sprawdź czy to wybrany miesiąc
            if (invDate >= startOfMonth && invDate <= endOfMonth) {
                monthInvoicesGross += invGross;
                monthInvoicesNet += invNet;
                monthInvoicesVat += invVat;
                monthInvoicesCount += 1;

                if (inv.positions && inv.positions.length > 0) {
                    inv.positions.forEach((pos) => {
                        const posGross = Number(pos.grossAmount || 0);
                        const posNet = Number(pos.netAmount || 0);

                        // Kategoria pozycji z tabeli ProductCategory
                        const catName = pos.product?.category?.name || "Bez kategorii";

                        const existing = invoiceCategoryMap.get(catName) || { name: catName, gross: 0, net: 0, count: 0, itemsCount: 0 };
                        existing.gross += posGross;
                        existing.net += posNet;
                        existing.itemsCount += 1;
                        invoiceCategoryMap.set(catName, existing);
                    });
                } else {
                    const catName = "Bez kategorii";
                    const existing = invoiceCategoryMap.get(catName) || { name: catName, gross: 0, net: 0, count: 0, itemsCount: 0 };
                    existing.gross += invGross;
                    existing.net += invNet;
                    existing.count += 1;
                    invoiceCategoryMap.set(catName, existing);
                }
            }
        });

        // Przetworzone typy/kategorie z faktur w wybranym miesiącu
        const invoiceCategories = Array.from(invoiceCategoryMap.values()).map((cat) => ({
            ...cat,
            gross: Math.round(cat.gross * 100) / 100,
            net: Math.round(cat.net * 100) / 100,
            sharePercent: monthInvoicesGross > 0 ? Math.round((cat.gross / monthInvoicesGross) * 1000) / 10 : 0,
        })).sort((a, b) => b.gross - a.gross);

        // Łączne koszty firmy w wybranym miesiącu (Pozafakturowe + Faktury Brutto)
        const totalEnterpriseMonthCosts = Math.round((activeMonthOpTotal + monthInvoicesGross) * 100) / 100;
        const totalEnterpriseMonthCostsNet = Math.round((activeMonthOpTotal + monthInvoicesNet) * 100) / 100;

        // Udziały pozycji pozafakturowych w kosztach pozafakturowych
        const currentMonthOpWithShares = currentMonthOpItems.map((item) => ({
            ...item,
            sharePercent: activeMonthOpTotal > 0
                ? Math.round((item.value / activeMonthOpTotal) * 1000) / 10
                : 0,
            shareOfTotalPercent: totalEnterpriseMonthCosts > 0
                ? Math.round((item.value / totalEnterpriseMonthCosts) * 1000) / 10
                : 0,
        })).sort((a, b) => b.value - a.value);

        // Zbiorcza struktura wszystkich kosztów firmy (Pozafakturowe + Kategorie z faktur) do dużego wykresu kołowego
        const combinedCostItems = [
            ...currentMonthOpWithShares.filter((i) => i.value > 0).map((i) => ({
                id: `op_${i.costTypeId}`,
                name: i.costTypeName,
                source: "OPERATIONAL" as const, // Pozafakturowe
                sourceLabel: "Koszty pozafakturowe",
                value: i.value,
                netValue: i.value,
                sharePercent: totalEnterpriseMonthCosts > 0 ? Math.round((i.value / totalEnterpriseMonthCosts) * 1000) / 10 : 0,
            })),
            ...invoiceCategories.map((cat) => ({
                id: `inv_${cat.name}`,
                name: cat.name,
                source: "INVOICE" as const, // Faktury
                sourceLabel: "Faktury kosztowe",
                value: cat.gross,
                netValue: cat.net,
                sharePercent: totalEnterpriseMonthCosts > 0 ? Math.round((cat.gross / totalEnterpriseMonthCosts) * 1000) / 10 : 0,
            })),
        ].sort((a, b) => b.value - a.value);

        // 6. Zestawienie roczne macierzowe (Kategorie pozafakturowe)
        let grandYearOpTotal = 0;
        const monthlyOpTotals = new Array(12).fill(0);

        const yearlyMatrix = costTypes.map((type) => {
            const monthsValues = [];
            let typeYearTotal = 0;

            for (let m = 0; m < 12; m++) {
                const ymKey = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
                const val = costMap.get(`${ymKey}:${type.id}`) || 0;
                monthsValues.push(val);
                typeYearTotal += val;
                monthlyOpTotals[m] += val;
            }

            grandYearOpTotal += typeYearTotal;

            return {
                costTypeId: type.id,
                costTypeName: type.name,
                months: monthsValues,
                total: typeYearTotal,
            };
        });

        // 7. Dane do wykresów rocznych (12 miesięcy: pozafakturowe + faktury + suma)
        const monthlyChartData = MONTH_NAMES.map((name, idx) => {
            const ymKey = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
            const isCurrent = idx === selectedMonthIndex;
            const opTotal = monthlyOpTotals[idx];
            const invGross = Math.round(yearMonthlyInvoicesGross[idx] * 100) / 100;
            const invNet = Math.round(yearMonthlyInvoicesNet[idx] * 100) / 100;
            const grandTotal = Math.round((opTotal + invGross) * 100) / 100;

            const item: Record<string, any> = {
                month: MONTH_SHORT[idx],
                fullMonth: name,
                monthKey: ymKey,
                operationalTotal: opTotal,
                invoiceGross: invGross,
                invoiceNet: invNet,
                total: grandTotal,
                isCurrent,
            };

            costTypes.forEach((type) => {
                item[type.id] = costMap.get(`${ymKey}:${type.id}`) || 0;
            });

            return item;
        });

        // Dynamika MoM dla kosztów pozafakturowych
        const momChangePercent = prevMonthOpTotal > 0
            ? Math.round(((activeMonthOpTotal - prevMonthOpTotal) / prevMonthOpTotal) * 1000) / 10
            : 0;

        // Podsumowania
        const grandYearInvoicesGross = yearMonthlyInvoicesGross.reduce((a, b) => a + b, 0);
        const grandYearAllTotal = grandYearOpTotal + grandYearInvoicesGross;

        return NextResponse.json({
            month: currentMonthKey,
            year: selectedYear,
            monthName: MONTH_NAMES[selectedMonthIndex],
            costTypes,
            // Koszty pozafakturowe w wybranym miesiącu
            currentMonth: {
                key: currentMonthKey,
                items: currentMonthOpWithShares,
                total: Math.round(activeMonthOpTotal * 100) / 100,
            },
            previousMonth: {
                key: prevMonthKey,
                items: prevMonthOpItems,
                total: Math.round(prevMonthOpTotal * 100) / 100,
            },
            // Faktury w wybranym miesiącu
            invoicesSummary: {
                count: monthInvoicesCount,
                grossTotal: Math.round(monthInvoicesGross * 100) / 100,
                netTotal: Math.round(monthInvoicesNet * 100) / 100,
                vatTotal: Math.round(monthInvoicesVat * 100) / 100,
                categories: invoiceCategories,
            },
            // Łączne koszty firmy
            enterpriseTotals: {
                totalGross: totalEnterpriseMonthCosts,
                totalNet: totalEnterpriseMonthCostsNet,
                operationalSharePercent: totalEnterpriseMonthCosts > 0 ? Math.round((activeMonthOpTotal / totalEnterpriseMonthCosts) * 1000) / 10 : 0,
                invoicesSharePercent: totalEnterpriseMonthCosts > 0 ? Math.round((monthInvoicesGross / totalEnterpriseMonthCosts) * 1000) / 10 : 0,
                combinedCostItems,
            },
            yearlyMatrix,
            monthlyOpTotals,
            monthlyChartData,
            stats: {
                activeMonthOpTotal: Math.round(activeMonthOpTotal * 100) / 100,
                prevMonthOpTotal: Math.round(prevMonthOpTotal * 100) / 100,
                momChangePercent,
                grandYearOpTotal: Math.round(grandYearOpTotal * 100) / 100,
                grandYearInvoicesGross: Math.round(grandYearInvoicesGross * 100) / 100,
                grandYearAllTotal: Math.round(grandYearAllTotal * 100) / 100,
            },
        });
    } catch (error: any) {
        console.error("Błąd pobierania kosztów:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}

// POST: Zapis / aktualizacja miesięcznych kosztów pozafakturowych
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { month, costs } = body; // month: "2026-09", costs: [{ costTypeId: string, value: number }]

        if (!month || !Array.isArray(costs)) {
            return NextResponse.json({ error: "Nieprawidłowe dane wejściowe" }, { status: 400 });
        }

        const [yearStr, monthNumStr] = month.split("-");
        const year = parseInt(yearStr, 10);
        const monthNum = parseInt(monthNumStr, 10);

        const monthDate = new Date(Date.UTC(year, monthNum - 1, 1));

        for (const item of costs) {
            const { costTypeId, value } = item;
            const numericValue = Math.max(0, parseFloat(value) || 0);

            await prisma.monthlyCost.upsert({
                where: {
                    monthDate_costTypeId: {
                        monthDate,
                        costTypeId,
                    },
                },
                update: {
                    value: numericValue,
                },
                create: {
                    monthDate,
                    costTypeId,
                    value: numericValue,
                },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Błąd zapisu kosztów:", error);
        return NextResponse.json({ error: "Błąd zapisu kosztów", details: error.message }, { status: 500 });
    }
}
