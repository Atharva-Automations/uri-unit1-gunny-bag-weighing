"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Package,
  Search,
  AlertCircle,
  Printer,
  Loader2,
  Settings,
  CheckSquare,
  Square,
  Scale,
  Download,
  Info,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/utils/toast";

interface Part {
  id: number;
  partNumber: string;
  description: string;
  minWeight: string;
  maxWeight: string;
  quantity: number;
  maxBagWeight: string;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  partNumber: string;
  description: string;
  minWeight: string;
  maxWeight: string;
  quantity: string;
  maxBagWeight: string;
}

const EMPTY_FORM: FormData = {
  partNumber: "",
  description: "",
  minWeight: "",
  maxWeight: "",
  quantity: "",
  maxBagWeight: "",
};

function Modal({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${
          size === "lg" ? "max-w-3xl" : "max-w-lg"
        } max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  step,
}: {
  label: string;
  name: keyof FormData;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        step={step}
        min={type === "number" ? "0" : undefined}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-all"
      />
    </div>
  );
}

function PartDetailModal({
  part,
  onClose,
  onPrint,
  printing,
}: {
  part: Part;
  onClose: () => void;
  onPrint: (p: Part) => Promise<void>;
  printing: boolean;
}) {
  const minW = parseFloat(part.minWeight);
  const maxW = parseFloat(part.maxWeight);
  const bagW = parseFloat(part.maxBagWeight);
  const expMinBag = minW * part.quantity;
  const expMaxBag = maxW * part.quantity;

  const specs: { label: string; value: string; tone?: "default" | "amber" | "red" | "blue" }[] = [
    { label: "Min Item Weight", value: `${minW.toFixed(3)} kg` },
    { label: "Max Item Weight", value: `${maxW.toFixed(3)} kg` },
    { label: "Quantity per Bag", value: `${part.quantity} pcs`, tone: "blue" },
    { label: "Expected Min Bag", value: `${expMinBag.toFixed(3)} kg`, tone: "amber" },
    { label: "Expected Max Bag", value: `${expMaxBag.toFixed(3)} kg`, tone: "amber" },
    { label: "Max Bag (Cap)", value: `${bagW.toFixed(3)} kg`, tone: "red" },
  ];

  const toneCls: Record<string, string> = {
    default: "bg-slate-50 text-slate-800",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-800",
  };

  return (
    <Modal title="" onClose={onClose} size="lg">
      {/* Header band */}
      <div className="-m-6 mb-5 bg-[#1e3a5f] px-6 py-5 rounded-t-2xl">
        <p className="text-blue-200 text-xs font-medium uppercase tracking-wider">
          Part Details
        </p>
        <h2 className="text-white text-2xl font-bold font-mono mt-0.5">
          {part.partNumber}
        </h2>
        <p className="text-blue-200 text-sm mt-1 leading-snug">
          {part.description}
        </p>
      </div>

      {/* Description notice */}
      <div className="mb-5 p-3 bg-slate-50 rounded-lg flex items-start gap-2">
        <Info className="w-4 h-4 text-[#1e3a5f] mt-0.5 flex-shrink-0" />
        <p className="text-sm text-slate-600">
          {part.description}
        </p>
      </div>

      {/* Weight specs grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {specs.map((s) => (
          <div
            key={s.label}
            className={`p-3 rounded-lg ${toneCls[s.tone ?? "default"]}`}
          >
            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
              {s.label}
            </p>
            <p className="font-bold text-lg mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href={`/weighing?part=${encodeURIComponent(part.partNumber)}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-400 text-[#1e3a5f] rounded-lg text-sm font-bold hover:bg-amber-500 transition-colors"
        >
          <Scale className="w-4 h-4" />
          Record Weighing
        </Link>
        <button
          onClick={() => onPrint(part)}
          disabled={printing}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-bold hover:bg-[#2d5a8e] transition-colors disabled:opacity-60"
        >
          {printing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          Print Label
        </button>
        <a
          href={`/api/parts/${part.id}/label-pdf`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </a>
      </div>
    </Modal>
  );
}

export default function MasterPage() {
  const toast = useToast();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Part | null>(null);
  const [detailPart, setDetailPart] = useState<Part | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [calibrating, setCalibrating] = useState(false);

  const fetchParts = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const url = q ? `/api/parts?q=${encodeURIComponent(q)}` : "/api/parts";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setParts(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  useEffect(() => {
    const timer = setTimeout(() => fetchParts(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchParts]);

  function openCreate() {
    setEditingPart(null);
    setFormData(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(part: Part) {
    setEditingPart(part);
    setFormData({
      partNumber: part.partNumber,
      description: part.description,
      minWeight: part.minWeight,
      maxWeight: part.maxWeight,
      quantity: part.quantity.toString(),
      maxBagWeight: part.maxBagWeight,
    });
    setError("");
    setShowForm(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const url = editingPart ? `/api/parts/${editingPart.id}` : "/api/parts";
      const method = editingPart ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Something went wrong");
        return;
      }
      setShowForm(false);
      fetchParts(searchQuery);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function printLabel(part: Part) {
    setPrintingId(part.id);
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId: part.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Label printed for ${part.partNumber}`);
      } else {
        toast.error(data.error || "Print failed");
      }
    } catch {
      toast.error("Print request failed");
    } finally {
      setPrintingId(null);
    }
  }

  async function calibratePrinter() {
    setCalibrating(true);
    try {
      const res = await fetch("/api/print/calibrate", { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.error(data.error || "Calibration failed");
    } catch {
      toast.error("Calibration request failed");
    } finally {
      setCalibrating(false);
    }
  }

  function toggleSelected(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(e: React.MouseEvent) {
    e.stopPropagation();
    if (selectedIds.size === parts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parts.map((p) => p.id)));
    }
  }

  async function printBatch() {
    if (selectedIds.size === 0) return;
    setBatchPrinting(true);
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.error(data.error || "Batch print failed");
      setSelectedIds(new Set());
    } catch {
      toast.error("Batch print request failed");
    } finally {
      setBatchPrinting(false);
    }
  }

  async function handleDelete(part: Part) {
    try {
      const res = await fetch(`/api/parts/${part.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm(null);
        fetchParts(searchQuery);
      }
    } catch {
      console.error("Delete failed");
    }
  }

  return (
    <MainLayout
      title="Master List"
      subtitle="Manage gunny bag part records"
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by part number or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] bg-white"
          />
        </div>
        <button
          onClick={calibratePrinter}
          disabled={calibrating}
          title="Calibrate the TSC printer's gap sensor (use if it prints 3-4 blank labels first)"
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap disabled:opacity-60"
        >
          {calibrating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Settings className="w-4 h-4" />
          )}
          Calibrate Printer
        </button>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#2d5a8e] transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add New Part
        </button>
      </div>

      {/* Floating batch action bar — visible whenever any row is selected */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <p className="text-sm text-amber-800">
            <strong>{selectedIds.size}</strong> part
            {selectedIds.size !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100 rounded-lg"
            >
              Clear
            </button>
            <button
              onClick={printBatch}
              disabled={batchPrinting}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#2d5a8e] disabled:opacity-60"
            >
              {batchPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              Print Selected Labels
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
          </div>
        ) : parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No parts found</p>
            <p className="text-sm mt-1">
              {searchQuery
                ? "Try a different search term"
                : "Click 'Add New Part' to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 w-10">
                    <button
                      onClick={toggleSelectAll}
                      title={
                        selectedIds.size === parts.length
                          ? "Deselect all"
                          : "Select all"
                      }
                      className="text-[#1e3a5f] hover:text-amber-600"
                    >
                      {selectedIds.size === parts.length && parts.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-5 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    #
                  </th>
                  <th className="text-left px-5 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Part Number
                  </th>
                  <th className="text-left px-5 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Description
                  </th>
                  <th className="text-right px-5 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Min Wt (kg)
                  </th>
                  <th className="text-right px-5 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Max Wt (kg)
                  </th>
                  <th className="text-right px-5 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-right px-5 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Max Bag (kg)
                  </th>
                  <th className="text-center px-5 py-3.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parts.map((part, idx) => (
                  <tr
                    key={part.id}
                    onClick={() => setDetailPart(part)}
                    className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                      selectedIds.has(part.id) ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <td
                      className="px-5 py-3.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => toggleSelected(part.id, e)}
                        className="text-[#1e3a5f] hover:text-amber-600"
                      >
                        {selectedIds.has(part.id) ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-[#1e3a5f] bg-blue-50 px-2 py-0.5 rounded text-xs">
                        {part.partNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 max-w-xs">
                      <p className="truncate" title={part.description}>
                        {part.description}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                      {parseFloat(part.minWeight).toFixed(3)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                      {parseFloat(part.maxWeight).toFixed(3)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                      {part.quantity}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-amber-600">
                      {parseFloat(part.maxBagWeight).toFixed(3)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div
                        className="flex items-center justify-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => printLabel(part)}
                          disabled={printingId === part.id}
                          title="Print Label to TSC Printer"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-[#1e3a5f] transition-colors disabled:opacity-50"
                        >
                          {printingId === part.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Printer className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(part)}
                          title="Edit"
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(part)}
                          title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
              Showing {parts.length} part{parts.length !== 1 ? "s" : ""} — click
              any row to view details
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <Modal
          title={editingPart ? "Edit Part" : "Add New Part"}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <FormField
              label="Part Number"
              name="partNumber"
              value={formData.partNumber}
              onChange={handleChange}
              placeholder="e.g. PN-0001"
              required
            />
            <FormField
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Part description"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Min Weight (kg)"
                name="minWeight"
                type="number"
                step="0.001"
                value={formData.minWeight}
                onChange={handleChange}
                placeholder="0.000"
                required
              />
              <FormField
                label="Max Weight (kg)"
                name="maxWeight"
                type="number"
                step="0.001"
                value={formData.maxWeight}
                onChange={handleChange}
                placeholder="0.000"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Quantity"
                name="quantity"
                type="number"
                step="1"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="e.g. 100"
                required
              />
              <FormField
                label="Max Bag Weight (kg)"
                name="maxBagWeight"
                type="number"
                step="0.001"
                value={formData.maxBagWeight}
                onChange={handleChange}
                placeholder="0.000"
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#2d5a8e] transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingPart ? "Update Part" : "Create Part"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail Modal — opens on row click */}
      {detailPart && (
        <PartDetailModal
          part={detailPart}
          onClose={() => setDetailPart(null)}
          onPrint={printLabel}
          printing={printingId === detailPart.id}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <Modal title="Confirm Delete" onClose={() => setDeleteConfirm(null)}>
          <div className="text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <p className="text-slate-700 mb-1">
              Are you sure you want to delete{" "}
              <span className="font-bold text-[#1e3a5f]">
                {deleteConfirm.partNumber}
              </span>
              ?
            </p>
            <p className="text-sm text-slate-500 mb-6">
              This will also delete all associated weighing history.
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
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}
