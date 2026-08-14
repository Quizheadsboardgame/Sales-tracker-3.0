import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Vendor, Sale, CashoutRequest } from './types';
import { isSaleMature, getRemainingDays, getPayoutDate, calculateVendorBalances, getWeekOfYear } from './payoutUtils';

export const LOGO_URL = 'https://i.ibb.co/ycn6KSLq/Untitled-28-June-2026-at-01-21-42-3.png';

let logoDataUrlCache: string | null = null;

export async function loadLogoDataUrl(): Promise<string | null> {
  if (logoDataUrlCache) return logoDataUrlCache;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            logoDataUrlCache = canvas.toDataURL('image/png');
            resolve(logoDataUrlCache);
            return;
          }
        } catch {
          // Fallback if canvas export fails
        }
        resolve(img.src);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = LOGO_URL;
    } catch {
      resolve(null);
    }
  });
}

// Pre-load logo on module initialization
if (typeof window !== 'undefined') {
  loadLogoDataUrl();
}

export async function downloadVendorClearedBalancePDF(
  vendor: Vendor,
  sales: Sale[],
  cashouts: CashoutRequest[] = [],
  now: Date = new Date()
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const logoImg = await loadLogoDataUrl();

  const currentWeek = getWeekOfYear(now);
  const vendorSales = sales.filter((s) => s.vendorId === vendor.id);

  // Mature / Cleared sales (not cashed out, no cashout request pending, mature based on Friday payout rule)
  const clearedSales = vendorSales.filter((s) => !s.cashedOut && !s.cashoutRequestId && isSaleMature(s.date, now));

  // Pending sales (not cashed out, no cashout request pending, NOT mature)
  const pendingSales = vendorSales.filter((s) => !s.cashedOut && !s.cashoutRequestId && !isSaleMature(s.date, now));

  const balances = calculateVendorBalances(vendor, sales, cashouts, now);
  const availableCash = balances.availableCash;
  const pendingCash = balances.pendingCash;
  const totalVendorSalesGross = vendorSales.reduce((acc, s) => acc + s.price, 0);
  const totalVendorEarningsAll = vendorSales.reduce((acc, s) => acc + s.vendorEarnings, 0);

  const vendorCashouts = cashouts.filter((c) => c.vendorId === vendor.id);

  const statementDate = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // --- BRANDING HEADER (SOLID BLACK BANNER WITH PURE WHITE TEXT & COLOUR LOGO) ---
  doc.setFillColor(0, 0, 0); // Black box
  doc.rect(0, 0, 210, 32, 'F');

  // Embed full-colour logo
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', 12, 6, 20, 20);
    } catch (err) {
      console.error('Failed to render logo in PDF', err);
    }
  }

  const textStartX = logoImg ? 36 : 14;

  // Header text inside black box is PURE WHITE
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("NEWTON'S COLLECTABLES", textStartX, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Vendor Cleared Balance & Card Sales Statement • Week ${currentWeek} (${now.getFullYear()})`, textStartX, 19);
  doc.text(`Stall Owner: ${vendor.name} (${(vendor.commission * 100).toFixed(1)}% Commission Rate)`, textStartX, 25);

  doc.setFontSize(8);
  doc.text(`Generated: ${statementDate}`, 196, 13, { align: 'right' });
  doc.text(`Status: Official Ledger`, 196, 19, { align: 'right' });

  let currentY = 38;

  // --- FINANCIAL SUMMARY BOXES (STRICT OPPOSITE TEXT CONTRAST) ---

  // Card 1: Available Withdrawal -> Solid Black Box with Pure White Text
  doc.setFillColor(0, 0, 0); // Black box
  doc.rect(14, currentY, 58, 22, 'F');
  doc.setTextColor(255, 255, 255); // White text inside black box
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text("AVAILABLE WITHDRAWAL", 18, currentY + 6);
  doc.setFontSize(13);
  doc.text(`£${availableCash.toFixed(2)}`, 18, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${clearedSales.length} cleared card sales`, 18, currentY + 19);

  // Card 2: Pending (13-16d Hold) -> Pure White Box (Black Border) with Pure Black Text
  doc.setFillColor(255, 255, 255); // White box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(76, currentY, 58, 22, 'FD');
  doc.setTextColor(0, 0, 0); // Black text inside white box
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text("PENDING (13-16D HOLD)", 80, currentY + 6);
  doc.setFontSize(13);
  doc.text(`£${pendingCash.toFixed(2)}`, 80, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${pendingSales.length} card sales on hold`, 80, currentY + 19);

  // Card 3: Total Lifetime Earnings -> Pure White Box (Black Border) with Pure Black Text
  doc.setFillColor(255, 255, 255); // White box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(138, currentY, 58, 22, 'FD');
  doc.setTextColor(0, 0, 0); // Black text inside white box
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text("TOTAL LIFETIME EARNINGS", 142, currentY + 6);
  doc.setFontSize(13);
  doc.text(`£${totalVendorEarningsAll.toFixed(2)}`, 142, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gross Sales: £${totalVendorSalesGross.toFixed(2)}`, 142, currentY + 19);

  currentY += 28;

  // --- SECTION 1: CLEARED SALES (ELIGIBLE FOR WITHDRAWAL) ---
  // Text on white page is pure black
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("1. Cleared Card Sales (Available to Withdraw)", 14, currentY);

  currentY += 3;

  const clearedTableRows = clearedSales.map((sale) => {
    const saleDateFormatted = new Date(sale.date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return [
      saleDateFormatted,
      sale.itemName,
      `£${sale.price.toFixed(2)}`,
      `-£${sale.commissionAmount.toFixed(2)}`,
      `£${sale.vendorEarnings.toFixed(2)}`,
      'Cleared (Available)',
    ];
  });

  if (clearedTableRows.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text("No cleared sales currently available for withdrawal.", 14, currentY + 5);
    currentY += 12;
  } else {
    autoTable(doc, {
      startY: currentY,
      head: [['Sale Date & Time', 'Card / Item Name', 'Gross Price', 'Commission', 'Net Earnings', 'Status']],
      body: clearedTableRows,
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 60 },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 24, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- SECTION 2: PENDING SALES (FRIDAY CLEARING HOLD) ---
  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("2. Pending Card Sales (Friday Clearing Hold)", 14, currentY);

  currentY += 3;

  const pendingTableRows = pendingSales.map((sale) => {
    const saleDateFormatted = new Date(sale.date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const daysLeft = getRemainingDays(sale.date, now);
    const payoutDate = getPayoutDate(sale.date);
    const payoutWeek = getWeekOfYear(payoutDate);
    const clearDate = payoutDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });

    return [
      saleDateFormatted,
      sale.itemName,
      `£${sale.price.toFixed(2)}`,
      `-£${sale.commissionAmount.toFixed(2)}`,
      `£${sale.vendorEarnings.toFixed(2)}`,
      `Clears ${clearDate} (Wk ${payoutWeek}, ${daysLeft}d left)`,
    ];
  });

  if (pendingTableRows.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text("No pending sales currently in clearing hold.", 14, currentY + 5);
    currentY += 12;
  } else {
    autoTable(doc, {
      startY: currentY,
      head: [['Sale Date & Time', 'Card / Item Name', 'Gross Price', 'Commission', 'Net Earnings', 'Clearing Date']],
      body: pendingTableRows,
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 60 },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 24, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- SECTION 3: RECENT CASHOUT HISTORY ---
  if (vendorCashouts.length > 0) {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("3. Cash Out & Withdrawal Request History", 14, currentY);

    currentY += 3;

    const cashoutTableRows = vendorCashouts.map((req) => {
      const reqDate = new Date(req.date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const payoutDateStr = req.payoutDate
        ? new Date(req.payoutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : '-';

      return [
        reqDate,
        `£${req.amount.toFixed(2)}`,
        req.status.toUpperCase(),
        payoutDateStr,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Request Date', 'Amount Requested', 'Status', 'Disbursement Date']],
      body: cashoutTableRows,
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 47, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // --- FOOTER DISCLAIMER ON ALL PAGES (WHITE PAGE WITH PURE BLACK TEXT) ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(14, 284, 196, 284);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.text(
      `Official statement generated from Newton's Collectables Stall Ledger (Week ${currentWeek}, ${now.getFullYear()}). Sales clear on Friday payout days (Wed sales: 16 days, Sat sales: 13 days).`,
      14,
      289
    );
    doc.text(`Page ${i} of ${pageCount}`, 196, 289, { align: 'right' });
  }

  const sanitizedVendorName = vendor.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = now.toISOString().slice(0, 10);
  doc.save(`Newton_Collectables_Cleared_Balance_${sanitizedVendorName}_Week${currentWeek}_${dateStr}.pdf`);
}

export async function downloadStandaloneWeeklyVendorPayoutPDF({
  vendor,
  weekNumber,
  payoutDate,
  formattedPayoutDate,
  sales,
  now = new Date()
}: {
  vendor: Vendor;
  weekNumber: number;
  payoutDate: Date;
  formattedPayoutDate?: string;
  sales: Sale[];
  now?: Date;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const logoImg = await loadLogoDataUrl();

  const totalGross = sales.reduce((sum, s) => sum + s.price, 0);
  const totalCommission = sales.reduce((sum, s) => sum + s.commissionAmount, 0);
  const totalNetEarnings = sales.reduce((sum, s) => sum + s.vendorEarnings, 0);

  const formattedDateStr = formattedPayoutDate || payoutDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const isMature = sales.every((s) => isSaleMature(s.date, now));
  const remainingDays = sales.length > 0 ? getRemainingDays(sales[0].date, now) : 0;

  const generationTimestamp = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // --- BRANDING HEADER BANNER (SOLID BLACK BANNER WITH PURE WHITE TEXT & COLOUR LOGO) ---
  doc.setFillColor(0, 0, 0); // Black header box
  doc.rect(0, 0, 210, 32, 'F');

  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', 12, 6, 20, 20);
    } catch (err) {
      console.error('Failed to render logo in standalone PDF', err);
    }
  }

  const textStartX = logoImg ? 36 : 14;

  // Header text inside black box is PURE WHITE
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("NEWTON'S COLLECTABLES", textStartX, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text("STANDALONE WEEKLY PAYOUT STATEMENT", textStartX, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Vendor Stall: ${vendor.name} (${(vendor.commission * 100).toFixed(1)}% Commission Rate)`, textStartX, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`WEEK ${weekNumber} PAYOUT`, 196, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Payout Date: ${formattedDateStr}`, 196, 19, { align: 'right' });
  doc.text(`Generated: ${generationTimestamp}`, 196, 25, { align: 'right' });

  let currentY = 38;

  // --- ISOLATED SCOPE NOTICE (SOLID BLACK BOX WITH PURE WHITE TEXT) ---
  doc.setFillColor(0, 0, 0); // Black box
  doc.rect(14, currentY, 182, 8, 'F');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255); // Pure white text on black box
  doc.text(
    `EXCLUSIVE STATEMENT FOR WEEK ${weekNumber} (${formattedDateStr}): Standalone payout items for ${vendor.name} only.`,
    18,
    currentY + 5.5
  );

  currentY += 12;

  // --- SUMMARY CARDS (4 CARDS - STRICT OPPOSITE TEXT CONTRAST) ---
  const cardWidth = 42;
  const cardGap = 4.6;

  // Card 1: Gross Sales -> Pure White Box (Black Border) with Pure Black Text
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(14, currentY, cardWidth, 22, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Black text inside white box
  doc.text("GROSS SALES (WK " + weekNumber + ")", 17, currentY + 6);
  doc.setFontSize(12);
  doc.text(`£${totalGross.toFixed(2)}`, 17, currentY + 14);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${sales.length} card transaction(s)`, 17, currentY + 19);

  // Card 2: Commission Deducted -> Pure White Box (Black Border) with Pure Black Text
  const card2X = 14 + cardWidth + cardGap;
  doc.rect(card2X, currentY, cardWidth, 22, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Black text inside white box
  doc.text("COMMISSION DEDUCTED", card2X + 3, currentY + 6);
  doc.setFontSize(12);
  doc.text(`-£${totalCommission.toFixed(2)}`, card2X + 3, currentY + 14);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rate: ${(vendor.commission * 100).toFixed(1)}%`, card2X + 3, currentY + 19);

  // Card 3: Net Vendor Payout Due -> Solid Black Box with Pure White Text
  const card3X = card2X + cardWidth + cardGap;
  doc.setFillColor(0, 0, 0); // Black box
  doc.rect(card3X, currentY, cardWidth, 22, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255); // White text inside black box
  doc.text("NET PAYOUT DUE", card3X + 3, currentY + 6);
  doc.setFontSize(12);
  doc.text(`£${totalNetEarnings.toFixed(2)}`, card3X + 3, currentY + 14);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Net vendor earnings`, card3X + 3, currentY + 19);

  // Card 4: Clearing Status -> Pure White Box (Black Border) with Pure Black Text
  const card4X = card3X + cardWidth + cardGap;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(card4X, currentY, cardWidth, 22, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Black text inside white box
  doc.text("CLEARING STATUS", card4X + 3, currentY + 6);
  doc.setFontSize(11);
  if (isMature) {
    doc.text("CLEARED", card4X + 3, currentY + 14);
  } else {
    doc.text(`HOLD (${remainingDays}d)`, card4X + 3, currentY + 14);
  }
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Payout: ${formattedDateStr.slice(0, 16)}`, card4X + 3, currentY + 19);

  currentY += 28;

  // --- ITEMIZED SALES TABLE (BLACK HEADER WITH WHITE TEXT, WHITE CELLS WITH BLACK TEXT, BLACK TOTAL ROW WITH WHITE TEXT) ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Text on white page is black
  doc.text(`Itemized Transactions Maturing on Week ${weekNumber} (${formattedDateStr})`, 14, currentY);

  currentY += 3;

  const tableRows = sales.map((sale) => {
    const saleDateFormatted = new Date(sale.date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return [
      saleDateFormatted,
      sale.itemName,
      `£${sale.price.toFixed(2)}`,
      `-£${sale.commissionAmount.toFixed(2)}`,
      `£${sale.vendorEarnings.toFixed(2)}`,
    ];
  });

  // Add Grand Total row to table body
  tableRows.push([
    `TOTAL FOR WEEK ${weekNumber}`,
    `${sales.length} item(s)`,
    `£${totalGross.toFixed(2)}`,
    `-£${totalCommission.toFixed(2)}`,
    `£${totalNetEarnings.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Sale Date & Time', 'Item Description / Title', 'Gross Price', 'Commission', 'Net Payout']],
    body: tableRows,
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 8 },
    alternateRowStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 64 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Highlight last row (grand total row) as Solid Black box with Pure White text
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [0, 0, 0];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.lineColor = [0, 0, 0];
      }
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  }

  // --- SIGNATURE ACKNOWLEDGEMENT BLOCK ---
  // Top header bar of block: Black box with Pure White text
  doc.setFillColor(0, 0, 0); // Black box
  doc.rect(14, currentY, 182, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255); // White text on black box
  doc.text("WEEKLY PAYOUT ACKNOWLEDGEMENT & DISBURSEMENT RECEIPT", 18, currentY + 5);

  // Bottom box for signatures: White box with Black border & Pure Black text
  doc.setFillColor(255, 255, 255); // White box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(14, currentY + 7, 182, 21, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0); // Black text on white box
  doc.text("Vendor Signature: _________________________________", 18, currentY + 15);
  doc.text("Date Paid: _____________", 110, currentY + 15);

  doc.text("Staff / Manager Signature: ___________________________", 18, currentY + 23);
  doc.text("Ref #: NC-WK" + weekNumber + "-" + vendor.name.slice(0, 3).toUpperCase(), 110, currentY + 23);

  // --- FOOTER ON ALL PAGES (WHITE PAGE WITH PURE BLACK TEXT) ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(14, 284, 196, 284);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.text(
      `Newton's Collectables • Standalone Week ${weekNumber} Payout Statement • Vendor: ${vendor.name} • No external week data included.`,
      14,
      289
    );
    doc.text(`Page ${i} of ${pageCount}`, 196, 289, { align: 'right' });
  }

  const sanitizedVendorName = vendor.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateKey = payoutDate.toISOString().slice(0, 10);
  doc.save(`Newton_Payout_Week${weekNumber}_${sanitizedVendorName}_${dateKey}.pdf`);
}



