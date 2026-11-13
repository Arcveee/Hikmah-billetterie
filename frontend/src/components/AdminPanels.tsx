import { useState } from "react";
import {
  CircleNotch,
  LockKey,
  MapPin,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import * as api from "../services/api";
import type { ApiBus, ApiPickupPoint, ApiSettings, ApiAdminZone } from "../services/api";

export const CARD = "rounded-2xl border border-or/25 bg-white p-4";
export const IN =
  "w-full rounded-xl border border-sagesse/20 bg-creme px-3 py-2.5 text-[12.5px] font-semibold text-sagesse-deep outline-none focus:border-orange focus:ring-2 focus:ring-orange/20";
export const EYE = "mb-1 block text-[10.5px] font-semibold uppercase tracking-widest text-sagesse/70";
export const TITLE = "flex items-center gap-1.5 font-display text-base font-bold text-sagesse-deep";

/* ── Login ── */

export function AdminLoginGate({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, admin } = await api.adminLogin(username, password);
      sessionStorage.setItem("hikma-admin-token", token);
      sessionStorage.setItem("hikma-admin-username", admin.username);
      toast.success(`Bienvenue, ${admin.username}.`);
      onLogin(token, admin.username);
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-3xl border border-or/40 bg-white p-6 shadow-lg"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-sagesse text-or">
          <LockKey size={24} weight="fill" />
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold text-sagesse-deep">Espace Commission Transport</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Accès réservé à la commission.</p>
        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className={EYE}>Identifiant</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className={IN}
              placeholder="admin"
            />
          </label>
          <label className="block">
            <span className={EYE}>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={IN}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="press mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sagesse px-4 py-3 text-sm font-bold text-creme disabled:opacity-60"
        >
          {loading && <CircleNotch size={16} className="animate-spin" />}
          Connexion
        </button>
      </form>
    </div>
  );
}

/* ── Bus Panel ── */

export function BusPanel({ zones }: { zones: ApiAdminZone[] }) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [buses, setBuses] = useState<ApiBus[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState({ count: 1, capacity: 50, departureTime: "08:00", arrivalTime: "09:30", returnTime: "", returnLocation: "" });

  const load = async (zid = zoneId) => {
    setLoading(true);
    try {
      const { buses: b } = await api.getAdminBuses(zid);
      setBuses(b);
    } finally {
      setLoading(false);
    }
  };

  // Charger au montage et au changement de zone
  useState(() => { void load(); });

  const toggle = async (bus: ApiBus) => {
    try {
      await api.updateBus(bus.id, { isOpen: !bus.isOpen });
      toast.success(bus.isOpen ? "Bus fermé." : "Bus rouvert.");
      void load();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Erreur.");
    }
  };

  const doDelete = async (bus: ApiBus) => {
    if (!confirm(`Supprimer ${bus.label} ?`)) return;
    try {
      await api.deleteBus(bus.id);
      toast.success("Bus supprimé.");
      void load();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Ce bus a des réservations actives.");
    }
  };

  const doBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { count } = await api.bulkCreateBuses({
        zoneId,
        count: bulk.count,
        capacity: bulk.capacity,
        departureTime: bulk.departureTime,
        arrivalTime: bulk.arrivalTime,
        returnTime: bulk.returnTime || undefined,
        returnLocation: bulk.returnLocation || undefined,
      });
      toast.success(`${count} bus créé(s).`);
      setShowBulk(false);
      void load();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Erreur.");
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {/* Zone selector */}
      <div className="flex flex-wrap items-center gap-2">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => { setZoneId(z.id); void load(z.id); }}
            className={`press rounded-full px-3 py-1.5 text-[12px] font-semibold ${zoneId === z.id ? "bg-sagesse text-creme" : "bg-white ring-1 ring-sagesse/20 text-sagesse-deep"}`}
          >
            {z.name}
          </button>
        ))}
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="press ml-auto flex items-center gap-1.5 rounded-xl bg-sagesse px-3 py-2 text-[12px] font-bold text-creme"
        >
          <Plus size={14} weight="bold" /> Créer en masse
        </button>
      </div>

      {/* Bulk form */}
      {showBulk && (
        <form onSubmit={(e) => void doBulk(e)} className={CARD + " space-y-3"}>
          <p className={TITLE}>Création en masse</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { l: "Nombre de bus", k: "count", t: "number" },
              { l: "Capacité / bus", k: "capacity", t: "number" },
              { l: "Départ", k: "departureTime", t: "time" },
              { l: "Arrivée Dakar Arena", k: "arrivalTime", t: "time" },
              { l: "Retour (optionnel)", k: "returnTime", t: "time" },
              { l: "Lieu retour", k: "returnLocation", t: "text" },
            ].map((f) => (
              <label key={f.k} className="block">
                <span className={EYE}>{f.l}</span>
                <input
                  type={f.t}
                  value={bulk[f.k as keyof typeof bulk]}
                  onChange={(e) => setBulk({ ...bulk, [f.k]: f.t === "number" ? Number(e.target.value) : e.target.value })}
                  className={IN}
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="press rounded-xl bg-sagesse px-4 py-2 text-[12px] font-bold text-creme">Créer</button>
            <button type="button" onClick={() => setShowBulk(false)} className="press rounded-xl border border-sagesse/25 px-4 py-2 text-[12px] font-semibold text-sagesse">Annuler</button>
          </div>
        </form>
      )}

      {loading && <div className="flex justify-center py-6"><CircleNotch size={24} className="animate-spin text-sagesse/40" /></div>}

      {buses.map((b) => {
        const pct = Math.round((b.seatsTaken / b.capacity) * 100);
        return (
          <div key={b.id} className="rounded-2xl border border-or/25 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-[15px] font-bold text-sagesse-deep">{b.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  Départ {b.departureTime} · Arrivée {b.arrivalTime} · {b.remainingSeats} libre(s)
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${!b.isOpen ? "bg-destructive/10 text-destructive" : b.remainingSeats === 0 ? "bg-orange/15 text-orange" : "bg-element/15 text-sagesse"}`}>
                {!b.isOpen ? "Fermé" : b.remainingSeats === 0 ? "Complet" : "Ouvert"}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${b.remainingSeats === 0 ? "bg-orange" : "bg-element"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[10.5px] text-muted-foreground">{b.seatsTaken} / {b.capacity} places</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => void toggle(b)} className="press rounded-lg border border-sagesse/25 px-2.5 py-1.5 text-[11px] font-semibold text-sagesse">
                {b.isOpen ? "Fermer" : "Réouvrir"}
              </button>
              <button onClick={() => void doDelete(b)} className="press flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-[11px] font-semibold text-destructive">
                <Trash size={12} weight="bold" /> Supprimer
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Settings Panel ── */

export function SettingsPanel() {
  const [settings, setSettings] = useState<ApiSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useState(() => {
    void api.getSettings().then(({ settings: s }) => setSettings(s)).catch(() => {});
  });

  if (!settings) return <div className="flex justify-center py-8"><CircleNotch size={24} className="animate-spin text-sagesse/40" /></div>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { settings: s } = await api.updateSettings({
        eventName: settings.eventName,
        eventDate: settings.eventDate,
        venue: settings.venue,
        priceRoundTripXof: settings.priceRoundTripXof,
        priceOneWayXof: settings.priceOneWayXof,
        lockMinutes: settings.lockMinutes,
        maxSeatsPerOrder: settings.maxSeatsPerOrder,
        whatsappContact: settings.whatsappContact,
      });
      setSettings(s);
      toast.success("Réglages enregistrés.");
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void save(e)} className={`mt-4 ${CARD} space-y-3`}>
      <p className={TITLE}>Réglages de l'événement</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { l: "Nom de l'événement", k: "eventName", t: "text" },
          { l: "Date", k: "eventDate", t: "date" },
          { l: "Lieu", k: "venue", t: "text" },
          { l: "Aller-retour (FCFA)", k: "priceRoundTripXof", t: "number" },
          { l: "Aller simple (FCFA)", k: "priceOneWayXof", t: "number" },
          { l: "Blocage place (min)", k: "lockMinutes", t: "number" },
          { l: "Places max / résa", k: "maxSeatsPerOrder", t: "number" },
          { l: "WhatsApp commission", k: "whatsappContact", t: "text" },
        ].map((f) => (
          <label key={f.k} className="block">
            <span className={EYE}>{f.l}</span>
            <input
              type={f.t}
              value={f.k === "eventDate" ? settings.eventDate.slice(0, 10) : String(settings[f.k as keyof ApiSettings])}
              onChange={(e) => setSettings({ ...settings, [f.k]: f.t === "number" ? Number(e.target.value) : e.target.value })}
              className={IN}
            />
          </label>
        ))}
      </div>
      <button type="submit" disabled={saving} className="press flex items-center gap-2 rounded-xl bg-sagesse px-4 py-2.5 text-[12.5px] font-bold text-creme disabled:opacity-60">
        {saving && <CircleNotch size={14} className="animate-spin" />}
        Enregistrer
      </button>
    </form>
  );
}

/* ── Pickup Points Panel ── */

export function PickupPointsPanel({ zones }: { zones: ApiAdminZone[] }) {
  const [points, setPoints] = useState<ApiPickupPoint[]>([]);
  const [newName, setNewName] = useState("");
  const [newZoneId, setNewZoneId] = useState(zones[0]?.id ?? "");

  useState(() => {
    void api.getPickupPoints().then(({ pickupPoints }) => setPoints(pickupPoints)).catch(() => {});
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { pickupPoint } = await api.createPickupPoint({ zoneId: newZoneId, name: newName.trim() });
      setPoints([...points, pickupPoint]);
      setNewName("");
      toast.success("Point ajouté.");
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Erreur.");
    }
  };

  const toggle = async (p: ApiPickupPoint) => {
    try {
      const { pickupPoint } = await api.updatePickupPoint(p.id, { isActive: !p.isActive });
      setPoints(points.map((x) => (x.id === p.id ? pickupPoint : x)));
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Erreur.");
    }
  };

  const remove = async (p: ApiPickupPoint) => {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    try {
      await api.deletePickupPoint(p.id);
      setPoints(points.filter((x) => x.id !== p.id));
      toast.success("Point supprimé.");
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Ce point a des réservations.");
    }
  };

  return (
    <div className={`mt-4 ${CARD} space-y-3`}>
      <p className={TITLE}><MapPin size={16} weight="fill" className="text-orange" /> Points de ramassage</p>
      <div className="space-y-1.5">
        {points.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg bg-creme px-2.5 py-2 text-[12px]">
            <span className={`font-semibold ${p.isActive ? "text-sagesse-deep" : "text-muted-foreground line-through"}`}>
              {p.name} <span className="text-[10px] text-muted-foreground">({p.zone?.name})</span>
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => void toggle(p)} className="press text-[10px] font-semibold text-sagesse underline">
                {p.isActive ? "Désactiver" : "Activer"}
              </button>
              <button onClick={() => void remove(p)} className="press text-destructive"><Trash size={13} weight="bold" /></button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => void add(e)} className="flex gap-2">
        <select value={newZoneId} onChange={(e) => setNewZoneId(e.target.value)} className="rounded-xl border border-sagesse/20 bg-creme px-2 py-2 text-[12px] font-semibold text-sagesse-deep">
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nouveau point" className={IN + " flex-1"} />
        <button type="submit" className="press rounded-xl bg-sagesse px-3 py-2 text-[12px] font-bold text-creme">
          <Plus size={14} weight="bold" />
        </button>
      </form>
    </div>
  );
}

/* ── Zones Panel ── */

export function ZonesPanel({ zones, onRefresh }: { zones: ApiAdminZone[]; onRefresh: () => void }) {
  const [newName, setNewName] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.createZone({ name: newName.trim(), displayOrder: zones.length });
      setNewName("");
      toast.success("Zone créée.");
      onRefresh();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Erreur.");
    }
  };

  const toggle = async (z: ApiAdminZone) => {
    try {
      await api.updateZone(z.id, { isActive: !z.isActive });
      toast.success(z.isActive ? "Zone désactivée." : "Zone activée.");
      onRefresh();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Erreur.");
    }
  };

  return (
    <div className={`mt-4 ${CARD} space-y-3`}>
      <p className={TITLE}>Zones de départ</p>
      <div className="space-y-1.5">
        {zones.map((z) => (
          <div key={z.id} className="flex items-center justify-between rounded-lg bg-creme px-2.5 py-2 text-[12px]">
            <span className={`font-semibold ${z.isActive ? "text-sagesse-deep" : "text-muted-foreground line-through"}`}>{z.name}</span>
            <button onClick={() => void toggle(z)} className="press text-[10px] font-semibold text-sagesse underline">
              {z.isActive ? "Désactiver" : "Activer"}
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => void add(e)} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nouvelle zone" className={IN + " flex-1"} />
        <button type="submit" className="press rounded-xl bg-sagesse px-3 py-2 text-[12px] font-bold text-creme">
          <Plus size={14} weight="bold" />
        </button>
      </form>
    </div>
  );
}


