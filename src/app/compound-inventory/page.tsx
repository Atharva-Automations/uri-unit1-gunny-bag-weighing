"use client";

import { Children, FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { useToast } from "@/utils/toast";
import { Barcode, Boxes, CheckCircle2, Download, Eye, LockKeyhole, LogOut, PackageCheck, RotateCcw, Search, Trash2, X, FileText, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

type Part = { id: number; partNumber: string; description: string };
type DashboardRow = { partId: number; partNumber: string; description: string; totalInwards: number; totalIssued: number; totalOutwards: number; totalReturns: number; totalOutwardReturns: number; totalGeneralReturns: number; };
type Inward = { id: number; inwardNumber: string; labelCode: string; quantity: number; partId: number; partNumber: string; description: string; supplier: string | null; batchNumber: string | null; receivedAt: string };
type Cis = { id: number; cisNumber: string; labelCode: string; quantity: number; inwardId: number; inwardNumber: string; partId: number; partNumber: string; description: string; createdAt: string };
type Outward = { id: number; outwardNumber: string; labelCode: string; quantity: number; cisId: number; cisNumber: string; partId: number; partNumber: string; destination: string | null; dispatchedAt: string };
type ReturnRecord = { id: number; quantity: number; reason: string; partId: number; partNumber: string; returnedAt: string };
type Data = { dashboard: DashboardRow[]; inwards: { record: Inward; partNumber: string; description: string }[]; cis: { record: Cis; partNumber: string; description: string; inwardNumber: string }[]; outwards: { record: Outward; partNumber: string; description: string; cisNumber: string }[]; returns: { record: ReturnRecord; partNumber: string; description: string }[]; parts: Part[] };

type Tab = "dashboard" | "inward" | "cis" | "outward" | "returns";
const initialForm = { partId: "", quantity: "", supplier: "", batchNumber: "", operatorName: "", remarks: "", inwardId: "", cisId: "", destination: "", reason: "", outwardId: "" };

function date(value: string) { return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function label(value: string) {
  return <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 font-mono text-xs font-semibold text-amber-800"><Barcode className="h-3.5 w-3.5" />{value}</span>;
}

export default function CompoundInventoryPage({ initialTab = "dashboard", initialInwardId = "", initialCisId = "", initialPartId = "" }: { initialTab?: Tab; initialInwardId?: string; initialCisId?: string; initialPartId?: string }) {
  const toast = useToast();
  const router = useRouter();
  const tab = initialTab;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loggingIn, setLoggingIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ...initialForm,
    inwardId: initialInwardId,
    cisId: initialCisId,
    partId: initialPartId,
  });
  const [scan, setScan] = useState("");
  const [scanned, setScanned] = useState<{ inward?: { id: number; partId: number; partNumber: string; description: string; quantity: number }; cis?: { id: number; partId: number; partNumber: string; description: string; quantity: number }; outward?: { id: number; partId: number; outwardNumber: string; quantity: number } } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DashboardRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/compound-inventory");
      const result = await response.json();
      // Authentication disabled
      // if (response.status === 401) {
      //   setRequiresLogin(true);
      //   setData(null);
      //   return;
      // }
      if (!response.ok || !result.success) throw new Error(result.error || "Could not load Compound Inventory");
      setRequiresLogin(false);
      setData(result.data);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load Compound Inventory"); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  // When initial values change (from URL), update form
  useEffect(() => {
    if (initialInwardId) change("inwardId", initialInwardId);
    if (initialCisId) change("cisId", initialCisId);
    if (initialPartId) change("partId", initialPartId);
  }, [initialInwardId, initialCisId, initialPartId]);

  function change(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })); }

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoggingIn(true);
    try {
      const response = await fetch("/api/compound-inventory/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Login failed");
      setLoginForm({ username: "", password: "" });
      await load();
      toast.success("Signed in to Compound Inventory");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Login failed"); }
    finally { setLoggingIn(false); }
  }

  async function logout() {
    await fetch("/api/compound-inventory/logout", { method: "POST" });
    setData(null);
    setRequiresLogin(true);
  }

  async function deletePartRecords(partId: number, partNumber: string) {
    if (!confirm(`Are you sure you want to delete ALL compound inventory records for part "${partNumber}"?\n\nThis will permanently remove:\n- All inward records\n- All CIS records\n- All outward records\n- All return records\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/compound-inventory/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not delete records");

      toast.success(`All compound inventory records for ${partNumber} have been deleted.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete records");
    } finally {
      setDeleting(false);
    }
  }

  async function save(event: FormEvent, action: string) {
    event.preventDefault();
    setSaving(true);
    try {
      const activePartId = form.partId || scanned?.inward?.partId || scanned?.cis?.partId;
      const response = await fetch("/api/compound-inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, action, partId: activePartId }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not save record");

      toast.success(`${result.type.toUpperCase()} saved. Label ${result.data?.labelCode ? "created" : "recorded"}.`);
      setForm(initialForm);
      setScanned(null);
      await load();

      // Navigate sequentially but without full reload, passing correct IDs
      if (action === "inward") router.push(`/compound-inventory/cis?inwardId=${result.data.id}&partId=${activePartId}`);
      if (action === "cis") router.push(`/compound-inventory/outward?cisId=${result.data.id}&partId=${activePartId}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save record"); }
    finally { setSaving(false); }
  }

  async function scanLabel(event: FormEvent) {
    event.preventDefault();
    if (!scan.trim()) return;
    const response = await fetch(`/api/compound-inventory?scan=${encodeURIComponent(scan.trim())}`);
    const result = await response.json();
    if (response.status === 401) { setRequiresLogin(true); setData(null); return; }
    if (!result.success || (!result.data?.inward && !result.data?.cis && !result.data?.outward)) { toast.error(result.error || "Label was not found"); return; }

    setScan("");
    setScanned(result.data);

    if (result.data.outward) {
      toast.success(`Outward ${result.data.outward.outwardNumber} scanned`);
      // Update form if we're on returns page
      if (tab === "returns") {
        change("outwardId", String(result.data.outward.id));
        change("partId", String(result.data.outward.partId));
      }
    } else if (result.data.cis) {
      toast.success(`CIS ${result.data.cis.cisNumber} scanned`);
      router.push(`/compound-inventory/outward?cisId=${result.data.cis.id}&partId=${result.data.cis.partId}`);
    } else if (result.data.inward) {
      toast.success(`Inward ${result.data.inward.inwardNumber} scanned`);
      router.push(`/compound-inventory/cis?inwardId=${result.data.inward.id}&partId=${result.data.inward.partId}`);
    }
  }

  if (loading && !data) return <MainLayout title="Compound Inventory" subtitle="Material movement and traceability"><div className="p-10 text-center text-slate-500">Loading ledger...</div></MainLayout>;
  // Authentication disabled
  // if (requiresLogin) return <MainLayout title="Compound Inventory" subtitle="Material movement and traceability"><LoginPanel form={loginForm} setForm={setLoginForm} onSubmit={login} loading={loggingIn} /></MainLayout>;
  if (!data) return null;
  const total = (key: keyof Pick<DashboardRow, "totalInwards" | "totalIssued" | "totalOutwards" | "totalReturns">) => data.dashboard.reduce((sum, row) => sum + Number(row[key]), 0);

  return <MainLayout title={initialTab === "dashboard" ? "Compound Inventory" : initialTab.toUpperCase()} subtitle="Track inward, CIS, outward and returns in one traceable flow">
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl bg-[#17324d] p-5 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Compound Inventory</p><h2 className="mt-1 text-2xl font-bold">Material movement control</h2><p className="mt-1 text-sm text-slate-300">Create labels, scan them into the next stage, and keep every part balance visible.</p></div>
        <form onSubmit={scanLabel} className="flex w-full max-w-md gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={scan} onChange={(event) => setScan(event.target.value)} placeholder="Scan inward or CIS label code" className="w-full rounded-lg border-0 bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/20 placeholder:text-slate-400 focus:ring-amber-300" /></div><button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-[#17324d] hover:bg-amber-300"><Barcode className="mr-1 inline h-4 w-4" />Scan</button></form>
      </section>

      {/* Authentication disabled */}
      {/* <div className="flex justify-end"><button type="button" onClick={logout} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#17324d]"><LogOut className="h-4 w-4" />Sign out</button></div> */}

      {initialTab === "dashboard" && <nav className="flex gap-1 overflow-x-auto border-b border-slate-200"><button className="flex shrink-0 items-center gap-2 border-b-2 border-amber-500 px-4 py-3 text-sm font-semibold text-[#17324d]"><Boxes className="h-4 w-4" />Dashboard</button></nav>}

      {tab === "dashboard" && <Dashboard rows={data.dashboard} total={total} onDelete={deletePartRecords} onRowClick={(row) => { setSelectedRow(row); setShowModal(true); }} />}
      {showModal && selectedRow && <PartDetailModal row={selectedRow} onClose={() => { setShowModal(false); setSelectedRow(null); }} onDelete={deletePartRecords} />}
      {tab === "inward" && <InwardView data={data} form={form} change={change} save={save} saving={saving} />}
      {tab === "cis" && <CisView data={data} form={form} change={change} save={save} saving={saving} scanned={scanned} />}
      {tab === "outward" && <OutwardView data={data} form={form} change={change} save={save} saving={saving} />}
      {tab === "returns" && <ReturnsView data={data} form={form} change={change} save={save} saving={saving} scanned={scanned} />}
    </div>
  </MainLayout>;
}

function LoginPanel({ form, setForm, onSubmit, loading }: { form: { username: string; password: string }; setForm: (form: { username: string; password: string }) => void; onSubmit: (event: FormEvent) => void; loading: boolean }) {
  return <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-6 flex items-start gap-3"><div className="rounded-xl bg-amber-100 p-3 text-amber-700"><LockKeyhole className="h-6 w-6" /></div><div><h2 className="text-xl font-bold text-[#17324d]">Compound Inventory login</h2><p className="mt-1 text-sm text-slate-500">Sign in to access material movement records.</p></div></div><form onSubmit={onSubmit} className="space-y-4"><Field label="Username" name="username" value={form.username} onChange={(name, value) => setForm({ ...form, [name]: value })} required /><Field label="Password" name="password" value={form.password} onChange={(name, value) => setForm({ ...form, [name]: value })} type="password" required /><button disabled={loading} className="w-full rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#234c70] disabled:opacity-50">{loading ? "Signing in..." : "Sign in"}</button></form></section>;
}

function Dashboard({ rows, total, onDelete, onRowClick }: { rows: DashboardRow[]; total: (key: keyof Pick<DashboardRow, "totalInwards" | "totalIssued" | "totalOutwards" | "totalReturns">) => number; onDelete: (partId: number, partNumber: string) => void; onRowClick: (row: DashboardRow) => void }) {
  const cards = [{ key: "totalInwards", label: "Total Inwards", color: "bg-blue-600" }, { key: "totalIssued", label: "Total Issued", color: "bg-indigo-600" }, { key: "totalOutwards", label: "Total Outwards", color: "bg-emerald-600" }, { key: "totalReturns", label: "Total Returns", color: "bg-rose-600" }] as const;

  function viewPDF(partId: number, e: React.MouseEvent) {
    e.stopPropagation();
    window.open(`/api/compound-inventory/pdf?partId=${partId}`, "_blank");
  }

  function handleDelete(partId: number, partNumber: string, e: React.MouseEvent) {
    e.stopPropagation();
    onDelete(partId, partNumber);
  }

  return <><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{cards.map((card) => <div key={card.key} className={`${card.color} rounded-xl p-5 text-white shadow-sm`}><p className="text-xs font-semibold uppercase tracking-wide text-white/70">{card.label}</p><p className="mt-2 text-3xl font-bold">{total(card.key).toLocaleString()}</p><p className="mt-1 text-xs text-white/70">units recorded</p></div>)}</div><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-[#17324d]">Part movement summary</h3><p className="text-xs text-slate-500">Click on any row to view detailed information</p></div><PackageCheck className="h-5 w-5 text-emerald-600" /></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Part</th><th className="px-5 py-3 text-right">Inwards</th><th className="px-5 py-3 text-right">Issued CIS</th><th className="px-5 py-3 text-right">Outwards</th><th className="px-5 py-3 text-right">Returns</th><th className="px-5 py-3 text-right">Inward Bal.</th><th className="px-5 py-3 text-right">CIS Bal.</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => {
    const inwardBal = row.totalInwards - row.totalIssued;
    const cisBal = row.totalIssued - row.totalOutwards + row.totalReturns;

    return (<tr key={row.partId} onClick={() => onRowClick(row)} className="cursor-pointer transition-colors hover:bg-slate-50"><td className="px-5 py-3"><p className="font-semibold text-slate-800">{row.partNumber}</p><p className="text-xs text-slate-500">{row.description}</p></td><td className="px-5 py-3 text-right">{row.totalInwards}</td><td className="px-5 py-3 text-right">{row.totalIssued}</td><td className="px-5 py-3 text-right">{row.totalOutwards}</td><td className="px-5 py-3 text-right text-rose-600">{row.totalReturns}</td><td className="px-5 py-3 text-right font-semibold text-blue-800">{inwardBal}</td><td className="px-5 py-3 text-right font-bold text-[#17324d]">{cisBal}</td><td className="px-5 py-3"><div className="flex items-center justify-end gap-2"><button onClick={(e) => viewPDF(row.partId, e)} className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 transition-colors" title="View Details & PDF"><Eye className="h-4 w-4" /></button><button onClick={(e) => handleDelete(row.partId, row.partNumber, e)} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 transition-colors" title="Delete all records"><Trash2 className="h-4 w-4" /></button></div></td></tr>);
  })}</tbody></table></div></section></>;
}

function Field({ label: text, name, value, onChange, type = "text", required = false, placeholder }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; type?: string; required?: boolean; placeholder?: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{text}</span><input type={type} required={required} value={value} placeholder={placeholder} onChange={(event) => onChange(name, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></label>; }
function Select({ label: text, value, name, options, onChange, required = false }: { label: string; value: string; name: string; options: { value: string; label: string }[]; onChange: (name: string, value: string) => void; required?: boolean }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{text}</span><select required={required} value={value} onChange={(event) => onChange(name, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"><option value="">Select...</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function FormShell({ title, description, children, onSubmit, saving, actionLabel }: { title: string; description: string; children: React.ReactNode; onSubmit: (event: FormEvent) => void; saving: boolean; actionLabel: string }) { return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 border-b border-slate-100 pb-4"><h3 className="font-bold text-[#17324d]">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div><form onSubmit={onSubmit} className="space-y-5">{children}<button disabled={saving} className="rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#234c70] disabled:opacity-50">{saving ? "Saving..." : actionLabel}</button></form></section>; }

interface ViewProps { data: Data; form: typeof initialForm; change: (k: string, v: string) => void; save: (e: FormEvent, action: string) => void; saving: boolean; }

function InwardView({ data, form, change, save, saving }: ViewProps) { return <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]"><FormShell title="Create inward" description="Register received material and create its traceability label." onSubmit={(event) => save(event, "inward")} saving={saving} actionLabel="Create inward + label"><Select label="Part" name="partId" value={form.partId} required onChange={change} options={data.parts.map((part: Part) => ({ value: String(part.id), label: `${part.partNumber} - ${part.description}` }))} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" required /><Field label="Supplier" name="supplier" value={form.supplier} onChange={change} /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Batch number" name="batchNumber" value={form.batchNumber} onChange={change} /><Field label="Operator" name="operatorName" value={form.operatorName} onChange={change} /></div><Field label="Remarks" name="remarks" value={form.remarks} onChange={change} /></FormShell><RecordList title="Recent inwards" empty="No inwards recorded yet.">{data.inwards.map(({ record: row, partNumber }) => <div key={row.id} className="flex flex-col gap-2 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{partNumber} <span className="font-normal text-slate-400">· {row.quantity} parts</span></p><p className="text-xs text-slate-500">{row.inwardNumber} · {date(row.receivedAt)}</p></div>{label(row.labelCode)}</div>)}</RecordList></div>; }
function CisView({ data, form, change, save, saving, scanned }: ViewProps & { scanned: any }) {
  const available = (row: Inward) => row.quantity - data.cis.filter(({ record }) => record.inwardId === row.id).reduce((sum, { record }) => sum + record.quantity, 0);
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]"><FormShell title="Create CIS" description="Scan an inward label or select an inward record to issue material into CIS." onSubmit={(event) => save(event, "cis")} saving={saving} actionLabel="Create CIS + label">{scanned?.inward && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-1 inline h-4 w-4" />Scanned {scanned.inward.partNumber}, inward quantity {scanned.inward.quantity}</div>}<Select label="Inward record" name="inwardId" value={form.inwardId} required onChange={(name, value) => { const row = data.inwards.find((x) => String(x.record.id) === value); change(name, value); if (row) change("partId", String(row.record.partId)); }} options={data.inwards.map(({ record: row, partNumber }) => ({ value: String(row.id), label: `${row.inwardNumber} · ${partNumber} · avail: ${available(row)}` }))} /><Field label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" required /><Field label="Operator" name="operatorName" value={form.operatorName} onChange={change} /><Field label="Remarks" name="remarks" value={form.remarks} onChange={change} /></FormShell><RecordList title="Recent CIS records" empty="No CIS records recorded yet.">{data.cis.map(({ record: row, partNumber }) => <div key={row.id} className="flex flex-col gap-2 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{row.cisNumber} <span className="font-normal text-slate-400">· {partNumber} · {row.quantity} parts</span></p><p className="text-xs text-slate-500">Created {date(row.createdAt)}</p></div>{label(row.labelCode)}</div>)}</RecordList></div>;
}
function OutwardView({ data, form, change, save, saving }: ViewProps) {
  const available = (row: Cis) => row.quantity - data.outwards.filter(({ record }) => record.cisId === row.id).reduce((sum, { record }) => sum + record.quantity, 0);
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]"><FormShell title="Create outward" description="Release CIS material and create the outward label for dispatch." onSubmit={(event) => save(event, "outward")} saving={saving} actionLabel="Create outward + label"><Select label="CIS record" name="cisId" value={form.cisId} required onChange={(name, value) => { const row = data.cis.find((x) => String(x.record.id) === value); change(name, value); if (row) change("partId", String(row.record.partId)); }} options={data.cis.map(({ record: row, partNumber }) => ({ value: String(row.id), label: `${row.cisNumber} · ${partNumber} · avail: ${available(row)}` }))} /><Field label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" required /><div className="grid gap-4 sm:grid-cols-2"><Field label="Destination" name="destination" value={form.destination} onChange={change} /><Field label="Operator" name="operatorName" value={form.operatorName} onChange={change} /></div><Field label="Remarks" name="remarks" value={form.remarks} onChange={change} /></FormShell><RecordList title="Recent outwards" empty="No outwards recorded yet.">{data.outwards.map(({ record: row, partNumber }) => <div key={row.id} className="flex flex-col gap-2 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{row.outwardNumber} <span className="font-normal text-slate-400">· {partNumber} · {row.quantity} parts</span></p><p className="text-xs text-slate-500">{row.destination || "No destination"} · {date(row.dispatchedAt)}</p></div>{label(row.labelCode)}</div>)}</RecordList></div>;
}
function ReturnsView({ data, form, change, save, saving, scanned }: ViewProps & { scanned: any }) { return <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]"><FormShell title="Record return" description="Capture returned material and the reason for traceability." onSubmit={(event) => save(event, "return")} saving={saving} actionLabel="Record return">
  {scanned?.outward && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-1 inline h-4 w-4" />Scanned Outward {scanned.outward.outwardNumber}</div>}
  <Select label="Part" name="partId" value={form.partId} required onChange={change} options={data.parts.map((part: Part) => ({ value: String(part.id), label: `${part.partNumber} - ${part.description}` }))} />

  <Select label="Linked Outward (Optional)" name="outwardId" value={form.outwardId} onChange={(name, value) => { const row = data.outwards.find((x) => String(x.record.id) === value); change(name, value); if (row) change("partId", String(row.record.partId)); }} options={data.outwards.filter(x => !form.partId || String(x.record.partId) === form.partId).map(({ record: row, partNumber }) => ({ value: String(row.id), label: `${row.outwardNumber} · ${partNumber}` }))} />

  <div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" required /><Field label="Operator" name="operatorName" value={form.operatorName} onChange={change} /></div><Field label="Reason for return" name="reason" value={form.reason} onChange={change} required placeholder="Quality issue, excess material, damage..." /><Field label="Remarks" name="remarks" value={form.remarks} onChange={change} /></FormShell><RecordList title="Recent returns" empty="No returns recorded yet.">{data.returns.map(({ record: row, partNumber }) => <div key={row.id} className="flex items-center justify-between border-b border-slate-100 p-4 last:border-0"><div><p className="font-semibold text-slate-800">{partNumber} <span className="font-normal text-slate-400">· {row.quantity} parts</span></p><p className="text-xs text-slate-500">{row.reason} · {date(row.returnedAt)}</p></div><RotateCcw className="h-4 w-4 text-rose-500" /></div>)}</RecordList></div>; }
function RecordList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-[#17324d]">{title}</h3></div>{Children.count(children) > 0 ? children : <p className="p-8 text-center text-sm text-slate-400">{empty}</p>}</section>; }

function PartDetailModal({ row, onClose, onDelete }: { row: DashboardRow; onClose: () => void; onDelete: (partId: number, partNumber: string) => void }) {
  const inwardBal = row.totalInwards - row.totalIssued;
  const cisBal = row.totalIssued - row.totalOutwards + row.totalReturns;

  function downloadPDF() {
    const link = document.createElement("a");
    link.href = `/api/compound-inventory/pdf?partId=${row.partId}`;
    link.download = `compound-inventory-${row.partNumber}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleDelete() {
    onDelete(row.partId, row.partNumber);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#17324d] to-[#234c70] px-6 py-5 text-white">
          <div>
            <h2 className="text-2xl font-bold">{row.partNumber}</h2>
            <p className="mt-1 text-sm text-slate-200">{row.description}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Inward Balance</p>
                  <p className="mt-2 text-3xl font-bold text-blue-900">{inwardBal}</p>
                  <p className="mt-1 text-xs text-blue-600">Available units</p>
                </div>
                <div className="rounded-xl bg-blue-100 p-3">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border-2 border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">CIS Balance</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-900">{cisBal}</p>
                  <p className="mt-1 text-xs text-emerald-600">Available units</p>
                </div>
                <div className="rounded-xl bg-emerald-100 p-3">
                  <PackageCheck className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Movement Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#17324d]">
              <FileText className="h-5 w-5" />
              Movement Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Inwards</p>
                    <p className="text-sm text-slate-600">Material received</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{row.totalInwards}</p>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-100 p-2">
                    <Boxes className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Issued (CIS)</p>
                    <p className="text-sm text-slate-600">Issued to production</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{row.totalIssued}</p>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2">
                    <TrendingDown className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Outwards</p>
                    <p className="text-sm text-slate-600">Dispatched material</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{row.totalOutwards}</p>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-rose-100 p-2">
                    <RotateCcw className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Returns</p>
                    <p className="text-sm text-slate-600">Returned material</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-rose-600">{row.totalReturns}</p>
              </div>
            </div>
          </div>

          {/* Status Alert */}
          {(inwardBal < 0 || cisBal < 0) && (
            <div className="flex items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Balance Alert</p>
                <p className="mt-1 text-sm text-amber-700">
                  Negative balance detected. Please review the transaction records for discrepancies.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={handleDelete} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50">
            <Trash2 className="h-4 w-4" />
            Delete All Records
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
              Close
            </button>
            <button onClick={downloadPDF} className="inline-flex items-center gap-2 rounded-lg bg-[#17324d] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#234c70]">
              <Download className="h-4 w-4" />
              Download PDF Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
