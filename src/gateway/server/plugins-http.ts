import type { IncomingMessage, ServerResponse } from "node:http";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import { loadConfig } from "../../config/config.js";
import { isTrustedProxyAddress } from "../net.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export type PluginHttpRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean>;

/**
 * Fallback write-only scopes for plugin HTTP route handlers.
 * Plugin HTTP handlers default to write-only access; they never get admin-level
 * runtime scopes from missing or untrusted HTTP scope headers.
 */
export const PLUGIN_HTTP_FALLBACK_SCOPES: readonly string[] = ["operator.write"];

/**
 * HTTP header that trusted-proxy callers may use to declare narrower scopes.
 * Ignored unless the request originates from a configured trusted-proxy address.
 */
export const PLUGIN_HTTP_SCOPES_HEADER = "x-openclaw-scopes";

/**
 * Resolve the runtime scopes for a plugin HTTP handler request.
 *
 * - Defaults to PLUGIN_HTTP_FALLBACK_SCOPES (write-only).
 * - Only trusts the x-openclaw-scopes header when the request comes from a
 *   verified trusted-proxy IP; all other callers get the write-only fallback.
 */
export function resolvePluginHttpRuntimeScopes(params: {
  req: IncomingMessage;
  trustedProxies: string[];
}): string[] {
  const { req, trustedProxies } = params;
  const remoteAddr = (req.socket as { remoteAddress?: string } | null)?.remoteAddress;
  const isFromTrustedProxy = isTrustedProxyAddress(remoteAddr, trustedProxies);

  if (!isFromTrustedProxy) {
    return [...PLUGIN_HTTP_FALLBACK_SCOPES];
  }

  const scopeHeader = req.headers[PLUGIN_HTTP_SCOPES_HEADER];
  if (!scopeHeader || typeof scopeHeader !== "string") {
    return [...PLUGIN_HTTP_FALLBACK_SCOPES];
  }

  const declared = scopeHeader
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return declared.length > 0 ? declared : [...PLUGIN_HTTP_FALLBACK_SCOPES];
}

export function createGatewayPluginRequestHandler(params: {
  registry: PluginRegistry;
  log: SubsystemLogger;
}): PluginHttpRequestHandler {
  const { registry, log } = params;
  return async (req, res) => {
    const routes = registry.httpRoutes ?? [];
    const handlers = registry.httpHandlers ?? [];
    if (routes.length === 0 && handlers.length === 0) {
      return false;
    }

    // Resolve write-only fallback scopes for this plugin HTTP request.
    // Only trusted-proxy callers may narrow this via x-openclaw-scopes.
    const configSnapshot = loadConfig();
    const trustedProxies = configSnapshot.gateway?.trustedProxies ?? [];
    const runtimeScopes = resolvePluginHttpRuntimeScopes({ req, trustedProxies });
    // Attach resolved scopes to the request for plugin handlers that need them.
    (req as IncomingMessage & { _pluginRuntimeScopes?: string[] })._pluginRuntimeScopes =
      runtimeScopes;

    if (routes.length > 0) {
      const url = new URL(req.url ?? "/", "http://localhost");
      const route = routes.find((entry) => entry.path === url.pathname);
      if (route) {
        try {
          await route.handler(req, res);
          return true;
        } catch (err) {
          log.warn(`plugin http route failed (${route.pluginId ?? "unknown"}): ${String(err)}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("Internal Server Error");
          }
          return true;
        }
      }
    }

    for (const entry of handlers) {
      try {
        const handled = await entry.handler(req, res);
        if (handled) {
          return true;
        }
      } catch (err) {
        log.warn(`plugin http handler failed (${entry.pluginId}): ${String(err)}`);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Internal Server Error");
        }
        return true;
      }
    }
    return false;
  };
}
