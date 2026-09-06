"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListPlus,
  History,
  Package,
  ChevronRight,
  Scale,
} from "lucide-react";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/weighing",
    label: "Live Weighing",
    icon: Scale,
  },
  {
    href: "/master",
    label: "Master List",
    icon: ListPlus,
  },
  {
    href: "/history",
    label: "History",
    icon: History,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#1e3a5f] text-white flex flex-col shadow-2xl z-40">
      {/* Logo / Header */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Gunny Bag</h1>
            <h1 className="text-sm font-bold leading-tight text-amber-400">
              Weighing
            </h1>
          </div>
        </div>
        <p className="text-xs text-blue-200 mt-3 leading-snug">
          United Rubber
          <br />
          <span className="text-amber-400 font-medium">Unit 1</span>
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-amber-400 text-[#1e3a5f] shadow-lg"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isActive ? "text-[#1e3a5f]" : "text-blue-300 group-hover:text-white"
                }`}
              />
              <span className="flex-1">{label}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 text-[#1e3a5f]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-xs text-blue-300">
          © {new Date().getFullYear()} United Rubber
          <br />
          All rights reserved
        </p>
      </div>
    </aside>
  );
}
