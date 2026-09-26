export type PriceRoundingOption = "none" | "0.10" | "0.20" | "0.50" | "1.00";

export interface PriceRoundingMeta {
    id: PriceRoundingOption;
    label: string;
    step: number;
    example: string;
    description: string;
}

export const PRICE_ROUNDING_OPTIONS: PriceRoundingMeta[] = [
    {
        id: "none",
        label: "Brak zaokrąglenia",
        step: 0,
        example: "4,23 zł",
        description: "Dokładne wyliczenie co do 1 grosza (standard)",
    },
    {
        id: "0.10",
        label: "Do 10 groszy",
        step: 0.1,
        example: "4,20 zł / 4,30 zł",
        description: "Zaokrąglanie do pełnych dziesiątek groszy (0.10 zł)",
    },
    {
        id: "0.20",
        label: "Do 20 groszy",
        step: 0.2,
        example: "4,20 zł / 4,40 zł",
        description: "Zaokrąglanie do wielokrotności 20 groszy (0.20 zł)",
    },
    {
        id: "0.50",
        label: "Do 50 groszy",
        step: 0.5,
        example: "4,50 zł / 5,00 zł",
        description: "Zaokrąglanie do połówek złotego (0.50 zł)",
    },
    {
        id: "1.00",
        label: "Do złotówek",
        step: 1.0,
        example: "4,00 zł / 5,00 zł",
        description: "Zaokrąglanie do pełnych złotych (1.00 zł)",
    },
];

export function getRoundingStep(option?: string | null): number {
    if (!option || option === "none") return 0;
    const num = parseFloat(option);
    return isNaN(num) ? 0 : num;
}

export function roundPriceByRule(price: number, roundingRule?: PriceRoundingOption | string | null): number {
    const num = Number(price);
    if (isNaN(num)) return 0;

    const step = getRoundingStep(roundingRule);
    if (step <= 0) {
        return Math.round(num * 100) / 100;
    }

    const rounded = Math.round(num / step) * step;
    return Math.round(rounded * 100) / 100;
}
