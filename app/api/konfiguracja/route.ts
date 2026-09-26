import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSystemSettings, saveSystemSettings } from "@/lib/settings";
import { PriceRoundingOption } from "@/lib/price-rounding";

const prisma = new PrismaClient();

// GET: Pobranie ustawień konfiguracyjnych
export async function GET() {
    try {
        const settings = getSystemSettings();

        // Sprawdzamy czy woda istnieje w bazie składników
        const waterIngredients = await prisma.ingredient.findMany({
            where: {
                name: { in: ["Woda", "woda", "Dolewka wody", "dolewka wody", "Dolewka Wody"] },
            },
        });

        // Jeśli w pliku settings jest 0, a w bazie jest ustawiona cena wody, bierzemy z bazy
        let waterPrice = settings.waterPricePerLiter;
        if (waterPrice === 0 && waterIngredients.length > 0) {
            waterPrice = Number(waterIngredients[0].calculatedPrice || 0);
        }

        return NextResponse.json({
            waterPricePerLiter: waterPrice,
            priceRounding: settings.priceRounding || "none",
            openingHours: settings.openingHours,
            waterIngredients: waterIngredients.map((w) => ({
                id: w.id,
                name: w.name,
                unit: w.unit,
                calculatedPrice: Number(w.calculatedPrice || 0),
            })),
        });
    } catch (error: any) {
        console.error("Błąd pobierania konfiguracji:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST / PATCH: Zapisanie ceny wody lub reguły zaokrąglania cen
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 1. Zapis konfiguracji zaokrąglania cen jeśli przesłano
        if (body.priceRounding !== undefined) {
            const validRoundingOptions: PriceRoundingOption[] = ["none", "0.10", "0.20", "0.50", "1.00"];
            const roundingVal = String(body.priceRounding) as PriceRoundingOption;
            if (!validRoundingOptions.includes(roundingVal)) {
                return NextResponse.json(
                    { error: "Nieprawidłowa opcja zaokrąglenia cen. Dozwolone: none, 0.10, 0.20, 0.50, 1.00" },
                    { status: 400 }
                );
            }
            saveSystemSettings({ priceRounding: roundingVal });

            // Jeśli przesłano tylko priceRounding, od razu zwracamy sukces
            if (body.waterPricePerLiter === undefined && body.waterPrice === undefined && body.openingHours === undefined) {
                return NextResponse.json({
                    success: true,
                    priceRounding: roundingVal,
                    message: "Zasada zaokrąglania cen została zaktualizowana.",
                });
            }
        }

        // 2. Zapis godzin otwarcia jeśli przesłano
        if (body.openingHours !== undefined) {
            const updated = saveSystemSettings({ openingHours: body.openingHours });
            if (body.waterPricePerLiter === undefined && body.waterPrice === undefined) {
                return NextResponse.json({
                    success: true,
                    openingHours: updated.openingHours,
                    message: "Godziny otwarcia piekarni zostały pomyślnie zaktualizowane.",
                });
            }
        }

        // 2. Obsługa ceny wody jeśli przesłano
        if (body.waterPricePerLiter !== undefined || body.waterPrice !== undefined) {
            const waterPrice = parseFloat(String(body.waterPricePerLiter ?? body.waterPrice).replace(",", "."));

            if (isNaN(waterPrice) || waterPrice < 0) {
                return NextResponse.json(
                    { error: "Podaj prawidłową stawkę za litr wody (liczba większa lub równa 0)" },
                    { status: 400 }
                );
            }

            // Zapisujemy w pliku konfiguracyjnym
            saveSystemSettings({ waterPricePerLiter: waterPrice });

            // Wyszukujemy lub tworzymy składniki "Woda" oraz "Dolewka wody"
            const waterNames = ["Woda", "Dolewka wody"];
            const affectedIngredientIds: string[] = [];

            for (const name of waterNames) {
                const existing = await prisma.ingredient.findFirst({
                    where: {
                        name: { equals: name, mode: "insensitive" },
                    },
                });

                if (existing) {
                    const updated = await prisma.ingredient.update({
                        where: { id: existing.id },
                        data: {
                            calculatedPrice: waterPrice,
                            unit: "l",
                        },
                    });
                    affectedIngredientIds.push(updated.id);
                } else {
                    const created = await prisma.ingredient.create({
                        data: {
                            name,
                            unit: "l",
                            calculatedPrice: waterPrice,
                            type: "OTHER",
                        },
                    });
                    affectedIngredientIds.push(created.id);
                }
            }

            // Przeliczamy koszt wszystkich półproduktów wykorzystujących wodę / dolewkę wody
            const allSemi = await prisma.semiFinished.findMany({
                include: {
                    ingredients: {
                        include: { ingredient: true },
                    },
                },
            });

            for (const semi of allSemi) {
                let calculatedCost = 0;
                for (const item of semi.ingredients) {
                    const amt = Number(item.amount || 0);
                    const price = affectedIngredientIds.includes(item.ingredientId)
                        ? waterPrice
                        : Number(item.ingredient?.calculatedPrice || 0);
                    calculatedCost += amt * price;
                }

                await prisma.semiFinished.update({
                    where: { id: semi.id },
                    data: { cost: calculatedCost },
                });
            }

            // Przeliczamy foodcost (productionCost) wszystkich wyrobów gotowych
            const allBakeryProducts = await prisma.bakeryProduct.findMany({
                include: {
                    ingredients: {
                        include: {
                            ingredient: true,
                            semiFinished: {
                                include: {
                                    ingredients: {
                                        include: { ingredient: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            for (const bp of allBakeryProducts) {
                let totalFoodCost = 0;
                for (const item of bp.ingredients) {
                    const amt = Number(item.amount || 0);
                    if (item.ingredient) {
                        const price = affectedIngredientIds.includes(item.ingredient.id)
                            ? waterPrice
                            : Number(item.ingredient.calculatedPrice || 0);
                        totalFoodCost += amt * price;
                    } else if (item.semiFinished) {
                        // Pobieramy zaktualizowany koszt półproduktu
                        let semiUnitCost = 0;
                        for (const sItem of item.semiFinished.ingredients) {
                            const sAmt = Number(sItem.amount || 0);
                            const sPrice = affectedIngredientIds.includes(sItem.ingredientId)
                                ? waterPrice
                                : Number(sItem.ingredient?.calculatedPrice || 0);
                            semiUnitCost += sAmt * sPrice;
                        }
                        totalFoodCost += amt * semiUnitCost;
                    }
                }

                // Doliczamy koszt opakowania
                totalFoodCost += Number((bp as any).packagingCost || 0);

                await prisma.bakeryProduct.update({
                    where: { id: bp.id },
                    data: { productionCost: totalFoodCost },
                });
            }

            return NextResponse.json({
                success: true,
                waterPricePerLiter: waterPrice,
                priceRounding: getSystemSettings().priceRounding,
                message: "Ustawienia zostały zaktualizowane i przeliczone we wszystkich recepturach i foodcostach.",
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Błąd zapisu konfiguracji:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

