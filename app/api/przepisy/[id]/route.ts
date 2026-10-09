import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: "Brak identyfikatora przepisu" }, { status: 400 });
        }

        const recipe = await prisma.bakeryProduct.findUnique({
            where: { id },
            include: {
                ingredients: {
                    orderBy: { order: "asc" },
                    include: {
                        ingredient: {
                            include: {
                                products: {
                                    include: {
                                        invoicePositions: {
                                            include: { invoice: true },
                                            orderBy: { invoice: { issuedDate: "desc" } },
                                            take: 1,
                                        },
                                    },
                                },
                            },
                        },
                        semiFinished: {
                            include: {
                                ingredients: {
                                    orderBy: { order: "asc" },
                                    include: {
                                        ingredient: {
                                            include: {
                                                products: {
                                                    include: {
                                                        invoicePositions: {
                                                            include: { invoice: true },
                                                            orderBy: { invoice: { issuedDate: "desc" } },
                                                            take: 1,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        childSemiFinished: true,
                                    },
                                },
                            },
                        },
                    },
                },
                productions: {
                    orderBy: { date: "desc" },
                },
            },
        });

        if (!recipe) {
            return NextResponse.json({ error: "Nie znaleziono przepisu" }, { status: 404 });
        }

        const extractPrices = (ing: any) => {
            if (!ing) return { priceNet: 0, priceGross: 0 };
            let lastPurchase: { date: any; priceNet: number; priceGross: number } | null = null;
            if (ing.products && Array.isArray(ing.products)) {
                for (const prod of ing.products) {
                    if (prod.invoicePositions && prod.invoicePositions.length > 0) {
                        const pos = prod.invoicePositions[0];
                        if (pos.invoice?.status === "REJECTED") continue;
                        if (!lastPurchase || (pos.invoice?.issuedDate && new Date(pos.invoice.issuedDate) > new Date(lastPurchase.date))) {
                            const multiplier = Number(prod.multiplier || 1) || 1;
                            const realUnitPriceNet = Number(pos.netPrice) / multiplier;
                            const vatRate = Number(pos.vatRate ?? 0);
                            let realUnitPriceGross = 0;
                            if (Number(pos.grossAmount) > 0 && Number(pos.quantity) > 0) {
                                realUnitPriceGross = (Number(pos.grossAmount) / Number(pos.quantity)) / multiplier;
                            } else {
                                realUnitPriceGross = realUnitPriceNet * (1 + vatRate / 100);
                            }
                            lastPurchase = {
                                date: pos.invoice?.issuedDate,
                                priceNet: realUnitPriceNet,
                                priceGross: realUnitPriceGross,
                            };
                        }
                    }
                }
            }
            const fallbackNet = Number(ing.calculatedPrice || 0);
            const priceNet = lastPurchase ? lastPurchase.priceNet : fallbackNet;
            const priceGross = lastPurchase ? lastPurchase.priceGross : (priceNet > 0 ? priceNet * 1.05 : 0);
            return { priceNet, priceGross };
        };

        // Obliczamy dokładny koszt surowcowy (foodcost) na 1 sztukę wyrobu (składniki + koszt opakowania)
        let calculatedFoodCost = 0;
        const detailedIngredients = recipe.ingredients.map((item) => {
            const amountNum = Number(item.amount || 0);
            let unitPrice = 0;
            let unitPriceNet = 0;
            let unitPriceGross = 0;
            let source = "UNKNOWN";

            if (item.ingredient) {
                const prices = extractPrices(item.ingredient);
                unitPrice = prices.priceNet;
                unitPriceNet = prices.priceNet;
                unitPriceGross = prices.priceGross;
                source = "INGREDIENT";
            } else if (item.semiFinished) {
                unitPrice = Number(item.semiFinished.cost || 0);
                unitPriceNet = unitPrice;
                let semiGross = 0;
                if (item.semiFinished.ingredients && item.semiFinished.ingredients.length > 0) {
                    for (const sIng of item.semiFinished.ingredients) {
                        if (sIng.ingredient) {
                            const sp = extractPrices(sIng.ingredient);
                            semiGross += Number(sIng.amount || 0) * sp.priceGross;
                        }
                    }
                }
                unitPriceGross = semiGross > 0 ? semiGross : unitPriceNet * 1.05;
                source = "SEMI_FINISHED";
            }

            const itemCost = amountNum * unitPrice;
            calculatedFoodCost += itemCost;

            return {
                id: item.id,
                name: item.semiFinished?.name || item.ingredient?.name || "Nieznany składnik",
                kind: source,
                amount: amountNum,
                unit: item.ingredientUnit,
                notes: (item as any).notes || null,
                unitPrice,
                unitPriceNet,
                unitPriceGross,
                costContribution: itemCost,
                ingredientDetails: item.ingredient,
                semiFinishedDetails: item.semiFinished,
            };
        });

        // Doliczamy koszt opakowania do całkowitego foodcostu wyrobu
        const packagingCost = Number((recipe as any).packagingCost || 0);
        calculatedFoodCost += packagingCost;

        // Jeśli koszt w bazie różni się od wyliczonego, możemy go zsynchronizować w tle
        if (Number(recipe.productionCost) !== Number(calculatedFoodCost.toFixed(2))) {
            await prisma.bakeryProduct.update({
                where: { id },
                data: { productionCost: calculatedFoodCost },
            });
        }

        const currentSellingPrice = Number(recipe.sellingPrice || 0);

        // Statystyki produkcji i sprzedaży
        const totalProduced = recipe.productions.reduce((sum, p) => sum + Number(p.producedAmount || 0), 0);
        const totalSold = recipe.productions.reduce((sum, p) => sum + Number(p.soldAmount || 0), 0);
        const totalRevenue = recipe.productions.reduce((sum, p) => {
            const sold = Number(p.soldAmount || 0);
            const dbIncome = Number(p.salesIncome || 0);
            const inc = dbIncome > 0 ? dbIncome : Math.round(sold * currentSellingPrice * 100) / 100;
            return sum + inc;
        }, 0);
        const totalUnsold = Math.max(0, totalProduced - totalSold);
        const sellThroughRate = totalProduced > 0 ? (totalSold / totalProduced) * 100 : 0;

        return NextResponse.json({
            recipe: {
                ...recipe,
                packagingCost,
                productionCost: calculatedFoodCost,
            },
            detailedIngredients,
            packagingCost,
            totalFoodCost: calculatedFoodCost,
            productionStats: {
                totalProduced,
                totalSold,
                totalUnsold,
                totalRevenue,
                sellThroughRate,
                count: recipe.productions.length,
            },
            productions: recipe.productions.map((p) => {
                const produced = Number(p.producedAmount || 0);
                const sold = Number(p.soldAmount || 0);
                const dbIncome = Number(p.salesIncome || 0);
                const inc = dbIncome > 0 ? dbIncome : Math.round(sold * currentSellingPrice * 100) / 100;
                return {
                    id: p.id,
                    date: p.date.toISOString().split("T")[0],
                    producedAmount: produced,
                    soldAmount: sold,
                    salesIncome: inc,
                    unsoldAmount: Math.max(0, produced - sold),
                    efficiencyRate: produced > 0 ? (sold / produced) * 100 : 0,
                };
            }),
        });
    } catch (error: any) {
        console.error("Błąd pobierania przepisu:", error);
        return NextResponse.json(
            { error: "Błąd serwera", details: error.message },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { sellingPrice, packagingCost, name, type } = body;

        const updateData: any = {};
        if (sellingPrice !== undefined) {
            updateData.sellingPrice = Number(sellingPrice);
        }
        if (packagingCost !== undefined) {
            updateData.packagingCost = Number(packagingCost);
        }
        if (name !== undefined) {
            updateData.name = name.trim();
        }
        if (type !== undefined) {
            updateData.type = type;
        }

        const updated = await prisma.bakeryProduct.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ success: true, recipe: updated });
    } catch (error: any) {
        console.error("Błąd aktualizacji przepisu:", error);
        return NextResponse.json(
            { error: "Błąd aktualizacji", details: error.message },
            { status: 500 }
        );
    }
}

// PUT: Pełna edycja przepisu (nazwa, kategoria, koszt opakowania, składniki)
export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Brak identyfikatora przepisu" }, { status: 400 });
        }

        const body = await request.json();
        const { name, type, sellingPrice, packagingCost, batchSize, ingredients } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Nazwa wyrobu jest wymagana" }, { status: 400 });
        }

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return NextResponse.json(
                { error: "Przepis musi zawierać co najmniej jeden składnik" },
                { status: 400 }
            );
        }

        const ingredientIds = ingredients.map((i: any) => i.ingredientId).filter(Boolean);
        const semiFinishedIds = ingredients.map((i: any) => i.semiFinishedId).filter(Boolean);

        const [dbIngredients, dbSemiFinished] = await Promise.all([
            prisma.ingredient.findMany({ where: { id: { in: ingredientIds } } }),
            prisma.semiFinished.findMany({ where: { id: { in: semiFinishedIds } } }),
        ]);

        const ingPriceMap = new Map(dbIngredients.map((i) => [i.id, Number(i.calculatedPrice || 0)]));
        const semiCostMap = new Map(dbSemiFinished.map((s) => [s.id, Number(s.cost || 0)]));

        let calculatedFoodCost = Number(packagingCost || 0);
        for (const ing of ingredients) {
            const amt = Number(ing.amount || 0);
            if (ing.ingredientId && ingPriceMap.has(ing.ingredientId)) {
                calculatedFoodCost += amt * ingPriceMap.get(ing.ingredientId)!;
            } else if (ing.semiFinishedId && semiCostMap.has(ing.semiFinishedId)) {
                calculatedFoodCost += amt * semiCostMap.get(ing.semiFinishedId)!;
            }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Usunięcie dotychczasowych składników receptury
            await tx.recipeIngredient.deleteMany({
                where: { bakeryProductId: id },
            });

            // 2. Aktualizacja produktu i dodanie nowych składników
            await tx.bakeryProduct.update({
                where: { id },
                data: {
                    name: name.trim(),
                    type: type || "BREAD",
                    productionCost: calculatedFoodCost,
                    ...(batchSize !== undefined && { batchSize: Number(batchSize) || 1 }),
                    ...(sellingPrice !== undefined && { sellingPrice: Number(sellingPrice) }),
                    ...(packagingCost !== undefined && { packagingCost: Number(packagingCost) }),
                    ingredients: {
                        create: ingredients.map((ing: any, index: number) => ({
                            amount: Number(ing.amount),
                            ingredientUnit: ing.ingredientUnit || ing.unit || "kg",
                            order: ing.order !== undefined ? Number(ing.order) : index,
                            notes: ing.notes ? String(ing.notes).trim() : null,
                            ingredientId: ing.ingredientId || null,
                            semiFinishedId: ing.semiFinishedId || null,
                        })),
                    },
                },
            });
        });

        return NextResponse.json({ success: true, message: "Przepis został pomyślnie zaktualizowany" });
    } catch (error: any) {
        console.error("Błąd edycji przepisu:", error);
        return NextResponse.json(
            { error: "Błąd podczas zapisu zmian w przepisie", details: error.message },
            { status: 500 }
        );
    }
}

// DELETE: Usuwanie przepisu
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Brak identyfikatora przepisu" }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Usuwamy powiązane wpisy dziennej produkcji
            await tx.dailyProduction.deleteMany({
                where: { bakeryProductId: id },
            });

            // 2. Usuwamy składniki receptury
            await tx.recipeIngredient.deleteMany({
                where: { bakeryProductId: id },
            });

            // 3. Usuwamy sam wyrób
            await tx.bakeryProduct.delete({
                where: { id },
            });
        });

        return NextResponse.json({ success: true, message: "Przepis został trwale usunięty" });
    } catch (error: any) {
        console.error("Błąd usuwania przepisu:", error);
        return NextResponse.json(
            { error: "Błąd usuwania przepisu", details: error.message },
            { status: 500 }
        );
    }
}
