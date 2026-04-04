import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { makeMockHttpResponse } from "../test-http-response.js";
import { createTestRegistry } from "./__tests__/test-utils.js";
import {
  createGatewayPluginRequestHandler,
  PLUGIN_HTTP_FALLBACK_SCOPES,
  resolvePluginHttpRuntimeScopes,
} from "./plugins-http.js";

describe("createGatewayPluginRequestHandler", () => {
  it("returns false when no handlers are registered", async () => {
    const log = { warn: vi.fn() } as unknown as Parameters<
      typeof createGatewayPluginRequestHandler
    >[0]["log"];
    const handler = createGatewayPluginRequestHandler({
      registry: createTestRegistry(),
      log,
    });
    const { res } = makeMockHttpResponse();
    const handled = await handler({} as IncomingMessage, res);
    expect(handled).toBe(false);
  });

  it("continues until a handler reports it handled the request", async () => {
    const first = vi.fn(async () => false);
    const second = vi.fn(async () => true);
    const handler = createGatewayPluginRequestHandler({
      registry: createTestRegistry({
        httpHandlers: [
          { pluginId: "first", handler: first, source: "first" },
          { pluginId: "second", handler: second, source: "second" },
        ],
      }),
      log: { warn: vi.fn() } as unknown as Parameters<
        typeof createGatewayPluginRequestHandler
      >[0]["log"],
    });

    const { res } = makeMockHttpResponse();
    const handled = await handler({} as IncomingMessage, res);
    expect(handled).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("handles registered http routes before generic handlers", async () => {
    const routeHandler = vi.fn(async (_req, res: ServerResponse) => {
      res.statusCode = 200;
    });
    const fallback = vi.fn(async () => true);
    const handler = createGatewayPluginRequestHandler({
      registry: createTestRegistry({
        httpRoutes: [
          {
            pluginId: "route",
            path: "/demo",
            handler: routeHandler,
            source: "route",
          },
        ],
        httpHandlers: [{ pluginId: "fallback", handler: fallback, source: "fallback" }],
      }),
      log: { warn: vi.fn() } as unknown as Parameters<
        typeof createGatewayPluginRequestHandler
      >[0]["log"],
    });

    const { res } = makeMockHttpResponse();
    const handled = await handler({ url: "/demo" } as IncomingMessage, res);
    expect(handled).toBe(true);
    expect(routeHandler).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("logs and responds with 500 when a handler throws", async () => {
    const log = { warn: vi.fn() } as unknown as Parameters<
      typeof createGatewayPluginRequestHandler
    >[0]["log"];
    const handler = createGatewayPluginRequestHandler({
      registry: createTestRegistry({
        httpHandlers: [
          {
            pluginId: "boom",
            handler: async () => {
              throw new Error("boom");
            },
            source: "boom",
          },
        ],
      }),
      log,
    });

    const { res, setHeader, end } = makeMockHttpResponse();
    const handled = await handler({} as IncomingMessage, res);
    expect(handled).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("boom"));
    expect(res.statusCode).toBe(500);
    expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/plain; charset=utf-8");
    expect(end).toHaveBeenCalledWith("Internal Server Error");
  });
});

describe("resolvePluginHttpRuntimeScopes", () => {
  function makeReq(opts: {
    remoteAddress?: string;
    scopesHeader?: string;
  }): IncomingMessage {
    const headers: Record<string, string> = {};
    if (opts.scopesHeader !== undefined) {
      headers["x-openclaw-scopes"] = opts.scopesHeader;
    }
    return {
      headers,
      socket: opts.remoteAddress !== undefined ? { remoteAddress: opts.remoteAddress } : null,
    } as unknown as IncomingMessage;
  }

  it("returns write-only fallback scopes when no trusted proxies are configured", () => {
    const scopes = resolvePluginHttpRuntimeScopes({
      req: makeReq({ remoteAddress: "1.2.3.4", scopesHeader: "operator.admin" }),
      trustedProxies: [],
    });
    expect(scopes).toEqual([...PLUGIN_HTTP_FALLBACK_SCOPES]);
  });

  it("returns write-only fallback scopes when caller is not a trusted proxy", () => {
    const scopes = resolvePluginHttpRuntimeScopes({
      req: makeReq({ remoteAddress: "8.8.8.8", scopesHeader: "operator.admin" }),
      trustedProxies: ["10.0.0.1"],
    });
    expect(scopes).toEqual([...PLUGIN_HTTP_FALLBACK_SCOPES]);
  });

  it("returns write-only fallback scopes when trusted proxy sends no scope header", () => {
    const scopes = resolvePluginHttpRuntimeScopes({
      req: makeReq({ remoteAddress: "10.0.0.1" }),
      trustedProxies: ["10.0.0.1"],
    });
    expect(scopes).toEqual([...PLUGIN_HTTP_FALLBACK_SCOPES]);
  });

  it("returns write-only fallback scopes when trusted proxy sends empty scope header", () => {
    const scopes = resolvePluginHttpRuntimeScopes({
      req: makeReq({ remoteAddress: "10.0.0.1", scopesHeader: "  " }),
      trustedProxies: ["10.0.0.1"],
    });
    expect(scopes).toEqual([...PLUGIN_HTTP_FALLBACK_SCOPES]);
  });

  it("returns declared scopes when trusted proxy explicitly provides x-openclaw-scopes", () => {
    const scopes = resolvePluginHttpRuntimeScopes({
      req: makeReq({ remoteAddress: "10.0.0.1", scopesHeader: "operator.read" }),
      trustedProxies: ["10.0.0.1"],
    });
    expect(scopes).toEqual(["operator.read"]);
  });

  it("returns loopback (127.0.0.1) write-only fallback even with scope header when no proxies configured", () => {
    // Loopback is treated as trusted proxy; no proxies configured → fallback
    const scopes = resolvePluginHttpRuntimeScopes({
      req: makeReq({ remoteAddress: "127.0.0.1", scopesHeader: "operator.admin" }),
      trustedProxies: [],
    });
    // 127.0.0.1 is NOT in trustedProxies list so fallback applies
    expect(scopes).toEqual([...PLUGIN_HTTP_FALLBACK_SCOPES]);
  });
});
