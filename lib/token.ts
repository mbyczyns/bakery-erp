export type UserRole = "ADMIN" | "MANAGER" | "BAKER";

export interface AuthUser {
    id: string;
    login: string;
    name: string | null;
    role: UserRole;
}

export const AUTH_COOKIE_NAME = "auth_token";
const AUTH_SECRET = process.env.AUTH_SECRET || "mws-bakery-secret-key-2026-auth-token-salt";

// Proste kodowanie i dekodowanie Base64URL bezpieczne dla Edge Runtime i Node.js
function toBase64Url(str: string): string {
    if (typeof Buffer !== "undefined") {
        return Buffer.from(str, "utf-8").toString("base64url");
    }
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string {
    if (typeof Buffer !== "undefined") {
        return Buffer.from(b64url, "base64url").toString("utf-8");
    }
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(b64)));
}

// Obliczenie podpisu HMAC-SHA256 za pomocą Web Crypto API (natywne w Edge i Node 18+)
async function getHmacSignature(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(AUTH_SECRET);
    const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : null;

    if (!cryptoObj || !cryptoObj.subtle) {
        // Fallback dla starszych środowisk z node:crypto
        const nodeCrypto = await import("crypto");
        return nodeCrypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
    }

    const cryptoKey = await cryptoObj.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signatureBuffer = await cryptoObj.subtle.sign(
        "HMAC",
        cryptoKey,
        encoder.encode(data)
    );

    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const base64 = btoa(String.fromCharCode(...signatureArray));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Generowanie tokenu sesyjnego
export async function createSessionToken(user: AuthUser): Promise<string> {
    const payload = {
        ...user,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 dni
    };

    const payloadStr = JSON.stringify(payload);
    const payloadB64 = toBase64Url(payloadStr);
    const signature = await getHmacSignature(payloadB64);

    return `${payloadB64}.${signature}`;
}

// Weryfikacja tokenu sesyjnego
export async function verifySessionToken(token: string): Promise<AuthUser | null> {
    try {
        if (!token || typeof token !== "string") return null;
        const parts = token.split(".");
        if (parts.length !== 2) return null;

        const [payloadB64, signature] = parts;
        const expectedSig = await getHmacSignature(payloadB64);

        if (signature !== expectedSig) return null;

        const payloadStr = fromBase64Url(payloadB64);
        const payload = JSON.parse(payloadStr);

        // Sprawdzenie wygaśnięcia
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return {
            id: payload.id,
            login: payload.login,
            name: payload.name || null,
            role: payload.role as UserRole,
        };
    } catch {
        return null;
    }
}

// Sprawdzenie czy użytkownik ma uprawnienia do podstrony
export function isPathAllowedForRole(path: string, role: UserRole): boolean {
    if (role === "ADMIN" || role === "MANAGER") {
        return true;
    }

    // BAKER ma dostęp TYLKO do: produkcja, składniki, przepisy
    if (role === "BAKER") {
        const allowedPrefixes = ["/produkcja", "/skladniki", "/przepisy"];
        return allowedPrefixes.some((prefix) => path.startsWith(prefix));
    }

    return false;
}
