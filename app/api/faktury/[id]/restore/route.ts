import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, InvoiceStatus } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: invoiceId } = await params;

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice) {
            return NextResponse.json({ error: "Nie znaleziono faktury" }, { status: 404 });
        }

        // Przywracamy status do weryfikacji (WAITING)
        const restoredInvoice = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoiceStatus.WAITING },
        });

        return NextResponse.json({
            success: true,
            message: "Faktura została przywrócona do weryfikacji.",
            invoice: restoredInvoice,
        });
    } catch (error: any) {
        console.error("Błąd podczas przywracania faktury:", error);
        return NextResponse.json(
            { error: "Błąd podczas przywracania faktury", details: error.message },
            { status: 500 }
        );
    }
}
