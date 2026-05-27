import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import api from "../lib/api";

const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "";

export default function Incidents() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/incidents").then(r => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 md:px-8 pt-6 pb-32 max-w-3xl mx-auto fade-up">
      <header className="mb-6">
        <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">Devoluciones y problemas</p>
        <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Incidencias</h1>
      </header>

      {loading ? (
        <div className="text-center py-16 text-white/40"><Loader2 className="animate-spin inline" size={20}/></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
          <AlertTriangle className="mx-auto text-white/30 mb-3" size={28}/>
          <p className="text-white/50 text-sm">No hay incidencias registradas</p>
        </div>
      ) : (
        <div data-testid="incidents-list" className="space-y-3">
          {items.map(i => (
            <div key={i.incidencia_id} data-testid={`incident-${i.incidencia_id}`} className="bg-[#141414] border border-red-500/15 rounded-2xl p-4 flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-red-400"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium truncate">{i.producto_nombre}</h4>
                  <span className="text-[11px] text-white/40 flex-shrink-0">{fmtDate(i.created_at)}</span>
                </div>
                <p className="text-xs text-white/60 mt-1">{i.motivo}</p>
                {i.precio_venta != null && (
                  <p className="text-[11px] text-white/40 mt-1.5">Venta: {fmt(i.precio_venta)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
