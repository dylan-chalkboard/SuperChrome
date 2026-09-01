#!/usr/bin/env python3
"""SuperChrome native messaging host (macOS).

Chrome launches this per message. Protocol: 4-byte little-endian length +
JSON on stdin, same framing for the reply on stdout. Extensions can't open
DevTools themselves, so this bridges the palette to a real Cmd+Opt+I.
"""
import json
import struct
import subprocess
import sys

ACTIONS = {
    "open-devtools": [
        "osascript",
        "-e", 'tell application "Google Chrome" to activate',
        "-e", 'tell application "System Events" to keystroke "i" using {command down, option down}',
    ],
}


def main() -> None:
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) != 4:
        return
    msg_len = struct.unpack("<I", raw_len)[0]
    try:
        message = json.loads(sys.stdin.buffer.read(msg_len) or b"{}")
    except json.JSONDecodeError:
        message = {}

    command = ACTIONS.get(message.get("action", ""))
    ok, error = False, None
    if command:
        result = subprocess.run(command, capture_output=True, text=True)
        ok = result.returncode == 0
        error = result.stderr.strip() or None if not ok else None
    else:
        error = "unknown action"

    reply = json.dumps({"ok": ok, "error": error}).encode()
    sys.stdout.buffer.write(struct.pack("<I", len(reply)) + reply)
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    main()
