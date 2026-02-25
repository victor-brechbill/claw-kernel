import { describe, expect, it } from "vitest";
import { stripPluginOnlyAllowlist, type PluginToolGroups } from "./tool-policy.js";

const pluginGroups: PluginToolGroups = {
  all: ["my-plugin", "workflow_tool"],
  byPlugin: new Map([["my-plugin", ["my-plugin", "workflow_tool"]]]),
};
const coreTools = new Set(["read", "write", "exec", "session_status"]);

describe("stripPluginOnlyAllowlist", () => {
  it("strips allowlist when it only targets plugin tools", () => {
    const policy = stripPluginOnlyAllowlist({ allow: ["my-plugin"] }, pluginGroups, coreTools);
    expect(policy.policy?.allow).toBeUndefined();
    expect(policy.unknownAllowlist).toEqual([]);
  });

  it("strips allowlist when it only targets plugin groups", () => {
    const policy = stripPluginOnlyAllowlist({ allow: ["group:plugins"] }, pluginGroups, coreTools);
    expect(policy.policy?.allow).toBeUndefined();
    expect(policy.unknownAllowlist).toEqual([]);
  });

  it('keeps allowlist when it uses "*"', () => {
    const policy = stripPluginOnlyAllowlist({ allow: ["*"] }, pluginGroups, coreTools);
    expect(policy.policy?.allow).toEqual(["*"]);
    expect(policy.unknownAllowlist).toEqual([]);
  });

  it("keeps allowlist when it mixes plugin and core entries", () => {
    const policy = stripPluginOnlyAllowlist(
      { allow: ["my-plugin", "read"] },
      pluginGroups,
      coreTools,
    );
    expect(policy.policy?.allow).toEqual(["my-plugin", "read"]);
    expect(policy.unknownAllowlist).toEqual([]);
  });

  it("strips allowlist with unknown entries when no core tools match", () => {
    const emptyPlugins: PluginToolGroups = { all: [], byPlugin: new Map() };
    const policy = stripPluginOnlyAllowlist({ allow: ["my-plugin"] }, emptyPlugins, coreTools);
    expect(policy.policy?.allow).toBeUndefined();
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
    expect(policy.unknownAllowlist).toEqual(["my-plugin"]);
  });
});
