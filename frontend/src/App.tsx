import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { CircleNotch, Feather, MapPin, Phone, Star } from "@phosphor-icons/react";
import { Toaster } from "sonner";
import HeaderNav from "./components/HeaderNav";
import { BRAND } from "./constants";
import { LAST_RESERVATION_KEY } from "./services/bookingStorage";
import type { ApiReservation } from "./services/api";
import TicketCard, { RetrievePanel } from "./components/TicketCard";
import { useState } from "react";

const PublicBookingFlow = lazy(() => import("./components/PublicBookingFlow"));
const HomePage = lazy(() => import("./components/HomePage"));
const AdminTransportPortal = lazy(() => import("./components/AdminTransportPortal"));
const ConfirmationPage = lazy(() => import("./components/ConfirmationPage"));

function Spinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <CircleNotch size={32} className="animate-spin text-sagesse/40" />
    </div>
  );
}

function MonBillet() {
  const navigate = useNavigate();
  const [found, setFound] = useState<ApiReservation | null>(() => {
    try {
      const raw = localStorage.getItem(LAST_RESERVATION_KEY);
      return raw ? (JSON.parse(raw) as ApiReservation) : null;
    } catch { return null; }
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-display text-2xl font-extrabold text-sagesse-deep">Mon Billet</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Retrouvez votre billet à tout moment, même hors connexion.</p>
      <div className="mt-4">
        {found ? (
          <div className="space-y-3">
            <TicketCard reservation={found} />
            <button onClick={() => setFound(null)} className="press w-full rounded-xl border border-sagesse/25 px-4 py-3 text-sm font-semibold text-sagesse no-print">
              Rechercher une autre réservation
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <RetrievePanel onFound={(r) => { setFound(r); localStorage.setItem(LAST_RESERVATION_KEY, JSON.stringify(r)); }} />
            <button onClick={() => navigate("/reserver")} className="press w-full rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white no-print">
              Réserver une place
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Footer() {
  const navigate = useNavigate();
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
          <p className="flex items-center gap-1.5"><MapPin size={14} weight="fill" className="text-or-clair" /> {BRAND.venue}</p>
          <p className="flex items-center gap-1.5"><Phone size={14} weight="fill" className="text-or-clair" /> Commission Transport</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11.5px]">
          <button onClick={() => navigate("/reserver")} className="press rounded-full bg-orange px-3 py-1.5 font-bold text-white">Réserver mon bus</button>
          <button onClick={() => navigate("/billet")} className="press rounded-full border border-creme/25 px-3 py-1.5 font-semibold">Mon billet</button>
          <button onClick={() => navigate("/admin")} className="press rounded-full border border-creme/25 px-3 py-1.5 font-semibold">Espace commission</button>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[10.5px] text-creme/50">
          <Star size={11} weight="fill" className="text-or" /> © {new Date().getFullYear()} {BRAND.name} — Billetterie transport officielle.
        </p>
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [pathname]);
  return null;
}

// Pages sans header/footer (confirmation gère son propre layout)
const BARE_ROUTES = ["/confirmation/"];

export default function App() {
  const { pathname } = useLocation();
  const bare = BARE_ROUTES.some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-dvh bg-creme text-sagesse-deep">
      <ScrollToTop />
      {!bare && <HeaderNav />}
      <main className={bare ? "" : "pb-20 md:pb-0"}>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/reserver" element={<PublicBookingFlow />} />
            <Route path="/billet" element={<MonBillet />} />
            <Route path="/billet/:publicToken" element={<MonBillet />} />
            <Route path="/confirmation/:reference" element={<ConfirmationPage />} />
            <Route path="/admin/*" element={<AdminTransportPortal />} />
            <Route path="*" element={<PublicBookingFlow />} />
          </Routes>
        </Suspense>
      </main>
      {!bare && <Footer />}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
