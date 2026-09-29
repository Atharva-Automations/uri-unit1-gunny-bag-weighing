"use client";

import { Children, FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { useToast } from "@/utils/toast";
import {
  AlertCircle,
  ArrowRight,
  Barcode,
  Boxes,
  CheckCircle2,
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
  totalIssued: number;
  totalOutwards: number;
  totalReturns: number;
  totalOutwardReturns: number;
  totalGeneralReturns: number;
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
type Cis = {
  id: number;
  cisNumber: string;
  labelCode: string;
  quantity: number;
  inwardId: number;
  inwardNumber: string;
  partId: number;
  partNumber: string;
  description: string;
  operatorName: string | null;
  remarks: string | null;
  createdAt: string;
};
type Outward = {
  id: number;
  outwardNumber: string;
  labelCode: string | null;
  quantity: number;
  cisId: number;
  cisNumber: string;
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
  returnedAt: string;
  addToInventory: number;
};
type Data = {
  dashboard: DashboardRow[];
  inwards: { record: Inward; partNumber: string; description: string }[];
  cis: { record: Cis; partNumber: string; description: string; inwardNumber: string }[];
  outwards: { record: Outward; partNumber: string; description: string; cisNumber: string }[];
  returns: { record: ReturnRecord; partNumber: string; description: string }[];
  parts: Part[];
};

type Tab = "dashboard" | "inward" | "cis" | "outward" | "returns";

const initialForm = {
  partId: "",
  quantity: "",
  supplier: "",
  batchNumber: "",
  operatorName: "",
  remarks: "",
  inwardId: "",
  cisId: "",
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

function TypeBadge({ type }: { type: "INWARD" | "CIS" | "OUTWARD" | "RETURN" }) {
  const map = {
    INWARD: "bg-blue-100 text-blue-800",
    CIS: "bg-indigo-100 text-indigo-800",
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

  async function printLabel(type: "inward" | "cis" | "outward", id: number) {
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
  type: "inward" | "cis" | "outward";
  id: number;
  printing: string | null;
  onPrint: (type: "inward" | "cis" | "outward", id: number) => void;
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

function ScanAdvanceBanner({
  nextStage,
  labelCode,
}: {
  nextStage: string;
  labelCode: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold text-amber-900">Label created — scan to advance</p>
        <p className="mt-0.5 text-sm text-amber-800">
          Print and scan the label{" "}
          <span className="font-mono font-bold">{labelCode}</span> to open the{" "}
          <span className="font-bold">{nextStage}</span> form.
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
  initialCisId = "",
  initialPartId = "",
}: {
  initialTab?: Tab;
  initialInwardId?: string;
  initialCisId?: string;
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
    cisId: initialCisId,
    partId: initialPartId,
  });
  const [scan, setScan] = useState("");
  const [scanned, setScanned] = useState<{
    inward?: { id: number; partId: number; partNumber: string; description: string; quantity: number };
    cis?: { id: number; partId: number; partNumber: string; description: string; quantity: number };
    outward?: { id: number; partId: number; outwardNumber: string; quantity: number };
  } | null>(null);
  const [selectedRow, setSelectedRow] = useState<DashboardRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  // After save: show scan banner instead of auto-redirect
  const [lastCreated, setLastCreated] = useState<{
    type: "inward" | "cis";
    labelCode: string;
    nextStage: string;
  } | null>(null);

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
    if (initialCisId) change("cisId", initialCisId);
    if (initialPartId) change("partId", initialPartId);
  }, [initialInwardId, initialCisId, initialPartId]);

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
      const activePartId = form.partId || scanned?.inward?.partId || scanned?.cis?.partId;
      const res = await fetch("/api/compound-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, action, partId: activePartId }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Could not save record");

      toast.success(`${result.type.toUpperCase()} saved — label created.`);
      setForm(initialForm);
      setScanned(null);
      await load();

      // Show scan-to-advance banner instead of auto-redirecting
      if (action === "inward") {
        setLastCreated({ type: "inward", labelCode: result.data.labelCode, nextStage: "CIS" });
      } else if (action === "cis") {
        setLastCreated({ type: "cis", labelCode: result.data.labelCode, nextStage: "Outward" });
      } else {
        setLastCreated(null);
        // Outward has no next stage; no redirect needed
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
    if (!result.success || (!result.data?.inward && !result.data?.cis && !result.data?.outward)) {
      toast.error(result.error || "Label not found");
      return;
    }

    setScan("");
    setScanned(result.data);
    setLastCreated(null); // clear banner on successful scan

    if (result.data.outward) {
      toast.success(`Outward ${result.data.outward.outwardNumber} scanned`);
      if (tab === "returns") {
        change("outwardId", String(result.data.outward.id));
        change("partId", String(result.data.outward.partId));
      }
    } else if (result.data.cis) {
      toast.success(`CIS ${result.data.cis.cisNumber} scanned`);
      router.push(
        `/compound-inventory/outward?cisId=${result.data.cis.id}&partId=${result.data.cis.partId}`
      );
    } else if (result.data.inward) {
      toast.success(`Inward ${result.data.inward.inwardNumber} scanned`);
      router.push(
        `/compound-inventory/cis?inwardId=${result.data.inward.id}&partId=${result.data.inward.partId}`
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

  const total = (key: keyof Pick<DashboardRow, "totalInwards" | "totalIssued" | "totalOutwards" | "totalReturns">) =>
    data.dashboard.reduce((sum, row) => sum + Number(row[key]), 0);

  return (
    <MainLayout
      title={initialTab === "dashboard" ? "Compound Inventory" : initialTab.toUpperCase()}
      subtitle="Track inward, CIS, outward and returns in one traceable flow"
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
                placeholder="Scan inward or CIS label code"
                className="w-full rounded-lg border-0 bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/20 placeholder:text-slate-400 focus:ring-amber-300"
              />
            </div>
            <button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-[#17324d] hover:bg-amber-300">
              <Barcode className="mr-1 inline h-4 w-4" />
              Scan
            </button>
          </form>
        </section>

        {/* ── Dashboard tab nav ── */}
        {initialTab === "dashboard" && (
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
            <button className="flex shrink-0 items-center gap-2 border-b-2 border-amber-500 px-4 py-3 text-sm font-semibold text-[#17324d]">
              <Boxes className="h-4 w-4" />
              Dashboard
            </button>
          </nav>
        )}

        {/* ── Views ── */}
        {tab === "dashboard" && (
          <Dashboard
            rows={data.dashboard}
            total={total}
            onDelete={deletePartRecords}
            onRowClick={(row) => { setSelectedRow(row); setShowModal(true); }}
          />
        )}
        {showModal && selectedRow && (
          <PartDetailModal
            row={selectedRow}
            onClose={() => { setShowModal(false); setSelectedRow(null); }}
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
        {tab === "cis" && (
          <CisView
            data={data}
            form={form}
            change={change}
            save={save}
            saving={saving}
            scanned={scanned}
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
          />
        )}
        {tab === "returns" && (
          <ReturnsView
            data={data}
            form={form}
            change={change}
            save={save}
            saving={saving}
            scanned={scanned}
          />
        )}
      </div>
    </MainLayout>
  );

  async function deletePartRecords(partId: number, partNumber: string) {
    if (
      !confirm(
        `Delete ALL compound inventory records for "${partNumber}"?\n\nThis removes all inward, CIS, outward and return records permanently.`
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
  total: (key: keyof Pick<DashboardRow, "totalInwards" | "totalIssued" | "totalOutwards" | "totalReturns">) => number;
  onDelete: (partId: number, partNumber: string) => void;
  onRowClick: (row: DashboardRow) => void;
}) {
  const cards = [
    { key: "totalInwards" as const, label: "Total Inwards", color: "bg-blue-600", icon: TrendingUp },
    { key: "totalIssued" as const, label: "Total Issued (CIS)", color: "bg-indigo-600", icon: Boxes },
    { key: "totalOutwards" as const, label: "Total Outwards", color: "bg-emerald-600", icon: TrendingDown },
    { key: "totalReturns" as const, label: "Total Returns", color: "bg-rose-600", icon: RotateCcw },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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
          <PackageCheck className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Part</th>
                <th className="px-5 py-3 text-right">Inwards</th>
                <th className="px-5 py-3 text-right">Issued (CIS)</th>
                <th className="px-5 py-3 text-right">Outwards</th>
                <th className="px-5 py-3 text-right">Returns</th>
                <th className="px-5 py-3 text-right">Inward Bal.</th>
                <th className="px-5 py-3 text-right">CIS Bal.</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                    No records yet — start by creating an Inward.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const inwardBal = row.totalInwards - row.totalIssued;
                const cisBal = row.totalIssued - row.totalOutwards + row.totalReturns;
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
                    <td className="px-5 py-3 text-right tabular-nums">{row.totalIssued}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.totalOutwards}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-rose-600">{row.totalReturns}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-blue-800">{inwardBal}</td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-[#17324d]">{cisBal}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`/api/compound-inventory/pdf?partId=${row.partId}`, "_blank"); }}
                          className="rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50"
                          title="View PDF report"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(row.partId, row.partNumber); }}
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
  onPrint: (type: "inward" | "cis" | "outward", id: number) => void;
  lastCreated?: { type: "inward" | "cis"; labelCode: string; nextStage: string } | null;
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

        {/* Scan-to-advance banner */}
        {lastCreated?.type === "inward" && (
          <ScanAdvanceBanner labelCode={lastCreated.labelCode} nextStage={lastCreated.nextStage} />
        )}
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
  onPrint: (type: "inward" | "cis" | "outward", id: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-bold text-[#17324d]">Inward Records</h3>
          <p className="text-xs text-slate-500">{records.length} record{records.length !== 1 ? "s" : ""} · most recent first</p>
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
                <td className="px-4 py-3"><LabelBadge code={row.labelCode} /></td>
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

// ─── CIS View ────────────────────────────────────────────────────────────

interface CisViewProps extends ViewProps {
  scanned: any;
}

function CisView({ data, form, change, save, saving, scanned, printing, onPrint, lastCreated }: CisViewProps) {
  const available = (row: Inward) =>
    row.quantity -
    data.cis
      .filter(({ record }) => record.inwardId === row.id)
      .reduce((sum, { record }) => sum + record.quantity, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      {/* ── Form ── */}
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-indigo-100 p-2">
                <Boxes className="h-4 w-4 text-indigo-700" />
              </div>
              <div>
                <h3 className="font-bold text-[#17324d]">Create CIS Issue</h3>
                <p className="text-xs text-slate-500">Issue material from an inward record into CIS production.</p>
              </div>
            </div>
          </div>

          {scanned?.inward && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Scanned <strong>{scanned.inward.partNumber}</strong> — inward qty{" "}
                <strong>{scanned.inward.quantity}</strong>
              </span>
            </div>
          )}

          <form onSubmit={(e) => save(e, "cis")} className="space-y-4">
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
                label: `${row.inwardNumber} · ${partNumber} · avail: ${available(row as any)}`,
              }))}
            />
            <Field label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Operator" name="operatorName" value={form.operatorName} onChange={change} placeholder="Optional" />
              <Field label="Remarks" name="remarks" value={form.remarks} onChange={change} placeholder="Optional" />
            </div>
            <button
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#234c70] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
              {saving ? "Saving…" : "Create CIS + Label"}
            </button>
          </form>
        </section>

        {/* Scan-to-advance banner */}
        {lastCreated?.type === "cis" && (
          <ScanAdvanceBanner labelCode={lastCreated.labelCode} nextStage={lastCreated.nextStage} />
        )}
      </div>

      {/* ── Records table ── */}
      <CisTable records={data.cis} printing={printing} onPrint={onPrint} />
    </div>
  );
}

function CisTable({
  records,
  printing,
  onPrint,
}: {
  records: Data["cis"];
  printing: string | null;
  onPrint: (type: "inward" | "cis" | "outward", id: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-bold text-[#17324d]">CIS Records</h3>
          <p className="text-xs text-slate-500">{records.length} record{records.length !== 1 ? "s" : ""} · most recent first</p>
        </div>
        <TypeBadge type="CIS" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">CIS No.</th>
              <th className="px-4 py-3">Part</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">From Inward</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3 text-center">Print</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                  No CIS records yet. Scan an inward label to begin.
                </td>
              </tr>
            )}
            {records.map(({ record: row, partNumber, description, inwardNumber }) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.cisNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{partNumber}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{row.quantity}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{inwardNumber}</td>
                <td className="px-4 py-3 text-slate-600">{row.operatorName || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                <td className="px-4 py-3"><LabelBadge code={row.labelCode} /></td>
                <td className="px-4 py-3 text-center">
                  <PrintBtn type="cis" id={row.id} printing={printing} onPrint={onPrint} />
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

function OutwardView({ data, form, change, save, saving }: Omit<ViewProps, "lastCreated" | "printing" | "onPrint">) {
  const available = (row: Cis) =>
    row.quantity -
    data.outwards
      .filter(({ record }) => record.cisId === row.id)
      .reduce((sum, { record }) => sum + record.quantity, 0);

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
              <p className="text-xs text-slate-500">Dispatch CIS material.</p>
            </div>
          </div>
        </div>
        <form onSubmit={(e) => save(e, "outward")} className="space-y-4">
          <Select
            label="CIS Record"
            name="cisId"
            value={form.cisId}
            required
            onChange={(name, value) => {
              const row = data.cis.find((x) => String(x.record.id) === value);
              change(name, value);
              if (row) change("partId", String(row.record.partId));
            }}
            options={data.cis.map(({ record: row, partNumber }) => ({
              value: String(row.id),
              label: `${row.cisNumber} · ${partNumber} · avail: ${available(row as any)}`,
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
        </form>
      </section>

      {/* ── Records table ── */}
      <OutwardTable records={data.outwards} />
    </div>
  );
}

function OutwardTable({
  records,
}: {
  records: Data["outwards"];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-bold text-[#17324d]">Outward Records</h3>
          <p className="text-xs text-slate-500">{records.length} record{records.length !== 1 ? "s" : ""} · most recent first</p>
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
              <th className="px-4 py-3">From CIS</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Dispatched</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  No outward records yet. Scan a CIS label to begin.
                </td>
              </tr>
            )}
            {records.map(({ record: row, partNumber, description, cisNumber }) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.outwardNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{partNumber}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{row.quantity}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{cisNumber}</td>
                <td className="px-4 py-3 text-slate-600">{row.destination || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(row.dispatchedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Returns View ─────────────────────────────────────────────────────────

function ReturnsView({
  data,
  form,
  change,
  save,
  saving,
  scanned,
}: Pick<ViewProps, "data" | "form" | "change" | "save" | "saving"> & { scanned: any }) {
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

        {scanned?.outward && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Scanned Outward <strong>{scanned.outward.outwardNumber}</strong></span>
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
              if (row) change("partId", String(row.record.partId));
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
            <p className="text-xs text-slate-500">{data.returns.length} record{data.returns.length !== 1 ? "s" : ""}</p>
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
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-rose-700">{row.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{row.reason}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs font-semibold ring-1 ${
                      row.addToInventory
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        : "bg-rose-50 text-rose-800 ring-rose-200"
                    }`}>
                      {row.addToInventory ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(row.returnedAt)}</td>
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
  const inwardBal = row.totalInwards - row.totalIssued;
  const cisBal = row.totalIssued - row.totalOutwards + row.totalReturns;

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

        <div className="p-6 space-y-5">
          {/* Balance cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Inward Balance</p>
              <p className="mt-2 text-3xl font-bold text-blue-900">{inwardBal}</p>
              <p className="mt-1 text-xs text-blue-600">Available units</p>
            </div>
            <div className="rounded-xl border-2 border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">CIS Balance</p>
              <p className="mt-2 text-3xl font-bold text-emerald-900">{cisBal}</p>
              <p className="mt-1 text-xs text-emerald-600">Available units</p>
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
                { icon: TrendingUp, color: "blue", label: "Total Inwards", sub: "Material received", val: row.totalInwards },
                { icon: Boxes, color: "indigo", label: "Total Issued (CIS)", sub: "Issued to production", val: row.totalIssued },
                { icon: TrendingDown, color: "emerald", label: "Total Outwards", sub: "Dispatched", val: row.totalOutwards },
                { icon: RotateCcw, color: "rose", label: "Total Returns", sub: "Returned", val: row.totalReturns },
              ].map(({ icon: Icon, color, label, sub, val }) => (
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
                  <p className={`text-xl font-bold ${color === "rose" ? "text-rose-600" : "text-slate-800"}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {(inwardBal < 0 || cisBal < 0) && (
            <div className="flex items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Balance Alert</p>
                <p className="mt-1 text-sm text-amber-700">Negative balance detected — review transaction records for discrepancies.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={() => { onDelete(row.partId, row.partNumber); onClose(); }}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete All Records
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
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
