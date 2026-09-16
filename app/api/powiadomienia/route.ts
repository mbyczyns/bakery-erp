import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCustomNamesMap } from "@/lib/contractor-names";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

const STATE_FILE = path.join(process.cwd(), "data", "notifications-state.json");

function getDismissedIds(): Set<string> {
    try {
        if (!fs.existsSync(STATE_FILE)) return new Set();
        const raw = fs.readFileSync(STATE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed.dismissed) ? parsed.dismissed : []);
    } catch {
        return new Set();
    }
}

function saveDismissedIds(dismissed: Set<string>) {
    try {
        const dir = path.dirname(STATE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify({ dismissed: Array.from(dismissed) }, null, 2),
            "utf-8"
        );
    } catch (e) {
        console.error("Błąd zapisu stanu powiadomień:", e);
    }
}

export async function GET(request: NextRequest) {
    try {
        const customNamesMap = getCustomNamesMap();
        const dismissedIds = getDismissedIds();

        // =========================================================================
        // 1. POBIERANIE NIEZMAPOWANYCH / OCZEKUJĄCYCH FAKTUR
        // =========================================================================
        const foodCategory = await prisma.productCategory.findFirst({
            where: { name: { equals: "produkty spożywcze", mode: "insensitive" } },
        });
        const foodCatId = foodCategory?.id;

        const allInvoices = await prisma.invoice.findMany({
            where: {
                status: { in: ["WAITING", "IMPORTED"] },
                isSales: false,
            },
            include: {
                contractor: true,
                positions: {
                    include: {
                        product: true,
                    },
                },
            },
            orderBy: {
                issuedDate: "desc",
            },
        });

        const unmappedInvoiceAlerts: Array<{
            id: string;
            invoiceId: string;
            invoiceNumber: string;
            contractorName: string;
            issuedDate: string;
            grossAmount: number;
            totalPositionsCount: number;
            unmappedPositionsCount: number;
            status: string;
            isDismissed: boolean;
        }> = [];

        for (const inv of allInvoices) {
            const positions = inv.positions || [];
            let unmappedCount = 0;

            positions.forEach((pos) => {
                const prod = pos.product;
                const hasCategory = Boolean(prod?.categoryId);
                const isFood = prod?.categoryId === foodCatId;
                const hasIngredient = Boolean(prod?.ingredientId);

                // Niezmapowane jeśli: brak kategorii LUB (kategoria spożywcza i brak przypisanego surowca)
                if (!hasCategory || (isFood && !hasIngredient)) {
                    unmappedCount++;
                }
            });

            // Jeśli faktura jest w statusie WAITING LUB ma pozycje do zmapowania
            if (inv.status === "WAITING" || unmappedCount > 0) {
                const alertId = `inv-${inv.id}`;
                unmappedInvoiceAlerts.push({
                    id: alertId,
                    invoiceId: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    contractorName:
                        customNamesMap[inv.contractorId] ||
                        (inv.contractor as any)?.customName ||
                        inv.contractor?.name ||
                        "Nieznany kontrahent",
                    issuedDate: inv.issuedDate
                        ? new Date(inv.issuedDate).toISOString().split("T")[0]
                        : "",
                    grossAmount: Number(inv.grossAmount || 0),
                    totalPositionsCount: positions.length,
                    unmappedPositionsCount: unmappedCount,
                    status: inv.status,
                    isDismissed: dismissedIds.has(alertId),
                });
            }
        }

        // =========================================================================
        // 2. ANALIZA PODWYŻEK CEN SKŁADNIKÓW I WPŁYWU NA WYROBY
        // =========================================================================
        const ingredients = await prisma.ingredient.findMany({
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
                        bakeryProduct: true,
                    },
                },
                semiFinishedIngredients: {
                    include: {
                        semiFinished: {
                            include: {
                                bakeryRecipes: {
                                    include: {
                                        bakeryProduct: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const priceAlerts: Array<{
            id: string;
            ingredientId: string;
            ingredientName: string;
            ingredientUnit: string;
            oldPrice: number;
            newPrice: number;
            priceDifference: number;
            percentIncrease: number;
            lastSupplierName: string;
            lastPurchaseDate: string;
            lastInvoiceNumber: string;
            affectedProducts: Array<{
                productId: string;
                productName: string;
                productType: string;
                currentSellingPrice: number;
                currentProductionCost: number;
                amountUsed: number;
                unit: string;
                foodCostIncrease: number;
                suggestedSellingPrice: number;
                isDirect: boolean;
            }>;
            isDismissed: boolean;
        }> = [];

        for (const ing of ingredients) {
            // Zbieramy wszystkie dostawy posortowane od najnowszej
            const deliveries: Array<{
                date: string;
                rawDate: Date;
                unitPrice: number;
                supplierName: string;
                invoiceNumber: string;
            }> = [];

            for (const prod of ing.products) {
                const multiplier = Number(prod.multiplier || 1) || 1;
                for (const pos of prod.invoicePositions) {
                    if (pos.invoice?.status === "REJECTED") continue;
                    if (!pos.invoice?.issuedDate) continue;

                    const unitPrice = Number(pos.netPrice) / multiplier;
                    deliveries.push({
                        date: new Date(pos.invoice.issuedDate).toISOString().split("T")[0],
                        rawDate: new Date(pos.invoice.issuedDate),
                        unitPrice: Math.round(unitPrice * 100) / 100,
                        supplierName:
                            customNamesMap[pos.invoice.contractorId] ||
                            pos.invoice.contractor?.name ||
                            prod.supplier?.name ||
                            "Dostawca",
                        invoiceNumber: pos.invoice.invoiceNumber,
                    });
                }
            }

            deliveries.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

            if (deliveries.length === 0) continue;

            const latest = deliveries[0];
            let previousPrice: number | null = null;

            // Szukamy poprzedniej innej ceny zakupu
            for (let i = 1; i < deliveries.length; i++) {
                if (deliveries[i].unitPrice > 0) {
                    previousPrice = deliveries[i].unitPrice;
                    break;
                }
            }

            // Fallback do calculatedPrice z bazy jeśli brak wcześniejszych faktur
            if (previousPrice === null && Number(ing.calculatedPrice) > 0) {
                previousPrice = Number(ing.calculatedPrice);
            }

            // Sprawdzamy czy nastąpił faktyczny wzrost ceny (min. 0.01 zł oraz > 0.0%)
            if (previousPrice !== null && latest.unitPrice > previousPrice) {
                const diff = Math.round((latest.unitPrice - previousPrice) * 100) / 100;
                const pct = Math.round((diff / previousPrice) * 1000) / 10;

                // Pomijamy jeśli wzrost po zaokrągleniu wynosi 0.00 zł lub 0.0%
                if (diff <= 0 || pct <= 0) continue;

                // Szukamy wszystkich wyrobów powiązanych z tym składnikiem
                const affectedMap = new Map<
                    string,
                    {
                        productId: string;
                        productName: string;
                        productType: string;
                        currentSellingPrice: number;
                        currentProductionCost: number;
                        amountUsed: number;
                        unit: string;
                        foodCostIncrease: number;
                        suggestedSellingPrice: number;
                        isDirect: boolean;
                    }
                >();

                // 1. Bezpośrednie użycie w recepturze wyrobu
                (ing.recipeIngredients || []).forEach((ri) => {
                    const bp = ri.bakeryProduct;
                    if (!bp) return;

                    const amountNum = Number(ri.amount || 0);
                    const costIncrease = Math.round(amountNum * diff * 100) / 100;
                    const curSellPrice = Number(bp.sellingPrice || 0);
                    const curProdCost = Number(bp.productionCost || 0);
                    const suggestedSellPrice = Math.round((curSellPrice + costIncrease) * 100) / 100;

                    affectedMap.set(bp.id, {
                        productId: bp.id,
                        productName: bp.name,
                        productType: bp.type,
                        currentSellingPrice: curSellPrice,
                        currentProductionCost: curProdCost,
                        amountUsed: amountNum,
                        unit: ri.ingredientUnit || ing.unit,
                        foodCostIncrease: costIncrease,
                        suggestedSellingPrice: suggestedSellPrice,
                        isDirect: true,
                    });
                });

                // 2. Pośrednie użycie przez półprodukty
                (ing.semiFinishedIngredients || []).forEach((sfi) => {
                    const sf = sfi.semiFinished;
                    if (!sf) return;

                    const sfAmount = Number(sfi.amount || 0);

                    (sf.bakeryRecipes || []).forEach((br) => {
                        const bp = br.bakeryProduct;
                        if (!bp) return;

                        const brAmount = Number(br.amount || 0);
                        const effectiveAmount = Math.round(sfAmount * brAmount * 1000) / 1000;
                        const costIncrease = Math.round(effectiveAmount * diff * 100) / 100;
                        const curSellPrice = Number(bp.sellingPrice || 0);
                        const curProdCost = Number(bp.productionCost || 0);
                        const suggestedSellPrice = Math.round((curSellPrice + costIncrease) * 100) / 100;

                        const existing = affectedMap.get(bp.id);
                        if (existing) {
                            existing.amountUsed += effectiveAmount;
                            existing.foodCostIncrease = Math.round((existing.foodCostIncrease + costIncrease) * 100) / 100;
                            existing.suggestedSellingPrice = Math.round((curSellPrice + existing.foodCostIncrease) * 100) / 100;
                        } else {
                            affectedMap.set(bp.id, {
                                productId: bp.id,
                                productName: bp.name,
                                productType: bp.type,
                                currentSellingPrice: curSellPrice,
                                currentProductionCost: curProdCost,
                                amountUsed: effectiveAmount,
                                unit: ing.unit,
                                foodCostIncrease: costIncrease,
                                suggestedSellingPrice: suggestedSellPrice,
                                isDirect: false,
                            });
                        }
                    });
                });

                const affectedProductsList = Array.from(affectedMap.values());
                const alertId = `price-${ing.id}-${latest.date}-${latest.unitPrice}`;

                priceAlerts.push({
                    id: alertId,
                    ingredientId: ing.id,
                    ingredientName: ing.name,
                    ingredientUnit: ing.unit,
                    oldPrice: previousPrice,
                    newPrice: latest.unitPrice,
                    priceDifference: diff,
                    percentIncrease: pct,
                    lastSupplierName: latest.supplierName,
                    lastPurchaseDate: latest.date,
                    lastInvoiceNumber: latest.invoiceNumber,
                    affectedProducts: affectedProductsList,
                    isDismissed: dismissedIds.has(alertId),
                });
            }
        }

        // =========================================================================
        // 3. STATYSTYKI I STRUMIEŃ POWIADOMIEŃ
        // =========================================================================
        const activeUnmappedCount = unmappedInvoiceAlerts.filter((a) => !a.isDismissed).length;
        const activePriceAlertsCount = priceAlerts.filter((a) => !a.isDismissed).length;
        const totalAffectedProducts = priceAlerts
            .filter((a) => !a.isDismissed)
            .reduce((sum, a) => sum + a.affectedProducts.length, 0);

        return NextResponse.json({
            summary: {
                totalCount: activeUnmappedCount + activePriceAlertsCount,
                unmappedInvoicesCount: activeUnmappedCount,
                priceAlertsCount: activePriceAlertsCount,
                affectedProductsCount: totalAffectedProducts,
            },
            unmappedInvoices: unmappedInvoiceAlerts,
            priceAlerts,
        });
    } catch (error: any) {
        console.error("Błąd pobierania powiadomień:", error);
        return NextResponse.json(
            { error: "Błąd serwera podczas analizy powiadomień", details: error.message },
            { status: 500 }
        );
    }
}

// POST: Oznaczanie powiadomienia jako przeczytane / ukryte
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, alertId, alertIds } = body;

        const dismissed = getDismissedIds();

        if (action === "DISMISS" && alertId) {
            dismissed.add(alertId);
            saveDismissedIds(dismissed);
            return NextResponse.json({ success: true, message: "Powiadomienie zostało ukryte" });
        }

        if (action === "DISMISS_ALL" && Array.isArray(alertIds)) {
            alertIds.forEach((id) => dismissed.add(id));
            saveDismissedIds(dismissed);
            return NextResponse.json({ success: true, message: "Wszystkie powiadomienia zostały ukryte" });
        }

        if (action === "RESTORE_ALL") {
            saveDismissedIds(new Set());
            return NextResponse.json({ success: true, message: "Przywrócono wszystkie powiadomienia" });
        }

        return NextResponse.json({ error: "Nieznana akcja" }, { status: 400 });
    } catch (error: any) {
        console.error("Błąd zapisu akcji powiadomienia:", error);
        return NextResponse.json(
            { error: "Błąd serwera", details: error.message },
            { status: 500 }
        );
    }
}
