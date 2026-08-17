import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Wyciągamy typ bezpośrednio ze schematu Prismy
type ProductType = "BREAD" | "ROLL" | "SWEET" | "SAVORY";

export async function GET() {
    try {
        const recipes = await prisma.bakeryProduct.findMany({
            include: {
                ingredients: {
                    include: {
                        ingredient: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({ recipes });
    } catch (error: any) {
        console.error("Błąd pobierania przepisów:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, type, sellingPrice, ingredients } = body;

        if (!name || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return NextResponse.json(
                { error: "Nazwa wyrobu oraz co najmniej jeden składnik są wymagane" },
                { status: 400 }
            );
        }

        const newProduct = await prisma.bakeryProduct.create({
            data: {
                name,
                type: (type as ProductType) || "BREAD",
                sellingPrice: Number(sellingPrice || 0),
                ingredients: {
                    create: ingredients.map((ing: any) => ({
                        amount: Number(ing.amount),
                        ingredientUnit: ing.unit || "kg",
                        ingredientId: ing.ingredientId,
                    })),
                },
            },
            include: {
                ingredients: {
                    include: { ingredient: true },
                },
            },
        });

        return NextResponse.json({ success: true, recipe: newProduct });
    } catch (error: any) {
        console.error("Błąd tworzenia przepisu:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}