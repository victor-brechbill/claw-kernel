#!/usr/bin/env tsx
/**
 * Copy openclaw.plugin.json files from extensions/ to dist/extensions/
 *
 * CRITICAL SAFETY: Only runs if compiled extension JS files already exist in dist/extensions/.
 * This prevents shadowing the source extensions/ directory in dev/symlink setups.
 *
 * Context: In dev mode (symlinked npm install), creating dist/extensions/ with only
 * manifest files causes plugin discovery to fail because:
 * 1. resolveBundledPluginsDir() finds dist/extensions/ first
 * 2. But dist/extensions/telegram/ has no index.js (only openclaw.plugin.json)
 * 3. Plugin discovery skips these empty directories
 * 4. Real extensions at extensions/ are never checked → crash loop
 *
 * Fix: Only copy manifests if compiled JS already exists (production build).
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

  // SAFETY CHECK: Only proceed if dist/extensions/ already has compiled JS files
  // This prevents creating manifest-only directories that shadow real source
  const distExtensionsExists = fs.existsSync(distExtensions);

  if (!distExtensionsExists) {
    console.log("[copy-extension-manifests] SKIP: dist/extensions/ does not exist (dev mode)");
    console.log("[copy-extension-manifests] Extensions will load from source: extensions/");
    return;
  }

  // Check if at least one extension has compiled JS (production build)
  const entries = fs.readdirSync(srcExtensions, { withFileTypes: true });
  const hasCompiledExtensions = entries.some((entry) => {
    if (!entry.isDirectory()) {
      return false;
    }
    const distExtDir = path.join(distExtensions, entry.name);
    const distIndexJs = path.join(distExtDir, "index.js");
    return fs.existsSync(distIndexJs);
  });

  if (!hasCompiledExtensions) {
    console.log(
      "[copy-extension-manifests] SKIP: No compiled extension JS found in dist/extensions/",
    );
    console.log("[copy-extension-manifests] This appears to be a dev/symlink setup.");
    console.log(
      "[copy-extension-manifests] Removing dist/extensions/ to prevent shadowing source extensions/",
    );

    // Clean up to prevent shadowing
    if (distExtensionsExists) {
      fs.rmSync(distExtensions, { recursive: true, force: true });
      console.log("[copy-extension-manifests] Removed dist/extensions/");
    }

    return;
  }

  // Safe to copy manifests - compiled JS exists (production build)
  console.log("[copy-extension-manifests] Production build detected - copying manifests...");

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
