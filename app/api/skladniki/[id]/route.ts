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

        // 3. Okres ostatnich 6 miesięcy do wykresów
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

        // 4. Historia cen (Price History) oraz Wolumen Zużycie vs Zakupy (Volume History)
        const initialPrice = deliveriesHistory.length > 0
            ? deliveriesHistory[deliveriesHistory.length - 1].price
            : Number(ingredient.calculatedPrice || 0);

        let runningPrice = initialPrice;

        const priceHistory: Array<{ month: string; avgPrice: number }> = [];
        const volumeHistory: Array<{ month: string; consumed: number; purchased: number }> = [];

        let totalConsumedAcrossMonths = 0;

        for (const m of monthsRange) {
            // Zakupy w danym miesiącu
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

            // Zużycie w danym miesiącu z produkcji
            let monthConsumed = 0;

            // A. Zużycie bezpośrednie z receptur
            for (const rec of ingredient.recipeIngredients) {
                const amountPerUnit = Number(rec.amount || 0);
                if (rec.bakeryProduct?.productions) {
                    for (const prod of rec.bakeryProduct.productions) {
                        const prodDate = new Date(prod.date);
                        if (
                            prodDate.getFullYear() === m.year &&
                            prodDate.getMonth() === m.monthIndex
                        ) {
                            monthConsumed += prod.producedAmount * amountPerUnit;
                        }
                    }
                }
            }

            // B. Zużycie pośrednie z półproduktów
            for (const semiIng of ingredient.semiFinishedIngredients) {
                const amountPerSemi = Number(semiIng.amount || 0);
                if (semiIng.semiFinished?.bakeryRecipes) {
                    for (const rec of semiIng.semiFinished.bakeryRecipes) {
                        const amountSemiPerProduct = Number(rec.amount || 0);
                        if (rec.bakeryProduct?.productions) {
                            for (const prod of rec.bakeryProduct.productions) {
                                const prodDate = new Date(prod.date);
                                if (
                                    prodDate.getFullYear() === m.year &&
                                    prodDate.getMonth() === m.monthIndex
                                ) {
                                    monthConsumed += prod.producedAmount * amountSemiPerProduct * amountPerSemi;
                                }
                            }
                        }
                    }
                }
            }

            const roundedConsumed = Math.round(monthConsumed * 100) / 100;
            const roundedPurchased = Math.round(monthPurchasedQty * 100) / 100;

            totalConsumedAcrossMonths += roundedConsumed;

            volumeHistory.push({
                month: m.label,
                consumed: roundedConsumed,
                purchased: roundedPurchased,
            });
        }

        // 5. Statystyki podsumowujące (Stats)
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

        const avgMonthlyConsumption = Math.round(totalConsumedAcrossMonths / (monthsRange.length || 1));

        const bestSupplier = suppliersRanking.find((s) => s.isBest);

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
            },
            priceHistory,
            volumeHistory,
            suppliersRanking,
            deliveriesHistory,
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
