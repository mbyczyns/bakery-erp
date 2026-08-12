import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const categories = await prisma.productCategory.findMany({
            orderBy: { name: 'asc' },
        });

        const ingredients = await prisma.ingredient.findMany({
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({
            categories,
            ingredients: ingredients.map((ing) => ({
                id: ing.id,
                name: ing.name,
                unit: ing.unit,
                type: ing.type, // <-- ZWRACAMY TYP ENUM (FLOUR / OTHER)
            })),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}