import { PrismaClient, InvoiceStatus } from '@prisma/client';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';

const prisma = new PrismaClient();

let isSyncInProgress = false;
let lastSyncTimestamp = 0;

export interface KsefSyncResult {
    success: boolean;
    message: string;
    importedCount?: number;
    salesDetailsCount?: number;
    skipped?: boolean;
    inProgress?: boolean;
    error?: string;
}

export async function syncKsefInvoices(force: boolean = false): Promise<KsefSyncResult> {
    const ksefToken = process.env.KSEF_TOKEN;
    const ksefNip = process.env.KSEF_NIP;
    const baseUrl = process.env.KSEF_BASE_URL || 'https://api.ksef.mf.gov.pl';

    if (!ksefToken || !ksefNip) {
        console.warn('[KSeF Sync] Brak KSEF_TOKEN lub KSEF_NIP w konfiguracji środowiskowej (.env).');
        return {
            success: false,
            message: 'Brak KSEF_TOKEN lub KSEF_NIP w pliku .env',
            error: 'Brak konfiguracji KSeF'
        };
    }

    if (isSyncInProgress) {
        console.log('[KSeF Sync] Synchronizacja jest już w toku. Pomijam nowe żądanie.');
        return {
            success: true,
            message: 'Synchronizacja KSeF jest już w trakcie przetwarzania.',
            inProgress: true
        };
    }

    const now = Date.now();
    // Odstęp min. 45 sekund dla automatycznych synchronizacji
    if (!force && now - lastSyncTimestamp < 45 * 1000) {
        console.log('[KSeF Sync] Ostatnia synchronizacja odbyła się mniej niż 45s temu. Pomijam auto-sync.');
        return {
            success: true,
            message: 'Ostatnia synchronizacja wykonana niedawno.',
            skipped: true
        };
    }

    isSyncInProgress = true;
    console.log(`[KSeF Sync] Rozpoczynam pobieranie faktur z KSeF (${force ? 'wymuszone ręcznie' : 'automatyczne po zalogowaniu'})...`);

    try {
        const endDate = new Date();

        // 1. WYZNACZENIE BEZPIECZNEJ DATY POCZĄTKOWEJ
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

        // 2. AUTORYZACJA I LOGOWANIE DO KSeF
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

        // 3. POBIERANIE PAGINOWANE
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

        // 4. POMOCNICZE FUNKCJE NORMALIZACJI I ZNAJDOWANIA KONTRAHENTA
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
                const finalNip = normalizedNip || (remoteNipRaw && remoteNipRaw.trim() && remoteNipRaw !== 'BRAK_NIP'
                    ? remoteNipRaw.trim()
                    : `BRAK_NIP_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

                contractor = await prisma.contractor.create({
                    data: {
                        name: normalizedName || (isSales ? 'Nabywca' : 'Dostawca'),
                        nip: finalNip,
                        type: currentType,
                        address: '',
                        email: '',
                        phone: '',
                    },
                });
            } else {
                if (
                    (contractor.type === 'SUPPLIER' && isSales) ||
                    (contractor.type === 'CUSTOMER' && !isSales)
                ) {
                    contractor = await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { type: 'OTHER' }
                    });
                }

                if (contractor.address === 'Pobrano z KSeF') {
                    await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { address: '' }
                    });
                }
            }

            return contractor;
        };

        // 5. ZAPIS W BAZIE
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

        // 6. AUTOMATYCZNE SCALANIE ZDUPLIKOWANYCH KONTRAHENTÓW W BAZIE
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
                    await prisma.contractor.update({ where: { id: c.id }, data: { address: '' } }).catch(() => { });
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

                    await prisma.invoice.updateMany({
                        where: { contractorId: dup.id },
                        data: { contractorId: primary.id }
                    });

                    await prisma.product.updateMany({
                        where: { supplierId: dup.id },
                        data: { supplierId: primary.id }
                    });

                    if (primary.type !== dup.type) {
                        await prisma.contractor.update({
                            where: { id: primary.id },
                            data: { type: 'OTHER' }
                        });
                    }

                    if ((!primary.address || primary.address === 'Pobrano z KSeF') && dup.address && dup.address !== 'Pobrano z KSeF') {
                        await prisma.contractor.update({
                            where: { id: primary.id },
                            data: { address: dup.address }
                        });
                        primary.address = dup.address;
                    }

                    await prisma.contractor.delete({
                        where: { id: dup.id }
                    }).catch((err) => console.warn(`[KSeF Sync] Nie udało się usunąć duplikatu ${dup.id}:`, err.message));
                }
            }
        } catch (mergeErr) {
            console.warn('[KSeF Sync] Błąd podczas scalania duplikatów kontrahentów:', mergeErr);
        }

        // 7. AUTOMATYCZNE POBIERANIE SZCZEGÓŁÓW (POZYCJI) DLA FAKTUR SPRZEDAŻOWYCH
        let salesProcessedCount = 0;
        try {
            const salesInvoicesToProcess = await prisma.invoice.findMany({
                where: {
                    isSales: true,
                    ksefNumber: { not: null },
                    positions: { none: {} },
                },
                include: { contractor: true },
                orderBy: { issuedDate: 'desc' },
            });

            if (salesInvoicesToProcess.length > 0) {
                console.log(`[KSeF Sync] Znaleziono ${salesInvoicesToProcess.length} faktur sprzedażowych bez pozycji. Pobieram szczegóły XML...`);

                for (const invoice of salesInvoicesToProcess) {
                    if (!invoice.ksefNumber) continue;

                    try {
                        // Bezpieczny odstęp czasowy (600ms) zapobiegający timeoutom i rate-limitom serwerów KSeF
                        await new Promise((resolve) => setTimeout(resolve, 600));

                        const xmlRes = await fetch(`${baseUrl}/v2/invoices/ksef/${invoice.ksefNumber}`, {
                            method: 'GET',
                            headers: { Authorization: `Bearer ${accessToken}` },
                        });

                        if (!xmlRes.ok) {
                            console.warn(`[KSeF Sync Details] Faktura ${invoice.invoiceNumber} (${invoice.ksefNumber}): błąd HTTP ${xmlRes.status}`);
                            continue;
                        }

                        const xmlText = await xmlRes.text();
                        await parseAndSaveInvoiceXml(invoice.id, invoice.ksefNumber, xmlText, invoice.contractorId, true);
                        salesProcessedCount++;
                        console.log(`[KSeF Sync Details] Pomyślnie pobrano pozycje dla faktury sprzedażowej ${invoice.invoiceNumber} (${salesProcessedCount}/${salesInvoicesToProcess.length})`);
                    } catch (invErr: any) {
                        console.warn(`[KSeF Sync Details] Błąd przetwarzania faktury ${invoice.invoiceNumber}:`, invErr?.message);
                    }
                }
            }
        } catch (salesDetailsErr) {
            console.warn('[KSeF Sync Details] Błąd podczas automatycznego pobierania pozycji faktur sprzedażowych:', salesDetailsErr);
        }

        lastSyncTimestamp = Date.now();
        console.log(`[KSeF Sync] Sukces. Zaimportowano nagłówków: ${importedCount}, pobrano szczegółów sprzedaży: ${salesProcessedCount}`);

        const resultMessage = "Zsynchronizowano pomyślnie";

        return {
            success: true,
            message: resultMessage,
            importedCount,
            salesDetailsCount: salesProcessedCount,
        };
    } catch (error: any) {
        console.error('[KSeF Sync] Błąd podczas synchronizacji KSeF:', error);
        return {
            success: false,
            message: 'Błąd podczas synchronizacji KSeF',
            error: error?.message || 'Nieznany błąd',
        };
    } finally {
        isSyncInProgress = false;
    }
}

/**
 * Parsuje pobrany plik XML faktury KSeF i zapisuje pozycje oraz adres kontrahenta w bazie danych.
 */
export async function parseAndSaveInvoiceXml(
    invoiceId: string,
    ksefNumber: string,
    xmlText: string,
    contractorId: string | null,
    isSales: boolean
) {
    const xmlParser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });
    const parsedXml = xmlParser.parse(xmlText);

    const faRoot = parsedXml.Faktura || parsedXml;
    const faSection = faRoot?.Fa;

    // --- POBIERANIE I AKTUALIZACJA ADRESU KONTRAHENTA ---
    // Dla faktur sprzedażowych (wystawionych przez nas) kontrahentem jest Nabywca (Podmiot2)
    // Dla faktur zakupowych (kosztowych) kontrahentem jest Sprzedawca (Podmiot1)
    const remoteSubject = isSales ? (faRoot?.Podmiot2 || faRoot?.Podmiot1) : (faRoot?.Podmiot1 || faRoot?.Podmiot2);
    const adres = remoteSubject?.Adres;

    if (adres && contractorId) {
        let fullAddress = '';

        // Opcja 1: Adres ustrukturyzowany polski (AdresPol)
        if (adres.AdresPol) {
            const ulica = adres.AdresPol.Ulica ? `ul. ${adres.AdresPol.Ulica}` : '';
            const nrDomu = adres.AdresPol.NrDomu || '';
            const nrLokalu = adres.AdresPol.NrLokalu ? `/${adres.AdresPol.NrLokalu}` : '';
            const kodPocztowy = adres.AdresPol.KodPocztowy || '';
            const miejscowosc = adres.AdresPol.Miejscowosc || '';

            const streetPart = `${ulica} ${nrDomu}${nrLokalu}`.trim();
            const cityPart = `${kodPocztowy} ${miejscowosc}`.trim();
            fullAddress = [streetPart, cityPart].filter(Boolean).join(', ');
        }
        // Opcja 2: Adres zagraniczny (AdresZagr)
        else if (adres.AdresZagr) {
            const ulica = adres.AdresZagr.Ulica || '';
            const nrDomu = adres.AdresZagr.NrDomu || '';
            const kodPocztowy = adres.AdresZagr.KodPocztowy || '';
            const miejscowosc = adres.AdresZagr.Miejscowosc || '';
            const kraj = adres.AdresZagr.NazwaKraju || adres.AdresZagr.KodKraju || '';

            const streetPart = `${ulica} ${nrDomu}`.trim();
            const cityPart = `${kodPocztowy} ${miejscowosc}`.trim();
            fullAddress = [streetPart, cityPart, kraj].filter(Boolean).join(', ');
        }
        // Opcja 3: Adres liniowy (AdresL1, AdresL2)
        else if (adres.AdresL1 || adres.AdresL2) {
            const l1 = adres.AdresL1 || '';
            const l2 = adres.AdresL2 || '';
            fullAddress = [l1, l2].filter(Boolean).join(', ');
        }

        if (fullAddress && fullAddress.trim()) {
            await prisma.contractor.update({
                where: { id: contractorId },
                data: { address: fullAddress.trim() },
            }).catch(() => { });
        }
    }

    if (contractorId) {
        const c = await prisma.contractor.findUnique({ where: { id: contractorId } });
        if (c && c.address === 'Pobrano z KSeF') {
            await prisma.contractor.update({
                where: { id: contractorId },
                data: { address: '' },
            }).catch(() => { });
        }
    }

    let rows = faSection?.FaWiersz || [];
    if (!Array.isArray(rows)) {
        rows = rows ? [rows] : [];
    }

    // Usunięcie starych pozycji jeśli występowały (zapobiega duplikatom)
    await prisma.invoicePosition.deleteMany({
        where: { invoiceId: invoiceId }
    });

    for (const row of rows) {
        const productName = String(row.P_7 || 'Towar/Usługa bez nazwy').trim();
        if (!productName) continue;

        const unit = String(row.P_8A || 'szt').trim();
        const quantity = parseFloat(String(row.P_8B || '1').replace(',', '.')) || 1;
        const netPrice = parseFloat(String(row.P_9A || '0').replace(',', '.')) || 0;

        const rawVat = row.P_12 !== undefined ? String(row.P_12).toLowerCase().trim() : '23';
        let safeVatRate = 0;

        if (rawVat === 'zw' || rawVat === 'np' || rawVat === 'oo') {
            safeVatRate = 0;
        } else {
            safeVatRate = parseFloat(rawVat.replace('%', '').replace(',', '.')) || 0;
        }

        const parsedNetAmount = parseFloat(String(row.P_11 || '').replace(',', '.'));
        const netAmount = !isNaN(parsedNetAmount) && parsedNetAmount !== 0
            ? parsedNetAmount
            : (netPrice > 0 ? Number((netPrice * quantity).toFixed(2)) : 0);

        const parsedGrossAmount = parseFloat(String(row.P_11A || '').replace(',', '.'));
        const grossAmount = !isNaN(parsedGrossAmount) && parsedGrossAmount !== 0
            ? parsedGrossAmount
            : Number((netAmount * (1 + safeVatRate / 100)).toFixed(2));

        let product = null;
        if (contractorId) {
            product = await prisma.product.findFirst({
                where: { name: productName, supplierId: contractorId },
            });
        }

        if (!product) {
            product = await prisma.product.create({
                data: {
                    name: productName,
                    price: netPrice,
                    unit: unit,
                    categoryId: null,
                    supplierId: contractorId,
                    ingredientId: null,
                },
            });
        }

        await prisma.invoicePosition.create({
            data: {
                invoiceId: invoiceId,
                productId: product.id,
                name: productName,
                quantity: quantity,
                unit: unit,
                netPrice: netPrice,
                netAmount: netAmount,
                vatRate: safeVatRate,
                grossAmount: grossAmount,
            },
        });
    }

    return rows.length;
}
