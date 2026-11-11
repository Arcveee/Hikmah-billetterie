import { useSyncExternalStore } from "react";
import { DEFAULT_STATE, STORAGE_KEY, PHONE_REGEX, MAX_SEATS_PER_ORDER } from "../constants";
import type {
  AdminStats,
  BookingInput,
  BookingState,
  Bus,
  BusFill,
  PaymentMethod,
  Reservation,
  Settings,
} from "../types";

let state: BookingState = load();
const listeners = new Set<() => void>();

function load(): BookingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as BookingState;
    if (!parsed.buses?.length || !parsed.settings) return structuredClone(DEFAULT_STATE);
    return parsed;
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function commit(next: BookingState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota ignore */
  }
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useBookings(): BookingState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function resetStore() {
  commit(structuredClone(DEFAULT_STATE));
}

/* ----------------------------- derived helpers ---------------------------- */

export function busFills(s: BookingState = state): BusFill[] {
  return s.buses.map((bus) => {
    const taken = s.reservations
      .filter((r) => r.busId === bus.id && r.paymentStatus !== "annule")
      .reduce((sum, r) => sum + r.seats, 0);
    const remaining = Math.max(0, bus.capacity - taken);
    return {
      ...bus,
      taken,
      remaining,
      percent: bus.capacity === 0 ? 0 : Math.min(100, Math.round((taken / bus.capacity) * 100)),
    };
  });
}

export function activeBus(s: BookingState = state): BusFill | undefined {
  return busFills(s).find((b) => b.status === "ouvert" && b.remaining > 0);
}

export function totalSeats(s: BookingState = state) {
  return busFills(s).reduce((acc, b) => acc + b.taken, 0);
}

export function totalCapacity(s: BookingState = state) {
  return s.buses.filter((b) => b.status !== "ferme").reduce((acc, b) => acc + b.capacity, 0);
}

export function priceFor(s: BookingState, tripType: Reservation["tripType"], seats: number) {
  const unit = tripType === "aller-retour" ? s.settings.priceRoundTrip : s.settings.priceOneWay;
  return unit * seats;
}

export function pickupName(s: BookingState, id: string) {
  return s.pickupPoints.find((p) => p.id === id)?.name ?? "Point à confirmer";
}

export function busLabel(s: BookingState, id: string | null) {
  return s.buses.find((b) => b.id === id)?.label ?? "Non affecté";
}

export function computeStats(s: BookingState = state): AdminStats {
  const valid = s.reservations.filter((r) => r.paymentStatus !== "annule");
  const paid = valid.filter((r) => r.paymentStatus === "paye");
  const revenueOf = (m: PaymentMethod) =>
    paid.filter((r) => r.paymentMethod === m).reduce((sum, r) => sum + r.amount, 0);
  return {
    reservationCount: valid.length,
    seatsTaken: valid.reduce((sum, r) => sum + r.seats, 0),
    totalCapacity: totalCapacity(s),
    paidCount: paid.length,
    pendingCount: valid.filter((r) => r.paymentStatus === "en_attente").length,
    checkedIn: valid.filter((r) => r.checkedInAt).length,
    revenue: paid.reduce((sum, r) => sum + r.amount, 0),
    revenueWave: revenueOf("wave"),
    revenueOrange: revenueOf("orange-money"),
    revenueCash: revenueOf("especes"),
  };
}

/* ------------------------------- mutations -------------------------------- */

function makeReference(s: BookingState) {
  let ref = "";
  do {
    ref = `HIKMA-20A-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (s.reservations.some((r) => r.reference === ref));
  return ref;
}

/** Remplissage séquentiel + règle anti-scission : jamais de groupe divisé. */
export function assignBus(s: BookingState, seats: number): { buses: Bus[]; busId: string } {
  const ordered = [...s.buses].sort((a, b) => a.label.localeCompare(b.label, "fr"));
  const fits = busFills(s)
    .filter((b) => b.status === "ouvert")
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
    .find((b) => b.remaining >= seats);
  if (fits) return { buses: ordered, busId: fits.id };

  // Aucun bus ne peut accueillir le groupe entier : ouverture d'un bus supplémentaire.
  const nextNumber = ordered.length + 1;
  const newBus: Bus = {
    id: `bus-${Date.now()}`,
    label: `Bus ${nextNumber}`,
    capacity: Math.max(50, seats),
    status: "ouvert",
    departureTime: s.settings.departureTime,
    returnTime: s.settings.returnTime,
  };
  return { buses: [...ordered, newBus], busId: newBus.id };
}

function refreshBusStatuses(buses: Bus[], reservations: Reservation[]): Bus[] {
  return buses.map((bus) => {
    if (bus.status === "ferme") return bus;
    const taken = reservations
      .filter((r) => r.busId === bus.id && r.paymentStatus !== "annule")
      .reduce((sum, r) => sum + r.seats, 0);
    return { ...bus, status: taken >= bus.capacity ? "complet" : "ouvert" };
  });
}

export function createReservation(input: BookingInput): { ok: boolean; reservation?: Reservation; error?: string } {
  if (!PHONE_REGEX.test(input.phone)) {
    return { ok: false, error: "Numéro sénégalais invalide (ex. 77 123 45 67)." };
  }
  if (!input.firstName.trim() || !input.lastName.trim()) {
    return { ok: false, error: "Le nom et le prénom sont obligatoires." };
  }
  if (input.seats < 1 || input.seats > MAX_SEATS_PER_ORDER) {
    return { ok: false, error: `Entre 1 et ${MAX_SEATS_PER_ORDER} places par réservation.` };
  }
  if (!input.pickupPointId) {
    return { ok: false, error: "Choisissez un point de ramassage." };
  }

  const { buses, busId } = assignBus(state, input.seats);
  const amount = priceFor({ ...state, buses }, input.tripType, input.seats);
  const reservation: Reservation = {
    id: `res-${Date.now()}`,
    reference: makeReference(state),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone,
    neighborhood: input.neighborhood.trim(),
    pickupPointId: input.pickupPointId,
    seats: input.seats,
    tripType: input.tripType,
    busId,
    amount,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentMethod === "especes" ? "en_attente" : "en_attente",
    transactionId: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
    checkedInAt: null,
  };

  const reservations = [reservation, ...state.reservations];
  commit({ ...state, buses: refreshBusStatuses(buses, reservations), reservations });
  return { ok: true, reservation };
}

/** Paiement idempotent : un second appel sur une réservation payée ne crée pas de doublon. */
export function confirmPayment(id: string, method?: PaymentMethod): { ok: boolean; reservation?: Reservation } {
  const target = state.reservations.find((r) => r.id === id);
  if (!target) return { ok: false };
  if (target.paymentStatus === "paye") return { ok: true, reservation: target };

  const reservation: Reservation = {
    ...target,
    paymentMethod: method ?? target.paymentMethod,
    paymentStatus: "paye",
    paidAt: new Date().toISOString(),
    transactionId: target.transactionId ?? `TX-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
  };
  const reservations = state.reservations.map((r) => (r.id === id ? reservation : r));
  commit({ ...state, reservations, buses: refreshBusStatuses(state.buses, reservations) });
  return { ok: true, reservation };
}

export function cancelReservation(id: string) {
  const reservations = state.reservations.map((r) =>
    r.id === id ? { ...r, paymentStatus: "annule" as const } : r,
  );
  commit({ ...state, reservations, buses: refreshBusStatuses(state.buses, reservations) });
}

export function moveReservation(id: string, busId: string) {
  const reservations = state.reservations.map((r) => (r.id === id ? { ...r, busId } : r));
  commit({ ...state, reservations, buses: refreshBusStatuses(state.buses, reservations) });
}

export function checkIn(reference: string): { ok: boolean; message: string; reservation?: Reservation } {
  const key = reference.trim().toUpperCase();
  const target = state.reservations.find(
    (r) => r.reference.toUpperCase() === key || r.phone === key.replace(/\s/g, ""),
  );
  if (!target) return { ok: false, message: "Référence introuvable." };
  if (target.paymentStatus === "annule") return { ok: false, message: "Réservation annulée." };
  if (target.paymentStatus !== "paye") return { ok: false, message: "Paiement non confirmé." };
  if (target.checkedInAt) return { ok: false, message: "Billet déjà validé.", reservation: target };
  const reservation = { ...target, checkedInAt: new Date().toISOString() };
  commit({ ...state, reservations: state.reservations.map((r) => (r.id === target.id ? reservation : r)) });
  return { ok: true, message: `Bienvenue ${target.firstName} !`, reservation };
}

export function addBus() {
  const number = state.buses.length + 1;
  const bus: Bus = {
    id: `bus-${Date.now()}`,
    label: `Bus ${number}`,
    capacity: 50,
    status: "ouvert",
    departureTime: state.settings.departureTime,
    returnTime: state.settings.returnTime,
  };
  commit({ ...state, buses: [...state.buses, bus] });
}

export function updateBus(id: string, patch: Partial<Bus>) {
  const buses = state.buses.map((b) => (b.id === id ? { ...b, ...patch } : b));
  commit({ ...state, buses: refreshBusStatuses(buses, state.reservations) });
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

export function addPickupPoint(name: string) {
  if (!name.trim()) return;
  commit({
    ...state,
    pickupPoints: [...state.pickupPoints, { id: `pp-${Date.now()}`, name: name.trim() }],
  });
}

export function removePickupPoint(id: string) {
  commit({ ...state, pickupPoints: state.pickupPoints.filter((p) => p.id !== id) });
}

export function findByReference(phone: string, reference: string) {
  const p = phone.replace(/\s/g, "");
  const r = reference.trim().toUpperCase();
  return state.reservations.find((x) => x.phone === p && x.reference.toUpperCase() === r);
}

/* --------------------------------- exports -------------------------------- */

export function reservationsCsv(s: BookingState = state) {
  const head = [
    "Reference",
    "Nom",
    "Prenom",
    "Telephone",
    "Quartier",
    "Point de ramassage",
    "Bus",
    "Places",
    "Trajet",
    "Montant FCFA",
    "Paiement",
    "Statut",
    "Embarque",
  ];
  const rows = s.reservations.map((r) => [
    r.reference,
    r.lastName,
    r.firstName,
    r.phone,
    r.neighborhood,
    pickupName(s, r.pickupPointId),
    busLabel(s, r.busId),
    String(r.seats),
    r.tripType,
    String(r.amount),
    r.paymentMethod,
    r.paymentStatus,
    r.checkedInAt ? "oui" : "non",
  ]);
  return [head, ...rows].map((line) => line.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join(String.fromCharCode(10));
}

export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([`﻿${content}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------- QR pattern ------------------------------- */

/** Matrice type QR déterministe à partir de la référence du billet. */
export function qrMatrix(seedText: string, size = 25): boolean[][] {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const grid: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const inFinder = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c > size - 9) || (r > size - 9 && c < 8);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!inFinder(r, c)) grid[r][c] = rand() > 0.52;
    }
  }
  const finder = (row: number, col: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const edge = i === 0 || i === 6 || j === 0 || j === 6;
        const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        grid[row + i][col + j] = edge || core;
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  return grid;
}

export function formatFcfa(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}