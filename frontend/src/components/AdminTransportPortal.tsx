import { useCallback, useEffect, useState } from "react";
import {
  Bus,
  ChartBar,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  Gear,
  IdentificationCard,
  ListChecks,
  MagnifyingGlass,
  MapPin,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  SignOut,
  Star,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { BRAND } from "../constants";
import * as api from "../services/api";
import type { ApiReservation, ApiStats, ApiAdminZone } from "../services/api";
import { formatFcfa, formatDate } from "../services/bookingStorage";
import { AdminLoginGate, BusPanel, SettingsPanel, PickupPointsPanel, ZonesPanel, CARD, TITLE } from "./AdminPanels";
import QrScanner from "./QrScanner";

const TABS = [
  { id: "dash", label: "Tableau de bord", icon: ChartBar },
  { id: "pax", label: "Passagers", icon: ListChecks },
  { id: "scan", label: "Contrôle", icon: ShieldCheck },
  { id: "bus", label: "Bus", icon: Bus },
  { id: "zones", label: "Zones", icon: MapPin },
  { id: "set", label: "Réglages", icon: Gear },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STATUS_LABEL: Record<string, string> = { PAID: "Payé", PENDING: "En attente", EXPIRED: "Expirée", CANCELLED: "Annulée" };
const STATUS_COLOR: Record<string, string> = {
  PAID: "bg-element/15 text-sagesse",
  PENDING: "bg-orange/15 text-orange",
  EXPIRED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export default function AdminTransportPortal() {
  const [token, setToken] = useState(() => sessionStorage.getItem("hikma-admin-token") ?? "");
  const [username, setUsername] = useState(() => sessionStorage.getItem("hikma-admin-username") ?? "");
  const [tab, setTab] = useState<TabId>("dash");
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [zones, setZones] = useState<ApiAdminZone[]>([]);

  // Reservations
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [resTotal, setResTotal] = useState(0);
  const [resPage, setResPage] = useState(1);
  const [resPages, setResPages] = useState(1);
  const [resSearch, setResSearch] = useState("");
  const [resStatus, setResStatus] = useState("");
  const [resLoading, setResLoading] = useState(false);
  const [selected, setSelected] = useState<ApiReservation | null>(null);

  // Check-in
  const [scanRef, setScanRef] = useState("");
  const [scanResult, setScanResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [s, { zones: z }] = await Promise.all([api.getStats(), api.getAdminZones()]);
      setStats(s);
      setZones(z);
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e.status === 401) { sessionStorage.clear(); setToken(""); }
    }
  }, []);

  const loadReservations = useCallback(async (page = 1, search = "", status = "") => {
    setResLoading(true);
    try {
      const data = await api.getAdminReservations({ page, limit: 20, search: search || undefined, status: status || undefined });
      setReservations(data.reservations);
      setResTotal(data.total);
      setResPages(data.pages);
      setResPage(page);
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e.status === 401) { sessionStorage.clear(); setToken(""); }
    } finally {
      setResLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadStats();
    const interval = setInterval(() => void loadStats(), 20000);
    return () => clearInterval(interval);
  }, [token, loadStats]);

  useEffect(() => {
    if (!token || tab !== "pax") return;
    void loadReservations(1, resSearch, resStatus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab]);

  if (!token) {
    return <AdminLoginGate onLogin={(t, u) => { setToken(t); setUsername(u); }} />;
  }

  const logout = () => {
    sessionStorage.removeItem("hikma-admin-token");
    sessionStorage.removeItem("hikma-admin-username");
    setToken("");
    toast.success("Session fermée.");
  };

  const doCancel = async (r: ApiReservation) => {
    if (!confirm(`Annuler la réservation ${r.reference} ?`)) return;
    try {
      await api.cancelReservation(r.id);
      toast.success("Réservation annulée.");
      void loadReservations(resPage, resSearch, resStatus);
      setSelected(null);
    } catch (err: unknown) { toast.error((err as { message?: string }).message ?? "Erreur."); }
  };

  const doMarkPaid = async (r: ApiReservation) => {
    try {
      await api.markPaidCash(r.id);
      toast.success("Marqué payé (espèces).");
      void loadReservations(resPage, resSearch, resStatus);
      setSelected(null);
    } catch (err: unknown) { toast.error((err as { message?: string }).message ?? "Erreur."); }
  };

  const handleScanResult = (text: string) => {
    setCameraActive(false);
    setScanRef(text);
    void (async () => {
      setScanLoading(true);
      try {
        const result = await api.checkIn(text.trim().toUpperCase());
        setScanResult({ ok: true, message: result.message });
        toast.success(result.message);
      } catch (err: unknown) {
        const msg = (err as { message?: string }).message ?? "Référence introuvable.";
        setScanResult({ ok: false, message: msg });
        toast.error(msg);
      } finally {
        setScanLoading(false);
      }
    })();
  };

  const doCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanRef.trim()) return;
    setScanLoading(true);
    try {
      const result = await api.checkIn(scanRef.trim().toUpperCase());
      setScanResult({ ok: true, message: result.message });
      toast.success(result.message);
      setScanRef("");
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "Référence introuvable.";
      setScanResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setScanLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-orange">
            <Star size={12} weight="fill" /> {BRAND.edition} · {BRAND.name}
          </p>
          <h1 className="font-display text-2xl font-extrabold text-sagesse-deep">Commission Transport</h1>
          <p className="text-[11px] text-muted-foreground">{username}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { api.exportPassengersXlsx(); toast.success("Export Excel en cours…"); }}
            className="press flex items-center gap-1.5 rounded-full border border-sagesse/25 px-3 py-2 text-[12px] font-semibold text-sagesse"
          >
            <DownloadSimple size={14} weight="bold" /> Excel
          </button>
          <button
            onClick={() => { api.exportPassengersPdf(); toast.success("Export PDF en cours…"); }}
            className="press flex items-center gap-1.5 rounded-full border border-sagesse/25 px-3 py-2 text-[12px] font-semibold text-sagesse"
          >
            <DownloadSimple size={14} weight="bold" /> PDF
          </button>
          <button onClick={logout} className="press flex items-center gap-1.5 rounded-full border border-sagesse/25 px-3 py-2 text-[12px] font-semibold text-sagesse">
            <SignOut size={15} weight="bold" /> Quitter
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const TI = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold ${on ? "bg-sagesse text-creme" : "bg-white text-sagesse-deep ring-1 ring-sagesse/15"}`}
            >
              <TI size={15} weight={on ? "fill" : "regular"} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Dashboard ── */}
      {tab === "dash" && (
        <div className="mt-4 space-y-3">
          {!stats ? (
            <div className="flex justify-center py-10"><CircleNotch size={28} className="animate-spin text-sagesse/40" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {[
                  { l: "Payés", v: String(stats.global.paid), s: `${stats.global.seatsTaken} places`, a: "bg-element/15 text-sagesse" },
                  { l: "En attente", v: String(stats.global.pending), s: "à confirmer", a: "bg-orange/15 text-orange" },
                  { l: "Recettes", v: formatFcfa(stats.global.revenue), s: "total encaissé", a: "bg-or/20 text-sagesse-deep" },
                  { l: "Réservations", v: String(stats.global.total), s: "actives", a: "bg-sagesse/10 text-sagesse" },
                ].map((k) => (
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
                    {[
                      { l: "Wave", v: stats.global.revenueWave, c: "bg-[#1dc8f2]" },
                      { l: "Orange Money", v: stats.global.revenueOrangeMoney, c: "bg-orange" },
                      { l: "Espèces", v: stats.global.revenueCash, c: "bg-sagesse" },
                    ].map((c) => (
                      <div key={c.l}>
                        <div className="flex justify-between text-[11.5px] font-semibold text-sagesse-deep">
                          <span>{c.l}</span><span>{formatFcfa(c.v)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                          <div className={`h-full rounded-full ${c.c}`} style={{ width: `${stats.global.revenue > 0 ? Math.round((c.v / stats.global.revenue) * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={CARD}>
                  <h3 className={TITLE}><Bus size={16} weight="fill" className="text-orange" /> Par zone</h3>
                  <div className="mt-3 space-y-2">
                    {stats.byZone.map((z) => (
                      <div key={z.zoneId} className="rounded-xl bg-creme px-3 py-2">
                        <div className="flex justify-between text-[11.5px] font-semibold text-sagesse-deep">
                          <span>{z.zoneName}</span>
                          <span className="text-[10.5px] text-muted-foreground">{z.paid} payés · {z.remainingSeats} libres · {z.fullBuses}/{z.totalBuses} bus pleins</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Passagers ── */}
      {tab === "pax" && (
        <div className="mt-4 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[170px] flex-1">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sagesse/50" />
              <input
                value={resSearch}
                onChange={(e) => setResSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void loadReservations(1, resSearch, resStatus); }}
                placeholder="Nom, téléphone, référence…"
                className="w-full rounded-xl border border-sagesse/20 bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            </div>
            <select
              value={resStatus}
              onChange={(e) => { setResStatus(e.target.value); void loadReservations(1, resSearch, e.target.value); }}
              className="rounded-xl border border-sagesse/20 bg-white px-3 py-2.5 text-[12.5px] font-semibold text-sagesse-deep outline-none"
            >
              <option value="">Tous les statuts</option>
              <option value="PAID">Payé</option>
              <option value="PENDING">En attente</option>
              <option value="EXPIRED">Expirée</option>
              <option value="CANCELLED">Annulée</option>
            </select>
            <button onClick={() => void loadReservations(1, resSearch, resStatus)} className="press rounded-xl bg-sagesse px-3 py-2.5 text-[12px] font-bold text-creme">
              Chercher
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">{resTotal} résultat(s)</p>

          {resLoading && <div className="flex justify-center py-6"><CircleNotch size={24} className="animate-spin text-sagesse/40" /></div>}

          {/* Panneau détail */}
          {selected && (
            <div className="rounded-2xl border border-or/40 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setSelected(null)} className="press flex items-center gap-1 text-[12px] font-semibold text-sagesse">
                  <ArrowLeft size={14} /> Retour
                </button>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_COLOR[selected.status] ?? ""}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <p className="mt-2 font-display text-lg font-bold text-sagesse-deep">{selected.firstName} {selected.lastName}</p>
              <p className="font-mono text-[11px] text-sagesse/70">{selected.reference}</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[12px]">
                <div><dt className="text-muted-foreground">Téléphone</dt><dd className="font-semibold">{selected.phone}</dd></div>
                <div><dt className="text-muted-foreground">Places</dt><dd className="font-semibold">{selected.seats}</dd></div>
                <div><dt className="text-muted-foreground">Zone</dt><dd className="font-semibold">{selected.zone?.name}</dd></div>
                <div><dt className="text-muted-foreground">Bus</dt><dd className="font-semibold">{selected.bus?.label}</dd></div>
                <div><dt className="text-muted-foreground">Ramassage</dt><dd className="font-semibold">{selected.pickupPoint?.name}</dd></div>
                <div><dt className="text-muted-foreground">Montant</dt><dd className="font-semibold text-orange">{formatFcfa(selected.amountXof)}</dd></div>
                {selected.paidAt && <div className="col-span-2"><dt className="text-muted-foreground">Payé le</dt><dd className="font-semibold">{formatDate(selected.paidAt)}</dd></div>}
                {selected.checkedInAt && <div className="col-span-2"><dt className="text-muted-foreground">Embarqué le</dt><dd className="font-semibold">{formatDate(selected.checkedInAt)}</dd></div>}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.status !== "PAID" && selected.status !== "CANCELLED" && (
                  <button onClick={() => void doMarkPaid(selected)} className="press rounded-lg border border-element/40 px-3 py-2 text-[11px] font-semibold text-sagesse">
                    Encaisser (espèces)
                  </button>
                )}
                {selected.status !== "CANCELLED" && (
                  <button onClick={() => void doCancel(selected)} className="press rounded-lg border border-destructive/30 px-3 py-2 text-[11px] font-semibold text-destructive">
                    Annuler
                  </button>
                )}
                <a
                  href={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/tickets/${selected.publicToken}.pdf`}
                  target="_blank" rel="noreferrer"
                  className="press rounded-lg border border-sagesse/25 px-3 py-2 text-[11px] font-semibold text-sagesse"
                >
                  Billet PDF
                </a>
              </div>
            </div>
          )}

          {!resLoading && reservations.map((r) => (
            <button key={r.id} onClick={() => setSelected(r)} className="press w-full rounded-2xl border border-or/25 bg-white p-3 text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-sagesse-deep">
                    {r.firstName} {r.lastName}
                    {r.checkedInAt && <span className="ml-2 rounded-full bg-element/15 px-1.5 py-0.5 text-[9.5px] font-bold text-sagesse">À bord</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{r.phone} · {r.seats} pl. · {r.bus?.label}</p>
                  <p className="font-mono text-[10.5px] text-sagesse/70">{r.reference}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-sm font-bold text-orange">{formatFcfa(r.amountXof)}</p>
                  <span className={`text-[10px] font-bold uppercase ${STATUS_COLOR[r.status] ?? ""}`}>{STATUS_LABEL[r.status]}</span>
                </div>
              </div>
            </button>
          ))}

          {resPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={resPage <= 1} onClick={() => void loadReservations(resPage - 1, resSearch, resStatus)}
                className="press rounded-lg border border-sagesse/20 px-3 py-2 text-[12px] font-semibold text-sagesse disabled:opacity-40">
                <ArrowLeft size={14} />
              </button>
              <span className="text-[12px] text-muted-foreground">{resPage} / {resPages}</span>
              <button disabled={resPage >= resPages} onClick={() => void loadReservations(resPage + 1, resSearch, resStatus)}
                className="press rounded-lg border border-sagesse/20 px-3 py-2 text-[12px] font-semibold text-sagesse disabled:opacity-40">
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Check-in ── */}
      {tab === "scan" && (
        <div className="mt-4 max-w-md space-y-3">
          <div className={CARD}>
            <h3 className={TITLE}><IdentificationCard size={16} weight="fill" className="text-orange" /> Contrôle d'embarquement</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">Scannez le QR code ou saisissez la référence.</p>

            {/* Bouton caméra */}
            <button
              onClick={() => { setCameraActive(!cameraActive); setScanResult(null); }}
              className={`press mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold ${
                cameraActive ? "border-orange bg-orange/10 text-orange" : "border-sagesse/25 text-sagesse"
              }`}
            >
              <IdentificationCard size={16} weight="fill" />
              {cameraActive ? "Arrêter la caméra" : "Scanner avec la caméra"}
            </button>

            {cameraActive && (
              <div className="mt-3">
                <QrScanner active={cameraActive} onResult={handleScanResult} />
              </div>
            )}

            <form onSubmit={(e) => void doCheckIn(e)} className="mt-3 flex gap-2">
              <input
                value={scanRef}
                onChange={(e) => setScanRef(e.target.value)}
                placeholder="HIKMA-20A-XXXXXX"
                className="flex-1 rounded-xl border border-sagesse/20 bg-creme px-3 py-3 font-mono text-sm uppercase outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
              <button type="submit" disabled={scanLoading} className="press rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                {scanLoading ? <CircleNotch size={16} className="animate-spin" /> : "Valider"}
              </button>
            </form>
            {scanResult && (
              <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-[12.5px] font-semibold ${
                scanResult.ok ? "bg-element/15 text-sagesse" : "bg-destructive/10 text-destructive"
              }`}>
                {scanResult.ok ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} weight="fill" />}
                {scanResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "bus" && <BusPanel zones={zones} />}
      {tab === "zones" && <ZonesPanel zones={zones} onRefresh={() => void loadStats()} />}
      {tab === "set" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsPanel />
          <PickupPointsPanel zones={zones} />
        </div>
      )}
    </div>
  );
}
