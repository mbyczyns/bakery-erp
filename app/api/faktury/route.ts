import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function GET() {
    try {
        console.log('=== [DEBUG API FAKTURY START] ===');

        // 1. Liczymy rekordy bezpośrednio w tabelach
        const invoiceCount = await prisma.invoice.count();
        const positionCount = await prisma.invoicePosition.count();
        console.log(`[DEBUG DB] Łącznie faktur w bazie: ${invoiceCount}, łącznie pozycji: ${positionCount}`);

        // 2. Pobieramy faktury z relacją positions
        const invoices = await prisma.invoice.findMany({
            include: {
                contractor: true,
                positions: true,
            },
            orderBy: {
                issuedDate: 'desc',
            },
        });

        console.log(`[DEBUG FINDMANY] Pobrano faktur: ${invoices.length}`);

        // LOGUJEMY KAŻDĄ FAKTURĘ I JEJ POZYCJE
        invoices.forEach((inv, index) => {
            const posArray = inv.positions || [];
            console.log(` -> Faktura #${index + 1} [ID: ${inv.id}] [Nr: ${inv.invoiceNumber}]: wykryto ${posArray.length} pozycji.`);
            if (posArray.length > 0) {
                console.log(`    Pierwsza pozycja:`, posArray[0].name);
            }
        });

        const products = await prisma.product.findMany();
        const productMap = new Map(products.map((p) => [p.id, p]));

        const formattedDocs = invoices.map((inv) => {
            const positions = Array.isArray(inv.positions) ? inv.positions : [];

            return {
                id: inv.id,
                type: inv.type,
                docNumber: inv.invoiceNumber,
                issueDate: inv.issuedDate ? new Date(inv.issuedDate).toISOString().split('T')[0] : '',
                netAmount: Number(inv.netAmount || 0),
                grossAmount: Number(inv.grossAmount || 0),
                contractorId: inv.contractorId,
                contractorName: inv.contractor?.name || 'Nieznany kontrahent',
                status: inv.status,
                notes: inv.ksefNumber ? `KSeF: ${inv.ksefNumber}` : undefined,
                positions: positions.map((pos) => {
                    const prod = productMap.get(pos.productId);
                    return {
                        id: pos.id,
                        productId: pos.productId,
                        name: pos.name,
                        quantity: Number(pos.quantity || 0),
                        unit: pos.unit || 'szt',
                        netPrice: Number(pos.netPrice || 0),
                        netAmount: Number(pos.netAmount || 0),
                        vatRate: String(pos.vatRate || '23'),
                        grossAmount: Number(pos.grossAmount || 0),
                        categoryId: prod?.categoryId || undefined,
                        ingredientId: prod?.ingredientId || undefined,
                    };
                }),
            };
        });

        console.log('=== [DEBUG API FAKTURY END] ===');

        return NextResponse.json(formattedDocs, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (error: any) {
        console.error('Błąd pobierania faktur z bazy:', error);
        return NextResponse.json(
            { error: 'Błąd serwera podczas pobierania faktur', details: error.message },
            { status: 500 }
        );
    }
}