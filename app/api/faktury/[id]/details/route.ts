import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';

const prisma = new PrismaClient();

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: invoiceId } = await params;

        // 1. Pobieramy fakturę z bazy wraz z pozycjami
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                contractor: true,
                positions: {
                    include: { product: true },
                },
            },
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Nie znaleziono faktury w bazie' }, { status: 404 });
        }

        // 2. JEŚLI FAKTURA MA JUŻ POZYCJE W BAZIE -> ZWRACAMY Z BAZY
        if (invoice.positions && invoice.positions.length > 0) {
            console.log(`[ON-DEMAND] Odczytano pozycje dla ${invoice.invoiceNumber} z BAZY DANYCH (${invoice.positions.length} szt.)`);
            return NextResponse.json({
                source: 'database',
                invoice,
            });
        }

        // 3. JEŚLI NIE MA POZYCJI -> POBIERAMY Z KSEF ON-DEMAND
        if (!invoice.ksefNumber) {
            return NextResponse.json({ error: 'Faktura nie posiada numeru KSeF' }, { status: 400 });
        }

        console.log(`[ON-DEMAND] Brak pozycji dla ${invoice.invoiceNumber}. Pobieram XML z KSeF (${invoice.ksefNumber})...`);

        const ksefToken = process.env.KSEF_TOKEN;
        const ksefNip = process.env.KSEF_NIP;
        const baseUrl = process.env.KSEF_BASE_URL || 'https://api.ksef.mf.gov.pl';

        if (!ksefToken || !ksefNip) {
            return NextResponse.json({ error: 'Brak konfiguracji KSeF w .env' }, { status: 500 });
        }

        const headersJSON = { 'Content-Type': 'application/json', Accept: 'application/json' };

        // Autoryzacja do KSeF
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

        await new Promise((r) => setTimeout(r, 1500));

        const redeemRes = await fetch(`${baseUrl}/v2/auth/token/redeem`, {
            method: 'POST',
            headers: { ...headersJSON, Authorization: `Bearer ${authToken}` },
        });
        const redeemData = await redeemRes.json();
        const accessToken = redeemData.accessToken.token;

        // Pobranie pliku XML
        const xmlRes = await fetch(`${baseUrl}/v2/invoices/ksef/${invoice.ksefNumber}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!xmlRes.ok) {
            return NextResponse.json({ error: `Błąd pobierania XML z KSeF (HTTP ${xmlRes.status})` }, { status: 500 });
        }

        const xmlText = await xmlRes.text();
        const xmlParser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });
        const parsedXml = xmlParser.parse(xmlText);

        const faRoot = parsedXml.Faktura || parsedXml;
        const faSection = faRoot?.Fa;

        // --- NOWE: POBIERANIE I AKTUALIZACJA ADRESU KONTRAHENTA ---
        const podmiot1 = faRoot?.Podmiot1;
        const adres = podmiot1?.Adres;

        if (adres && invoice.contractorId) {
            let fullAddress = '';

            // Opcja 1: Adres ustrukturyzowany (np. AdresPol)
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
            // Opcja 2: Adres liniowy (AdresL1, AdresL2)
            else if (adres.AdresL1 || adres.AdresL2) {
                const l1 = adres.AdresL1 || '';
                const l2 = adres.AdresL2 || '';
                fullAddress = [l1, l2].filter(Boolean).join(', ');
            }

            // Aktualizuj w bazie, jeśli wyciągnęliśmy adres i wciąż mamy placeholder
            if (
                fullAddress &&
                (!invoice.contractor.address || invoice.contractor.address === 'Pobrano z KSeF')
            ) {
                await prisma.contractor.update({
                    where: { id: invoice.contractorId },
                    data: { address: fullAddress },
                });
                console.log(`[ON-DEMAND] Zaktualizowano adres dla ${invoice.contractor.name}: ${fullAddress}`);
            }
        }
        // ---------------------------------------------------------

        let rows = faSection?.FaWiersz || [];
        if (!Array.isArray(rows)) {
            rows = rows ? [rows] : [];
        }

        let defaultCategory = await prisma.productCategory.findFirst({ where: { name: 'Produkty spożywcze' } })
            || await prisma.productCategory.findFirst();

        if (!defaultCategory) {
            defaultCategory = await prisma.productCategory.create({ data: { name: 'Produkty spożywcze' } });
        }

        // Zapis pozycji w bazie danych
        for (const row of rows) {
            const productName = String(row.P_7 || 'Towar/Usługa bez nazwy').trim();
            if (!productName) continue;

            const unit = String(row.P_8A || 'szt');
            const quantity = parseFloat(String(row.P_8B || '1'));
            const netPrice = parseFloat(String(row.P_9A || '0'));
            const netAmount = parseFloat(String(row.P_11 || row.P_11A || '0'));
            const grossAmount = parseFloat(String(row.P_11A || '0')) || (netAmount * 1.23);

            // --- BEZPIECZNE PARSOWANIE STAWKI VAT ---
            const rawVat = row.P_12 !== undefined ? String(row.P_12).toLowerCase().trim() : '23';
            let safeVatRate = 0;

            if (rawVat === 'zw' || rawVat === 'np' || rawVat === 'oo') {
                safeVatRate = 0;
            } else {
                safeVatRate = parseFloat(rawVat.replace('%', '').replace(',', '.')) || 0;
            }
            // ----------------------------------------

            let product = await prisma.product.findFirst({
                where: { name: productName, supplierId: invoice.contractorId },
            });

            if (!product) {
                product = await prisma.product.create({
                    data: {
                        name: productName,
                        price: netPrice,
                        unit: unit,
                        categoryId: null,
                        supplierId: invoice.contractorId,
                        ingredientId: null,
                    },
                });
            }

            await prisma.invoicePosition.create({
                data: {
                    invoiceId: invoice.id,
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

        // Pobieramy odświeżoną fakturę z nowo powiązanymi pozycjami
        const updatedInvoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                contractor: true,
                positions: { include: { product: true } },
            },
        });

        console.log(`[ON-DEMAND SUKCES] Pomyślnie pobrano i zapisano w bazie ${rows.length} pozycji.`);

        return NextResponse.json({
            source: 'ksef',
            invoice: updatedInvoice,
        });
    } catch (error: any) {
        console.error('Błąd w odczycie szczegółów faktury:', error);
        return NextResponse.json({ error: 'Błąd serwera podczas pobierania szczegółów', details: error.message }, { status: 500 });
    }
}