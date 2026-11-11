import { useMemo, useState } from "react";
import {
  Bus,
  ChartBar,
  CheckCircle,
  DownloadSimple,
  Gear,
  IdentificationCard,
  ListChecks,
  MagnifyingGlass,
  ShieldCheck,
  SignOut,
  Star,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { BRAND } from "../constants";
import type { PaymentStatus } from "../types";
import {
  busFills,
  busLabel,
  cancelReservation,
  checkIn,
  computeStats,
  confirmPayment,
  downloadFile,
  formatDate,
  formatFcfa,
  moveReservation,
  pickupName,
  reservationsCsv,
  useBookings,
} from "../services/bookingStorage";
import { AdminGate, BusPanel, SettingsPanel, CARD, TITLE } from "./AdminPanels";

const TABS = [
  { id: "dash", label: "Tableau de bord", icon: ChartBar },
  { id: "pax", label: "Passagers", icon: ListChecks },
  { id: "scan", label: "Contrôle bus", icon: ShieldCheck },
  { id: "bus", label: "Bus & départs", icon: Bus },
  { id: "set", label: "Réglages", icon: Gear },
] as const;
type TabId = (typeof TABS)[number]["id"];
const LBL: Record<PaymentStatus, string> = { paye: "Payé", en_attente: "En attente", annule: "Annulé" };

export default function AdminTransportPortal() {
  const state = useBookings();
  const [open, setOpen] = useState(() => sessionStorage.getItem("hikma-admin") === "1");
  const [tab, setTab] = useState<TabId>("dash");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"tous" | PaymentStatus>("tous");
  const [scan, setScan] = useState("");
  const [last, setLast] = useState<{ ok: boolean; message: string; ref?: string } | null>(null);

  const stats = useMemo(() => computeStats(state), [state]);
  const fills = useMemo(() => busFills(state), [state]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return state.reservations.filter((r) => {
      const hit =
        !s ||
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(s) ||
        r.phone.includes(s) ||
        r.reference.toLowerCase().includes(s) ||
        r.neighborhood.toLowerCase().includes(s);
      return hit && (filter === "tous" || r.paymentStatus === filter);
    });
  }, [state.reservations, q, filter]);

  if (!open) return <AdminGate onUnlock={() => setOpen(true)} />;

  const boarded = state.reservations.filter((r) => r.checkedInAt);
  const maxRev = Math.max(stats.revenue, 1);
  const kpis = [
    { l: "Places vendues", v: `${stats.seatsTaken}/${stats.totalCapacity}`, s: `${stats.reservationCount} résa.`, a: "bg-sagesse/10 text-sagesse" },
    { l: "Recettes", v: formatFcfa(stats.revenue), s: `${stats.paidCount} payés`, a: "bg-element/15 text-sagesse" },
    { l: "En attente", v: String(stats.pendingCount), s: "à relancer", a: "bg-orange/15 text-orange" },
    { l: "Embarqués", v: String(stats.checkedIn), s: "validés", a: "bg-or/20 text-sagesse-deep" },
  ];
  const canal = [
    { l: "Wave", v: stats.revenueWave, c: "bg-[#1dc8f2]" },
    { l: "Orange Money", v: stats.revenueOrange, c: "bg-orange" },
    { l: "Espèces", v: stats.revenueCash, c: "bg-sagesse" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-orange">
            <Star size={12} weight="fill" /> {BRAND.edition} · {BRAND.name}
          </p>
          <h1 className="font-display text-2xl font-extrabold text-sagesse-deep">Commission Transport</h1>
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem("hikma-admin");
            setOpen(false);
            toast.success("Session administrateur fermée.");
          }}
          className="press flex items-center gap-1.5 rounded-full border border-sagesse/25 px-3 py-2 text-[12px] font-semibold text-sagesse"
        >
          <SignOut size={15} weight="bold" /> Quitter
        </button>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const TI = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold ${
                on ? "bg-sagesse text-creme" : "bg-white text-sagesse-deep ring-1 ring-sagesse/15"
              }`}
            >
              <TI size={15} weight={on ? "fill" : "regular"} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dash" && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.l} className="rounded-2xl border border-or/25 bg-white p-3.5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{k.l}</p>
                <p className="mt-1 font-display text-xl font-extrabold text-sagesse-deep">{k.v}</p>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${k.a}`}>{k.s}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={CARD}>
              <h3 className={TITLE}><ChartBar size={16} weight="fill" className="text-orange" /> Recettes par canal</h3>
              <div className="mt-3 space-y-2">
                {canal.map((c) => (
                  <div key={c.l}>
                    <div className="flex justify-between text-[11.5px] font-semibold text-sagesse-deep">
                      <span>{c.l}</span><span>{formatFcfa(c.v)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${c.c}`} style={{ width: `${Math.round((c.v / maxRev) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={CARD}>
              <h3 className={TITLE}><Bus size={16} weight="fill" className="text-orange" /> Remplissage des bus</h3>
              <div className="mt-3 space-y-2">
                {fills.map((b) => (
                  <div key={b.id}>
                    <div className="flex justify-between text-[11.5px] font-semibold text-sagesse-deep">
                      <span>{b.label} · {b.departureTime}</span>
                      <span className={b.status === "complet" ? "text-orange" : "text-sagesse"}>{b.taken}/{b.capacity}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${b.status === "complet" ? "bg-orange" : "bg-element"}`} style={{ width: `${b.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "pax" && (
        <div className="mt-4 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[170px] flex-1">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sagesse/50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, téléphone, quartier, référence…"
                className="w-full rounded-xl border border-sagesse/20 bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="rounded-xl border border-sagesse/20 bg-white px-3 py-2.5 text-[12.5px] font-semibold text-sagesse-deep outline-none"
            >
              <option value="tous">Tous les statuts</option>
              <option value="paye">Payé</option>
              <option value="en_attente">En attente</option>
              <option value="annule">Annulé</option>
            </select>
            <button
              onClick={() => {
                downloadFile("hikma20-passagers.csv", reservationsCsv(state));
                toast.success("Export CSV téléchargé.");
              }}
              className="press flex items-center gap-1.5 rounded-xl bg-sagesse px-3 py-2.5 text-[12px] font-bold text-creme"
            >
              <DownloadSimple size={15} weight="bold" /> CSV
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-sagesse/30 bg-white p-6 text-center text-[13px] text-muted-foreground">
              Aucun passager ne correspond à cette recherche.
            </p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="rounded-2xl border border-or/25 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-sagesse-deep">
                      {r.firstName} {r.lastName}
                      {r.checkedInAt && <span className="ml-2 rounded-full bg-element/15 px-1.5 py-0.5 text-[9.5px] font-bold text-sagesse">À bord</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.phone} · {pickupName(state, r.pickupPointId)} · {r.seats} pl. · {r.tripType === "aller-retour" ? "A/R" : "Aller"}
                    </p>
                    <p className="font-mono text-[10.5px] text-sagesse/70">{r.reference} · {formatDate(r.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-sm font-bold text-orange">{formatFcfa(r.amount)}</p>
                    <span className={`text-[10px] font-bold uppercase ${r.paymentStatus === "paye" ? "text-sagesse" : r.paymentStatus === "annule" ? "text-destructive" : "text-orange"}`}>
                      {LBL[r.paymentStatus]}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <select
                    value={r.busId ?? ""}
                    onChange={(e) => {
                      moveReservation(r.id, e.target.value);
                      toast.success("Passager réaffecté.");
                    }}
                    className="rounded-lg border border-sagesse/20 bg-creme px-2 py-1.5 text-[11px] font-semibold text-sagesse-deep"
                  >
                    <option value="" disabled>Bus</option>
                    {state.buses.map((b) => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                  {r.paymentStatus !== "paye" && (
                    <button
                      onClick={() => {
                        confirmPayment(r.id, "especes");
                        toast.success("Paiement encaissé en espèces.");
                      }}
                      className="press rounded-lg border border-element/40 px-2 py-1.5 text-[11px] font-semibold text-sagesse"
                    >
                      Encaisser
                    </button>
                  )}
                  {r.paymentStatus !== "annule" && (
                    <button
                      onClick={() => {
                        cancelReservation(r.id);
                        toast.success("Réservation annulée, place libérée.");
                      }}
                      className="press flex items-center gap-1 rounded-lg border border-destructive/30 px-2 py-1.5 text-[11px] font-semibold text-destructive"
                    >
                      <Trash size={12} weight="bold" /> Annuler
                    </button>
                  )}
                  <span className="ml-auto text-[10.5px] text-muted-foreground">{busLabel(state, r.busId)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "scan" && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-or/30 bg-white p-4">
            <h3 className={TITLE}><IdentificationCard size={16} weight="fill" className="text-orange" /> Valider un billet</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">Référence ou téléphone du participant, à la montée.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!scan.trim()) return;
                const res = checkIn(scan);
                setLast({ ok: res.ok, message: res.message, ref: res.reservation?.reference });
                if (res.ok) {
                  toast.success(res.message);
                  setScan("");
                } else toast.error(res.message);
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="HIKMA-20A-1234"
                className="flex-1 rounded-xl border border-sagesse/20 bg-creme px-3 py-3 font-mono text-sm uppercase outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
              <button type="submit" className="press rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white">Valider</button>
            </form>
            {last && (
              <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-[12.5px] font-semibold ${last.ok ? "bg-element/15 text-sagesse" : "bg-destructive/10 text-destructive"}`}>
                {last.ok ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} weight="fill" />}
                <span>
                  {last.message}
                  {last.ref && <span className="ml-1 font-mono">({last.ref})</span>}
                </span>
              </div>
            )}
          </div>
          <div className={CARD}>
            <h3 className={TITLE}><CheckCircle size={16} weight="fill" className="text-element" /> À bord ({boarded.length})</h3>
            <div className="mt-2 max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
              {boarded.length === 0 && <p className="text-[12.5px] text-muted-foreground">Aucun participant embarqué.</p>}
              {boarded.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-creme px-2.5 py-2 text-[11px]">
                  <span className="font-semibold text-sagesse-deep">{r.firstName} {r.lastName} · {r.seats} pl.</span>
                  <span className="shrink-0 text-muted-foreground">{busLabel(state, r.busId)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "bus" && <BusPanel />}
      {tab === "set" && <SettingsPanel />}
    </div>
  );
}