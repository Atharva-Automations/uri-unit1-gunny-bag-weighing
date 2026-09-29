import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function MainLayout({
  children,
  title,
  subtitle,
}: MainLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
