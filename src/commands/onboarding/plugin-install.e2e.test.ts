import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

const installPluginFromNpmSpec = vi.fn();
vi.mock("../../plugins/install.js", () => ({
  installPluginFromNpmSpec: (...args: unknown[]) => installPluginFromNpmSpec(...args),
}));

vi.mock("../../plugins/loader.js", () => ({
  loadOpenClawPlugins: vi.fn(),
}));

import fs from "node:fs";
import type { ChannelPluginCatalogEntry } from "../../channels/plugins/catalog.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { WizardPrompter } from "../../wizard/prompts.js";
import { makePrompter, makeRuntime } from "./__tests__/test-utils.js";
import { ensureOnboardingPluginInstalled } from "./plugin-install.js";

const baseEntry: ChannelPluginCatalogEntry = {
  id: "signal",
  meta: {
    id: "signal",
    label: "Signal",
    selectionLabel: "Signal (Bot API)",
    docsPath: "/channels/signal",
    docsLabel: "signal",
    blurb: "Test",
  },
  install: {
    npmSpec: "@openclaw/signal",
    localPath: "extensions/signal",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

function mockRepoLocalPathExists() {
  vi.mocked(fs.existsSync).mockImplementation((value) => {
    const raw = String(value);
    return (
      raw.endsWith(`${path.sep}.git`) || raw.endsWith(`${path.sep}extensions${path.sep}signal`)
    );
  });
}

async function runInitialValueForChannel(channel: "dev" | "beta") {
  const runtime = makeRuntime();
  const select = vi.fn(async () => "skip") as WizardPrompter["select"];
  const prompter = makePrompter({ select });
  const cfg: OpenClawConfig = { update: { channel } };
  mockRepoLocalPathExists();

  await ensureOnboardingPluginInstalled({
    cfg,
    entry: baseEntry,
    prompter,
    runtime,
  });

  return select.mock.calls[0]?.[0]?.initialValue;
}

function expectPluginLoadedFromLocalPath(
  result: Awaited<ReturnType<typeof ensureOnboardingPluginInstalled>>,
) {
  const expectedPath = path.resolve(process.cwd(), "extensions/signal");
  expect(result.installed).toBe(true);
  expect(result.cfg.plugins?.load?.paths).toContain(expectedPath);
}

describe("ensureOnboardingPluginInstalled", () => {
  it("installs from npm and enables the plugin", async () => {
    const runtime = makeRuntime();
    const prompter = makePrompter({
      select: vi.fn(async () => "npm") as WizardPrompter["select"],
    });
    const cfg: OpenClawConfig = { plugins: { allow: ["other"] } };
    vi.mocked(fs.existsSync).mockReturnValue(false);
    installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "signal",
      targetDir: "/tmp/signal",
      extensions: [],
    });

    const result = await ensureOnboardingPluginInstalled({
      cfg,
      entry: baseEntry,
      prompter,
      runtime,
    });

    expect(result.installed).toBe(true);
    expect(result.cfg.plugins?.entries?.signal?.enabled).toBe(true);
    expect(result.cfg.plugins?.allow).toContain("signal");
    expect(result.cfg.plugins?.installs?.signal?.source).toBe("npm");
    expect(result.cfg.plugins?.installs?.signal?.spec).toBe("@openclaw/signal");
    expect(result.cfg.plugins?.installs?.signal?.installPath).toBe("/tmp/signal");
    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({ spec: "@openclaw/signal" }),
    );
  });

  it("uses local path when selected", async () => {
    const runtime = makeRuntime();
    const prompter = makePrompter({
      select: vi.fn(async () => "local") as WizardPrompter["select"],
    });
    const cfg: OpenClawConfig = {};
    mockRepoLocalPathExists();

    const result = await ensureOnboardingPluginInstalled({
      cfg,
      entry: baseEntry,
      prompter,
      runtime,
    });

    expectPluginLoadedFromLocalPath(result);
    expect(result.cfg.plugins?.entries?.signal?.enabled).toBe(true);
  });

  it("defaults to local on dev channel when local path exists", async () => {
    expect(await runInitialValueForChannel("dev")).toBe("local");
  });

  it("defaults to npm on beta channel even when local path exists", async () => {
    expect(await runInitialValueForChannel("beta")).toBe("npm");
  });

  it("falls back to local path after npm install failure", async () => {
    const runtime = makeRuntime();
    const note = vi.fn(async () => {});
    const confirm = vi.fn(async () => true);
    const prompter = makePrompter({
      select: vi.fn(async () => "npm") as WizardPrompter["select"],
      note,
      confirm,
    });
    const cfg: OpenClawConfig = {};
    mockRepoLocalPathExists();
    installPluginFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "nope",
    });

    const result = await ensureOnboardingPluginInstalled({
      cfg,
      entry: baseEntry,
      prompter,
      runtime,
    });

    expectPluginLoadedFromLocalPath(result);
    expect(note).toHaveBeenCalled();
    expect(runtime.error).not.toHaveBeenCalled();
  });
});
