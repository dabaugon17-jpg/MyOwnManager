import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requireGroup = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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
