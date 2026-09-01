#!/bin/bash
# Registers the Code Panel native messaging host with Chrome (macOS).
# Usage: ./install.sh <extension-id>   (the ID shown on chrome://extensions)
set -euo pipefail

EXT_ID="${1:-}"
if [[ -z "$EXT_ID" ]]; then
  echo "Usage: ./install.sh <extension-id>"
  echo "Find the ID on chrome://extensions (Developer mode on, shown on the Code Panel card)."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

chmod +x "$SCRIPT_DIR/host.py"
mkdir -p "$HOST_DIR"
cat > "$HOST_DIR/com.codepanel.host.json" <<EOF
{
  "name": "com.codepanel.host",
  "description": "Code Panel native bridge",
  "path": "$SCRIPT_DIR/host.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF

echo "Installed for extension $EXT_ID."
echo "1. Restart Chrome (the host manifest is read at startup)."
echo "2. First use will need Accessibility permission for Google Chrome:"
echo "   System Settings → Privacy & Security → Accessibility → enable Google Chrome."
