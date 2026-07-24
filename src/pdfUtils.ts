import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Vendor, Sale, CashoutRequest } from './types';
import { isSaleMature, getRemainingDays, getPayoutDate, calculateVendorBalances } from './payoutUtils';

export function downloadVendorClearedBalancePDF(
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

  // --- BRANDING HEADER ---
  // Dark header banner
  doc.setFillColor(24, 24, 27); // zinc-900
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text("NEWTON'S COLLECTABLES", 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(161, 161, 170); // zinc-400
  doc.text("Vendor Cleared Balance & Card Sales Statement", 14, 21);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Generated: ${statementDate}`, 196, 13, { align: 'right' });
  doc.text(`Vendor: ${vendor.name}`, 196, 21, { align: 'right' });

  let currentY = 38;

  // --- FINANCIAL SUMMARY BOXES ---
  doc.setDrawColor(228, 228, 231); // zinc-200
  doc.setFillColor(244, 244, 245); // zinc-100

  // Card 1: Cleared & Available
  doc.rect(14, currentY, 58, 22, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(113, 113, 122); // zinc-500
  doc.text("AVAILABLE WITHDRAWAL", 18, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`£${availableCash.toFixed(2)}`, 18, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(113, 113, 122);
  doc.text(`${clearedSales.length} cleared card sales`, 18, currentY + 19);

  // Card 2: Pending (13-16d Hold)
  doc.rect(76, currentY, 58, 22, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(113, 113, 122);
  doc.text("PENDING (13-16D HOLD)", 80, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text(`£${pendingCash.toFixed(2)}`, 80, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(113, 113, 122);
  doc.text(`${pendingSales.length} card sales on hold`, 80, currentY + 19);

  // Card 3: Total Sales Earnings
  doc.rect(138, currentY, 58, 22, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(113, 113, 122);
  doc.text("TOTAL LIFETIME EARNINGS", 142, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(24, 24, 27); // zinc-900
  doc.text(`£${totalVendorEarningsAll.toFixed(2)}`, 142, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(113, 113, 122);
  doc.text(`Gross Sales: £${totalVendorSalesGross.toFixed(2)}`, 142, currentY + 19);

  currentY += 28;

  // --- SECTION 1: CLEARED SALES (ELIGIBLE FOR WITHDRAWAL) ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(24, 24, 27);
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
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(113, 113, 122);
    doc.text("No cleared sales currently available for withdrawal.", 14, currentY + 5);
    currentY += 12;
  } else {
    autoTable(doc, {
      startY: currentY,
      head: [['Sale Date & Time', 'Card / Item Name', 'Gross Price', 'Commission', 'Net Earnings', 'Status']],
      body: clearedTableRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [39, 39, 42] },
      alternateRowStyles: { fillColor: [240, 253, 244] },
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

  // --- SECTION 2: PENDING SALES (FRIDAY CLEARING HOLD) ---
  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(24, 24, 27);
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
    const clearDate = getPayoutDate(sale.date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });

    return [
      saleDateFormatted,
      sale.itemName,
      `£${sale.price.toFixed(2)}`,
      `-£${sale.commissionAmount.toFixed(2)}`,
      `£${sale.vendorEarnings.toFixed(2)}`,
      `Clears ${clearDate} (${daysLeft}d left)`,
    ];
  });

  if (pendingTableRows.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(113, 113, 122);
    doc.text("No pending sales currently in clearing hold.", 14, currentY + 5);
    currentY += 12;
  } else {
    autoTable(doc, {
      startY: currentY,
      head: [['Sale Date & Time', 'Card / Item Name', 'Gross Price', 'Commission', 'Net Earnings', 'Clearing Date']],
      body: pendingTableRows,
      theme: 'grid',
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [39, 39, 42] },
      alternateRowStyles: { fillColor: [254, 243, 199] },
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
    doc.setTextColor(24, 24, 27);
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
      headStyles: { fillColor: [39, 39, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [39, 39, 42] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 45, halign: 'right' },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 47, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // --- FOOTER DISCLAIMER ON ALL PAGES ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(161, 161, 170);

    doc.text(
      "Official statement generated from Newton's Collectables Stall Ledger. Sales clear on Friday payout days (Wed sales: 16 days, Sat sales: 13 days).",
      14,
      288
    );
    doc.text(`Page ${i} of ${pageCount}`, 196, 288, { align: 'right' });
  }

  const sanitizedVendorName = vendor.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = now.toISOString().slice(0, 10);
  doc.save(`Newton_Collectables_Cleared_Balance_${sanitizedVendorName}_${dateStr}.pdf`);
}
