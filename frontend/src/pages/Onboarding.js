import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, KeyRound, Copy, Check } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Onboarding() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [mode, setMode] = useState("create");
  const [businessName, setBusinessName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const createGroup = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/groups", { nombre_negocio: businessName });
      // IMPORTANT: refresh user (codigo_grupo) BEFORE showing the "Entrar al dashboard"
      // button, otherwise ProtectedRoute will bounce the user back to /onboarding.
      await checkAuth();
      setCreatedCode(data.codigo_union);
      toast.success("Negocio creado");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally { setBusy(false); }
  };

  const joinGroup = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/groups/join", { codigo_union: joinCode });
      await checkAuth();
      toast.success("Te has unido al grupo");
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Código inválido");
    } finally { setBusy(false); }
  };

  const goToDashboard = async () => {
    // Belt-and-suspenders: re-fetch user just in case context is still stale.
    try { await checkAuth(); } catch { /* ignore */ }
    navigate("/app/dashboard", { replace: true });
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(createdCode);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  if (createdCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0A0A0A]">
        <div className="max-w-md w-full glass rounded-2xl p-8 relative noise fade-up">
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-3">Tu código de unión</p>
          <h2 className="font-display text-3xl font-semibold mb-6">Comparte este código con tu equipo</h2>
          <div className="flex items-center gap-2 p-4 bg-black/40 border border-white/10 rounded-xl mb-6">
            <span data-testid="group-code" className="font-display text-3xl font-bold tracking-[0.4em] flex-1">{createdCode}</span>
            <button data-testid="copy-code" onClick={copyCode} className="p-2 hover:bg-white/5 rounded-lg">
              {copied ? <Check size={18} className="text-emerald-400"/> : <Copy size={18}/>}
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0A0A0A]">
      <div className="max-w-md w-full fade-up">
        <h1 className="font-display text-4xl font-semibold tracking-tight mb-2">Configura tu negocio</h1>
        <p className="text-white/50 text-sm mb-8">Crea uno nuevo o únete al de tu equipo con un código.</p>
        <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-lg w-fit">
          <button data-testid="mode-create" onClick={() => setMode("create")}
            className={`px-4 py-1.5 text-sm rounded-md ${mode === "create" ? "bg-white text-black" : "text-white/60"}`}>Crear</button>
          <button data-testid="mode-join" onClick={() => setMode("join")}
            className={`px-4 py-1.5 text-sm rounded-md ${mode === "join" ? "bg-white text-black" : "text-white/60"}`}>Unirme</button>
        </div>

        {mode === "create" ? (
          <form onSubmit={createGroup} className="glass rounded-2xl p-6 space-y-3 relative noise">
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input data-testid="input-business-name" required value={businessName} onChange={e=>setBusinessName(e.target.value)}
                placeholder="Nombre del negocio" className="w-full pl-9 pr-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"/>
            </div>
            <button data-testid="submit-create-group" disabled={busy} type="submit"
              className="w-full py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 disabled:opacity-60">
              {busy ? "..." : "Crear negocio"}
            </button>
          </form>
        ) : (
          <form onSubmit={joinGroup} className="glass rounded-2xl p-6 space-y-3 relative noise">
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input data-testid="input-join-code" required value={joinCode}
                onChange={e=>setJoinCode(e.target.value.toUpperCase())}
                placeholder="Código de unión" className="w-full pl-9 pr-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm tracking-[0.3em] uppercase"/>
            </div>
            <button data-testid="submit-join-group" disabled={busy} type="submit"
              className="w-full py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 disabled:opacity-60">
              {busy ? "..." : "Unirme"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
