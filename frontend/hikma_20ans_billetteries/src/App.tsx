import { useEffect, useState } from "react";
import { ArrowRight, Feather, MapPin, Phone, Star } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Toaster } from "sonner";
import HeaderNav from "./components/HeaderNav";
import PublicBookingFlow from "./components/PublicBookingFlow";
import AdminTransportPortal from "./components/AdminTransportPortal";
import TicketCard, { RetrievePanel } from "./components/TicketCard";
import { BRAND } from "./constants";
import type { Reservation, ViewKey } from "./types";
import { useBookings } from "./services/bookingStorage";

function MonBillet({ onReserve }: { onReserve: () => void }) {
  const state = useBookings();
  const [found, setFound] = useState<Reservation | null>(null);
  const latest = state.reservations
    .filter((r) => r.paymentStatus !== "annule")
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-2xl font-extrabold text-sagesse-deep">Mon Billet</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Retrouvez votre billet à tout moment, même hors connexion.
        </p>
      </motion.div>

      <div className="mt-4">
        {found ? (
          <div className="space-y-3">
            <TicketCard reservation={found} />
            <button
              onClick={() => setFound(null)}
              className="press w-full rounded-xl border border-sagesse/25 px-4 py-3 text-sm font-semibold text-sagesse no-print"
            >
              Rechercher une autre réservation
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <RetrievePanel onFound={setFound} />
            {latest && (
              <div className="rounded-2xl border border-or/30 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange">Dernière réservation</p>
                <button
                  onClick={() => setFound(latest)}
                  className="press mt-1.5 flex w-full items-center justify-between gap-2 text-left"
                >
                  <span>
                    <span className="block font-semibold text-sagesse-deep">
                      {latest.firstName} {latest.lastName}
                    </span>
                    <span className="block font-mono text-[11.5px] text-sagesse/70">{latest.reference}</span>
                  </span>
                  <ArrowRight size={18} weight="bold" className="text-orange" />
                </button>
              </div>
            )}
            <button
              onClick={onReserve}
              className="press w-full rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white no-print"
            >
              Réserver une place
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Footer({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  return (
    <footer className="mt-10 border-t border-or/30 bg-sagesse-deep px-4 py-7 text-creme no-print">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-or/15 text-or ring-1 ring-or/40">
            <Feather size={20} weight="fill" />
          </span>
          <div>
            <p className="font-display text-base font-bold">{BRAND.name}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-or-clair">{BRAND.edition} · {BRAND.slogan}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-[12.5px] text-creme/80 sm:grid-cols-2">
          <p className="flex items-center gap-1.5">
            <MapPin size={14} weight="fill" className="text-or-clair" /> {BRAND.venue} · {BRAND.departure}
          </p>
          <p className="flex items-center gap-1.5">
            <Phone size={14} weight="fill" className="text-or-clair" /> Commission Transport · {BRAND.whatsapp}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11.5px]">
          <button onClick={() => onNavigate("reserver")} className="press rounded-full bg-orange px-3 py-1.5 font-bold text-white">
            Réserver mon bus
          </button>
          <button onClick={() => onNavigate("billet")} className="press rounded-full border border-creme/25 px-3 py-1.5 font-semibold">
            Mon billet
          </button>
          <button onClick={() => onNavigate("admin")} className="press rounded-full border border-creme/25 px-3 py-1.5 font-semibold">
            Espace commission
          </button>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[10.5px] text-creme/50">
          <Star size={11} weight="fill" className="text-or" /> © {new Date().getFullYear()} {BRAND.name} — Billetterie
          transport officielle. {BRAND.slogan}.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  const [view, setView] = useState<ViewKey>("accueil");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  return (
    <div className="min-h-dvh bg-creme text-sagesse-deep">
      <HeaderNav view={view} onChange={setView} />
      <main>
        {view === "accueil" && <PublicBookingFlow onViewTicket={() => setView("billet")} />}
        {view === "reserver" && (
          <div className="pt-2">
            <PublicBookingFlow onViewTicket={() => setView("billet")} />
          </div>
        )}
        {view === "billet" && <MonBillet onReserve={() => setView("reserver")} />}
        {view === "admin" && <AdminTransportPortal />}
      </main>
      <Footer onNavigate={setView} />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}