import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, DocumentStatus } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Pobieramy dokument
        const document = await prisma.document.findUnique({
            where: { id },
            include: { positions: true },
        });

        if (!document) {
            return NextResponse.json({ error: "Nie znaleziono faktury" }, { status: 404 });
        }

        // Przywracamy status do weryfikacji (PENDING lub VERIFIED)
        const updatedDocument = await prisma.document.update({
            where: { id },
            data: {
                status: DocumentStatus.PENDING,
            },
            include: {
                positions: {
                    include: {
                        product: true,
                        ingredient: true,
                        category: true,
                    },
                },
            },
        });

        return NextResponse.json({ success: true, document: updatedDocument });
    } catch (error: any) {
        console.error("Błąd podczas ponownego otwierania faktury:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}