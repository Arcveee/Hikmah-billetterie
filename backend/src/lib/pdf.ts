import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { Response } from "express";

// Brand colors
const GREEN = "#0B6B3A";
const GOLD = "#D4AF37";
const CREAM = "#FFF9EE";
const DARK = "#2E2E2E";

export interface TicketData {
  reference: string;
  firstName: string;
  lastName: string;
  zoneName: string;
  busLabel: string;
  pickupPointName: string;
  seats: number;
  tripType: "ROUND_TRIP" | "ONE_WAY";
  departureTime: string;
  arrivalTime: string;
  returnTime?: string | null;
  returnLocation?: string | null;
  amountXof: number;
  eventName: string;
  eventDate: Date;
  venue: string;
}

export async function streamTicketPdf(data: TicketData, res: Response): Promise<void> {
  const qrDataUrl = await QRCode.toDataURL(data.reference, { margin: 1, width: 200 });
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1]!, "base64");

  // A5 = 419.53 x 595.28 pt
  const doc = new PDFDocument({ size: "A5", margin: 0, info: { Title: `Billet ${data.reference}` } });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="billet-${data.reference}.pdf"`);
  doc.pipe(res);

  const W = 419.53;
  const H = 595.28;

  // Header band
  doc.rect(0, 0, W, 90).fill(GREEN);

  // Gold accent line
  doc.rect(0, 90, W, 3).fill(GOLD);

  // Event name
  doc.fillColor(CREAM).fontSize(18).font("Helvetica-Bold")
    .text(data.eventName, 20, 18, { width: W - 40, align: "center" });

  // Subtitle
  doc.fillColor(GOLD).fontSize(10).font("Helvetica")
    .text("BILLET DE TRANSPORT", 20, 44, { width: W - 40, align: "center" });

  // Venue + date
  const dateStr = data.eventDate.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  doc.fillColor(CREAM).fontSize(9)
    .text(`${data.venue} · ${dateStr}`, 20, 62, { width: W - 40, align: "center" });

  // Body background
  doc.rect(0, 93, W, H - 93).fill(CREAM);

  // Reference badge
  doc.roundedRect(W / 2 - 90, 105, 180, 28, 4).fill(GREEN);
  doc.fillColor(CREAM).fontSize(13).font("Helvetica-Bold")
    .text(data.reference, W / 2 - 90, 112, { width: 180, align: "center" });

  // Passenger name
  doc.fillColor(DARK).fontSize(16).font("Helvetica-Bold")
    .text(`${data.firstName} ${data.lastName}`, 20, 148, { width: W - 40, align: "center" });

  // Divider
  doc.moveTo(30, 172).lineTo(W - 30, 172).strokeColor(GOLD).lineWidth(1).stroke();

  // Info rows
  const rows: [string, string][] = [
    ["Zone · Bus", data.busLabel],
    ["Point de ramassage", data.pickupPointName],
    ["Nombre de places", String(data.seats)],
    ["Type de trajet", data.tripType === "ROUND_TRIP" ? "Aller-retour" : "Aller simple"],
    ["Départ", data.departureTime],
    ["Arrivée (Dakar Arena)", data.arrivalTime],
  ];
  if (data.tripType === "ROUND_TRIP" && data.returnTime) {
    rows.push(["Retour", data.returnTime]);
    if (data.returnLocation) rows.push(["Lieu de retour", data.returnLocation]);
  }
  rows.push(["Montant payé", `${data.amountXof.toLocaleString("fr-FR")} FCFA`]);

  let y = 182;
  for (const [label, value] of rows) {
    doc.fillColor("#064D32").fontSize(8).font("Helvetica-Bold").text(label.toUpperCase(), 30, y);
    doc.fillColor(DARK).fontSize(10).font("Helvetica").text(value, 30, y + 11);
    y += 32;
  }

  // Gold divider before QR
  doc.moveTo(30, y + 4).lineTo(W - 30, y + 4).strokeColor(GOLD).lineWidth(1).stroke();

  // QR code
  const qrSize = 110;
  const qrX = (W - qrSize) / 2;
  doc.image(qrBuffer, qrX, y + 14, { width: qrSize, height: qrSize });

  // QR label
  doc.fillColor("#064D32").fontSize(8).font("Helvetica")
    .text("Scanner pour vérifier ce billet", 0, y + 14 + qrSize + 6, { width: W, align: "center" });

  // Footer
  doc.rect(0, H - 28, W, 28).fill(GREEN);
  doc.fillColor(GOLD).fontSize(8).font("Helvetica")
    .text("Hikma — La Maison de la Sagesse · … l'Éducation Autrement !", 0, H - 18, { width: W, align: "center" });

  doc.end();
}
