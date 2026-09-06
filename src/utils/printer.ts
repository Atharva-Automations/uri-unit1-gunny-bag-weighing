import * as net from "net";

/**
 * Sends raw TSPL (Thermal Smart Printer Language) strings to a TSC label
 * printer over a TCP socket connection (typically port 9100).
 *
 * Based on the working implementation in the espee project.
 */
export const tscPrinterClient = {
  /**
   * Send a TSPL command string to the printer at the given IP/port.
   * Resolves once the data is flushed and the socket is closed.
   */
  async send(ip: string, port: number, tspl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error("Connection timeout"));
      }, 5000);

      client.connect(port, ip, () => {
        clearTimeout(timeout);

        client.write(tspl, "ascii", (err) => {
          if (err) {
            client.destroy();
            reject(err);
          } else {
            client.end();
          }
        });
      });

      client.on("end", () => resolve());
      client.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  },
};

export interface GunnyBagLabelData {
  partNumber: string;
  description: string;
  minWeight: string;
  maxWeight: string;
  quantity: number;
  actualWeight: string;
  /** Optional — actual measured weight printed if a weighing was recorded. */
  recordActualWeight?: string | null;
  /** Optional — OK | OVERWEIGHT | UNDERWEIGHT */
  status?: string | null;
}

/**
 * Label geometry. Sized for a 100mm wide × 50mm tall thermal label
 * with a 3mm gap. Hosts a large scannable QR code (model 2, ~50mm
 * square — fills the full label height) AND a compact data column
 * to the right of the QR.
 *
 *   ┌────────────────────────── 800 dots (100mm) ─────────────────────────┐
 *   │  ┌────────┐   PART NO.                                             │
 *   │  │        │   PN-0001                                              │
 *   │  │   QR   │   DESC: Black Rubber Sheet                             │ 400 dots
 *   │  │  50mm  │   MIN-MAX: 0.500-1.000kg                              │ (50mm)
 *   │  │        │   MAX BAG: 100.000kg                                  │
 *   │  │ model  │   QTY/BAG: 100                                         │
 *   │  │   2    │   DATE: 2026-09-03                                    │
 *   │  │        │   ACTUAL: 12.345kg                                     │
 *   │  │        │   STATUS: OK                                           │
 *   │  └────────┘                                                       │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Dots-per-mm at 203 dpi: 8.  → 100mm = 800 dots, 50mm = 400 dots.
 */
const LABEL_WIDTH_MM = 100;
const LABEL_HEIGHT_MM = 50;
const LABEL_WIDTH_DOTS = LABEL_WIDTH_MM * 8; // 800
const LABEL_HEIGHT_DOTS = LABEL_HEIGHT_MM * 8; // 400

export function generateGunnyBagTSPL(data: GunnyBagLabelData): string {
  const safe = (v: string | number | null | undefined): string =>
    String(v ?? "").replace(/"/g, "'");

  const min = parseFloat(data.minWeight).toFixed(3);
  const max = parseFloat(data.maxWeight).toFixed(3);
  const bag = (parseFloat(data.maxWeight) * data.quantity).toFixed(3);
  const actual =
    data.recordActualWeight !== undefined && data.recordActualWeight !== null
      ? parseFloat(data.recordActualWeight).toFixed(3)
      : null;
  const status = data.status ?? null;

  const dateStr = new Date().toISOString().slice(0, 10);
  // Big QR filling almost the full 50mm label height (~50mm = 400 dots).
  // For a short string the QR has ~25 cells per side; with cell=16
  // that's 400 dots ≈ 50mm. TSC TSPL cell size is in dots.
  const QR_X = 16;
  const QR_Y = 0; // QR flush with the top edge
  const QR_CELL = 16; // 16 dots/cell → ~400 dots square (50mm)
  const QR_SIZE_DOTS = 400; // QR width in dots

  // Right column starts right after the QR, with a 16-dot margin.
  const TXT_X = QR_X + QR_SIZE_DOTS + 16;

  const lines: string[] = [
    `SIZE ${LABEL_WIDTH_MM} mm, ${LABEL_HEIGHT_MM} mm`,
    "GAP 3 mm, 0 mm",
    "DIRECTION 0",
    "CLS",
    // Big QR (~50mm square), fills the full height of the 50mm label.
    `QRCODE ${QR_X},${QR_Y},M,${QR_CELL},A,0,M2,"${safe(data.partNumber)}"`,
    // Data column on the right (compacted for 50mm height).
    `TEXT ${TXT_X},24,"0",0,2,2,"PART NO."`,
    `TEXT ${TXT_X},56,"0",0,2,2,"${safe(data.partNumber)}"`,
    `TEXT ${TXT_X},96,"0",0,1,1,"DESC: ${safe(data.description).slice(0, 24)}"`,
    `TEXT ${TXT_X},130,"0",0,1,1,"MIN-MAX: ${min}-${max}kg"`,
    `TEXT ${TXT_X},160,"0",0,1,1,"MAX BAG: ${bag}kg"`,
    `TEXT ${TXT_X},190,"0",0,1,1,"QTY/BAG: ${data.quantity}"`,
    `TEXT ${TXT_X},220,"0",0,1,1,"DATE: ${dateStr}"`,
  ];

  if (actual !== null) {
    lines.push(`TEXT ${TXT_X},270,"0",0,2,2,"ACTUAL: ${actual}kg"`);
  }
  if (status) {
    lines.push(
      `TEXT ${TXT_X},${actual ? "330" : "270"},"0",0,2,2,"STATUS: ${status}"`
    );
  }

  // Bottom border line
  lines.push(`BAR 8,${LABEL_HEIGHT_DOTS - 8}, 784,3`);
  lines.push("PRINT 1,1", "");

  return lines.join("\r\n");
}

/**
 * Returns the configured printer IP/port (env override with sensible defaults).
 */
export function getPrinter(): { ip: string; port: number } {
  return {
    ip: process.env.PRINTER_IP || "192.168.1.75",
    port: Number(process.env.PRINTER_PORT) || 9100,
  };
}
