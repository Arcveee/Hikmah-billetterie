const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("hikma-admin-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? "Erreur réseau"), { code: data?.error?.code, status: res.status });
  return data as T;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
}

/* ── Types ── */

export interface ApiZone {
  id: string;
  name: string;
  displayOrder: number;
  pickupPoints: { id: string; name: string }[];
  remainingSeats: number;
  isFull: boolean;
}

export interface ApiConfig {
  event: { name: string; date: string; venue: string; whatsappContact: string };
  pricing: { roundTripXof: number; oneWayXof: number };
  maxSeatsPerOrder: number;
  zones: ApiZone[];
}

export interface ApiReservation {
  id: string;
  reference: string;
  publicToken: string;
  firstName: string;
  lastName: string;
  phone: string;
  neighborhood: string | null;
  zoneId: string;
  pickupPointId: string;
  seats: number;
  tripType: "ROUND_TRIP" | "ONE_WAY";
  busId: string;
  amountXof: number;
  paymentMethod: "WAVE" | "ORANGE_MONEY" | "CASH";
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  paidAt: string | null;
  checkedInAt: string | null;
  refundRequired?: boolean;
  zone?: { name: string };
  bus?: { label: string; departureTime: string; arrivalTime: string; returnTime: string | null; returnLocation: string | null };
  pickupPoint?: { name: string };
}

export interface ApiBus {
  id: string;
  zoneId: string;
  zoneName: string;
  number: number;
  label: string;
  capacity: number;
  isOpen: boolean;
  departureTime: string;
  arrivalTime: string;
  returnTime: string | null;
  returnLocation: string | null;
  seatsTaken: number;
  remainingSeats: number;
}

export interface ApiAdminZone {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ApiSettings {
  id: number;
  eventName: string;
  eventDate: string;
  venue: string;
  priceRoundTripXof: number;
  priceOneWayXof: number;
  lockMinutes: number;
  maxSeatsPerOrder: number;
  whatsappContact: string;
}

export interface ApiStats {
  global: {
    total: number;
    paid: number;
    pending: number;
    seatsTaken: number;
    revenue: number;
    revenueWave: number;
    revenueOrangeMoney: number;
    revenueCash: number;
  };
  byZone: {
    zoneId: string;
    zoneName: string;
    total: number;
    paid: number;
    seatsTaken: number;
    remainingSeats: number;
    totalBuses: number;
    fullBuses: number;
  }[];
}

export interface ApiPickupPoint {
  id: string;
  zoneId: string;
  name: string;
  isActive: boolean;
  zone?: { name: string };
}

/* ── Public ── */

export function getConfig() {
  return request<ApiConfig>("/public/config");
}

export function createReservation(body: {
  firstName: string;
  lastName: string;
  phone: string;
  neighborhood?: string;
  zoneId: string;
  pickupPointId: string;
  seats: number;
  tripType: "ROUND_TRIP" | "ONE_WAY";
  paymentMethod: "WAVE" | "ORANGE_MONEY";
  acknowledgeDuplicate?: boolean;
}) {
  return request<{ reservation: ApiReservation }>("/reservations", { method: "POST", body: JSON.stringify(body) });
}

export function initiatePayment(reservationId: string, paymentMethod: "WAVE" | "ORANGE_MONEY") {
  return request<{ paymentUrl: string; chargeId: string }>(`/reservations/${reservationId}/pay`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod }),
  });
}

export function getReservationStatus(reference: string) {
  return request<{ reservation: ApiReservation }>(`/reservations/${reference}/status`);
}

export function lookupReservation(reference: string, phone: string) {
  const params = new URLSearchParams({ reference, phone });
  return request<{ reservation: ApiReservation }>(`/reservations/lookup?${params}`);
}

/* ── Admin auth ── */

export function adminLogin(username: string, password: string) {
  return request<{ token: string; admin: { id: string; username: string } }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function adminMe() {
  return authRequest<{ admin: { id: string; username: string } }>("/admin/me");
}

/* ── Admin stats ── */

export function getStats() {
  return authRequest<ApiStats>("/admin/stats");
}

/* ── Admin zones ── */

export function getAdminZones() {
  return authRequest<{ zones: ApiAdminZone[] }>("/admin/zones");
}

export function createZone(body: { name: string; displayOrder: number }) {
  return authRequest<{ zone: ApiAdminZone }>("/admin/zones", { method: "POST", body: JSON.stringify(body) });
}

export function updateZone(id: string, body: Partial<{ name: string; displayOrder: number; isActive: boolean }>) {
  return authRequest<{ zone: ApiAdminZone }>(`/admin/zones/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

/* ── Admin buses ── */

export function getAdminBuses(zoneId?: string) {
  const q = zoneId ? `?zoneId=${zoneId}` : "";
  return authRequest<{ buses: ApiBus[] }>(`/admin/buses${q}`);
}

export function createBus(body: {
  zoneId: string;
  capacity: number;
  departureTime: string;
  arrivalTime: string;
  returnTime?: string;
  returnLocation?: string;
}) {
  return authRequest<{ bus: ApiBus }>("/admin/buses", { method: "POST", body: JSON.stringify(body) });
}

export function bulkCreateBuses(body: {
  zoneId: string;
  count: number;
  capacity: number;
  departureTime: string;
  arrivalTime: string;
  returnTime?: string;
  returnLocation?: string;
}) {
  return authRequest<{ buses: ApiBus[]; count: number }>("/admin/buses/bulk", { method: "POST", body: JSON.stringify(body) });
}

export function updateBus(id: string, body: Partial<{ capacity: number; isOpen: boolean; departureTime: string; arrivalTime: string; returnTime: string | null; returnLocation: string | null }>) {
  return authRequest<{ bus: ApiBus }>(`/admin/buses/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteBus(id: string) {
  return authRequest<void>(`/admin/buses/${id}`, { method: "DELETE" });
}

/* ── Admin reservations ── */

export interface ReservationFilters {
  page?: number;
  limit?: number;
  zoneId?: string;
  busId?: string;
  status?: string;
  paymentMethod?: string;
  pickupPointId?: string;
  search?: string;
}

export function getAdminReservations(filters: ReservationFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
  return authRequest<{ reservations: ApiReservation[]; total: number; page: number; limit: number; pages: number }>(`/admin/reservations?${params}`);
}

export function cancelReservation(id: string) {
  return authRequest<{ reservation: ApiReservation }>(`/admin/reservations/${id}/cancel`, { method: "POST" });
}

export function moveReservation(id: string, busId: string, confirmCrossZone = false) {
  return authRequest<{ reservation: ApiReservation }>(`/admin/reservations/${id}/move`, {
    method: "POST",
    body: JSON.stringify({ busId, confirmCrossZone }),
  });
}

export function markPaidCash(id: string) {
  return authRequest<{ reservation: ApiReservation }>(`/admin/reservations/${id}/mark-paid`, { method: "POST" });
}

export function checkIn(reference: string) {
  return authRequest<{ ok: boolean; message: string; reservation: ApiReservation }>("/admin/checkin", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
}

export function getRefunds() {
  return authRequest<{ reservations: ApiReservation[] }>("/admin/refunds");
}

/* ── Admin settings ── */

export function getSettings() {
  return authRequest<{ settings: ApiSettings }>("/admin/settings");
}

export function updateSettings(body: Partial<Omit<ApiSettings, "id">>) {
  return authRequest<{ settings: ApiSettings }>("/admin/settings", { method: "PATCH", body: JSON.stringify(body) });
}

/* ── Admin pickup points ── */

export function getPickupPoints(zoneId?: string) {
  const q = zoneId ? `?zoneId=${zoneId}` : "";
  return authRequest<{ pickupPoints: ApiPickupPoint[] }>(`/admin/pickup-points${q}`);
}

export function createPickupPoint(body: { zoneId: string; name: string }) {
  return authRequest<{ pickupPoint: ApiPickupPoint }>("/admin/pickup-points", { method: "POST", body: JSON.stringify(body) });
}

export function updatePickupPoint(id: string, body: Partial<{ name: string; isActive: boolean }>) {
  return authRequest<{ pickupPoint: ApiPickupPoint }>(`/admin/pickup-points/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deletePickupPoint(id: string) {
  return authRequest<void>(`/admin/pickup-points/${id}`, { method: "DELETE" });
}

/* ── Exports ── */

export function exportPassengersXlsx(zoneId?: string) {
  const q = zoneId ? `?zoneId=${zoneId}` : "";
  const token = sessionStorage.getItem("hikma-admin-token");
  const url = `${BASE}/admin/export/passengers.xlsx${q}`;
  const a = document.createElement("a");
  a.href = url;
  // Ajouter le token via fetch blob pour les navigateurs qui ne supportent pas les headers sur <a>
  void fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      a.href = URL.createObjectURL(blob);
      a.download = "passagers.xlsx";
      a.click();
    });
}

export function exportPassengersPdf(zoneId?: string) {
  const q = zoneId ? `?zoneId=${zoneId}` : "";
  const token = sessionStorage.getItem("hikma-admin-token");
  const url = `${BASE}/admin/export/passengers.pdf${q}`;
  void fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "passagers.pdf";
      a.click();
    });
}
