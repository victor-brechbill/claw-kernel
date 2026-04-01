import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OAuthCredentials, OAuthProvider } from "@mariozechner/pi-ai";
import { getOAuthApiKey, getOAuthProviders } from "@mariozechner/pi-ai/oauth";
import type { OpenClawConfig } from "../../config/config.js";
import { withFileLock } from "../../infra/file-lock.js";
import { refreshChutesTokens } from "../chutes-oauth.js";
import { AUTH_STORE_LOCK_OPTIONS, log } from "./constants.js";
import { formatAuthDoctorHint } from "./doctor.js";
import { ensureAuthStoreFile, resolveAuthStorePath } from "./paths.js";
import { suggestOAuthProfileIdForLegacyDefault } from "./repair.js";
import { ensureAuthProfileStore, saveAuthProfileStore } from "./store.js";
import type { AuthProfileStore } from "./types.js";

/**
 * After a successful Anthropic OAuth token refresh on the main agent,
 * propagate the new credentials to all secondary agent auth stores.
 * This prevents secondary agents (code-reviewer, developer, worker, etc.)
 * from using stale/expired tokens and failing at startup.
 */
function syncToAllAgentProfiles(params: {
  profileId: string;
  credentials: OAuthCredentials;
}): void {
  const stateDir = path.join(os.homedir(), ".openclaw", "agents");
  if (!fs.existsSync(stateDir)) {
    return;
  }

  let agentIds: string[];
  try {
    agentIds = fs.readdirSync(stateDir).filter((name) => {
      try {
        return fs.statSync(path.join(stateDir, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return;
  }

  for (const agentId of agentIds) {
    const agentAuthPath = path.join(stateDir, agentId, "agent", "auth-profiles.json");
    if (!fs.existsSync(agentAuthPath)) {
      continue;
    }

    try {
      const raw = fs.readFileSync(agentAuthPath, "utf8");
      const store = JSON.parse(raw) as {
        profiles: Record<string, OAuthCredentials & { type: string }>;
      };
      if (!store?.profiles) {
        continue;
      }

      if (!store.profiles[params.profileId]) {
        continue;
      }
      const existing = store.profiles[params.profileId];
      if (existing.type !== "oauth" || existing.provider !== params.credentials.provider) {
        continue;
      }

      store.profiles[params.profileId] = {
        ...existing,
        access: params.credentials.access,
        refresh: params.credentials.refresh,
        expires: params.credentials.expires,
      };

      const tmpPath = `${agentAuthPath}.tmp.${process.pid}`;
      fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2) + "\n", "utf8");
      fs.chmodSync(tmpPath, 0o600);
      fs.renameSync(tmpPath, agentAuthPath);
    } catch {
      // Skip agents we can't update — don't fail the refresh
    }
  }
}

function syncToClaudeCredentials(tokens: {
  accessToken: string;
  refreshToken: string;
  expires: number;
}): void {
  const credPath = path.join(os.homedir(), ".claude", ".credentials.json");

  let data: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(credPath, "utf8");
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // File doesn't exist or isn't valid JSON — skip silently
    return;
  }

  if (!data.claudeAiOauth || typeof data.claudeAiOauth !== "object") {
    return;
  }

  data.claudeAiOauth = {
    ...(data.claudeAiOauth as Record<string, unknown>),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expires,
  };

  const tmpPath = `${credPath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.chmodSync(tmpPath, 0o600);
  fs.renameSync(tmpPath, credPath);
}

const OAUTH_PROVIDER_IDS = new Set<string>(getOAuthProviders().map((provider) => provider.id));

const isOAuthProvider = (provider: string): provider is OAuthProvider =>
  OAUTH_PROVIDER_IDS.has(provider);

const resolveOAuthProvider = (provider: string): OAuthProvider | null =>
  isOAuthProvider(provider) ? provider : null;

function buildOAuthApiKey(provider: string, credentials: OAuthCredentials): string {
  const needsProjectId = provider === "google-gemini-cli" || provider === "google-antigravity";
  return needsProjectId
    ? JSON.stringify({
        token: credentials.access,
        projectId: credentials.projectId,
      })
    : credentials.access;
}

async function refreshOAuthTokenWithLock(params: {
  profileId: string;
  agentDir?: string;
}): Promise<{ apiKey: string; newCredentials: OAuthCredentials } | null> {
  const authPath = resolveAuthStorePath(params.agentDir);
  ensureAuthStoreFile(authPath);

  return await withFileLock(authPath, AUTH_STORE_LOCK_OPTIONS, async () => {
    const store = ensureAuthProfileStore(params.agentDir);
    const cred = store.profiles[params.profileId];
    if (!cred || cred.type !== "oauth") {
      return null;
    }

    if (Date.now() < cred.expires) {
      return {
        apiKey: buildOAuthApiKey(cred.provider, cred),
        newCredentials: cred,
      };
    }

    const oauthCreds: Record<string, OAuthCredentials> = {
      [cred.provider]: cred,
    };

    const result =
      String(cred.provider) === "chutes"
        ? await (async () => {
            const newCredentials = await refreshChutesTokens({
              credential: cred,
            });
            return { apiKey: newCredentials.access, newCredentials };
          })()
        : await (async () => {
            const oauthProvider = resolveOAuthProvider(cred.provider);
            if (!oauthProvider) {
              return null;
            }
            return await getOAuthApiKey(oauthProvider, oauthCreds);
          })();
    if (!result) {
      return null;
    }
    const updatedCredentials = {
      ...cred,
      ...result.newCredentials,
      type: "oauth" as const,
    };
    store.profiles[params.profileId] = updatedCredentials;
    saveAuthProfileStore(store, params.agentDir);

    if (cred.provider === "anthropic") {
      try {
        syncToClaudeCredentials({
          accessToken: updatedCredentials.access,
          refreshToken: updatedCredentials.refresh,
          expires: updatedCredentials.expires,
        });
      } catch (err) {
        log.warn("failed to sync refreshed tokens to Claude credentials", { err });
      }

      // Only sync from the main agent (agentDir === undefined) to avoid propagation loops
      if (!params.agentDir) {
        try {
          syncToAllAgentProfiles({
            profileId: params.profileId,
            credentials: updatedCredentials,
          });
          log.info("synced refreshed Anthropic token to all secondary agent profiles", {
            profileId: params.profileId,
          });
        } catch (err) {
          log.warn("failed to sync refreshed tokens to secondary agent profiles", { err });
        }
      }
    }

    return result;
  });
}

async function tryResolveOAuthProfile(params: {
  cfg?: OpenClawConfig;
  store: AuthProfileStore;
  profileId: string;
  agentDir?: string;
}): Promise<{ apiKey: string; provider: string; email?: string } | null> {
  const { cfg, store, profileId } = params;
  const cred = store.profiles[profileId];
  if (!cred || cred.type !== "oauth") {
    return null;
  }
  const profileConfig = cfg?.auth?.profiles?.[profileId];
  if (profileConfig && profileConfig.provider !== cred.provider) {
    return null;
  }
  if (profileConfig && profileConfig.mode !== cred.type) {
    return null;
  }

  if (Date.now() < cred.expires) {
    return {
      apiKey: buildOAuthApiKey(cred.provider, cred),
      provider: cred.provider,
      email: cred.email,
    };
  }

  const refreshed = await refreshOAuthTokenWithLock({
    profileId,
    agentDir: params.agentDir,
  });
  if (!refreshed) {
    return null;
  }
  return {
    apiKey: refreshed.apiKey,
    provider: cred.provider,
    email: cred.email,
  };
}

export async function resolveApiKeyForProfile(params: {
  cfg?: OpenClawConfig;
  store: AuthProfileStore;
  profileId: string;
  agentDir?: string;
}): Promise<{ apiKey: string; provider: string; email?: string } | null> {
  const { cfg, store, profileId } = params;
  const cred = store.profiles[profileId];
  if (!cred) {
    return null;
  }
  const profileConfig = cfg?.auth?.profiles?.[profileId];
  if (profileConfig && profileConfig.provider !== cred.provider) {
    return null;
  }
  if (profileConfig && profileConfig.mode !== cred.type) {
    // Compatibility: treat "oauth" config as compatible with stored token profiles.
    if (!(profileConfig.mode === "oauth" && cred.type === "token")) {
      return null;
    }
  }

  if (cred.type === "api_key") {
    const key = cred.key?.trim();
    if (!key) {
      return null;
    }
    return { apiKey: key, provider: cred.provider, email: cred.email };
  }
  if (cred.type === "token") {
    const token = cred.token?.trim();
    if (!token) {
      return null;
    }
    if (
      typeof cred.expires === "number" &&
      Number.isFinite(cred.expires) &&
      cred.expires > 0 &&
      Date.now() >= cred.expires
    ) {
      return null;
    }
    return { apiKey: token, provider: cred.provider, email: cred.email };
  }
  if (Date.now() < cred.expires) {
    return {
      apiKey: buildOAuthApiKey(cred.provider, cred),
      provider: cred.provider,
      email: cred.email,
    };
  }

  try {
    const result = await refreshOAuthTokenWithLock({
      profileId,
      agentDir: params.agentDir,
    });
    if (!result) {
      return null;
    }
    return {
      apiKey: result.apiKey,
      provider: cred.provider,
      email: cred.email,
    };
  } catch (error) {
    const refreshedStore = ensureAuthProfileStore(params.agentDir);
    const refreshed = refreshedStore.profiles[profileId];
    if (refreshed?.type === "oauth" && Date.now() < refreshed.expires) {
      return {
        apiKey: buildOAuthApiKey(refreshed.provider, refreshed),
        provider: refreshed.provider,
        email: refreshed.email ?? cred.email,
      };
    }
    const fallbackProfileId = suggestOAuthProfileIdForLegacyDefault({
      cfg,
      store: refreshedStore,
      provider: cred.provider,
      legacyProfileId: profileId,
    });
    if (fallbackProfileId && fallbackProfileId !== profileId) {
      try {
        const fallbackResolved = await tryResolveOAuthProfile({
          cfg,
          store: refreshedStore,
          profileId: fallbackProfileId,
          agentDir: params.agentDir,
        });
        if (fallbackResolved) {
          return fallbackResolved;
        }
      } catch {
        // keep original error
      }
    }

    // Fallback: if this is a secondary agent, try using the main agent's credentials
    if (params.agentDir) {
      try {
        const mainStore = ensureAuthProfileStore(undefined); // main agent (no agentDir)
        const mainCred = mainStore.profiles[profileId];
        if (mainCred?.type === "oauth" && Date.now() < mainCred.expires) {
          // Main agent has fresh credentials - copy them to this agent and use them
          refreshedStore.profiles[profileId] = { ...mainCred };
          saveAuthProfileStore(refreshedStore, params.agentDir);
          log.info("inherited fresh OAuth credentials from main agent", {
            profileId,
            agentDir: params.agentDir,
            expires: new Date(mainCred.expires).toISOString(),
          });
          return {
            apiKey: buildOAuthApiKey(mainCred.provider, mainCred),
            provider: mainCred.provider,
            email: mainCred.email,
          };
        }
      } catch {
        // keep original error if main agent fallback also fails
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    const hint = formatAuthDoctorHint({
      cfg,
      store: refreshedStore,
      provider: cred.provider,
      profileId,
    });
    throw new Error(
      `OAuth token refresh failed for ${cred.provider}: ${message}. ` +
        "Please try again or re-authenticate." +
        (hint ? `\n\n${hint}` : ""),
      { cause: error },
    );
  }
}
