#!/home/ubuntu/clawd/.venv/bin/python3
"""
Decrypt the Bitwarden master password.

Usage:
  python3 decrypt.py              # Copy to clipboard (if display available)
  python3 decrypt.py --stdout     # Print to stdout (use with caution!)
  python3 decrypt.py --bw-unlock  # Pipe directly to 'bw unlock' (safest headless option)

NOVA ONLY - Never share this script or run it for sub-agents.
"""

import os
import sys
import subprocess
import threading
import time
from pathlib import Path

# Paths
SKILL_DIR = Path(__file__).parent.parent
KEY_FILE = SKILL_DIR / ".key"
VAULT_DIR = Path.home() / "clawd" / "vault"
CRED_FILE = VAULT_DIR / ".credentials"

# Auto-clear clipboard after this many seconds
CLIPBOARD_TIMEOUT = 30

def decrypt_password() -> str:
    """Decrypt and return the password."""
    from cryptography.fernet import Fernet
    
    if not KEY_FILE.exists():
        print("Error: No encryption key found. Run encrypt.py first.", file=sys.stderr)
        sys.exit(1)
    
    if not CRED_FILE.exists():
        print("Error: No encrypted credentials found. Run encrypt.py first.", file=sys.stderr)
        sys.exit(1)
    
    key = KEY_FILE.read_bytes()
    encrypted = CRED_FILE.read_bytes()
    
    f = Fernet(key)
    decrypted = f.decrypt(encrypted).decode()
    
    return decrypted

def copy_to_clipboard(text: str) -> bool:
    """Copy text to clipboard using available tool."""
    # Check if we have a display
    if not os.environ.get('DISPLAY') and not os.environ.get('WAYLAND_DISPLAY'):
        return False
    
    clipboard_cmds = [
        ["xclip", "-selection", "clipboard"],
        ["xsel", "--clipboard", "--input"],
        ["pbcopy"],  # macOS
    ]
    
    for cmd in clipboard_cmds:
        try:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            proc.communicate(input=text.encode())
            if proc.returncode == 0:
                return True
        except FileNotFoundError:
            continue
    
    return False

def clear_clipboard():
    """Clear the clipboard."""
    clipboard_cmds = [
        ["xclip", "-selection", "clipboard"],
        ["xsel", "--clipboard", "--input"],
        ["pbcopy"],
    ]
    
    for cmd in clipboard_cmds:
        try:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            proc.communicate(input=b"")
            if proc.returncode == 0:
                return True
        except FileNotFoundError:
            continue
    
    return False

def schedule_clipboard_clear(seconds: int):
    """Schedule clipboard to be cleared after delay."""
    def clear_later():
        time.sleep(seconds)
        if clear_clipboard():
            print(f"\n✓ Clipboard cleared after {seconds}s timeout.")
    
    thread = threading.Thread(target=clear_later, daemon=True)
    thread.start()

def bw_unlock(password: str):
    """Pipe password directly to bw unlock."""
    try:
        result = subprocess.run(
            ["bw", "unlock", "--passwordenv", "BW_PASSWORD"],
            env={**os.environ, "BW_PASSWORD": password},
            capture_output=True,
            text=True
        )
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return result.returncode == 0
    except FileNotFoundError:
        print("Error: 'bw' (Bitwarden CLI) not found. Install it first.", file=sys.stderr)
        return False

def main():
    # Parse args
    use_stdout = "--stdout" in sys.argv
    use_bw = "--bw-unlock" in sys.argv
    
    password = decrypt_password()
    
    if use_bw:
        # Safest headless option - pipe directly to bw
        print("Unlocking Bitwarden...")
        bw_unlock(password)
        password = None
        return
    
    if use_stdout:
        # Direct output - use with caution
        print("⚠️  WARNING: Printing password to stdout!", file=sys.stderr)
        print(password)
        password = None
        return
    
    # Try clipboard
    if copy_to_clipboard(password):
        print("✓ Password copied to clipboard.")
        print(f"✓ Clipboard will auto-clear in {CLIPBOARD_TIMEOUT} seconds.")
        print("  (Press Ctrl+C to clear immediately and exit)")
        
        schedule_clipboard_clear(CLIPBOARD_TIMEOUT)
        
        try:
            time.sleep(CLIPBOARD_TIMEOUT + 1)
        except KeyboardInterrupt:
            clear_clipboard()
            print("\n✓ Clipboard cleared.")
    else:
        # Headless - suggest alternatives
        print("⚠️  No display available for clipboard.", file=sys.stderr)
        print("", file=sys.stderr)
        print("Options:", file=sys.stderr)
        print("  --bw-unlock   Pipe directly to 'bw unlock' (recommended)", file=sys.stderr)
        print("  --stdout      Print to terminal (use with caution)", file=sys.stderr)
        sys.exit(1)
    
    password = None

if __name__ == "__main__":
    main()
