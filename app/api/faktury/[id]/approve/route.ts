import { NextResponse } from 'next/server';
import { PrismaClient, InvoiceStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: invoiceId } = await params;
        const { itemsMapping } = await req.json();

        if (itemsMapping && Array.isArray(itemsMapping)) {
            for (const item of itemsMapping) {
                // A. Aktualizacja Karty Artykułu (Kategoria + Surowiec)
                await prisma.product.update({
                    where: { id: item.productId },
                    data: {
                        categoryId: item.categoryId,
                        ingredientId: item.ingredientId || null,
                    },
                });

                // B. Jeśli przypisano do Surowca Bazowego -> Aktualizujemy jego cenę dla receptur
                if (item.ingredientId) {
                    const latestPosition = await prisma.invoicePosition.findFirst({
                        where: { invoiceId, productId: item.productId },
                        orderBy: { createdAt: 'desc' },
                    });

                    if (latestPosition) {
                        await prisma.ingredient.update({
                            where: { id: item.ingredientId },
                            data: {
                                calculatedPrice: latestPosition.netPrice,
                            },
                        });
                    }
                }
            }
        }

        // C. Oznaczenie faktury jako Zaakceptowana
        const approvedInvoice = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoiceStatus.IMPORTED },
        });

        return NextResponse.json({
            success: true,
            message: 'Faktura została pomyślnie zweryfikowana i aktywowana.',
            invoice: approvedInvoice,
        });
    } catch (error: any) {
        console.error('Błąd akceptacji faktury:', error);
        return NextResponse.json(
            { error: 'Błąd podczas akceptacji faktury', details: error.message },
            { status: 500 }
        );
    }
}