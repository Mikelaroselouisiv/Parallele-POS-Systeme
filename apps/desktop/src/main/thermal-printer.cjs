const { BrowserWindow, nativeImage } = require('electron');

/** Largeur utile approximative en points pour raster ESC/POS (58 / 80 mm). */
const RASTER_DOTS_58 = 384;
const RASTER_DOTS_80 = 576;

const ESC_ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);

function formatMoney(value) {
  return Number(value).toFixed(2);
}

function clipLine(text, lineWidth) {
  const t = String(text ?? '');
  return t.length <= lineWidth ? t : t.slice(0, lineWidth - 1) + '…';
}

/**
 * Ticket entier en une seule chaîne, alignement gauche partout (même logique pour en-tête, adresse, articles).
 * @param {Record<string, unknown>} saleData
 * @param {number} width
 */
function buildTicketText(saleData, width = 58) {
  const lineWidth = width === 80 ? 48 : 32;
  const separator = '-'.repeat(lineWidth);
  const date = saleData.dateTime ?? new Date().toLocaleString();
  const lines = [];

  const headerRaw = (saleData.receiptHeaderText || '').trim();
  if (headerRaw) {
    for (const line of headerRaw.split('\n')) {
      const s = line.trim();
      if (s) lines.push(clipLine(s, lineWidth));
    }
  } else {
    lines.push(clipLine(saleData.companyName ?? 'Entreprise', lineWidth));
  }

  const addr = (saleData.address || '').trim();
  if (addr) lines.push(clipLine(addr, lineWidth));

  const phone = String(saleData.companyPhone ?? '').trim();
  if (phone) {
    lines.push(clipLine(`Tél: ${phone}`, lineWidth));
  }

  if (
    saleData.showLogoOnReceipt &&
    saleData.receiptLogoUrl &&
    !saleData.omitLogoPlaceholder
  ) {
    lines.push(clipLine('[Logo sur ticket]', lineWidth));
  }

  lines.push(separator);
  if (saleData.receiptClientName) {
    lines.push(clipLine(`Client: ${saleData.receiptClientName}`, lineWidth));
  }
  lines.push(`Caissier: ${saleData.cashier ?? 'N/A'}`);
  lines.push(`Date: ${date}`);
  lines.push(separator);

  const isTest = !!saleData.isTest;
  const sampleBody = (saleData.previewSampleBody || '').trim();

  if (isTest && sampleBody) {
    lines.push(clipLine('--- Zone test (aperçu) ---', lineWidth));
    for (const raw of sampleBody.split('\n')) {
      const s = raw.trimEnd();
      if (s) lines.push(clipLine(s, lineWidth));
    }
    lines.push(separator);
    lines.push(`TOTAL TEST: ${formatMoney(saleData.total ?? 0)}`);
  } else {
    for (const item of saleData.items ?? []) {
      lines.push(clipLine(`${item.name} x${item.qty}`, lineWidth));
      lines.push(
        clipLine(
          `  ${formatMoney(item.price)} x ${item.qty} = ${formatMoney(item.price * item.qty)}`,
          lineWidth,
        ),
      );
    }
    lines.push(separator);
    lines.push(`TOTAL: ${formatMoney(saleData.total ?? 0)}`);
    lines.push(`Paiement: ${saleData.paymentMode ?? 'N/A'}`);
  }

  const footerRaw = (saleData.receiptFooterText || '').trim();
  if (footerRaw) {
    lines.push(separator);
    for (const line of footerRaw.split('\n')) {
      const s = line.trim();
      if (s) lines.push(clipLine(s, lineWidth));
    }
  } else if (!isTest) {
    lines.push(separator);
    lines.push('Merci pour votre visite');
  }

  lines.push('\n\n');
  return lines.join('\n');
}

function u16le(n) {
  return Buffer.from([n & 0xff, (n >> 8) & 0xff]);
}

/**
 * Bitmap ESC/POS (Epson GS v 0, mode 0). Retourne null si image illisible.
 * @param {string} dataUrl
 * @param {number} maxWidthDots
 * @returns {Buffer | null}
 */
function escPosRasterFromDataUrl(dataUrl, maxWidthDots) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image')) return null;
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    if (!img || img.isEmpty()) return null;
    let { width: w, height: h } = img.getSize();
    if (w < 1 || h < 1) return null;
    const targetW = Math.min(maxWidthDots, w);
    const targetH = Math.max(1, Math.round((h * targetW) / w));
    const resized = img.resize({ width: targetW, height: targetH, quality: 'good' });
    const { width, height } = resized.getSize();
    const bitmap = resized.toBitmap();
    const bpp = Math.round(bitmap.length / (width * height));
    if (bpp !== 4 || bitmap.length < width * height * 4) return null;

    const bytesPerRow = Math.ceil(width / 8);
    const rows = Buffer.alloc(bytesPerRow * height);

    for (let y = 0; y < height; y++) {
      for (let byteCol = 0; byteCol < bytesPerRow; byteCol++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = byteCol * 8 + bit;
          let gray = 255;
          if (x < width) {
            const idx = (y * width + x) * 4;
            const b0 = bitmap[idx];
            const g0 = bitmap[idx + 1];
            const r0 = bitmap[idx + 2];
            const a0 = bitmap[idx + 3];
            if (a0 < 140) gray = 255;
            else gray = (r0 + g0 + b0) / 3;
          }
          const black = gray < 168;
          if (black) byte |= 1 << (7 - bit);
        }
        rows[y * bytesPerRow + byteCol] = byte;
      }
    }

    return Buffer.concat([
      Buffer.from([0x1d, 0x76, 0x30, 0x00]),
      u16le(bytesPerRow),
      u16le(height),
      rows,
    ]);
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} saleData
 * @param {number} width
 */
function buildEscPosPayload(saleData, width = 58) {
  const maxDots = width === 80 ? RASTER_DOTS_80 : RASTER_DOTS_58;
  const init = Buffer.from([0x1b, 0x40]);
  const parts = [init, ESC_ALIGN_LEFT];

  const logoUrl = String(saleData.receiptLogoUrl || '');
  const wantLogo = saleData.showLogoOnReceipt && logoUrl.startsWith('data:image');
  let textData = { ...saleData };

  if (wantLogo) {
    const raster = escPosRasterFromDataUrl(logoUrl, maxDots);
    if (raster) {
      parts.push(raster);
      parts.push(Buffer.from([0x0a]));
      textData = { ...saleData, omitLogoPlaceholder: true };
    }
  }

  parts.push(Buffer.from(buildTicketText(textData, width), 'utf8'));
  parts.push(Buffer.from([0x1d, 0x56, 0x00]));
  return Buffer.concat(parts);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function receiptPageSizeMicrons(width) {
  if (width === 80) return { width: 80000, height: 320000 };
  return { width: 58000, height: 320000 };
}

/**
 * Même rendu que l’aperçu fallback d’impression (ticket monospace + logo optionnel).
 * @param {Record<string, unknown>} saleData
 */
function buildReceiptHtml(saleData) {
  const width = saleData.paperWidth === 80 ? 80 : 58;
  const logoUrl = String(saleData.receiptLogoUrl || '');
  const safeLogo =
    saleData.showLogoOnReceipt && logoUrl.startsWith('data:image') ? logoUrl : '';
  const textData = { ...saleData, omitLogoPlaceholder: !!safeLogo };
  const fullText = buildTicketText(textData, width);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { margin: 0; size: auto; }
    html, body { margin: 0; padding: 0; }
    body { font-family: 'Consolas','Courier New',monospace; font-size: 11px; padding: 2px 4px 8px 0; box-sizing: border-box; }
    img.logo { max-width: ${width === 80 ? 280 : 200}px; max-height: 100px; display: block; margin: 0 0 6px 0; }
    pre.ticket { margin: 0; font-family: inherit; font-size: inherit; white-space: pre-wrap; text-align: left; }
  </style></head><body>${
    safeLogo ? `<img class="logo" src="${safeLogo}" alt="" />` : ''
  }<pre class="ticket">${escapeHtml(fullText)}</pre></body></html>`;
}

async function printReceipt(saleData) {
  const width = saleData.paperWidth === 80 ? 80 : 58;
  const payload = buildEscPosPayload(saleData, width);
  const fallbackWindow = new BrowserWindow({ show: false });
  const html = buildReceiptHtml(saleData);
  await fallbackWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  const doCut = saleData.autoCut !== false;

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { printer: ThermalPrinter, types } = require('node-thermal-printer');
    const printer = new ThermalPrinter({
      type: types.EPSON,
      interface: saleData.printerName ?? '',
      options: { timeout: 3000 },
    });
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      throw new Error('Printer not available');
    }
    await printer.raw(payload);
    if (doCut) await printer.cut();
    return { ok: true, mode: 'escpos' };
  } catch {
    return new Promise((resolve) => {
      fallbackWindow.webContents.print(
        {
          silent: true,
          deviceName: saleData.printerName ?? '',
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: receiptPageSizeMicrons(width),
        },
        (success, failureReason) => {
          resolve({
            ok: success,
            mode: 'fallback',
            reason: failureReason || (!success ? 'Unknown print error' : undefined),
            ticketText: buildTicketText(saleData, width),
          });
          fallbackWindow.close();
        },
      );
    });
  }
}

module.exports = { printReceipt, buildTicketText, buildReceiptHtml };
