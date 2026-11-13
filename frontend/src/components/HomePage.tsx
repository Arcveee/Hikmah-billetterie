import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bus,
  Clock,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkle,
  Star,
  Ticket,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { BRAND } from "../constants";
import { useConfig } from "../services/bookingStorage";

function useEventCountdown(dateStr: string) {
  const [parts, setParts] = useState({ j: 0, h: 0, m: 0, s: 0, past: false });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(dateStr).getTime() - Date.now();
      if (diff <= 0) { setParts({ j: 0, h: 0, m: 0, s: 0, past: true }); return; }
      setParts({
        j: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        past: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dateStr]);
  return parts;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const cd = useEventCountdown(config?.event.date ?? "");
  const totalRemaining = config?.zones.reduce((s, z) => s + z.remainingSeats, 0) ?? 0;

  return (
    <div>
      {/* Hero */}
      <section className="hikma-hero relative overflow-hidden text-creme">
        <div className="hikma-pattern absolute inset-0 opacity-50" />
        <div className="absolute -right-16 -top-16 size-56 rounded-full border border-or/30" />
        <div className="absolute -left-10 bottom-0 size-40 rounded-full bg-orange/20 blur-2xl" />
        <div className="relative mx-auto max-w-4xl px-5 pb-12 pt-10 sm:pt-16">
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
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
            className="mt-4 max-w-2xl font-display text-[32px] font-extrabold leading-[1.08] sm:text-5xl"
          >
            Cap sur <span className="text-or-clair">Dakar Arena</span>
            <br />
            <span className="text-creme/90">pour les 20 ans d'Hikma</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-3 max-w-md text-[14px] leading-relaxed text-creme/85"
          >
            Réservez votre place dans les bus officiels de la Maison de la Sagesse.{" "}
            <span className="font-semibold text-or-clair">« {BRAND.slogan} »</span>
          </motion.p>

          {/* Countdown */}
          {config && !cd.past && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-5 inline-flex items-center gap-1 rounded-2xl border border-or/40 bg-sagesse-deep/50 px-4 py-2.5 backdrop-blur"
            >
              <Clock size={14} className="mr-1 text-or-clair" />
              {[{ v: cd.j, l: "j" }, { v: cd.h, l: "h" }, { v: cd.m, l: "m" }, { v: cd.s, l: "s" }].map(({ v, l }) => (
                <span key={l} className="flex items-baseline gap-0.5">
                  <span className="font-display text-lg font-bold text-creme">{String(v).padStart(2, "0")}</span>
                  <span className="mr-1.5 text-[10px] text-creme/50">{l}</span>
                </span>
              ))}
            </motion.div>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mt-7 flex flex-wrap gap-3"
          >
            <button
              onClick={() => navigate("/reserver")}
              className="press flex items-center gap-2 rounded-2xl bg-orange px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange/30"
            >
              <Ticket size={18} weight="fill" /> Réserver mon bus <ArrowRight size={16} weight="bold" />
            </button>
            <button
              onClick={() => navigate("/billet")}
              className="press flex items-center gap-2 rounded-2xl border border-creme/30 bg-creme/10 px-5 py-3 text-sm font-semibold text-creme backdrop-blur"
            >
              <QrCode size={18} weight="bold" /> Mon billet
            </button>
          </motion.div>
        </div>
      </section>

      {/* Stats rapides */}
      {config && (
        <section className="mx-auto max-w-4xl px-5 py-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: MapPin, label: config.event.venue, sub: new Date(config.event.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) },
              { icon: Bus, label: `${config.zones.length} zones`, sub: `${totalRemaining} places disponibles` },
              { icon: Clock, label: "Départ groupé", sub: "Retour groupé inclus" },
              { icon: ShieldCheck, label: "Paiement sécurisé", sub: "Wave · Orange Money" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-sagesse/15 bg-white px-4 py-3 shadow-sm">
                  <Icon size={18} weight="fill" className="text-sagesse" />
                  <p className="mt-2 text-[12.5px] font-semibold text-sagesse-deep">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Disponibilité par zone */}
          <div className="mt-6 rounded-3xl border border-or/30 bg-white p-5 shadow-sm">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-sagesse">
              <Sparkle size={13} weight="fill" className="text-or" /> Places disponibles par zone
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {config.zones.map((zone) => (
                <div key={zone.id}
                  className="flex items-center justify-between rounded-xl border border-sagesse/10 bg-creme px-3 py-2.5">
                  <span className="text-[13px] font-semibold text-sagesse-deep">{zone.name}</span>
                  <span className={`text-[12px] font-bold ${zone.isFull ? "text-destructive" : "text-element"}`}>
                    {zone.isFull ? "Complet" : `${zone.remainingSeats} pl.`}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("/reserver")}
              className="press mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sagesse px-4 py-3 text-sm font-bold text-creme"
            >
              <Ticket size={16} weight="fill" /> Réserver maintenant <ArrowRight size={15} weight="bold" />
            </button>
          </div>

          {/* Comment ça marche */}
          <div className="mt-6 rounded-3xl border border-or/20 bg-white p-5 shadow-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-sagesse">
              Comment ça marche
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { n: "1", title: "Choisissez votre zone", desc: "Pikine, Mbao, Bouguiba — sélectionnez le point de ramassage le plus proche." },
                { n: "2", title: "Payez en ligne", desc: "Wave ou Orange Money. Paiement sécurisé, confirmation immédiate." },
                { n: "3", title: "Montez dans le bus", desc: "Présentez votre QR code au contrôleur. Votre groupe reste ensemble." },
              ].map((step) => (
                <div key={step.n} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sagesse text-[11px] font-bold text-creme">
                    {step.n}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-sagesse-deep">{step.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
