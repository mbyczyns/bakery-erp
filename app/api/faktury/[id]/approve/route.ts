import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // <-- ZMIANA: params jest teraz obietnicą (Promise)
) {
    try {
        // ZMIANA: Musimy "poczekać" na rozwiązanie parametrów z adresu URL
        const { id } = await params;

        const body = await request.json();
        const { itemsMapping } = body; // Oczekujemy tablicy: [{ productId, categoryId, ingredientId, multiplier }]

        if (!itemsMapping || !Array.isArray(itemsMapping)) {
            return NextResponse.json({ error: "Brak danych mapowania" }, { status: 400 });
        }

        // 1. Pobieramy fakturę wraz z pozycjami, aby mieć dostęp do aktualnych cen z KSeF
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: { positions: true },
        });

        if (!invoice) {
            return NextResponse.json({ error: "Nie znaleziono faktury" }, { status: 404 });
        }

        // Przygotowujemy tablicę operacji do wykonania w ramach jednej transakcji
        const operations = [];

        // 2. Analizujemy każdą przysłaną pozycję z modala
        for (const mapping of itemsMapping) {
            const { productId, categoryId, ingredientId, multiplier } = mapping;

            // Zabezpieczenie wartości mnożnika (zawsze minimum 0.001)
            const safeMultiplier = Math.max(0.001, parseFloat(multiplier) || 1);

            // A. Aktualizacja "Pamięci Dostawców" (Tabela Product)
            operations.push(
                prisma.product.update({
                    where: { id: productId },
                    data: {
                        categoryId: categoryId,
                        ingredientId: ingredientId || null,
                        multiplier: safeMultiplier,
                    },
                })
            );

            // B. Aktualizacja ceny bazowej surowca (Tabela Ingredient)
            if (ingredientId) {
                // Szukamy, jaką cenę miał ten produkt na weryfikowanej właśnie fakturze
                const position = invoice.positions.find(p => p.productId === productId);

                if (position && position.netPrice) {
                    // Magia przelicznika: Cena Netto za opakowanie / współczynnik = Cena za 1 jednostkę bazową
                    const baseUnitPrice = Number(position.netPrice) / safeMultiplier;

                    operations.push(
                        prisma.ingredient.update({
                            where: { id: ingredientId },
                            data: {
                                // Zapisujemy nową uśrednioną cenę za jednostkę bazową
                                calculatedPrice: baseUnitPrice,
                            },
                        })
                    );
                }
            }
        }

        // 3. Na koniec zmieniamy status dokumentu na Zaakceptowany (IMPORTED)
        operations.push(
            prisma.invoice.update({
                where: { id },
                data: {
                    status: "IMPORTED",
                },
            })
        );

        // 4. Wykonujemy wszystkie operacje na raz
        await prisma.$transaction(operations);

        return NextResponse.json({ success: true, message: "Faktura zmapowana pomyślnie" });
    } catch (error: any) {
        console.error("Błąd zatwierdzania faktury:", error);
        return NextResponse.json(
            { error: "Wystąpił błąd podczas zapisywania w bazie danych", details: error.message },
            { status: 500 }
        );
    }
}