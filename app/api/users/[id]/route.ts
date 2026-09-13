import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, UserRole } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth";

const prisma = new PrismaClient();

// PATCH /api/users/[id] - Edycja pracownika (nazwa oraz rola: MANAGER / BAKER)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = await getUserFromRequest(request);
        if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER")) {
            return NextResponse.json(
                { error: "Brak uprawnień. Dostęp mają tylko Administratorzy i Managerowie." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const { name, role } = body;

        const targetUser = await prisma.user.findUnique({
            where: { id },
        });

        if (!targetUser || targetUser.role === "ADMIN") {
            return NextResponse.json(
                { error: "Nie znaleziono użytkownika lub brak możliwości edycji tego konta" },
                { status: 404 }
            );
        }

        const updateData: {
            name?: string | null;
            role?: UserRole;
        } = {};

        if (name !== undefined) {
            updateData.name = name ? String(name).trim() : null;
        }

        if (role !== undefined) {
            const allowedRoles: UserRole[] = ["MANAGER", "BAKER"];
            if (!allowedRoles.includes(role)) {
                return NextResponse.json(
                    { error: "Nieprawidłowa rola. Dozwolone: MANAGER, BAKER" },
                    { status: 400 }
                );
            }
            updateData.role = role;
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                login: true,
                role: true,
                createdAt: true,
            },
        });

        return NextResponse.json(updatedUser);
    } catch (error: any) {
        console.error("Błąd podczas aktualizacji użytkownika:", error);
        return NextResponse.json(
            { error: "Wystąpił błąd podczas aktualizacji użytkownika: " + (error?.message || "") },
            { status: 500 }
        );
    }
}

// DELETE /api/users/[id] - Usunięcie pracownika
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = await getUserFromRequest(request);
        if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER")) {
            return NextResponse.json(
                { error: "Brak uprawnień. Dostęp mają tylko Administratorzy i Managerowie." },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Ochrona: Nie można usunąć samego siebie
        if (currentUser.id === id) {
            return NextResponse.json(
                { error: "Nie możesz usunąć swojego własnego konta" },
                { status: 400 }
            );
        }

        const targetUser = await prisma.user.findUnique({
            where: { id },
        });

        if (!targetUser || targetUser.role === "ADMIN") {
            return NextResponse.json(
                { error: "Nie znaleziono użytkownika lub brak możliwości usunięcia tego konta" },
                { status: 404 }
            );
        }

        // Przed usunięciem użytkownika, odpinamy powiązania createdById z powiązanych tabel
        await prisma.$transaction([
            prisma.contractor.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.invoice.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.product.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.productCategory.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.ingredient.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.semiFinished.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.bakeryProduct.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.dailyProduction.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.dailyIncome.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.costType.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.monthlyCost.updateMany({ where: { createdById: id }, data: { createdById: null } }),
            prisma.user.delete({ where: { id } }),
        ]);

        return NextResponse.json({ success: true, message: "Użytkownik został usunięty" });
    } catch (error: any) {
        console.error("Błąd podczas usuwania użytkownika:", error);
        return NextResponse.json(
            { error: "Wystąpił błąd podczas usuwania użytkownika: " + (error?.message || "") },
            { status: 500 }
        );
    }
}
