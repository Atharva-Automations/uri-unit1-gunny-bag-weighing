"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { useToast } from "@/utils/toast";
import {
  AlertCircle,
  ArrowRight,
  Barcode,
  Boxes,
  Download,
  Eye,
  FileText,
  Loader2,
  PackageCheck,
  Printer,
  RotateCcw,
  ScanLine,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Part = { id: number; partNumber: string; description: string };
type DashboardRow = {
  partId: number;
  partNumber: string;
  description: string;
  totalInwards: number;
  totalOutwards: number;
  totalReturns: number;
};
type Inward = {
  id: number;
  inwardNumber: string;
  labelCode: string;
  quantity: number;
  partId: number;
  partNumber: string;
  description: string;
  supplier: string | null;
  batchNumber: string | null;
  operatorName: string | null;
  remarks: string | null;
  receivedAt: string;
};
type Outward = {
  id: number;
  outwardNumber: string;
  labelCode: string | null;
  quantity: number;
  inwardId: number | null;
  partId: number;
  partNumber: string;
  description: string;
  destination: string | null;
  operatorName: string | null;
  remarks: string | null;
  dispatchedAt: string;
};
type ReturnRecord = {
  id: number;
  quantity: number;
  reason: string;
  partId: number;
  partNumber: string;
  outwardId: number | null;
  inwardId: number | null;
  returnedAt: string;
  addToInventory: number;
};
type Data = {
  dashboard: DashboardRow[];
  inwards: { record: Inward; partNumber: string; description: string }[];
  outwards: {
    record: Outward;
    partNumber: string;
    description: string;
    inwardNumber: string | null;
  }[];
  returns: { record: ReturnRecord; partNumber: string; description: string }[];
  parts: Part[];
};

type Tab = "dashboard" | "inward" | "outward" | "returns" | "movement";

const initialForm = {
  partId: "",
  quantity: "",
  supplier: "",
  batchNumber: "",
  operatorName: "",
  remarks: "",
  inwardId: "",
  destination: "",
  reason: "",
  outwardId: "",
  qualityGrade: "",
  inwardNumber: "",
  addToInventory: true,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function LabelBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 font-mono text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
      <Barcode className="h-3 w-3 shrink-0" />
      {code}
    </span>
  );
}

function TypeBadge({ type }: { type: "INWARD" | "OUTWARD" | "RETURN" }) {
  const map = {
    INWARD: "bg-blue-100 text-blue-800",
    OUTWARD: "bg-emerald-100 text-emerald-800",
    RETURN: "bg-rose-100 text-rose-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[type]}`}>
      {type}
    </span>
  );
}

// ─── Print hook ──────────────────────────────────────────────────────────────

function usePrint() {
  const toast = useToast();
  const [printing, setPrinting] = useState<string | null>(null); // "type-id"

  async function printLabel(type: "inward" | "outward", id: number) {
    const key = `${type}-${id}`;
    setPrinting(key);
    try {
      const res = await fetch("/api/compound-inventory/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Print failed");
      toast.success(result.message || "Label printed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not print label");
    } finally {
      setPrinting(null);
    }
  }

  return { printLabel, printing };
}

// ─── Reusable form primitives ─────────────────────────────────────────────

function Field({
  label: text,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {text}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
}

function Select({
  label: text,
  value,
  name,
  options,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  name: string;
  options: { value: string; label: string }[];
  onChange: (name: string, value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {text}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  label: text,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (name: string, value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(name, e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-[#17324d] focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
      />
      <span className="text-sm text-slate-700">{text}</span>
    </label>
  );
}

// ─── Print button ─────────────────────────────────────────────────────────

function PrintBtn({
  type,
  id,
  printing,
  onPrint,
}: {
  type: "inward" | "outward";
  id: number;
  printing: string | null;
  onPrint: (type: "inward" | "outward", id: number) => void;
}) {
  const key = `${type}-${id}`;
  const busy = printing === key;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onPrint(type, id)}
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
      title="Print label"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
      {busy ? "Printing…" : "Print"}
    </button>
  );
}

// ─── Scan-to-advance banner ───────────────────────────────────────────────

function ScanAdvanceBanner({ labelCode }: { labelCode: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold text-amber-900">Label created — scan to advance</p>
        <p className="mt-0.5 text-sm text-amber-800">
          Print and scan the label{" "}
          <span className="font-mono font-bold">{labelCode}</span> to open the{" "}
          <span className="font-bold">Outward</span> form for this inward record.
        </p>
      </div>
      <ArrowRight className="ml-auto mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function CompoundInventoryPage({
  initialTab = "dashboard",
  initialInwardId = "",
  initialPartId = "",
}: {
  initialTab?: Tab;
  initialInwardId?: string;
  initialPartId?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const tab = initialTab;

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ...initialForm,
    inwardId: initialInwardId,
    partId: initialPartId,
  });
  const [scan, setScan] = useState("");
  const [scannedInward, setScannedInward] = useState<{
    id: number;
    partId: number;
    partNumber: string;
    description: string;
    quantity: number;
  } | null>(null);
  const [scannedOutward, setScannedOutward] = useState<{
    id: number;
    partId: number;
    outwardNumber: string;
    quantity: number;
  } | null>(null);
  const [selectedRow, setSelectedRow] = useState<DashboardRow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [detailOutwardId, setDetailOutwardId] = useState<number | null>(null);

  // After save: show scan banner instead of auto-redirect
  const [lastCreated, setLastCreated] = useState<{ labelCode: string } | null>(null);

  const { printLabel, printing } = usePrint();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compound-inventory");
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Could not load Compound Inventory");
      setData(result.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load Compound Inventory");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (initialInwardId) change("inwardId", initialInwardId);
    if (initialPartId) change("partId", initialPartId);
  }, [initialInwardId, initialPartId]);

  function change(name: string, value: string | boolean) {
    setForm((cur) => ({
      ...cur,
      [name]: value,
    } as typeof cur));
  }

  async function save(event: FormEvent, action: string) {
    event.preventDefault();
    setSaving(true);
    try {
      const activePartId = form.partId || scannedInward?.partId;
      const res = await fetch("/api/compound-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, action, partId: activePartId }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Could not save record");

      toast.success(`${result.type.toUpperCase()} saved.`);
      setForm(initialForm);
      setScannedInward(null);
      setScannedOutward(null);
      await load();

      // Inward has a next stage (Outward); outward/return are terminal.
      if (action === "inward") {
        setLastCreated({ labelCode: result.data.labelCode });
      } else {
        setLastCreated(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save record");
    } finally {
      setSaving(false);
    }
  }

  async function scanLabel(event: FormEvent) {
    event.preventDefault();
    if (!scan.trim()) return;
    const res = await fetch(`/api/compound-inventory?scan=${encodeURIComponent(scan.trim())}`);
    const result = await res.json();
    if (!result.success || (!result.data?.inward && !result.data?.outward)) {
      toast.error(result.error || "Label not found");
      return;
    }

    setScan("");
    setScannedInward(null);
    setScannedOutward(null);
    setLastCreated(null); // clear banner on successful scan

    if (result.data.outward) {
      toast.success(`Outward ${result.data.outward.outwardNumber} scanned`);
      setScannedOutward(result.data.outward);
      if (tab === "returns") {
        change("outwardId", String(result.data.outward.id));
        change("partId", String(result.data.outward.partId));
      }
    } else if (result.data.inward) {
      toast.success(`Inward ${result.data.inward.inwardNumber} scanned`);
      setScannedInward(result.data.inward);
      // Scanning an inward label goes straight to the Outward form.
      router.push(
        `/compound-inventory/outward?inwardId=${result.data.inward.id}&partId=${result.data.inward.partId}`
      );
    }
  }

  if (loading && !data)
    return (
      <MainLayout title="Compound Inventory" subtitle="Material movement and traceability">
        <div className="flex h-64 items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading ledger…</span>
        </div>
      </MainLayout>
    );
  if (!data) return null;

  const total = (key: "totalInwards" | "totalOutwards" | "totalReturns") =>
    data.dashboard.reduce((sum, row) => sum + Number(row[key]), 0);

  return (
    <MainLayout
      title={initialTab === "dashboard" ? "Compound Inventory" : initialTab.toUpperCase()}
      subtitle="Track inward, outward and returns in one traceable flow"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ── Header hero ── */}
        <section className="flex flex-col gap-4 rounded-2xl bg-[#17324d] p-5 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Compound Inventory
            </p>
            <h2 className="mt-1 text-2xl font-bold">Material movement control</h2>
            <p className="mt-1 text-sm text-slate-300">
              Create labels, scan them into the next stage, and keep every part balance visible.
            </p>
          </div>
          <form onSubmit={scanLabel} className="flex w-full max-w-md gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="Scan inward label code"
                className="w-full rounded-lg border-0 bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/20 placeholder:text-slate-400 focus:ring-amber-300"
              />
            </div>
            <button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-[#17324d] hover:bg-amber-300">
              <Barcode className="mr-1 inline h-4 w-4" />
              Scan
            </button>
          </form>
        </section>

        {/* ── Views ── */}
        {tab === "dashboard" && (
          <Dashboard
            rows={data.dashboard}
            total={total}
            onDelete={deletePartRecords}
            onRowClick={(row) => {
              setSelectedRow(row);
              setShowModal(true);
            }}
          />
        )}
        {showModal && selectedRow && (
          <PartDetailModal
            row={selectedRow}
            onClose={() => {
              setShowModal(false);
              setSelectedRow(null);
            }}
            onDelete={deletePartRecords}
          />
        )}
        {tab === "inward" && (
          <InwardView
            data={data}
            form={form}
            change={change}
            save={save}
            saving={saving}
            printing={printing}
            onPrint={printLabel}
            lastCreated={lastCreated}
          />
        )}
        {tab === "outward" && (
          <OutwardView
            data={data}
            form={form}
            change={change}
            save={save}
            saving={saving}
            scannedInward={scannedInward}
            onViewDetail={setDetailOutwardId}
          />
        )}
        {tab === "movement" && <MovementTracker data={data} />}
        {tab === "returns" && (
          <ReturnsView
            data={data}
            form={form}
            change={change}
            save={save}
            saving={saving}
            scannedOutward={scannedOutward}
          />
        )}
      </div>

      {detailOutwardId !== null && (
        <OutwardDetailModal outwardId={detailOutwardId} onClose={() => setDetailOutwardId(null)} />
      )}
    </MainLayout>
  );

  async function deletePartRecords(partId: number, partNumber: string) {
    if (
      !confirm(
        `Delete ALL compound inventory records for "${partNumber}"?\n\nThis removes all inward, outward and return records permanently.`
      )
    )
      return;
    try {
      const res = await fetch("/api/compound-inventory/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Could not delete records");
      toast.success(`Records for ${partNumber} deleted.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete records");
    }
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────

function Dashboard({
  rows,
  total,
  onDelete,
  onRowClick,
}: {
  rows: DashboardRow[];
  total: (key: "totalInwards" | "totalOutwards" | "totalReturns") => number;
  onDelete: (partId: number, partNumber: string) => void;
  onRowClick: (row: DashboardRow) => void;
}) {
  const cards = [
    { key: "totalInwards" as const, label: "Total Inwards", color: "bg-blue-600", icon: TrendingUp },
    { key: "totalOutwards" as const, label: "Total Outwards", color: "bg-emerald-600", icon: TrendingDown },
    { key: "totalReturns" as const, label: "Total Returns", color: "bg-rose-600", icon: RotateCcw },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ key, label, color, icon: Icon }) => (
          <div key={key} className={`${color} rounded-xl p-5 text-white shadow-sm`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{label}</p>
                <p className="mt-2 text-3xl font-bold">{total(key).toLocaleString()}</p>
                <p className="mt-1 text-xs text-white/70">units recorded</p>
              </div>
              <div className="rounded-xl bg-white/10 p-2">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-[#17324d]">Part movement summary</h3>
            <p className="text-xs text-slate-500">Click any row for detailed breakdown</p>
          </div>
          <Boxes className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Part</th>
                <th className="px-5 py-3 text-right">Inwards</th>
                <th className="px-5 py-3 text-right">Outwards</th>
                <th className="px-5 py-3 text-right">Returns</th>
                <th className="px-5 py-3 text-right">Available</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                    No records yet — start by creating an Inward.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const available = row.totalInwards - row.totalOutwards + row.totalReturns;
                return (
                  <tr
                    key={row.partId}
                    onClick={() => onRowClick(row)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{row.partNumber}</p>
                      <p className="text-xs text-slate-500">{row.description}</p>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.totalInwards}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.totalOutwards}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-rose-600">{row.totalReturns}</td>
                    <td
                      className={`px-5 py-3 text-right font-bold tabular-nums ${
                        available < 0 ? "text-rose-600" : "text-[#17324d]"
                      }`}
                    >
                      {available}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/api/compound-inventory/pdf?partId=${row.partId}`, "_blank");
                          }}
                          className="rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50"
                          title="View PDF report"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(row.partId, row.partNumber);
                          }}
                          className="rounded-md p-1.5 text-rose-600 transition hover:bg-rose-50"
                          title="Delete all records"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ─── Inward View ─────────────────────────────────────────────────────────

interface ViewProps {
  data: Data;
  form: typeof initialForm;
  change: (k: string, v: string | boolean) => void;
  save: (e: FormEvent, action: string) => void;
  saving: boolean;
  printing: string | null;
  onPrint: (type: "inward" | "outward", id: number) => void;
  lastCreated?: { labelCode: string } | null;
}

function InwardView({ data, form, change, save, saving, printing, onPrint, lastCreated }: ViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      {/* ── Form ── */}
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-2">
                <TrendingUp className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold text-[#17324d]">Create Inward</h3>
                <p className="text-xs text-slate-500">Register received material and generate its label.</p>
              </div>
            </div>
          </div>
          <form onSubmit={(e) => save(e, "inward")} className="space-y-4">
            <Select
              label="Part"
              name="partId"
              value={form.partId}
              required
              onChange={change}
              options={data.parts.map((p) => ({ value: String(p.id), label: `${p.partNumber} – ${p.description}` }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" required />
              <Field label="Supplier" name="supplier" value={form.supplier} onChange={change} placeholder="Optional" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Batch Number" name="batchNumber" value={form.batchNumber} onChange={change} placeholder="Optional" />
              <Field label="Operator" name="operatorName" value={form.operatorName} onChange={change} placeholder="Optional" />
            </div>
            <Field label="Remarks" name="remarks" value={form.remarks} onChange={change} placeholder="Optional" />
            <button
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
              {saving ? "Saving…" : "Create Inward + Label"}
            </button>
          </form>
        </section>

        {lastCreated && <ScanAdvanceBanner labelCode={lastCreated.labelCode} />}
      </div>

      {/* ── Records table ── */}
      <InwardTable records={data.inwards} printing={printing} onPrint={onPrint} />
    </div>
  );
}

function InwardTable({
  records,
  printing,
  onPrint,
}: {
  records: Data["inwards"];
  printing: string | null;
  onPrint: (type: "inward" | "outward", id: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-bold text-[#17324d]">Inward Records</h3>
          <p className="text-xs text-slate-500">
            {records.length} record{records.length !== 1 ? "s" : ""} · most recent first
          </p>
        </div>
        <TypeBadge type="INWARD" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Inward No.</th>
              <th className="px-4 py-3">Part</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3 text-center">Print</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                  No inward records yet.
                </td>
              </tr>
            )}
            {records.map(({ record: row, partNumber, description }) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.inwardNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{partNumber}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{row.quantity}</td>
                <td className="px-4 py-3 text-slate-600">{row.supplier || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.batchNumber || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(row.receivedAt)}</td>
                <td className="px-4 py-3">
                  <LabelBadge code={row.labelCode} />
                </td>
                <td className="px-4 py-3 text-center">
                  <PrintBtn type="inward" id={row.id} printing={printing} onPrint={onPrint} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Outward View ─────────────────────────────────────────────────────────

function OutwardView({
  data,
  form,
  change,
  save,
  saving,
  scannedInward,
  onViewDetail,
}: Pick<ViewProps, "data" | "form" | "change" | "save" | "saving"> & {
  scannedInward: { id: number; partNumber: string; quantity: number } | null;
  onViewDetail: (id: number) => void;
}) {
  const available = (row: Inward) =>
    row.quantity -
    data.outwards
      .filter(({ record }) => record.inwardId === row.id)
      .reduce((sum, { record }) => sum + record.quantity, 0);

  const selectedInward = data.inwards.find(({ record }) => String(record.id) === form.inwardId)?.record;

  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      {/* ── Form ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 p-2">
              <TrendingDown className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-bold text-[#17324d]">Create Outward</h3>
              <p className="text-xs text-slate-500">Dispatch material directly from an inward record.</p>
            </div>
          </div>
        </div>

        {scannedInward && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Scanned <strong>{scannedInward.partNumber}</strong> — inward qty{" "}
              <strong>{scannedInward.quantity}</strong>
            </span>
          </div>
        )}

        <form onSubmit={(e) => save(e, "outward")} className="space-y-4">
          <Select
            label="Inward Record"
            name="inwardId"
            value={form.inwardId}
            required
            onChange={(name, value) => {
              const row = data.inwards.find((x) => String(x.record.id) === value);
              change(name, value);
              if (row) change("partId", String(row.record.partId));
            }}
            options={data.inwards.map(({ record: row, partNumber }) => ({
              value: String(row.id),
              label: `${row.inwardNumber} · ${partNumber} · avail: ${available(row)}`,
            }))}
          />
          <Field label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Destination" name="destination" value={form.destination} onChange={change} placeholder="Optional" />
            <Field label="Operator" name="operatorName" value={form.operatorName} onChange={change} placeholder="Optional" />
          </div>
          <Field label="Remarks" name="remarks" value={form.remarks} onChange={change} placeholder="Optional" />
          <button
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            {saving ? "Saving…" : "Create Outward"}
          </button>
          {selectedInward && (
            <p className="text-xs text-slate-500">
              Available to outward from this inward:{" "}
              <span className="font-semibold text-slate-700">{available(selectedInward)}</span> of {selectedInward.quantity}
            </p>
          )}
        </form>
      </section>

      {/* ── Records table ── */}
      <OutwardTable records={data.outwards} onViewDetail={onViewDetail} />
    </div>
  );
}

function OutwardTable({
  records,
  onViewDetail,
}: {
  records: Data["outwards"];
  onViewDetail: (id: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-bold text-[#17324d]">Outward Records</h3>
          <p className="text-xs text-slate-500">
            {records.length} record{records.length !== 1 ? "s" : ""} · click a row for full details
          </p>
        </div>
        <TypeBadge type="OUTWARD" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Outward No.</th>
              <th className="px-4 py-3">Part</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">From Inward</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Dispatched</th>
              <th className="px-4 py-3 text-center">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No outward records yet. Scan an inward label to begin.
                </td>
              </tr>
            )}
            {records.map(({ record: row, partNumber, description, inwardNumber }) => (
              <tr
                key={row.id}
                onClick={() => onViewDetail(row.id)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.outwardNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{partNumber}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{row.quantity}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{inwardNumber || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-slate-600">{row.destination || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(row.dispatchedAt)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100">
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Outward Detail Modal ─────────────────────────────────────────────────

type OutwardDetail = {
  outward: {
    id: number;
    outwardNumber: string;
    labelCode: string | null;
    quantity: number;
    partNumber: string;
    description: string;
    destination: string | null;
    operatorName: string | null;
    remarks: string | null;
    dispatchedAt: string;
  };
  inward: {
    id: number;
    inwardNumber: string;
    labelCode: string;
    quantity: number;
    supplier: string | null;
    batchNumber: string | null;
    operatorName: string | null;
    remarks: string | null;
    receivedAt: string;
  } | null;
  returns: { id: number; quantity: number; reason: string; addToInventory: number; returnedAt: string }[];
  summary: {
    inwardQuantity: number;
    outwardThis: number;
    totalOutward: number;
    remainingInward: number;
    outwardCount: number;
    totalReturned: number;
    siblingOutwards: {
      id: number;
      outwardNumber: string;
      quantity: number;
      destination: string | null;
      dispatchedAt: string;
    }[];
  };
};

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-800">{value || "—"}</span>
    </div>
  );
}

function OutwardDetailModal({ outwardId, onClose }: { outwardId: number; onClose: () => void }) {
  const toast = useToast();
  const [detail, setDetail] = useState<OutwardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
      fetch(`/api/compound-inventory/outward/${outwardId}`)
        .then((r) => r.json())
        .then((json) => {
          if (cancelled) return;
          if (!json.success) throw new Error(json.error || "Could not load outward details");
          setDetail(json.data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load outward details");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [outwardId]);

  function downloadPdf() {
    if (!detail) return;
    setDownloading(true);
    try {
      const a = document.createElement("a");
      a.href = `/api/compound-inventory/outward/${outwardId}/pdf`;
      a.download = `outward-${detail.outward.outwardNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Transaction PDF downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#17324d] to-[#234c70] px-6 py-5 text-white">
          <div>
            <h2 className="text-xl font-bold">{detail ? detail.outward.outwardNumber : "Outward Details"}</h2>
            <p className="mt-0.5 text-sm text-slate-300">
              {detail ? `${detail.outward.partNumber} — ${detail.outward.description}` : "Loading transaction…"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          {loading && (
            <div className="flex h-40 items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading transaction details…</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {detail && !loading && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Inward Qty", value: detail.summary.inwardQuantity, color: "text-blue-800" },
                  { label: "Outward This", value: detail.summary.outwardThis, color: "text-rose-700" },
                  { label: "Total Outwarded", value: detail.summary.totalOutward, color: "text-rose-700" },
                  { label: "Available", value: detail.summary.remainingInward, color: "text-emerald-700" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className={`mt-1.5 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <section className="rounded-xl border border-slate-200 p-5">
                <h3 className="mb-2 flex items-center gap-2 font-bold text-[#17324d]">
                  <FileText className="h-4 w-4" />
                  Outward Details
                </h3>
                <DetailItem label="Outward No." value={detail.outward.outwardNumber} />
                <DetailItem label="Label Code" value={detail.outward.labelCode || "—"} />
                <DetailItem label="Part Number" value={detail.outward.partNumber} />
                <DetailItem label="Description" value={detail.outward.description} />
                <DetailItem label="Quantity" value={`${detail.outward.quantity} pcs`} />
                <DetailItem label="Destination" value={detail.outward.destination || "—"} />
                <DetailItem label="Operator" value={detail.outward.operatorName || "—"} />
                <DetailItem label="Dispatched At" value={fmtDate(detail.outward.dispatchedAt)} />
                <DetailItem label="Remarks" value={detail.outward.remarks || "—"} />
              </section>

              <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                <h3 className="mb-2 flex items-center gap-2 font-bold text-[#17324d]">
                  <PackageCheck className="h-4 w-4" />
                  Related Inward Record
                </h3>
                {detail.inward ? (
                  <>
                    <DetailItem label="Inward No." value={detail.inward.inwardNumber} />
                    <DetailItem label="Label Code" value={detail.inward.labelCode} />
                    <DetailItem label="Inward Quantity" value={`${detail.inward.quantity} pcs`} />
                    <DetailItem label="Supplier" value={detail.inward.supplier || "—"} />
                    <DetailItem label="Batch Number" value={detail.inward.batchNumber || "—"} />
                    <DetailItem label="Operator" value={detail.inward.operatorName || "—"} />
                    <DetailItem label="Received At" value={fmtDate(detail.inward.receivedAt)} />
                    <DetailItem label="Remarks" value={detail.inward.remarks || "—"} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500">This outward is not linked to an inward record.</p>
                )}
              </section>

              {detail.summary.siblingOutwards.length > 1 && (
                <section className="rounded-xl border border-slate-200 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-bold text-[#17324d]">
                    <TrendingDown className="h-4 w-4" />
                    All Outwards Against This Inward ({detail.summary.outwardCount})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Outward No.</th>
                          <th className="px-3 py-2">Destination</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2">Dispatched</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.summary.siblingOutwards.map((row) => (
                          <tr
                            key={row.id}
                            className={
                              row.id === detail.outward.id ? "bg-amber-50 font-semibold" : "hover:bg-slate-50"
                            }
                          >
                            <td className="px-3 py-2 font-mono text-xs text-slate-700">
                              {row.outwardNumber}
                              {row.id === detail.outward.id && (
                                <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                  THIS
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{row.destination || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(row.dispatchedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {detail.returns.length > 0 && (
                <section className="rounded-xl border border-slate-200 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-bold text-[#17324d]">
                    <RotateCcw className="h-4 w-4" />
                    Linked Returns
                  </h3>
                  <div className="space-y-2">
                    {detail.returns.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                        <div>
                          <p className="text-sm text-slate-700">{row.reason}</p>
                          <p className="text-xs text-slate-400">{fmtDate(row.returnedAt)}</p>
                        </div>
                        <p className="font-semibold tabular-nums text-rose-700">{row.quantity}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={downloadPdf}
            disabled={!detail || downloading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70] disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Movement Tracker ────────────────────────────────────────────────────

type MovementRow = {
  inward: Inward & { partNumber: string; description: string };
  outwards: {
    id: number;
    outwardNumber: string;
    quantity: number;
    destination: string | null;
    operatorName: string | null;
    dispatchedAt: string;
  }[];
  outwardCount: number;
  totalOutward: number;
  available: number;
};

function MovementTracker({ data }: { data: Data }) {
  const toast = useToast();
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/compound-inventory/movement");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load movement tracker");
      setRows(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load movement tracker");
      setError(err instanceof Error ? err.message : "Could not load movement tracker");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const query = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (!query) return true;
    return (
      row.inward.inwardNumber.toLowerCase().includes(query) ||
      row.inward.partNumber.toLowerCase().includes(query) ||
      row.inward.description.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-blue-600 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Total Inwards Tracked</p>
          <p className="mt-2 text-3xl font-bold">{filtered.length}</p>
        </div>
        <div className="rounded-xl bg-rose-600 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Total Outwarded</p>
          <p className="mt-2 text-3xl font-bold">
            {filtered.reduce((sum, row) => sum + row.totalOutward, 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-600 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Total Available</p>
          <p className="mt-2 text-3xl font-bold">
            {filtered.reduce((sum, row) => sum + row.available, 0).toLocaleString()}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inward number or part…"
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-[#17324d]">Movement Tracker</h3>
            <p className="text-xs text-slate-500">
              Each inward with every outward linked to it and the remaining quantity
            </p>
          </div>
          <Boxes className="h-5 w-5 text-emerald-600" />
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading movements…</span>
          </div>
        ) : error ? (
          <div className="py-14 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
            <p className="font-medium text-slate-700">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Boxes className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-600">No inward movements yet</p>
            <p className="mt-1 text-sm text-slate-400">Create an inward record to start tracking.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((row) => {
              const isOpen = expanded === row.inward.id;
              return (
                <div key={row.inward.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : row.inward.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700">{row.inward.inwardNumber}</span>
                        <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#17324d]">
                          {row.inward.partNumber}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          Outwarded {row.outwardCount}×
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{row.inward.description}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Received {fmtDate(row.inward.receivedAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-6 text-right">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Inward</p>
                        <p className="text-lg font-bold tabular-nums text-blue-800">{row.inward.quantity}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Outwarded</p>
                        <p className="text-lg font-bold tabular-nums text-rose-700">{row.totalOutward}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Available</p>
                        <p
                          className={`text-lg font-bold tabular-nums ${
                            row.available < 0 ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {row.available}
                        </p>
                      </div>
                      <ArrowRight
                        className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                      {row.outwards.length === 0 ? (
                        <p className="py-4 text-center text-sm text-slate-400">
                          No outward transactions against this inward yet — {row.inward.quantity} available.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-4 py-2">Outward No.</th>
                                <th className="px-4 py-2 text-right">Qty</th>
                                <th className="px-4 py-2">Destination</th>
                                <th className="px-4 py-2">Operator</th>
                                <th className="px-4 py-2">Dispatched</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {row.outwards.map((out) => (
                                <tr key={out.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">
                                    {out.outwardNumber}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                                    {out.quantity}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-600">{out.destination || "—"}</td>
                                  <td className="px-4 py-2.5 text-slate-600">{out.operatorName || "—"}</td>
                                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500">
                                    {fmtDate(out.dispatchedAt)}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-slate-50 font-semibold">
                                <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-slate-500">
                                  Total ({row.outwardCount} transaction{row.outwardCount === 1 ? "" : "s"})
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">{row.totalOutward}</td>
                                <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-slate-500">
                                  Remaining
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                                  {row.available}
                                </td>
                                <td className="px-4 py-2.5" />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400">
        {data.inwards.length} inward record{data.inwards.length === 1 ? "" : "s"} tracked · 100 KG Inward → 20 KG + 30 KG
        Outward → 50 KG Available
      </p>
    </>
  );
}

// ─── Returns View ─────────────────────────────────────────────────────────

function ReturnsView({
  data,
  form,
  change,
  save,
  saving,
  scannedOutward,
}: Pick<ViewProps, "data" | "form" | "change" | "save" | "saving"> & {
  scannedOutward: { outwardNumber: string } | null;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-rose-100 p-2">
              <RotateCcw className="h-4 w-4 text-rose-700" />
            </div>
            <div>
              <h3 className="font-bold text-[#17324d]">Record Return</h3>
              <p className="text-xs text-slate-500">Capture returned material with reason for traceability.</p>
            </div>
          </div>
        </div>

        {scannedOutward && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Scanned Outward <strong>{scannedOutward.outwardNumber}</strong>
            </span>
          </div>
        )}

        <form onSubmit={(e) => save(e, "return")} className="space-y-4">
          <Select
            label="Part"
            name="partId"
            value={form.partId}
            required
            onChange={change}
            options={data.parts.map((p) => ({ value: String(p.id), label: `${p.partNumber} – ${p.description}` }))}
          />
          <Select
            label="Linked Outward (optional)"
            name="outwardId"
            value={form.outwardId}
            onChange={(name, value) => {
              const row = data.outwards.find((x) => String(x.record.id) === value);
              change(name, value);
              if (row) {
                change("partId", String(row.record.partId));
                if (row.record.inwardId) change("inwardId", String(row.record.inwardId));
              }
            }}
            options={data.outwards
              .filter((x) => !form.partId || String(x.record.partId) === form.partId)
              .map(({ record: row, partNumber }) => ({
                value: String(row.id),
                label: `${row.outwardNumber} · ${partNumber}`,
              }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" required />
            <Field label="Quality Grade" name="qualityGrade" value={form.qualityGrade} onChange={change} placeholder="Optional" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Inward Number" name="inwardNumber" value={form.inwardNumber} onChange={change} placeholder="Optional" />
            <Field label="Batch Number" name="batchNumber" value={form.batchNumber} onChange={change} placeholder="Optional" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier" name="supplier" value={form.supplier} onChange={change} placeholder="Optional" />
            <Field label="Operator" name="operatorName" value={form.operatorName} onChange={change} placeholder="Optional" />
          </div>
          <Field
            label="Reason for return"
            name="reason"
            value={form.reason}
            onChange={change}
            required
            placeholder="Quality issue, excess material, damage…"
          />
          <Checkbox
            label="Add returned quantity back to available inventory"
            name="addToInventory"
            checked={Boolean(form.addToInventory)}
            onChange={(name, value) => change(name, value)}
          />
          <Field label="Remarks" name="remarks" value={form.remarks} onChange={change} placeholder="Optional" />
          <button
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {saving ? "Saving…" : "Record Return"}
          </button>
        </form>
      </section>

      {/* Returns list */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-[#17324d]">Return Records</h3>
            <p className="text-xs text-slate-500">
              {data.returns.length} record{data.returns.length !== 1 ? "s" : ""}
            </p>
          </div>
          <TypeBadge type="RETURN" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Part</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Add to Inventory</th>
                <th className="px-4 py-3">Returned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.returns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    No returns recorded yet.
                  </td>
                </tr>
              )}
              {data.returns.map(({ record: row, partNumber }) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{partNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-700">{row.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{row.reason}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs font-semibold ring-1 ${
                        row.addToInventory
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                          : "bg-rose-50 text-rose-800 ring-rose-200"
                      }`}
                    >
                      {row.addToInventory ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">{fmtDate(row.returnedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Part Detail Modal ────────────────────────────────────────────────────

function PartDetailModal({
  row,
  onClose,
  onDelete,
}: {
  row: DashboardRow;
  onClose: () => void;
  onDelete: (partId: number, partNumber: string) => void;
}) {
  const available = row.totalInwards - row.totalOutwards + row.totalReturns;

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
            <h2 className="text-xl font-bold">{row.partNumber}</h2>
            <p className="mt-0.5 text-sm text-slate-300">{row.description}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Balance cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Total Inward</p>
              <p className="mt-2 text-3xl font-bold text-blue-900">{row.totalInwards}</p>
              <p className="mt-1 text-xs text-blue-600">Units received</p>
            </div>
            <div className="rounded-xl border-2 border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Available Quantity</p>
              <p className="mt-2 text-3xl font-bold text-emerald-900">{available}</p>
              <p className="mt-1 text-xs text-emerald-600">Units in stock</p>
            </div>
          </div>

          {/* Movement details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-[#17324d]">
              <FileText className="h-4 w-4" />
              Movement Details
            </h3>
            <div className="space-y-2">
              {[
                { icon: TrendingUp, label: "Total Inwards", sub: "Material received", val: row.totalInwards },
                { icon: TrendingDown, label: "Total Outwards", sub: "Dispatched", val: row.totalOutwards },
                { icon: RotateCcw, label: "Total Returns", sub: "Returned", val: row.totalReturns },
              ].map(({ icon: Icon, label, sub, val }) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="text-xs text-slate-400">{sub}</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-slate-800">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {available < 0 && (
            <div className="flex items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">Balance Alert</p>
                <p className="mt-1 text-sm text-amber-700">
                  Negative balance detected — review transaction records for discrepancies.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={() => {
              onDelete(row.partId, row.partNumber);
              onClose();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete All Records
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Close
            </button>
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/compound-inventory/pdf?partId=${row.partId}`;
                a.download = `compound-inventory-${row.partNumber}-${new Date().toISOString().split("T")[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70]"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
