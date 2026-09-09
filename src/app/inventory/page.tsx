"use client";

import { useEffect, useState } from "react";
import MainLayout from "@/components/MainLayout";
import {
  AlertCircle,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Weight,
  X,
} from "lucide-react";

interface Part {
  id: number;
  partNumber: string;
  description: string;
  minWeight: string;
  maxWeight: string;
  quantity: number;
  actualWeight: string;
  createdAt: string;
  updatedAt: string;
}

function formatWeight(value: string) {
  const weight = Number.parseFloat(value);
  return Number.isFinite(weight) ? weight.toFixed(3) : "0.000";
}

export default function InventoryPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");

  async function loadParts() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/parts");
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load inventory");
      }
      setParts(data.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/api/parts")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load inventory");
        }
        return data.data as Part[];
      })
      .then((data) => {
        if (!cancelled) setParts(data);
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
  const filteredParts = parts.filter((part) => {
    const matchesSearch =
      !normalizedSearch ||
      part.partNumber.toLowerCase().includes(normalizedSearch) ||
      part.description.toLowerCase().includes(normalizedSearch);
    const matchesMinQuantity = !minQuantity || part.quantity >= Number(minQuantity);
    const matchesMaxQuantity = !maxQuantity || part.quantity <= Number(maxQuantity);
    const partMinWeight = Number.parseFloat(part.minWeight);
    const partMaxWeight = Number.parseFloat(part.maxWeight);
    const matchesMinWeight = !minWeight || partMaxWeight >= Number(minWeight);
    const matchesMaxWeight = !maxWeight || partMinWeight <= Number(maxWeight);

    return (
      matchesSearch &&
      matchesMinQuantity &&
      matchesMaxQuantity &&
      matchesMinWeight &&
      matchesMaxWeight
    );
  });

  const totalQuantity = filteredParts.reduce((sum, part) => sum + part.quantity, 0);
  const hasFilters = Boolean(search || minQuantity || maxQuantity || minWeight || maxWeight);

  function clearFilters() {
    setSearch("");
    setMinQuantity("");
    setMaxQuantity("");
    setMinWeight("");
    setMaxWeight("");
  }

  return (
    <MainLayout
      title="Inventory"
      subtitle="Browse parts currently available in the inventory"
    >
      <div className="space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-[#1e3a5f]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{filteredParts.length}</p>
              <p className="text-sm text-slate-500">Parts shown</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center">
              <Weight className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{totalQuantity.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Total pieces shown</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Filter className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{hasFilters ? "Active" : "All"}</p>
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
            <div className="grid grid-cols-2 gap-3">
              <FilterInput label="Min quantity" value={minQuantity} onChange={setMinQuantity} />
              <FilterInput label="Max quantity" value={maxQuantity} onChange={setMaxQuantity} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FilterInput label="Min weight (kg)" value={minWeight} onChange={setMinWeight} step="0.001" />
              <FilterInput label="Max weight (kg)" value={maxWeight} onChange={setMaxWeight} step="0.001" />
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <X className="w-4 h-4" />
                Clear filters
              </button>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Available parts</h3>
              <p className="text-xs text-slate-500 mt-1">
                {loading ? "Loading inventory..." : `${filteredParts.length} of ${parts.length} part${parts.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={loadParts}
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
                onClick={loadParts}
                className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#2d5a8e] transition-colors"
              >
                Try again
              </button>
            </div>
          ) : filteredParts.length === 0 ? (
            <div className="py-14 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-slate-600">No matching parts found</p>
              <p className="text-sm mt-1">Adjust the filters to broaden your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Part number</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Quantity</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Actual weight</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Allowed range</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Max bag weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredParts.map((part) => (
                    <tr key={part.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-[#1e3a5f] bg-blue-50 px-2 py-1 rounded text-xs">
                          {part.partNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700 max-w-xs">
                        <p className="truncate" title={part.description}>{part.description}</p>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-700">{part.quantity.toLocaleString()}</td>
                      <td className="px-5 py-4 text-right font-medium text-slate-700">{formatWeight(part.actualWeight)} kg</td>
                      <td className="px-5 py-4 text-right text-slate-600 whitespace-nowrap">
                        {formatWeight(part.minWeight)} - {formatWeight(part.maxWeight)} kg
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-amber-600">
                        {(Number.parseFloat(part.maxWeight) * part.quantity).toFixed(3)} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                Inventory data is read-only. Manage part records from Master List.
              </div>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</label>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-32 max-w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
      />
    </div>
  );
}
