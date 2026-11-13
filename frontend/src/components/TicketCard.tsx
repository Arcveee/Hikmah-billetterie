import { useEffect, useState } from "react";
import {
  ArrowRight,
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
import QRCode from "qrcode";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BRAND } from "../constants";
import type { ApiReservation } from "../services/api";
import { formatFcfa, formatDate } from "../services/bookingStorage";
import * as api from "../services/api";

export function QrSvg({ value, size = 132 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: "#0B6B3A", light: "#FFFFFF" } })
      .then(setDataUrl)
      .catch(() => {});
  }, [value, size]);
  if (!dataUrl) return <div style={{ width: size, height: size }} className="rounded-lg bg-secondary" />;
  return (
    <img
      src={dataUrl}
      alt={`Code QR du billet ${value}`}
      width={size}
      height={size}
      className="rounded-lg bg-white ring-1 ring-sagesse/15"
    />
  );
}

function StatusPill({ status }: { status: ApiReservation["status"] }) {
  const map = {
    PAID: "bg-element/15 text-sagesse ring-element/40",
    PENDING: "bg-orange/15 text-orange ring-orange/40",
    EXPIRED: "bg-destructive/10 text-destructive ring-destructive/30",
    CANCELLED: "bg-destructive/10 text-destructive ring-destructive/30",
  } as const;
  const label = { PAID: "Payé / Valide", PENDING: "En attente de paiement", EXPIRED: "Expirée", CANCELLED: "Annulée" } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${map[status]}`}>
      {status === "PAID" ? <CheckCircle size={13} weight="fill" /> : <Warning size={13} weight="fill" />}
      {label[status]}
    </span>
  );
}

export default function TicketCard({ reservation }: { reservation: ApiReservation }) {
  const busLabel = reservation.bus?.label ?? "Bus assigné";
  const pickupLabel = reservation.pickupPoint?.name ?? "Point de ramassage";
  const departureTime = reservation.bus?.departureTime ?? "—";
  const returnTime = reservation.bus?.returnTime ?? "—";
  const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
  const pdfUrl = `${BASE}/tickets/${reservation.publicToken}.pdf`;
  const waText = `Billet Hikma 20 ANS - ${reservation.firstName} ${reservation.lastName} - Réf. ${reservation.reference} - ${busLabel} (${pickupLabel}) - ${reservation.seats} place(s) - départ ${departureTime} - Télécharger : ${pdfUrl}`;

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
            20<span className="text-[7px] tracking-widest">ANS</span>
          </span>
        </div>
      </header>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Référence</p>
            <p className="font-mono text-lg font-bold tracking-tight text-sagesse-deep">{reservation.reference}</p>
          </div>
          <StatusPill status={reservation.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-3 text-[13px]">
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Passager</dt>
            <dd className="font-semibold text-sagesse-deep">{reservation.firstName} {reservation.lastName}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bus</dt>
            <dd className="font-semibold text-sagesse">{busLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Places</dt>
            <dd className="font-semibold text-sagesse">{reservation.seats}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Point de ramassage</dt>
            <dd className="font-semibold text-sagesse-deep">{pickupLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Départ</dt>
            <dd className="font-semibold text-sagesse-deep">{departureTime}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Retour</dt>
            <dd className="font-semibold text-sagesse-deep">{reservation.tripType === "ROUND_TRIP" ? returnTime : "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trajet</dt>
            <dd className="font-semibold text-sagesse-deep">{reservation.tripType === "ROUND_TRIP" ? "Aller-retour" : "Aller simple"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Montant</dt>
            <dd className="font-semibold text-orange">{formatFcfa(reservation.amountXof)}</dd>
          </div>
          {reservation.paidAt && (
            <div className="col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Payé le</dt>
              <dd className="font-semibold text-sagesse-deep">{formatDate(reservation.paidAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="ticket-dash mx-5" />

      <div className="flex items-center gap-4 px-5 py-4">
        <QrSvg value={reservation.reference} />
        <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-sagesse-deep">Présentez ce code au contrôleur</p>
          <p className="mt-0.5">{BRAND.venue}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-orange">
            <Star size={12} weight="fill" /> 20 ans d'excellence
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-sagesse/10 bg-creme/60 p-3 no-print">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="press flex items-center justify-center gap-1.5 rounded-xl bg-sagesse px-3 py-2.5 text-[12px] font-semibold text-creme"
        >
          <DownloadSimple size={16} weight="bold" /> Télécharger PDF
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
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

export function TicketSuccess({ reservation, onReset, onViewTicket }: { reservation: ApiReservation; onReset: () => void; onViewTicket?: () => void }) {
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
        <h2 className="mt-2 font-display text-2xl font-bold text-sagesse-deep">Paiement confirmé !</h2>
        <p className="text-[13px] text-muted-foreground">Conservez ce billet : il sera contrôlé à l'embarquement.</p>
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

export function RetrievePanel({ onFound }: { onFound: (r: ApiReservation) => void }) {
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { reservation } = await api.lookupReservation(reference.trim().toUpperCase(), phone.trim());
      toast.success(`Réservation ${reservation.reference} retrouvée.`);
      onFound(reservation);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Aucune réservation ne correspond.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-3xl border border-or/35 bg-white/85 p-5 shadow-sm backdrop-blur">
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
