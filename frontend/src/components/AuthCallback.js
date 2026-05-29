import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    (async () => {
      try {
        // supabase-js auto-detects the session from the URL because
        // we pass detectSessionInUrl: true in the client config.
        // We just need to wait for it and then refresh the profile.
        await new Promise((r) => setTimeout(r, 200));
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          navigate("/login", { replace: true });
          return;
        }
        const me = await refresh();
        // Clean URL hash if any
        try {
          window.history.replaceState(null, "", "/auth/callback");
        } catch {
          /* ignore */
        }
        navigate(me?.codigo_grupo ? "/app/dashboard" : "/onboarding", { replace: true });
      } catch {
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
