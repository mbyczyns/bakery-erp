export type UserRole = "ADMIN" | "MANAGER" | "BAKER";

export interface AuthUser {
    id: string;
    login: string;
    name: string | null;
    role: UserRole;
}

export const AUTH_COOKIE_NAME = "auth_token";
const AUTH_SECRET = process.env.AUTH_SECRET || "mws-bakery-secret-key-2026-auth-token-salt";

// Proste kodowanie i dekodowanie Base64URL bezpieczne dla Edge Runtime, Browser i Node.js
function toBase64Url(str: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
}

// Obliczenie podpisu HMAC-SHA256 za pomocą natywnego Web Crypto API (dostępne w Edge Runtime i Node.js 18+)
async function getHmacSignature(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(AUTH_SECRET);
    const cryptoSubtle = globalThis.crypto?.subtle;

    if (!cryptoSubtle) {
        throw new Error("Web Crypto API (crypto.subtle) is not available in this environment.");
    }

    const cryptoKey = await cryptoSubtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signatureBuffer = await cryptoSubtle.sign(
        "HMAC",
        cryptoKey,
        encoder.encode(data)
    );

    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    let binary = "";
    for (let i = 0; i < signatureArray.length; i++) {
        binary += String.fromCharCode(signatureArray[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
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
