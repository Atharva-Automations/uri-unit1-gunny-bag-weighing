"use client";

import { useEffect, useState, useCallback } from "react";
import MainLayout from "@/components/MainLayout";
import {
  History,
  Search,
  Filter,
  Trash2,
  Download,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  FileText,
} from "lucide-react";

interface HistoryRecord {
  id: number;
  partId: number;
  partNumber: string;
  description: string;
  actualWeight: string;
  quantity: number;
  status: string;
  operatorName: string | null;
  remarks: string | null;
  recordedAt: string;
}

const STATUS_OPTIONS = ["ALL", "OK", "OVERWEIGHT", "UNDERWEIGHT"];
const PAGE_SIZE = 15;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ElementType }> = {
    OK: { cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
    OVERWEIGHT: { cls: "bg-red-100 text-red-700", icon: AlertTriangle },
    UNDERWEIGHT: { cls: "bg-amber-100 text-amber-700", icon: TrendingDown },
  };
  const cfg = map[status] ?? { cls: "bg-slate-100 text-slate-600", icon: CheckCircle };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}
    >
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [partNumber, setPartNumber] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<HistoryRecord | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (partNumber.trim()) params.set("partNumber", partNumber.trim());
      if (status !== "ALL") params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/history?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data);
        setPage(1);
      }
    } finally {
      setLoading(false);
    }
  }, [partNumber, status, dateFrom, dateTo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function handleDelete(record: HistoryRecord) {
    try {
      const res = await fetch(`/api/history/${record.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm(null);
        setRecords((prev) => prev.filter((r) => r.id !== record.id));
      }
    } catch {
      console.error("Delete failed");
    }
  }

  function exportCSV() {
    const headers = [
      "ID",
      "Part Number",
      "Description",
      "Actual Weight (kg)",
      "Quantity",
      "Status",
      "Operator",
      "Remarks",
      "Recorded At (ISO)",
      "Recorded At (Local)",
    ];
    const rows = records.map((r) => [
      r.id,
      r.partNumber,
      `"${r.description.replace(/"/g, '""')}"`,
      parseFloat(r.actualWeight).toFixed(3),
      r.quantity,
      r.status,
      r.operatorName ?? "",
      `"${(r.remarks ?? "").replace(/"/g, '""')}"`,
      new Date(r.recordedAt).toISOString(),
      new Date(r.recordedAt).toLocaleString("en-IN"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weighing-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setPartNumber("");
    setStatus("ALL");
    setDateFrom("");
    setDateTo("");
  }

  // Pagination
  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const paged = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary counts from current filtered records
  const okCount = records.filter((r) => r.status === "OK").length;
  const overCount = records.filter((r) => r.status === "OVERWEIGHT").length;
  const underCount = records.filter((r) => r.status === "UNDERWEIGHT").length;

  return (
    <MainLayout
      title="Weighing History"
      subtitle="Detailed records of all weighing operations"
    >
      <div className="space-y-5">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-[#1e3a5f]" />
            <h3 className="text-sm font-semibold text-[#1e3a5f]">Filters</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Part number..."
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] bg-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All Statuses" : s}
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
                aria-label="From date"
                className="w-full pl-3 pr-12 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                From
              </span>
            </div>
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
                aria-label="To date"
                className="w-full pl-3 pr-12 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                To
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={exportCSV}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#2d5a8e] transition-colors disabled:opacity-50 ml-auto"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary chips */}
        {!loading && records.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm">
              Total: <strong className="text-slate-800">{records.length}</strong>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" /> OK: <strong>{okCount}</strong>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-xs font-medium text-red-700">
              <AlertTriangle className="w-3.5 h-3.5" /> Overweight:{" "}
              <strong>{overCount}</strong>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700">
              <TrendingDown className="w-3.5 h-3.5" /> Underweight:{" "}
              <strong>{underCount}</strong>
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <History className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No records found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        #
                      </th>
                      <th className="text-left px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Part No.
                      </th>
                      <th className="text-left px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Description
                      </th>
                      <th className="text-right px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Weight (kg)
                      </th>
                      <th className="text-right px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="text-center px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Operator
                      </th>
                      <th className="text-left px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="text-left px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Remarks
                      </th>
                      <th className="text-center px-4 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paged.map((rec, idx) => (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-[#1e3a5f] text-xs bg-blue-50 px-2 py-0.5 rounded">
                            {rec.partNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[180px]">
                          <p className="truncate text-xs" title={rec.description}>
                            {rec.description}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {parseFloat(rec.actualWeight).toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {rec.quantity}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {rec.operatorName ?? (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {rec.recordedAt}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px]">
                          <p className="truncate" title={rec.remarks ?? ""}>
                            {rec.remarks ?? <span className="text-slate-300">—</span>}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <a
                              href={`/api/history/${rec.id}/pdf`}
                              target="_blank"
                              title="Download PDF"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-[#1e3a5f] transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => setDeleteConfirm(rec)}
                              title="Delete record"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
                  <p className="text-xs text-slate-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, records.length)} of {records.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg hover:bg-white border border-slate-200 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5) {
                        if (page <= 3) pageNum = i + 1;
                        else if (page >= totalPages - 2)
                          pageNum = totalPages - 4 + i;
                        else pageNum = page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                            page === pageNum
                              ? "bg-[#1e3a5f] text-white"
                              : "hover:bg-white border border-slate-200 text-slate-600"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg hover:bg-white border border-slate-200 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-[#1e3a5f]">
                Confirm Delete
              </h3>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-slate-700 mb-1">Delete this record?</p>
              <p className="text-sm text-slate-500 mb-2">
                <span className="font-bold text-[#1e3a5f]">
                  {deleteConfirm.partNumber}
                </span>{" "}
                —{" "}
                {deleteConfirm.recordedAt}
              </p>
              <p className="text-xs text-slate-400 mb-6">
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
