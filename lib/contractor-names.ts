import fs from "fs";
import path from "path";

const CUSTOM_NAMES_FILE = path.join(process.cwd(), "data", "contractor-custom-names.json");

export function getCustomNamesMap(): Record<string, string> {
    try {
        if (!fs.existsSync(CUSTOM_NAMES_FILE)) return {};
        const raw = fs.readFileSync(CUSTOM_NAMES_FILE, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

export function saveCustomName(contractorId: string, customName: string | null) {
    try {
        const dir = path.dirname(CUSTOM_NAMES_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const map = getCustomNamesMap();
        if (customName && customName.trim()) {
            map[contractorId] = customName.trim();
        } else {
            delete map[contractorId];
        }

        fs.writeFileSync(CUSTOM_NAMES_FILE, JSON.stringify(map, null, 2), "utf-8");
    } catch (e) {
        console.error("Błąd zapisu własnej nazwy kontrahenta:", e);
    }
}
