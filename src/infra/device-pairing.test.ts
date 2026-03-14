import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ConsumedSetupCodeTracker } from "../pairing/setup-code.js";
import {
  approveDevicePairing,
  getPairedDevice,
  requestDevicePairing,
  rotateDeviceToken,
  verifyDeviceToken,
} from "./device-pairing.js";

async function setupPairedOperatorDevice(baseDir: string, scopes: string[]) {
  const request = await requestDevicePairing(
    {
      deviceId: "device-1",
      publicKey: "public-key-1",
      role: "operator",
      scopes,
    },
    baseDir,
  );
  await approveDevicePairing(request.request.requestId, baseDir);
}

function requireToken(token: string | undefined): string {
  expect(typeof token).toBe("string");
  if (typeof token !== "string") {
    throw new Error("expected operator token to be issued");
  }
  return token;
}

describe("device pairing tokens", () => {
  test("generates base64url device tokens with 256-bit entropy output length", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-device-pairing-"));
    await setupPairedOperatorDevice(baseDir, ["operator.admin"]);

    const paired = await getPairedDevice("device-1", baseDir);
    const token = requireToken(paired?.tokens?.operator?.token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  test("preserves existing token scopes when rotating without scopes", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-device-pairing-"));
    await setupPairedOperatorDevice(baseDir, ["operator.admin"]);

    await rotateDeviceToken({
      deviceId: "device-1",
      role: "operator",
      scopes: ["operator.read"],
      baseDir,
    });
    let paired = await getPairedDevice("device-1", baseDir);
    expect(paired?.tokens?.operator?.scopes).toEqual(["operator.read"]);
    expect(paired?.scopes).toEqual(["operator.read"]);

    await rotateDeviceToken({
      deviceId: "device-1",
      role: "operator",
      baseDir,
    });
    paired = await getPairedDevice("device-1", baseDir);
    expect(paired?.tokens?.operator?.scopes).toEqual(["operator.read"]);
  });

  test("verifies token and rejects mismatches", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-device-pairing-"));
    await setupPairedOperatorDevice(baseDir, ["operator.read"]);
    const paired = await getPairedDevice("device-1", baseDir);
    const token = requireToken(paired?.tokens?.operator?.token);

    const ok = await verifyDeviceToken({
      deviceId: "device-1",
      token,
      role: "operator",
      scopes: ["operator.read"],
      baseDir,
    });
    expect(ok.ok).toBe(true);

    const mismatch = await verifyDeviceToken({
      deviceId: "device-1",
      token: "x".repeat(token.length),
      role: "operator",
      scopes: ["operator.read"],
      baseDir,
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("token-mismatch");
  });

  test("treats multibyte same-length token input as mismatch without throwing", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-device-pairing-"));
    await setupPairedOperatorDevice(baseDir, ["operator.read"]);
    const paired = await getPairedDevice("device-1", baseDir);
    const token = requireToken(paired?.tokens?.operator?.token);
    const multibyteToken = "é".repeat(token.length);
    expect(Buffer.from(multibyteToken).length).not.toBe(Buffer.from(token).length);

    await expect(
      verifyDeviceToken({
        deviceId: "device-1",
        token: multibyteToken,
        role: "operator",
        scopes: ["operator.read"],
        baseDir,
      }),
    ).resolves.toEqual({ ok: false, reason: "token-mismatch" });
  });
});

describe("SEC-6c: setup code replay prevention", () => {
  test("rejects pairing request with already-consumed setup code", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-device-pairing-"));
    const setupCode = "test-setup-code-abc123";

    // First request succeeds
    const first = await requestDevicePairing(
      {
        deviceId: "device-replay-1",
        publicKey: "pk-1",
        role: "operator",
        scopes: ["operator.read"],
        setupCode,
      },
      baseDir,
    );
    expect(first.status).toBe("pending");
    expect(first.created).toBe(true);

    // Approve and consume the code
    await approveDevicePairing(first.request.requestId, baseDir, setupCode);

    // Second request with same setup code is rejected
    const second = await requestDevicePairing(
      {
        deviceId: "device-replay-2",
        publicKey: "pk-2",
        role: "operator",
        scopes: ["operator.read"],
        setupCode,
      },
      baseDir,
    );
    expect(second.status).toBe("rejected");
    expect(second.reason).toBe("setup-code-already-used");
  });

  test("ConsumedSetupCodeTracker tracks and expires nonces", () => {
    const tracker = new ConsumedSetupCodeTracker(100); // 100ms TTL

    expect(tracker.isConsumed("code-a")).toBe(false);
    expect(tracker.consume("code-a")).toBe(true);
    expect(tracker.isConsumed("code-a")).toBe(true);
    expect(tracker.consume("code-a")).toBe(false); // already consumed
    expect(tracker.size).toBe(1);
  });

  test("ConsumedSetupCodeTracker prunes expired entries", async () => {
    const tracker = new ConsumedSetupCodeTracker(50); // 50ms TTL

    tracker.consume("code-b");
    expect(tracker.size).toBe(1);

    await new Promise((r) => setTimeout(r, 80));
    tracker.prune();
    expect(tracker.size).toBe(0);
    expect(tracker.isConsumed("code-b")).toBe(false);
  });
});
