import { useSyncExternalStore } from "react";
import type { ApiConfig } from "./api";

export interface ConfigState {
  loaded: boolean;
  config: ApiConfig | null;
}

let configState: ConfigState = { loaded: false, config: null };
const configListeners = new Set<() => void>();

function notifyConfig() {
  configListeners.forEach((l) => l());
}

export function setConfig(config: ApiConfig) {
  configState = { loaded: true, config };
  notifyConfig();
}

export function getConfigState() {
  return configState;
}

export function subscribeConfig(fn: () => void) {
  configListeners.add(fn);
  return () => configListeners.delete(fn);
}

export function useConfig(): ConfigState {
  return useSyncExternalStore(subscribeConfig, getConfigState, getConfigState);
}

export function formatFcfa(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function priceFor(config: ApiConfig, tripType: "ROUND_TRIP" | "ONE_WAY", seats: number) {
  return (tripType === "ROUND_TRIP" ? config.pricing.roundTripXof : config.pricing.oneWayXof) * seats;
}

/** Clé localStorage pour la dernière réservation du participant (affichage hors connexion). */
export const LAST_RESERVATION_KEY = "hikma-last-reservation";
