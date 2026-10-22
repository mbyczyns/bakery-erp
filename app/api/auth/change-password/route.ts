import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest, verifyPasswordSHA512, hashPassword } from "@/lib/auth";

const prisma = new PrismaClient();

// POST /api/auth/change-password - Zmiana hasła przez aktualnie zalogowanego użytkownika
export async function POST(request: NextRequest) {
    try {
        const currentUser = await getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json(
                { error: "Musisz być zalogowany, aby zmienić hasło." },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: "Wprowadź aktualne hasło oraz nowe hasło." },
                { status: 400 }
            );
        }

        const trimmedCurrent = String(currentPassword).trim();
        const trimmedNew = String(newPassword).trim();

        if (trimmedNew.length < 4) {
            return NextResponse.json(
                { error: "Nowe hasło musi zawierać co najmniej 4 znaki." },
                { status: 400 }
            );
        }

        // Pobierz aktualne dane użytkownika z bazy, aby zweryfikować bieżące hasło
        const userInDb = await prisma.user.findUnique({
            where: { id: currentUser.id },
        });

        if (!userInDb) {
            return NextResponse.json(
                { error: "Nie znaleziono użytkownika w bazie." },
                { status: 404 }
            );
        }

        // Weryfikacja aktualnego hasła
        const isCurrentValid = verifyPasswordSHA512(trimmedCurrent, userInDb.password);
        if (!isCurrentValid) {
            return NextResponse.json(
                { error: "Podane aktualne hasło jest nieprawidłowe." },
                { status: 400 }
            );
        }

        if (trimmedCurrent === trimmedNew) {
            return NextResponse.json(
                { error: "Nowe hasło musi różnić się od aktualnego hasła." },
                { status: 400 }
            );
        }

        // Zahaszuj nowe hasło z solą w formacie Unix crypt SHA-512 ($6$)
        const newHashedPassword = hashPassword(trimmedNew);

        await prisma.user.update({
            where: { id: currentUser.id },
            data: { password: newHashedPassword },
        });

        return NextResponse.json({
            success: true,
            message: "Hasło zostało pomyślnie zmienione.",
        });
    } catch (error: any) {
        console.error("Błąd podczas zmiany hasła:", error);
        return NextResponse.json(
            { error: "Wystąpił błąd podczas zmiany hasła: " + (error?.message || "") },
            { status: 500 }
        );
    }
}
