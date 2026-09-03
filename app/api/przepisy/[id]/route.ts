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
                    include: {
                        ingredient: true,
                        semiFinished: {
                            include: {
                                ingredients: {
                                    include: { ingredient: true },
                                },
                            },
                        },
                    },
                },
                productions: {
                    orderBy: { date: "desc" },
                    take: 30,
                },
            },
        });

        if (!recipe) {
            return NextResponse.json({ error: "Nie znaleziono przepisu" }, { status: 404 });
        }

        // Obliczamy dokładny koszt surowcowy (foodcost) na 1 sztukę wyrobu
        let calculatedFoodCost = 0;
        const detailedIngredients = recipe.ingredients.map((item) => {
            const amountNum = Number(item.amount || 0);
            let unitPrice = 0;
            let source = "UNKNOWN";

            if (item.ingredient) {
                unitPrice = Number(item.ingredient.calculatedPrice || 0);
                source = "INGREDIENT";
            } else if (item.semiFinished) {
                unitPrice = Number(item.semiFinished.cost || 0);
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
                unitPrice,
                costContribution: itemCost,
                ingredientDetails: item.ingredient,
                semiFinishedDetails: item.semiFinished,
            };
        });

        // Jeśli koszt w bazie różni się od wyliczonego, możemy go zsynchronizować w tle
        if (Number(recipe.productionCost) !== Number(calculatedFoodCost.toFixed(2))) {
            await prisma.bakeryProduct.update({
                where: { id },
                data: { productionCost: calculatedFoodCost },
            });
        }

        // Statystyki produkcji i sprzedaży z ostatnich 30 wpisów
        const totalProduced = recipe.productions.reduce((sum, p) => sum + (p.producedAmount || 0), 0);
        const totalSold = recipe.productions.reduce((sum, p) => sum + (p.soldAmount || 0), 0);
        const totalRevenue = recipe.productions.reduce((sum, p) => sum + (p.salesIncome || 0), 0);
        const totalUnsold = Math.max(0, totalProduced - totalSold);
        const sellThroughRate = totalProduced > 0 ? (totalSold / totalProduced) * 100 : 0;

        return NextResponse.json({
            recipe: {
                ...recipe,
                productionCost: calculatedFoodCost,
            },
            detailedIngredients,
            totalFoodCost: calculatedFoodCost,
            productionStats: {
                totalProduced,
                totalSold,
                totalUnsold,
                totalRevenue,
                sellThroughRate,
                count: recipe.productions.length,
            },
            productions: recipe.productions.map((p) => ({
                id: p.id,
                date: p.date.toISOString().split("T")[0],
                producedAmount: p.producedAmount,
                soldAmount: p.soldAmount,
                salesIncome: p.salesIncome,
                unsoldAmount: Math.max(0, p.producedAmount - p.soldAmount),
                efficiencyRate: p.producedAmount > 0 ? (p.soldAmount / p.producedAmount) * 100 : 0,
            })),
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
        const { sellingPrice, name, type } = body;

        const updateData: any = {};
        if (sellingPrice !== undefined) {
            updateData.sellingPrice = Number(sellingPrice);
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

// PUT: Pełna edycja przepisu (nazwa, kategoria, składniki)
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
        const { name, type, sellingPrice, ingredients } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Nazwa wyrobu jest wymagana" }, { status: 400 });
        }

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return NextResponse.json(
                { error: "Przepis musi zawierać co najmniej jeden składnik" },
                { status: 400 }
            );
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
                    ...(sellingPrice !== undefined && { sellingPrice: Number(sellingPrice) }),
                    ingredients: {
                        create: ingredients.map((ing: any) => ({
                            amount: Number(ing.amount),
                            ingredientUnit: ing.ingredientUnit || ing.unit || "kg",
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
