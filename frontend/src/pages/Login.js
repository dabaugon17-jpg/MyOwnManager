import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const me = await refresh();
        toast.success("Bienvenido");
        navigate(me?.codigo_grupo ? "/app/dashboard" : "/onboarding", { replace: true });
        return;
      }
      // register
      if (!name.trim()) {
        toast.error("Introduce tu nombre");
        setBusy(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation is enabled in Supabase → no session returned
        toast.success(
          "Cuenta creada. Confirma tu email para iniciar sesión (revisa tu bandeja)."
        );
        setMode("login");
        setBusy(false);
        return;
      }
      await refresh();
      toast.success("Cuenta creada");
      navigate("/onboarding", { replace: true });
    } catch (err) {
      const msg = err?.message || "Error de autenticación";
      toast.error(
        msg === "Invalid login credentials" ? "Credenciales inválidas" : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err?.message || "No se pudo iniciar Google");
    }
  };

  return (
    <div className="min-h-screen relative bg-[#0A0A0A] overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-white/[0.03] blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-[480px] h-[480px] rounded-full bg-white/[0.04] blur-3xl" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md fade-up">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-white text-black flex items-center justify-center font-display font-bold">L</div>
              <span className="text-[11px] tracking-[0.3em] uppercase text-white/50">Ledger · Inventario</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight font-semibold leading-[1.05]">
              Controla tu negocio.<br/>
              <span className="text-white/40">Compra, vende, gana.</span>
            </h1>
          </div>

          <div className="glass rounded-2xl p-6 sm:p-8 relative noise">
            <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-lg w-fit">
              <button
                data-testid="tab-login"
                onClick={() => setMode("login")}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${mode === "login" ? "bg-white text-black" : "text-white/60"}`}
              >Entrar</button>
              <button
                data-testid="tab-register"
                onClick={() => setMode("register")}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${mode === "register" ? "bg-white text-black" : "text-white/60"}`}
              >Crear cuenta</button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "register" && (
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    data-testid="input-name"
                    required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre"
                    className="w-full pl-9 pr-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
                  />
                </div>
              )}
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  data-testid="input-email"
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@negocio.com"
                  className="w-full pl-9 pr-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  data-testid="input-password"
                  type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña (mín. 6 carácteres)"
                  className="w-full pl-9 pr-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
                />
              </div>
              <button
                data-testid="submit-auth"
                disabled={busy}
                type="submit"
                className="w-full py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {busy ? "..." : (mode === "login" ? "Iniciar sesión" : "Crear cuenta")}
                <ChevronRight size={16} />
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] tracking-widest uppercase text-white/40">o continúa con</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              data-testid="google-login"
              onClick={googleLogin}
              className="w-full py-3 rounded-lg border border-white/15 bg-white/[0.02] hover:bg-white/[0.06] text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="M21.35 11.1H12v3.2h5.35c-.23 1.45-1.7 4.25-5.35 4.25-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.77 1.45l2.57-2.49C16.97 3.95 14.7 3 12 3 6.99 3 3 6.99 3 12s3.99 9 9 9c5.2 0 8.65-3.65 8.65-8.78 0-.59-.06-1.04-.15-1.12z"/></svg>
              Google
            </button>
          </div>

          <p className="text-center text-xs text-white/30 mt-6">Acceso seguro · Sesiones encriptadas</p>
        </div>
      </div>
    </div>
  );
}
