import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bank,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  MagnifyingGlass,
  QrCode,
  ShareNetwork,
  Star,
  Ticket,
  Warning,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BRAND } from "../constants";
import type { Reservation } from "../types";
import {
  busLabel,
  confirmPayment,
  findByReference,
  formatFcfa,
  pickupName,
  qrMatrix,
  useBookings,
} from "../services/bookingStorage";

export function QrSvg({ value, size = 132 }: { value: string; size?: number }) {
  const matrix = qrMatrix(value);
  const unit = size / matrix.length;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Code QR du billet ${value}`}
      className="rounded-lg bg-white ring-1 ring-sagesse/15"
    >
      {matrix.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * unit}
              y={r * unit}
              width={unit}
              height={unit}
              fill="#0b6b3a"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function StatusPill({ status }: { status: Reservation["paymentStatus"] }) {
  const map = {
    paye: "bg-element/15 text-sagesse ring-element/40",
    en_attente: "bg-orange/15 text-orange ring-orange/40",
    annule: "bg-destructive/10 text-destructive ring-destructive/30",
  } as const;
  const label = { paye: "Payé / Valide", en_attente: "En attente de paiement", annule: "Annulée" } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${map[status]}`}>
      {status === "paye" ? <CheckCircle size={13} weight="fill" /> : <Warning size={13} weight="fill" />}
      {label[status]}
    </span>
  );
}

export default function TicketCard({ reservation }: { reservation: Reservation }) {
  const state = useBookings();
  const message = `Billet Hikma 20 ANS - ${reservation.firstName} ${reservation.lastName} - Réf. ${reservation.reference} - ${busLabel(state, reservation.busId)} (${pickupName(state, reservation.pickupPointId)}) - ${reservation.seats} place(s) - départ ${state.settings.departureTime}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="overflow-hidden rounded-3xl border border-or/50 bg-white shadow-xl shadow-sagesse/10"
    >
      <header className="hikma-hero relative overflow-hidden px-5 py-4 text-creme">
        <div className="hikma-pattern absolute inset-0 opacity-40" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-or-clair">{BRAND.name}</p>
            <h3 className="font-display text-lg font-bold leading-tight">Billet de transport</h3>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-or-clair to-or text-center font-display text-[11px] font-extrabold leading-none text-sagesse-deep shadow-inner">
            20
            <span className="text-[7px] tracking-widest">ANS</span>
          </span>
        </div>
      </header>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Référence</p>
            <p className="font-mono text-lg font-bold tracking-tight text-sagesse-deep">{reservation.reference}</p>
          </div>
          <StatusPill status={reservation.paymentStatus} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-3 text-[13px]">
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Passager</dt>
            <dd className="font-semibold text-sagesse-deep">
              {reservation.firstName} {reservation.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bus</dt>
            <dd className="font-semibold text-sagesse">{busLabel(state, reservation.busId)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Places</dt>
            <dd className="font-semibold text-sagesse">{reservation.seats}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Point de ramassage</dt>
            <dd className="font-semibold text-sagesse-deep">{pickupName(state, reservation.pickupPointId)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Départ</dt>
            <dd className="font-semibold text-sagesse-deep">{state.settings.departureTime}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Retour</dt>
            <dd className="font-semibold text-sagesse-deep">
              {reservation.tripType === "aller-retour" ? state.settings.returnTime : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trajet</dt>
            <dd className="font-semibold text-sagesse-deep">
              {reservation.tripType === "aller-retour" ? "Aller-retour" : "Aller simple"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Montant</dt>
            <dd className="font-semibold text-orange">{formatFcfa(reservation.amount)}</dd>
          </div>
        </dl>
      </div>

      <div className="ticket-dash mx-5" />

      <div className="flex items-center gap-4 px-5 py-4">
        <QrSvg value={reservation.reference} />
        <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-sagesse-deep">Présentez ce code au contrôleur</p>
          <p className="mt-0.5">
            {BRAND.venue} · {BRAND.departure}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-orange">
            <Star size={12} weight="fill" /> 20 ans d'excellence
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-sagesse/10 bg-creme/60 p-3 no-print">
        <button
          onClick={() => window.print()}
          className="press flex items-center justify-center gap-1.5 rounded-xl bg-sagesse px-3 py-2.5 text-[12px] font-semibold text-creme"
        >
          <DownloadSimple size={16} weight="bold" /> Télécharger
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="press flex items-center justify-center gap-1.5 rounded-xl border border-element/40 bg-white px-3 py-2.5 text-[12px] font-semibold text-sagesse"
        >
          <ShareNetwork size={16} weight="bold" /> Partager
        </a>
      </div>
    </motion.article>
  );
}

export function TicketSuccess({
  reservation,
  onReset,
  onViewTicket,
}: {
  reservation: Reservation;
  onReset: () => void;
  onViewTicket?: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex flex-col items-center text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="grid size-14 place-items-center rounded-full bg-element/15 text-sagesse"
        >
          <CheckCircle size={32} weight="fill" />
        </motion.span>
        <h2 className="mt-2 font-display text-2xl font-bold text-sagesse-deep">Réservation confirmée</h2>
        <p className="text-[13px] text-muted-foreground">
          Conservez ce billet : il sera contrôlé à l'embarquement.
        </p>
      </div>
      <TicketCard reservation={reservation} />
      <div className="mt-4 grid gap-2 no-print sm:grid-cols-2">
        <button onClick={onReset} className="press rounded-xl border border-sagesse/25 px-4 py-3 text-sm font-semibold text-sagesse">
          Réserver d'autres places
        </button>
        {onViewTicket && (
          <button onClick={onViewTicket} className="press rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white">
            Aller dans « Mon Billet »
          </button>
        )}
      </div>
    </div>
  );
}

export function PaymentPanel({
  reservation,
  onPaid,
  onBack,
}: {
  reservation: Reservation;
  onPaid: (r: Reservation) => void;
  onBack: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const meta =
    reservation.paymentMethod === "wave"
      ? { label: "Wave", hint: "Paiement instantané", accent: "from-[#1dc8f2] to-[#0a9ec9]" }
      : { label: "Orange Money", hint: "#144# · USSD", accent: "from-[#ff7900] to-[#d96100]" };

  const run = (success: boolean) => {
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      if (!success) {
        toast.error("Paiement refusé par l'opérateur. Réessayez.");
        return;
      }
      const res = confirmPayment(reservation.id);
      if (!res.ok || !res.reservation) {
        toast.error("La confirmation du paiement a échoué.");
        return;
      }
      toast.success("Paiement confirmé, votre billet est prêt !");
      onPaid(res.reservation);
    }, 1400);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-or/35 bg-white shadow-lg"
      >
        <div className={`bg-gradient-to-br ${meta.accent} px-5 py-4 text-white`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">Paiement sécurisé</p>
          <h2 className="font-display text-xl font-bold">{meta.label}</h2>
          <p className="text-[12px] opacity-90">{meta.hint}</p>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted-foreground">Montant à payer</span>
            <span className="font-display text-2xl font-extrabold text-sagesse-deep">{formatFcfa(reservation.amount)}</span>
          </div>
          <dl className="rounded-2xl bg-creme p-3 text-[12px]">
            {[
              ["Référence", reservation.reference],
              ["Places", String(reservation.seats)],
              ["Téléphone", reservation.phone],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-0.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={k === "Référence" ? "font-mono font-semibold" : "font-semibold"}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="rounded-xl bg-orange/10 px-3 py-2 text-[11.5px] leading-relaxed text-orange">
            Mode démonstration : aucune somme réelle n'est débitée. Choisissez l'issue du paiement.
          </p>
          <button
            onClick={() => run(true)}
            disabled={processing}
            className="press flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
          >
            {processing ? <CircleNotch size={18} className="animate-spin" /> : <Bank size={18} weight="fill" />}
            Payer {formatFcfa(reservation.amount)}
            <ArrowRight size={15} weight="bold" />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => run(true)} disabled={processing} className="press rounded-xl border border-element/40 px-3 py-2.5 text-[12px] font-semibold text-sagesse">
              Simuler succès
            </button>
            <button onClick={() => run(false)} disabled={processing} className="press rounded-xl border border-destructive/30 px-3 py-2.5 text-[12px] font-semibold text-destructive">
              Simuler échec
            </button>
          </div>
          <button onClick={onBack} className="flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:underline">
            <ArrowLeft size={13} weight="bold" /> Modifier ma réservation
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function RetrievePanel({ onFound }: { onFound: (r: Reservation) => void }) {
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setLoading(true);
        window.setTimeout(() => {
          const found = findByReference(phone, reference);
          setLoading(false);
          if (!found) {
            toast.error("Aucune réservation ne correspond à ce numéro et cette référence.");
            return;
          }
          toast.success(`Réservation ${found.reference} retrouvée.`);
          onFound(found);
        }, 450);
      }}
      className="rounded-3xl border border-or/35 bg-white/85 p-5 shadow-sm backdrop-blur"
    >
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-sagesse-deep">
        <MagnifyingGlass size={18} weight="bold" className="text-orange" /> Retrouver ma réservation
      </h3>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Entrez le numéro utilisé à la réservation et la référence du billet.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { label: "Téléphone", value: phone, set: setPhone, ph: "771234567", mono: false },
          { label: "Référence", value: reference, set: setReference, ph: "HIKMA-20A-1234", mono: true },
        ].map((f) => (
          <label key={f.label} className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-sagesse/70">{f.label}</span>
            <input
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.ph}
              inputMode={f.mono ? "text" : "numeric"}
              className={`w-full rounded-xl border border-sagesse/20 bg-creme px-3 py-2.5 text-sm text-sagesse-deep outline-none focus:border-orange focus:ring-2 focus:ring-orange/25 ${f.mono ? "font-mono uppercase" : ""}`}
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="press mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sagesse px-4 py-3 text-sm font-bold text-creme disabled:opacity-60"
      >
        {loading ? <CircleNotch size={18} className="animate-spin" /> : <QrCode size={18} weight="bold" />}
        Afficher mon billet
        <ArrowRight size={16} weight="bold" />
      </button>
      <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
        <Ticket size={12} /> Astuce : la référence figure sur votre confirmation.
      </p>
    </form>
  );
}