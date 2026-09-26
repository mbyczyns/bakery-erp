import { PriceRoundingOption } from "./price-rounding";

export type WeekdayKey =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";

export interface DayOpeningHours {
    isOpen: boolean;
    openTime: string; // np. "06:00"
    closeTime: string; // np. "18:00"
}

export const WEEKDAY_KEYS: WeekdayKey[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
    monday: "Poniedziałek",
    tuesday: "Wtorek",
    wednesday: "Środa",
    thursday: "Czwartek",
    friday: "Piątek",
    saturday: "Sobota",
    sunday: "Niedziela",
};

export const DEFAULT_OPENING_HOURS: Record<WeekdayKey, DayOpeningHours> = {
    monday: { isOpen: true, openTime: "06:00", closeTime: "18:00" },
    tuesday: { isOpen: true, openTime: "06:00", closeTime: "18:00" },
    wednesday: { isOpen: true, openTime: "06:00", closeTime: "18:00" },
    thursday: { isOpen: true, openTime: "06:00", closeTime: "18:00" },
    friday: { isOpen: true, openTime: "06:00", closeTime: "18:00" },
    saturday: { isOpen: true, openTime: "06:00", closeTime: "14:00" },
    sunday: { isOpen: false, openTime: "07:00", closeTime: "13:00" },
};

export interface ClosedDayInfo {
    isClosed: boolean;
    reason?: string;
    updatedAt?: string;
}

export interface SystemSettings {
    waterPricePerLiter: number;
    priceRounding: PriceRoundingOption;
    openingHours: Record<WeekdayKey, DayOpeningHours>;
    closedDays?: Record<string, ClosedDayInfo>;
}

/**
 * Zwraca klucz dnia tygodnia dla podanej daty (np. "2026-09-25" -> "friday")
 */
export function getWeekdayKey(dateStr: string): WeekdayKey {
    const d = new Date(`${dateStr.split("T")[0]}T12:00:00.000Z`);
    const dayIndex = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const map: Record<number, WeekdayKey> = {
        0: "sunday",
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
    };
    return map[dayIndex] || "monday";
}
