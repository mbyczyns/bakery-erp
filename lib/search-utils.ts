/**
 * Pomocnicze funkcje do elastycznego wyszukiwania (relaxed / multi-word search).
 * Pozwala na wyszukiwanie po fragmentach słów w dowolnej kolejności
 * oraz ignoruje polskie znaki diakrytyczne (np. "maka 500" znajdzie "Mąka pszenna typ 500").
 */

export function normalizeSearchString(str: string): string {
    if (!str) return "";
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ł/g, "l")
        .replace(/Ł/g, "l")
        .trim();
}

/**
 * Sprawdza, czy wszystkie słowa z zapytania (query) występują w docelowym tekście (lub liście tekstów).
 *
 * @param target Pojedynczy tekst lub tablica tekstów do przeszukania
 * @param query Wpisana fraza wyszukiwania
 */
export function matchesSearch(
    target: string | (string | null | undefined)[] | null | undefined,
    query: string | null | undefined
): boolean {
    if (!query || !query.trim()) return true;
    if (!target) return false;

    const normalizedQuery = normalizeSearchString(query);
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    if (queryTokens.length === 0) return true;

    const targetString = Array.isArray(target)
        ? target.filter(Boolean).join(" ")
        : target;

    const normalizedTarget = normalizeSearchString(targetString);

    return queryTokens.every((token) => normalizedTarget.includes(token));
}
