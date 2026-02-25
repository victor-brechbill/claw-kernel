import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { extractToolCallsFromAssistant, extractToolResultId } from "./tool-call-id.js";

type ToolCallBlock = {
  type?: unknown;
  id?: unknown;
  name?: unknown;
  input?: unknown;
  arguments?: unknown;
};

function isToolCallBlock(block: unknown): block is ToolCallBlock {
  if (!block || typeof block !== "object") {
    return false;
  }
  const type = (block as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    (type === "toolCall" || type === "toolUse" || type === "functionCall")
  );
}

function hasToolCallInput(block: ToolCallBlock): boolean {
  const hasInput = "input" in block ? block.input !== undefined && block.input !== null : false;
  const hasArguments =
    "arguments" in block ? block.arguments !== undefined && block.arguments !== null : false;
  return hasInput || hasArguments;
}

function hasNonEmptyStringField(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasToolCallId(block: ToolCallBlock): boolean {
  return hasNonEmptyStringField(block.id);
}

function hasToolCallName(block: ToolCallBlock): boolean {
  return hasNonEmptyStringField(block.name);
}

function makeMissingToolResult(params: {
  toolCallId: string;
  toolName?: string;
}): Extract<AgentMessage, { role: "toolResult" }> {
  return {
    role: "toolResult",
    toolCallId: params.toolCallId,
    toolName: params.toolName ?? "unknown",
    content: [
      {
        type: "text",
        text: "[openclaw] missing tool result in session history; inserted synthetic error result for transcript repair.",
      },
    ],
    isError: true,
    timestamp: Date.now(),
  } as Extract<AgentMessage, { role: "toolResult" }>;
}

export { makeMissingToolResult };

export type ToolCallInputRepairReport = {
  messages: AgentMessage[];
  droppedToolCalls: number;
  droppedAssistantMessages: number;
};

export function stripToolResultDetails(messages: AgentMessage[]): AgentMessage[] {
  let touched = false;
  const out: AgentMessage[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object" || (msg as { role?: unknown }).role !== "toolResult") {
      out.push(msg);
      continue;
    }
    if (!("details" in msg)) {
      out.push(msg);
      continue;
    }
    const { details: _details, ...rest } = msg as unknown as Record<string, unknown>;
    touched = true;
    out.push(rest as unknown as AgentMessage);
  }
  return touched ? out : messages;
}

export function repairToolCallInputs(messages: AgentMessage[]): ToolCallInputRepairReport {
  let droppedToolCalls = 0;
  let droppedAssistantMessages = 0;
  let changed = false;
  const out: AgentMessage[] = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      out.push(msg);
      continue;
    }

    if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
      out.push(msg);
      continue;
    }

    const nextContent = [];
    let droppedInMessage = 0;

    for (const block of msg.content) {
      if (
        isToolCallBlock(block) &&
        (!hasToolCallInput(block) || !hasToolCallId(block) || !hasToolCallName(block))
      ) {
        droppedToolCalls += 1;
        droppedInMessage += 1;
        changed = true;
        continue;
      }
      nextContent.push(block);
    }

    if (droppedInMessage > 0) {
      if (nextContent.length === 0) {
        droppedAssistantMessages += 1;
        changed = true;
        continue;
      }
      out.push({ ...msg, content: nextContent });
      continue;
    }

    out.push(msg);
  }

  return {
    messages: changed ? out : messages,
    droppedToolCalls,
    droppedAssistantMessages,
  };
}

export function sanitizeToolCallInputs(messages: AgentMessage[]): AgentMessage[] {
  return repairToolCallInputs(messages).messages;
}

export function sanitizeToolUseResultPairing(messages: AgentMessage[]): AgentMessage[] {
  return repairToolUseResultPairing(messages).messages;
}

export type ToolUseRepairReport = {
  messages: AgentMessage[];
  added: Array<Extract<AgentMessage, { role: "toolResult" }>>;
  droppedDuplicateCount: number;
  droppedOrphanCount: number;
  moved: boolean;
};

export function repairToolUseResultPairing(messages: AgentMessage[]): ToolUseRepairReport {
  // Anthropic (and Cloud Code Assist) reject transcripts where assistant tool calls are not
  // immediately followed by matching tool results. Session files can end up with results
  // displaced (e.g. after user turns) or duplicated. Repair by:
  // - moving matching toolResult messages directly after their assistant toolCall turn
  // - inserting synthetic error toolResults for missing ids
  // - dropping duplicate toolResults for the same id (anywhere in the transcript)
  const out: AgentMessage[] = [];
  const added: Array<Extract<AgentMessage, { role: "toolResult" }>> = [];
  const seenToolResultIds = new Set<string>();
  let droppedDuplicateCount = 0;
  let droppedOrphanCount = 0;
  let moved = false;
  let changed = false;

  const pushToolResult = (msg: Extract<AgentMessage, { role: "toolResult" }>) => {
    const id = extractToolResultId(msg);
    if (id && seenToolResultIds.has(id)) {
      droppedDuplicateCount += 1;
      changed = true;
      return;
    }
    if (id) {
      seenToolResultIds.add(id);
    }
    out.push(msg);
  };

  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") {
      out.push(msg);
      continue;
    }

    const role = (msg as { role?: unknown }).role;
    if (role !== "assistant") {
      // Tool results must only appear directly after the matching assistant tool call turn.
      // Any "free-floating" toolResult entries in session history can make strict providers
      // (Anthropic-compatible APIs, MiniMax, Cloud Code Assist) reject the entire request.
      if (role !== "toolResult") {
        out.push(msg);
      } else {
        droppedOrphanCount += 1;
        changed = true;
      }
      continue;
    }

    const assistant = msg as Extract<AgentMessage, { role: "assistant" }>;

    // Skip tool call extraction for aborted or errored assistant messages.
    // When stopReason is "error" or "aborted", the tool_use blocks may be incomplete
    // (e.g., partialJson: true) and should not have synthetic tool_results created.
    // Creating synthetic results for incomplete tool calls causes API 400 errors:
    // "unexpected tool_use_id found in tool_result blocks"
    // See: https://github.com/openclaw/openclaw/issues/4597
    const stopReason = (assistant as { stopReason?: string }).stopReason;
    if (stopReason === "error" || stopReason === "aborted") {
      out.push(msg);
      continue;
    }

    const toolCalls = extractToolCallsFromAssistant(assistant);
    if (toolCalls.length === 0) {
      out.push(msg);
      continue;
    }

    const toolCallIds = new Set(toolCalls.map((t) => t.id));

    const spanResultsById = new Map<string, Extract<AgentMessage, { role: "toolResult" }>>();
    const remainder: AgentMessage[] = [];

    let j = i + 1;
    for (; j < messages.length; j += 1) {
      const next = messages[j];
      if (!next || typeof next !== "object") {
        remainder.push(next);
        continue;
      }

      const nextRole = (next as { role?: unknown }).role;
      if (nextRole === "assistant") {
        break;
      }

      if (nextRole === "toolResult") {
        const toolResult = next as Extract<AgentMessage, { role: "toolResult" }>;
        const id = extractToolResultId(toolResult);
        if (id && toolCallIds.has(id)) {
          if (seenToolResultIds.has(id)) {
            droppedDuplicateCount += 1;
            changed = true;
            continue;
          }
          if (!spanResultsById.has(id)) {
            spanResultsById.set(id, toolResult);
          }
          continue;
        }
      }

      // Drop tool results that don't match the current assistant tool calls.
      if (nextRole !== "toolResult") {
        remainder.push(next);
      } else {
        droppedOrphanCount += 1;
        changed = true;
      }
    }

    out.push(msg);

    if (spanResultsById.size > 0 && remainder.length > 0) {
      moved = true;
      changed = true;
    }

    for (const call of toolCalls) {
      const existing = spanResultsById.get(call.id);
      if (existing) {
        pushToolResult(existing);
      } else {
        const missing = makeMissingToolResult({
          toolCallId: call.id,
          toolName: call.name,
        });
        added.push(missing);
        changed = true;
        pushToolResult(missing);
      }
    }

    for (const rem of remainder) {
      if (!rem || typeof rem !== "object") {
        out.push(rem);
        continue;
      }
      out.push(rem);
    }
    i = j - 1;
  }

  const changedOrMoved = changed || moved;
  return {
    messages: changedOrMoved ? out : messages,
    added,
    droppedDuplicateCount,
    droppedOrphanCount,
    moved: changedOrMoved,
  };
}

export type AbortedToolCleanupReport = {
  messages: AgentMessage[];
  strippedToolCalls: number;
  strippedToolResults: number;
};

/**
 * Strip incomplete tool_use blocks and their corresponding tool_result blocks
 * when the assistant message has stopReason "error" or "aborted".
 *
 * Context: When a request is aborted mid-tool-call, the assistant message may contain
 * incomplete tool_use blocks (missing closing tags, partial JSON, etc.). If synthetic
 * tool_result blocks were added for these incomplete tool calls (either in this run
 * or a previous run), the Anthropic API rejects the request with:
 * "tool_use with id X was found without a corresponding tool_result block"
 *
 * This function prevents that error by:
 * 1. Identifying assistant messages with stopReason === "error" || "aborted"
 * 2. Extracting tool call IDs from those messages
 * 3. Removing those tool_use blocks from the assistant message content
 * 4. Removing any corresponding tool_result messages
 *
 * Related issues:
 * - https://github.com/openclaw/openclaw/issues/12112
 * - https://github.com/openclaw/openclaw/issues/4597
 */
export function stripAbortedToolCalls(messages: AgentMessage[]): AbortedToolCleanupReport {
  const abortedToolCallIds = new Set<string>();
  let strippedToolCalls = 0;
  let strippedToolResults = 0;
  let changed = false;
  const out: AgentMessage[] = [];

  // First pass: identify and strip incomplete tool calls from aborted/errored assistant messages
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      out.push(msg);
      continue;
    }

    if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
      out.push(msg);
      continue;
    }

    const stopReason = (msg as { stopReason?: string }).stopReason;

    // Only process messages that were aborted or errored
    if (stopReason !== "error" && stopReason !== "aborted") {
      out.push(msg);
      continue;
    }

    // Extract tool calls from this aborted message
    const toolCalls = extractToolCallsFromAssistant(msg);

    if (toolCalls.length === 0) {
      // No tool calls to strip
      out.push(msg);
      continue;
    }

    // Track these tool call IDs for later removal of their results
    for (const call of toolCalls) {
      if (call.id) {
        abortedToolCallIds.add(call.id);
      }
    }

    // Strip all tool_use blocks from this aborted message
    const filteredContent = msg.content.filter((block) => {
      if (isToolCallBlock(block)) {
        strippedToolCalls += 1;
        changed = true;
        return false;
      }
      return true;
    });

    // If all content was tool calls, drop the entire message
    if (filteredContent.length === 0) {
      changed = true;
      continue;
    }

    // Otherwise, keep the message with filtered content
    out.push({ ...msg, content: filteredContent });
  }

  // Second pass: strip any tool_result blocks that reference aborted tool calls
  if (abortedToolCallIds.size > 0) {
    const finalOut: AgentMessage[] = [];

    for (const msg of out) {
      if (!msg || typeof msg !== "object") {
        finalOut.push(msg);
        continue;
      }

      if (msg.role !== "toolResult") {
        finalOut.push(msg);
        continue;
      }

      const toolResult = msg;
      const resultId = extractToolResultId(toolResult);

      if (resultId && abortedToolCallIds.has(resultId)) {
        // This tool_result corresponds to an aborted tool_use - strip it
        strippedToolResults += 1;
        changed = true;
        continue;
      }

      finalOut.push(msg);
    }

    return {
      messages: changed ? finalOut : messages,
      strippedToolCalls,
      strippedToolResults,
    };
  }

  return {
    messages: changed ? out : messages,
    strippedToolCalls,
    strippedToolResults,
  };
}

export function sanitizeAbortedToolCalls(messages: AgentMessage[]): AgentMessage[] {
  return stripAbortedToolCalls(messages).messages;
}
