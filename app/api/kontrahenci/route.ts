import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const contractors = await prisma.contractor.findMany({
            orderBy: { createdAt: "desc" },
            // ZMIANA: Pobieramy powiązane faktury, sortujemy od najnowszej i bierzemy tylko pierwszą
            include: {
                invoices: {
                    orderBy: { issuedDate: 'desc' },
                    take: 1,
                    select: { issuedDate: true }
                }
            }
        });

        // Formatujemy wynik, spłaszczając strukturę dla frontendu
        const formattedContractors = contractors.map(c => {
            const { invoices, ...rest } = c;
            return {
                ...rest,
                lastPurchaseDate: invoices.length > 0 ? invoices[0].issuedDate : null
            };
        });

        return NextResponse.json(formattedContractors);
    } catch (error: any) {
        console.error("Błąd pobierania kontrahentów:", error);
        return NextResponse.json(
            { error: "Wystąpił błąd podczas pobierania danych z bazy" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const newContractor = await prisma.contractor.create({
            data: {
                type: body.type,
                name: body.name,
                nip: body.nip,
                address: body.address || null,
                email: body.email || null,
                phone: body.phone || null,
                contactPerson: body.contactPerson || null,
                notes: body.notes || null,
            },
        });

        // Dla nowo utworzonego dostawcy zwracamy pustą datę zakupów
        return NextResponse.json({ ...newContractor, lastPurchaseDate: null });
    } catch (error: any) {
        console.error("Błąd tworzenia kontrahenta:", error);
        return NextResponse.json(
            { error: "Nie udało się zapisać kontrahenta w bazie" },
            { status: 500 }
        );
    }
}