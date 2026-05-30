import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Trash2, X, ArchiveRestore } from "lucide-react";
import { listIncidents, updateIncident, deleteIncident, deleteIncidentDefinitive } from "../lib/dataApi";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "";

const ADMIN_ROLES = ["creator", "admin_total", "admin_menor"];

export default function Incidents() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [motivo, setMotivo] = useState("");

  const canEdit = ADMIN_ROLES.includes(user?.role);
  const canRestore = user?.role === "creator" || user?.role === "admin_total";
  const canDelete = user?.role === "creator";

  const refresh = async () => {
    setLoading(true);
    try { const data = await listIncidents(); setItems(data); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateIncident(editing.incidencia_id, { motivo });
      toast.success("Incidencia actualizada");
      setEditing(null); setMotivo("");
      refresh();
    } catch (e) { toast.error(e?.message || "Error"); }
  };

  const restoreInc = async (inc) => {
    if (!window.confirm(`¿Devolver "${inc.producto_nombre}" al stock inicial?`)) return;
    try {
      // 1. Lo pasamos al stock para que vuelva a contar en tus números
      const { error: prodErr } = await supabase
        .from("productos")
        .update({ estado: 'inventario' })
        .eq("product_id", inc.product_id);
      
      if (prodErr) throw prodErr;

      // 2. Solo borramos el aviso de la incidencia (el producto se salva)
      await deleteIncident(inc.incidencia_id);

      toast.success("Producto devuelto al stock");
      refresh();
    } catch (e) { toast.error(e?.message || "Error al restaurar"); }
  };

  const deleteInc = async (inc) => {
    if (!window.confirm("¿Eliminar DEFINITIVAMENTE? El producto desaparecerá por completo de la aplicación, como si nunca hubiera existido.")) return;
    try {
      // Usamos el botón nuclear para borrar ambas cosas
      await deleteIncidentDefinitive(inc.incidencia_id, inc.product_id);
      toast.success("Producto borrado por completo");
      refresh();
    } catch (e) { toast.error(e?.message || "Error"); }
  };

  return (
    <div className="px-4 md:px-8 pt-6 pb-32 max-w-3xl mx-auto fade-up">
      <header className="mb-6">
        <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">Devoluciones y problemas</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="font-display text-3xl md:text-4xl font-semibold">Incidencias</h1>
          {!canEdit && (
            <span className="text-[11px] text-white/40 border border-white/10 rounded-full px-2.5 py-1">
              Solo lectura
            </span>
          )}
        </div>
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
              
              <div className="flex flex-col justify-center gap-1 border-l border-white/5 pl-2 ml-2">
                {canEdit && (
                  <button
                    data-testid={`edit-inc-${i.incidencia_id}`}
                    onClick={() => { setEditing(i); setMotivo(i.motivo); }}
                    className="p-1.5 rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                    title="Editar motivo"
                  ><Pencil size={15}/></button>
                )}
                
                {canRestore && (
                  <button
                    onClick={() => restoreInc(i)}
                    className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400/70 hover:text-emerald-400 transition-colors"
                    title="Devolver al stock inicial"
                  ><ArchiveRestore size={15}/></button>
                )}

                {canDelete && (
                  <button
                    data-testid={`delete-inc-${i.incidencia_id}`}
                    onClick={() => deleteInc(i)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-400/70 hover:text-red-400 transition-colors"
                    title="Borrar producto de la aplicación"
                  ><Trash2 size={15}/></button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl p-6 relative" onClick={e=>e.stopPropagation()}>
            <button onClick={() => setEditing(null)} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/5"><X size={16}/></button>
            <h3 className="font-display text-2xl font-semibold mb-1">Editar incidencia</h3>
            <p className="text-white/50 text-sm mb-4">{editing.producto_nombre}</p>
            <textarea
              data-testid="input-edit-motivo"
              value={motivo} onChange={e=>setMotivo(e.target.value)}
              rows={4}
              className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm mb-4 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">Cancelar</button>
              <button data-testid="save-inc-edit" onClick={saveEdit} className="flex-1 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
