import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Funkcja rekurencyjnego sprawdzania zależności cyklicznych
async function checkCircularDependency(targetSemiId: string, candidateChildId: string, tx: any): Promise<boolean> {
    if (candidateChildId === targetSemiId) return true;
    const childSemi = await tx.semiFinished.findUnique({
        where: { id: candidateChildId },
        include: { ingredients: true },
    });
    if (!childSemi) return false;
    for (const ing of childSemi.ingredients) {
        if (ing.childSemiFinishedId) {
            if (ing.childSemiFinishedId === targetSemiId) return true;
            const hasCycle = await checkCircularDependency(targetSemiId, ing.childSemiFinishedId, tx);
            if (hasCycle) return true;
        }
    }
    return false;
}

// Funkcja rekurencyjnej aktualizacji kosztów nadrzędnych półproduktów oraz wyrobów gotowych
async function recalculateAffectedSemiFinishedAndRecipes(semiId: string, tx: any) {
    // 1. Półprodukty nadrzędne
    const parentSemiLinks = await tx.semiFinishedIngredient.findMany({
        where: { childSemiFinishedId: semiId },
        include: {
            semiFinished: {
                include: {
                    ingredients: {
                        include: { ingredient: true, childSemiFinished: true },
                    },
                },
            },
        },
    });

    for (const link of parentSemiLinks) {
        const parent = link.semiFinished;
        if (!parent) continue;

        let parentCost = 0;
        for (const ing of parent.ingredients) {
            const amt = Number(ing.amount || 0);
            if (ing.ingredient) {
                parentCost += amt * Number(ing.ingredient.calculatedPrice || 0);
            } else if (ing.childSemiFinished) {
                parentCost += amt * Number(ing.childSemiFinished.cost || 0);
            }
        }

        await tx.semiFinished.update({
            where: { id: parent.id },
            data: { cost: parentCost },
        });

        await recalculateAffectedSemiFinishedAndRecipes(parent.id, tx);
    }

    // 2. Wyroby piekarnicze
    const affectedRecipes = await tx.recipeIngredient.findMany({
        where: { semiFinishedId: semiId },
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
                newFoodCost += amt * Number(item.semiFinished.cost || 0);
            }
        }

        newFoodCost += Number((bp as any).packagingCost || 0);

        await tx.bakeryProduct.update({
            where: { id: bp.id },
            data: { productionCost: newFoodCost },
        });
    }
}

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
                    orderBy: { order: "asc" },
                    include: {
                        ingredient: true,
                        childSemiFinished: true,
                    },
                },
                usedInSemiFinished: {
                    include: { semiFinished: true },
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

        const ingredientIds = ingredients.filter((i: any) => i.ingredientId).map((i: any) => i.ingredientId);
        const childSemiIds = ingredients
            .filter((i: any) => i.childSemiFinishedId || i.semiFinishedId)
            .map((i: any) => i.childSemiFinishedId || i.semiFinishedId);

        // Walidacja zależności cyklicznych
        for (const childId of childSemiIds) {
            const hasCycle = await checkCircularDependency(id, childId, prisma);
            if (hasCycle) {
                return NextResponse.json(
                    { error: "Wykryto zależność cykliczną: półprodukt nie może zawierać samego siebie ani tworzyć pętli zależności." },
                    { status: 400 }
                );
            }
        }

        const [dbIngredients, dbSemiFinisheds] = await Promise.all([
            ingredientIds.length > 0 ? prisma.ingredient.findMany({ where: { id: { in: ingredientIds } } }) : [],
            childSemiIds.length > 0 ? prisma.semiFinished.findMany({ where: { id: { in: childSemiIds } } }) : [],
        ]);

        let calculatedUnitCost = 0;
        for (const item of ingredients) {
            const ingId = item.ingredientId;
            const semiId = item.childSemiFinishedId || item.semiFinishedId;
            const amt = Number(item.amount || 0);

            if (ingId) {
                const dbIng = dbIngredients.find((db) => db.id === ingId);
                const price = Number(dbIng?.calculatedPrice || 0);
                calculatedUnitCost += price * amt;
            } else if (semiId) {
                const dbSemi = dbSemiFinisheds.find((db) => db.id === semiId);
                const price = Number(dbSemi?.cost || 0);
                calculatedUnitCost += price * amt;
            }
        }

        // Aktualizujemy półprodukt w transakcji
        const updatedSemi = await prisma.$transaction(async (tx) => {
            // 1. Usunięcie dotychczasowych składników
            await tx.semiFinishedIngredient.deleteMany({
                where: { semiFinishedId: id },
            });

            // 2. Aktualizacja danych półproduktu i wstawienie nowych składników
            const updated = await tx.semiFinished.update({
                where: { id },
                data: {
                    name: name.trim(),
                    unit: unit || "kg",
                    cost: calculatedUnitCost,
                    ingredients: {
                        create: ingredients.map((item: any, index: number) => ({
                            ingredientId: item.ingredientId || null,
                            childSemiFinishedId: item.childSemiFinishedId || item.semiFinishedId || null,
                            amount: item.amount,
                            unit: item.unit,
                            order: item.order !== undefined ? Number(item.order) : index,
                        })),
                    },
                },
                include: {
                    ingredients: {
                        orderBy: { order: "asc" },
                        include: {
                            ingredient: true,
                            childSemiFinished: true,
                        },
                    },
                },
            });

            // 3. Kaskadowa aktualizacja kosztów wszystkich zależnych półproduktów i wyrobów
            await recalculateAffectedSemiFinishedAndRecipes(id, tx);

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

        // Sprawdzamy czy półprodukt nie jest używany w wyrobach piekarniczych
        const usedInRecipes = await prisma.recipeIngredient.findFirst({
            where: { semiFinishedId: id },
            include: { bakeryProduct: true },
        });

        if (usedInRecipes) {
            return NextResponse.json(
                {
                    error: `Nie można usunąć półproduktu, ponieważ jest wykorzystywany w przepisie wyrobu: ${usedInRecipes.bakeryProduct?.name || "wyrobu"}`,
                },
                { status: 400 }
            );
        }

        // Sprawdzamy czy półprodukt nie jest używany w innych półproduktach nadrzędnych
        const usedInParentSemi = await prisma.semiFinishedIngredient.findFirst({
            where: { childSemiFinishedId: id },
            include: { semiFinished: true },
        });

        if (usedInParentSemi) {
            return NextResponse.json(
                {
                    error: `Nie można usunąć półproduktu, ponieważ jest składnikiem innego półproduktu: ${usedInParentSemi.semiFinished?.name || "półproduktu"}`,
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
