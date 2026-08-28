import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, IngredientType } from "@prisma/client";

const prisma = new PrismaClient();

// ==============================================================================
// GET - Pobieranie składników z wyliczeniem ostatniego dostawcy, daty i ceny
// ==============================================================================
export async function GET() {
    try {
        const ingredients = await prisma.ingredient.findMany({
            include: {
                // Pobieramy wszystkie produkty (od różnych dostawców) przypisane do surowca
                products: {
                    include: {
                        supplier: true, // Pobieramy nazwę dostawcy
                        invoicePositions: {
                            include: { invoice: true }, // Pobieramy dane faktury (dla daty)
                            orderBy: { invoice: { issuedDate: 'desc' } }, // Sortujemy od najnowszej
                            take: 1 // Bierzemy tylko ostatnią fakturę dla danego produktu
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        const enrichedIngredients = ingredients.map(ing => {
            let lastPurchase = null;

            // Surowiec mógł być kupiony u kilku dostawców. Szukamy ABSOLUTNIE najnowszej faktury.
            for (const prod of ing.products) {
                if (prod.invoicePositions && prod.invoicePositions.length > 0) {
                    const pos = prod.invoicePositions[0];

                    if (!lastPurchase || new Date(pos.invoice.issuedDate) > new Date(lastPurchase.date)) {
                        // Obliczamy rzeczywistą cenę za 1 jednostkę bazową (np. za 1 kg, używając mnożnika)
                        const realUnitPrice = Number(pos.netPrice) / Number(prod.multiplier || 1);

                        lastPurchase = {
                            supplierName: prod.supplier.name,
                            date: pos.invoice.issuedDate,
                            price: realUnitPrice
                        };
                    }
                }
            }

            // Zwracamy spłaszczony obiekt gotowy do wyświetlenia na frontendzie w tabeli
            return {
                id: ing.id,
                name: ing.name,
                unit: ing.unit,
                type: ing.type,
                calculatedPrice: ing.calculatedPrice,
                lastSupplierName: lastPurchase ? lastPurchase.supplierName : null,
                lastPurchaseDate: lastPurchase ? lastPurchase.date : null,
                lastPurchasePrice: lastPurchase ? lastPurchase.price : null
            };
        });

        return NextResponse.json({ ingredients: enrichedIngredients });
    } catch (error: any) {
        console.error("Błąd przy pobieraniu składników:", error);
        return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
    }
}

// ==============================================================================
// POST - Tworzenie nowego surowca (np. z poziomu modala na fakturach)
// ==============================================================================
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, unit, type } = body;

        if (!name) {
            return NextResponse.json({ error: "Nazwa składnika jest wymagana" }, { status: 400 });
        }

        const validTypes: IngredientType[] = ["FLOUR", "FRUIT", "DAIRY", "OTHER"];
        const assignedType: IngredientType = validTypes.includes(type) ? type : "OTHER";

        const ingredient = await prisma.ingredient.create({
            data: {
                name: name.trim(),
                unit: unit || "kg",
                type: assignedType,
            },
        });

        return NextResponse.json(ingredient);
    } catch (error: any) {
        console.error("Błąd podczas tworzenia składnika:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}