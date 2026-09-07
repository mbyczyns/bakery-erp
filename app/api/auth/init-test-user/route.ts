import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPasswordSHA512 } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const testLogin = "admin";
        const testPasswordRaw = "admin123";
        const testPasswordHash = hashPasswordSHA512(testPasswordRaw);

        const existing = await prisma.user.findFirst({
            where: {
                login: {
                    equals: testLogin,
                    mode: "insensitive",
                },
            },
        });

        if (existing) {
            return NextResponse.json({
                message: "Użytkownik testowy już istnieje w bazie danych",
                credentials: {
                    login: existing.login,
                    password: testPasswordRaw,
                    role: existing.role,
                    name: existing.name,
                },
            });
        }

        const newUser = await prisma.user.create({
            data: {
                login: testLogin,
                name: "Administrator Testowy",
                password: testPasswordHash,
                role: "ADMIN",
            },
        });

        return NextResponse.json({
            message: "Użytkownik testowy został pomyślnie utworzony!",
            credentials: {
                login: newUser.login,
                password: testPasswordRaw,
                role: newUser.role,
                name: newUser.name,
            },
        });
    } catch (error: any) {
        console.error("Błąd tworzenia użytkownika testowego:", error);
        return NextResponse.json(
            { error: "Błąd bazy danych", details: error.message },
            { status: 500 }
        );
    }
}
