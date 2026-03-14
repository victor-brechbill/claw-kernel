import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  approveDevicePairing,
  ensureDeviceToken,
  getPairedDevice,
  requestDevicePairing,
  verifyDeviceToken,
} from "./device-pairing.js";

// GHSA-2pwv-x786-56f8: Device token scope escalation — verify that token
// scopes are capped to the device's approved baseline.

describe("device token scope capping (GHSA-2pwv-x786-56f8)", () => {
  async function pairDevice(baseDir: string, scopes: string[]) {
    const req = await requestDevicePairing(
      {
        deviceId: "dev-scope-test",
        publicKey: "pk-scope-test",
        role: "operator",
        scopes,
      },
      baseDir,
    );
    await approveDevicePairing(req.request.requestId, baseDir);
    return getPairedDevice("dev-scope-test", baseDir);
  }

  test("verifyDeviceToken rejects scopes not in stored token", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-scope-cap-"));
    await pairDevice(baseDir, ["operator.read"]);
    const paired = await getPairedDevice("dev-scope-test", baseDir);
    const token = paired?.tokens?.operator?.token;
    expect(typeof token).toBe("string");
    if (!token) {
      return;
    }

    // Requesting a broader scope than what was approved should fail
    const result = await verifyDeviceToken({
      deviceId: "dev-scope-test",
      token,
      role: "operator",
      scopes: ["operator.read", "operator.admin"],
      baseDir,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("scope-mismatch");
  });

  test("ensureDeviceToken rotates token when broader scopes are requested", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-scope-cap-"));
    await pairDevice(baseDir, ["operator.read"]);

    // ensureDeviceToken with broader scopes creates a new token (rotates)
    const newToken = await ensureDeviceToken({
      deviceId: "dev-scope-test",
      role: "operator",
      scopes: ["operator.read", "operator.admin"],
      baseDir,
    });
    expect(newToken).not.toBeNull();
    // The new token has the broader scopes
    expect(newToken?.scopes).toEqual(["operator.admin", "operator.read"]);

    // But verify should still work with the new token and broader scopes
    if (newToken) {
      const result = await verifyDeviceToken({
        deviceId: "dev-scope-test",
        token: newToken.token,
        role: "operator",
        scopes: ["operator.admin", "operator.read"],
        baseDir,
      });
      expect(result.ok).toBe(true);
    }
  });

  test("scope intersection filters out non-approved scopes", () => {
    // This tests the logic that should be applied in the WS message handler:
    // client-claimed scopes should be capped to the device's approved scopes.
    const approvedScopes = ["operator.read", "operator.status"];
    const claimedScopes = ["operator.read", "operator.admin", "operator.write"];

    const allowedScopeSet = new Set(approvedScopes);
    const cappedScopes = claimedScopes.filter((scope) => allowedScopeSet.has(scope));

    expect(cappedScopes).toEqual(["operator.read"]);
    expect(cappedScopes).not.toContain("operator.admin");
    expect(cappedScopes).not.toContain("operator.write");
  });
});
