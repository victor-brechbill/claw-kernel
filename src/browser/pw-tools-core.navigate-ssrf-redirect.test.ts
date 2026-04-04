import { describe, expect, it } from "vitest";
import { SsrFBlockedError } from "../infra/net/ssrf.js";
import {
  installPwToolsCoreTestHooks,
  setPwToolsCoreCurrentPage,
} from "./pw-tools-core.test-harness.js";

installPwToolsCoreTestHooks();
const mod = await import("./pw-tools-core.js");

describe("navigateViaPlaywright — SSRF redirect bypass protection", () => {
  it("allows navigation to a public URL", async () => {
    let navigatedTo = "";
    setPwToolsCoreCurrentPage({
      goto: async (url: string) => {
        navigatedTo = url;
      },
      url: () => navigatedTo,
    });

    const result = await mod.navigateViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T1",
      url: "https://example.com",
    });

    expect(result.url).toBe("https://example.com");
  });

  it("blocks navigation when final URL is a private IP (redirect bypass)", async () => {
    setPwToolsCoreCurrentPage({
      goto: async () => {},
      // Simulate redirect to internal address
      url: () => "http://192.168.1.1/admin",
    });

    await expect(
      mod.navigateViaPlaywright({
        cdpUrl: "http://127.0.0.1:18792",
        targetId: "T1",
        url: "https://example.com",
      }),
    ).rejects.toBeInstanceOf(SsrFBlockedError);
  });

  it("blocks navigation when final URL is localhost (redirect bypass)", async () => {
    setPwToolsCoreCurrentPage({
      goto: async () => {},
      url: () => "http://localhost:8080/secret",
    });

    await expect(
      mod.navigateViaPlaywright({
        cdpUrl: "http://127.0.0.1:18792",
        targetId: "T1",
        url: "https://example.com",
      }),
    ).rejects.toBeInstanceOf(SsrFBlockedError);
  });

  it("blocks navigation when final URL is 127.0.0.1 (redirect bypass)", async () => {
    setPwToolsCoreCurrentPage({
      goto: async () => {},
      url: () => "http://127.0.0.1:9000/internal",
    });

    await expect(
      mod.navigateViaPlaywright({
        cdpUrl: "http://127.0.0.1:18792",
        targetId: "T1",
        url: "https://example.com",
      }),
    ).rejects.toBeInstanceOf(SsrFBlockedError);
  });

  it("allows non-http URLs like about:blank without error", async () => {
    setPwToolsCoreCurrentPage({
      goto: async () => {},
      url: () => "about:blank",
    });

    const result = await mod.navigateViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T1",
      url: "about:blank",
    });

    expect(result.url).toBe("about:blank");
  });
});
