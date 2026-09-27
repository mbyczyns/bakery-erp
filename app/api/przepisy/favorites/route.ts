import { NextRequest, NextResponse } from "next/server";
import { getSystemSettings, saveSystemSettings } from "@/lib/settings";

export async function GET() {
    try {
        const settings = getSystemSettings();
        return NextResponse.json({ favoriteIds: settings.favoriteRecipeIds || [] });
    } catch (error: any) {
        console.error("Błąd pobierania ulubionych przepisów:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, isFavorite, favoriteIds } = body;

        const currentSettings = getSystemSettings();
        let updatedFavoriteIds = [...(currentSettings.favoriteRecipeIds || [])];

        if (Array.isArray(favoriteIds)) {
            updatedFavoriteIds = favoriteIds;
        } else if (id) {
            if (isFavorite === true) {
                if (!updatedFavoriteIds.includes(id)) {
                    updatedFavoriteIds.push(id);
                }
            } else if (isFavorite === false) {
                updatedFavoriteIds = updatedFavoriteIds.filter((favId) => favId !== id);
            } else {
                // Toggle
                if (updatedFavoriteIds.includes(id)) {
                    updatedFavoriteIds = updatedFavoriteIds.filter((favId) => favId !== id);
                } else {
                    updatedFavoriteIds.push(id);
                }
            }
        }

        saveSystemSettings({ favoriteRecipeIds: updatedFavoriteIds });

        return NextResponse.json({ success: true, favoriteIds: updatedFavoriteIds });
    } catch (error: any) {
        console.error("Błąd zapisywania ulubionych przepisów:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
