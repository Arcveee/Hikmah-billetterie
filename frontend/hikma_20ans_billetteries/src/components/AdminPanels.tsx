import { useState } from "react";
import {
  ArrowClockwise,
  Clock,
  LockKey,
  MapPin,
  Minus,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BRAND } from "../constants";
import {
  addBus,
  addPickupPoint,
  busFills,
  removePickupPoint,
  resetStore,
  updateBus,
  updateSettings,
  useBookings,
} from "../services/bookingStorage";

export const CARD = "rounded-2xl border border-or/25 bg-white p-4";
export const IN =
  "w-full rounded-xl border border-sagesse/20 bg-creme px-3 py-2.5 text-[12.5px] font-semibold text-sagesse-deep outline-none focus:border-orange focus:ring-2 focus:ring-orange/20";
export const EYE = "mb-1 block text-[10.5px] font-semibold uppercase tracking-widest text-sagesse/70";
export const TITLE = "flex items-center gap-1.5 font-display text-base font-bold text-sagesse-deep";

export function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim().toUpperCase() === BRAND.adminCode) {
            sessionStorage.setItem("hikma-admin", "1");
            toast.success("Bienvenue dans l'espace Transport.");
            onUnlock();
          } else toast.error("Code d'accès invalide.");
        }}
        className="rounded-3xl border border-or/40 bg-white p-6 shadow-lg"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-sagesse text-or">
          <LockKey size={24} weight="fill" />
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold text-sagesse-deep">Espace Commission Transport</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Accès réservé. Code fourni par le bureau.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code d'accès"
          className="mt-4 w-full rounded-xl border border-sagesse/20 bg-creme px-3 py-3 text-center font-mono text-lg uppercase tracking-[0.3em] outline-none focus:border-orange focus:ring-2 focus:ring-orange/25"
        />
        <button type="submit" className="press mt-3 w-full rounded-xl bg-sagesse px-4 py-3 text-sm font-bold text-creme">
          Déverrouiller l'espace
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Démo : <span className="font-mono font-bold">{BRAND.adminCode}</span>
        </p>
      </motion.form>
    </div>
  );
}

export function BusPanel() {
  const state = useBookings();
  const fills = busFills(state);
  return (
    <div className="mt-4 space-y-2">
      <button
        onClick={() => {
          addBus();
          toast.success("Nouveau bus ouvert.");
        }}
        className="press flex items-center gap-1.5 rounded-xl bg-sagesse px-3 py-2.5 text-[12.5px] font-bold text-creme"
      >
        <Plus size={15} weight="bold" /> Ouvrir un bus supplémentaire
      </button>
      {fills.map((b) => (
        <div key={b.id} className="rounded-2xl border border-or/25 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-[15px] font-bold text-sagesse-deep">{b.label}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock size={11} /> {b.departureTime} → {b.returnTime} · {b.remaining} libre(s)
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                b.status === "complet"
                  ? "bg-orange/15 text-orange"
                  : b.status === "ferme"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-element/15 text-sagesse"
              }`}
            >
              {b.status === "complet" ? "Complet" : b.status === "ferme" ? "Fermé" : "Ouvert"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${b.status === "complet" ? "bg-orange" : "bg-element"}`}
              style={{ width: `${b.percent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-lg border border-sagesse/20 bg-creme px-2 py-1">
              <span className="text-[10.5px] font-semibold text-sagesse/70">Cap.</span>
              <button
                onClick={() => updateBus(b.id, { capacity: Math.max(b.taken, b.capacity - 5) })}
                aria-label="Réduire la capacité"
                className="press grid size-6 place-items-center rounded bg-white text-sagesse"
              >
                <Minus size={12} weight="bold" />
              </button>
              <span className="w-7 text-center text-[11.5px] font-bold text-sagesse-deep">{b.capacity}</span>
              <button
                onClick={() => updateBus(b.id, { capacity: b.capacity + 5 })}
                aria-label="Augmenter la capacité"
                className="press grid size-6 place-items-center rounded bg-white text-sagesse"
              >
                <Plus size={12} weight="bold" />
              </button>
            </div>
            <input
              type="time"
              value={b.departureTime}
              onChange={(e) => updateBus(b.id, { departureTime: e.target.value })}
              className="rounded-lg border border-sagesse/20 bg-creme px-2 py-1.5 text-[11px] font-semibold text-sagesse-deep"
            />
            <button
              onClick={() => updateBus(b.id, { status: b.status === "ferme" ? "ouvert" : "ferme" })}
              className="press rounded-lg border border-sagesse/25 px-2.5 py-1.5 text-[11px] font-semibold text-sagesse"
            >
              {b.status === "ferme" ? "Réouvrir" : "Fermer"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsPanel() {
  const state = useBookings();
  const [point, setPoint] = useState("");
  const fields = [
    { k: "priceRoundTrip" as const, l: "Aller-retour (FCFA)", t: "number" },
    { k: "priceOneWay" as const, l: "Aller simple (FCFA)", t: "number" },
    { k: "lockMinutes" as const, l: "Blocage place (min)", t: "number" },
    { k: "departureTime" as const, l: "Départ", t: "time" },
    { k: "returnTime" as const, l: "Retour", t: "time" },
  ];

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className={CARD}>
        <h3 className="font-display text-base font-bold text-sagesse-deep">Tarifs & horaires</h3>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {fields.map((f) => (
            <label key={f.k} className="block">
              <span className={EYE}>{f.l}</span>
              <input
                type={f.t}
                value={state.settings[f.k]}
                onChange={(e) =>
                  updateSettings(f.t === "number" ? { [f.k]: Number(e.target.value) } : { [f.k]: e.target.value })
                }
                className={IN}
              />
            </label>
          ))}
        </div>
        <button
          onClick={() => {
            if (confirm("Réinitialiser toutes les données de démonstration ?")) {
              resetStore();
              toast.success("Données réinitialisées.");
            }
          }}
          className="press mt-3 flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-[12px] font-semibold text-destructive"
        >
          <ArrowClockwise size={14} weight="bold" /> Réinitialiser les données
        </button>
      </div>
      <div className={CARD}>
        <h3 className={TITLE}>
          <MapPin size={16} weight="fill" className="text-orange" /> Points de ramassage
        </h3>
        <div className="mt-2 space-y-1.5">
          {state.pickupPoints.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-creme px-2.5 py-2 text-[12px] font-semibold text-sagesse-deep"
            >
              {p.name}
              <button
                onClick={() => removePickupPoint(p.id)}
                className="press text-destructive"
                aria-label={`Supprimer ${p.name}`}
              >
                <Trash size={14} weight="bold" />
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!point.trim()) return;
            addPickupPoint(point);
            setPoint("");
            toast.success("Point de ramassage ajouté.");
          }}
          className="mt-2 flex gap-2"
        >
          <input value={point} onChange={(e) => setPoint(e.target.value)} placeholder="Nouveau point" className={IN} />
          <button type="submit" className="press rounded-xl bg-sagesse px-3 py-2 text-[12px] font-bold text-creme">
            <Plus size={14} weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
}