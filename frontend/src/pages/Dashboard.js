import React, { useEffect, useState } from "react";
import { TrendingUp, Wallet, PiggyBank, LogOut, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const FILTERS = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("month");
  const [group, setGroup] = useState(null);

  useEffect(() => {
    api.get(`/dashboard?filter=${filter}`).then(r => setData(r.data)).catch(() => {});
  }, [filter]);

  useEffect(() => {
    api.get("/groups/me").then(r => setGroup(r.data)).catch(() => {});
  }, []);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="px-4 md:px-8 pt-6 pb-32 max-w-5xl mx-auto fade-up">
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">{group?.nombre_negocio || "Tu negocio"}</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Hola, {user?.name?.split(" ")[0] || "👋"}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="members-btn"
            onClick={() => navigate("/app/miembros")}
            className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white"
            aria-label="Miembros"
          >
            <Users size={18}/>
          </button>
          <button data-testid="logout-btn" onClick={onLogout} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white">
            <LogOut size={18}/>
          </button>
        </div>
      </header>

      <section data-testid="kpi-section" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <KpiCard testid="kpi-facturacion" icon={<TrendingUp size={18}/>} label="Facturación total" value={fmt(data?.facturacion_total)} accent="from-emerald-500/10"/>
        <KpiCard testid="kpi-beneficio" icon={<Wallet size={18}/>} label="Beneficio neto" value={fmt(data?.beneficio_neto)} accent="from-white/10"/>
        <KpiCard testid="kpi-inversion" icon={<PiggyBank size={18}/>} label="Inversión" value={fmt(data?.inversion)} accent="from-amber-500/10"/>
      </section>

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
                formatter={(v) => [fmt(v), "Ingresos"]}
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
