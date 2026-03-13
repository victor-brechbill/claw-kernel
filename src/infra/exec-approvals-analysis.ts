import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExecAllowlistEntry } from "./exec-approvals.js";
import { splitShellArgs } from "../utils/shell-argv.js";

export const DEFAULT_SAFE_BINS = ["jq", "grep", "cut", "sort", "uniq", "head", "tail", "tr", "wc"];

// ── Unicode normalization ──────────────────────────────────────────────
// Zero-width and invisible characters that can be used to obfuscate commands
// in approval prompts or bypass allowlist matching.
const ZERO_WIDTH_RE =
  /[\u200B-\u200F\u2060\uFEFF]/g;

// Fullwidth ASCII range: U+FF01 (！) – U+FF5E (～) → normal ASCII 0x21–0x7E
const FULLWIDTH_RE = /[\uFF01-\uFF5E]/g;

// Invisible format/control chars (Unicode Cf/Cc) that are NOT normal whitespace.
// We escape these as [U+XXXX] so they are visible in approval prompts.
// Range covers common Cf chars; excludes \t \n \r and space.
const INVISIBLE_FORMAT_RE = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u00AD\\u034F\\u061C\\u070F\\u17B4\\u17B5\\u180B-\\u180E\\u200A\\u2028\\u2029\\u202A-\\u202E\\u2061-\\u2069\\u206A-\\u206F\\uFFF0-\\uFFF8]",
  "g",
);

/**
 * Normalizes a command string to prevent Unicode obfuscation attacks.
 *
 * 1. Strips zero-width characters (U+200B–U+200F, U+2060, U+FEFF)
 * 2. Converts fullwidth ASCII (U+FF01–U+FF5E) to standard ASCII
 * 3. Escapes remaining invisible format/control chars as [U+XXXX]
 *
 * Must be called BEFORE approval prompt display AND before allowlist matching.
 */
export function normalizeExecCommand(cmd: string): string {
  // Step 1: strip zero-width chars
  let result = cmd.replace(ZERO_WIDTH_RE, "");

  // Step 2: fullwidth ASCII → normal ASCII (subtract 0xFEE0)
  result = result.replace(FULLWIDTH_RE, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );

  // Step 3: escape remaining invisible format/control chars
  result = result.replace(INVISIBLE_FORMAT_RE, (ch) => {
    const hex = ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `[U+${hex}]`;
  });

  return result;
}

function expandHome(value: string): string {
  if (!value) {
    return value;
  }
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

export type CommandResolution = {
  rawExecutable: string;
  resolvedPath?: string;
  executableName: string;
};

function isExecutableFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return false;
    }
    if (process.platform !== "win32") {
      fs.accessSync(filePath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

function parseFirstToken(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) {
    return null;
  }
  const first = trimmed[0];
  if (first === '"' || first === "'") {
    const end = trimmed.indexOf(first, 1);
    if (end > 1) {
      return trimmed.slice(1, end);
    }
    return trimmed.slice(1);
  }
  const match = /^[^\s]+/.exec(trimmed);
  return match ? match[0] : null;
}

function resolveExecutablePath(rawExecutable: string, cwd?: string, env?: NodeJS.ProcessEnv) {
  const expanded = rawExecutable.startsWith("~") ? expandHome(rawExecutable) : rawExecutable;
  if (expanded.includes("/") || expanded.includes("\\")) {
    if (path.isAbsolute(expanded)) {
      return isExecutableFile(expanded) ? expanded : undefined;
    }
    const base = cwd && cwd.trim() ? cwd.trim() : process.cwd();
    const candidate = path.resolve(base, expanded);
    return isExecutableFile(candidate) ? candidate : undefined;
  }
  const envPath = env?.PATH ?? env?.Path ?? process.env.PATH ?? process.env.Path ?? "";
  const entries = envPath.split(path.delimiter).filter(Boolean);
  const hasExtension = process.platform === "win32" && path.extname(expanded).length > 0;
  const extensions =
    process.platform === "win32"
      ? hasExtension
        ? [""]
        : (
            env?.PATHEXT ??
            env?.Pathext ??
            process.env.PATHEXT ??
            process.env.Pathext ??
            ".EXE;.CMD;.BAT;.COM"
          )
            .split(";")
            .map((ext) => ext.toLowerCase())
      : [""];
  for (const entry of entries) {
    for (const ext of extensions) {
      const candidate = path.join(entry, expanded + ext);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

export function resolveCommandResolution(
  command: string,
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): CommandResolution | null {
  const rawExecutable = parseFirstToken(command);
  if (!rawExecutable) {
    return null;
  }
  const resolvedPath = resolveExecutablePath(rawExecutable, cwd, env);
  const executableName = resolvedPath ? path.basename(resolvedPath) : rawExecutable;
  return { rawExecutable, resolvedPath, executableName };
}

export function resolveCommandResolutionFromArgv(
  argv: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): CommandResolution | null {
  const rawExecutable = argv[0]?.trim();
  if (!rawExecutable) {
    return null;
  }
  const resolvedPath = resolveExecutablePath(rawExecutable, cwd, env);
  const executableName = resolvedPath ? path.basename(resolvedPath) : rawExecutable;
  return { rawExecutable, resolvedPath, executableName };
}

function normalizeMatchTarget(value: string): string {
  if (process.platform === "win32") {
    const stripped = value.replace(/^\\\\[?.]\\/, "");
    return stripped.replace(/\\/g, "/").toLowerCase();
  }
  // Case-sensitive on Linux — do NOT lowercase
  return value.replace(/\\\\/g, "/");
}

function tryRealpath(value: string): string | null {
  try {
    return fs.realpathSync(value);
  } catch {
    return null;
  }
}

function globToRegExp(pattern: string): RegExp {
  let regex = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      const next = pattern[i + 1];
      if (next === "*") {
        regex += ".*";
        i += 2;
        continue;
      }
      regex += "[^/]*";
      i += 1;
      continue;
    }
    if (ch === "?") {
      // ? must stay within a single path segment (must not match /)
      regex += "[^/]";
      i += 1;
      continue;
    }
    regex += ch.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
    i += 1;
  }
  regex += "$";
  // Case-sensitive on Linux; case-insensitive only on Windows
  const flags = process.platform === "win32" ? "i" : "";
  return new RegExp(regex, flags);
}

function matchesPattern(pattern: string, target: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return false;
  }
  const expanded = trimmed.startsWith("~") ? expandHome(trimmed) : trimmed;
  const hasWildcard = /[*?]/.test(expanded);
  let normalizedPattern = expanded;
  let normalizedTarget = target;
  if (process.platform === "win32" && !hasWildcard) {
    normalizedPattern = tryRealpath(expanded) ?? expanded;
    normalizedTarget = tryRealpath(target) ?? target;
  }
  normalizedPattern = normalizeMatchTarget(normalizedPattern);
  normalizedTarget = normalizeMatchTarget(normalizedTarget);
  const regex = globToRegExp(normalizedPattern);
  return regex.test(normalizedTarget);
}

export function resolveAllowlistCandidatePath(
  resolution: CommandResolution | null,
  cwd?: string,
): string | undefined {
  if (!resolution) {
    return undefined;
  }
  if (resolution.resolvedPath) {
    return resolution.resolvedPath;
  }
  const raw = resolution.rawExecutable?.trim();
  if (!raw) {
    return undefined;
  }
  const expanded = raw.startsWith("~") ? expandHome(raw) : raw;
  if (!expanded.includes("/") && !expanded.includes("\\")) {
    return undefined;
  }
  if (path.isAbsolute(expanded)) {
    return expanded;
  }
  const base = cwd && cwd.trim() ? cwd.trim() : process.cwd();
  return path.resolve(base, expanded);
}

export function matchAllowlist(
  entries: ExecAllowlistEntry[],
  resolution: CommandResolution | null,
): ExecAllowlistEntry | null {
  if (!entries.length || !resolution?.resolvedPath) {
    return null;
  }
  const resolvedPath = resolution.resolvedPath;
  for (const entry of entries) {
    const pattern = entry.pattern?.trim();
    if (!pattern) {
      continue;
    }
    const hasPath = pattern.includes("/") || pattern.includes("\\") || pattern.includes("~");
    if (!hasPath) {
      continue;
    }
    if (matchesPattern(pattern, resolvedPath)) {
      return entry;
    }
  }
  return null;
}

export type ExecCommandSegment = {
  raw: string;
  argv: string[];
  resolution: CommandResolution | null;
};

export type ExecCommandAnalysis = {
  ok: boolean;
  reason?: string;
  segments: ExecCommandSegment[];
  chains?: ExecCommandSegment[][]; // Segments grouped by chain operator (&&, ||, ;)
};

export type ShellChainOperator = "&&" | "||" | ";";

export type ShellChainPart = {
  part: string;
  opToNext: ShellChainOperator | null;
};

const DISALLOWED_PIPELINE_TOKENS = new Set([">", "<", "`", "\n", "\r", "(", ")"]);
const DOUBLE_QUOTE_ESCAPES = new Set(["\\", '"', "$", "`", "\n", "\r"]);
const WINDOWS_UNSUPPORTED_TOKENS = new Set([
  "&",
  "|",
  "<",
  ">",
  "^",
  "(",
  ")",
  "%",
  "!",
  "\n",
  "\r",
]);

function isDoubleQuoteEscape(next: string | undefined): next is string {
  return Boolean(next && DOUBLE_QUOTE_ESCAPES.has(next));
}

function splitShellPipeline(command: string): { ok: boolean; reason?: string; segments: string[] } {
  type HeredocSpec = {
    delimiter: string;
    stripTabs: boolean;
  };

  const parseHeredocDelimiter = (
    source: string,
    start: number,
  ): { delimiter: string; end: number } | null => {
    let i = start;
    while (i < source.length && (source[i] === " " || source[i] === "\t")) {
      i += 1;
    }
    if (i >= source.length) {
      return null;
    }

    const first = source[i];
    if (first === "'" || first === '"') {
      const quote = first;
      i += 1;
      let delimiter = "";
      while (i < source.length) {
        const ch = source[i];
        if (ch === "\n" || ch === "\r") {
          return null;
        }
        if (quote === '"' && ch === "\\" && i + 1 < source.length) {
          delimiter += source[i + 1];
          i += 2;
          continue;
        }
        if (ch === quote) {
          return { delimiter, end: i + 1 };
        }
        delimiter += ch;
        i += 1;
      }
      return null;
    }

    let delimiter = "";
    while (i < source.length) {
      const ch = source[i];
      if (/\s/.test(ch) || ch === "|" || ch === "&" || ch === ";" || ch === "<" || ch === ">") {
        break;
      }
      delimiter += ch;
      i += 1;
    }
    if (!delimiter) {
      return null;
    }
    return { delimiter, end: i };
  };

  const segments: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let emptySegment = false;
  const pendingHeredocs: HeredocSpec[] = [];
  let inHeredocBody = false;
  let heredocLine = "";

  const pushPart = () => {
    const trimmed = buf.trim();
    if (trimmed) {
      segments.push(trimmed);
    }
    buf = "";
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];

    if (inHeredocBody) {
      if (ch === "\n" || ch === "\r") {
        const current = pendingHeredocs[0];
        if (current) {
          const line = current.stripTabs ? heredocLine.replace(/^\t+/, "") : heredocLine;
          if (line === current.delimiter) {
            pendingHeredocs.shift();
          }
        }
        heredocLine = "";
        if (pendingHeredocs.length === 0) {
          inHeredocBody = false;
        }
        if (ch === "\r" && next === "\n") {
          i += 1;
        }
      } else {
        heredocLine += ch;
      }
      continue;
    }

    if (escaped) {
      buf += ch;
      escaped = false;
      emptySegment = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      buf += ch;
      emptySegment = false;
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      buf += ch;
      emptySegment = false;
      continue;
    }
    if (inDouble) {
      if (ch === "\\" && isDoubleQuoteEscape(next)) {
        buf += ch;
        buf += next;
        i += 1;
        emptySegment = false;
        continue;
      }
      if (ch === "$" && next === "(") {
        return { ok: false, reason: "unsupported shell token: $()", segments: [] };
      }
      if (ch === "`") {
        return { ok: false, reason: "unsupported shell token: `", segments: [] };
      }
      if (ch === "\n" || ch === "\r") {
        return { ok: false, reason: "unsupported shell token: newline", segments: [] };
      }
      if (ch === '"') {
        inDouble = false;
      }
      buf += ch;
      emptySegment = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      emptySegment = false;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      emptySegment = false;
      continue;
    }

    if ((ch === "\n" || ch === "\r") && pendingHeredocs.length > 0) {
      inHeredocBody = true;
      heredocLine = "";
      if (ch === "\r" && next === "\n") {
        i += 1;
      }
      continue;
    }

    if (ch === "|" && next === "|") {
      return { ok: false, reason: "unsupported shell token: ||", segments: [] };
    }
    if (ch === "|" && next === "&") {
      return { ok: false, reason: "unsupported shell token: |&", segments: [] };
    }
    if (ch === "|") {
      emptySegment = true;
      pushPart();
      continue;
    }
    if (ch === "&" || ch === ";") {
      return { ok: false, reason: `unsupported shell token: ${ch}`, segments: [] };
    }
    if (ch === "<" && next === "<") {
      buf += "<<";
      emptySegment = false;
      i += 1;

      let scanIndex = i + 1;
      let stripTabs = false;
      if (command[scanIndex] === "-") {
        stripTabs = true;
        buf += "-";
        scanIndex += 1;
      }

      const parsed = parseHeredocDelimiter(command, scanIndex);
      if (parsed) {
        pendingHeredocs.push({ delimiter: parsed.delimiter, stripTabs });
        buf += command.slice(scanIndex, parsed.end);
        i = parsed.end - 1;
      }
      continue;
    }
    if (DISALLOWED_PIPELINE_TOKENS.has(ch)) {
      return { ok: false, reason: `unsupported shell token: ${ch}`, segments: [] };
    }
    if (ch === "$" && next === "(") {
      return { ok: false, reason: "unsupported shell token: $()", segments: [] };
    }
    buf += ch;
    emptySegment = false;
  }

  if (inHeredocBody && pendingHeredocs.length > 0) {
    const current = pendingHeredocs[0];
    const line = current.stripTabs ? heredocLine.replace(/^\t+/, "") : heredocLine;
    if (line === current.delimiter) {
      pendingHeredocs.shift();
    }
  }

  if (escaped || inSingle || inDouble) {
    return { ok: false, reason: "unterminated shell quote/escape", segments: [] };
  }

  pushPart();
  if (emptySegment || segments.length === 0) {
    return {
      ok: false,
      reason: segments.length === 0 ? "empty command" : "empty pipeline segment",
      segments: [],
    };
  }
  return { ok: true, segments };
}

function findWindowsUnsupportedToken(command: string): string | null {
  for (const ch of command) {
    if (WINDOWS_UNSUPPORTED_TOKENS.has(ch)) {
      if (ch === "\n" || ch === "\r") {
        return "newline";
      }
      return ch;
    }
  }
  return null;
}

function tokenizeWindowsSegment(segment: string): string[] | null {
  const tokens: string[] = [];
  let buf = "";
  let inDouble = false;

  const pushToken = () => {
    if (buf.length > 0) {
      tokens.push(buf);
      buf = "";
    }
  };

  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inDouble && /\s/.test(ch)) {
      pushToken();
      continue;
    }
    buf += ch;
  }

  if (inDouble) {
    return null;
  }
  pushToken();
  return tokens.length > 0 ? tokens : null;
}

function analyzeWindowsShellCommand(params: {
  command: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): ExecCommandAnalysis {
  const unsupported = findWindowsUnsupportedToken(params.command);
  if (unsupported) {
    return {
      ok: false,
      reason: `unsupported windows shell token: ${unsupported}`,
      segments: [],
    };
  }
  const argv = tokenizeWindowsSegment(params.command);
  if (!argv || argv.length === 0) {
    return { ok: false, reason: "unable to parse windows command", segments: [] };
  }
  return {
    ok: true,
    segments: [
      {
        raw: params.command,
        argv,
        resolution: resolveCommandResolutionFromArgv(argv, params.cwd, params.env),
      },
    ],
  };
}

export function isWindowsPlatform(platform?: string | null): boolean {
  const normalized = String(platform ?? "")
    .trim()
    .toLowerCase();
  return normalized.startsWith("win");
}

function parseSegmentsFromParts(
  parts: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): ExecCommandSegment[] | null {
  const segments: ExecCommandSegment[] = [];
  for (const raw of parts) {
    const argv = splitShellArgs(raw);
    if (!argv || argv.length === 0) {
      return null;
    }
    segments.push({
      raw,
      argv,
      resolution: resolveCommandResolutionFromArgv(argv, cwd, env),
    });
  }
  return segments;
}

/**
 * Splits a command string by chain operators (&&, ||, ;) while preserving the operators.
 * Returns null when no chain is present or when the chain is malformed.
 */
export function splitCommandChainWithOperators(command: string): ShellChainPart[] | null {
  const parts: ShellChainPart[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let foundChain = false;
  let invalidChain = false;

  const pushPart = (opToNext: ShellChainOperator | null) => {
    const trimmed = buf.trim();
    buf = "";
    if (!trimmed) {
      return false;
    }
    parts.push({ part: trimmed, opToNext });
    return true;
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];
    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      buf += ch;
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      buf += ch;
      continue;
    }
    if (inDouble) {
      if (ch === "\\" && isDoubleQuoteEscape(next)) {
        buf += ch;
        buf += next;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
      }
      buf += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      continue;
    }

    if (ch === "&" && next === "&") {
      if (!pushPart("&&")) {
        invalidChain = true;
      }
      i += 1;
      foundChain = true;
      continue;
    }
    if (ch === "|" && next === "|") {
      if (!pushPart("||")) {
        invalidChain = true;
      }
      i += 1;
      foundChain = true;
      continue;
    }
    if (ch === ";") {
      if (!pushPart(";")) {
        invalidChain = true;
      }
      foundChain = true;
      continue;
    }

    buf += ch;
  }

  if (!foundChain) {
    return null;
  }
  const trimmed = buf.trim();
  if (!trimmed) {
    return null;
  }
  parts.push({ part: trimmed, opToNext: null });
  if (invalidChain || parts.length === 0) {
    return null;
  }
  return parts;
}

function shellEscapeSingleArg(value: string): string {
  // Shell-safe across sh/bash/zsh: single-quote everything, escape embedded single quotes.
  // Example: foo'bar -> 'foo'"'"'bar'
  const singleQuoteEscape = `'"'"'`;
  return `'${value.replace(/'/g, singleQuoteEscape)}'`;
}

/**
 * Builds a shell command string that preserves pipes/chaining, but forces *arguments* to be
 * literal (no globbing, no env-var expansion) by single-quoting every argv token.
 *
 * Used to make "safe bins" actually stdin-only even though execution happens via `shell -c`.
 */
export function buildSafeShellCommand(params: { command: string; platform?: string | null }): {
  ok: boolean;
  command?: string;
  reason?: string;
} {
  const platform = params.platform ?? null;
  if (isWindowsPlatform(platform)) {
    return { ok: false, reason: "unsupported platform" };
  }
  const source = params.command.trim();
  if (!source) {
    return { ok: false, reason: "empty command" };
  }

  const chain = splitCommandChainWithOperators(source);
  const chainParts = chain ?? [{ part: source, opToNext: null }];
  let out = "";

  for (let i = 0; i < chainParts.length; i += 1) {
    const part = chainParts[i];
    const pipelineSplit = splitShellPipeline(part.part);
    if (!pipelineSplit.ok) {
      return { ok: false, reason: pipelineSplit.reason ?? "unable to parse pipeline" };
    }
    const renderedSegments: string[] = [];
    for (const segmentRaw of pipelineSplit.segments) {
      const argv = splitShellArgs(segmentRaw);
      if (!argv || argv.length === 0) {
        return { ok: false, reason: "unable to parse shell segment" };
      }
      renderedSegments.push(argv.map((token) => shellEscapeSingleArg(token)).join(" "));
    }
    out += renderedSegments.join(" | ");
    if (part.opToNext) {
      out += ` ${part.opToNext} `;
    }
  }

  return { ok: true, command: out };
}

function renderQuotedArgv(argv: string[]): string {
  return argv.map((token) => shellEscapeSingleArg(token)).join(" ");
}

/**
 * Rebuilds a shell command and selectively single-quotes argv tokens for segments that
 * must be treated as literal (safeBins hardening) while preserving the rest of the
 * shell syntax (pipes + chaining).
 */
export function buildSafeBinsShellCommand(params: {
  command: string;
  segments: ExecCommandSegment[];
  segmentSatisfiedBy: ("allowlist" | "safeBins" | "skills" | null)[];
  platform?: string | null;
}): { ok: boolean; command?: string; reason?: string } {
  const platform = params.platform ?? null;
  if (isWindowsPlatform(platform)) {
    return { ok: false, reason: "unsupported platform" };
  }
  if (params.segments.length !== params.segmentSatisfiedBy.length) {
    return { ok: false, reason: "segment metadata mismatch" };
  }

  const chain = splitCommandChainWithOperators(params.command.trim());
  const chainParts: ShellChainPart[] = chain ?? [{ part: params.command.trim(), opToNext: null }];
  let segIndex = 0;
  let out = "";

  for (const part of chainParts) {
    const pipelineSplit = splitShellPipeline(part.part);
    if (!pipelineSplit.ok) {
      return { ok: false, reason: pipelineSplit.reason ?? "unable to parse pipeline" };
    }

    const rendered: string[] = [];
    for (const raw of pipelineSplit.segments) {
      const seg = params.segments[segIndex];
      const by = params.segmentSatisfiedBy[segIndex];
      if (!seg || by === undefined) {
        return { ok: false, reason: "segment mapping failed" };
      }
      const needsLiteral = by === "safeBins";
      rendered.push(needsLiteral ? renderQuotedArgv(seg.argv) : raw.trim());
      segIndex += 1;
    }

    out += rendered.join(" | ");
    if (part.opToNext) {
      out += ` ${part.opToNext} `;
    }
  }

  if (segIndex !== params.segments.length) {
    return { ok: false, reason: "segment count mismatch" };
  }

  return { ok: true, command: out };
}

/**
 * Splits a command string by chain operators (&&, ||, ;) while respecting quotes.
 * Returns null when no chain is present or when the chain is malformed.
 */
export function splitCommandChain(command: string): string[] | null {
  const parts = splitCommandChainWithOperators(command);
  if (!parts) {
    return null;
  }
  return parts.map((p) => p.part);
}

export function analyzeShellCommand(params: {
  command: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  platform?: string | null;
}): ExecCommandAnalysis {
  if (isWindowsPlatform(params.platform)) {
    return analyzeWindowsShellCommand(params);
  }
  // First try splitting by chain operators (&&, ||, ;)
  const chainParts = splitCommandChain(params.command);
  if (chainParts) {
    const chains: ExecCommandSegment[][] = [];
    const allSegments: ExecCommandSegment[] = [];

    for (const part of chainParts) {
      const pipelineSplit = splitShellPipeline(part);
      if (!pipelineSplit.ok) {
        return { ok: false, reason: pipelineSplit.reason, segments: [] };
      }
      const segments = parseSegmentsFromParts(pipelineSplit.segments, params.cwd, params.env);
      if (!segments) {
        return { ok: false, reason: "unable to parse shell segment", segments: [] };
      }
      chains.push(segments);
      allSegments.push(...segments);
    }

    return { ok: true, segments: allSegments, chains };
  }

  // No chain operators, parse as simple pipeline
  const split = splitShellPipeline(params.command);
  if (!split.ok) {
    return { ok: false, reason: split.reason, segments: [] };
  }
  const segments = parseSegmentsFromParts(split.segments, params.cwd, params.env);
  if (!segments) {
    return { ok: false, reason: "unable to parse shell segment", segments: [] };
  }
  return { ok: true, segments };
}

export function analyzeArgvCommand(params: {
  argv: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): ExecCommandAnalysis {
  const argv = params.argv.filter((entry) => entry.trim().length > 0);
  if (argv.length === 0) {
    return { ok: false, reason: "empty argv", segments: [] };
  }
  return {
    ok: true,
    segments: [
      {
        raw: argv.join(" "),
        argv,
        resolution: resolveCommandResolutionFromArgv(argv, params.cwd, params.env),
      },
    ],
  };
}

// ── Exec approval binding hardening ────────────────────────────────────

// POSIX shell flags that consume the next argument as a value
const POSIX_SHELL_VALUE_FLAGS = new Set(["-c"]);

// Shells where `-c` binds the real script
const KNOWN_SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish", "ash"]);

/**
 * Unwraps pnpm runtime wrappers to reveal the actual command being executed.
 *
 * Detects:
 * - `pnpm --reporter ... exec <cmd>` → rebinds to `<cmd>`
 * - `pnpm node <script>` → rebinds to `node <script>`
 */
export function unwrapPnpmCommand(
  argv: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): { unwrapped: true; argv: string[]; resolution: CommandResolution | null } | null {
  if (argv.length < 2) {
    return null;
  }
  const bin = path.basename(argv[0] ?? "").toLowerCase();
  if (bin !== "pnpm" && bin !== "pnpm.exe" && bin !== "pnpm.cmd") {
    return null;
  }

  // Skip pnpm flags until we find a subcommand
  let i = 1;
  while (i < argv.length) {
    const token = argv[i];
    if (!token) {break;}
    // Skip --reporter=... / --reporter ...
    if (token.startsWith("--")) {
      if (token.includes("=")) {
        i += 1;
        continue;
      }
      // Flags like --reporter take next arg as value
      if (token === "--reporter" || token === "--filter" || token === "--dir") {
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    break;
  }

  if (i >= argv.length) {
    return null;
  }

  const subcommand = argv[i];
  if (subcommand === "exec" && i + 1 < argv.length) {
    const innerArgv = argv.slice(i + 1);
    return {
      unwrapped: true,
      argv: innerArgv,
      resolution: resolveCommandResolutionFromArgv(innerArgv, cwd, env),
    };
  }
  if (subcommand === "node" && i + 1 < argv.length) {
    const innerArgv = ["node", ...argv.slice(i + 1)];
    return {
      unwrapped: true,
      argv: innerArgv,
      resolution: resolveCommandResolutionFromArgv(innerArgv, cwd, env),
    };
  }

  return null;
}

/**
 * Checks whether a segment requires mandatory approval (fail-closed).
 *
 * Returns a reason string if the segment must require approval, or null if safe.
 *
 * Detects:
 * - Perl `-M`/`-I` flags (module injection)
 * - Ruby `-r`/`--require`/`-I` flags (require injection)
 * - Inline loaders (node -e, python -c, etc.)
 * - Ambiguous shell payloads
 * - After POSIX shell `-c`, binds the real script as the segment command
 */
export function checkSegmentRequiresApproval(segment: ExecCommandSegment): string | null {
  const resolution = segment.resolution;
  if (!resolution) {
    return null;
  }
  const execName = resolution.executableName?.toLowerCase() ?? "";
  const argv = segment.argv;

  // Perl: -M (load module), -I (include path) — code injection vectors
  if (execName === "perl" || execName === "perl.exe") {
    for (const arg of argv.slice(1)) {
      if (arg.startsWith("-M") || arg.startsWith("-I") || arg === "-I" || arg === "-M") {
        return `perl flag "${arg}" may inject code`;
      }
    }
  }

  // Ruby: -r/--require (load library), -I (include path) — code injection vectors
  if (execName === "ruby" || execName === "ruby.exe") {
    for (const arg of argv.slice(1)) {
      if (
        arg === "-r" ||
        arg.startsWith("-r") ||
        arg === "--require" ||
        arg === "-I" ||
        arg.startsWith("-I")
      ) {
        return `ruby flag "${arg}" may inject code`;
      }
    }
  }

  // Inline loaders: node -e, python -c, ruby -e, perl -e/-E
  const INLINE_EXEC_BINS: Record<string, string[]> = {
    node: ["-e", "--eval", "--input-type"],
    python: ["-c"],
    python3: ["-c"],
    ruby: ["-e"],
    perl: ["-e", "-E"],
  };
  const inlineFlags = INLINE_EXEC_BINS[execName];
  if (inlineFlags) {
    for (const arg of argv.slice(1)) {
      if (inlineFlags.some((f) => arg === f || (f.startsWith("--") ? arg.startsWith(f + "=") : false))) {
        return `inline code execution via ${execName} "${arg}"`;
      }
    }
  }

  // POSIX shell -c binding: after `sh -c '...'`, the script IS the command
  if (KNOWN_SHELLS.has(execName)) {
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (arg && POSIX_SHELL_VALUE_FLAGS.has(arg)) {
        // The next argument is the actual script — mark as needing approval
        // because the shell is just a wrapper and the real payload is the script
        return `shell -c payload requires approval`;
      }
    }
  }

  return null;
}
