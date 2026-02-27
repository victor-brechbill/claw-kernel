import type { OpenClawConfig } from "../config/config.js";

export function applyOnboardingLocalWorkspaceConfig(
  baseConfig: OpenClawConfig,
  workspaceDir: string,
): OpenClawConfig {
  return {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
      },
      list: baseConfig.agents?.list ?? [
        {
          id: "main",
          default: true,
          name: "Assistant",
          workspace: workspaceDir,
        },
      ],
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
  };
}
