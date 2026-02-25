import fs from "node:fs";
import path from "node:path";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { extractAssistantText } from "../pi-embedded-utils.js";
import {
  buildServerToolDefinitions,
  createServerToolsStreamFnWrapper,
  resolveServerTools,
} from "./server-tools.js";

describe("resolveServerTools", () => {
  it("returns undefined when config is undefined", () => {
    expect(resolveServerTools(undefined)).toBeUndefined();
  });

  it("returns undefined when tools is undefined", () => {
    const config = {} as OpenClawConfig;
    expect(resolveServerTools(config)).toBeUndefined();
  });

  it("returns undefined when serverTools is undefined", () => {
    const config = { tools: {} } as OpenClawConfig;
    expect(resolveServerTools(config)).toBeUndefined();
  });

  it("returns undefined when serverTools is empty array", () => {
    const config = { tools: { serverTools: [] } } as OpenClawConfig;
    expect(resolveServerTools(config)).toBeUndefined();
  });

  it("returns undefined when serverTools is not an array", () => {
    const config = {
      tools: { serverTools: "not-an-array" as unknown as string[] },
    } as OpenClawConfig;
    expect(resolveServerTools(config)).toBeUndefined();
  });

  it("filters out non-string and empty-string entries", () => {
    const config = {
      tools: {
        serverTools: [
          "web_search_20260209",
          123 as unknown as string,
          "",
          "  ",
          "web_fetch_20260209",
          null as unknown as string,
        ],
      },
    } as OpenClawConfig;
    const result = resolveServerTools(config);
    expect(result).toEqual(["web_search_20260209", "web_fetch_20260209"]);
  });

  it("returns valid array for valid config", () => {
    const config = {
      tools: {
        serverTools: ["web_search_20260209", "web_fetch_20260209"],
      },
    } as OpenClawConfig;
    const result = resolveServerTools(config);
    expect(result).toEqual(["web_search_20260209", "web_fetch_20260209"]);
  });
});

describe("buildServerToolDefinitions", () => {
  it("maps known web_search tool correctly", () => {
    const result = buildServerToolDefinitions(["web_search_20260209"]);
    expect(result).toEqual([{ type: "web_search_20260209", name: "web_search" }]);
  });

  it("maps known web_fetch tool correctly", () => {
    const result = buildServerToolDefinitions(["web_fetch_20260209"]);
    expect(result).toEqual([{ type: "web_fetch_20260209", name: "web_fetch" }]);
  });

  it("strips date suffix from unknown tool types", () => {
    const result = buildServerToolDefinitions(["code_execution_20260301"]);
    expect(result).toEqual([{ type: "code_execution_20260301", name: "code_execution" }]);
  });

  it("handles mixed known and unknown tools", () => {
    const result = buildServerToolDefinitions([
      "web_search_20260209",
      "unknown_tool_20270101",
      "web_fetch_20260209",
    ]);
    expect(result).toEqual([
      { type: "web_search_20260209", name: "web_search" },
      { type: "unknown_tool_20270101", name: "unknown_tool" },
      { type: "web_fetch_20260209", name: "web_fetch" },
    ]);
  });

  it("handles tool type without date suffix", () => {
    const result = buildServerToolDefinitions(["custom_tool"]);
    expect(result).toEqual([{ type: "custom_tool", name: "custom_tool" }]);
  });

  it("returns empty array for empty input", () => {
    const result = buildServerToolDefinitions([]);
    expect(result).toEqual([]);
  });
});

describe("createServerToolsStreamFnWrapper", () => {
  it("passes through unchanged for non-Anthropic model", () => {
    const mockStreamFn = () => ({}) as ReturnType<typeof mockStreamFn>;
    const wrapped = createServerToolsStreamFnWrapper(mockStreamFn, ["web_search_20260209"]);

    const nonAnthropicModel = { api: "openai" as const } as Parameters<typeof wrapped>[0];
    const context = [] as Parameters<typeof wrapped>[1];
    const options = {} as Parameters<typeof wrapped>[2];

    const result = wrapped(nonAnthropicModel, context, options);
    expect(result).toBeDefined();
  });

  it("injects server tools for Anthropic model", () => {
    let capturedPayload: unknown = null;
    // Mock StreamFn that calls onPayload with an empty payload
    const mockStreamFn = (
      _model: unknown,
      _context: unknown,
      options?: { onPayload?: (p: unknown) => void },
    ) => {
      const payload = {};
      options?.onPayload?.(payload);
      return {} as ReturnType<typeof mockStreamFn>;
    };
    const wrapped = createServerToolsStreamFnWrapper(mockStreamFn, ["web_search_20260209"]);

    const anthropicModel = { api: "anthropic-messages" as const } as Parameters<typeof wrapped>[0];
    const context = [] as Parameters<typeof wrapped>[1];
    const options = {
      onPayload: (payload: unknown) => {
        capturedPayload = payload;
      },
    } as Parameters<typeof wrapped>[2];

    void wrapped(anthropicModel, context, options);

    expect(capturedPayload).toBeDefined();
    expect((capturedPayload as { tools?: unknown[] })?.tools).toEqual([
      { type: "web_search_20260209", name: "web_search" },
    ]);
  });

  it("appends to existing tools array", () => {
    let capturedPayload: unknown = null;
    const existingTool = { type: "custom", name: "existing" };
    // Mock StreamFn that calls onPayload with a payload containing existing tools
    const mockStreamFn = (
      _model: unknown,
      _context: unknown,
      options?: { onPayload?: (p: unknown) => void; tools?: unknown[] },
    ) => {
      const payload = { tools: options?.tools ? [...options.tools] : [] };
      options?.onPayload?.(payload);
      return {} as ReturnType<typeof mockStreamFn>;
    };
    const wrapped = createServerToolsStreamFnWrapper(mockStreamFn, ["web_search_20260209"]);

    const anthropicModel = { api: "anthropic-messages" as const } as Parameters<typeof wrapped>[0];
    const context = [] as Parameters<typeof wrapped>[1];
    const options = {
      tools: [existingTool],
      onPayload: (payload: unknown) => {
        capturedPayload = payload;
      },
    } as unknown as Parameters<typeof wrapped>[2];

    void wrapped(anthropicModel, context, options);

    expect((capturedPayload as { tools?: unknown[] })?.tools).toEqual([
      existingTool,
      { type: "web_search_20260209", name: "web_search" },
    ]);
  });

  it("chains original onPayload callback", () => {
    let originalCalled = false;
    let wrappedCalled = false;

    const mockStreamFn = () => ({}) as ReturnType<typeof mockStreamFn>;
    const wrapped = createServerToolsStreamFnWrapper(mockStreamFn, ["web_search_20260209"]);

    const anthropicModel = { api: "anthropic-messages" as const } as Parameters<typeof wrapped>[0];
    const context = [] as Parameters<typeof wrapped>[1];
    const options = {
      onPayload: () => {
        originalCalled = true;
      },
    } as Parameters<typeof wrapped>[2];

    const result = wrapped(anthropicModel, context, options);
    expect(result).toBeDefined();

    // Verify onPayload was modified
    if (options.onPayload) {
      options.onPayload({});
      wrappedCalled = true;
    }

    expect(originalCalled).toBe(true);
    expect(wrappedCalled).toBe(true);
  });

  it("handles multiple server tools", () => {
    let capturedPayload: unknown = null;
    // Mock StreamFn that calls onPayload with an empty payload
    const mockStreamFn = (
      _model: unknown,
      _context: unknown,
      options?: { onPayload?: (p: unknown) => void },
    ) => {
      const payload = {};
      options?.onPayload?.(payload);
      return {} as ReturnType<typeof mockStreamFn>;
    };
    const wrapped = createServerToolsStreamFnWrapper(mockStreamFn, [
      "web_search_20260209",
      "web_fetch_20260209",
    ]);

    const anthropicModel = { api: "anthropic-messages" as const } as Parameters<typeof wrapped>[0];
    const context = [] as Parameters<typeof wrapped>[1];
    const options = {
      onPayload: (payload: unknown) => {
        capturedPayload = payload;
      },
    } as Parameters<typeof wrapped>[2];

    void wrapped(anthropicModel, context, options);

    expect((capturedPayload as { tools?: unknown[] })?.tools).toEqual([
      { type: "web_search_20260209", name: "web_search" },
      { type: "web_fetch_20260209", name: "web_fetch" },
    ]);
  });
});

describe("extractAssistantText with server tool blocks", () => {
  it("extracts only text blocks, ignoring server_tool_use and result blocks", () => {
    // After the pi-ai patch, assistant message content may contain server tool blocks
    // alongside regular text blocks. extractAssistantText must only return text.
    const msg = {
      role: "assistant",
      content: [
        { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "test" } },
        { type: "web_search_tool_result", content: [{ type: "text", text: "result data" }] },
        { type: "text", text: "Based on the search results, here is the answer." },
      ],
      timestamp: Date.now(),
    } as unknown as AssistantMessage;

    const text = extractAssistantText(msg);
    expect(text).toBe("Based on the search results, here is the answer.");
    expect(text).not.toContain("web_search");
    expect(text).not.toContain("result data");
  });

  it("returns empty string when only server tool blocks exist (no text)", () => {
    const msg = {
      role: "assistant",
      content: [
        { type: "server_tool_use", id: "srvtoolu_1", name: "web_fetch", input: { url: "https://example.com" } },
        { type: "web_fetch_tool_result", content: "fetched content" },
      ],
      timestamp: Date.now(),
    } as unknown as AssistantMessage;

    const text = extractAssistantText(msg);
    expect(text).toBe("");
  });
});

describe("pi-ai patch verification", () => {
  const anthropicPath = path.resolve(
    import.meta.dirname,
    "../../../node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js",
  );

  it("patched anthropic.js contains server_tool_use handling in content_block_start", () => {
    const code = fs.readFileSync(anthropicPath, "utf8");
    expect(code).toContain('event.content_block.type === "server_tool_use"');
  });

  it("patched anthropic.js contains web_search_tool_result handling", () => {
    const code = fs.readFileSync(anthropicPath, "utf8");
    expect(code).toContain('"web_search_tool_result"');
  });

  it("patched anthropic.js contains web_fetch_tool_result handling", () => {
    const code = fs.readFileSync(anthropicPath, "utf8");
    expect(code).toContain('"web_fetch_tool_result"');
  });

  it("patched anthropic.js stores server_tool_use with correct type (not toolCall)", () => {
    const code = fs.readFileSync(anthropicPath, "utf8");
    // Verify server_tool_use blocks are stored with type: "server_tool_use" (not "toolCall")
    // to prevent client-side execution by pi-agent-core
    expect(code).toContain('type: "server_tool_use",');
  });

  it("patched anthropic.js handles server_tool_use input_json_delta", () => {
    const code = fs.readFileSync(anthropicPath, "utf8");
    expect(code).toContain(
      'block.type === "toolCall" || block.type === "server_tool_use"',
    );
  });

  it("patched anthropic.js passes server tool blocks through in convertMessages", () => {
    const code = fs.readFileSync(anthropicPath, "utf8");
    // Check that convertMessages includes server_tool_use passthrough
    const convertIdx = code.indexOf("function convertMessages");
    const afterConvert = code.slice(convertIdx);
    expect(afterConvert).toContain('block.type === "server_tool_use"');
    expect(afterConvert).toContain('block.type === "web_search_tool_result"');
  });
});
