import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requireGroup = false }) {
  const { user, loading, checkAuth } = useAuth();
  const location = useLocation();
  // Avoid bouncing back-and-forth between /onboarding and /app/* when the
  // user state is briefly stale (race after creating/joining a group).
  const [recheckTried, setRecheckTried] = useState(false);
  const [recheckBusy, setRecheckBusy] = useState(false);

  useEffect(() => {
    if (
      !loading &&
      !recheckTried &&
      user &&
      requireGroup &&
      !user.codigo_grupo
    ) {
      setRecheckBusy(true);
      checkAuth().finally(() => {
        setRecheckBusy(false);
        setRecheckTried(true);
      });
    }
  }, [loading, user, requireGroup, recheckTried, checkAuth]);

  if (loading || recheckBusy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-white/60">
        Cargando…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (requireGroup && !user.codigo_grupo) return <Navigate to="/onboarding" replace />;
  return children;
}
