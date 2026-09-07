/**
 * Weighing-scale service for the Gunny Bag project.
 *
 * Connects to the scale over Modbus RTU (serial, e.g. COM7) and
 * continuously polls its register, caching the latest reading in
 * memory. Other parts of the app (API routes, components) read the
 * cached value via getCurrentReading().
 *
 * Environment variables (all optional, with sensible defaults):
 *   SCALE_DRIVER          "modbus" (default) | "serial"
 *   SCALE_PORT            serial port (default "COM7")
 *   SCALE_BAUD_RATE       default 9600
 *   SCALE_SLAVE_ID        Modbus unit/slave id (default 1)
 *   SCALE_FUNCTION        "03" (Holding Registers) | "04" (Input Registers)
 *                         Most weighing scales use 04. The display module
 *                         here uses 04 by default; set to "03" if your
 *                         scale expects Function Code 03.
 *   SCALE_REGISTER        register address (default 0)
 *   SCALE_QUANTITY        number of registers to read (default 1)
 *   SCALE_REGISTER_FORMAT "u16" | "s16" | "u32be" | "u32le" | "s32be" | "s32le"
 *   SCALE_DIVISOR         raw -> weight divisor (default 100)
 *   SCALE_POLL_MS         poll interval in ms (default 1000)
 *   SCALE_RECONNECT_MS    reconnect delay in ms (default 5000)
 *   SCALE_MOCK            "true" to enable mock fallback (default: false)
 *
 * Pattern is lifted from the working plc-service in C:\AtharvProject
 * (apps/plc-service/index.js) and adapted to live inside Next.js.
 */

import ModbusRTU from "modbus-serial";

// ---------- Types ----------
export interface ScaleReading {
  weight: number;
  raw: number | null;
  source: "scale" | "mock";
  at: string; // ISO timestamp
}

export interface ScaleStatus {
  connected: boolean;
  port: string;
  driver: string;
  baudRate: number;
  slaveId: number;
  register: number;
  functionCode: number;
  registerFormat: string;
  divisor: number;
  mockEnabled: boolean;
  lastReadingAt: string | null;
  lastError: string | null;
}

// ---------- Config (from env) ----------
const SCALE_DRIVER = (process.env.SCALE_DRIVER || "modbus").toLowerCase();
const SCALE_PORT = process.env.SCALE_PORT || "COM7";
const SCALE_BAUD_RATE = Number(process.env.SCALE_BAUD_RATE || 9600);
const SCALE_SLAVE_ID = Number(process.env.SCALE_SLAVE_ID || 1);
const SCALE_FUNCTION = Number(process.env.SCALE_FUNCTION || 4); // 3 = Holding, 4 = Input
const SCALE_REGISTER = Number(process.env.SCALE_REGISTER || 0);
const SCALE_QUANTITY = Number(process.env.SCALE_QUANTITY || 1);
const SCALE_REGISTER_FORMAT = (
  process.env.SCALE_REGISTER_FORMAT || "u16"
).toLowerCase();
const SCALE_DIVISOR = Number(process.env.SCALE_DIVISOR || 100);
const SCALE_POLL_MS = Number(process.env.SCALE_POLL_MS || 1000);
const SCALE_RECONNECT_MS = Number(process.env.SCALE_RECONNECT_MS || 5000);
const SCALE_MOCK = process.env.SCALE_MOCK === "true"; // default false (real mode)

// ---------- State (kept on globalThis so it survives Next.js HMR
// module reloads — the API route and the background tick can end up
// importing different copies of this module after a hot reload).
type ScaleGlobals = {
  lastWeight: number;
  lastRawValue: number | null;
  lastReadingAt: string | null;
  lastError: string | null;
  scaleConnected: boolean;
  bootStarted: boolean;
  successReadCount: number;
};
const G = globalThis as typeof globalThis & { __gunnyScale?: ScaleGlobals };
if (!G.__gunnyScale) {
  G.__gunnyScale = {
    lastWeight: 0,
    lastRawValue: null,
    lastReadingAt: null,
    lastError: null,
    scaleConnected: false,
    bootStarted: false,
    successReadCount: 0,
  };
}
const state = G.__gunnyScale;

let lastErrorLoggedAt: number | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let rtuClient: ModbusRTU | null = null;
let readInProgress = false;

// ---------- Helpers ----------
const log = (...args: unknown[]) => console.log("[scale]", ...args);
const logError = (...args: unknown[]) => console.error("[scale]", ...args);

function registersToValue(regs: number[]): number | null {
  if (!regs || regs.length === 0) return null;
  switch (SCALE_REGISTER_FORMAT) {
    case "s16":
      return regs[0] > 0x7fff ? regs[0] - 0x10000 : regs[0];
    case "u32be":
      return regs[0] * 0x10000 + regs[1];
    case "u32le":
      return regs[1] * 0x10000 + regs[0];
    case "s32be": {
      const v = regs[0] * 0x10000 + regs[1];
      return v > 0x7fffffff ? v - 0x100000000 : v;
    }
    case "s32le": {
      const v = regs[1] * 0x10000 + regs[0];
      return v > 0x7fffffff ? v - 0x100000000 : v;
    }
    case "u16":
    default:
      return regs[0];
  }
}

function scaleToWeight(raw: number | null): number | null {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return null;
  const d = SCALE_DIVISOR || 1;
  return Number(raw) / d;
}

function acceptReading(raw: number | null, weight: number) {
  state.lastRawValue = raw;
  state.lastWeight = weight;
  state.lastReadingAt = new Date().toISOString();
  state.scaleConnected = true;
  state.lastError = null;
}

async function ensureConnected(): Promise<void> {
  if (rtuClient && rtuClient.isOpen) return;

  // Recreate the client from scratch on every (re)connect.
  // modbus-serial holds internal state we cannot safely reset otherwise.
  if (rtuClient) {
    try {
      await rtuClient.close();
    } catch {
      // ignore
    }
    rtuClient = null;
  }

  rtuClient = new ModbusRTU();
  await rtuClient.connectRTUBuffered(SCALE_PORT, {
    baudRate: SCALE_BAUD_RATE,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
  });
  rtuClient.setID(SCALE_SLAVE_ID);
  rtuClient.setTimeout(2000);
  // Only log the first connection to avoid spam during reconnect storms.
  if (state.successReadCount === 0) {
    log(
      `Connected to ${SCALE_PORT} @ ${SCALE_BAUD_RATE}, slave=${SCALE_SLAVE_ID}, fc=0x${SCALE_FUNCTION.toString(16).padStart(2, "0")}, register=${SCALE_REGISTER}, ÷${SCALE_DIVISOR}`
    );
  }
}

async function readOnce(): Promise<{ raw: number | null; weight: number } | null> {
  await ensureConnected();

  // Function Code 03 = Read Holding Registers
  // Function Code 04 = Read Input Registers
  const result =
    SCALE_FUNCTION === 3
      ? await rtuClient!.readHoldingRegisters(SCALE_REGISTER, SCALE_QUANTITY)
      : await rtuClient!.readInputRegisters(SCALE_REGISTER, SCALE_QUANTITY);

  // modbus-serial returns an empty array when the slave doesn't respond
  // or returns a Modbus exception — treat that as an error so we
  // don't get stuck thinking the scale is connected when it isn't.
  if (!result || !result.data || result.data.length === 0) {
    throw new Error("Empty response from scale (no data returned)");
  }

  const raw = registersToValue(result.data);
  const rawWeight = scaleToWeight(raw);
  if (rawWeight === null) {
    throw new Error(`Invalid reading: raw=${raw}`);
  }
  if (Number.isNaN(rawWeight)) {
    throw new Error(`Invalid reading: raw=${raw}`);
  }
  acceptReading(raw, rawWeight);
  return { raw, weight: rawWeight };
}

async function closeClient() {
  if (rtuClient) {
    try {
      if (rtuClient.isOpen) await rtuClient.close();
    } catch {
      // ignore
    }
    rtuClient = null;
  }
}

async function tick() {
  if (readInProgress) {
    pollTimer = setTimeout(tick, SCALE_POLL_MS);
    return;
  }
  readInProgress = true;
  try {
    const r = await readOnce();
    state.successReadCount += 1;
    // Log the first 3 successful readings so we can verify the
    // connection. After that, silence to avoid flooding the console.
    if (r && state.successReadCount <= 3) {
      log(`✓ Reading #${state.successReadCount}: raw=${r.raw} weight=${r.weight.toFixed(2)} kg`);
    }
  } catch (err) {
    // modbus-serial sometimes throws plain objects with {err, message}
    // instead of Error instances. Handle both.
    const msg =
      err instanceof Error
        ? err.message
        : (err as { message?: string })?.message
        ? String((err as { message?: string }).message)
        : JSON.stringify(err);
    state.lastError = msg;
    state.scaleConnected = false;
    // Throttle reconnect log to once every 30s
    const now = Date.now();
    if (!lastErrorLoggedAt || now - lastErrorLoggedAt > 30_000) {
      logError(`Read error: ${msg}. Reconnecting in ${SCALE_RECONNECT_MS / 1000}s...`);
      lastErrorLoggedAt = now;
    }
    await closeClient();
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
      }, SCALE_RECONNECT_MS);
    }
  } finally {
    readInProgress = false;
    pollTimer = setTimeout(tick, SCALE_POLL_MS);
  }
}

export function startScaleService() {
  if (state.bootStarted) return;
  if (SCALE_DRIVER !== "modbus") {
    log(`Driver ${SCALE_DRIVER} is not yet supported in-process; mock-only.`);
    return;
  }
  state.bootStarted = true;
  log(
    `Starting Modbus RTU on ${SCALE_PORT} @ ${SCALE_BAUD_RATE}, slave=${SCALE_SLAVE_ID}, fc=0x${SCALE_FUNCTION.toString(16).padStart(2, "0")}, register=${SCALE_REGISTER}, format=${SCALE_REGISTER_FORMAT}, divisor=${SCALE_DIVISOR}, mock=${SCALE_MOCK}`
  );
  tick();
}

export function getCurrentReading(): ScaleReading | null {
  if (state.scaleConnected) {
    return {
      weight: state.lastWeight,
      raw: state.lastRawValue,
      source: "scale",
      at: state.lastReadingAt!,
    };
  }
  if (SCALE_MOCK) {
    return {
      weight: Number((Math.random() * 100).toFixed(2)),
      raw: null,
      source: "mock",
      at: new Date().toISOString(),
    };
  }
  return null;
}

export function getScaleStatus(): ScaleStatus {
  return {
    connected: state.scaleConnected,
    port: SCALE_PORT,
    driver: SCALE_DRIVER,
    baudRate: SCALE_BAUD_RATE,
    slaveId: SCALE_SLAVE_ID,
    register: SCALE_REGISTER,
    functionCode: SCALE_FUNCTION,
    registerFormat: SCALE_REGISTER_FORMAT,
    divisor: SCALE_DIVISOR,
    mockEnabled: SCALE_MOCK,
    lastReadingAt: state.lastReadingAt,
    lastError: state.lastError,
  };
}

export async function readOneShot(): Promise<{
  raw: number | null;
  weight: number;
} | null> {
  try {
    return await readOnce();
  } catch (err) {
    return null;
  }
}
