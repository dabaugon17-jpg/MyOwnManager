import React, { useEffect, useState, useMemo } from "react";
import { TrendingUp, Wallet, PiggyBank, LogOut, Users, Target, Boxes } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getDashboard, getMyGroup, getGroupMembers } from "../lib/dataApi";

const FILTERS = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const fmtPrecise = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("month");
  const [vendedor, setVendedor] = useState("");
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    getDashboard({ filter, vendedor_id: vendedor || null })
      .then(setData)
      .catch(() => {});
  }, [filter, vendedor]);

  useEffect(() => {
    getMyGroup().then(setGroup).catch(() => {});
    getGroupMembers().then(setMembers).catch(() => {});
  }, []);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const progressPct = Math.min(100, data?.progreso_pct || 0);
  const onTrack = useMemo(() => {
    if (!data?.objetivo_mensual) return null;
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const expectedPct = (day / daysInMonth) * 100;
    return progressPct >= expectedPct;
  }, [data, progressPct]);

  return (
    <div className="px-4 md:px-8 pt-6 pb-32 max-w-5xl mx-auto fade-up">
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">{group?.nombre_negocio || "Tu negocio"}</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Hola, {user?.name?.split(" ")[0] || "👋"}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button data-testid="members-btn" onClick={() => navigate("/app/miembros")} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white" aria-label="Miembros">
            <Users size={18}/>
          </button>
          <button data-testid="logout-btn" onClick={onLogout} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white">
            <LogOut size={18}/>
          </button>
        </div>
      </header>

      {members.length > 1 && (
        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] tracking-[0.2em] uppercase text-white/40">Filtrar:</span>
          <button
            data-testid="vendor-all"
            onClick={() => setVendedor("")}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${vendedor === "" ? "bg-white text-black border-white" : "border-white/10 text-white/70 hover:bg-white/5"}`}
          >Todos</button>
          {members.map(m => (
            <button
              key={m.user_id}
              data-testid={`vendor-${m.user_id}`}
              onClick={() => setVendedor(m.user_id)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${vendedor === m.user_id ? "bg-white text-black border-white" : "border-white/10 text-white/70 hover:bg-white/5"}`}
            >{m.name?.split(" ")[0] || m.email}</button>
          ))}
        </div>
      )}

      <section data-testid="kpi-section" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiCard testid="kpi-facturacion" icon={<TrendingUp size={18}/>} label="Facturación total" value={fmt(data?.facturacion_total)} accent="from-emerald-500/10"/>
        <KpiCard testid="kpi-beneficio" icon={<Wallet size={18}/>} label="Beneficio neto" value={fmt(data?.beneficio_neto)} accent="from-white/10"/>
        <KpiCard testid="kpi-inversion" icon={<PiggyBank size={18}/>} label="Inversión total" value={fmt(data?.inversion)} accent="from-amber-500/10"/>
      </section>

      <section className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/50 text-[11px] tracking-[0.2em] uppercase mb-2">
            <Boxes size={14}/> Stock actual
          </div>
          <p className="font-display text-2xl font-semibold">{data?.stock_count ?? 0}</p>
          <p className="text-xs text-white/40 mt-0.5">{fmtPrecise(data?.stock_value)} en valor</p>
        </div>
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/50 text-[11px] tracking-[0.2em] uppercase mb-2">
            <TrendingUp size={14}/> Este mes
          </div>
          <p className="font-display text-2xl font-semibold">{fmt(data?.facturacion_mes)}</p>
          <p className="text-xs text-white/40 mt-0.5">{data?.ventas_mes ?? 0} venta{(data?.ventas_mes ?? 0) !== 1 ? "s" : ""}</p>
        </div>
      </section>

      {data?.objetivo_mensual > 0 ? (
        <section data-testid="target-section" className="bg-[#141414] border border-white/10 rounded-2xl p-5 mb-8 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white/60 text-[11px] tracking-[0.2em] uppercase">
              <Target size={14}/> Objetivo del mes
            </div>
            <span className={`text-xs font-medium ${onTrack ? "text-emerald-400" : "text-amber-400"}`}>
              {onTrack ? "↑ En ritmo" : "↓ Por debajo del ritmo"}
            </span>
          </div>
          <div className="flex items-end gap-3 mb-3">
            <p className="font-display text-3xl font-semibold">{fmt(data.facturacion_mes)}</p>
            <p className="text-white/40 text-sm mb-1">de {fmt(data.objetivo_mensual)}</p>
            <p data-testid="target-pct" className="ml-auto text-2xl font-display font-semibold tabular-nums">{progressPct.toFixed(0)}%</p>
          </div>
          <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-white transition-all duration-700" style={{ width: `${progressPct}%` }}/>
          </div>
        </section>
      ) : (
        <section className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-5 mb-8 text-center">
          <Target className="mx-auto text-white/30 mb-2" size={20}/>
          <p className="text-sm text-white/50 mb-2">Sin objetivo de mes definido</p>
          <button onClick={() => navigate("/app/miembros")} className="text-xs text-white underline underline-offset-4 hover:no-underline">
            Definir en Miembros →
          </button>
        </section>
      )}

      <section className="bg-[#141414] border border-white/10 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">Ingresos</p>
            <h3 className="font-display text-xl font-medium mt-1">Ventas en el tiempo</h3>
          </div>
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
            {FILTERS.map(f => (
              <button key={f.key}
                data-testid={`filter-${f.key}`}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${filter === f.key ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
              >{f.label}</button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.chart || []} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="#A1A1AA" fontSize={11} axisLine={false} tickLine={false}/>
              <YAxis stroke="#A1A1AA" fontSize={11} axisLine={false} tickLine={false}/>
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [fmtPrecise(v), "Ingresos"]}
              />
              <Bar dataKey="value" fill="#FFFFFF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {group?.codigo_union && (
        <div className="mt-6 flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <span className="text-xs text-white/50 tracking-widest uppercase">Código de tu negocio</span>
          <span data-testid="my-group-code" className="font-display text-lg font-semibold tracking-[0.3em]">{group.codigo_union}</span>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, accent, testid }) {
  return (
    <div data-testid={testid} className="relative bg-[#141414] border border-white/10 rounded-2xl p-5 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} to-transparent opacity-60 pointer-events-none`}/>
      <div className="relative">
        <div className="flex items-center gap-2 text-white/50 text-[11px] tracking-[0.2em] uppercase">{icon} {label}</div>
        <p className="font-display text-3xl md:text-4xl font-semibold mt-3 tracking-tight">{value}</p>
      </div>
    </div>
  );
}
