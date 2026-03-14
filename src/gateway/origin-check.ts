import { isLoopbackHost, normalizeHostHeader, resolveHostName } from "./net.js";

export type OriginCheckResult =
  | { ok: true; matchedBy: "allowlist" | "host-header" | "loopback" }
  | { ok: false; reason: string };

function parseOrigin(
  originRaw?: string,
): { origin: string; host: string; hostname: string } | null {
  const trimmed = (originRaw ?? "").trim();
  if (!trimmed || trimmed === "null") {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return {
      origin: url.origin.toLowerCase(),
      host: url.host.toLowerCase(),
      hostname: url.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function checkBrowserOrigin(params: {
  requestHost?: string;
  origin?: string;
  allowedOrigins?: string[];
  allowHostHeaderOriginFallback?: boolean;
  isLocalClient?: boolean;
}): OriginCheckResult {
  const parsedOrigin = parseOrigin(params.origin);
  if (!parsedOrigin) {
    return { ok: false, reason: "origin missing or invalid" };
  }

  const allowlist = (params.allowedOrigins ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.includes(parsedOrigin.origin)) {
    return { ok: true, matchedBy: "allowlist" };
  }

  const allowHostHeader = params.allowHostHeaderOriginFallback !== false;
  if (allowHostHeader) {
    const requestHost = normalizeHostHeader(params.requestHost);
    if (requestHost && parsedOrigin.host === requestHost) {
      return { ok: true, matchedBy: "host-header" };
    }
  }

  const allowLoopback = params.isLocalClient !== false;
  if (allowLoopback) {
    const requestHost = normalizeHostHeader(params.requestHost);
    const requestHostname = resolveHostName(requestHost);
    if (isLoopbackHost(parsedOrigin.hostname) && isLoopbackHost(requestHostname)) {
      return { ok: true, matchedBy: "loopback" };
    }
  }

  return { ok: false, reason: "origin not allowed" };
}
