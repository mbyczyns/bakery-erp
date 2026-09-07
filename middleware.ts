import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken, isPathAllowedForRole } from "@/lib/token";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Trasy publiczne, które nie wymagają weryfikacji sesji
    const isPublicPath =
        pathname === "/login" ||
        pathname.startsWith("/api/auth/") ||
        pathname.startsWith("/_next") ||
        pathname.includes("/favicon.ico") ||
        pathname.includes(".");

    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const user = token ? await verifySessionToken(token) : null;

    // 1. Jeśli użytkownik jest na /login i ma ważną sesję -> przekieruj do aplikacji
    if (pathname === "/login" && user) {
        if (user.role === "BAKER") {
            return NextResponse.redirect(new URL("/produkcja", request.url));
        }
        return NextResponse.redirect(new URL("/produkcja", request.url));
    }

    // Jeśli ścieżka jest publiczna, przepuść
    if (isPublicPath) {
        return NextResponse.next();
    }

    // 2. Jeśli użytkownik nie jest zalogowany -> przekieruj na stronę logowania
    if (!user) {
        // Jeśli to żądanie API (inne niż auth), zwróć 401
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
        }
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    // 3. Sprawdzenie uprawnień dla roli (RBAC)
    // BAKER ma dostęp TYLKO do: produkcja, składniki, przepisy
    if (user.role === "BAKER") {
        if (!isPathAllowedForRole(pathname, "BAKER")) {
            // Jeśli próbuje wejść na /faktury, /finanse itp. -> przekieruj na /produkcja
            if (pathname.startsWith("/api/")) {
                return NextResponse.json({ error: "Brak uprawnień do tego zasobu" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/produkcja", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Dopasuj wszystkie ścieżki z wyjątkiem statycznych zasobów (_next/static, _next/image, itp.)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
