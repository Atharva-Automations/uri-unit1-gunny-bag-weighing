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
  value.replace(/[\x00-\x1f\x7f-\uffff]/g, " ").replace(/"/g, "'");

export function buildLabel(data: LabelData) {
  const kg = (v: string | number) => Number(v).toFixed(3);
  const date = new Date(data.recordedAt ?? Date.now()).toLocaleDateString(
    "en-GB",
  );
  const rows = [
    ["Part No.", data.partNumber],
    ["Description", data.description],
    ["Quantity", `${data.quantity} pcs`],
    ["Item Min-Max", `${kg(data.minWeight)}-${kg(data.maxWeight)} kg`],
    [
      "Bag Min-Max",
      `${kg(Number(data.minWeight) * data.quantity)}-${kg(Number(data.maxWeight) * data.quantity)} kg`,
    ],
    [
      "Measured Wt.",
      data.recordActualWeight != null
        ? `${kg(data.recordActualWeight)} kg`
        : "Not weighed",
    ],
    ["Status", data.status || "NOT WEIGHED"],
    ["Date", date],
  ];
  const texts = rows.map(([label, value], index) => {
    const full = cleanLabelText(`${label}: ${value}`);
    const small = full.length > 35;
    const capacity = small ? 53 : 35;
    const text =
      full.length > capacity ? `${full.slice(0, capacity - 3)}...` : full;
    return {
      x: 342,
      y: 106 + index * 33,
      text,
      font: small ? "1" : "2",
      charWidth: small ? 8 : 12,
      height: small ? 12 : 20,
    };
  });
  // Keep four blank modules around all QR versions, even long part numbers.
  const qr = QRCode.create(cleanLabelText(data.partNumber), {
    errorCorrectionLevel: "M",
  }).modules;
  const cell = Math.floor(272 / (qr.size + 8));
  if (cell < 2)
    throw new Error(
      "Part number is too long for a readable QR on a 100 x 50 mm label",
    );
  const size = (qr.size + 8) * cell;
  const qrX = 30 + Math.floor((272 - size) / 2) + 4 * cell;
  const qrY = 98 + Math.floor((272 - size) / 2) + 4 * cell;
  const squares: { x: number; y: number; size: number }[] = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.get(y, x))
        squares.push({ x: qrX + x * cell, y: qrY + y * cell, size: cell });
    }
  }
  return { texts, squares, heading: "UNITED RUBBER" };
}
