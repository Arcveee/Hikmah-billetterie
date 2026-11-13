import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { Response } from "express";
import { ReservationStatus } from "@prisma/client";

const GREEN = "#0B6B3A";
const GOLD = "#D4AF37";

export interface PassengerRow {
  reference: string;
  lastName: string;
  firstName: string;
  phone: string;
  seats: number;
  tripType: string;
  pickupPointName: string;
  busLabel: string;
  zoneName: string;
  status: string;
  paidAt: Date | null;
  checkedInAt: Date | null;
}

export interface BusGroup {
  busLabel: string;
  zoneName: string;
  capacity: number;
  departureTime: string;
  passengers: PassengerRow[];
}

// ─── Excel ───────────────────────────────────────────────────────────────────

export async function streamPassengersExcel(
  groups: BusGroup[],
  res: Response,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hikma Billetterie";

  // One sheet per zone
  const zoneMap = new Map<string, PassengerRow[]>();
  for (const g of groups) {
    const rows = zoneMap.get(g.zoneName) ?? [];
    rows.push(...g.passengers);
    zoneMap.set(g.zoneName, rows);
  }

  const COLS: { header: string; key: keyof PassengerRow; width: number }[] = [
    { header: "Référence", key: "reference", width: 20 },
    { header: "Nom", key: "lastName", width: 18 },
    { header: "Prénom", key: "firstName", width: 18 },
    { header: "Téléphone", key: "phone", width: 14 },
    { header: "Places", key: "seats", width: 8 },
    { header: "Trajet", key: "tripType", width: 14 },
    { header: "Point de ramassage", key: "pickupPointName", width: 22 },
    { header: "Bus", key: "busLabel", width: 20 },
    { header: "Statut", key: "status", width: 12 },
  ];

  for (const [zoneName, rows] of zoneMap) {
    const ws = wb.addWorksheet(zoneName);
    ws.columns = COLS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + GREEN.slice(1) } };
      cell.font = { bold: true, color: { argb: "FFFFFFEE" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 20;

    for (const r of rows) {
      ws.addRow({
        reference: r.reference,
        lastName: r.lastName,
        firstName: r.firstName,
        phone: r.phone,
        seats: r.seats,
        tripType: r.tripType === "ROUND_TRIP" ? "Aller-retour" : "Aller simple",
        pickupPointName: r.pickupPointName,
        busLabel: r.busLabel,
        status: r.status,
      });
    }
  }

  // Summary sheet
  const summary = wb.addWorksheet("Récapitulatif");
  summary.columns = [
    { header: "Zone", key: "zone", width: 18 },
    { header: "Bus", key: "bus", width: 20 },
    { header: "Capacité", key: "capacity", width: 10 },
    { header: "Passagers", key: "passengers", width: 12 },
    { header: "Places libres", key: "free", width: 14 },
  ];
  const sumHeader = summary.getRow(1);
  sumHeader.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + GOLD.slice(1) } };
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  sumHeader.height = 20;

  for (const g of groups) {
    const taken = g.passengers.reduce((s, p) => s + p.seats, 0);
    summary.addRow({
      zone: g.zoneName,
      bus: g.busLabel,
      capacity: g.capacity,
      passengers: taken,
      free: Math.max(0, g.capacity - taken),
    });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"passagers.xlsx\"");
  await wb.xlsx.write(res);
  res.end();
}

// ─── PDF passagers par bus ────────────────────────────────────────────────────

export function streamPassengersPdf(groups: BusGroup[], res: Response): void {
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: "Liste des passagers" } });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"passagers.pdf\"");
  doc.pipe(res);

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]!;
    if (gi > 0) doc.addPage();

    // Header band
    doc.rect(40, 40, doc.page.width - 80, 36).fill(GREEN);
    doc.fillColor("#FFF9EE").fontSize(14).font("Helvetica-Bold")
      .text(`${g.zoneName} · ${g.busLabel}`, 50, 50, { width: doc.page.width - 100 });

    const taken = g.passengers.reduce((s, p) => s + p.seats, 0);
    doc.fillColor("#D4AF37").fontSize(9).font("Helvetica")
      .text(`Départ : ${g.departureTime}   |   ${taken} / ${g.capacity} places`, 50, 66, { width: doc.page.width - 100 });

    // Table header
    let y = 90;
    const cols = [
      { label: "#", x: 40, w: 24 },
      { label: "Nom & Prénom", x: 64, w: 160 },
      { label: "Tél.", x: 224, w: 90 },
      { label: "Places", x: 314, w: 44 },
      { label: "Ramassage", x: 358, w: 120 },
      { label: "✓", x: 478, w: 30 },
    ];

    doc.rect(40, y, doc.page.width - 80, 18).fill("#064D32");
    for (const c of cols) {
      doc.fillColor("#FFF9EE").fontSize(8).font("Helvetica-Bold")
        .text(c.label, c.x, y + 5, { width: c.w });
    }
    y += 18;

    let rowNum = 0;
    for (const p of g.passengers) {
      rowNum++;
      const bg = rowNum % 2 === 0 ? "#F5F0E8" : "#FFFFFF";
      doc.rect(40, y, doc.page.width - 80, 16).fill(bg);

      const vals = [
        String(rowNum),
        `${p.lastName} ${p.firstName}`,
        p.phone,
        String(p.seats),
        p.pickupPointName,
        p.checkedInAt ? "✓" : "",
      ];
      for (let ci = 0; ci < cols.length; ci++) {
        const c = cols[ci]!;
        doc.fillColor("#2E2E2E").fontSize(8).font("Helvetica")
          .text(vals[ci] ?? "", c.x, y + 4, { width: c.w, ellipsis: true });
      }
      y += 16;

      // New page if needed
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
    }

    // Footer
    doc.moveTo(40, doc.page.height - 40).lineTo(doc.page.width - 40, doc.page.height - 40)
      .strokeColor(GOLD).lineWidth(0.5).stroke();
    doc.fillColor("#064D32").fontSize(7).font("Helvetica")
      .text(`Hikma Billetterie · ${g.busLabel} · ${taken}/${g.capacity} places`,
        40, doc.page.height - 32, { width: doc.page.width - 80, align: "center" });
  }

  doc.end();
}

// ─── DB → BusGroup helper ─────────────────────────────────────────────────────

export function toBusGroups(
  buses: Array<{
    label: string;
    capacity: number;
    departureTime: string;
    zone: { name: string };
    reservations: Array<{
      reference: string;
      lastName: string;
      firstName: string;
      phone: string;
      seats: number;
      tripType: string;
      status: ReservationStatus;
      paidAt: Date | null;
      checkedInAt: Date | null;
      pickupPoint: { name: string };
    }>;
  }>,
): BusGroup[] {
  return buses.map((b) => ({
    busLabel: b.label,
    zoneName: b.zone.name,
    capacity: b.capacity,
    departureTime: b.departureTime,
    passengers: b.reservations.map((r) => ({
      reference: r.reference,
      lastName: r.lastName,
      firstName: r.firstName,
      phone: r.phone,
      seats: r.seats,
      tripType: r.tripType,
      pickupPointName: r.pickupPoint.name,
      busLabel: b.label,
      zoneName: b.zone.name,
      status: r.status,
      paidAt: r.paidAt,
      checkedInAt: r.checkedInAt,
    })),
  }));
}
