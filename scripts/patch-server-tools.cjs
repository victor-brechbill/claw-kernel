#!/usr/bin/env node
// patch-server-tools.js — Patch pi-ai to handle Anthropic server-side tool content blocks.
// Called by patch-server-tools.sh (postinstall).
//
// Patches node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js to:
// A) Store server_tool_use, web_search_tool_result, web_fetch_tool_result blocks in output.content
// B) Accumulate input_json_delta for server_tool_use blocks
// C) Clean up server tool blocks on content_block_stop
// D) Pass server tool blocks through in convertMessages (history replay)

const fs = require("fs");
const path = require("path");

const anthroPath = process.argv[2];
if (!anthroPath || !fs.existsSync(anthroPath)) {
  console.error("  ⚠️  anthropic.js not found at:", anthroPath);
  process.exit(0);
}

let code = fs.readFileSync(anthroPath, "utf8");

if (code.includes("server_tool_use")) {
  console.log("  ℹ️  anthropic.js already patched for server tools");
  process.exit(0);
}

let patchCount = 0;

// ---------------------------------------------------------------------------
// Patch A: content_block_start — handle server_tool_use and result blocks
// ---------------------------------------------------------------------------
// Anchor: the closing of the tool_use branch + closing of content_block_start
const patchA_anchor = [
  `                        stream.push({ type: "toolcall_start", contentIndex: output.content.length - 1, partial: output });`,
  `                    }`,
  `                }`,
].join("\n");

const patchA_insert = [
  `                        stream.push({ type: "toolcall_start", contentIndex: output.content.length - 1, partial: output });`,
  `                    }`,
  `                    else if (event.content_block.type === "server_tool_use") {`,
  `                        const block = {`,
  `                            type: "server_tool_use",`,
  `                            id: event.content_block.id,`,
  `                            name: event.content_block.name,`,
  `                            input: {},`,
  `                            partialJson: "",`,
  `                            index: event.index,`,
  `                        };`,
  `                        output.content.push(block);`,
  `                    }`,
  `                    else if (event.content_block.type === "web_search_tool_result" || event.content_block.type === "web_fetch_tool_result") {`,
  `                        const block = Object.assign({}, event.content_block, { index: event.index });`,
  `                        output.content.push(block);`,
  `                    }`,
  `                }`,
].join("\n");

if (code.includes(patchA_anchor)) {
  code = code.replace(patchA_anchor, patchA_insert);
  patchCount++;
  console.log("  ✅ Patch A: content_block_start — server tool blocks stored");
} else {
  console.error("  ❌ Patch A: anchor not found — content_block_start");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Patch B: content_block_delta — accumulate input_json_delta for server_tool_use
// ---------------------------------------------------------------------------
const patchB_anchor = `if (block && block.type === "toolCall") {`;
const patchB_replace = `if (block && (block.type === "toolCall" || block.type === "server_tool_use")) {`;

if (code.includes(patchB_anchor)) {
  // Replace only the first occurrence (in content_block_delta handler)
  code = code.replace(patchB_anchor, patchB_replace);
  patchCount++;
  console.log("  ✅ Patch B: content_block_delta — server_tool_use input accumulation");
} else {
  console.error("  ❌ Patch B: anchor not found — input_json_delta");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Patch C: content_block_stop — clean up server tool blocks
// ---------------------------------------------------------------------------
const patchC_anchor = [
  `                        else if (block.type === "toolCall") {`,
  `                            block.arguments = parseStreamingJson(block.partialJson);`,
  `                            delete block.partialJson;`,
  `                            stream.push({`,
  `                                type: "toolcall_end",`,
  `                                contentIndex: index,`,
  `                                toolCall: block,`,
  `                                partial: output,`,
  `                            });`,
  `                        }`,
  `                    }`,
  `                }`,
].join("\n");

const patchC_replace = [
  `                        else if (block.type === "toolCall") {`,
  `                            block.arguments = parseStreamingJson(block.partialJson);`,
  `                            delete block.partialJson;`,
  `                            stream.push({`,
  `                                type: "toolcall_end",`,
  `                                contentIndex: index,`,
  `                                toolCall: block,`,
  `                                partial: output,`,
  `                            });`,
  `                        }`,
  `                        else if (block.type === "server_tool_use") {`,
  `                            block.input = parseStreamingJson(block.partialJson || "{}");`,
  `                            delete block.partialJson;`,
  `                        }`,
  `                        else if (block.type === "web_search_tool_result" || block.type === "web_fetch_tool_result") {`,
  `                            // Result blocks are complete — no extra cleanup needed`,
  `                        }`,
  `                    }`,
  `                }`,
].join("\n");

if (code.includes(patchC_anchor)) {
  code = code.replace(patchC_anchor, patchC_replace);
  patchCount++;
  console.log("  ✅ Patch C: content_block_stop — server tool block cleanup");
} else {
  console.error("  ❌ Patch C: anchor not found — content_block_stop");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Patch D: convertMessages — pass server tool blocks through for history replay
// ---------------------------------------------------------------------------
const patchD_anchor = [
  `                else if (block.type === "toolCall") {`,
  `                    blocks.push({`,
  `                        type: "tool_use",`,
  `                        id: block.id,`,
  `                        name: isOAuthToken ? toClaudeCodeName(block.name) : block.name,`,
  `                        input: block.arguments ?? {},`,
  `                    });`,
  `                }`,
].join("\n");

const patchD_replace = [
  `                else if (block.type === "toolCall") {`,
  `                    blocks.push({`,
  `                        type: "tool_use",`,
  `                        id: block.id,`,
  `                        name: isOAuthToken ? toClaudeCodeName(block.name) : block.name,`,
  `                        input: block.arguments ?? {},`,
  `                    });`,
  `                }`,
  `                else if (block.type === "server_tool_use") {`,
  `                    blocks.push({`,
  `                        type: "server_tool_use",`,
  `                        id: block.id,`,
  `                        name: block.name,`,
  `                        input: block.input ?? {},`,
  `                    });`,
  `                }`,
  `                else if (block.type === "web_search_tool_result" || block.type === "web_fetch_tool_result") {`,
  `                    blocks.push(block);`,
  `                }`,
].join("\n");

if (code.includes(patchD_anchor)) {
  code = code.replace(patchD_anchor, patchD_replace);
  patchCount++;
  console.log("  ✅ Patch D: convertMessages — server tool history passthrough");
} else {
  console.error("  ❌ Patch D: anchor not found — convertMessages");
  process.exit(1);
}

// Write patched file
fs.writeFileSync(anthroPath, code);
console.log(`  ✅ All ${patchCount} patches applied successfully`);
