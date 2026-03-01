# Passwords Skill

**Access:** Nova ONLY — never grant this skill or its contents to sub-agents.

This skill manages credential storage and retrieval for Nova's operations.

## Overview

- **Bitwarden** is the source of truth for all credentials
- **Bitwarden master password** is stored encrypted in `vault/.credentials`
- Credentials are loaded into environment variables, never passed directly

## Capabilities

### 1. Store Bitwarden Password

Encrypt and save the Bitwarden master password:

```bash
python3 ~/clawd/skills/passwords/scripts/encrypt.py "YOUR_PASSWORD_HERE"
```

This writes the encrypted password to `vault/.credentials`.

### 2. Retrieve Bitwarden Password

```bash
# With display (clipboard - safest)
~/clawd/skills/passwords/scripts/decrypt.py

# Headless - pipe to Bitwarden CLI (recommended)
~/clawd/skills/passwords/scripts/decrypt.py --bw-unlock

# Headless - print to stdout (use with caution!)
~/clawd/skills/passwords/scripts/decrypt.py --stdout
```

- Clipboard method auto-clears after 30 seconds
- `--bw-unlock` pipes directly to `bw unlock` without exposing password
- `--stdout` only for emergencies — password visible in terminal

### 3. Use Bitwarden CLI

After password is in clipboard, authenticate:

```bash
# Paste password when prompted
bw login
# Or unlock existing session
bw unlock
```

### 4. Load Credentials for Sub-agents

When a sub-agent needs a credential:

```bash
# Get credential from Bitwarden
export NOVA_CRED_GITHUB=$(bw get password github.com)

# Pass only the variable NAME to the agent, never the value
# Agent uses: $NOVA_CRED_GITHUB
```

## Security Rules

1. **Never write unencrypted passwords to files**
2. **Never echo passwords to stdout/logs**
3. **Never pass credentials directly to sub-agents** — use env vars
4. **Clear clipboard after use** (auto-clears after 30s, but clear manually if done sooner)
5. **Session tokens expire** — re-authenticate as needed
6. **Mask in logs** — if logging credential operations, show only: `[MASKED]`

## Bitwarden Password Changes

Nova cannot change the Bitwarden master password. If a change is needed:

1. Ask Victor to change it manually
2. Victor provides new password
3. Nova re-encrypts and stores via `encrypt.py`

## Files

```
skills/passwords/
├── SKILL.md           # This file
├── .key               # Encryption key (NEVER share or commit)
└── scripts/
    ├── encrypt.py     # Encrypt password → vault/.credentials
    └── decrypt.py     # Decrypt → clipboard (30s auto-clear)
```

## Encryption Details

- **Algorithm:** Fernet (AES-128-CBC + HMAC-SHA256)
- **Key location:** `skills/passwords/.key`
- **Encrypted file:** `vault/.credentials`

The key is generated once and stays in this skill folder. Only Nova has access to this skill, so only Nova can decrypt.

---

_Created: 2026-01-26 by Nova_
_This skill is Nova-exclusive. Never share with sub-agents._
