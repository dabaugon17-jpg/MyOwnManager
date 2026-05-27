import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "../components/BottomNav";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Outlet />
      <BottomNav />
    </div>
  );
}
