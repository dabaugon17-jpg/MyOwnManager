import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, checkAuth } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    (async () => {
      try {
        // Emergent OAuth puts session_id in the URL hash
        const hash = window.location.hash || "";
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const session_id = params.get("session_id");

        if (!session_id) {
          // Maybe already authenticated
          await checkAuth();
          navigate("/login", { replace: true });
          return;
        }

        const { data } = await api.post("/auth/session", { session_id });
        if (data?.session_token) {
          localStorage.setItem("session_token", data.session_token);
        }
        setUser(data.user);

        // Clean URL hash
        try {
          window.history.replaceState(null, "", "/auth/callback");
        } catch {
          // ignore
        }

        navigate(data.user?.codigo_grupo ? "/app/dashboard" : "/onboarding", { replace: true });
      } catch (e) {
        console.error("Auth callback error:", e);
        navigate("/login", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-white/70">
      Autenticando…
    </div>
  );
}
