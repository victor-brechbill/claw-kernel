import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import { log } from "./logger.js";

/**
 * Known Anthropic server tool type strings mapped to their API tool names.
 * Keys are the full versioned type strings; values are the short names the API expects.
 */
const KNOWN_SERVER_TOOLS: Record<string, string> = {
  web_search_20260209: "web_search",
  web_fetch_20260209: "web_fetch",
};

/**
 * Resolve configured server tools from OpenClawConfig.
 * Returns undefined if no server tools are configured.
 */
export function resolveServerTools(cfg: OpenClawConfig | undefined): string[] | undefined {
  const raw = cfg?.tools?.serverTools;
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const valid = raw.filter((s) => typeof s === "string" && s.trim().length > 0);
  return valid.length > 0 ? valid : undefined;
}

function isAnthropicModel(model: Model<Api> | undefined | null): boolean {
  return (model as { api?: unknown })?.api === "anthropic-messages";
}

/**
 * Build Anthropic API server tool definition objects from tool type strings.
 *
 * Uses the known tools lookup table for the `name` field.
 * For unknown tool types, derives the name by stripping the `_YYYYMMDD` date suffix.
 *
 * @internal Exported for testing only.
 */
export function buildServerToolDefinitions(toolTypes: string[]): { type: string; name: string }[] {
  return toolTypes.map((toolType) => {
    const known = KNOWN_SERVER_TOOLS[toolType];
    const name = known ?? toolType.replace(/_\d{8}$/, "");
    return { type: toolType, name };
  });
}

/**
 * Create a StreamFn wrapper that injects Anthropic server tool definitions
 * into the API payload via the `onPayload` callback.
 *
 * Only activates for models with `api === "anthropic-messages"`.
 * Non-Anthropic models pass through unmodified.
 */
export function createServerToolsStreamFnWrapper(
  baseStreamFn: StreamFn,
  serverToolTypes: string[],
): StreamFn {
  const defs = buildServerToolDefinitions(serverToolTypes);
  log.debug(
    `server tools wrapper: will inject ${defs.length} tool(s): ${serverToolTypes.join(", ")}`,
  );

  return (model, context, options) => {
    if (!isAnthropicModel(model)) {
      return baseStreamFn(model, context, options);
    }

    const originalOnPayload = options?.onPayload;
    return baseStreamFn(model, context, {
      ...options,
      onPayload: (payload) => {
        if (payload && typeof payload === "object") {
          const p = payload as { tools?: unknown[] };
          if (!Array.isArray(p.tools)) {
            p.tools = [];
          }
          p.tools.push(...defs);
          log.debug(`server tools: injected ${defs.length} definition(s) into payload`);
        }
        originalOnPayload?.(payload);
      },
    });
  };
}
