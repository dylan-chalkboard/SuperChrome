#!/usr/bin/env python3
"""SuperChrome native messaging host (macOS).

Chrome launches this per message. Protocol: 4-byte little-endian length +
JSON on stdin, same framing for the reply on stdout. Bridges the palette to
browser UI that extensions can't touch: DevTools, menu-bar items, and
Chrome's own keyboard shortcuts.

Actions:
  {"action": "open-devtools"}                        — Cmd+Opt+I
  {"action": "keystroke", "name": "<allowlisted>"}   — named shortcut below
  {"action": "click-menu", "path": ["View", "Developer", "JavaScript Console"]}
"""
import json
import re
import struct
import subprocess
import sys

KEYSTROKES = {
    "open-devtools": ("i", ["command down", "option down"]),
    "toggle-bookmarks-bar": ("b", ["command down", "shift down"]),
    "save-page": ("s", ["command down"]),
    "find-in-page": ("f", ["command down"]),
    "new-incognito": ("n", ["command down", "shift down"]),
}

MENU_ITEM_RE = re.compile(r"^[A-Za-z0-9 '&,./…-]{1,40}$")


def osascript(*statements: str) -> subprocess.CompletedProcess:
    args = ["osascript", "-e", 'tell application "Google Chrome" to activate']
    for statement in statements:
        args += ["-e", statement]
    return subprocess.run(args, capture_output=True, text=True)


def run_keystroke(name: str) -> subprocess.CompletedProcess:
    key, modifiers = KEYSTROKES[name]
    mods = ", ".join(modifiers)
    return osascript(
        f'tell application "System Events" to keystroke "{key}" using {{{mods}}}'
    )


def run_split_tab(title) -> subprocess.CompletedProcess:
    """Right-click the tab whose name contains `title` and click Chrome's
    native split-view context-menu item. Best-effort UI scripting: the
    extension falls back to window tiling when this reports failure."""
    if not isinstance(title, str) or not title.strip():
        raise ValueError("invalid title")
    safe = title.replace("\\", "").replace('"', "")[:40]
    script = f'''
tell application "System Events" to tell process "Google Chrome"
    set frontmost to true
    set theTab to missing value
    try
        set theTab to first radio button of tab group 1 of window 1 whose name contains "{safe}"
    end try
    if theTab is missing value then
        try
            set theTab to first UI element of tab group 1 of window 1 whose name contains "{safe}"
        end try
    end if
    if theTab is missing value then error "tab element not found"
    perform action "AXShowMenu" of theTab
    delay 0.3
    set theMenu to missing value
    try
        set theMenu to menu 1 of theTab
    end try
    if theMenu is missing value then
        key code 53
        error "context menu not found"
    end if
    set clicked to false
    repeat with mi in menu items of theMenu
        try
            if name of mi contains "plit" then
                click mi
                set clicked to true
                exit repeat
            end if
        end try
    end repeat
    if not clicked then
        key code 53
        error "split menu item not found"
    end if
end tell'''
    return osascript(script)


def run_click_menu(path: list) -> subprocess.CompletedProcess:
    if (
        not isinstance(path, list)
        or not 2 <= len(path) <= 3
        or not all(isinstance(p, str) and MENU_ITEM_RE.match(p) for p in path)
    ):
        raise ValueError("invalid menu path")
    if len(path) == 2:
        target = f'menu item "{path[1]}" of menu "{path[0]}"'
    else:
        target = (
            f'menu item "{path[2]}" of menu 1 of '
            f'menu item "{path[1]}" of menu "{path[0]}"'
        )
    return osascript(
        'tell application "System Events" to tell process "Google Chrome" '
        f"to click {target} of menu bar 1"
    )


def main() -> None:
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) != 4:
        return
    msg_len = struct.unpack("<I", raw_len)[0]
    try:
        message = json.loads(sys.stdin.buffer.read(msg_len) or b"{}")
    except json.JSONDecodeError:
        message = {}

    action = message.get("action", "")
    ok, error = False, None
    try:
        if action in KEYSTROKES:
            result = run_keystroke(action)
        elif action == "keystroke" and message.get("name") in KEYSTROKES:
            result = run_keystroke(message["name"])
        elif action == "click-menu":
            result = run_click_menu(message.get("path"))
        elif action == "split-tab":
            result = run_split_tab(message.get("title"))
        else:
            result = None
            error = "unknown action"
        if result is not None:
            ok = result.returncode == 0
            error = result.stderr.strip() or None if not ok else None
    except ValueError as exc:
        error = str(exc)

    reply = json.dumps({"ok": ok, "error": error}).encode()
    sys.stdout.buffer.write(struct.pack("<I", len(reply)) + reply)
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    main()
