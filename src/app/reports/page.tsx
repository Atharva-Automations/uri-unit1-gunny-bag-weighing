"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/MainLayout";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

type MonthOption = { value: number; label: string; key: string };

type InwardRecord = {
  id: number;
  inwardNumber: string;
  labelCode: string;
  quantity: number;
  receivedAt: string;
  supplier: string | null;
  batchNumber: string | null;
  operatorName: string | null;
};

type OutwardRecord = {
  id: number;
  outwardNumber: string;
  quantity: number;
  dispatchedAt: string;
  destination: string | null;
  operatorName: string | null;
  inwardNumber: string | null;
};

type ReturnRecord = { id: number; quantity: number; reason: string; returnedAt: string };

type ReportRow = {
  partId: number;
  partNumber: string;
  description: string;
  inventory: number;
  monthlyInward: number;
  monthlyOutward: number;
  monthlyReturns: number;
  available: number;
  monthKey: string;
  inwardRecords: InwardRecord[];
  outwardRecords: OutwardRecord[];
  returnRecords: ReturnRecord[];
};

type ReportsResponse = {
  year: number;
  month: number | null;
  rows: ReportRow[];
  months: MonthOption[];
  availableYears: number[];
};

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ─── Detail Modal ─────────────────────────────────────────────────────────

function ReportsDetailModal({
  row,
  onClose,
  onDownload,
  downloading,
}: {
  row: ReportRow;
  onClose: () => void;
  onDownload: (format: "pdf" | "excel") => void;
  downloading: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#17324d] to-[#234c70] px-6 py-5 text-white">
          <div>
            <h2 className="text-xl font-bold">{row.partNumber}</h2>
            <p className="mt-0.5 text-sm text-slate-300">
              {row.description} · {monthLabel(row.monthKey)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          {/* Quantity flow */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Inventory (Opening)", value: row.inventory, color: "text-blue-800", bg: "bg-blue-50 border-blue-200" },
              { label: "Monthly Inward", value: row.monthlyInward, color: "text-blue-800", bg: "bg-blue-50 border-blue-200" },
              { label: "Monthly Outward", value: row.monthlyOutward, color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
              { label: "Available (Closing)", value: row.available, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border p-4 text-center ${bg}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className={`mt-1.5 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {row.monthlyReturns > 0 && (
            <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              Returns added back to inventory this month: <strong>{row.monthlyReturns}</strong>
            </p>
          )}

          <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
            {row.inventory} (inventory) + {row.monthlyInward} (inward) − {row.monthlyOutward} (outward)
            {row.monthlyReturns > 0 ? ` + ${row.monthlyReturns} (returns)` : ""} = <strong>{row.available}</strong> (available)
          </p>

          {/* Inward transactions */}
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-[#17324d]">Inward Transactions ({row.inwardRecords.length})</h3>
            </div>
            {row.inwardRecords.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No inward transactions this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2">Inward No.</th>
                      <th className="px-4 py-2">Label</th>
                      <th className="px-4 py-2">Supplier</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {row.inwardRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">{r.inwardNumber}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-amber-700">{r.labelCode}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.supplier || "—"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-blue-800">{r.quantity}</td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500">{fmtDateTime(r.receivedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Outward transactions */}
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <TrendingDown className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-[#17324d]">Outward Transactions ({row.outwardRecords.length})</h3>
            </div>
            {row.outwardRecords.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No outward transactions this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2">Outward No.</th>
                      <th className="px-4 py-2">From Inward</th>
                      <th className="px-4 py-2">Destination</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2">Dispatched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {row.outwardRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">{r.outwardNumber}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.inwardNumber || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.destination || "—"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-rose-700">{r.quantity}</td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500">{fmtDateTime(r.dispatchedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Returns */}
          {row.returnRecords.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <RefreshCw className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-[#17324d]">Returns ({row.returnRecords.length})</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {row.returnRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="text-slate-700">{r.reason}</p>
                      <p className="text-xs text-slate-400">{fmtDateTime(r.returnedAt)}</p>
                    </div>
                    <p className="font-semibold tabular-nums text-amber-700">{r.quantity}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => onDownload("excel")}
              disabled={downloading !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
            >
              {downloading === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Download Excel
            </button>
            <button
              onClick={() => onDownload("pdf")}
              disabled={downloading !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70] disabled:opacity-50"
            >
              {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | "all">("all");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ year: String(year) });
      if (month !== "all") query.set("month", String(month));
      const res = await fetch(`/api/reports?${query.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load report");
      setData(json.data);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const monthsShown = useMemo(() => {
    const keys = new Set(rows.map((row) => row.monthKey));
    return [...keys].sort();
  }, [rows]);

  const totals = useMemo(
    () => ({
      inventory: rows.reduce((sum, row) => sum + row.inventory, 0),
      inward: rows.reduce((sum, row) => sum + row.monthlyInward, 0),
      outward: rows.reduce((sum, row) => sum + row.monthlyOutward, 0),
      returns: rows.reduce((sum, row) => sum + row.monthlyReturns, 0),
      available: rows.reduce((sum, row) => sum + row.available, 0),
    }),
    [rows]
  );

  async function download(format: "pdf" | "excel", scope: "summary" | "detail", row?: ReportRow) {
    setDownloading(format);
    try {
      const payloadRows = scope === "detail" && row ? [row] : rows;
      const res = await fetch(`/api/reports/export?format=${format}&scope=${scope}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month: month === "all" ? null : month, rows: payloadRows }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error(json.error || "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = match?.[1] ?? `inventory-report.${format === "excel" ? "csv" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <MainLayout
      title="Reports"
      subtitle="Month-wise, part-wise inventory movement and closing balance"
    >
      <div className="space-y-6">
        {/* ── Filters ── */}
        <section className="rounded-2xl bg-[#17324d] p-5 text-white shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Reports</p>
              <h2 className="mt-1 text-2xl font-bold">Inventory movement analysis</h2>
              <p className="mt-1 text-sm text-slate-300">
                Opening inventory, monthly inward, monthly outward and closing available — carried forward month to month.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">Year</span>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="rounded-lg border-0 bg-white/10 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/20 focus:ring-amber-300"
                >
                  {(data?.availableYears ?? [currentYear - 1, currentYear]).map((y) => (
                    <option key={y} value={y} className="text-slate-800">
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">Month</span>
                <select
                  value={month === "all" ? "all" : String(month)}
                  onChange={(e) => setMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="rounded-lg border-0 bg-white/10 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/20 focus:ring-amber-300"
                >
                  <option value="all" className="text-slate-800">
                    All months
                  </option>
                  {(data?.months ?? []).map((m) => (
                    <option key={m.value} value={m.value} className="text-slate-800">
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => void load()}
                disabled={loading}
                className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-[#17324d] transition hover:bg-amber-300 disabled:opacity-60"
              >
                <RefreshCw className={`mr-1 inline h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* ── Summary cards ── */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {[
            { label: "Parts", value: new Set(rows.map((r) => r.partId)).size, color: "bg-white text-slate-800", sub: "in this report" },
            { label: "Inventory", value: totals.inventory, color: "bg-blue-600 text-white", sub: "opening" },
            { label: "Monthly Inward", value: totals.inward, color: "bg-blue-500 text-white", sub: "received" },
            { label: "Monthly Outward", value: totals.outward, color: "bg-rose-600 text-white", sub: "dispatched" },
            { label: "Available", value: totals.available, color: "bg-emerald-600 text-white", sub: "closing" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className={`rounded-xl p-5 shadow-sm ${color}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
              <p className="mt-1 text-[11px] opacity-60">{sub}</p>
            </div>
          ))}
        </section>

        {/* ── Export bar ── */}
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>
              {month === "all" ? `Full year ${year}` : `${data?.months.find((m) => m.value === month)?.label} ${year}`}
              {monthsShown.length > 0 && ` · ${monthsShown.length} month${monthsShown.length === 1 ? "" : "s"} with activity`}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => void download("excel", "summary")}
              disabled={rows.length === 0 || downloading !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
            >
              {downloading === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Export Excel
            </button>
            <button
              onClick={() => void download("pdf", "summary")}
              disabled={rows.length === 0 || downloading !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70] disabled:opacity-50"
            >
              {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF
            </button>
          </div>
        </section>

        {/* ── Report table ── */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="font-bold text-[#17324d]">Month-wise, Part-wise Inventory</h3>
              <p className="text-xs text-slate-500">Click any row for complete details and exports</p>
            </div>
            <BarChart3 className="h-5 w-5 text-amber-600" />
          </div>

          {loading ? (
            <div className="flex h-56 items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Building report…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-600">No inventory movements for this period</p>
              <p className="mt-1 text-sm text-slate-400">Choose a different month or year.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Month</th>
                    <th className="px-5 py-3">Part</th>
                    <th className="px-5 py-3 text-right">Inventory</th>
                    <th className="px-5 py-3 text-right">Monthly Inward</th>
                    <th className="px-5 py-3 text-right">Monthly Outward</th>
                    <th className="px-5 py-3 text-right">Available</th>
                    <th className="px-5 py-3 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr
                      key={`${row.partId}-${row.monthKey}`}
                      onClick={() => setSelected(row)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-xs font-semibold text-slate-600">
                        {monthLabel(row.monthKey)}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-mono text-xs font-bold text-[#17324d]">{row.partNumber}</p>
                        <p className="text-xs text-slate-500">{row.description}</p>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-blue-800">{row.inventory}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-blue-700">
                        {row.monthlyInward}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-rose-700">
                        {row.monthlyOutward}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-bold tabular-nums ${
                          row.available < 0 ? "text-rose-600" : "text-emerald-700"
                        }`}
                      >
                        {row.available}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
                          <FileText className="h-3.5 w-3.5" />
                          View
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr className="border-t border-slate-200">
                    <td className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500" colSpan={2}>
                      Total
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-blue-800">{totals.inventory}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-blue-700">{totals.inward}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-rose-700">{totals.outward}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{totals.available}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
            Available = Inventory + Monthly Inward + Returns − Monthly Outward. Each month&rsquo;s available quantity carries
            forward as the next month&rsquo;s inventory.
          </div>
        </section>
      </div>

      {selected && (
        <ReportsDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onDownload={(format) => void download(format, "detail", selected)}
          downloading={downloading}
        />
      )}
    </MainLayout>
  );
}
