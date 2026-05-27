import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./pages/AppLayout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Incidents from "./pages/Incidents";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallback from "./components/AuthCallback";

function Router() {
  const location = useLocation();
  // Synchronous detection of OAuth redirect in URL hash
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={
        <ProtectedRoute><Onboarding /></ProtectedRoute>
      } />
      <Route path="/app" element={
        <ProtectedRoute requireGroup><AppLayout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventario" element={<Inventory />} />
        <Route path="ventas" element={<Sales />} />
        <Route path="incidencias" element={<Incidents />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors />
        <Router />
      </BrowserRouter>
    </AuthProvider>
  );
}
