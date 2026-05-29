import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, getUserProfile } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    (async () => {
      try {
        // Supabase handles the OAuth callback automatically
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session?.user) {
          // Wait a bit for the session to be established
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();

          if (retryError || !retrySession?.user) {
            throw new Error("No session found");
          }

          if (retrySession?.user) {
            const profile = await getUserProfile(retrySession.user.id);
            setUser(profile);
            navigate(profile?.codigo_grupo ? "/app/dashboard" : "/onboarding", { replace: true });
          }
        } else {
          const profile = await getUserProfile(session.user.id);
          setUser(profile);
          navigate(profile?.codigo_grupo ? "/app/dashboard" : "/onboarding", { replace: true });
        }
      } catch (e) {
        console.error("Auth callback error:", e);
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
