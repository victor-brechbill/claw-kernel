# Security

This document describes the supply chain security practices for Claw Kernel and how to keep your installation safe.

## Why Supply Chain Security Matters

On 2026-03-31, the **axios** npm package was compromised — a popular HTTP library with hundreds of millions of weekly downloads. Malicious code was published as a new version that appeared legitimate. Users with unpinned version ranges (`^`, `~`) automatically received the malicious update on their next `npm install`.

This incident is a reminder that **any dependency can be compromised**, and unpinned ranges are a silent attack vector.

---

## Protections Baked Into Claw Kernel

### 1. Pinned Exact Dependency Versions

`package.json` uses **exact versions** for all dependencies (no `^` or `~` ranges). This means:

- You always install the exact version that was tested and audited.
- A compromised new release cannot be silently pulled in.
- Changes to dependency versions are explicit, reviewable git diffs.

### 2. Minimum Package Age

The install script configures npm to **reject packages published less than 3 days ago**:

```bash
npm config set minimumReleaseAge 4320
```

This is one of the most effective defenses against supply chain attacks. Compromised packages are typically detected and removed within hours — a 3-day minimum age means you'll never automatically receive a newly-poisoned package.

This was not in place during the axios incident. It is now standard in Claw Kernel installs.

### 3. CI Dependency Auditing

Every CI run executes:

```bash
npm audit --audit-level=high
```

This fails the build if any **high** or **critical** severity vulnerabilities are found in the dependency tree. PRs cannot be merged if they introduce vulnerable dependencies.

---

## How to Verify Dependency Integrity

### Check for known vulnerabilities

```bash
npm audit
```

For a stricter check (fail on high-severity only):

```bash
npm audit --audit-level=high
```

### Verify lockfile integrity

Ensure `package-lock.json` (or `pnpm-lock.yaml`) is committed and up to date. Never use `--no-frozen-lockfile` in production installs.

```bash
# Install from lockfile only — never update it
npm ci
```

### Check package publication age before installing new packages

Before adding a new dependency, check when it was published:

```bash
npm view <package-name> time
```

Prefer packages with a stable release history. Avoid adding packages published within the last 72 hours.

---

## Recommended npm Config for Production Deployments

Apply these settings to harden your npm environment:

```bash
# Reject packages younger than 3 days
npm config set minimumReleaseAge 4320

# Do not run postinstall/preinstall scripts from dependencies
# Prevents malicious packages from executing arbitrary code at install time
npm config set ignore-scripts true

# Use a fixed registry (avoids dependency confusion attacks)
npm config set registry https://registry.npmjs.org/
```

> **Note on `ignore-scripts`:** Some packages require build scripts to function (e.g., native addons like `sharp`, `@lydell/node-pty`). If you use `ignore-scripts true` globally, you may need to run build steps manually for those packages. For Claw Kernel, the `postinstall` script applies compatibility patches — skip `ignore-scripts` unless you're in a locked-down deployment environment and can handle this manually.

---

## Reporting a Vulnerability

If you discover a security vulnerability in Claw Kernel, please **do not** open a public GitHub issue.

Contact the maintainer directly via the channel listed in the repository's README, or open a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/creating-a-repository-security-advisory) for this repository.

---

## References

- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)
- [npm Audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Supply Chain Levels for Software Artifacts (SLSA)](https://slsa.dev/)
- [OpenSSF Best Practices Badge](https://bestpractices.coreinfrastructure.org/)
