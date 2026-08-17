import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, IngredientType } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, unit, type } = body;

        if (!name) {
            return NextResponse.json({ error: "Nazwa składnika jest wymagana" }, { status: 400 });
        }

        const ingredient = await prisma.ingredient.create({
            data: {
                name,
                unit: unit || "kg",
                type: type === "FLOUR" ? IngredientType.FLOUR : IngredientType.OTHER,
            },
        });

        return NextResponse.json({ success: true, ingredient });
    } catch (error: any) {
        console.error("Błąd podczas tworzenia składnika:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}