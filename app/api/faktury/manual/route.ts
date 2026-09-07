import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { header, positions } = body;

        if (!header || !positions || positions.length === 0) {
            return NextResponse.json({ error: "Brak wymaganych danych dokumentu" }, { status: 400 });
        }

        const issueDate = new Date(header.issueDate);

        let totalNet = 0;
        let totalGross = 0;

        const enrichedPositions = positions.map((pos: any) => {
            const quantity = Number(pos.quantity) || 0;
            const netPrice = Number(pos.netPrice) || 0;
            const vatRate = Number(pos.vatRate) || 23; // Pobieramy indywidualny VAT z frontu

            const netAmount = quantity * netPrice;
            const grossAmount = netAmount * (1 + (vatRate / 100)); // Liczymy brutto wg stawki

            totalNet += netAmount;
            totalGross += grossAmount;

            return { ...pos, netAmount, grossAmount, vatRate };
        });

        const user = await getUserFromRequest(request);

        const result = await prisma.$transaction(async (tx) => {

            const invoice = await tx.invoice.create({
                data: {
                    contractorId: header.contractorId,
                    type: "MANUAL",
                    ksefNumber: `MAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    invoiceNumber: header.docNumber,
                    issuedDate: issueDate,
                    dueDate: issueDate,
                    status: "IMPORTED",
                    grossAmount: totalGross,
                    netAmount: totalNet,
                    vatAmount: totalGross - totalNet,
                    currency: "PLN",
                    ...(user?.id ? { createdById: user.id } : {}),
                },
            });

            for (const pos of enrichedPositions) {
                const safeMultiplier = Math.max(0.001, Number(pos.multiplier) || 1);

                let product = await tx.product.findFirst({
                    where: {
                        name: pos.name,
                        supplierId: header.contractorId
                    }
                });

                if (!product) {
                    product = await tx.product.create({
                        data: {
                            name: pos.name,
                            price: pos.netPrice,
                            unit: pos.unit,
                            supplierId: header.contractorId,
                            categoryId: pos.categoryId,
                            ingredientId: pos.ingredientId || null,
                            multiplier: safeMultiplier,
                        }
                    });
                } else {
                    product = await tx.product.update({
                        where: { id: product.id },
                        data: {
                            categoryId: pos.categoryId,
                            ingredientId: pos.ingredientId || null,
                            multiplier: safeMultiplier,
                        }
                    });
                }

                await tx.invoicePosition.create({
                    data: {
                        invoiceId: invoice.id,
                        productId: product.id,
                        name: pos.name,
                        quantity: pos.quantity,
                        unit: pos.unit,
                        netPrice: pos.netPrice,
                        netAmount: pos.netAmount,
                        vatRate: pos.vatRate, // Zapisujemy rzeczywisty VAT w pozycji
                        grossAmount: pos.grossAmount,
                    }
                });

                if (pos.ingredientId) {
                    const baseUnitPrice = pos.netPrice / safeMultiplier;

                    await tx.ingredient.update({
                        where: { id: pos.ingredientId },
                        data: {
                            calculatedPrice: baseUnitPrice,
                        },
                    });
                }
            }

            return invoice;
        });

        return NextResponse.json({ success: true, message: "Faktura ręczna została utworzona pomyślnie", invoice: result });

    } catch (error: any) {
        console.error("Błąd zapisu manualnej faktury:", error);
        return NextResponse.json(
            { error: "Błąd serwera podczas zapisywania ręcznego dokumentu", details: error.message },
            { status: 500 }
        );
    }
}