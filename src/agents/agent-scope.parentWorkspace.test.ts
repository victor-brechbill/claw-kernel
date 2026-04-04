import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentWorkspaceDir } from "./agent-scope.js";

describe("resolveAgentWorkspaceDir with parentAgentId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("non-default agent without parentAgentId falls back to workspace-{id}", () => {
    const stateDir = path.join(path.sep, "tmp", "state");
    vi.stubEnv("OPENCLAW_STATE_DIR", stateDir);

    const cfg = {
      agents: { list: [{ id: "main", default: true }, { id: "helper" }] },
    } as unknown as OpenClawConfig;

    const workspace = resolveAgentWorkspaceDir(cfg, "helper");
    expect(workspace).toBe(path.join(stateDir, "workspace-helper"));
  });

  it("non-default agent with parentAgentId inherits parent workspace", () => {
    const home = path.join(path.sep, "srv", "openclaw-home");
    vi.stubEnv("OPENCLAW_HOME", home);

    const cfg = {
      agents: { list: [{ id: "main", default: true }, { id: "helper" }] },
    } as unknown as OpenClawConfig;

    const parentWorkspace = resolveAgentWorkspaceDir(cfg, "main");
    const childWorkspace = resolveAgentWorkspaceDir(cfg, "helper", "main");
    expect(childWorkspace).toBe(parentWorkspace);
  });

  it("agent with explicit workspace ignores parentAgentId", () => {
    const cfg = {
      agents: {
        list: [
          { id: "main", default: true },
          { id: "helper", workspace: "/custom/workspace" },
        ],
      },
    } as unknown as OpenClawConfig;

    const workspace = resolveAgentWorkspaceDir(cfg, "helper", "main");
    expect(workspace).toBe("/custom/workspace");
  });

  it("default agent ignores parentAgentId", () => {
    const home = path.join(path.sep, "srv", "openclaw-home");
    vi.stubEnv("OPENCLAW_HOME", home);

    const cfg = {
      agents: { list: [{ id: "main", default: true }] },
    } as unknown as OpenClawConfig;

    const withParent = resolveAgentWorkspaceDir(cfg, "main", "other");
    const withoutParent = resolveAgentWorkspaceDir(cfg, "main");
    expect(withParent).toBe(withoutParent);
  });
});
