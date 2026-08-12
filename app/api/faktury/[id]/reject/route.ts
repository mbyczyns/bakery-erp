import { NextResponse } from 'next/server';
import { PrismaClient, InvoiceStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: invoiceId } = await params;

        const rejectedInvoice = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoiceStatus.REJECTED },
        });

        return NextResponse.json({
            success: true,
            message: 'Faktura została odrzucona i wykluczona ze statystyk.',
            invoice: rejectedInvoice,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Błąd podczas odrzucania faktury', details: error.message },
            { status: 500 }
        );
    }
}