import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const COMPOUND_SESSION_COOKIE = "compound_inventory_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const developmentSecret = randomBytes(32).toString("hex");

function secret() {
  return process.env.COMPOUND_INVENTORY_SESSION_SECRET || process.env.AUTH_SECRET || developmentSecret;
}

function expectedCredentials() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    username: process.env.COMPOUND_INVENTORY_USERNAME || (isProduction ? "" : "admin"),
    password: process.env.COMPOUND_INVENTORY_PASSWORD || (isProduction ? "" : "admin"),
  };
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function verifyCompoundCredentials(username: string, password: string) {
  const expected = expectedCredentials();
  console.log('[DEBUG] Verifying credentials:', {
    providedUsername: username,
    providedPassword: password,
    expectedUsername: expected.username,
    expectedPassword: expected.password,
    match: username === expected.username && password === expected.password
  });
  return username === expected.username && password === expected.password;
}

export function createCompoundSession() {
  const payload = `${Date.now() + SESSION_TTL_SECONDS * 1000}`;
  return `${payload}.${signature(payload)}`;
}

export function isValidCompoundSession(value: string | undefined) {
  if (!value) return false;
  const [expiresAt, providedSignature] = value.split(".");
  if (!expiresAt || !providedSignature || Number(expiresAt) < Date.now()) return false;

  const expectedSignature = signature(expiresAt);
  if (providedSignature.length !== expectedSignature.length) return false;
  return timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));
}

export const compoundSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_SECONDS,
  path: "/",
};
