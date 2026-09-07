import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MONTH_NAMES = [
    "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
    "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"
];

const TYPE_MAP: Record<string, string> = {
    FLOUR: "Mąka",
    FRUIT: "Owoce / Warzywa",
    DAIRY: "Nabiał",
    OTHER: "Inne",
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const ingredient = await prisma.ingredient.findUnique({
            where: { id },
            include: {
                products: {
                    include: {
                        supplier: true,
                        invoicePositions: {
                            include: {
                                invoice: {
                                    include: {
                                        contractor: true,
                                    },
                                },
                            },
                            orderBy: {
                                invoice: {
                                    issuedDate: "desc",
                                },
                            },
                        },
                    },
                },
                recipeIngredients: {
                    include: {
                        bakeryProduct: {
                            include: {
                                productions: true,
                            },
                        },
                    },
                },
                semiFinishedIngredients: {
                    include: {
                        semiFinished: {
                            include: {
                                bakeryRecipes: {
                                    include: {
                                        bakeryProduct: {
                                            include: {
                                                productions: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!ingredient) {
            return NextResponse.json({ error: "Nie znaleziono składnika" }, { status: 404 });
        }

        // 1. Historia zakupów (Deliveries History)
        const allPositions: Array<{
            id: string;
            date: string;
            rawDate: Date;
            supplier: string;
            supplierId?: string;
            doc: string;
            quantity: number;
            price: number;
        }> = [];

        for (const prod of ingredient.products) {
            const multiplier = Number(prod.multiplier || 1) || 1;

            for (const pos of prod.invoicePositions) {
                // Pomiń odrzucone faktury
                if (pos.invoice.status === "REJECTED") continue;
                if (!pos.invoice.issuedDate) continue;

                const rawDate = new Date(pos.invoice.issuedDate);
                const unitPrice = Number(pos.netPrice) / multiplier;
                const quantity = Number(pos.quantity) * multiplier;

                allPositions.push({
                    id: pos.id,
                    date: rawDate.toISOString().split("T")[0],
                    rawDate,
                    supplier: pos.invoice.contractor?.name || prod.supplier?.name || "Nieznany dostawca",
                    supplierId: pos.invoice.contractorId || prod.supplierId,
                    doc: pos.invoice.invoiceNumber,
                    quantity: Math.round(quantity * 100) / 100,
                    price: Math.round(unitPrice * 100) / 100,
                });
            }
        }

        // Sortowanie chronologiczne od najnowszych
        allPositions.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

        const deliveriesHistory = allPositions.map((pos) => ({
            id: pos.id,
            date: pos.date,
            supplier: pos.supplier,
            doc: pos.doc,
            quantity: pos.quantity,
            price: pos.price,
        }));

        // 2. Ranking dostawców (Suppliers Ranking)
        const suppliersMap = new Map<
            string,
            {
                id: string;
                name: string;
                lastPrice: number;
                lastBuyDate: Date | null;
                lastBuy: string;
            }
        >();

        // Zarejestruj dostawców z produktów przypisanych do składnika
        for (const prod of ingredient.products) {
            if (prod.supplier) {
                const multiplier = Number(prod.multiplier || 1) || 1;
                const catPrice = Number(prod.price) / multiplier;

                if (!suppliersMap.has(prod.supplier.id)) {
                    suppliersMap.set(prod.supplier.id, {
                        id: prod.supplier.id,
                        name: prod.supplier.name,
                        lastPrice: Math.round(catPrice * 100) / 100,
                        lastBuyDate: null,
                        lastBuy: "Brak zakupów",
                    });
                }
            }
        }

        // Zaktualizuj na podstawie rzeczywistych dostaw
        for (const pos of allPositions) {
            if (!pos.supplierId) continue;
            const existing = suppliersMap.get(pos.supplierId);
            if (!existing) {
                suppliersMap.set(pos.supplierId, {
                    id: pos.supplierId,
                    name: pos.supplier,
                    lastPrice: pos.price,
                    lastBuyDate: pos.rawDate,
                    lastBuy: pos.date,
                });
            } else if (!existing.lastBuyDate || pos.rawDate.getTime() > existing.lastBuyDate.getTime()) {
                existing.lastPrice = pos.price;
                existing.lastBuyDate = pos.rawDate;
                existing.lastBuy = pos.date;
            }
        }

        const suppliersList = Array.from(suppliersMap.values());
        // Sortujemy rosnąco według ceny (najtańszy na początku)
        suppliersList.sort((a, b) => a.lastPrice - b.lastPrice);

        const suppliersRanking = suppliersList.map((sup, idx) => ({
            id: sup.id,
            name: sup.name,
            lastPrice: sup.lastPrice,
            isBest: idx === 0 && suppliersList.length > 0,
            lastBuy: sup.lastBuy,
        }));

        // 3. Okres ostatnich 6 miesięcy do istniejących wykresów (kompatybilność wsteczna)
        const now = new Date();
        const monthsRange: Array<{
            year: number;
            monthIndex: number;
            label: string;
            key: string;
        }> = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthsRange.push({
                year: d.getFullYear(),
                monthIndex: d.getMonth(),
                label: MONTH_NAMES[d.getMonth()],
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            });
        }

        // 4. Historia cen (Price History)
        const initialPrice = deliveriesHistory.length > 0
            ? deliveriesHistory[deliveriesHistory.length - 1].price
            : Number(ingredient.calculatedPrice || 0);

        let runningPrice = initialPrice;
        const priceHistory: Array<{ month: string; avgPrice: number }> = [];

        for (const m of monthsRange) {
            const monthPositions = allPositions.filter((p) => {
                return (
                    p.rawDate.getFullYear() === m.year &&
                    p.rawDate.getMonth() === m.monthIndex
                );
            });

            let monthPurchasedQty = 0;
            let monthPurchasedTotalCost = 0;

            for (const p of monthPositions) {
                monthPurchasedQty += p.quantity;
                monthPurchasedTotalCost += p.quantity * p.price;
            }

            if (monthPurchasedQty > 0) {
                runningPrice = Math.round((monthPurchasedTotalCost / monthPurchasedQty) * 100) / 100;
            }

            priceHistory.push({
                month: m.label,
                avgPrice: runningPrice,
            });
        }

        // 5. SZCZEGÓŁOWA ANALIZA ZUŻYCIA (DZIENNA, TYGODNIOWA, MIESIĘCZNA, WG PRODUKTÓW)
        const POLISH_WEEKDAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
        const POLISH_SHORT_WEEKDAYS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
        const POLISH_MONTHS_FULL = [
            "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
            "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
        ];

        // Mapa zużycia dziennego: dateStr -> DailyData
        interface DailyProductUsage {
            productId: string;
            productName: string;
            productType: string;
            producedUnits: number;
            consumedAmount: number;
            isDirect: boolean;
            isSemiFinished: boolean;
            details: Array<{
                type: "DIRECT" | "SEMI_FINISHED";
                semiFinishedName?: string;
                amountPerUnit: number;
                consumed: number;
            }>;
        }

        interface DailyData {
            date: string;
            dayOfWeek: string;
            shortDay: string;
            rawDate: Date;
            totalConsumed: number;
            totalPurchased: number;
            productsMap: Map<string, DailyProductUsage>;
        }

        const dailyMap = new Map<string, DailyData>();

        const getOrCreateDaily = (dateObj: Date): DailyData => {
            const dateStr = dateObj.toISOString().split("T")[0];
            let existing = dailyMap.get(dateStr);
            if (!existing) {
                const dayIndex = dateObj.getDay();
                existing = {
                    date: dateStr,
                    dayOfWeek: POLISH_WEEKDAYS[dayIndex],
                    shortDay: POLISH_SHORT_WEEKDAYS[dayIndex],
                    rawDate: new Date(dateStr),
                    totalConsumed: 0,
                    totalPurchased: 0,
                    productsMap: new Map(),
                };
                dailyMap.set(dateStr, existing);
            }
            return existing;
        };

        // A. Zużycie bezpośrednie z receptur
        for (const rec of ingredient.recipeIngredients) {
            const amountPerUnit = Number(rec.amount || 0);
            if (!rec.bakeryProduct || !rec.bakeryProduct.productions) continue;

            const prodId = rec.bakeryProduct.id;
            const prodName = rec.bakeryProduct.name;
            const prodType = rec.bakeryProduct.type;

            for (const prod of rec.bakeryProduct.productions) {
                if (!prod.producedAmount || prod.producedAmount <= 0) continue;
                const prodDate = new Date(prod.date);
                const daily = getOrCreateDaily(prodDate);

                const consumed = prod.producedAmount * amountPerUnit;
                daily.totalConsumed += consumed;

                let pUsage = daily.productsMap.get(prodId);
                if (!pUsage) {
                    pUsage = {
                        productId: prodId,
                        productName: prodName,
                        productType: prodType,
                        producedUnits: prod.producedAmount,
                        consumedAmount: 0,
                        isDirect: true,
                        isSemiFinished: false,
                        details: [],
                    };
                    daily.productsMap.set(prodId, pUsage);
                } else {
                    pUsage.isDirect = true;
                }

                pUsage.consumedAmount += consumed;
                pUsage.details.push({
                    type: "DIRECT",
                    amountPerUnit,
                    consumed,
                });
            }
        }

        // B. Zużycie pośrednie z półproduktów
        for (const semiIng of ingredient.semiFinishedIngredients) {
            const amountPerSemi = Number(semiIng.amount || 0);
            if (!semiIng.semiFinished || !semiIng.semiFinished.bakeryRecipes) continue;
            const semiName = semiIng.semiFinished.name;

            for (const rec of semiIng.semiFinished.bakeryRecipes) {
                const amountSemiPerProduct = Number(rec.amount || 0);
                const multiplier = amountSemiPerProduct * amountPerSemi;
                if (!rec.bakeryProduct || !rec.bakeryProduct.productions) continue;

                const prodId = rec.bakeryProduct.id;
                const prodName = rec.bakeryProduct.name;
                const prodType = rec.bakeryProduct.type;

                for (const prod of rec.bakeryProduct.productions) {
                    if (!prod.producedAmount || prod.producedAmount <= 0) continue;
                    const prodDate = new Date(prod.date);
                    const daily = getOrCreateDaily(prodDate);

                    const consumed = prod.producedAmount * multiplier;
                    daily.totalConsumed += consumed;

                    let pUsage = daily.productsMap.get(prodId);
                    if (!pUsage) {
                        pUsage = {
                            productId: prodId,
                            productName: prodName,
                            productType: prodType,
                            producedUnits: prod.producedAmount,
                            consumedAmount: 0,
                            isDirect: false,
                            isSemiFinished: true,
                            details: [],
                        };
                        daily.productsMap.set(prodId, pUsage);
                    } else {
                        pUsage.isSemiFinished = true;
                    }

                    pUsage.consumedAmount += consumed;
                    pUsage.details.push({
                        type: "SEMI_FINISHED",
                        semiFinishedName: semiName,
                        amountPerUnit: multiplier,
                        consumed,
                    });
                }
            }
        }

        // C. Zakupy przypisane do dni
        for (const pos of allPositions) {
            const daily = getOrCreateDaily(pos.rawDate);
            daily.totalPurchased += pos.quantity;
        }

        // Przekształcamy dzienną mapę w tablicę posortowaną chronologicznie malejąco (najnowsze na początku)
        const allDailyEntries = Array.from(dailyMap.values()).map((d) => ({
            date: d.date,
            dayOfWeek: d.dayOfWeek,
            shortDay: d.shortDay,
            rawDate: d.rawDate,
            totalConsumed: Math.round(d.totalConsumed * 100) / 100,
            totalPurchased: Math.round(d.totalPurchased * 100) / 100,
            products: Array.from(d.productsMap.values()).map((p) => ({
                productId: p.productId,
                productName: p.productName,
                productType: p.productType,
                producedUnits: p.producedUnits,
                consumedAmount: Math.round(p.consumedAmount * 100) / 100,
                isDirect: p.isDirect,
                isSemiFinished: p.isSemiFinished,
                details: p.details.map((dt) => ({
                    type: dt.type,
                    semiFinishedName: dt.semiFinishedName || null,
                    amountPerUnit: Math.round(dt.amountPerUnit * 1000) / 1000,
                    consumed: Math.round(dt.consumed * 100) / 100,
                })),
            })).sort((a, b) => b.consumedAmount - a.consumedAmount),
        }));

        allDailyEntries.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

        // D. Tygodniowa agregacja (ISO weeks)
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
                totalConsumed: number;
                totalPurchased: number;
                daysWithProduction: number;
                productsMap: Map<string, { productId: string; productName: string; productType: string; producedUnits: number; consumedAmount: number }>;
            }
        >();

        for (const entry of allDailyEntries) {
            const weekInfo = getISOWeekInfo(entry.rawDate);
            let w = weeklyMap.get(weekInfo.key);
            if (!w) {
                w = {
                    ...weekInfo,
                    totalConsumed: 0,
                    totalPurchased: 0,
                    daysWithProduction: 0,
                    productsMap: new Map(),
                };
                weeklyMap.set(weekInfo.key, w);
            }

            w.totalConsumed += entry.totalConsumed;
            w.totalPurchased += entry.totalPurchased;
            if (entry.totalConsumed > 0) {
                w.daysWithProduction += 1;
            }

            for (const p of entry.products) {
                let wp = w.productsMap.get(p.productId);
                if (!wp) {
                    wp = {
                        productId: p.productId,
                        productName: p.productName,
                        productType: p.productType,
                        producedUnits: 0,
                        consumedAmount: 0,
                    };
                    w.productsMap.set(p.productId, wp);
                }
                wp.producedUnits += p.producedUnits;
                wp.consumedAmount += p.consumedAmount;
            }
        }

        const weeklyHistory = Array.from(weeklyMap.values()).map((w) => ({
            key: w.key,
            weekNumber: w.weekNumber,
            year: w.year,
            label: w.label,
            shortLabel: w.shortLabel,
            startDate: w.startDate,
            endDate: w.endDate,
            mondayDate: w.mondayDate,
            totalConsumed: Math.round(w.totalConsumed * 100) / 100,
            totalPurchased: Math.round(w.totalPurchased * 100) / 100,
            avgDailyConsumed: Math.round((w.totalConsumed / 7) * 100) / 100,
            daysWithProduction: w.daysWithProduction,
            products: Array.from(w.productsMap.values()).map((p) => ({
                ...p,
                consumedAmount: Math.round(p.consumedAmount * 100) / 100,
            })).sort((a, b) => b.consumedAmount - a.consumedAmount),
        }));
        weeklyHistory.sort((a, b) => b.mondayDate.getTime() - a.mondayDate.getTime());

        // E. Miesięczna agregacja (Monthly history)
        const monthlyMap = new Map<
            string,
            {
                key: string;
                year: number;
                monthIndex: number;
                label: string;
                shortLabel: string;
                monthDate: Date;
                totalConsumed: number;
                totalPurchased: number;
                daysWithProduction: number;
                productsMap: Map<string, { productId: string; productName: string; productType: string; producedUnits: number; consumedAmount: number }>;
            }
        >();

        for (const entry of allDailyEntries) {
            const ymKey = `${entry.rawDate.getFullYear()}-${String(entry.rawDate.getMonth() + 1).padStart(2, "0")}`;
            let m = monthlyMap.get(ymKey);
            if (!m) {
                const y = entry.rawDate.getFullYear();
                const mIdx = entry.rawDate.getMonth();
                m = {
                    key: ymKey,
                    year: y,
                    monthIndex: mIdx,
                    label: `${POLISH_MONTHS_FULL[mIdx]} ${y}`,
                    shortLabel: `${MONTH_NAMES[mIdx]} ${String(y).slice(-2)}`,
                    monthDate: new Date(y, mIdx, 1),
                    totalConsumed: 0,
                    totalPurchased: 0,
                    daysWithProduction: 0,
                    productsMap: new Map(),
                };
                monthlyMap.set(ymKey, m);
            }

            m.totalConsumed += entry.totalConsumed;
            m.totalPurchased += entry.totalPurchased;
            if (entry.totalConsumed > 0) {
                m.daysWithProduction += 1;
            }

            for (const p of entry.products) {
                let mp = m.productsMap.get(p.productId);
                if (!mp) {
                    mp = {
                        productId: p.productId,
                        productName: p.productName,
                        productType: p.productType,
                        producedUnits: 0,
                        consumedAmount: 0,
                    };
                    m.productsMap.set(p.productId, mp);
                }
                mp.producedUnits += p.producedUnits;
                mp.consumedAmount += p.consumedAmount;
            }
        }

        const monthlyHistory = Array.from(monthlyMap.values()).map((m) => ({
            key: m.key,
            year: m.year,
            monthIndex: m.monthIndex,
            label: m.label,
            shortLabel: m.shortLabel,
            monthDate: m.monthDate,
            totalConsumed: Math.round(m.totalConsumed * 100) / 100,
            totalPurchased: Math.round(m.totalPurchased * 100) / 100,
            estimatedCost: Math.round(m.totalConsumed * runningPrice * 100) / 100,
            daysWithProduction: m.daysWithProduction,
            products: Array.from(m.productsMap.values()).map((p) => ({
                ...p,
                consumedAmount: Math.round(p.consumedAmount * 100) / 100,
            })).sort((a, b) => b.consumedAmount - a.consumedAmount),
        }));
        monthlyHistory.sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime());

        // F. Ogólny ranking wyrobów (Product Ranking across all time)
        const productRankingMap = new Map<
            string,
            {
                productId: string;
                productName: string;
                productType: string;
                totalConsumed: number;
                totalProducedUnits: number;
                isDirect: boolean;
                isSemiFinished: boolean;
            }
        >();

        let grandTotalConsumed = 0;
        for (const entry of allDailyEntries) {
            for (const p of entry.products) {
                let pr = productRankingMap.get(p.productId);
                if (!pr) {
                    pr = {
                        productId: p.productId,
                        productName: p.productName,
                        productType: p.productType,
                        totalConsumed: 0,
                        totalProducedUnits: 0,
                        isDirect: p.isDirect,
                        isSemiFinished: p.isSemiFinished,
                    };
                    productRankingMap.set(p.productId, pr);
                } else {
                    if (p.isDirect) pr.isDirect = true;
                    if (p.isSemiFinished) pr.isSemiFinished = true;
                }
                pr.totalConsumed += p.consumedAmount;
                pr.totalProducedUnits += p.producedUnits;
                grandTotalConsumed += p.consumedAmount;
            }
        }

        const productRanking = Array.from(productRankingMap.values())
            .map((pr) => ({
                ...pr,
                totalConsumed: Math.round(pr.totalConsumed * 100) / 100,
                percentage: grandTotalConsumed > 0 ? Math.round((pr.totalConsumed / grandTotalConsumed) * 1000) / 10 : 0,
            }))
            .sort((a, b) => b.totalConsumed - a.totalConsumed);

        // G. Wolumen do kafelka głównego (ostatnie 6 miesięcy - Volume History)
        const volumeHistory = monthsRange.map((m) => {
            const found = monthlyHistory.find((mh) => mh.year === m.year && mh.monthIndex === m.monthIndex);
            return {
                month: m.label,
                consumed: found ? found.totalConsumed : 0,
                purchased: found ? found.totalPurchased : 0,
            };
        });

        // H. Statystyki podsumowujące (Stats)
        const currentPrice = deliveriesHistory.length > 0
            ? deliveriesHistory[0].price
            : Number(ingredient.calculatedPrice || 0);

        const prevMonthAvg = priceHistory.length >= 2 ? priceHistory[priceHistory.length - 2].avgPrice : currentPrice;
        const currMonthAvg = priceHistory.length >= 1 ? priceHistory[priceHistory.length - 1].avgPrice : currentPrice;

        let priceTrend: "up" | "down" | "stable" = "stable";
        if (currMonthAvg > prevMonthAvg * 1.005) {
            priceTrend = "up";
        } else if (currMonthAvg < prevMonthAvg * 0.995) {
            priceTrend = "down";
        }

        const totalConsumed6m = volumeHistory.reduce((acc, v) => acc + v.consumed, 0);
        const avgMonthlyConsumption = Math.round(totalConsumed6m / (monthsRange.length || 1));

        const bestSupplier = suppliersRanking.find((s) => s.isBest);

        // Szczytowy dzień (peak day)
        let peakDay: { date: string; dayOfWeek: string; amount: number } | null = null;
        for (const d of allDailyEntries) {
            if (!peakDay || d.totalConsumed > peakDay.amount) {
                if (d.totalConsumed > 0) {
                    peakDay = {
                        date: d.date,
                        dayOfWeek: d.dayOfWeek,
                        amount: d.totalConsumed,
                    };
                }
            }
        }

        // Ostatnie 30 dni zużycia
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const last30DaysEntries = allDailyEntries.filter((d) => d.rawDate >= thirtyDaysAgo);
        const last30DaysConsumed = Math.round(last30DaysEntries.reduce((acc, d) => acc + d.totalConsumed, 0) * 100) / 100;
        const avgDailyLast30Days = Math.round((last30DaysConsumed / 30) * 100) / 100;

        const responseData = {
            id: ingredient.id,
            name: ingredient.name,
            type: TYPE_MAP[ingredient.type] || "Inne",
            rawType: ingredient.type,
            unit: ingredient.unit,
            stats: {
                currentPrice,
                priceTrend,
                avgMonthlyConsumption,
                bestSupplierName: bestSupplier?.name || null,
                bestSupplierPrice: bestSupplier?.lastPrice || null,
                totalAllTimeConsumed: Math.round(grandTotalConsumed * 100) / 100,
                last30DaysConsumed,
                avgDailyLast30Days,
                peakDay,
                topProduct: productRanking.length > 0 ? {
                    name: productRanking[0].productName,
                    percentage: productRanking[0].percentage,
                    amount: productRanking[0].totalConsumed,
                } : null,
            },
            priceHistory,
            volumeHistory,
            suppliersRanking,
            deliveriesHistory,
            // Nowe struktury do szczegółowego podglądu zużycia:
            dailyHistory: allDailyEntries,
            weeklyHistory,
            monthlyHistory,
            productRanking,
        };

        return NextResponse.json(responseData);
    } catch (error: any) {
        console.error("Błąd pobierania szczegółów składnika:", error);
        return NextResponse.json(
            { error: "Błąd serwera podczas pobierania szczegółów składnika", details: error.message },
            { status: 500 }
        );
    }
}

