import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const semiFinished = await prisma.semiFinished.findMany({
            include: {
                ingredients: {
                    orderBy: { order: "asc" },
                    include: {
                        ingredient: true,
                        childSemiFinished: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });
        return NextResponse.json({ semiFinished });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, unit, ingredients } = body;

        if (!name || !ingredients || ingredients.length === 0) {
            return NextResponse.json({ error: "Brak wymaganych danych" }, { status: 400 });
        }

        // Pobieramy surowce oraz ewentualne pod-półprodukty
        const ingredientIds = ingredients.filter((i: any) => i.ingredientId).map((i: any) => i.ingredientId);
        const childSemiIds = ingredients
            .filter((i: any) => i.childSemiFinishedId || i.semiFinishedId)
            .map((i: any) => i.childSemiFinishedId || i.semiFinishedId);

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

        const newSemi = await prisma.semiFinished.create({
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

        return NextResponse.json(newSemi);
    } catch (error: any) {
        console.error("Błąd tworzenia półproduktu:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}