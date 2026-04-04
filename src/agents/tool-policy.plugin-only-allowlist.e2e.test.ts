import { describe, expect, it } from "vitest";
import { stripPluginOnlyAllowlist, type PluginToolGroups } from "./tool-policy.js";

const pluginGroups: PluginToolGroups = {
  all: ["my-plugin", "workflow_tool"],
  byPlugin: new Map([["my-plugin", ["my-plugin", "workflow_tool"]]]),
};
const coreTools = new Set(["read", "write", "exec", "session_status"]);

describe("stripPluginOnlyAllowlist", () => {
  it("preserves allowlist when it only targets plugin tools (security: no access widening)", () => {
    const policy = stripPluginOnlyAllowlist({ allow: ["my-plugin"] }, pluginGroups, coreTools);
    // Security fix: plugin-only allowlists must be preserved, not stripped.
    // Stripping would widen access to ALL core tools.
    expect(policy.policy?.allow).toEqual(["my-plugin"]);
    expect(policy.strippedAllowlist).toBe(true);
    expect(policy.unknownAllowlist).toEqual([]);
  });

  it("preserves allowlist when it only targets plugin groups", () => {
    const policy = stripPluginOnlyAllowlist({ allow: ["group:plugins"] }, pluginGroups, coreTools);
    expect(policy.policy?.allow).toEqual(["group:plugins"]);
    expect(policy.strippedAllowlist).toBe(true);
    expect(policy.unknownAllowlist).toEqual([]);
  });

  it('keeps allowlist when it uses "*"', () => {
    const policy = stripPluginOnlyAllowlist({ allow: ["*"] }, pluginGroups, coreTools);
    expect(policy.policy?.allow).toEqual(["*"]);
    expect(policy.strippedAllowlist).toBe(false);
    expect(policy.unknownAllowlist).toEqual([]);
  });

  it("keeps allowlist when it mixes plugin and core entries", () => {
    const policy = stripPluginOnlyAllowlist(
      { allow: ["my-plugin", "read"] },
      pluginGroups,
      coreTools,
    );
    expect(policy.policy?.allow).toEqual(["my-plugin", "read"]);
    expect(policy.strippedAllowlist).toBe(false);
    expect(policy.unknownAllowlist).toEqual([]);
  });

  it("preserves allowlist with unknown entries when no core tools match", () => {
    const emptyPlugins: PluginToolGroups = { all: [], byPlugin: new Map() };
    const policy = stripPluginOnlyAllowlist({ allow: ["my-plugin"] }, emptyPlugins, coreTools);
    // Security fix: preserve allowlist even with unknown entries to avoid widening access.
    expect(policy.policy?.allow).toEqual(["my-plugin"]);
    expect(policy.strippedAllowlist).toBe(true);
    expect(policy.unknownAllowlist).toEqual(["my-plugin"]);
  });

  it("keeps allowlist with core tools and reports unknown entries", () => {
    const emptyPlugins: PluginToolGroups = { all: [], byPlugin: new Map() };
    const policy = stripPluginOnlyAllowlist(
      { allow: ["read", "my-plugin"] },
      emptyPlugins,
      coreTools,
    );
    expect(policy.policy?.allow).toEqual(["read", "my-plugin"]);
    expect(policy.strippedAllowlist).toBe(false);
    expect(policy.unknownAllowlist).toEqual(["my-plugin"]);
  });
});
