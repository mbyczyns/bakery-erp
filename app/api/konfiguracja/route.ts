import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

interface SystemSettings {
    waterPricePerLiter: number;
}

function getSettings(): SystemSettings {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            return { waterPricePerLiter: 0 };
        }
        const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            waterPricePerLiter: Number(parsed.waterPricePerLiter || 0),
        };
    } catch {
        return { waterPricePerLiter: 0 };
    }
}

function saveSettings(settings: SystemSettings) {
    try {
        const dir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    } catch (e) {
        console.error("Błąd zapisu pliku settings.json:", e);
    }
}

// GET: Pobranie ustawień konfiguracyjnych
export async function GET() {
    try {
        const settings = getSettings();

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

// POST / PATCH: Zapisanie ceny wody i automatyczna synchronizacja ze składnikami i foodcostem
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const waterPrice = parseFloat(String(body.waterPricePerLiter ?? body.waterPrice).replace(",", "."));

        if (isNaN(waterPrice) || waterPrice < 0) {
            return NextResponse.json(
                { error: "Podaj prawidłową stawkę za litr wody (liczba większa lub równa 0)" },
                { status: 400 }
            );
        }

        // 1. Zapisujemy w pliku konfiguracyjnym
        saveSettings({ waterPricePerLiter: waterPrice });

        // 2. Wyszukujemy lub tworzymy składniki "Woda" oraz "Dolewka wody"
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

        // 3. Przeliczamy koszt wszystkich półproduktów wykorzystujących wodę / dolewkę wody
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

        // 4. Przeliczamy foodcost (productionCost) wszystkich wyrobów gotowych
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

            await prisma.bakeryProduct.update({
                where: { id: bp.id },
                data: { productionCost: totalFoodCost },
            });
        }

        return NextResponse.json({
            success: true,
            waterPricePerLiter: waterPrice,
            message: "Cena wody została zaktualizowana i przeliczona we wszystkich recepturach i foodcostach.",
        });
    } catch (error: any) {
        console.error("Błąd zapisu konfiguracji wody:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
