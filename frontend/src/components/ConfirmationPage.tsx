import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  CircleNotch,
  Feather,
  Star,
  Warning,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { getReservationStatus, getConfig } from "../services/api";
import type { ApiReservation, ApiConfig } from "../services/api";
import { LAST_RESERVATION_KEY } from "../services/bookingStorage";
import { BRAND } from "../constants";
import TicketCard from "./TicketCard";

const POLL_INTERVAL = 3000;
const MAX_POLLS = 20;

function BrandBar() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-or/30 bg-creme/95 backdrop-blur-md no-print">
      <div className="mx-auto flex h-[60px] max-w-lg items-center justify-between px-4">
        <button onClick={() => navigate("/")} className="press flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full bg-sagesse text-or ring-1 ring-or/40">
            <Feather size={16} weight="fill" />
          </span>
          <span className="font-display text-[14px] font-bold text-sagesse-deep">{BRAND.name}</span>
        </button>
        <span className="flex items-center gap-1 rounded-full bg-or/15 px-2.5 py-1 text-[10px] font-bold text-sagesse-deep">
          <Star size={11} weight="fill" className="text-or" /> {BRAND.edition}
        </span>
      </div>
    </header>
  );
}

function PollingState({ polls, reference }: { polls: number; reference?: string }) {
  const progress = Math.min((polls / MAX_POLLS) * 100, 95);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="relative">
        <div className="size-20 rounded-full border-4 border-sagesse/10" />
        <CircleNotch
          size={80}
          className="absolute inset-0 animate-spin text-sagesse/60"
          style={{ strokeDasharray: "60 200" }}
        />
        <Feather
          size={28}
          weight="fill"
          className="absolute inset-0 m-auto text-sagesse"
        />
      </div>
      <div>
        <p className="font-display text-xl font-bold text-sagesse-deep">
          Vérification du paiement…
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Cela peut prendre quelques secondes.
        </p>
      </div>
      {reference && (
        <p className="rounded-xl bg-sagesse/8 px-4 py-2 font-mono text-sm font-semibold text-sagesse-deep">
          {reference}
        </p>
      )}
      <div className="w-full max-w-xs">
        <div className="h-1.5 overflow-hidden rounded-full bg-sagesse/10">
          <motion.div
            className="h-full rounded-full bg-sagesse"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
          Vérification {polls}/{MAX_POLLS}…
        </p>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<ApiReservation | null>(null);
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [polls, setPolls] = useState(0);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = async () => {
    if (!reference) return;
    try {
      const { reservation: r } = await getReservationStatus(reference);
      setReservation(r);
      if (r.status === "PAID") {
        localStorage.setItem(LAST_RESERVATION_KEY, JSON.stringify(r));
        return;
      }
      if (r.status === "CANCELLED" || r.status === "EXPIRED") return;
      setPolls((p) => {
        if (p + 1 < MAX_POLLS) {
          timerRef.current = setTimeout(() => void poll(), POLL_INTERVAL);
        }
        return p + 1;
      });
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void getConfig().then(setConfig).catch(() => {});
    void poll();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <Warning size={40} weight="fill" className="text-destructive" />
          <p className="font-display text-xl font-bold text-sagesse-deep">
            Impossible de vérifier le paiement
          </p>
          <p className="text-[13px] text-muted-foreground">
            Vérifiez votre connexion et réessayez.
          </p>
          <button
            onClick={() => { setError(false); setPolls(0); void poll(); }}
            className="press rounded-xl bg-sagesse px-5 py-3 text-sm font-bold text-creme"
          >
            Réessayer
          </button>
        </div>
      );
    }

    if (!reservation || (reservation.status === "PENDING" && polls < MAX_POLLS)) {
      return <PollingState polls={polls} reference={reference} />;
    }

    if (reservation.status === "PAID") {
      return (
        <div className="mx-auto max-w-lg px-4 py-6">
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mb-5 flex flex-col items-center text-center"
            >
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
                className="relative grid size-16 place-items-center rounded-full bg-element/15 text-sagesse"
              >
                <CheckCircle size={36} weight="fill" />
                <span className="absolute inset-0 animate-ping rounded-full bg-element/20" />
              </motion.span>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-3 font-display text-2xl font-bold text-sagesse-deep"
              >
                Paiement confirmé !
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="mt-1 text-[13px] text-muted-foreground"
              >
                Conservez ce billet — il sera contrôlé à l'embarquement.
              </motion.p>
            </motion.div>
          </AnimatePresence>
          <TicketCard reservation={reservation} />
          <div className="mt-4 grid gap-2 no-print sm:grid-cols-2">
            <button
              onClick={() => navigate("/")}
              className="press rounded-xl border border-sagesse/25 px-4 py-3 text-sm font-semibold text-sagesse"
            >
              Retour à l'accueil
            </button>
            <button
              onClick={() => navigate("/billet")}
              className="press rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white"
            >
              Mon billet
            </button>
          </div>
        </div>
      );
    }

    if (reservation.status === "EXPIRED" || reservation.status === "CANCELLED") {
      return (
        <div className="mx-auto max-w-lg px-4 py-12 text-center">
          <Warning size={44} weight="fill" className="mx-auto text-destructive" />
          <h1 className="mt-3 font-display text-xl font-bold text-sagesse-deep">
            {reservation.status === "CANCELLED" ? "Réservation annulée" : "Réservation expirée"}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {reservation.status === "EXPIRED"
              ? "Le délai de paiement est dépassé. Vos places ont été libérées."
              : "Cette réservation a été annulée."}
          </p>
          <button
            onClick={() => navigate("/reserver")}
            className="press mt-6 rounded-xl bg-orange px-6 py-3 text-sm font-bold text-white"
          >
            Réserver à nouveau
          </button>
        </div>
      );
    }

    // PENDING dépassé MAX_POLLS
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <Warning size={44} weight="fill" className="mx-auto text-orange" />
        <h1 className="mt-3 font-display text-xl font-bold text-sagesse-deep">
          Paiement en cours de traitement
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Votre paiement n'est pas encore confirmé. Conservez votre référence — votre billet
          apparaîtra dès la confirmation.
        </p>
        {reference && (
          <p className="mt-3 rounded-xl bg-sagesse/8 px-4 py-2 font-mono text-sm font-semibold text-sagesse-deep">
            {reference}
          </p>
        )}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => { setPolls(0); void poll(); }}
            className="press rounded-xl bg-sagesse px-4 py-3 text-sm font-bold text-creme"
          >
            Vérifier à nouveau
          </button>
          <a
            href={`https://wa.me/${config?.event.whatsappContact?.replace(/[^0-9]/g, "") ?? ""}`}
            className="press flex items-center justify-center gap-2 rounded-xl border border-element/40 px-4 py-3 text-sm font-semibold text-sagesse"
          >
            <WhatsappLogo size={16} weight="fill" /> Contacter la commission
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-creme text-sagesse-deep">
      <BrandBar />
      <main>{renderContent()}</main>
    </div>
  );
}
