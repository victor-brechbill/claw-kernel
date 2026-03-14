import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { MsgContext } from "../templating.js";
import { buildCommandContext, handleCommands } from "./commands.js";
import { parseInlineDirectives } from "./directive-handling.js";

// GHSA-r7vr-gr74-94p8: Tests that /config and /debug commands are blocked for
// non-owner senders when an owner allowlist is configured.

vi.mock("../../config/config.js", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    loadConfig: () => ({}),
  };
});
vi.mock("../../gateway/call.js", () => ({
  callGateway: vi.fn(),
}));
vi.mock("../../agents/auth-profiles.js", () => ({
  ensureAuthProfileStore: () => ({ profiles: {} }),
  resolveAuthProfileDisplayLabel: () => undefined,
  resolveAuthProfileOrder: () => [],
}));

function buildParams(
  commandBody: string,
  cfg: OpenClawConfig,
  ctxOverrides?: Partial<MsgContext>,
) {
  const ctx = {
    Body: commandBody,
    CommandBody: commandBody,
    CommandSource: "text",
    CommandAuthorized: true,
    Provider: "whatsapp",
    Surface: "whatsapp",
    ...ctxOverrides,
  } as MsgContext;

  const command = buildCommandContext({
    ctx,
    cfg,
    isGroup: false,
    triggerBodyNormalized: commandBody.trim().toLowerCase(),
    commandAuthorized: true,
  });

  return {
    ctx,
    cfg,
    command,
    directives: parseInlineDirectives(commandBody),
    elevated: { enabled: false, allowed: false, failures: [] },
    sessionEntry: undefined,
    previousSessionEntry: undefined,
    sessionStore: {},
    sessionKey: "agent:main:main",
    storePath: "/tmp/store.json",
    workspaceDir: "/tmp",
    defaultGroupActivation: () => "mention" as const,
    resolvedThinkLevel: undefined,
    resolvedVerboseLevel: "normal" as const,
    resolvedReasoningLevel: "off" as const,
    resolvedElevatedLevel: undefined,
    resolveDefaultThinkingLevel: async () => undefined,
    provider: "anthropic",
    model: "claude-opus-4-5",
    contextTokens: 0,
    isGroup: false,
  };
}

describe("GHSA-r7vr-gr74-94p8: /config and /debug owner-only enforcement", () => {
  it("blocks /config from non-owner when ownerAllowFrom is set", async () => {
    const cfg = {
      commands: { config: true, text: true, ownerAllowFrom: ["+999"] },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/config show", cfg, {
      SenderId: "+111",
    });
    // The sender (+111) is not in the owner allowlist (+999)
    expect(params.command.senderIsOwner).toBe(false);
    expect(params.command.ownerList.length).toBeGreaterThan(0);
    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    // No reply means silently ignored (not an error message about config)
    expect(result.reply).toBeUndefined();
  });

  it("blocks /config even if isAuthorizedSender forced true but not owner", async () => {
    const cfg = {
      commands: { config: true, text: true, ownerAllowFrom: ["+999"] },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/config show", cfg, {
      SenderId: "+111",
    });
    // Force isAuthorizedSender to true to simulate the pre-fix bypass
    params.command.isAuthorizedSender = true;
    expect(params.command.senderIsOwner).toBe(false);
    expect(params.command.ownerList.length).toBeGreaterThan(0);
    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply).toBeUndefined();
  });

  it("allows /config from owner sender when ownerAllowFrom is set", async () => {
    const cfg = {
      commands: { config: true, text: true, ownerAllowFrom: ["+999"] },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/config show", cfg, {
      SenderId: "+999",
    });
    expect(params.command.senderIsOwner).toBe(true);
    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    // Owner gets the config response
    expect(result.reply?.text).toBeDefined();
  });

  it("blocks /debug from non-owner when ownerAllowFrom is set", async () => {
    const cfg = {
      commands: { debug: true, text: true, ownerAllowFrom: ["+999"] },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/debug show", cfg, {
      SenderId: "+111",
    });
    expect(params.command.senderIsOwner).toBe(false);
    expect(params.command.ownerList.length).toBeGreaterThan(0);
    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply).toBeUndefined();
  });

  it("blocks /debug even if isAuthorizedSender forced true but not owner", async () => {
    const cfg = {
      commands: { debug: true, text: true, ownerAllowFrom: ["+999"] },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/debug show", cfg, {
      SenderId: "+111",
    });
    // Force isAuthorizedSender to true to simulate the pre-fix bypass
    params.command.isAuthorizedSender = true;
    expect(params.command.senderIsOwner).toBe(false);
    expect(params.command.ownerList.length).toBeGreaterThan(0);
    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply).toBeUndefined();
  });

  it("allows /config when no ownerAllowFrom configured (all authorized senders)", async () => {
    const cfg = {
      commands: { config: true, text: true },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/config show", cfg);
    expect(params.command.isAuthorizedSender).toBe(true);
    expect(params.command.ownerList.length).toBe(0);
    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    // Should show config (not be blocked)
    expect(result.reply?.text).toBeDefined();
  });
});
