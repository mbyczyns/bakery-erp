import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CANONICAL_DEFAULTS = [
    "Wypłaty pracowników",
    "Składki ZUS",
    "Podatek PIT",
];

const OLD_REDUNDANT_NAMES = [
    "Czynsz i wynajem lokalu",
    "Raty leasingowe / Kredyty sprzętowe",
    "Księgowość i doradztwo podatkowe",
    "Paliwo i eksploatacja pojazdów",
    "Inne koszty operacyjne",
    "Wypłaty pracowników (Wynagrodzenia)",
    "Składki ZUS (Społeczne, Zdrowotne, FP/FGŚP)",
    "Podatek dochodowy (Zaliczka PIT / CIT)",
];

// Helper: Dokładne czyszczenie i deduplikacja kategorii kosztów
export async function ensureCleanCostTypes() {
    const all = await prisma.costType.findMany({
        include: { monthlyCosts: true },
    });

    // 1. Usunięcie starych nadmiarowych kategorii
    for (const item of all) {
        if (OLD_REDUNDANT_NAMES.includes(item.name)) {
            let targetCanonicalName: string | null = null;
            if (item.name.toLowerCase().includes("wypłat")) targetCanonicalName = "Wypłaty pracowników";
            else if (item.name.toLowerCase().includes("zus")) targetCanonicalName = "Składki ZUS";
            else if (item.name.toLowerCase().includes("podatek") || item.name.toLowerCase().includes("pit")) targetCanonicalName = "Podatek PIT";

            if (targetCanonicalName) {
                let canonical = all.find((c) => c.name.trim().toLowerCase() === targetCanonicalName!.toLowerCase() && c.id !== item.id);
                if (!canonical) {
                    canonical = await prisma.costType.create({ data: { name: targetCanonicalName } });
                }
                for (const mc of item.monthlyCosts) {
                    const existingInCanonical = await prisma.monthlyCost.findUnique({
                        where: { monthDate_costTypeId: { monthDate: mc.monthDate, costTypeId: canonical.id } },
                    });
                    if (!existingInCanonical && Number(mc.value) > 0) {
                        await prisma.monthlyCost.create({
                            data: {
                                monthDate: mc.monthDate,
                                costTypeId: canonical.id,
                                value: mc.value,
                            },
                        });
                    }
                }
            }

            await prisma.monthlyCost.deleteMany({ where: { costTypeId: item.id } });
            await prisma.costType.delete({ where: { id: item.id } }).catch(() => {});
        }
    }

    // 2. Deduplikacja kategorii o identycznej nazwie
    const current = await prisma.costType.findMany({
        include: { monthlyCosts: true },
    });

    const seenNames = new Map<string, typeof current[0]>();
    for (const item of current) {
        const norm = item.name.trim().toLowerCase();
        if (seenNames.has(norm)) {
            const primary = seenNames.get(norm)!;
            for (const mc of item.monthlyCosts) {
                const existingInPrimary = await prisma.monthlyCost.findUnique({
                    where: { monthDate_costTypeId: { monthDate: mc.monthDate, costTypeId: primary.id } },
                });
                if (!existingInPrimary && Number(mc.value) > 0) {
                    await prisma.monthlyCost.create({
                        data: {
                            monthDate: mc.monthDate,
                            costTypeId: primary.id,
                            value: mc.value,
                        },
                    });
                }
            }
            await prisma.monthlyCost.deleteMany({ where: { costTypeId: item.id } });
            await prisma.costType.delete({ where: { id: item.id } }).catch(() => {});
        } else {
            seenNames.set(norm, item);
        }
    }

    // 3. Upewnienie się, że 3 bazowe kategorie istnieją
    for (const name of CANONICAL_DEFAULTS) {
        const norm = name.trim().toLowerCase();
        if (!seenNames.has(norm)) {
            const created = await prisma.costType.create({ data: { name } });
            seenNames.set(norm, { ...created, monthlyCosts: [] });
        }
    }
}

// GET: Pobieranie listy kategorii kosztów
export async function GET() {
    try {
        await ensureCleanCostTypes();
        const types = await prisma.costType.findMany({
            orderBy: { name: "asc" },
            include: {
                _count: {
                    select: { monthlyCosts: true },
                },
            },
        });
        return NextResponse.json({ costTypes: types });
    } catch (error: any) {
        console.error("Błąd pobierania kategorii kosztów:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}

// POST: Dodawanie nowej kategorii kosztów
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Nazwa kategorii jest wymagana" }, { status: 400 });
        }

        const trimmed = name.trim();
        const existing = await prisma.costType.findFirst({
            where: {
                name: {
                    equals: trimmed,
                    mode: "insensitive",
                },
            },
        });

        if (existing) {
            return NextResponse.json({ error: "Kategoria o takiej nazwie już istnieje" }, { status: 409 });
        }

        const newType = await prisma.costType.create({
            data: { name: trimmed },
        });

        return NextResponse.json({ costType: newType }, { status: 201 });
    } catch (error: any) {
        console.error("Błąd tworzenia kategorii kosztów:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}

// PUT / PATCH: Edycja nazwy kategorii
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, name } = body;

        if (!id || !name || !name.trim()) {
            return NextResponse.json({ error: "ID oraz nowa nazwa są wymagane" }, { status: 400 });
        }

        const trimmed = name.trim();
        const existing = await prisma.costType.findFirst({
            where: {
                name: {
                    equals: trimmed,
                    mode: "insensitive",
                },
                id: { not: id },
            },
        });

        if (existing) {
            return NextResponse.json({ error: "Inna kategoria ma już taką nazwę" }, { status: 409 });
        }

        const updated = await prisma.costType.update({
            where: { id },
            data: { name: trimmed },
        });

        return NextResponse.json({ costType: updated });
    } catch (error: any) {
        console.error("Błąd aktualizacji kategorii kosztów:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}

// DELETE: Usuwanie kategorii
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Brak parametru ID" }, { status: 400 });
        }

        await prisma.monthlyCost.deleteMany({
            where: { costTypeId: id },
        });

        await prisma.costType.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Błąd usuwania kategorii kosztów:", error);
        return NextResponse.json({ error: "Błąd serwera", details: error.message }, { status: 500 });
    }
}
