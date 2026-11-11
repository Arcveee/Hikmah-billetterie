import { useState } from "react";
import {
  ArrowRight,
  Bus,
  CalendarBlank,
  Clock,
  Feather,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  Sparkle,
  Star,
  Ticket,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BRAND, MAX_SEATS_PER_ORDER, PHONE_REGEX } from "../constants";
import type { BookingInput, PaymentMethod, Reservation, TripType } from "../types";
import {
  activeBus,
  busFills,
  createReservation,
  formatFcfa,
  priceFor,
  useBookings,
} from "../services/bookingStorage";
import { PaymentPanel, TicketSuccess } from "./TicketCard";

const PAY_METHODS: { id: PaymentMethod; label: string; hint: string; accent: string }[] = [
  { id: "wave", label: "Wave", hint: "Paiement instantané", accent: "from-[#1dc8f2] to-[#0a9ec9]" },
  { id: "orange-money", label: "Orange Money", hint: "#144# · USSD", accent: "from-[#ff7900] to-[#d96100]" },
  { id: "especes", label: "Espèces", hint: "Au point de ramassage", accent: "from-sagesse to-sagesse-deep" },
];

const FIELD =
  "w-full rounded-xl border border-sagesse/20 bg-creme px-3 py-2.5 text-sm text-sagesse-deep outline-none focus:border-orange focus:ring-2 focus:ring-orange/25";
const EYEBROW = "mb-1 block text-[11px] font-semibold uppercase tracking-widest text-sagesse/70";

function Hero() {
  const state = useBookings();
  const fills = busFills(state);
  const next = activeBus(state);
  const seats = fills.reduce((acc, b) => acc + b.remaining, 0);
  const stats = [
    { icon: MapPin, label: BRAND.venue, sub: BRAND.departure },
    { icon: Bus, label: `${fills.length} bus`, sub: `${seats} places libres` },
    { icon: Clock, label: `Départ ${next?.departureTime ?? state.settings.departureTime}`, sub: "Retour groupé" },
    { icon: ShieldCheck, label: "Paiement sûr", sub: "Wave · Orange Money" },
  ];

  return (
    <section className="hikma-hero relative overflow-hidden text-creme">
      <div className="hikma-pattern absolute inset-0 opacity-50" />
      <div className="absolute -right-16 -top-16 size-56 rounded-full border border-or/30" />
      <div className="absolute -left-10 bottom-0 size-40 rounded-full bg-orange/20 blur-2xl" />
      <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-8 sm:pt-12">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-or/50 bg-or/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-or-clair"
        >
          <Star size={12} weight="fill" /> {BRAND.edition} · {BRAND.name}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
          className="mt-4 max-w-2xl font-display text-[30px] font-extrabold leading-[1.08] sm:text-5xl"
        >
          Cap sur <span className="text-or-clair">Dakar Arena</span>
          <br />
          <span className="text-creme/90">pour les 20 ans d'Hikma</span>
        </motion.h1>

        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-creme/85 sm:text-base">
          Réservez votre place dans les bus officiels de la Maison de la Sagesse.{" "}
          <span className="font-semibold text-or-clair">« {BRAND.slogan} »</span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-creme/15 bg-creme/10 px-3 py-2.5 backdrop-blur-sm">
                <ItemIcon size={16} weight="fill" className="text-or-clair" />
                <p className="mt-1.5 text-[12px] font-semibold leading-tight">{item.label}</p>
                <p className="text-[10px] uppercase tracking-wide text-creme/60">{item.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-or/30 bg-sagesse-deep/40 p-3.5 backdrop-blur">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-or-clair">
            <Sparkle size={13} weight="fill" /> Remplissage en direct
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {fills.map((bus) => (
              <div key={bus.id} className="rounded-xl bg-creme/10 px-3 py-2">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>{bus.label}</span>
                  <span className={bus.status === "complet" ? "text-orange" : "text-or-clair"}>
                    {bus.taken}/{bus.capacity}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-creme/20">
                  <div
                    className={`h-full rounded-full ${bus.status === "complet" ? "bg-orange" : "bg-or-clair"}`}
                    style={{ width: `${bus.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PublicBookingFlow({
  onViewTicket,
}: {
  onViewTicket?: () => void;
}) {
  const state = useBookings();
  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [pending, setPending] = useState<Reservation | null>(null);
  const [paid, setPaid] = useState<Reservation | null>(null);
  const [form, setForm] = useState<BookingInput>({
    firstName: "",
    lastName: "",
    phone: "",
    neighborhood: "",
    pickupPointId: state.pickupPoints[0]?.id ?? "",
    seats: 1,
    tripType: "aller-retour",
    paymentMethod: "wave",
  });

  const phoneValid = PHONE_REGEX.test(form.phone);
  const total = priceFor(state, form.tripType, form.seats);
  const pickupId = form.pickupPointId || state.pickupPoints[0]?.id || "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Merci de renseigner votre nom et prénom.");
      return;
    }
    if (!phoneValid) {
      toast.error("Numéro sénégalais invalide : 7X XXX XX XX.");
      return;
    }
    const res = createReservation({ ...form, pickupPointId: pickupId });
    if (!res.ok || !res.reservation) {
      toast.error(res.error ?? "Réservation impossible.");
      return;
    }
    const created = res.reservation;
    if (created.paymentMethod === "especes") {
      setPaid(created);
      setStep("done");
      toast.success(`Place réservée ! Réf. ${created.reference} — à régler en espèces.`);
      return;
    }
    setPending(created);
    setStep("payment");
  };

  if (step === "done" && paid) {
    return (
      <TicketSuccess
        reservation={paid}
        onReset={() => {
          setStep("form");
          setPending(null);
          setPaid(null);
          setForm((f) => ({ ...f, firstName: "", lastName: "", phone: "", seats: 1 }));
        }}
        onViewTicket={onViewTicket}
      />
    );
  }

  if (step === "payment" && pending) {
    return (
      <PaymentPanel
        reservation={pending}
        onBack={() => setStep("form")}
        onPaid={(r) => {
          setPaid(r);
          setStep("done");
        }}
      />
    );
  }

  return (
    <div>
      <Hero />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <form onSubmit={submit} className="rounded-3xl border border-or/35 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-sagesse-deep">
              <Ticket size={20} weight="fill" className="text-orange" /> Réserver mes places
            </h2>
            <span className="rounded-full bg-or/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-sagesse">
              {BRAND.edition}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Départ {state.settings.departureTime} · Retour {state.settings.returnTime} · {state.pickupPoints.length} points de ramassage
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={EYEBROW}>Prénom</span>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Aminata"
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={EYEBROW}>Nom</span>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Diallo"
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={EYEBROW}>Téléphone (Sénégal)</span>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sagesse/50" />
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 9) })
                  }
                  inputMode="numeric"
                  placeholder="771234567"
                  className={`w-full rounded-xl border bg-creme py-2.5 pl-9 pr-3 text-sm text-sagesse-deep outline-none focus:ring-2 ${
                    form.phone.length === 0
                      ? "border-sagesse/20 focus:border-orange focus:ring-orange/25"
                      : phoneValid
                        ? "border-element/60 focus:ring-element/25"
                        : "border-destructive/50 focus:ring-destructive/20"
                  }`}
                />
              </div>
              {form.phone.length > 0 && (
                <span className={`mt-1 block text-[10.5px] font-semibold ${phoneValid ? "text-element" : "text-destructive"}`}>
                  {phoneValid ? "Numéro valide" : "Format attendu : 70/75/76/77/78 + 7 chiffres"}
                </span>
              )}
            </label>
            <label className="block">
              <span className={EYEBROW}>Quartier</span>
              <input
                value={form.neighborhood}
                onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                placeholder="Liberté 6"
                className={FIELD}
              />
            </label>
          </div>

          <div className="mt-3">
            <span className={EYEBROW}>Point de ramassage</span>
            <div className="grid grid-cols-2 gap-2">
              {state.pickupPoints.map((point) => {
                const active = pickupId === point.id;
                return (
                  <button
                    type="button"
                    key={point.id}
                    onClick={() => setForm({ ...form, pickupPointId: point.id })}
                    className={`press flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11.5px] font-semibold leading-tight ${
                      active ? "border-sagesse bg-sagesse text-creme" : "border-sagesse/20 bg-creme text-sagesse-deep"
                    }`}
                  >
                    <MapPin size={14} weight={active ? "fill" : "regular"} className="shrink-0" />
                    {point.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <span className={EYEBROW}>Places</span>
              <div className="flex items-center gap-2 rounded-xl border border-sagesse/20 bg-creme p-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, seats: Math.max(1, form.seats - 1) })}
                  className="press grid size-9 place-items-center rounded-lg bg-white text-sagesse shadow-sm"
                  aria-label="Retirer une place"
                >
                  <Minus size={16} weight="bold" />
                </button>
                <span className="flex-1 text-center font-display text-lg font-bold text-sagesse-deep">{form.seats}</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, seats: Math.min(MAX_SEATS_PER_ORDER, form.seats + 1) })}
                  className="press grid size-9 place-items-center rounded-lg bg-white text-sagesse shadow-sm"
                  aria-label="Ajouter une place"
                >
                  <Plus size={16} weight="bold" />
                </button>
              </div>
              <p className="mt-1 text-[10.5px] text-muted-foreground">Max {MAX_SEATS_PER_ORDER} places · groupe jamais séparé</p>
            </div>
            <div>
              <span className={EYEBROW}>Type de trajet</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "aller-retour", label: "Aller-retour", price: state.settings.priceRoundTrip },
                    { id: "aller-simple", label: "Aller simple", price: state.settings.priceOneWay },
                  ] as { id: TripType; label: string; price: number }[]
                ).map((trip) => {
                  const active = form.tripType === trip.id;
                  return (
                    <button
                      type="button"
                      key={trip.id}
                      onClick={() => setForm({ ...form, tripType: trip.id })}
                      className={`press rounded-xl border px-2 py-2 text-[11.5px] font-semibold ${
                        active ? "border-orange bg-orange/10 text-orange" : "border-sagesse/20 bg-creme text-sagesse-deep"
                      }`}
                    >
                      {trip.label}
                      <span className="mt-0.5 block text-[10px] font-normal opacity-80">{formatFcfa(trip.price)} / pers.</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <span className={EYEBROW}>Moyen de paiement</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAY_METHODS.map((method) => {
                const active = form.paymentMethod === method.id;
                return (
                  <button
                    type="button"
                    key={method.id}
                    onClick={() => setForm({ ...form, paymentMethod: method.id })}
                    className={`press rounded-xl border p-2.5 text-left ${
                      active ? "border-sagesse bg-sagesse/5 ring-1 ring-sagesse/30" : "border-sagesse/20 bg-creme"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[12px] font-bold text-sagesse-deep">
                      <span className={`size-2.5 rounded-full bg-gradient-to-br ${method.accent}`} />
                      {method.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{method.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-creme px-4 py-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-sagesse/60">Total à payer</p>
              <p className="font-display text-2xl font-extrabold text-sagesse-deep">{formatFcfa(total)}</p>
            </div>
            <p className="max-w-[45%] text-right text-[10.5px] leading-tight text-muted-foreground">
              <CalendarBlank size={12} className="mb-0.5 inline" /> {BRAND.departure} · {BRAND.venue}
            </p>
          </div>

          <button
            type="submit"
            className="press mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange/25"
          >
            <Feather size={17} weight="fill" />
            {form.paymentMethod === "especes" ? "Réserver et payer sur place" : "Continuer vers le paiement"}
            <ArrowRight size={16} weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
}