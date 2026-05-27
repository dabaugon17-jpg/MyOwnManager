import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");
    if (!sessionId) { navigate("/login", { replace: true }); return; }

    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        if (data?.session_token) localStorage.setItem("session_token", data.session_token);
        setUser(data.user);
        if (data.user?.codigo_grupo) {
          navigate("/app/dashboard", { replace: true, state: { user: data.user } });
        } else {
          navigate("/onboarding", { replace: true, state: { user: data.user } });
        }
      } catch (e) {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-white/70">
      Autenticando…
    </div>
  );
}
