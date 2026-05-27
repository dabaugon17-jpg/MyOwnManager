import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Boxes, Receipt, AlertTriangle } from "lucide-react";

const tabs = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/app/inventario", label: "Stock", icon: Boxes, testid: "nav-inventario" },
  { to: "/app/ventas", label: "Ventas", icon: Receipt, testid: "nav-ventas" },
  { to: "/app/incidencias", label: "Incidencias", icon: AlertTriangle, testid: "nav-incidencias" },
];

export default function BottomNav() {
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0A0A0A]/85 border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-3xl mx-auto grid grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={testid}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                isActive ? "text-white" : "text-[#7A7A82] hover:text-white/80"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                <span className="text-[11px] tracking-wide font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
