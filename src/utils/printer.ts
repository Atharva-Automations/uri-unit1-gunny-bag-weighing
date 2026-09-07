import * as net from "net";
import { buildLabel, LABEL, type LabelData } from "./label";

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

export type GunnyBagLabelData = LabelData;

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
  const artwork = buildLabel(data);

  const lines = [
    `SIZE ${LABEL.widthMm} mm, ${LABEL.heightMm} mm`,
    "GAP 3 mm, 0 mm",
    "DIRECTION 0",
    "REFERENCE 0,0",
    "CLS",
    "BOX 12,12,788,388,2",
    'TEXT 110,42,"3",0,1,1," UNITED  RUBBER  INDUSTRIES "',
    "BAR 12,82,776,2",
    "BAR 320,82,2,306",
    ...artwork.squares.map(({ x, y, size }) => `BAR ${x},${y},${size},${size}`),
    ...artwork.texts.map(({ x, y, font, text }) => `TEXT ${x},${y},"${font}",0,1,1,"${text}"`),
    "PRINT 1,1",
    "",
  ];

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
