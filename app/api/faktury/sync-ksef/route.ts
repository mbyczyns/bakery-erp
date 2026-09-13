import { NextResponse } from 'next/server';
import { syncKsefInvoices } from '@/lib/ksef-sync';

export async function POST() {
    try {
        // Ręczne wywołanie z poziomu widoku faktur wymusza wykonanie synchronizacji
        const result = await syncKsefInvoices(true);

        if (!result.success) {
            return NextResponse.json(
                { error: result.message, details: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: result.message,
            importedCount: result.importedCount ?? 0,
            inProgress: result.inProgress,
            skipped: result.skipped,
        });
    } catch (error: any) {
        console.error('Błąd KSeF Route:', error);
        return NextResponse.json(
            { error: 'Błąd podczas synchronizacji KSeF', details: error?.message },
            { status: 500 }
        );
    }
}