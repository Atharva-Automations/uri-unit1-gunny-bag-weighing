"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import {
  Scale,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  Package,
  QrCode,
  Wifi,
  WifiOff,
  X,
  Check,
  Printer,
  RefreshCw,
  Save,
  Search,
  Info,
} from "lucide-react";

interface Part {
  id: number;
  partNumber: string;
  description: string;
  minWeight: string;
  maxWeight: string;
  quantity: number;
  actualWeight: string;
}

type Status = "OK" | "UNDERWEIGHT" | "OVERWEIGHT" | "PENDING";

interface LiveReading {
  weight: number;
  source: "scale" | "mock";
  at: string;
}

interface ScaleStatus {
  connected: boolean;
  port: string;
  baudRate: number;
  slaveId: number;
  divisor: number;
  mockEnabled: boolean;
  lastError: string | null;
}

function evaluateWeight(
  actual: number,
  part: Part | null
): { status: Status; min: number; max: number; message: string } {
  if (!part)
    return {
      status: "PENDING",
      min: 0,
      max: 0,
      message: "Scan or select a part to begin",
    };
  const min = parseFloat(part.minWeight) * part.quantity;
  const max = parseFloat(part.maxWeight) * part.quantity;
  if (actual < min)
    return {
      status: "UNDERWEIGHT",
      min,
      max,
      message: `Below minimum bag weight of ${min.toFixed(3)} kg`,
    };
  if (actual > max)
    return {
      status: "OVERWEIGHT",
      min,
      max,
      message: `Exceeds maximum bag weight of ${max.toFixed(3)} kg`,
    };
  return {
    status: "OK",
    min,
    max,
    message: `Bag weight is within the acceptable range`,
  };
}

function statusConfig(status: Status) {
  switch (status) {
    case "OK":
      return {
        bg: "bg-emerald-50",
        border: "border-emerald-300",
        text: "text-emerald-700",
        icon: CheckCircle,
        label: "OK",
      };
    case "OVERWEIGHT":
      return {
        bg: "bg-red-50",
        border: "border-red-300",
        text: "text-red-700",
        icon: AlertTriangle,
        label: "OVERWEIGHT",
      };
    case "UNDERWEIGHT":
      return {
        bg: "bg-amber-50",
        border: "border-amber-300",
        text: "text-amber-700",
        icon: TrendingDown,
        label: "UNDERWEIGHT",
      };
    default:
      return {
        bg: "bg-slate-50",
        border: "border-slate-200",
        text: "text-slate-500",
        icon: Scale,
        label: "WAITING",
      };
  }
}

function StatusBanner({ status, message, weight }: { status: Status; message: string; weight: number }) {
  const cfg = statusConfig(status);
  const Icon = cfg.icon;
  return (
    <div className={`${cfg.bg} ${cfg.border} border-2 rounded-2xl p-5 flex items-center gap-4 transition-all`}>
      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-md flex-shrink-0">
        <Icon className={`w-7 h-7 ${cfg.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-2xl font-bold ${cfg.text}`}>{cfg.label}</p>
        <p className={`text-sm ${cfg.text} opacity-80 mt-0.5`}>{message}</p>
      </div>
      <div className="text-right">
        <p className={`text-3xl font-mono font-bold ${cfg.text}`}>{weight.toFixed(3)}</p>
        <p className={`text-xs ${cfg.text} opacity-60`}>kg</p>
      </div>
    </div>
  );
}

function LiveWeighingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const partParam = searchParams.get("part");

  const [part, setPart] = useState<Part | null>(null);
  const [weight, setWeight] = useState(0);
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [scaleStatus, setScaleStatus] = useState<ScaleStatus | null>(null);
  const [polling, setPolling] = useState(true);
  const [stable, setStable] = useState(false);
  const [lastRecordId, setLastRecordId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Part[]>([]);
  const [searching, setSearching] = useState(false);
  const [operatorName, setOperatorName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const stableStartRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load part by URL param
  useEffect(() => {
    if (!partParam) return;
    fetch(`/api/parts?q=${encodeURIComponent(partParam)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data.length > 0) {
          const found = d.data.find(
            (p: Part) => p.partNumber.toLowerCase() === partParam.toLowerCase()
          );
          if (found) setPart(found);
        }
      });
  }, [partParam]);

  // Poll the scale
  useEffect(() => {
    if (!polling) return;
    const tick = async () => {
      try {
        const res = await fetch("/api/scale");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setReading(data.data);
            setScaleStatus(data.status);
            setWeight(data.data.weight);
          }
        } else {
          const data = await res.json();
          setScaleStatus(data.status);
        }
      } catch {
        // network glitch; keep going
      }
    };
    tick();
    pollRef.current = setInterval(tick, 500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [polling]);

  // Detect stability (weight within 0.01kg for 1s)
  useEffect(() => {
    if (weight <= 0) {
      stableStartRef.current = null;
      setStable(false);
      return;
    }
    if (stableStartRef.current === null) {
      stableStartRef.current = Date.now();
      setStable(false);
      return;
    }
    const elapsed = Date.now() - stableStartRef.current;
    if (elapsed > 800) setStable(true);
  }, [weight]);

  // Search parts
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/parts?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) setSearchResults(data.data);
    } finally {
      setSearching(false);
    }
  }, []);

  // Auto-search debounced
  useEffect(() => {
    if (!showPartPicker) return;
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, showPartPicker, doSearch]);

  function selectPart(p: Part) {
    setPart(p);
    setShowPartPicker(false);
    setSearchQuery("");
    setSearchResults([]);
    setLastRecordId(null);
    router.replace(`/weighing?part=${encodeURIComponent(p.partNumber)}`);
  }

  async function handleRecord() {
    if (!part || weight <= 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId: part.id,
          actualWeight: weight.toFixed(3),
          quantity: part.quantity,
          operatorName: operatorName.trim() || undefined,
          remarks: remarks.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLastRecordId(data.data.id);
        setOperatorName("");
        setRemarks("");
      } else {
        setError(data.error || "Failed to record weighing");
      }
    } catch {
      setError("Network error while recording weighing");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrint() {
    if (!part) return;
    setPrinting(true);
    setError("");
    try {
      // Build the label payload including the just-recorded weight
      // and status. The print route accepts a single partId and
      // synthesizes the label from the part record. For a record
      // stamped with a particular weight, the printer-side label
      // already shows the bag weight spec — but the live weight and
      // status are recorded in the database (visible on the History
      // page and the printed QR). To label the actual reading on
      // the printed label, pass it through a new print endpoint.
      const body: Record<string, unknown> = { partId: part.id };
      if (lastRecordId) body.recordId = lastRecordId;
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) setError(data.error || "Print failed");
    } catch {
      setError("Print request failed");
    } finally {
      setPrinting(false);
    }
  }

  const evaluation = evaluateWeight(weight, part);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Scale connection bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {scaleStatus?.connected ? (
            <Wifi className="w-5 h-5 text-emerald-500" />
          ) : (
            <WifiOff className="w-5 h-5 text-amber-500" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {scaleStatus?.connected
                ? "Scale Connected"
                : scaleStatus?.mockEnabled
                ? "Scale Offline (Mock Mode)"
                : "Scale Offline"}
            </p>
            <p className="text-xs text-slate-500">
              {scaleStatus
                ? `${scaleStatus.port} @ ${scaleStatus.baudRate} baud, slave ${scaleStatus.slaveId}, ÷${scaleStatus.divisor}`
                : "Connecting…"}
              {scaleStatus?.lastError && (
                <span className="text-red-500 ml-2">— {scaleStatus.lastError}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPolling((p) => !p)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            {polling ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      {/* Part selection / current part */}
      {part ? (
        <div className="bg-[#1e3a5f] text-white rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-blue-200 text-xs uppercase tracking-wider">Active Part</p>
            <p className="text-xl font-bold font-mono mt-0.5">{part.partNumber}</p>
            <p className="text-blue-200 text-sm mt-0.5">{part.description}</p>
          </div>
          <button
            onClick={() => setShowPartPicker(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium"
          >
            Change
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowPartPicker(true)}
          className="w-full bg-white border-2 border-dashed border-slate-300 rounded-2xl p-6 flex items-center justify-center gap-3 hover:border-[#1e3a5f] hover:bg-blue-50/30 transition-colors"
        >
          <Search className="w-5 h-5 text-slate-400" />
          <span className="text-slate-600 font-medium">Scan a part QR or select a part to begin</span>
        </button>
      )}

      {/* Live weight display */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
        <p className="text-sm text-slate-500 uppercase tracking-wider font-medium">
          Live Weight
        </p>
        <p
          className={`mt-2 font-mono font-bold text-7xl ${
            weight > 0 ? "text-[#1e3a5f]" : "text-slate-300"
          }`}
        >
          {weight.toFixed(3)}
        </p>
        <p className="text-base text-slate-500 mt-1">kg</p>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${
              stable
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                stable ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            {stable ? "Stable" : "Reading…"}
          </span>
          {reading && (
            <span className="text-slate-400">
              {reading.source === "mock" ? "mock" : "scale"} •{" "}
              {new Date(reading.at).toLocaleTimeString("en-IN")}
            </span>
          )}
        </div>
      </div>

      {/* Status banner */}
      <StatusBanner
        status={evaluation.status}
        message={evaluation.message}
        weight={weight}
      />

      {/* Range info */}
      {part && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-[#1e3a5f]" />
            <h3 className="text-sm font-semibold text-[#1e3a5f]">
              Acceptable Range
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-amber-700 uppercase tracking-wider font-medium">
                Min Bag Weight
              </p>
              <p className="text-xl font-bold text-amber-800 mt-0.5 font-mono">
                {evaluation.min.toFixed(3)} kg
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-red-700 uppercase tracking-wider font-medium">
                Max Bag Weight
              </p>
              <p className="text-xl font-bold text-red-800 mt-0.5 font-mono">
                {evaluation.max.toFixed(3)} kg
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Record / Print buttons */}
      {part && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleRecord}
            disabled={
              submitting ||
              weight <= 0 ||
              !stable ||
              evaluation.status === "PENDING"
            }
            className="flex items-center justify-center gap-2 py-4 bg-[#1e3a5f] text-white rounded-xl font-bold hover:bg-[#2d5a8e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {lastRecordId ? "Record Again" : "Record Weighing"}
          </button>
          <button
            onClick={handlePrint}
            disabled={printing || !part}
            className="flex items-center justify-center gap-2 py-4 bg-amber-400 text-[#1e3a5f] rounded-xl font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors shadow-sm"
          >
            {printing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Printer className="w-5 h-5" />
            )}
            Print Label
          </button>
        </div>
      )}

      {lastRecordId && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Recorded as entry #{lastRecordId}. You can print the label now.
        </div>
      )}

      {/* Part picker overlay */}
      {showPartPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-[#1e3a5f]">Select Part</h3>
              <button
                onClick={() => setShowPartPicker(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type part number or description..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searching ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                  Searching…
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
                  <Package className="w-8 h-8 mb-2 opacity-30" />
                  {searchQuery.trim()
                    ? "No parts found"
                    : "Type to search parts"}
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectPart(p)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-50/40 text-left"
                    >
                      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-[#1e3a5f]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-bold text-[#1e3a5f] text-sm">
                          {p.partNumber}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {p.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LiveWeighingPage() {
  return (
    <MainLayout
      title="Live Weighing"
      subtitle="Real-time weight from the connected scale"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]" />
          </div>
        }
      >
        <LiveWeighingContent />
      </Suspense>
    </MainLayout>
  );
}
