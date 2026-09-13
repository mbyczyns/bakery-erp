import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, UserRole } from "@prisma/client";
import { getUserFromRequest, hashPassword } from "@/lib/auth";

const prisma = new PrismaClient();

// GET /api/users - Pobranie listy pracowników (z wyłączeniem administratora - admin jest ukryty w tle)
export async function GET(request: NextRequest) {
    try {
        const currentUser = await getUserFromRequest(request);
        if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER")) {
            return NextResponse.json(
                { error: "Brak uprawnień. Dostęp mają tylko Administratorzy i Managerowie." },
                { status: 403 }
            );
        }

        const users = await prisma.user.findMany({
            where: {
                role: {
                    not: "ADMIN",
                },
            },
            select: {
                id: true,
                name: true,
                login: true,
                role: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        return NextResponse.json(users);
    } catch (error: any) {
        console.error("Błąd podczas pobierania listy użytkowników:", error);
        return NextResponse.json(
            { error: "Wystąpił błąd podczas pobierania użytkowników" },
            { status: 500 }
        );
    }
}

// POST /api/users - Utworzenie nowego pracownika (tylko MANAGER i BAKER)
export async function POST(request: NextRequest) {
    try {
        const currentUser = await getUserFromRequest(request);
        if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER")) {
            return NextResponse.json(
                { error: "Brak uprawnień. Dostęp mają tylko Administratorzy i Managerowie." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { login, name, password, role } = body;

        if (!login || !password || !role) {
            return NextResponse.json(
                { error: "Wymagane pola: login, hasło oraz rola" },
                { status: 400 }
            );
        }

        const trimmedLogin = String(login).trim();
        const trimmedName = name ? String(name).trim() : null;

        if (trimmedLogin.length < 3) {
            return NextResponse.json(
                { error: "Login musi zawierać co najmniej 3 znaki" },
                { status: 400 }
            );
        }

        if (String(password).length < 4) {
            return NextResponse.json(
                { error: "Hasło musi zawierać co najmniej 4 znaki" },
                { status: 400 }
            );
        }

        // Dozwolone tylko role MANAGER oraz BAKER (Admin ukryty)
        const allowedRoles: UserRole[] = ["MANAGER", "BAKER"];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json(
                { error: "Nieprawidłowa rola. Dozwolone: MANAGER, BAKER" },
                { status: 400 }
            );
        }

        // Sprawdź czy login już istnieje
        const existing = await prisma.user.findFirst({
            where: {
                login: {
                    equals: trimmedLogin,
                    mode: "insensitive",
                },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: `Użytkownik o loginie "${trimmedLogin}" już istnieje w bazie` },
                { status: 409 }
            );
        }

        // Zahaszuj hasło w formacie Unix crypt SHA-512 ($6$)
        const hashedPassword = hashPassword(String(password));

        const newUser = await prisma.user.create({
            data: {
                login: trimmedLogin,
                name: trimmedName || trimmedLogin,
                password: hashedPassword,
                role: role,
            },
            select: {
                id: true,
                name: true,
                login: true,
                role: true,
                createdAt: true,
            },
        });

        return NextResponse.json(newUser, { status: 201 });
    } catch (error: any) {
        console.error("Błąd podczas tworzenia użytkownika:", error);
        return NextResponse.json(
            { error: "Wystąpił błąd podczas dodawania użytkownika: " + (error?.message || "") },
            { status: 500 }
        );
    }
}
