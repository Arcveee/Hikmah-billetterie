export type ViewKey = "accueil" | "reserver" | "billet" | "admin";

export type BusStatus = "ouvert" | "complet" | "ferme";
export type TripType = "aller-retour" | "aller-simple";
export type PaymentMethod = "wave" | "orange-money" | "especes";
export type PaymentStatus = "en_attente" | "paye" | "annule";

export interface Bus {
  id: string;
  label: string;
  capacity: number;
  status: BusStatus;
  departureTime: string;
  returnTime: string;
}

export interface PickupPoint {
  id: string;
  name: string;
}

export interface Reservation {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  phone: string;
  neighborhood: string;
  pickupPointId: string;
  seats: number;
  tripType: TripType;
  busId: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId: string | null;
  createdAt: string;
  paidAt: string | null;
  checkedInAt: string | null;
}

export interface Settings {
  priceRoundTrip: number;
  priceOneWay: number;
  lockMinutes: number;
  departureTime: string;
  returnTime: string;
  eventDate: string;
}

export interface BookingState {
  buses: Bus[];
  reservations: Reservation[];
  pickupPoints: PickupPoint[];
  settings: Settings;
}

export interface BusFill extends Bus {
  taken: number;
  remaining: number;
  percent: number;
}

export interface AdminStats {
  reservationCount: number;
  seatsTaken: number;
  totalCapacity: number;
  paidCount: number;
  pendingCount: number;
  checkedIn: number;
  revenue: number;
  revenueWave: number;
  revenueOrange: number;
  revenueCash: number;
}

export interface BookingInput {
  firstName: string;
  lastName: string;
  phone: string;
  neighborhood: string;
  pickupPointId: string;
  seats: number;
  tripType: TripType;
  paymentMethod: PaymentMethod;
}