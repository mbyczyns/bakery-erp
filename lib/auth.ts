import crypto from "crypto";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
    AuthUser,
    UserRole,
    AUTH_COOKIE_NAME,
    createSessionToken,
    verifySessionToken,
    isPathAllowedForRole
} from "./token";

export type { AuthUser, UserRole };
export { AUTH_COOKIE_NAME, createSessionToken, verifySessionToken, isPathAllowedForRole };

// -------------------------------------------------------------
// 1. STANDARDOWY HASH SHA-512 (128 ZNAKÓW HEX)
// np. printf "%s" "haslo" | openssl dgst -sha512
// -------------------------------------------------------------
export function hashPasswordSHA512(password: string): string {
    return crypto.createHash("sha512").update(password).digest("hex");
}

// -------------------------------------------------------------
// 2. OBSŁUGA FORMATU UNIX CRYPT SHA-512 ($6$salt$hash)
// generowanego przez polecenie: openssl passwd -6 <haslo>
// -------------------------------------------------------------
const B64_CRYPT_CHARS = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function b64From24Bit(b0: number, b1: number, b2: number, len: number): string {
    let w = ((b0 << 16) | (b1 << 8) | b2) >>> 0;
    let res = "";
    while (len-- > 0) {
        res += B64_CRYPT_CHARS[w & 0x3f];
        w >>>= 6;
    }
    return res;
}

export function sha512Crypt(key: string, saltString: string): string {
    let rounds = 5000;
    let salt = saltString;

    if (salt.startsWith("$6$")) {
        salt = salt.slice(3);
    }
    if (salt.startsWith("rounds=")) {
        const match = salt.match(/^rounds=(\d+)\$(.*)/);
        if (match) {
            rounds = Math.max(1000, Math.min(999999999, parseInt(match[1], 10)));
            salt = match[2];
        }
    }
    const dollarIdx = salt.indexOf("$");
    if (dollarIdx !== -1) {
        salt = salt.slice(0, dollarIdx);
    }
    salt = salt.slice(0, 16);

    const keyBuf = Buffer.from(key, "utf-8");
    const saltBuf = Buffer.from(salt, "utf-8");
    const keyLen = keyBuf.length;

    // Digest B = SHA512(key + salt + key)
    let altCtx = crypto.createHash("sha512");
    altCtx.update(keyBuf);
    altCtx.update(saltBuf);
    altCtx.update(keyBuf);
    const altResult = altCtx.digest();

    // Digest A
    let ctx = crypto.createHash("sha512");
    ctx.update(keyBuf);
    ctx.update(saltBuf);

    let cnt = keyLen;
    while (cnt > 64) {
        ctx.update(altResult);
        cnt -= 64;
    }
    ctx.update(altResult.subarray(0, cnt));

    for (let i = keyLen; i > 0; i >>= 1) {
        if ((i & 1) !== 0) {
            ctx.update(altResult);
        } else {
            ctx.update(keyBuf);
        }
    }
    let intermediate = ctx.digest();

    // P-sequence (key repeated)
    let pCtx = crypto.createHash("sha512");
    for (let i = 0; i < keyLen; i++) {
        pCtx.update(keyBuf);
    }
    const pDigest = pCtx.digest();
    const pBytes = Buffer.alloc(keyLen);
    for (let i = 0; i < keyLen; i++) {
        pBytes[i] = pDigest[i % 64];
    }

    // S-sequence (salt repeated)
    let sCtx = crypto.createHash("sha512");
    for (let i = 0; i < 16 + intermediate[0]; i++) {
        sCtx.update(saltBuf);
    }
    const sDigest = sCtx.digest();
    const sBytes = Buffer.alloc(saltBuf.length);
    for (let i = 0; i < saltBuf.length; i++) {
        sBytes[i] = sDigest[i % 64];
    }

    // 5000 rounds loop
    for (let r = 0; r < rounds; r++) {
        let rCtx = crypto.createHash("sha512");
        if ((r & 1) !== 0) {
            rCtx.update(pBytes);
        } else {
            rCtx.update(intermediate);
        }

        if (r % 3 !== 0) {
            rCtx.update(sBytes);
        }

        if (r % 7 !== 0) {
            rCtx.update(pBytes);
        }

        if ((r & 1) !== 0) {
            rCtx.update(intermediate);
        } else {
            rCtx.update(pBytes);
        }
        intermediate = rCtx.digest();
    }

    // Base64 crypt-style encoding
    let encoded = "";
    const idxPairs: [number, number, number][] = [
        [0, 21, 42],
        [22, 43, 1],
        [44, 2, 23],
        [3, 24, 45],
        [25, 46, 4],
        [47, 5, 26],
        [6, 27, 48],
        [28, 49, 7],
        [50, 8, 29],
        [9, 30, 51],
        [31, 52, 10],
        [53, 11, 32],
        [12, 33, 54],
        [34, 55, 13],
        [56, 14, 35],
        [15, 36, 57],
        [37, 58, 16],
        [59, 17, 38],
        [18, 39, 60],
        [40, 61, 19],
        [62, 20, 41],
    ];

    for (const [b0, b1, b2] of idxPairs) {
        encoded += b64From24Bit(intermediate[b0], intermediate[b1], intermediate[b2], 4);
    }
    encoded += b64From24Bit(0, 0, intermediate[63], 2);

    return `$6$${salt}$${encoded}`;
}

// -------------------------------------------------------------
// UNIWERSALNA WERYFIKACJA HASŁA
// Obsługuje zarówno Unix crypt ($6$), czysty SHA-512 hex, jak i plain text
// -------------------------------------------------------------
export function verifyPasswordSHA512(inputPassword: string, storedHash: string): boolean {
    if (!inputPassword || !storedHash) return false;

    const trimmedStored = storedHash.trim();

    // 1. Format openssl passwd -6 ($6$salt$hash)
    if (trimmedStored.startsWith("$6$")) {
        try {
            const computedCrypt = sha512Crypt(inputPassword, trimmedStored);
            if (computedCrypt === trimmedStored) {
                return true;
            }
        } catch (e) {
            console.error("Błąd weryfikacji formatu openssl passwd -6:", e);
        }
    }

    // 2. Standardowy skrót SHA-512 (128 znaków hex)
    const hashedInput = hashPasswordSHA512(inputPassword);
    if (hashedInput.toLowerCase() === trimmedStored.toLowerCase()) {
        return true;
    }

    // 3. Bezpośrednie porównanie (tekst jawny)
    if (inputPassword === trimmedStored) {
        return true;
    }

    return false;
}

// Pobranie zalogowanego użytkownika z NextRequest w Route Handlerach
export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
}

// Pobranie zalogowanego użytkownika w Server Components
export async function getCurrentUser(): Promise<AuthUser | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
        if (!token) return null;
        return await verifySessionToken(token);
    } catch {
        return null;
    }
}
