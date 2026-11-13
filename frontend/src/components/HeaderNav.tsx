import { useNavigate, useLocation } from "react-router-dom";
import { Feather, Gear, QrCode, Star, Ticket } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { BRAND } from "../constants";

const NAV: { path: string; label: string; short: string; icon: Icon }[] = [
  { path: "/", label: "Accueil", short: "Accueil", icon: Feather },
  { path: "/reserver", label: "Réserver", short: "Réserver", icon: Ticket },
  { path: "/billet", label: "Mon Billet", short: "Billet", icon: QrCode },
  { path: "/admin", label: "Espace Admin", short: "Admin", icon: Gear },
];

export default function HeaderNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const active = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-or/30 bg-creme/95 backdrop-blur-md no-print">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-3 px-4">
          <button onClick={() => navigate("/")} className="press flex items-center gap-2.5 text-left" aria-label="Accueil Hikma 20 ans">
            <span className="relative grid size-11 place-items-center rounded-full bg-sagesse text-or shadow-sm ring-2 ring-or/40">
              <Feather size={20} weight="fill" />
              <Star size={10} weight="fill" className="absolute -right-0.5 -top-0.5 text-or-clair" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-bold text-sagesse-deep">{BRAND.name}</span>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange">
                Hikma <span className="text-or">•</span> {BRAND.edition}
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.slice(0, 3).map((item) => {
              const ItemIcon = item.icon;
              const on = active(item.path);
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`press flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${on ? "bg-sagesse text-creme shadow-sm" : "text-sagesse-deep/80 hover:bg-secondary"}`}
                >
                  <ItemIcon size={16} weight={on ? "fill" : "regular"} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button onClick={() => navigate("/admin")}
            className={`press hidden items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold md:flex ${active("/admin") ? "border-or bg-or text-sagesse-deep" : "border-sagesse/25 text-sagesse hover:border-sagesse/50"}`}
          >
            <Gear size={16} weight="fill" /> Espace Admin
          </button>

          <span className="flex items-center gap-1 rounded-full bg-or/15 px-2.5 py-1 text-[11px] font-bold text-sagesse-deep md:hidden">
            <Star size={12} weight="fill" className="text-or" /> {BRAND.edition}
          </span>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-or/30 bg-creme/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden no-print">
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const ItemIcon = item.icon;
            const on = active(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center gap-0.5 py-2.5" aria-label={item.label}
              >
                {on && (
                  <motion.span layoutId="nav-active" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-orange" />
                )}
                <ItemIcon size={22} weight={on ? "fill" : "regular"} className={on ? "text-sagesse" : "text-sagesse/50"} />
                <span className={`text-[10px] font-semibold ${on ? "text-sagesse" : "text-sagesse/50"}`}>{item.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
