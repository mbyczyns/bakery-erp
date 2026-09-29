import fs from "fs";
import path from "path";

const NOTES_FILE = path.join(process.cwd(), "data", "contractor-notes.json");

export function getContractorNotesMap(): Record<string, string> {
    try {
        if (!fs.existsSync(NOTES_FILE)) return {};
        const raw = fs.readFileSync(NOTES_FILE, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

export function saveContractorNote(contractorId: string, notes: string | null) {
    try {
        const dir = path.dirname(NOTES_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const map = getContractorNotesMap();
        if (notes !== undefined && notes !== null && notes.trim().length > 0) {
            map[contractorId] = notes.trim();
        } else {
            delete map[contractorId];
        }

        fs.writeFileSync(NOTES_FILE, JSON.stringify(map, null, 2), "utf-8");
    } catch (e) {
        console.error("Błąd zapisu notatki kontrahenta:", e);
    }
}
