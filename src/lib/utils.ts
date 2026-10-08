// Server-side helpers (uses Node crypto). Client components should import from "@/lib/format".
import { createHash, randomBytes, randomInt } from "crypto";

export * from "./format";

/** Alphabet without ambiguous characters (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePublicCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Resolve the public base URL from request headers (works behind proxies). */
export function baseUrlFromHeaders(headers: Headers): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const proto = headers.get("x-forwarded-proto") ?? "http";
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
