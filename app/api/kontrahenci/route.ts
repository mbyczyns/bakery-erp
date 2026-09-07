import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { getCustomNamesMap } from "@/lib/contractor-names";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const customNamesMap = getCustomNamesMap();
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
            const { invoices, ...rest } = c as any;
            const customName = rest.customName || customNamesMap[c.id] || null;
            const cleanAddress = rest.address === 'Pobrano z KSeF' ? '' : (rest.address || '');
            return {
                ...rest,
                address: cleanAddress,
                customName,
                displayName: customName || rest.name,
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

        // Sprawdzenie czy kontrahent o takim NIP już istnieje (zapobieganie duplikatom)
        if (body.nip) {
            const cleanNip = String(body.nip).trim().toUpperCase().replace(/^PL/, '').replace(/[\s-]/g, '');
            if (cleanNip.length >= 6) {
                const existing = await prisma.contractor.findFirst({
                    where: {
                        OR: [
                            { nip: cleanNip },
                            { nip: `PL${cleanNip}` },
                            { nip: body.nip.trim() },
                        ]
                    }
                });

                if (existing) {
                    return NextResponse.json(existing);
                }
            }
        }

        const user = await getUserFromRequest(request);

        const newContractor = await prisma.contractor.create({
            data: {
                type: body.type,
                name: body.name,
                nip: body.nip,
                address: body.address && body.address !== 'Pobrano z KSeF' ? body.address : '',
                email: body.email || '',
                phone: body.phone || '',
                contactPerson: body.contactPerson || null,
                notes: body.notes || null,
                ...(user?.id ? { createdById: user.id } : {}),
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