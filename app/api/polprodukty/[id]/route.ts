import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Pobranie pojedynczego półproduktu
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const semi = await prisma.semiFinished.findUnique({
            where: { id },
            include: {
                ingredients: {
                    include: { ingredient: true },
                },
                bakeryRecipes: {
                    include: { bakeryProduct: true },
                },
            },
        });

        if (!semi) {
            return NextResponse.json({ error: "Nie znaleziono półproduktu" }, { status: 404 });
        }

        return NextResponse.json(semi);
    } catch (error: any) {
        console.error("Błąd pobierania półproduktu:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH / PUT: Edycja półproduktu
export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { name, unit, ingredients } = body;

        if (!name || !ingredients || ingredients.length === 0) {
            return NextResponse.json({ error: "Brak wymaganych danych" }, { status: 400 });
        }

        // Pobieramy aktualne ceny surowców, aby wyliczyć koszt wytworzenia 1 jednostki półproduktu
        const ingredientIds = ingredients.map((i: any) => i.ingredientId);
        const dbIngredients = await prisma.ingredient.findMany({
            where: { id: { in: ingredientIds } },
        });

        let calculatedUnitCost = 0;
        for (const item of ingredients) {
            const dbIng = dbIngredients.find((db) => db.id === item.ingredientId);
            const price = Number(dbIng?.calculatedPrice || 0);
            calculatedUnitCost += price * Number(item.amount || 0);
        }

        // Aktualizujemy półprodukt w transakcji: usuwamy stare składniki i wstawiamy nowe
        const updatedSemi = await prisma.$transaction(async (tx) => {
            // 1. Usunięcie dotychczasowych składników półproduktu
            await tx.semiFinishedIngredient.deleteMany({
                where: { semiFinishedId: id },
            });

            // 2. Aktualizacja danych półproduktu i wstawienie nowych pozycji
            const updated = await tx.semiFinished.update({
                where: { id },
                data: {
                    name,
                    unit: unit || "kg",
                    cost: calculatedUnitCost,
                    ingredients: {
                        create: ingredients.map((item: any) => ({
                            ingredientId: item.ingredientId,
                            amount: item.amount,
                            unit: item.unit,
                        })),
                    },
                },
                include: {
                    ingredients: {
                        include: { ingredient: true },
                    },
                },
            });

            // 3. Przeliczenie kosztów wyrobów piekarniczych wykorzystujących ten półprodukt
            const affectedRecipes = await tx.recipeIngredient.findMany({
                where: { semiFinishedId: id },
                include: {
                    bakeryProduct: {
                        include: {
                            ingredients: {
                                include: {
                                    ingredient: true,
                                    semiFinished: true,
                                },
                            },
                        },
                    },
                },
            });

            for (const rec of affectedRecipes) {
                const bp = rec.bakeryProduct;
                if (!bp) continue;

                let newFoodCost = 0;
                for (const item of bp.ingredients) {
                    const amt = Number(item.amount || 0);
                    if (item.ingredient) {
                        newFoodCost += amt * Number(item.ingredient.calculatedPrice || 0);
                    } else if (item.semiFinished) {
                        const semiCost = item.semiFinishedId === id ? calculatedUnitCost : Number(item.semiFinished.cost || 0);
                        newFoodCost += amt * semiCost;
                    }
                }

                await tx.bakeryProduct.update({
                    where: { id: bp.id },
                    data: { productionCost: newFoodCost },
                });
            }

            return updated;
        });

        return NextResponse.json(updatedSemi);
    } catch (error: any) {
        console.error("Błąd edycji półproduktu:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Usunięcie półproduktu
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        // Sprawdzamy czy półprodukt nie jest używany w żadnym przepisie
        const usedInRecipes = await prisma.recipeIngredient.findFirst({
            where: { semiFinishedId: id },
            include: { bakeryProduct: true },
        });

        if (usedInRecipes) {
            return NextResponse.json(
                {
                    error: `Nie można usunąć półproduktu, ponieważ jest wykorzystywany w przepisie: ${usedInRecipes.bakeryProduct?.name || "wyrobu"}`,
                },
                { status: 400 }
            );
        }

        await prisma.semiFinished.delete({
            where: { id },
        });

        return NextResponse.json({ success: true, message: "Półprodukt został usunięty" });
    } catch (error: any) {
        console.error("Błąd usuwania półproduktu:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
