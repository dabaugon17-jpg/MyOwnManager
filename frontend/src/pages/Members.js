import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Shield, ShieldCheck, User as UserIcon, Trash2, Loader2, AlertTriangle } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const ROLE_META = {
  creator:     { label: "Creador",         icon: Crown,       color: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/20" },
  admin_total: { label: "Admin total",     icon: ShieldCheck, color: "text-white",      bg: "bg-white/10 border-white/20" },
  admin_menor: { label: "Admin (menor)",   icon: Shield,      color: "text-blue-300",   bg: "bg-blue-500/10 border-blue-500/20" },
  member:      { label: "Miembro",         icon: UserIcon,    color: "text-white/60",   bg: "bg-white/5 border-white/10" },
};

export default function Members() {
  const navigate = useNavigate();
  const { user, checkAuth, logout } = useAuth();
  const [members, setMembers] = useState([]);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [m, g] = await Promise.all([api.get("/groups/members"), api.get("/groups/me")]);
      setMembers(m.data); setGroup(g.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const myRole = user?.role || "member";
  const canManage = ["creator", "admin_total"].includes(myRole);
  const isCreator = myRole === "creator";
  const isOriginalOwner = group?.admin_id === user?.user_id;

  const setRole = async (m, role) => {
    try {
      await api.put(`/groups/members/${m.user_id}/role`, { role });
      toast.success(`Rol actualizado: ${ROLE_META[role].label}`);
      refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };

  const removeMember = async (m) => {
    if (!window.confirm(`¿Eliminar a ${m.name} del grupo?`)) return;
    try {
      await api.delete(`/groups/members/${m.user_id}`);
      toast.success("Miembro eliminado");
      refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };

  const deleteGroup = async () => {
    try {
      await api.delete("/groups");
      toast.success("Grupo eliminado");
      await checkAuth();
      navigate("/onboarding", { replace: true });
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };

  const leaveGroup = async () => {
    // member self-leaves by calling the remove endpoint? We don't have a self-leave. We can implement quick logout-like by calling DELETE on self. Backend rejects self-remove. Skip for now; show note instead.
    toast.info("Pide a un administrador que te elimine del grupo");
  };

  const ROLE_OPTIONS = isCreator
    ? ["creator", "admin_total", "admin_menor", "member"]
    : ["admin_total", "admin_menor", "member"]; // admin_total cannot promote to creator

  return (
    <div className="px-4 md:px-8 pt-6 pb-32 max-w-3xl mx-auto fade-up">
      <header className="mb-6 flex items-center gap-3">
        <button data-testid="back-btn" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5">
          <ArrowLeft size={18}/>
        </button>
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">Equipo</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Miembros</h1>
        </div>
      </header>

      {group && (
        <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-1">Código de invitación</p>
            <p className="font-display text-xl tracking-[0.3em] font-semibold truncate">{group.codigo_union}</p>
          </div>
          <button
            data-testid="copy-code-btn"
            onClick={() => { navigator.clipboard.writeText(group.codigo_union); toast.success("Código copiado"); }}
            className="px-3 py-2 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90"
          >Copiar</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-white/40"><Loader2 className="animate-spin inline" size={20}/></div>
      ) : (
        <div data-testid="members-list" className="space-y-3">
          {members.map(m => {
            const meta = ROLE_META[m.role] || ROLE_META.member;
            const Icon = meta.icon;
            const isMe = m.user_id === user?.user_id;
            const canChange = canManage && !isMe && !(m.role === "creator" && !isCreator);
            return (
              <div key={m.user_id} data-testid={`member-${m.user_id}`} className="bg-[#141414] border border-white/10 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {m.picture ? <img src={m.picture} alt="" className="w-full h-full object-cover"/> : <UserIcon size={16} className="text-white/40"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                      {isMe && <span className="text-[10px] uppercase tracking-widest text-white/40">tú</span>}
                      {m.is_owner && <span className="text-[10px] uppercase tracking-widest text-amber-300/80">propietario</span>}
                    </div>
                    <p className="text-[11px] text-white/40 truncate">{m.email}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium ${meta.bg} ${meta.color}`}>
                    <Icon size={11}/> {meta.label}
                  </span>
                </div>

                {canChange && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ROLE_OPTIONS.map(r => (
                      <button
                        key={r}
                        data-testid={`set-role-${m.user_id}-${r}`}
                        onClick={() => setRole(m, r)}
                        disabled={m.role === r}
                        className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                          m.role === r
                            ? "bg-white text-black border-white cursor-default"
                            : "border-white/10 text-white/70 hover:bg-white/5 hover:border-white/20"
                        }`}
                      >{ROLE_META[r].label}</button>
                    ))}
                    {canManage && !m.is_owner && (
                      <button
                        data-testid={`remove-${m.user_id}`}
                        onClick={() => removeMember(m)}
                        className="ml-auto px-2.5 py-1 rounded-md text-[11px] border border-red-500/20 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
                      ><Trash2 size={11}/> Expulsar</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-white/10">
        <h3 className="font-display text-lg font-medium mb-3">Zona avanzada</h3>
        {isOriginalOwner ? (
          <>
            <p className="text-xs text-white/50 mb-3">Como creador original del grupo, puedes eliminarlo. Esta acción borra productos, ventas e incidencias.</p>
            <button
              data-testid="delete-group-btn"
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/25 flex items-center gap-2"
            ><AlertTriangle size={14}/> Eliminar grupo</button>
          </>
        ) : (
          <p className="text-xs text-white/40">Solo el creador original puede eliminar el grupo.</p>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-md bg-[#141414] border border-red-500/30 rounded-2xl p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3 text-red-400">
              <AlertTriangle size={20}/>
              <h3 className="font-display text-xl font-semibold">¿Eliminar el grupo?</h3>
            </div>
            <p className="text-sm text-white/60 mb-5">Se borrarán productos, ventas e incidencias. Los miembros quedarán sin grupo. Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-lg border border-white/10 hover:bg-white/5">Cancelar</button>
              <button data-testid="confirm-delete-group" onClick={deleteGroup} className="flex-1 py-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-500/90">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
