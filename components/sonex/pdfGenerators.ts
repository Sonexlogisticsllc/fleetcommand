// ─── Sonex Dispatch Hub — PDF Generators ─────────────────────────────────────
// Client-side only — dynamic import from components that use these

import type { SonexCarrier, SonexLoad, SonexSettlement, SonexSettings } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS } from '@/lib/sonexTypes';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Settlement PDF ────────────────────────────────────────────────────────────

export async function generateSettlementPDF(
  carrier: SonexCarrier,
  loads: SonexLoad[],
  periodStart: string,
  periodEnd: string,
  settings: SonexSettings,
): Promise<void> {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const amber = [245, 158, 11] as [number, number, number];
  const navy = [5, 11, 24] as [number, number, number];
  const slate = [71, 85, 105] as [number, number, number];

  // ── Header bar ──
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 40, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...amber);
  doc.text('SONEX LOGISTICS LLC', 15, 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(settings.companyAddress, 15, 23);
  doc.text(`${settings.companyCity}, ${settings.companyState} ${settings.companyZip}`, 15, 28);
  doc.text(`${settings.companyEmail}  |  ${settings.companyPhone}`, 15, 33);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...amber);
  doc.text('CARRIER SETTLEMENT', pageW - 15, 16, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, pageW - 15, 23, { align: 'right' });
  doc.text(`Period: ${formatDate(periodStart)} – ${formatDate(periodEnd)}`, pageW - 15, 29, { align: 'right' });

  // ── Carrier Info ──
  let y = 50;
  doc.setFillColor(240, 240, 248);
  doc.roundedRect(15, y, pageW - 30, 28, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 40);
  doc.text('CARRIER INFORMATION', 20, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 80);
  doc.text(`Name: ${carrier.firstName} ${carrier.lastName}`, 20, y + 14);
  doc.text(`Phone: ${carrier.phone}   Email: ${carrier.email}`, 20, y + 20);

  const authLine = carrier.hasOwnAuthority
    ? `MC#: ${carrier.mcNumber || 'N/A'}   DOT#: ${carrier.dotNumber || 'N/A'}`
    : `Leased MC: ${carrier.mcHolderName || 'N/A'} (${carrier.mcHolderMC || 'N/A'})`;
  doc.text(authLine, pageW / 2, y + 14);
  doc.text(`Equipment: ${carrier.equipmentType.replace('_', ' ').toUpperCase()}   Dispatch Fee: ${carrier.dispatchFeePercent}%`, pageW / 2, y + 20);

  // ── Loads Table ──
  y = 90;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 40);
  doc.text('LOAD DETAILS', 15, y);

  const tableRows = loads.map(l => [
    l.loadNumber,
    formatDate(l.pickupDate),
    `${l.pickupState} → ${l.deliveryState}`,
    l.brokerName,
    l.commodity,
    formatCurrency(l.rate),
    `${l.dispatchFeePercent}%`,
    formatCurrency(l.dispatchFeeAmount),
    formatCurrency(l.carrierNet),
    LOAD_STATUS_LABELS[l.status],
  ]);

  const grossTotal = loads.reduce((s, l) => s + l.rate, 0);
  const feeTotal = loads.reduce((s, l) => s + l.dispatchFeeAmount, 0);
  const netTotal = grossTotal - feeTotal;

  autoTable(doc, {
    startY: y + 5,
    head: [['Load #', 'Date', 'Route', 'Broker', 'Commodity', 'Gross', 'Fee%', 'Fee $', 'Net Pay', 'Status']],
    body: tableRows,
    foot: [['', '', '', '', `${loads.length} load${loads.length !== 1 ? 's' : ''}`, formatCurrency(grossTotal), '', formatCurrency(feeTotal), formatCurrency(netTotal), '']],
    theme: 'grid',
    headStyles: { fillColor: navy, textColor: [245, 158, 11], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [240, 240, 248], textColor: [20, 20, 40], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 60] },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      5: { halign: 'right' },
      7: { halign: 'right', textColor: [200, 80, 0] },
      8: { halign: 'right', fontStyle: 'bold', textColor: [0, 120, 60] },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 150;

  // ── Summary box ──
  doc.setFillColor(...navy);
  doc.roundedRect(pageW - 90, finalY + 10, 75, 38, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('SETTLEMENT SUMMARY', pageW - 87, finalY + 18);
  doc.setFontSize(9);
  doc.text(`Gross Revenue: ${formatCurrency(grossTotal)}`, pageW - 87, finalY + 25);
  doc.setTextColor(245, 158, 11);
  doc.text(`Dispatch Fee (${carrier.dispatchFeePercent}%): −${formatCurrency(feeTotal)}`, pageW - 87, finalY + 31);
  doc.setTextColor(74, 222, 128);
  doc.setFontSize(11);
  doc.text(`NET PAY: ${formatCurrency(netTotal)}`, pageW - 87, finalY + 39);

  // ── Signature lines ──
  const sigY = finalY + 58;
  doc.setTextColor(120, 120, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.line(15, sigY, 90, sigY);
  doc.text('Carrier Signature & Date', 15, sigY + 5);
  doc.line(pageW - 90, sigY, pageW - 15, sigY);
  doc.text('Authorized — Sonex Logistics LLC', pageW - 90, sigY + 5);

  doc.save(`Sonex_Settlement_${carrier.firstName}_${carrier.lastName}_${periodStart}_${periodEnd}.pdf`);
}

// ─── Weekly Dispatch Fee Invoice PDF ──────────────────────────────────────────

export interface WeeklyInvoiceLoad {
  loadNumber: string;
  carrierId: string;
  carrierName: string;
  brokerName: string;
  pickupState: string;
  deliveryState: string;
  pickupDate: string;
  rate: number;
  dispatchFeePercent: number;
  dispatchFeeAmount: number;
}

export async function generateWeeklyInvoicePDF(
  weekStart: string,
  weekEnd: string,
  loads: WeeklyInvoiceLoad[],
  settings: SonexSettings,
): Promise<void> {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const amber = [245, 158, 11] as [number, number, number];
  const navy = [5, 11, 24] as [number, number, number];

  // ── Header ──
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 44, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...amber);
  doc.text('SONEX LOGISTICS LLC', 15, 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(settings.companyAddress, 15, 23);
  doc.text(`${settings.companyCity}, ${settings.companyState} ${settings.companyZip}`, 15, 29);
  doc.text(`${settings.companyEmail}  |  ${settings.companyPhone}`, 15, 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...amber);
  doc.text('DISPATCH FEE INVOICE', pageW - 15, 16, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(`Week of: ${formatDate(weekStart)} – ${formatDate(weekEnd)}`, pageW - 15, 24, { align: 'right' });
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, pageW - 15, 30, { align: 'right' });
  doc.text(`Invoice #: SINV-${weekStart.replace(/-/g, '')}`, pageW - 15, 36, { align: 'right' });

  // ── Loads by carrier grouped ──
  const carrierGroups = new Map<string, WeeklyInvoiceLoad[]>();
  for (const load of loads) {
    const group = carrierGroups.get(load.carrierId) || [];
    group.push(load);
    carrierGroups.set(load.carrierId, group);
  }

  let y = 52;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 40);
  doc.text(`LOADS COMPLETED — WEEK OF ${formatDate(weekStart).toUpperCase()}`, 15, y);

  const tableRows: string[][] = [];
  let runningSubtotals: { carrier: string; loads: number; fee: number }[] = [];

  Array.from(carrierGroups.entries()).forEach(([carrierId, carrierLoads]) => {
    const carrierName = carrierLoads[0].carrierName;
    const subtotalFee = carrierLoads.reduce((s: number, l: WeeklyInvoiceLoad) => s + l.dispatchFeeAmount, 0);
    const subtotalGross = carrierLoads.reduce((s: number, l: WeeklyInvoiceLoad) => s + l.rate, 0);

    for (const load of carrierLoads) {
      tableRows.push([
        load.loadNumber,
        carrierName,
        load.brokerName,
        `${load.pickupState} → ${load.deliveryState}`,
        formatDate(load.pickupDate),
        formatCurrency(load.rate),
        `${load.dispatchFeePercent}%`,
        formatCurrency(load.dispatchFeeAmount),
      ]);
    }

    // Carrier subtotal row
    tableRows.push(['', `  Subtotal — ${carrierName}`, '', '', `${carrierLoads.length} loads`, formatCurrency(subtotalGross), '', formatCurrency(subtotalFee)]);
    runningSubtotals.push({ carrier: carrierName, loads: carrierLoads.length, fee: subtotalFee });
  });

  const grandTotalFee = loads.reduce((s: number, l: WeeklyInvoiceLoad) => s + l.dispatchFeeAmount, 0);
  const grandTotalGross = loads.reduce((s: number, l: WeeklyInvoiceLoad) => s + l.rate, 0);

  autoTable(doc, {
    startY: y + 5,
    head: [['Load #', 'Carrier', 'Broker', 'Route', 'Date', 'Gross Rate', 'Fee %', 'Dispatch Fee']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: navy, textColor: [245, 158, 11], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 60] },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      5: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold', textColor: [160, 70, 0] },
    },
    didParseCell: (data: any) => {
      // Highlight subtotal rows
      if (data.row.raw[1]?.startsWith('  Subtotal')) {
        data.cell.styles.fillColor = [230, 240, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [20, 50, 140];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 150;

  // ── Grand Total Box ──
  const boxY = finalY + 12;
  doc.setFillColor(...navy);
  doc.roundedRect(15, boxY, pageW - 30, 36, 4, 4, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(`Total Loads Completed: ${loads.length}`, 22, boxY + 10);
  doc.text(`Total Gross Revenue Dispatched: ${formatCurrency(grandTotalGross)}`, 22, boxY + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('TOTAL DISPATCH FEES EARNED THIS WEEK:', pageW - 22, boxY + 12, { align: 'right' });
  doc.setFontSize(18);
  doc.setTextColor(...amber);
  doc.text(formatCurrency(grandTotalFee), pageW - 22, boxY + 28, { align: 'right' });

  // ── Footer ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 180);
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.text('Sonex Logistics LLC — Internal Dispatch Earnings Record', pageW / 2, footerY, { align: 'center' });

  doc.save(`Sonex_Dispatch_Invoice_Week_${weekStart}.pdf`);
}
