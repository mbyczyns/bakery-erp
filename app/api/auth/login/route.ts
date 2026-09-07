import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPasswordSHA512, verifyPasswordSHA512, createSessionToken, AUTH_COOKIE_NAME, AuthUser } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { login, password } = body;

        if (!login || !password) {
            return NextResponse.json(
                { error: "Login i hasło są wymagane" },
                { status: 400 }
            );
        }

        const trimmedLogin = String(login).trim();

        // Jeśli baza nie ma żadnych użytkowników, automatycznie utwórz użytkownika testowego
        const usersCount = await prisma.user.count();
        if (usersCount === 0) {
            const defaultHash = hashPasswordSHA512("admin123");
            await prisma.user.create({
                data: {
                    login: "admin",
                    name: "Administrator Testowy",
                    password: defaultHash,
                    role: "ADMIN",
                },
            });
        }

        // Znajdź użytkownika w bazie (case-insensitive login)
        const user = await prisma.user.findFirst({
            where: {
                login: {
                    equals: trimmedLogin,
                    mode: "insensitive",
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: "Nieprawidłowy login lub hasło" },
                { status: 401 }
            );
        }

        // Weryfikacja hasła SHA-512
        const isPasswordValid = verifyPasswordSHA512(password, user.password);

        if (!isPasswordValid) {
            return NextResponse.json(
                { error: "Nieprawidłowy login lub hasło" },
                { status: 401 }
            );
        }

        const authUser: AuthUser = {
            id: user.id,
            login: user.login,
            name: user.name || user.login,
            role: user.role,
        };

        const token = await createSessionToken(authUser);

        // Tworzymy odpowiedź i ustawiamy ciasteczko HTTP-Only
        const response = NextResponse.json({
            success: true,
            user: authUser,
            message: "Zalogowano pomyślnie",
        });

        response.cookies.set({
            name: AUTH_COOKIE_NAME,
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60, // 7 dni
        });

        return response;
    } catch (error: any) {
        console.error("Błąd podczas logowania:", error);
        return NextResponse.json(
            { error: "Wystąpił błąd serwera podczas logowania: " + (error?.message || "") },
            { status: 500 }
        );
    }
}
