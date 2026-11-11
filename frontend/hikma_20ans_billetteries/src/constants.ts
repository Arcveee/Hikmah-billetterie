import type { BookingState, Reservation } from "./types";

export const BRAND = {
  name: "La Maison de la Sagesse",
  short: "Hikma",
  slogan: "l'Éducation Autrement !",
  edition: "20 ANS",
  venue: "Dakar Arena, Diamniadio",
  departure: "Dimanche 15 juin",
  adminCode: "HIKMA20",
  whatsapp: "+221 77 214 20 20",
};

export const PHONE_REGEX = /^(70|75|76|77|78)[0-9]{7}$/;
export const STORAGE_KEY = "hikma20-transport-v1";
export const MAX_SEATS_PER_ORDER = 6;

const seed = (
  id: string,
  firstName: string,
  lastName: string,
  phone: string,
  neighborhood: string,
  pickupPointId: string,
  seats: number,
  tripType: Reservation["tripType"],
  busId: string,
  paymentMethod: Reservation["paymentMethod"],
  paymentStatus: Reservation["paymentStatus"],
  checkedIn: boolean,
  dayOffset: number,
): Reservation => {
  const created = new Date(Date.now() - dayOffset * 86400000).toISOString();
  return {
    id,
    reference: `HIKMA-20A-${1000 + dayOffset * 7}`,
    firstName,
    lastName,
    phone,
    neighborhood,
    pickupPointId,
    seats,
    tripType,
    busId,
    amount: (tripType === "aller-retour" ? 3000 : 2000) * seats,
    paymentMethod,
    paymentStatus,
    transactionId: paymentStatus === "paye" ? `TX-${id.toUpperCase()}-2025` : null,
    createdAt: created,
    paidAt: paymentStatus === "paye" ? created : null,
    checkedInAt: checkedIn ? created : null,
  };
};

export const DEFAULT_STATE: BookingState = {
  settings: {
    priceRoundTrip: 3000,
    priceOneWay: 2000,
    lockMinutes: 15,
    departureTime: "08:30",
    returnTime: "18:00",
    eventDate: "2025-06-15",
  },
  pickupPoints: [
    { id: "pp-liberte6", name: "Rond-point Liberté 6" },
    { id: "pp-patte-oie", name: "Patte d'Oie, arrêt principal" },
    { id: "pp-pikine", name: "Pikine Tally Boumack" },
    { id: "pp-guediawaye", name: "Guédiawaye Hamo 4" },
    { id: "pp-rufisque", name: "Rufisque Rond-Point" },
    { id: "pp-thiaroye", name: "Thiaroye Gare" },
  ],
  buses: [
    { id: "bus-1", label: "Bus 1", capacity: 50, status: "ouvert", departureTime: "08:30", returnTime: "18:00" },
    { id: "bus-2", label: "Bus 2", capacity: 50, status: "ouvert", departureTime: "09:00", returnTime: "18:30" },
    { id: "bus-3", label: "Bus 3", capacity: 50, status: "ouvert", departureTime: "09:30", returnTime: "19:00" },
  ],
  reservations: [
    seed("r1", "Aminata", "Diallo", "771234567", "Liberté 6", "pp-liberte6", 2, "aller-retour", "bus-1", "wave", "paye", true, 9),
    seed("r2", "Cheikh", "Ndiaye", "765432109", "Ouagou Niayes", "pp-patte-oie", 4, "aller-retour", "bus-1", "orange-money", "paye", false, 8),
    seed("r3", "Fatou", "Sow", "781122334", "Pikine", "pp-pikine", 1, "aller-simple", "bus-1", "especes", "en_attente", false, 7),
    seed("r4", "Moussa", "Fall", "701223344", "Guédiawaye", "pp-guediawaye", 3, "aller-retour", "bus-2", "wave", "paye", false, 6),
    seed("r5", "Awa", "Ba", "761122335", "Thiaroye", "pp-thiaroye", 2, "aller-simple", "bus-2", "orange-money", "paye", true, 5),
    seed("r6", "Ibrahima", "Sarr", "771122889", "Rufisque", "pp-rufisque", 5, "aller-retour", "bus-2", "especes", "en_attente", false, 4),
    seed("r7", "Khady", "Diop", "751122557", "Patte d'Oie", "pp-patte-oie", 2, "aller-retour", "bus-3", "wave", "paye", false, 3),
    seed("r8", "Ousmane", "Kane", "781122998", "Liberté 6", "pp-liberte6", 1, "aller-simple", "bus-3", "wave", "annule", false, 2),
    seed("r9", "Mariama", "Cissé", "701122441", "Pikine", "pp-pikine", 4, "aller-retour", "bus-3", "orange-money", "paye", false, 1),
  ],
};