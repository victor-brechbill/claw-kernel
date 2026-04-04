import { describe, expect, test } from "vitest";
import { applyToolPolicyPipeline } from "./tool-policy-pipeline.js";

type DummyTool = { name: string };

describe("tool-policy-pipeline", () => {
  test("preserves plugin-only allowlists (security: does not widen to all core tools)", () => {
    // Security fix: plugin-only allowlists must be preserved.
    // Previously they were stripped, which granted access to ALL core tools.
    const tools = [{ name: "exec" }, { name: "plugin_tool" }] as unknown as DummyTool[];
    const filtered = applyToolPolicyPipeline({
      // oxlint-disable-next-line typescript/no-explicit-any
      tools: tools as any,
      // oxlint-disable-next-line typescript/no-explicit-any
      toolMeta: (t: any) => (t.name === "plugin_tool" ? { pluginId: "foo" } : undefined),
      warn: () => {},
      steps: [
        {
          policy: { allow: ["plugin_tool"] },
          label: "tools.allow",
          stripPluginOnlyAllowlist: true,
        },
      ],
    });
    const names = filtered.map((t) => (t as unknown as DummyTool).name).toSorted();
    // Only plugin_tool should be accessible — exec should NOT be widened in.
    expect(names).toEqual(["plugin_tool"]);
  });

  test("warns about unknown allowlist entries", () => {
    const warnings: string[] = [];
    const tools = [{ name: "exec" }] as unknown as DummyTool[];
    applyToolPolicyPipeline({
      // oxlint-disable-next-line typescript/no-explicit-any
      tools: tools as any,
      // oxlint-disable-next-line typescript/no-explicit-any
      toolMeta: () => undefined,
      warn: (msg) => warnings.push(msg),
      steps: [
        {
          policy: { allow: ["wat"] },
          label: "tools.allow",
          stripPluginOnlyAllowlist: true,
        },
      ],
    });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("unknown entries (wat)");
  });

  test("applies allowlist filtering when core tools are explicitly listed", () => {
    const tools = [{ name: "exec" }, { name: "process" }] as unknown as DummyTool[];
    const filtered = applyToolPolicyPipeline({
      // oxlint-disable-next-line typescript/no-explicit-any
      tools: tools as any,
      // oxlint-disable-next-line typescript/no-explicit-any
      toolMeta: () => undefined,
      warn: () => {},
      steps: [
        {
          policy: { allow: ["exec"] },
          label: "tools.allow",
          stripPluginOnlyAllowlist: true,
        },
      ],
    });
    expect(filtered.map((t) => (t as unknown as DummyTool).name)).toEqual(["exec"]);
  });
});
