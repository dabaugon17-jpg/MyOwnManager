import React, { useEffect, useState } from "react";
import { Receipt, AlertCircle, Loader2 } from "lucide-react";
import api, { buildFileUrl } from "../lib/api";
import { toast } from "sonner";

const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "";

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incTarget, setIncTarget] = useState(null);
  const [motivo, setMotivo] = useState("");

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/sales");
      setSales(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const confirmIncidencia = async () => {
    if (!incTarget) return;
    try {
      await api.post(`/products/${incTarget.product_id}/incidencia`, { motivo: motivo || "Sin especificar" });
      toast.success("Incidencia registrada");
      setIncTarget(null); setMotivo("");
      fetch();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };

  return (
    <div className="px-4 md:px-8 pt-6 pb-32 max-w-3xl mx-auto fade-up">
      <header className="mb-6">
        <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">Histórico</p>
        <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Ventas</h1>
      </header>

      {loading ? (
        <div className="text-center py-16 text-white/40"><Loader2 className="animate-spin inline" size={20}/></div>
      ) : sales.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
          <Receipt className="mx-auto text-white/30 mb-3" size={28}/>
          <p className="text-white/50 text-sm">Aún no has registrado ventas</p>
        </div>
      ) : (
        <div data-testid="sales-list" className="divide-y divide-white/10 border border-white/10 rounded-2xl overflow-hidden bg-[#141414]">
          {sales.map(s => {
            const margin = (s.precio_venta || 0) - (s.precio_compra || 0);
            const marginPct = s.precio_compra ? (margin / s.precio_compra) * 100 : 0;
            const img = buildFileUrl(s.foto_url);
            return (
              <div key={s.product_id} data-testid={`sale-row-${s.product_id}`} className="flex items-center gap-3 p-4 hover:bg-white/[0.02]">
                <div className="w-12 h-12 rounded-lg bg-black/60 overflow-hidden flex-shrink-0">
                  {img ? <img src={img} alt={s.nombre} className="w-full h-full object-cover"/> : <Receipt className="w-full h-full p-3 text-white/30"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.nombre}</p>
                  <p className="text-xs text-white/40 mt-0.5">{fmtDate(s.sold_at)} · Compra {fmt(s.precio_compra)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{fmt(s.precio_venta)}</p>
                  <p className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded mt-1">
                    +{fmt(margin)} ({marginPct.toFixed(0)}%)
                  </p>
                </div>
                <button
                  data-testid={`incidencia-btn-${s.product_id}`}
                  onClick={() => setIncTarget(s)}
                  className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded text-[11px] font-semibold hover:bg-red-500/20 flex items-center gap-1"
                >
                  <AlertCircle size={12}/> Incidencia
                </button>
              </div>
            );
          })}
        </div>
      )}

      {incTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIncTarget(null)}>
          <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-display text-2xl font-semibold mb-1">Reportar incidencia</h3>
            <p className="text-white/50 text-sm mb-4">{incTarget.nombre}</p>
            <textarea
              data-testid="input-incidencia-motivo"
              value={motivo} onChange={e=>setMotivo(e.target.value)}
              placeholder="Motivo (devolución, defecto, etc.)"
              rows={3}
              className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm mb-4 resize-none"
            />
            <div className="flex gap-2">
              <button data-testid="cancel-incidencia" onClick={() => setIncTarget(null)} className="flex-1 py-3 rounded-lg border border-white/10 hover:bg-white/5">Cancelar</button>
              <button data-testid="confirm-incidencia" onClick={confirmIncidencia} className="flex-1 py-3 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 font-medium hover:bg-red-500/30">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
