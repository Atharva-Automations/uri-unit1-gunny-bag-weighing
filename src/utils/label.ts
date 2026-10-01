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

// Shared 203-dpi artwork: 100 mm wide x 50 mm high (landscape).
// The printer maps 1 mm to 8 dots at 203 dpi. TSPL font 2 is 12 dots wide
// at 1x scale, so these limits are based on printer dots, not CSS pixels.
export const LABEL = {
  width: 800,
  height: 400,
  widthMm: 100,
  heightMm: 50,
  borderLeft: 26,
  borderRight: 774,
  textX: 280,
  textFont: "2",
  textCharWidth: 12,
} as const;
export const cleanLabelText = (value: string) =>
  value.replace(/[\x00-\x1f\x7f-￿]/g, " ").replace(/"/g, "'");

/**
 * Company name printed on the label header. TSPL font 2 renders 12 dots per
 * character at 1x scale, so the 40-character legal name needs 480 dots. The
 * usable inner width is borderRight - borderLeft = 748 dots, so the full name
 * fits on one centred line without overlapping the border or the rule below.
 */
export const COMPANY_NAME = "UNITED RUBBER INDUSTRIES (I) PVT. LTD.";

/**
 * Build the QR + text artwork for a 50x100mm portrait label. Layout:
 *
 *   ┌──────────────────── 400 dots (50mm) ────────────────────┐
 *   │  UNITED RUBBER INDUSTRIES (I) PVT. LTD.                 │  42
 *   │  ─────────────────────────────────────────────────────    │  82
 *   │  ┌──────────┐                                             │
 *   │  │   QR     │  Part No.        : PN-0001                  │ 100
 *   │  │  150     │  Qty/Bag         : 100 pcs                 │ 130
 *   │  │  dots   │  Min-Max (kg)    : 0.50 - 1.00             │ 160
 *   │  │          │  Exp. Bag (kg)   : 50.00 - 100.00         │ 190
 *   │  └──────────┘  Date            : 07-09-2026             │ 220
 *   │              Actual Wt. (kg) : 55.20                   │ 250
 *   │              Status          : OK                      │ 280
 *   └────────────────────────────────────────────────────────────┘
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
    `Min - Max (kg)  : ${min} - ${max}`,
    `Exp. Bag (kg)   : ${bag} - ${bagMax}`,
    `Date            : ${date}`,
  ];
  if (actual !== null) rows.push(`Actual Wt. (kg) : ${actual}`);
  if (status) rows.push(`Status          : ${status}`);

  const startY = 120;
  const lineH = 30;
  const maxTextChars = Math.floor(
    (LABEL.borderRight - LABEL.textX - 12) / LABEL.textCharWidth
  );
  const texts = rows.map((text, i) => ({
    x: LABEL.textX,
    y: startY + i * lineH,
    text: text.slice(0, maxTextChars),
    font: LABEL.textFont,
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
  const qrX = 23 + Math.floor((272 - size) / 2) + 4 * cell;
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
