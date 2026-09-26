import fs from "fs";
import path from "path";
import { PriceRoundingOption } from "./price-rounding";
import {
    WeekdayKey,
    DayOpeningHours,
    DEFAULT_OPENING_HOURS,
    ClosedDayInfo,
    SystemSettings,
    getWeekdayKey,
} from "./settings-types";

export * from "./settings-types";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export function getSystemSettings(): SystemSettings {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            return {
                waterPricePerLiter: 0,
                priceRounding: "none",
                openingHours: { ...DEFAULT_OPENING_HOURS },
                closedDays: {},
            };
        }
        const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
        const parsed = JSON.parse(raw);

        // Scalanie z wartościami domyślnymi
        const mergedOpeningHours = {
            ...DEFAULT_OPENING_HOURS,
            ...(parsed.openingHours || {}),
        };

        return {
            waterPricePerLiter: Number(parsed.waterPricePerLiter || 0),
            priceRounding: (parsed.priceRounding as PriceRoundingOption) || "none",
            openingHours: mergedOpeningHours,
            closedDays: parsed.closedDays || {},
        };
    } catch {
        return {
            waterPricePerLiter: 0,
            priceRounding: "none",
            openingHours: { ...DEFAULT_OPENING_HOURS },
            closedDays: {},
        };
    }
}

export function saveSystemSettings(settings: Partial<SystemSettings>): SystemSettings {
    try {
        const current = getSystemSettings();
        const updated: SystemSettings = {
            ...current,
            ...settings,
            openingHours: {
                ...current.openingHours,
                ...(settings.openingHours || {}),
            },
            closedDays: {
                ...current.closedDays,
                ...(settings.closedDays || {}),
            },
        };
        const dir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
        return updated;
    } catch (e) {
        console.error("Błąd zapisu pliku settings.json:", e);
        return {
            waterPricePerLiter: 0,
            priceRounding: "none",
            openingHours: { ...DEFAULT_OPENING_HOURS },
            closedDays: {},
        };
    }
}

/**
 * Zwraca domyślną godzinę zamknięcia piekarni dla danej daty.
 */
export function getClosingTimeForDate(dateStr: string, settings?: SystemSettings): string {
    const s = settings || getSystemSettings();
    const key = getWeekdayKey(dateStr);
    const dayConfig = s.openingHours?.[key];
    if (dayConfig && dayConfig.closeTime) {
        return dayConfig.closeTime;
    }
    return DEFAULT_OPENING_HOURS[key]?.closeTime || "18:00";
}
