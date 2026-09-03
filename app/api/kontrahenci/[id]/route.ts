import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCustomNamesMap, saveCustomName } from "@/lib/contractor-names";

const prisma = new PrismaClient();

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: "Brak identyfikatora kontrahenta" }, { status: 400 });
        }

        const contractor = await prisma.contractor.findUnique({
            where: { id },
            include: {
                invoices: {
                    orderBy: { issuedDate: "desc" },
                    include: {
                        positions: {
                            include: {
                                product: true,
                            },
                        },
                    },
                },
                products: true,
            },
        });

        if (!contractor) {
            return NextResponse.json({ error: "Nie znaleziono kontrahenta" }, { status: 404 });
        }

        const customNamesMap = getCustomNamesMap();
        const customName = (contractor as any).customName || customNamesMap[contractor.id] || null;

        // 1. Podsumowanie wydatków (stats)
        let totalGross = 0;
        let totalNet = 0;
        let totalVat = 0;

        contractor.invoices.forEach((inv) => {
            totalGross += Number(inv.grossAmount || 0);
            totalNet += Number(inv.netAmount || 0);
            totalVat += Number(inv.vatAmount || 0);
        });

        const invoicesCount = contractor.invoices.length;
        const averageInvoiceGross = invoicesCount > 0 ? totalGross / invoicesCount : 0;
        const lastPurchaseDate = invoicesCount > 0 ? contractor.invoices[0].issuedDate : null;

        // 2. Agregacja produktów kupowanych u tego dostawcy (z faktur oraz z katalogu produktów)
        const productsMap = new Map<string, {
            id: string;
            name: string;
            unit: string;
            lastPrice: number;
            totalQuantity: number;
            totalSpent: number;
            purchaseCount: number;
            lastPurchasedDate: string;
        }>();

        // Przetwarzanie pozycji faktur od najnowszej do najstarszej
        contractor.invoices.forEach((inv) => {
            const invDateStr = inv.issuedDate.toISOString().split("T")[0];
            inv.positions.forEach((pos) => {
                const key = (pos.name || pos.product?.name || "Nieznany produkt").trim().toLowerCase();
                const displayName = (pos.product?.name || pos.name || "Nieznany produkt").trim();
                const qty = Number(pos.quantity || 0);
                const gross = Number(pos.grossAmount || 0);
                const price = Number(pos.netPrice || 0);

                if (!productsMap.has(key)) {
                    productsMap.set(key, {
                        id: pos.productId || pos.id,
                        name: displayName,
                        unit: pos.unit || "szt",
                        lastPrice: price,
                        totalQuantity: qty,
                        totalSpent: gross,
                        purchaseCount: 1,
                        lastPurchasedDate: invDateStr,
                    });
                } else {
                    const existing = productsMap.get(key)!;
                    existing.totalQuantity += qty;
                    existing.totalSpent += gross;
                    existing.purchaseCount += 1;
                }
            });
        });

        // Dodanie również produktów przypisanych w katalogu dostawcy
        contractor.products.forEach((prod) => {
            const key = prod.name.trim().toLowerCase();
            if (!productsMap.has(key)) {
                productsMap.set(key, {
                    id: prod.id,
                    name: prod.name,
                    unit: prod.unit || "szt",
                    lastPrice: Number(prod.price || 0),
                    totalQuantity: 0,
                    totalSpent: 0,
                    purchaseCount: 0,
                    lastPurchasedDate: "-",
                });
            }
        });

        const purchasedProducts = Array.from(productsMap.values()).sort(
            (a, b) => b.totalSpent - a.totalSpent || a.name.localeCompare(b.name)
        );

        const cleanAddress = contractor.address === 'Pobrano z KSeF' ? null : (contractor.address || null);

        return NextResponse.json({
            contractor: {
                id: contractor.id,
                type: contractor.type,
                name: contractor.name,
                customName,
                displayName: customName || contractor.name,
                nip: contractor.nip,
                address: cleanAddress,
                email: contractor.email,
                phone: contractor.phone,
                contactPerson: contractor.contactPerson,
                notes: contractor.notes,
                createdAt: contractor.createdAt,
            },
            stats: {
                totalGross,
                totalNet,
                totalVat,
                invoicesCount,
                averageInvoiceGross,
                lastPurchaseDate,
            },
            invoices: contractor.invoices.map((inv) => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                ksefNumber: inv.ksefNumber,
                isSales: (inv as any).isSales || false,
                issuedDate: inv.issuedDate.toISOString().split("T")[0],
                dueDate: inv.dueDate.toISOString().split("T")[0],
                grossAmount: Number(inv.grossAmount),
                netAmount: Number(inv.netAmount),
                vatAmount: Number(inv.vatAmount),
                status: inv.status,
                positionsCount: inv.positions.length,
                positions: inv.positions.map((p) => ({
                    id: p.id,
                    name: p.name,
                    quantity: Number(p.quantity),
                    unit: p.unit,
                    netPrice: Number(p.netPrice),
                    grossAmount: Number(p.grossAmount),
                })),
            })),
            purchasedProducts,
        });
    } catch (error: any) {
        console.error("Błąd pobierania szczegółów kontrahenta:", error);
        return NextResponse.json(
            { error: "Błąd serwera", details: error.message },
            { status: 500 }
        );
    }
}

// PATCH: Aktualizacja własnej nazwy kontrahenta
export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Brak identyfikatora kontrahenta" }, { status: 400 });
        }

        const body = await request.json();
        const { customName } = body;

        const trimmed = customName !== undefined && customName !== null ? String(customName).trim() : null;
        saveCustomName(id, trimmed);

        // Próba zapisu do bazy danych PostgreSQL jeśli kolumna customName już istnieje
        try {
            await (prisma.contractor as any).update({
                where: { id },
                data: { customName: trimmed },
            });
        } catch {
            // Kolumna może czekać na restart kontenera / push
        }

        return NextResponse.json({
            success: true,
            customName: trimmed,
            message: "Własna nazwa kontrahenta została zaktualizowana",
        });
    } catch (error: any) {
        console.error("Błąd aktualizacji własnej nazwy kontrahenta:", error);
        return NextResponse.json(
            { error: "Błąd serwera", details: error.message },
            { status: 500 }
        );
    }
}
