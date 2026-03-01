#!/home/ubuntu/clawd/.venv/bin/python3
"""
Encrypt the Bitwarden master password and store it.
Usage: python3 encrypt.py "your_password"

NOVA ONLY - Never share this script or run it for sub-agents.
"""

import sys
import os
from pathlib import Path

# Paths
SKILL_DIR = Path(__file__).parent.parent
KEY_FILE = SKILL_DIR / ".key"
VAULT_DIR = Path.home() / "clawd" / "vault"
CRED_FILE = VAULT_DIR / ".credentials"

def get_or_create_key():
    """Get existing key or create a new one."""
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        print("Installing cryptography library...")
        os.system("pip3 install cryptography -q")
        from cryptography.fernet import Fernet
    
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes()
    else:
        key = Fernet.generate_key()
        KEY_FILE.write_bytes(key)
        KEY_FILE.chmod(0o600)  # Owner read/write only
        print(f"Generated new encryption key: {KEY_FILE}")
        return key

def encrypt_password(password: str):
    """Encrypt password and save to vault."""
    from cryptography.fernet import Fernet
    
    key = get_or_create_key()
    f = Fernet(key)
    encrypted = f.encrypt(password.encode())
    
    # Ensure vault directory exists
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Write encrypted password
    CRED_FILE.write_bytes(encrypted)
    CRED_FILE.chmod(0o600)  # Owner read/write only
    
    print(f"✓ Password encrypted and saved to: {CRED_FILE}")
    print("✓ The plaintext password was NOT saved anywhere.")

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 encrypt.py \"your_password\"")
        print("\nWARNING: Password will appear in shell history!")
        print("Consider using: read -s PASS && python3 encrypt.py \"$PASS\"")
        sys.exit(1)
    
    password = sys.argv[1]
    
    if not password:
        print("Error: Password cannot be empty")
        sys.exit(1)
    
    encrypt_password(password)
    
    # Clear the password from memory (best effort)
    password = None

if __name__ == "__main__":
    main()
