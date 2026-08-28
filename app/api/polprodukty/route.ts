import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const semiFinished = await prisma.semiFinished.findMany({
            include: {
                ingredients: {
                    include: { ingredient: true },
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

        const newSemi = await prisma.semiFinished.create({
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
        });

        return NextResponse.json(newSemi);
    } catch (error: any) {
        console.error("Błąd tworzenia półproduktu:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}