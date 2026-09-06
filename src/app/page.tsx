"use client";

import { useEffect, useState } from "react";
import MainLayout from "@/components/MainLayout";
import {
  Package,
  Scale,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  totalParts: number;
  totalWeighings: number;
  okCount: number;
  overweightCount: number;
  underweightCount: number;
  todayCount: number;
  recentRecords: Array<{
    id: number;
    partNumber: string;
    description: string;
    actualWeight: string;
    status: string;
    recordedAt: string;
  }>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-7 h-7 ${color}`} />
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OK: "bg-emerald-100 text-emerald-700",
    OVERWEIGHT: "bg-red-100 text-red-700",
    UNDERWEIGHT: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStats(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout
      title="Dashboard"
      subtitle="Gunny Bag Weighing Management — United Rubber Unit 1"
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="xl:col-span-2">
              <StatCard
                label="Total Parts Registered"
                value={stats?.totalParts ?? 0}
                icon={Package}
                color="text-[#1e3a5f]"
                bg="bg-blue-50"
              />
            </div>
            <div className="xl:col-span-2">
              <StatCard
                label="Total Weighings"
                value={stats?.totalWeighings ?? 0}
                icon={Scale}
                color="text-indigo-600"
                bg="bg-indigo-50"
              />
            </div>
            <div className="xl:col-span-2">
              <StatCard
                label="Today's Weighings"
                value={stats?.todayCount ?? 0}
                icon={Clock}
                color="text-amber-600"
                bg="bg-amber-50"
              />
            </div>
            <div className="xl:col-span-2">
              <StatCard
                label="OK Weighings"
                value={stats?.okCount ?? 0}
                icon={CheckCircle}
                color="text-emerald-600"
                bg="bg-emerald-50"
              />
            </div>
            <div className="xl:col-span-2">
              <StatCard
                label="Overweight"
                value={stats?.overweightCount ?? 0}
                icon={AlertTriangle}
                color="text-red-600"
                bg="bg-red-50"
              />
            </div>
            <div className="xl:col-span-2">
              <StatCard
                label="Underweight"
                value={stats?.underweightCount ?? 0}
                icon={TrendingDown}
                color="text-amber-600"
                bg="bg-amber-50"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/weighing"
              className="bg-emerald-500 text-white rounded-xl p-5 flex items-center justify-between hover:bg-emerald-600 transition-colors shadow-sm"
            >
              <div>
                <p className="font-semibold text-lg">Live Weighing</p>
                <p className="text-emerald-100 text-sm mt-1">Real-time weight from scale</p>
              </div>
              <ArrowRight className="w-6 h-6 text-white" />
            </Link>
            <Link
              href="/master"
              className="bg-[#1e3a5f] text-white rounded-xl p-5 flex items-center justify-between hover:bg-[#2d5a8e] transition-colors shadow-sm"
            >
              <div>
                <p className="font-semibold text-lg">Master List</p>
                <p className="text-blue-200 text-sm mt-1">Add, edit & delete parts</p>
              </div>
              <ArrowRight className="w-6 h-6 text-amber-400" />
            </Link>
            <Link
              href="/history"
              className="bg-amber-400 text-[#1e3a5f] rounded-xl p-5 flex items-center justify-between hover:bg-amber-500 transition-colors shadow-sm"
            >
              <div>
                <p className="font-semibold text-lg">View History</p>
                <p className="text-amber-800 text-sm mt-1">Browse weighing records</p>
              </div>
              <ArrowRight className="w-6 h-6 text-[#1e3a5f]" />
            </Link>
          </div>

          {/* Recent Records */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                Recent Weighing Records
              </h3>
              <Link
                href="/history"
                className="text-sm text-[#1e3a5f] hover:text-amber-600 font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {stats?.recentRecords.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400">
                <Scale className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No weighing records yet.</p>
                <p className="text-sm mt-1">
                  Start by searching a part and recording a weighing.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-6 py-3 text-slate-500 font-medium">
                        Part Number
                      </th>
                      <th className="text-left px-6 py-3 text-slate-500 font-medium">
                        Description
                      </th>
                      <th className="text-right px-6 py-3 text-slate-500 font-medium">
                        Weight (kg)
                      </th>
                      <th className="text-center px-6 py-3 text-slate-500 font-medium">
                        Status
                      </th>
                      <th className="text-left px-6 py-3 text-slate-500 font-medium">
                        Date & Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats?.recentRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-[#1e3a5f]">
                          {rec.partNumber}
                        </td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                          {rec.description}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          {parseFloat(rec.actualWeight).toFixed(3)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {rec.recordedAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
