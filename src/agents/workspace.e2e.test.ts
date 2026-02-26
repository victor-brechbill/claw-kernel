import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_MEMORY_ALT_FILENAME,
  DEFAULT_MEMORY_FILENAME,
  DEFAULT_SETUP_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
  ensureAgentWorkspace,
  isSetupChecklistComplete,
  loadWorkspaceBootstrapFiles,
  resolveDefaultAgentWorkspaceDir,
} from "./workspace.js";

describe("resolveDefaultAgentWorkspaceDir", () => {
  it("uses OPENCLAW_HOME for default workspace resolution", () => {
    const dir = resolveDefaultAgentWorkspaceDir({
      OPENCLAW_HOME: "/srv/openclaw-home",
      HOME: "/home/other",
    } as NodeJS.ProcessEnv);

    expect(dir).toBe(path.join(path.resolve("/srv/openclaw-home"), ".openclaw", "workspace"));
  });
});

const WORKSPACE_STATE_PATH_SEGMENTS = [".openclaw", "workspace-state.json"] as const;

async function readOnboardingState(dir: string): Promise<{
  version: number;
  bootstrapSeededAt?: string;
  onboardingCompletedAt?: string;
  setupSeededAt?: string;
  setupCompletedAt?: string;
}> {
  const raw = await fs.readFile(path.join(dir, ...WORKSPACE_STATE_PATH_SEGMENTS), "utf-8");
  return JSON.parse(raw) as {
    version: number;
    bootstrapSeededAt?: string;
    onboardingCompletedAt?: string;
    setupSeededAt?: string;
    setupCompletedAt?: string;
  };
}

describe("ensureAgentWorkspace", () => {
  it("creates BOOTSTRAP.md and records a seeded marker for brand new workspaces", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(
      fs.access(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME)),
    ).resolves.toBeUndefined();
    const state = await readOnboardingState(tempDir);
    expect(state.bootstrapSeededAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(state.onboardingCompletedAt).toBeUndefined();
  });

  it("recovers partial initialization by creating BOOTSTRAP.md when marker is missing", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_AGENTS_FILENAME, content: "existing" });

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(
      fs.access(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME)),
    ).resolves.toBeUndefined();
    const state = await readOnboardingState(tempDir);
    expect(state.bootstrapSeededAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("does not recreate BOOTSTRAP.md after completion, even when a core file is recreated", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_IDENTITY_FILENAME, content: "custom" });
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_USER_FILENAME, content: "custom" });
    await fs.unlink(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME));
    await fs.unlink(path.join(tempDir, DEFAULT_TOOLS_FILENAME));

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.access(path.join(tempDir, DEFAULT_TOOLS_FILENAME))).resolves.toBeUndefined();
    const state = await readOnboardingState(tempDir);
    expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("does not re-seed BOOTSTRAP.md for legacy completed workspaces without state marker", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_IDENTITY_FILENAME, content: "custom" });
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_USER_FILENAME, content: "custom" });

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const state = await readOnboardingState(tempDir);
    expect(state.bootstrapSeededAt).toBeUndefined();
    expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("does not create SETUP.md for brand new workspaces (onboarding not yet complete)", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(path.join(tempDir, DEFAULT_SETUP_FILENAME))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const state = await readOnboardingState(tempDir);
    expect(state.setupSeededAt).toBeUndefined();
    expect(state.setupCompletedAt).toBeUndefined();
  });

  it("seeds SETUP.md when onboarding completes", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Complete onboarding by deleting BOOTSTRAP.md
    await fs.unlink(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME));
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(path.join(tempDir, DEFAULT_SETUP_FILENAME))).resolves.toBeUndefined();
    const state = await readOnboardingState(tempDir);
    expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(state.setupSeededAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(state.setupCompletedAt).toBeUndefined();
  });

  it("auto-removes SETUP.md when all checkboxes are checked", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Complete onboarding
    await fs.unlink(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME));
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Check all boxes
    const setupPath = path.join(tempDir, DEFAULT_SETUP_FILENAME);
    const content = await fs.readFile(setupPath, "utf-8");
    const checked = content.replace(/- \[ \]/g, "- [x]");
    await fs.writeFile(setupPath, checked, "utf-8");

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(setupPath)).rejects.toMatchObject({ code: "ENOENT" });
    const state = await readOnboardingState(tempDir);
    expect(state.setupCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("persists SETUP.md when some checkboxes are unchecked", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Complete onboarding
    await fs.unlink(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME));
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Check only the first box
    const setupPath = path.join(tempDir, DEFAULT_SETUP_FILENAME);
    const content = await fs.readFile(setupPath, "utf-8");
    const partiallyChecked = content.replace("- [ ]", "- [x]");
    await fs.writeFile(setupPath, partiallyChecked, "utf-8");

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(setupPath)).resolves.toBeUndefined();
    const state = await readOnboardingState(tempDir);
    expect(state.setupCompletedAt).toBeUndefined();
  });

  it("does not re-seed SETUP.md after completion", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Complete onboarding
    await fs.unlink(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME));
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Complete setup by checking all boxes
    const setupPath = path.join(tempDir, DEFAULT_SETUP_FILENAME);
    const content = await fs.readFile(setupPath, "utf-8");
    await fs.writeFile(setupPath, content.replace(/- \[ \]/g, "- [x]"), "utf-8");
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Run again — SETUP.md should stay gone
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(setupPath)).rejects.toMatchObject({ code: "ENOENT" });
    const state = await readOnboardingState(tempDir);
    expect(state.setupCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("seeds SETUP.md for legacy workspaces with pre-existing onboarding", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    // Simulate a legacy pre-onboarded workspace with custom IDENTITY/USER
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_IDENTITY_FILENAME, content: "custom" });
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_USER_FILENAME, content: "custom" });

    // First run detects legacy onboarding + seeds SETUP.md
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(path.join(tempDir, DEFAULT_SETUP_FILENAME))).resolves.toBeUndefined();
    const state = await readOnboardingState(tempDir);
    expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(state.setupSeededAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("marks setup complete when SETUP.md is manually deleted", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Complete onboarding
    await fs.unlink(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME));
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    // Manually delete SETUP.md without checking any boxes
    await fs.unlink(path.join(tempDir, DEFAULT_SETUP_FILENAME));
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    const state = await readOnboardingState(tempDir);
    expect(state.setupCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe("loadWorkspaceBootstrapFiles", () => {
  it("includes MEMORY.md when present", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: "MEMORY.md", content: "memory" });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const memoryEntries = files.filter((file) =>
      [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME].includes(file.name),
    );

    expect(memoryEntries).toHaveLength(1);
    expect(memoryEntries[0]?.missing).toBe(false);
    expect(memoryEntries[0]?.content).toBe("memory");
  });

  it("includes memory.md when MEMORY.md is absent", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: "memory.md", content: "alt" });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const memoryEntries = files.filter((file) =>
      [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME].includes(file.name),
    );

    expect(memoryEntries).toHaveLength(1);
    expect(memoryEntries[0]?.missing).toBe(false);
    expect(memoryEntries[0]?.content).toBe("alt");
  });

  it("omits memory entries when no memory files exist", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const memoryEntries = files.filter((file) =>
      [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME].includes(file.name),
    );

    expect(memoryEntries).toHaveLength(0);
  });

  it("includes SETUP.md when present", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({
      dir: tempDir,
      name: DEFAULT_SETUP_FILENAME,
      content: "setup content",
    });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const setupEntries = files.filter((file) => file.name === DEFAULT_SETUP_FILENAME);

    expect(setupEntries).toHaveLength(1);
    expect(setupEntries[0]?.missing).toBe(false);
    expect(setupEntries[0]?.content).toBe("setup content");
  });
});

describe("isSetupChecklistComplete", () => {
  it("returns false for content with no checkboxes", () => {
    expect(isSetupChecklistComplete("just some text\nno checkboxes here")).toBe(false);
  });

  it("returns false when some boxes are unchecked", () => {
    const content = "- [x] Done\n- [ ] Not done\n- [x] Also done";
    expect(isSetupChecklistComplete(content)).toBe(false);
  });

  it("returns true when all boxes are checked", () => {
    const content = "- [x] First\n- [X] Second\n- [x] Third";
    expect(isSetupChecklistComplete(content)).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isSetupChecklistComplete("")).toBe(false);
  });
});
