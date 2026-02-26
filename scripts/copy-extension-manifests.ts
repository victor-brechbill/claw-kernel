#!/usr/bin/env tsx
/**
 * Copy openclaw.plugin.json files from extensions/ to dist/extensions/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const srcExtensions = path.join(projectRoot, "extensions");
const distExtensions = path.join(projectRoot, "dist", "extensions");

function copyExtensionManifests() {
  if (!fs.existsSync(srcExtensions)) {
    console.warn("[copy-extension-manifests] Source directory not found:", srcExtensions);
    return;
  }

  if (!fs.existsSync(distExtensions)) {
    fs.mkdirSync(distExtensions, { recursive: true });
  }

  const entries = fs.readdirSync(srcExtensions, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const extName = entry.name;
    const srcManifest = path.join(srcExtensions, extName, "openclaw.plugin.json");
    const distExtDir = path.join(distExtensions, extName);
    const distManifest = path.join(distExtDir, "openclaw.plugin.json");

    if (!fs.existsSync(srcManifest)) {
      console.warn(`[copy-extension-manifests] No openclaw.plugin.json found for ${extName}`);
      continue;
    }

    if (!fs.existsSync(distExtDir)) {
      fs.mkdirSync(distExtDir, { recursive: true });
    }

    fs.copyFileSync(srcManifest, distManifest);
    console.log(`[copy-extension-manifests] Copied ${extName}/openclaw.plugin.json`);
  }

  console.log("[copy-extension-manifests] Done");
}

copyExtensionManifests();
