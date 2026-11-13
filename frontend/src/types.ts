export type TripType = "ROUND_TRIP" | "ONE_WAY";
export type PaymentMethod = "WAVE" | "ORANGE_MONEY";
export type ReservationStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";

export interface BookingFormInput {
  firstName: string;
  lastName: string;
  phone: string;
  neighborhood: string;
  zoneId: string;
  pickupPointId: string;
  seats: number;
  tripType: TripType;
  paymentMethod: PaymentMethod;
}
