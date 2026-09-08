import QRCode from "qrcode";

export interface LabelData {
  partNumber: string;
  description: string;
  minWeight: string;
  maxWeight: string;
  quantity: number;
  actualWeight: string;
  recordActualWeight?: string | null;
  status?: string | null;
  recordedAt?: string | Date | null;
}

// Shared 203-dpi artwork: 100 mm wide x 50 mm high.
export const LABEL = { width: 800, height: 400, widthMm: 100, heightMm: 50 };
export const cleanLabelText = (value: string) =>
  value.replace(/[\x00-\x1f\x7f-￿]/g, " ").replace(/"/g, "'");

/**
 * Build the QR + text artwork for a 100x50mm label. Layout follows the
 * reference "PREMIER SEALING PRODUCTS" template (renamed to
 * "UNITED RUBBER"):
 *
 *   ┌────────────────────────────────────────── 800 dots ──────────────┐
 *   │             UNITED  RUBBER                                        │  30
 *   │  ────────────────────────────────────────────────────────────    │  82
 *   │  ┌──────┐                                                          │
 *   │  │  QR  │  PART NO.  : PN-0001                                    │ 130
 *   │  │ 272  │  DESC      : Black Rubber Sheet                          │ 163
 *   │  │ dots │  QTY       : 100 pcs                                    │ 196
 *   │  │      │  MIN-MAX   : 0.500 - 1.000 kg                           │ 229
 *   │  │      │  MAX BAG   : 100.000 kg                                 │ 262
 *   │  │      │  ACTUAL    : 12.345 kg                                  │ 295
 *   │  │      │  STATUS    : OK                                          │ 328
 *   │  └──────┘  DATE      : 04-09-2026                                  │ 361
 *   └────────────────────────────────────────────────────────────────────┘
 */
export function buildLabel(data: LabelData) {
  const kg = (v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  };
  const date = new Date(data.recordedAt ?? Date.now())
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");

  const min = kg(data.minWeight);
  const max = kg(data.maxWeight);
  const bag = kg(Number(data.minWeight || 0) * (data.quantity || 0));
  const bagMax = kg(Number(data.maxWeight || 0) * (data.quantity || 0));
  const actual =
    data.recordActualWeight != null && data.recordActualWeight !== ""
      ? kg(data.recordActualWeight)
      : null;
  const status = (data.status || "").toString() || null;

  const desc = cleanLabelText(data.description || "").slice(0, 32);

  const rows: string[] = [
    `Part No.        : ${cleanLabelText(data.partNumber || "")}`,
    `Qty/Bag         : ${data.quantity || 0} pcs`,
    `Min-Max (kg)    : ${min} - ${max}`,
    `Exp. Bag (kg)   : ${bag} - ${bagMax}`,
    `Date            : ${date}`,
  ];
  if (actual !== null) rows.push(`Actual Wt. (kg)  : ${actual}`);
  if (status) rows.push(`Status          : ${status}`);

  const startY = 120;
  const lineH = 34;
  const TXT_X = 290;
  const texts = rows.map((text, i) => ({
    x: TXT_X,
    y: startY + i * lineH,
    text,
    font: "2",
  }));

  // Render QR via the `qrcode` package so the matrix is bit-accurate
  // (model 2, ECC M). We then translate each "on" module to a small
  // filled BAR to draw it natively in TSPL.
  const qr = QRCode.create(cleanLabelText(data.partNumber || ""), {
    errorCorrectionLevel: "M",
  });
  const cell = Math.floor(272 / (qr.modules.size + 8));
  if (cell < 2) {
    throw new Error("Part number is too long for a readable QR on a 100 x 50 mm label");
  }
  const size = (qr.modules.size + 8) * cell;
  const qrX = 20 + Math.floor((272 - size) / 2) + 4 * cell;
  const qrY = 98 + Math.floor((272 - size) / 2) + 4 * cell;
  const squares: { x: number; y: number; size: number }[] = [];
  for (let y = 0; y < qr.modules.size; y++) {
    for (let x = 0; x < qr.modules.size; x++) {
      if (qr.modules.get(y, x)) {
        squares.push({ x: qrX + x * cell, y: qrY + y * cell, size: cell });
      }
    }
  }
  return { texts, squares, heading: "UNITED RUBBER" };
}
