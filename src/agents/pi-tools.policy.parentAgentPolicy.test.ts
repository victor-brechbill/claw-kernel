import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveSubagentToolPolicy } from "./pi-tools.policy.js";

describe("resolveSubagentToolPolicy with parentAgentPolicy", () => {
  const baseCfg = {
    agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
  } as unknown as OpenClawConfig;

  it("without parentAgentPolicy returns normal policy", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1);
    expect(policy.deny).toBeDefined();
    expect(policy.allow).toBeUndefined();
  });

  it("inherits parent allow list when subagent has no allow", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1, {
      allow: ["read", "write", "exec"],
    });
    expect(policy.allow).toEqual(["read", "write", "exec"]);
  });

  it("intersects parent allow with subagent allow", () => {
    const cfgWithAllow = {
      ...baseCfg,
      tools: { subagents: { tools: { allow: ["read", "exec", "web_fetch"] } } },
    } as unknown as OpenClawConfig;

    const policy = resolveSubagentToolPolicy(cfgWithAllow, 1, {
      allow: ["read", "exec"],
    });
    // web_fetch is not in parent allow, so it should be filtered out
    expect(policy.allow).toEqual(["read", "exec"]);
  });

  it("merges parent deny list into subagent deny", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1, {
      deny: ["dangerous_tool"],
    });
    expect(policy.deny).toContain("dangerous_tool");
  });

  it("merges parent deny and intersects parent allow together", () => {
    const cfgWithAllow = {
      ...baseCfg,
      tools: { subagents: { tools: { allow: ["read", "exec", "web_fetch"] } } },
    } as unknown as OpenClawConfig;

    const policy = resolveSubagentToolPolicy(cfgWithAllow, 1, {
      allow: ["read", "exec"],
      deny: ["dangerous_tool"],
    });
    expect(policy.allow).toEqual(["read", "exec"]);
    expect(policy.deny).toContain("dangerous_tool");
  });

  it("parent allow with wildcard allows all subagent tools through", () => {
    const cfgWithAllow = {
      ...baseCfg,
      tools: { subagents: { tools: { allow: ["read", "web_fetch"] } } },
    } as unknown as OpenClawConfig;

    const policy = resolveSubagentToolPolicy(cfgWithAllow, 1, {
      allow: ["*"],
    });
    expect(policy.allow).toEqual(["read", "web_fetch"]);
  });

  it("parent with empty allow array does not restrict subagent", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1, {
      allow: [],
    });
    // Empty allow means no restriction from parent
    expect(policy.allow).toBeUndefined();
  });

  it("preserves base deny list alongside parent deny", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1, {
      deny: ["custom_deny"],
    });
    // Should still have the SUBAGENT_TOOL_DENY_ALWAYS items
    expect(policy.deny).toContain("gateway");
    expect(policy.deny).toContain("cron");
    expect(policy.deny).toContain("custom_deny");
  });
});
