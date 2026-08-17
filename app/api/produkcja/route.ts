import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Pobieranie wyrobów i raportu z bazy dla podanej daty
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
        const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

        // 1. Pobieramy wszystkie wyroby z bazy
        const products = await prisma.bakeryProduct.findMany({
            orderBy: { name: "asc" },
        });

        // 2. Pobieramy raporty produkcyjne dla danej daty
        const productions = await prisma.dailyProduction.findMany({
            where: {
                date: targetDate,
            },
        });

        return NextResponse.json({
            date: dateStr,
            products,
            productions,
        });
    } catch (error: any) {
        console.error("Błąd pobierania raportu produkcji:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}

// POST: Zapis/Aktualizacja raportu w bazie
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { date, items } = body; // items: [{ bakeryProductId, producedAmount, soldAmount }]

        if (!date || !Array.isArray(items)) {
            return NextResponse.json({ error: "Nieprawidłowe dane wejściowe" }, { status: 400 });
        }

        const targetDate = new Date(`${date}T00:00:00.000Z`);

        // Zapis/Aktualizacja w transakcji z użyciem pól z Twojego schematu
        const operations = items.map((item: any) => {
            const producedAmt = Math.max(0, parseInt(item.producedAmount) || 0);
            const soldAmt = Math.max(0, parseInt(item.soldAmount) || 0);

            return prisma.dailyProduction.upsert({
                where: {
                    date_bakeryProductId: {
                        date: targetDate,
                        bakeryProductId: item.bakeryProductId,
                    },
                },
                update: {
                    producedAmount: producedAmt,
                    soldAmount: soldAmt,
                },
                create: {
                    date: targetDate,
                    bakeryProductId: item.bakeryProductId,
                    producedAmount: producedAmt,
                    soldAmount: soldAmt,
                },
            });
        });

        await prisma.$transaction(operations);

        return NextResponse.json({ success: true, message: "Raport dzienny został pomyślnie zapisany!" });
    } catch (error: any) {
        console.error("Błąd zapisu raportu produkcji:", error);
        return NextResponse.json({ error: "Błąd zapisu w bazie danych", details: error.message }, { status: 500 });
    }
}