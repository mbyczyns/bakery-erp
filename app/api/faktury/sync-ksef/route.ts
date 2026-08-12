import { NextResponse } from 'next/server';
import { PrismaClient, InvoiceStatus } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST() {
    try {
        const ksefToken = process.env.KSEF_TOKEN;
        const ksefNip = process.env.KSEF_NIP;
        const baseUrl = process.env.KSEF_BASE_URL || 'https://api.ksef.mf.gov.pl';

        if (!ksefToken || !ksefNip) {
            return NextResponse.json(
                { error: 'Brak KSEF_TOKEN lub KSEF_NIP w pliku .env' },
                { status: 500 }
            );
        }

        // =========================================================================
        // 1. WYZNACZENIE BEZPIECZNEJ DATY POCZĄTKOWEJ (HWM z buforem bezpieczeństwa)
        // =========================================================================
        const latestInvoice = await prisma.invoice.findFirst({
            orderBy: { issuedDate: 'desc' },
            select: { issuedDate: true },
        });

        let startDate: Date;

        if (latestInvoice && latestInvoice.issuedDate) {
            // Cofamy się o 3 dni od najnowszej faktury
            const lastDate = new Date(latestInvoice.issuedDate);
            startDate = new Date(lastDate.getTime() - 3 * 24 * 60 * 60 * 1000);
            console.log(`[KSeF Sync] Wyryto ostatnią fakturę z dnia: ${lastDate.toISOString().split('T')[0]}. Pobieram od (bufor -3 dni): ${startDate.toISOString().split('T')[0]}`);
        } else {
            // Jeśli baza jest pusta -> pobieramy od 13 marca 2026 r.
            startDate = new Date('2026-05-15T00:00:00Z');
            console.log(`[KSeF Sync] Baza pusta. Pobieram faktury od daty początkowej: 2026-03-13`);
        }

        const endDate = new Date(); // Do teraz

        // =========================================================================
        // 2. AUTORYZACJA I LOGOWANIE DO KSeF
        // =========================================================================
        const headersJSON = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const pubKeyRes = await fetch(`${baseUrl}/v2/security/public-key-certificates`, { headers: headersJSON });
        const pubKeyData = await pubKeyRes.json();
        const certB64 = Array.isArray(pubKeyData) ? pubKeyData[0].certificate : pubKeyData.certificates[0].certificate;
        const pemCert = `-----BEGIN CERTIFICATE-----\n${certB64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;

        const challengeRes = await fetch(`${baseUrl}/v2/auth/challenge`, { method: 'POST', headers: headersJSON });
        const challengeData = await challengeRes.json();

        const payloadToEncrypt = Buffer.from(`${ksefToken}|${challengeData.timestampMs}`, 'utf-8');
        const encryptedTokenB64 = crypto.publicEncrypt(
            { key: pemCert, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
            payloadToEncrypt
        ).toString('base64');

        const authRes = await fetch(`${baseUrl}/v2/auth/ksef-token`, {
            method: 'POST',
            headers: headersJSON,
            body: JSON.stringify({
                challenge: challengeData.challenge,
                contextIdentifier: { type: 'nip', value: ksefNip },
                encryptedToken: encryptedTokenB64,
            }),
        });
        const authData = await authRes.json();
        const authToken = typeof authData.authenticationToken === 'object' ? authData.authenticationToken.token : authData.authenticationToken;

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const redeemRes = await fetch(`${baseUrl}/v2/auth/token/redeem`, {
            method: 'POST',
            headers: { ...headersJSON, Authorization: `Bearer ${authToken}` },
        });
        const redeemData = await redeemRes.json();
        const accessToken = redeemData.accessToken.token;

        // =========================================================================
        // 3. POBIERANIE WSZYSTKICH STRON (PETLA PAGINACJI Bez Ograniczeń)
        // =========================================================================
        const queryHeaders = { ...headersJSON, Authorization: `Bearer ${accessToken}`, 'X-Error-Format': 'problem-details' };

        const queryPayload = {
            subjectType: 'Subject2',
            dateRange: {
                dateType: 'PermanentStorage',
                from: startDate.toISOString().split('T')[0] + 'T00:00:00Z',
                to: endDate.toISOString().split('T')[0] + 'T23:59:59Z',
                restrictToPermanentStorageHwmDate: true,
            },
        };

        let allInvoices: any[] = [];
        let pageOffset = 0;
        const pageSize = 100; // Maksymalny zalecany rozmiar 1 strony
        let hasMorePages = true;

        console.log(`[KSeF Sync] Rozpoczynam pobieranie pełnej listy faktur...`);

        while (hasMorePages) {
            const queryRes = await fetch(`${baseUrl}/v2/invoices/query/metadata?sortOrder=Asc&pageOffset=${pageOffset}&pageSize=${pageSize}`, {
                method: 'POST',
                headers: queryHeaders,
                body: JSON.stringify(queryPayload),
            });

            if (!queryRes.ok) {
                const errDetails = await queryRes.json();
                console.error(`[KSeF Sync] Błąd podczas pobierania strony ${pageOffset}:`, errDetails);
                break;
            }

            const queryData = await queryRes.json();
            const invoicesOnPage: any[] = queryData.invoices || [];

            allInvoices = allInvoices.concat(invoicesOnPage);

            console.log(`[KSeF Sync] Pobrano stronę ${pageOffset} (${invoicesOnPage.length} faktur). Łącznie dotychczas: ${allInvoices.length}`);

            // Jeśli strona zwróciła mniej niż 100 faktur lub API wskazało brak kolejnych - kończymy pętlę
            if (invoicesOnPage.length < pageSize || queryData.isLastPage === true) {
                hasMorePages = false;
            } else {
                pageOffset++;
            }
        }

        // =========================================================================
        // 4. ZAPIS LUB AKTUALIZACJA WSZYSTKICH FAKTUR W BAZIE
        // =========================================================================
        let importedCount = 0;

        for (const inv of allInvoices) {
            const ksefNumber = inv.ksefNumber || inv.ksefReferenceNumber;
            if (!ksefNumber) continue;

            const sellerNip = inv.seller?.nip || inv.subject1?.identifier?.identifier || 'BRAK_NIP';
            const sellerName = inv.seller?.name || inv.subject1?.name || 'Dostawca Niezidentyfikowany';

            let contractor = await prisma.contractor.findFirst({ where: { nip: sellerNip } });
            if (!contractor) {
                contractor = await prisma.contractor.create({
                    data: { name: sellerName, nip: sellerNip, type: 'SUPPLIER', address: 'Pobrano z KSeF', email: '', phone: '' },
                });
            }

            const invoicingDate = inv.invoicingDate ? new Date(inv.invoicingDate) : new Date();
            const dueDate = inv.paymentDueDate ? new Date(inv.paymentDueDate) : invoicingDate;
            const grossAmt = Number(inv.grossAmount ?? 0);
            const netAmt = Number(inv.netAmount ?? 0);
            const vatAmt = Number(inv.vatAmount ?? 0);

            await prisma.invoice.upsert({
                where: { ksefNumber: ksefNumber },
                update: {
                    invoiceNumber: inv.invoiceNumber || inv.invoiceReferenceNumber || 'BRAK_NR',
                    issuedDate: invoicingDate,
                    dueDate: dueDate,
                    grossAmount: grossAmt,
                    netAmount: netAmt,
                    vatAmount: vatAmt,
                    currency: inv.currency || 'PLN',
                },
                create: {
                    ksefNumber: ksefNumber,
                    invoiceNumber: inv.invoiceNumber || inv.invoiceReferenceNumber || 'BRAK_NR',
                    issuedDate: invoicingDate,
                    dueDate: dueDate,
                    grossAmount: grossAmt,
                    netAmount: netAmt,
                    vatAmount: vatAmt,
                    currency: inv.currency || 'PLN',
                    status: InvoiceStatus.WAITING,
                    contractorId: contractor.id,
                },
            });

            importedCount++;
        }

        return NextResponse.json({
            success: true,
            message: `Zsynchronizowano bezlimitowo wszystkie ${importedCount} faktur od ${startDate.toISOString().split('T')[0]} do dzisiaj.`,
            importedCount,
            syncFromDate: startDate.toISOString().split('T')[0],
        });
    } catch (error: any) {
        console.error('Błąd KSeF:', error);
        return NextResponse.json({ error: 'Błąd podczas synchronizacji KSeF', details: error.message }, { status: 500 });
    }
}