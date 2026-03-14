import { describe, expect, it } from "vitest";
import { checkBrowserOrigin } from "./origin-check.js";

describe("checkBrowserOrigin", () => {
  it("accepts same-origin host matches", () => {
    const result = checkBrowserOrigin({
      requestHost: "127.0.0.1:18789",
      origin: "http://127.0.0.1:18789",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matchedBy).toBe("host-header");
    }
  });

  it("accepts loopback host mismatches for dev", () => {
    const result = checkBrowserOrigin({
      requestHost: "127.0.0.1:18789",
      origin: "http://localhost:5173",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matchedBy).toBe("loopback");
    }
  });

  it("accepts allowlisted origins", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "https://control.example.com",
      allowedOrigins: ["https://control.example.com"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matchedBy).toBe("allowlist");
    }
  });

  it("rejects missing origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects mismatched origins", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "https://attacker.example.com",
    });
    expect(result.ok).toBe(false);
  });

  describe("allowHostHeaderOriginFallback", () => {
    it("skips host-header match when false", () => {
      const result = checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: "http://127.0.0.1:18789",
        allowHostHeaderOriginFallback: false,
      });
      // Should still succeed via loopback fallback
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.matchedBy).toBe("loopback");
      }
    });

    it("rejects non-loopback when host-header fallback disabled", () => {
      const result = checkBrowserOrigin({
        requestHost: "gateway.example.com:443",
        origin: "https://gateway.example.com",
        allowHostHeaderOriginFallback: false,
      });
      expect(result.ok).toBe(false);
    });

    it("defaults to true (allows host-header match)", () => {
      const result = checkBrowserOrigin({
        requestHost: "gateway.example.com:8443",
        origin: "https://gateway.example.com:8443",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.matchedBy).toBe("host-header");
      }
    });
  });

  describe("isLocalClient", () => {
    it("skips loopback fallback when false", () => {
      const result = checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: "http://localhost:5173",
        isLocalClient: false,
      });
      expect(result.ok).toBe(false);
    });

    it("defaults to true (allows loopback fallback)", () => {
      const result = checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: "http://localhost:5173",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.matchedBy).toBe("loopback");
      }
    });

    it("still allows allowlist when isLocalClient is false", () => {
      const result = checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: "http://localhost:5173",
        allowedOrigins: ["http://localhost:5173"],
        isLocalClient: false,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.matchedBy).toBe("allowlist");
      }
    });

    it("still allows host-header match when isLocalClient is false", () => {
      const result = checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: "http://127.0.0.1:18789",
        isLocalClient: false,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.matchedBy).toBe("host-header");
      }
    });
  });
});
