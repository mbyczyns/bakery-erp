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

        const endDate = new Date();

        // =========================================================================
        // 1. WYZNACZENIE BEZPIECZNEJ DATY POCZĄTKOWEJ
        // =========================================================================
        const getStartDate = async (isSales: boolean) => {
            const invoiceTypeLabel = isSales ? "SPRZEDAŻOWE" : "KOSZTOWE";

            const count = await prisma.invoice.count({
                where: { isSales: isSales }
            });

            if (count > 0) {
                const latestInvoice = await prisma.invoice.findFirst({
                    where: { isSales: isSales },
                    orderBy: { issuedDate: 'desc' },
                    select: { issuedDate: true },
                });

                if (latestInvoice && latestInvoice.issuedDate) {
                    const lastDate = new Date(latestInvoice.issuedDate);
                    const bufferedDate = new Date(lastDate.getTime() - 3 * 24 * 60 * 60 * 1000);
                    console.log(`[KSeF Sync] Faktury ${invoiceTypeLabel} istnieją w bazie. Aktualizacja od: ${bufferedDate.toISOString().split('T')[0]}`);
                    return bufferedDate;
                }
            }

            const ninetyOneDaysAgo = new Date();
            ninetyOneDaysAgo.setDate(ninetyOneDaysAgo.getDate() - 91);
            console.log(`[KSeF Sync] Baza dla ${invoiceTypeLabel} jest PUSTA! Pobieram z ostatnich 91 dni: ${ninetyOneDaysAgo.toISOString().split('T')[0]}`);
            return ninetyOneDaysAgo;
        };

        const purchaseStartDate = await getStartDate(false);
        const salesStartDate = await getStartDate(true);

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

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const redeemRes = await fetch(`${baseUrl}/v2/auth/token/redeem`, {
            method: 'POST',
            headers: { ...headersJSON, Authorization: `Bearer ${authToken}` },
        });
        const redeemData = await redeemRes.json();
        const accessToken = redeemData.accessToken.token;

        // =========================================================================
        // 3. POBIERANIE PAGINOWANE
        // =========================================================================
        const queryHeaders = { ...headersJSON, Authorization: `Bearer ${accessToken}`, 'X-Error-Format': 'problem-details' };

        const fetchInvoicesForSubject = async (subjectType: 'Subject1' | 'Subject2', startDate: Date) => {
            let fetchedInvoices: any[] = [];
            let pageOffset = 0;
            const pageSize = 100;
            let currentFromDate = startDate.toISOString().split('T')[0] + 'T00:00:00Z';
            const toDate = endDate.toISOString().split('T')[0] + 'T23:59:59Z';

            while (true) {
                const queryPayload = {
                    subjectType: subjectType,
                    dateRange: {
                        dateType: 'PermanentStorage',
                        from: currentFromDate,
                        to: toDate,
                        restrictToPermanentStorageHwmDate: true,
                    },
                };

                const queryRes = await fetch(`${baseUrl}/v2/invoices/query/metadata?sortOrder=Asc&pageOffset=${pageOffset}&pageSize=${pageSize}`, {
                    method: 'POST',
                    headers: queryHeaders,
                    body: JSON.stringify(queryPayload),
                });

                if (!queryRes.ok) break;

                const queryData = await queryRes.json();
                const invoicesOnPage = queryData.invoices || [];

                fetchedInvoices = fetchedInvoices.concat(invoicesOnPage);

                const hasMore = queryData.hasMore === true;
                const isTruncated = queryData.isTruncated === true;

                if (!hasMore) break;

                if (hasMore && !isTruncated) {
                    pageOffset++;
                } else if (hasMore && isTruncated) {
                    if (invoicesOnPage.length === 0) break;

                    const lastInvoice = invoicesOnPage[invoicesOnPage.length - 1];
                    currentFromDate = lastInvoice.permanentStorageDate || lastInvoice.acquisitionTimestamp;
                    pageOffset = 0;
                }
            }
            return fetchedInvoices;
        };

        const purchaseInvoices = await fetchInvoicesForSubject('Subject2', purchaseStartDate);
        const salesInvoices = await fetchInvoicesForSubject('Subject1', salesStartDate);

        // =========================================================================
        // 4. POMOCNICZE FUNKCJE NORMALIZACJI I ZNAJDOWANIA KONTRAHENTA
        // =========================================================================
        const cleanNip = (raw: string | undefined | null): string => {
            if (!raw) return '';
            const trimmed = String(raw).trim().toUpperCase();
            if (trimmed === 'BRAK_NIP' || trimmed === 'BRAK' || trimmed === 'NONE' || trimmed === 'NULL') return '';
            return trimmed.replace(/^PL/, '').replace(/[\s-]/g, '');
        };

        const cleanName = (raw: string | undefined | null): string => {
            if (!raw) return '';
            return String(raw).trim();
        };

        const findOrCreateContractor = async (remoteNipRaw: string, remoteNameRaw: string, isSales: boolean) => {
            const normalizedNip = cleanNip(remoteNipRaw);
            const normalizedName = cleanName(remoteNameRaw);

            let contractor: any = null;

            // 1. Szukamy po znormalizowanym NIP-ie
            if (normalizedNip.length >= 6) {
                contractor = await prisma.contractor.findFirst({
                    where: {
                        OR: [
                            { nip: normalizedNip },
                            { nip: `PL${normalizedNip}` },
                            { nip: remoteNipRaw.trim() },
                        ]
                    }
                });
            }

            // 2. Jeśli nie znaleziono po NIP, szukamy po dokładnej nazwie
            if (!contractor && normalizedName && normalizedName !== 'Nabywca Niezidentyfikowany' && normalizedName !== 'Dostawca Niezidentyfikowany') {
                contractor = await prisma.contractor.findFirst({
                    where: {
                        name: {
                            equals: normalizedName,
                            mode: 'insensitive'
                        }
                    }
                });
            }

            const currentType = isSales ? 'CUSTOMER' : 'SUPPLIER';

            if (!contractor) {
                // Generujemy unikalny NIP awaryjny jeśli brak NIP-u
                const finalNip = normalizedNip || (remoteNipRaw && remoteNipRaw.trim() && remoteNipRaw !== 'BRAK_NIP'
                    ? remoteNipRaw.trim()
                    : `BRAK_NIP_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

                contractor = await prisma.contractor.create({
                    data: {
                        name: normalizedName || (isSales ? 'Nabywca' : 'Dostawca'),
                        nip: finalNip,
                        type: currentType,
                        address: '', // Zgodnie z wytycznymi - puste pole zamiast "Pobrano z KSeF"
                        email: '',
                        phone: '',
                    },
                });
            } else {
                // Kontrahent już istnieje w bazie.
                // Jeśli firma jest zarówno dostawcą (faktury kosztowe) jak i odbiorcą (faktury sprzedażowe),
                // oznaczamy ją jako 'OTHER' (uniwersalny kontrahent), nie tworząc kopii!
                if (
                    (contractor.type === 'SUPPLIER' && isSales) ||
                    (contractor.type === 'CUSTOMER' && !isSales)
                ) {
                    contractor = await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { type: 'OTHER' }
                    });
                }

                // Jeśli kontrahent miał stary placeholder 'Pobrano z KSeF', wyczyśćmy go
                if (contractor.address === 'Pobrano z KSeF') {
                    await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { address: '' }
                    });
                }
            }

            return contractor;
        };

        // =========================================================================
        // 5. ZAPIS W BAZIE
        // =========================================================================
        let importedCount = 0;

        const allInvoices = [
            ...purchaseInvoices.map(inv => ({ ...inv, _isSales: false })),
            ...salesInvoices.map(inv => ({ ...inv, _isSales: true }))
        ];

        for (const inv of allInvoices) {
            const ksefNumber = inv.ksefNumber || inv.ksefReferenceNumber;
            if (!ksefNumber) continue;

            const remoteNip = inv._isSales
                ? (inv.buyer?.identifier?.value || inv.buyer?.nip || inv.subjectTo?.issuedToIdentifier?.identifier || inv.subject2?.identifier?.identifier || 'BRAK_NIP')
                : (inv.seller?.nip || inv.seller?.identifier?.value || inv.subjectBy?.issuedByIdentifier?.identifier || inv.subject1?.identifier?.identifier || 'BRAK_NIP');

            const remoteName = inv._isSales
                ? (inv.buyer?.name || inv.subjectTo?.issuedToName?.tradeName || inv.subjectTo?.issuedToName?.fullName || inv.subject2?.name || 'Nabywca Niezidentyfikowany')
                : (inv.seller?.name || inv.subjectBy?.issuedByName?.tradeName || inv.subjectBy?.issuedByName?.fullName || inv.subject1?.name || 'Dostawca Niezidentyfikowany');

            const contractor = await findOrCreateContractor(remoteNip, remoteName, inv._isSales);

            const invoicingDate = inv.invoicingDate ? new Date(inv.invoicingDate) : new Date();
            const dueDate = inv.paymentDueDate ? new Date(inv.paymentDueDate) : invoicingDate;

            const grossAmt = Number(inv.grossAmount ?? inv.totalGrossAmount ?? 0);
            const netAmt = Number(inv.netAmount ?? inv.totalNetAmount ?? 0);
            const vatAmt = Number(inv.vatAmount ?? inv.totalVatAmount ?? 0);

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
                    isSales: inv._isSales,
                    contractorId: contractor.id
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
                    status: inv._isSales ? InvoiceStatus.IMPORTED : InvoiceStatus.WAITING,
                    contractorId: contractor.id,
                    isSales: inv._isSales
                },
            });

            importedCount++;
        }

        // =========================================================================
        // 6. AUTOMATYCZNE SCALANIE ZDUPLIKOWANYCH KONTRAHENTÓW W BAZIE
        // =========================================================================
        try {
            const allContractors = await prisma.contractor.findMany({
                include: {
                    invoices: { select: { id: true, isSales: true } },
                    products: { select: { id: true } },
                }
            });

            const nipGroups = new Map<string, typeof allContractors>();
            const nameGroups = new Map<string, typeof allContractors>();

            for (const c of allContractors) {
                if (c.address === 'Pobrano z KSeF') {
                    await prisma.contractor.update({ where: { id: c.id }, data: { address: '' } }).catch(() => {});
                }

                const nNip = cleanNip(c.nip);
                if (nNip.length >= 6) {
                    if (!nipGroups.has(nNip)) nipGroups.set(nNip, []);
                    nipGroups.get(nNip)!.push(c);
                } else {
                    const nameKey = c.name.trim().toLowerCase();
                    if (nameKey && nameKey !== 'dostawca niezidentyfikowany' && nameKey !== 'nabywca niezidentyfikowany') {
                        if (!nameGroups.has(nameKey)) nameGroups.set(nameKey, []);
                        nameGroups.get(nameKey)!.push(c);
                    }
                }
            }

            const mergeList = [...Array.from(nipGroups.values()), ...Array.from(nameGroups.values())];

            for (const group of mergeList) {
                if (group.length <= 1) continue;

                group.sort((a, b) => {
                    if (b.invoices.length !== a.invoices.length) return b.invoices.length - a.invoices.length;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });

                const primary = group[0];
                const duplicates = group.slice(1);

                for (const dup of duplicates) {
                    if (dup.id === primary.id) continue;

                    // Przepnij faktury z duplikatu na kontrahenta głównego
                    await prisma.invoice.updateMany({
                        where: { contractorId: dup.id },
                        data: { contractorId: primary.id }
                    });

                    // Przepnij produkty
                    await prisma.product.updateMany({
                        where: { supplierId: dup.id },
                        data: { supplierId: primary.id }
                    });

                    // Ustaw typ na OTHER jeśli duplikat miał inny typ relacji
                    if (primary.type !== dup.type) {
                        await prisma.contractor.update({
                            where: { id: primary.id },
                            data: { type: 'OTHER' }
                        });
                    }

                    // Przepisz poprawny adres jeśli duplikat go posiadał
                    if ((!primary.address || primary.address === 'Pobrano z KSeF') && dup.address && dup.address !== 'Pobrano z KSeF') {
                        await prisma.contractor.update({
                            where: { id: primary.id },
                            data: { address: dup.address }
                        });
                        primary.address = dup.address;
                    }

                    // Usuń zduplikowany rekord
                    await prisma.contractor.delete({
                        where: { id: dup.id }
                    }).catch((err) => console.warn(`[KSeF Sync] Nie udało się usunąć duplikatu ${dup.id}:`, err.message));
                }
            }
        } catch (mergeErr) {
            console.warn('[KSeF Sync] Błąd podczas scalania duplikatów kontrahentów:', mergeErr);
        }

        return NextResponse.json({
            success: true,
            message: `Zsynchronizowano pomyślnie. Zapisano i przetworzono ${importedCount} faktur.`,
            importedCount,
        });
    } catch (error: any) {
        console.error('Błąd KSeF:', error);
        return NextResponse.json({ error: 'Błąd podczas synchronizacji KSeF', details: error.message }, { status: 500 });
    }
}