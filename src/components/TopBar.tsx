"use client";

import { useState, useEffect } from "react";
import { Bell, Calendar } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  // Start with a stable value so SSR and the first client render match.
  // The real clock is set in an effect, which only runs on the client.
  const [dateTime, setDateTime] = useState<Date | null>(null);

  useEffect(() => {
    setDateTime(new Date());
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatted = dateTime
    ? dateTime.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const time = dateTime
    ? dateTime.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-[#1e3a5f]">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Calendar className="w-4 h-4" />
          <span className="hidden sm:block">{formatted}</span>
          <span className="font-mono font-semibold text-[#1e3a5f]">{time}</span>
        </div>
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-500" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-sm font-bold">
          UR
        </div>
      </div>
    </header>
  );
}
