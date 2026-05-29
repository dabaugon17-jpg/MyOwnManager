import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Check, Copy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { createGroup, joinGroupByCode } from "../lib/dataApi";
import { toast } from "sonner";

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [mode, setMode] = useState("create"); // create | join
  const [businessName, setBusinessName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await createGroup(businessName);
      await refresh();
      setCreatedCode(data.codigo_union);
      toast.success("Negocio creado");
    } catch (err) {
      toast.error(err?.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await joinGroupByCode(joinCode);
      await refresh();
      toast.success("Te has unido al grupo");
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.message || "Código inválido");
    } finally {
      setBusy(false);
    }
  };

  const goToDashboard = async () => {
    try { await refresh(); } catch { /* ignore */ }
    navigate("/app/dashboard", { replace: true });
  };

  if (createdCode) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="w-full max-w-md fade-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-emerald-400"/>
            </div>
            <h1 className="font-display text-3xl font-semibold mb-2">¡Negocio listo!</h1>
            <p className="text-white/50 text-sm">Comparte este código con tus socios para que se unan</p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-8 text-center mb-6">
            <p className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-2">Código de invitación</p>
            <p data-testid="group-code" className="font-display text-4xl font-bold tracking-[0.4em] my-2">{createdCode}</p>
            <button
              data-testid="copy-code"
              onClick={() => { navigator.clipboard.writeText(createdCode); toast.success("Copiado"); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
            >
              <Copy size={12}/> Copiar código
            </button>
          </div>
          <button
            data-testid="goto-dashboard"
            onClick={goToDashboard}
            className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors"
          >Entrar al dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="w-full max-w-md fade-up">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-semibold mb-2">Configura tu negocio</h1>
          <p className="text-white/50 text-sm">Crea uno nuevo o únete a uno existente con un código.</p>
        </div>

        <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-lg">
          <button data-testid="tab-create" onClick={() => setMode("create")}
            className={`flex-1 px-4 py-2 text-sm rounded-md flex items-center justify-center gap-2 transition-all ${mode === "create" ? "bg-white text-black" : "text-white/60"}`}>
            <Building2 size={14}/> Crear
          </button>
          <button data-testid="tab-join" onClick={() => setMode("join")}
            className={`flex-1 px-4 py-2 text-sm rounded-md flex items-center justify-center gap-2 transition-all ${mode === "join" ? "bg-white text-black" : "text-white/60"}`}>
            <Users size={14}/> Unirme
          </button>
        </div>

        {mode === "create" ? (
          <form onSubmit={create} className="space-y-3">
            <input
              data-testid="input-business-name"
              required value={businessName} onChange={e=>setBusinessName(e.target.value)}
              placeholder="Nombre del negocio"
              className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
            />
            <button data-testid="submit-create-group" disabled={busy} type="submit"
              className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 disabled:opacity-60">
              {busy ? "Creando..." : "Crear negocio"}
            </button>
          </form>
        ) : (
          <form onSubmit={join} className="space-y-3">
            <input
              data-testid="input-join-code"
              required value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
              placeholder="Código de 6 carácteres"
              maxLength={6}
              className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm tracking-[0.3em] text-center font-mono uppercase"
            />
            <button data-testid="submit-join-group" disabled={busy} type="submit"
              className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 disabled:opacity-60">
              {busy ? "Verificando..." : "Unirme al grupo"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
