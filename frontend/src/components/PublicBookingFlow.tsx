import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  CircleNotch,
  CreditCard,
  MapPin,
  Minus,
  Phone,
  Plus,
  Ticket,
  User,
  Warning,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PHONE_REGEX } from "../constants";
import type { BookingFormInput, PaymentMethod, TripType } from "../types";
import { formatFcfa, priceFor, useConfig } from "../services/bookingStorage";
import * as api from "../services/api";
import type { ApiReservation } from "../services/api";

const PAY_METHODS: { id: PaymentMethod; label: string; hint: string; accent: string }[] = [
  { id: "WAVE", label: "Wave", hint: "Paiement instantané", accent: "from-[#1dc8f2] to-[#0a9ec9]" },
  { id: "ORANGE_MONEY", label: "Orange Money", hint: "#144# · USSD", accent: "from-[#ff7900] to-[#d96100]" },
];

const FIELD =
  "w-full rounded-xl border border-sagesse/20 bg-creme px-3 py-2.5 text-sm text-sagesse-deep outline-none focus:border-orange focus:ring-2 focus:ring-orange/25";
const EYEBROW = "mb-1 block text-[11px] font-semibold uppercase tracking-widest text-sagesse/70";

const STEPS = [
  { n: 1, label: "Identité", icon: User },
  { n: 2, label: "Trajet", icon: MapPin },
  { n: 3, label: "Paiement", icon: CreditCard },
];

function Stepper({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  return (
    <div className="mb-5 flex items-start">
      {STEPS.map(({ n, label, icon: Icon }, i) => (
        <div key={n} className="flex flex-1 items-start">
          <button
            type="button"
            onClick={() => n < step && setStep(n)}
            className={`flex flex-1 flex-col items-center gap-0.5 ${n < step ? "cursor-pointer" : "cursor-default"}`}
          >
            <span className={`grid size-8 place-items-center rounded-full text-[12px] font-bold transition-colors ${
              step === n ? "bg-sagesse text-creme shadow-sm" : step > n ? "bg-element/20 text-sagesse" : "bg-sagesse/10 text-sagesse/40"
            }`}>
              {step > n ? <span className="text-[11px]">✓</span> : <Icon size={14} weight="fill" />}
            </span>
            <span className={`text-[9.5px] font-semibold uppercase tracking-wide ${
              step === n ? "text-sagesse" : step > n ? "text-element" : "text-sagesse/30"
            }`}>{label}</span>
          </button>
          {i < 2 && (
            <div className={`mt-4 h-0.5 w-full max-w-[32px] rounded-full transition-colors ${
              step > n ? "bg-sagesse/40" : "bg-sagesse/10"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function PublicBookingFlow() {
  const { config } = useConfig();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateReservation, setDuplicateReservation] = useState<ApiReservation | null>(null);
  const [noBusError, setNoBusError] = useState<{ maxAvailable: number; zonesWithSeats: string[] } | null>(null);
  const [pendingExpiry, setPendingExpiry] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const [form, setForm] = useState<BookingFormInput>({
    firstName: "", lastName: "", phone: "", neighborhood: "",
    zoneId: "", pickupPointId: "", seats: 1, tripType: "ROUND_TRIP", paymentMethod: "WAVE",
  });

  useEffect(() => {
    if (!pendingExpiry) return;
    const tick = () => {
      const diff = Math.max(0, pendingExpiry.getTime() - Date.now());
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pendingExpiry]);

  const phoneValid = PHONE_REGEX.test(form.phone);
  const step1Valid = form.firstName.trim() !== "" && form.lastName.trim() !== "" && phoneValid;
  const selectedZone = config?.zones.find((z) => z.id === form.zoneId) ?? config?.zones[0];
  const zoneId = form.zoneId || selectedZone?.id || "";
  const pickupId = form.pickupPointId || selectedZone?.pickupPoints[0]?.id || "";
  const total = config ? priceFor(config, form.tripType, form.seats) : 0;

  const doSubmit = async (acknowledgeDuplicate = false) => {
    if (!config) return;
    setSubmitting(true);
    try {
      const { reservation } = await api.createReservation({
        ...form, zoneId, pickupPointId: pickupId, acknowledgeDuplicate,
      });
      const { paymentUrl } = await api.initiatePayment(reservation.id, form.paymentMethod);
      setPendingExpiry(new Date(reservation.expiresAt));
      sessionStorage.setItem("hikma-pending-ref", reservation.reference);
      window.location.href = paymentUrl;
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; maxAvailable?: number; zonesWithSeats?: string[]; existing?: ApiReservation };
      if (e.code === "DUPLICATE_RESERVATION") { setDuplicateReservation(e.existing ?? null); return; }
      if (e.code === "NO_BUS_AVAILABLE") { setNoBusError({ maxAvailable: e.maxAvailable ?? 0, zonesWithSeats: e.zonesWithSeats ?? [] }); return; }
      toast.error(e.message ?? "Réservation impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!config) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <CircleNotch size={32} className="animate-spin text-sagesse/40" />
      </div>
    );
  }

  if (noBusError) {
    const currentZoneName = config.zones.find((z) => z.id === zoneId)?.name ?? "cette zone";
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-3xl border border-orange/40 bg-orange/5 p-6 text-center">
          <Warning size={36} weight="fill" className="mx-auto text-orange" />
          <p className="mt-3 font-display text-xl font-bold text-sagesse-deep">
            {noBusError.maxAvailable === 0
              ? `Les bus de ${currentZoneName} sont complets.`
              : `Il ne reste que ${noBusError.maxAvailable} place(s) dans un même bus à ${currentZoneName}.`}
          </p>
          {noBusError.maxAvailable > 0 && (
            <p className="mt-1 text-[13px] text-muted-foreground">Réduisez le nombre de places ou choisissez une autre zone.</p>
          )}
          {noBusError.zonesWithSeats.length > 0 && (
            <p className="mt-2 text-[13px] font-semibold text-sagesse">
              Il reste des places à {noBusError.zonesWithSeats.join(" et ")}.
            </p>
          )}
          <div className="mt-4 grid gap-2">
            {noBusError.zonesWithSeats.map((zoneName) => {
              const z = config.zones.find((z) => z.name === zoneName);
              if (!z) return null;
              return (
                <button
                  key={z.id}
                  onClick={() => { setForm({ ...form, zoneId: z.id, pickupPointId: z.pickupPoints[0]?.id ?? "" }); setNoBusError(null); setStep(2); }}
                  className="press rounded-xl bg-sagesse px-4 py-3 text-sm font-bold text-creme"
                >
                  Choisir la zone {z.name}
                </button>
              );
            })}
            <button onClick={() => setNoBusError(null)} className="press rounded-xl border border-sagesse/25 px-4 py-3 text-sm font-semibold text-sagesse">
              Modifier ma réservation
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (duplicateReservation) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="font-display text-xl font-bold text-sagesse-deep">Réservation existante</p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Une réservation active existe déjà pour ce numéro (réf.{" "}
          <span className="font-mono font-semibold">{duplicateReservation.reference}</span>).
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={() => void doSubmit(true)} disabled={submitting}
            className="press rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            Réserver quand même
          </button>
          <button onClick={() => setDuplicateReservation(null)}
            className="press rounded-xl border border-sagesse/25 px-4 py-3 text-sm font-semibold text-sagesse">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="hikma-hero relative overflow-hidden px-5 py-5 text-creme">
        <div className="hikma-pattern absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-2xl">
          <h1 className="font-display text-2xl font-extrabold">Réserver mon bus</h1>
          <p className="mt-0.5 text-[13px] text-creme/70">{config.zones.length} zones · paiement Wave ou Orange Money</p>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <form onSubmit={(e) => { e.preventDefault(); void doSubmit(); }}
          className="rounded-3xl border border-or/35 bg-white/90 p-5 shadow-sm">
          <Stepper step={step} setStep={setStep} />

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={EYEBROW}>Prénom</span>
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="Aminata" autoComplete="given-name" className={FIELD} />
                </label>
                <label className="block">
                  <span className={EYEBROW}>Nom</span>
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Diallo" autoComplete="family-name" className={FIELD} />
                </label>
                <label className="block">
                  <span className={EYEBROW}>Téléphone (Sénégal)</span>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sagesse/50" />
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 9) })}
                      inputMode="numeric" autoComplete="tel-national" placeholder="771234567"
                      className={`w-full rounded-xl border bg-creme py-2.5 pl-9 pr-3 text-sm text-sagesse-deep outline-none focus:ring-2 ${
                        form.phone.length === 0 ? "border-sagesse/20 focus:border-orange focus:ring-orange/25"
                          : phoneValid ? "border-element/60 focus:ring-element/25"
                          : "border-destructive/50 focus:ring-destructive/20"
                      }`}
                    />
                  </div>
                  {form.phone.length > 0 && (
                    <span className={`mt-1 block text-[10.5px] font-semibold ${phoneValid ? "text-element" : "text-destructive"}`}>
                      {phoneValid ? "Numéro valide ✓" : "Format : 70/75/76/77/78 + 7 chiffres"}
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className={EYEBROW}>Quartier</span>
                  <input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                    placeholder="Liberté 6" autoComplete="address-level3" className={FIELD} />
                </label>
              </div>
              <button type="button" disabled={!step1Valid} onClick={() => setStep(2)}
                className="press mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sagesse px-4 py-3 text-sm font-bold text-creme disabled:opacity-40">
                Continuer <ArrowRight size={16} weight="bold" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
              <div className="mt-1">
                <span className={EYEBROW}>Zone de départ</span>
                <div className="grid grid-cols-2 gap-2">
                  {config.zones.map((zone) => {
                    const active = zoneId === zone.id;
                    return (
                      <button type="button" key={zone.id} disabled={zone.isFull}
                        onClick={() => setForm({ ...form, zoneId: zone.id, pickupPointId: zone.pickupPoints[0]?.id ?? "" })}
                        className={`press flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11.5px] font-semibold leading-tight disabled:opacity-40 ${
                          active ? "border-sagesse bg-sagesse text-creme" : "border-sagesse/20 bg-creme text-sagesse-deep"
                        }`}>
                        <span>{zone.name}</span>
                        <span className={`text-[10px] ${zone.isFull ? "text-orange" : active ? "text-creme/70" : "text-sagesse/50"}`}>
                          {zone.isFull ? "Complet" : `${zone.remainingSeats} pl.`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedZone && (
                <div className="mt-3">
                  <span className={EYEBROW}>Point de ramassage</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(config.zones.find((z) => z.id === zoneId) ?? selectedZone).pickupPoints.map((point) => {
                      const active = pickupId === point.id;
                      return (
                        <button type="button" key={point.id} onClick={() => setForm({ ...form, pickupPointId: point.id })}
                          className={`press flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11.5px] font-semibold leading-tight ${
                            active ? "border-sagesse bg-sagesse text-creme" : "border-sagesse/20 bg-creme text-sagesse-deep"
                          }`}>
                          <MapPin size={14} weight={active ? "fill" : "regular"} className="shrink-0" />
                          {point.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={EYEBROW}>Places</span>
                  <div className="flex items-center gap-2 rounded-xl border border-sagesse/20 bg-creme p-1.5">
                    <button type="button" onClick={() => setForm({ ...form, seats: Math.max(1, form.seats - 1) })}
                      className="press grid size-9 place-items-center rounded-lg bg-white text-sagesse shadow-sm" aria-label="Retirer une place">
                      <Minus size={16} weight="bold" />
                    </button>
                    <span className="flex-1 text-center font-display text-lg font-bold text-sagesse-deep">{form.seats}</span>
                    <button type="button" onClick={() => setForm({ ...form, seats: Math.min(config.maxSeatsPerOrder, form.seats + 1) })}
                      className="press grid size-9 place-items-center rounded-lg bg-white text-sagesse shadow-sm" aria-label="Ajouter une place">
                      <Plus size={16} weight="bold" />
                    </button>
                  </div>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">Max {config.maxSeatsPerOrder} · groupe jamais séparé</p>
                </div>
                <div>
                  <span className={EYEBROW}>Type de trajet</span>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: "ROUND_TRIP" as TripType, label: "Aller-retour", price: config.pricing.roundTripXof },
                      { id: "ONE_WAY" as TripType, label: "Aller simple", price: config.pricing.oneWayXof },
                    ]).map((trip) => {
                      const active = form.tripType === trip.id;
                      return (
                        <button type="button" key={trip.id} onClick={() => setForm({ ...form, tripType: trip.id })}
                          className={`press rounded-xl border px-2 py-2 text-[11.5px] font-semibold ${
                            active ? "border-orange bg-orange/10 text-orange" : "border-sagesse/20 bg-creme text-sagesse-deep"
                          }`}>
                          {trip.label}
                          <span className="mt-0.5 block text-[10px] font-normal opacity-80">{formatFcfa(trip.price)} / pers.</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setStep(1)}
                  className="press flex items-center gap-1.5 rounded-xl border border-sagesse/25 px-4 py-3 text-sm font-semibold text-sagesse">
                  <ArrowLeft size={15} weight="bold" />
                </button>
                <button type="button" onClick={() => setStep(3)}
                  className="press flex flex-1 items-center justify-center gap-2 rounded-xl bg-sagesse px-4 py-3 text-sm font-bold text-creme">
                  Continuer <ArrowRight size={16} weight="bold" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
              <div className="mb-3 rounded-2xl border border-sagesse/15 bg-creme/60 p-3 text-[12.5px]">
                <p className="font-semibold text-sagesse-deep">{form.firstName} {form.lastName}</p>
                <p className="text-muted-foreground">{form.phone} · {config.zones.find((z) => z.id === zoneId)?.name}</p>
                <p className="text-muted-foreground">
                  {form.seats} place(s) · {form.tripType === "ROUND_TRIP" ? "Aller-retour" : "Aller simple"}
                </p>
                <button type="button" onClick={() => setStep(1)}
                  className="mt-1 text-[11px] font-semibold text-sagesse underline underline-offset-2">
                  Modifier
                </button>
              </div>

              <span className={EYEBROW}>Moyen de paiement</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {PAY_METHODS.map((method) => {
                  const active = form.paymentMethod === method.id;
                  return (
                    <button type="button" key={method.id} onClick={() => setForm({ ...form, paymentMethod: method.id })}
                      className={`press rounded-xl border p-2.5 text-left ${
                        active ? "border-sagesse bg-sagesse/5 ring-1 ring-sagesse/30" : "border-sagesse/20 bg-creme"
                      }`}>
                      <span className="flex items-center gap-1.5 text-[12px] font-bold text-sagesse-deep">
                        <span className={`size-2.5 rounded-full bg-gradient-to-br ${method.accent}`} />
                        {method.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">{method.hint}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-creme px-4 py-3">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-widest text-sagesse/60">Total à payer</p>
                  <p className="font-display text-2xl font-extrabold text-sagesse-deep">{formatFcfa(total)}</p>
                </div>
                <p className="max-w-[45%] text-right text-[10.5px] leading-tight text-muted-foreground">
                  <CalendarBlank size={12} className="mb-0.5 inline" /> {config.event.venue}
                </p>
              </div>

              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setStep(2)}
                  className="press flex items-center gap-1.5 rounded-xl border border-sagesse/25 px-4 py-3 text-sm font-semibold text-sagesse">
                  <ArrowLeft size={15} weight="bold" />
                </button>
                <button type="submit" disabled={submitting}
                  className="press flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange/25 disabled:opacity-60">
                  {submitting ? <CircleNotch size={17} className="animate-spin" /> : <Ticket size={17} weight="fill" />}
                  Payer {formatFcfa(total)}
                  <ArrowRight size={16} weight="bold" />
                </button>
              </div>
              {countdown && (
                <p className="mt-2 text-center text-[11px] font-semibold text-orange">
                  ⏱ Places réservées pendant encore {countdown}
                </p>
              )}
            </motion.div>
          )}
        </form>
      </div>
    </div>
  );
}
