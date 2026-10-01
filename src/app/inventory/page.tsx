"use client";

import { useEffect, useState } from "react";
import MainLayout from "@/components/MainLayout";
import {
  AlertCircle,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
  X,
  TrendingUp,
  Boxes,
  TrendingDown,
  RotateCcw,
  FileText,
} from "lucide-react";

interface InventoryItem {
  id: number;
  partNumber: string;
  description: string;
  baseQuantity: number;
  totalInwards: number;
  totalOutwards: number;
  totalReturns: number;
  weighedQuantity: number;
  avlQuantity: number;
}

function InventoryDetailModal({
  item,
  onClose,
}: {
  item: InventoryItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#17324d] to-[#234c70] px-6 py-5 text-white">
          <div>
            <h2 className="text-xl font-bold">{item.partNumber}</h2>
            <p className="mt-0.5 text-sm text-slate-300">{item.description}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Available Quantity Card */}
          <div className="rounded-xl border-2 border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-3">
                <Package className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Available Quantity</p>
                <p className="mt-1 text-3xl font-bold text-emerald-900">{item.avlQuantity.toLocaleString()} pcs</p>
              </div>
            </div>
          </div>

          {/* Movement Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-[#17324d]">
              <FileText className="h-4 w-4" />
              Movement Breakdown
            </h3>
            <div className="space-y-2">
              {[
                { icon: TrendingUp, color: "blue", label: "Weighed (Status: OK)", sub: "Material weighed within range", val: item.weighedQuantity, effect: "+ Added" },
                { icon: Boxes, color: "indigo", label: "Total Inwards", sub: "Material received", val: item.totalInwards, effect: "+ Added" },
                { icon: TrendingDown, color: "emerald", label: "Total Outwards", sub: "Material dispatched", val: item.totalOutwards, effect: "- Deducted" },
                { icon: RotateCcw, color: "rose", label: "Total Returns", sub: "Material returned", val: item.totalReturns, effect: "+ Added" },
              ].map(({ icon: Icon, color, label, sub, val, effect }) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg bg-${color}-100 p-2`}>
                      <Icon className={`h-4 w-4 text-${color}-600`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="text-xs text-slate-400">{sub}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${color === "emerald" ? "text-emerald-600" : color === "rose" ? "text-rose-600" : "text-slate-800"}`}>{val.toLocaleString()}</p>
                    <p className={`text-xs font-medium ${color === "emerald" ? "text-emerald-600" : color === "rose" ? "text-rose-600" : "text-blue-600"}`}>{effect}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formula Note */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <FileText className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">Calculation Formula</p>
              <p className="mt-1 text-sm text-blue-700">
                Available = Weighed (Status: OK) + Inwards - Outwards + Returns
              </p>
              <p className="mt-1 text-xs text-blue-600">
                {item.weighedQuantity} + {item.totalInwards} - {item.totalOutwards} + {item.totalReturns} = {item.avlQuantity} pcs
              </p>
              <p className="mt-2 text-xs text-blue-600">
                Overweight and underweight weighings are recorded for audit only and never added to inventory.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/inventory/pdf?partId=${item.id}`;
                a.download = `inventory-${item.partNumber}-${new Date().toISOString().split("T")[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70]"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  async function loadInventory() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inventory");
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load inventory");
      }
      setItems(data.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/api/inventory")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load inventory");
        }
        return data.data as InventoryItem[];
      })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load inventory");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !normalizedSearch ||
      item.partNumber.toLowerCase().includes(normalizedSearch) ||
      item.description.toLowerCase().includes(normalizedSearch);
    return matchesSearch;
  });

  const totalAvlQuantity = filteredItems.reduce((sum, item) => sum + item.avlQuantity, 0);
  const hasSearch = Boolean(search);

  function clearSearch() {
    setSearch("");
  }

  function downloadPDF(partId: number, partNumber: string) {
    const a = document.createElement("a");
    a.href = `/api/inventory/pdf?partId=${partId}`;
    a.download = `inventory-${partNumber}-${new Date().toISOString().split("T")[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <MainLayout
      title="Inventory"
      subtitle="Real-time available quantity based on compound inventory movements"
    >
      <div className="space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-[#1e3a5f]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{filteredItems.length}</p>
              <p className="text-sm text-slate-500">Parts shown</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Download className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{totalAvlQuantity.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Total available quantity</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center">
              <Search className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{hasSearch ? "Filtered" : "All"}</p>
              <p className="text-sm text-slate-500">Inventory view</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex flex-col xl:flex-row xl:items-end gap-4">
            <div className="flex-1 min-w-56">
              <label htmlFor="inventory-search" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Find a part
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="inventory-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Part number or description"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
                />
              </div>
            </div>
            {hasSearch && (
              <button
                type="button"
                onClick={clearSearch}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <X className="w-4 h-4" />
                Clear search
              </button>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Available Inventory</h3>
              <p className="text-xs text-slate-500 mt-1">
                {loading ? "Loading inventory..." : `${filteredItems.length} of ${items.length} part${items.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={loadInventory}
              disabled={loading}
              title="Refresh inventory"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1e3a5f] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="h-56 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#1e3a5f] animate-spin" />
            </div>
          ) : error ? (
            <div className="py-14 text-center">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
              <p className="font-medium text-slate-700">Unable to load inventory</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
              <button
                type="button"
                onClick={loadInventory}
                className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#2d5a8e] transition-colors"
              >
                Try again
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-14 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-slate-600">No matching parts found</p>
              <p className="text-sm mt-1">Adjust the search to broaden your results.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Part Number</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Avl Quantity</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-[#1e3a5f] bg-blue-50 px-2 py-1 rounded text-xs">
                          {item.partNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700 max-w-xs">
                        <p className="truncate" title={item.description}>{item.description}</p>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-emerald-700 text-lg tabular-nums">
                        {item.avlQuantity.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPDF(item.id, item.partNumber);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                          title="Download PDF report"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                Avl Quantity = Weighed (Status: OK) + Inwards - Outwards + Returns. Overweight/underweight weighings are not added. Updates in real-time. Click a row to view details.
              </div>
            </div>
          )}
        </section>
      </div>

      <InventoryDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </MainLayout>
  );
}