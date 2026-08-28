#!/usr/bin/python3
"""Automatic prompt/response capture for the 8x assignment.

Writes only user prompts and final assistant text to .agent-logs/.
Triggered by Cursor project hooks (beforeSubmitPrompt, afterAgentResponse, stop).
"""
from __future__ import annotations

import fcntl
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

AUTHOR = "Vansh Choudhary"
PROJECT = "8x"
TOOL = "cursor"

STATE_DIRNAME = ".cursor/hooks/state"
LOG_DIRNAME = ".agent-logs"


def utc_now() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(now.microsecond / 1000):03d}Z"


def infer_event(data: dict) -> str:
    name = data.get("hook_event_name") or data.get("event") or ""
    if name:
        return str(name)
    if "prompt" in data and "text" not in data:
        return "beforeSubmitPrompt"
    if data.get("status") in ("completed", "aborted", "error") and "loop_count" in data:
        return "stop"
    if "session_id" in data and ("is_background_agent" in data or "composer_mode" in data):
        return "sessionStart"
    if "text" in data:
        return "afterAgentResponse"
    return ""


def repo_root(data: dict) -> Path:
    roots = data.get("workspace_roots") or []
    if roots:
        return Path(roots[0])
    env_root = os.environ.get("CURSOR_PROJECT_DIR") or os.environ.get("PWD")
    if env_root:
        return Path(env_root)
    return Path.cwd()


def session_key(data: dict) -> str:
    for key in ("conversation_id", "session_id", "generation_id"):
        value = data.get(key)
        if value:
            return str(value)
    return "unknown-session"


def short_id(session_id: str) -> str:
    return session_id.replace("-", "")[:8] if session_id else "unknown"


def load_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def dump_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def header_block(state: dict) -> str:
    return (
        "---\n"
        f"session_id: {state['session_id']}\n"
        f"date: {state['date']}\n"
        f"author: {AUTHOR}\n"
        f"model: {state.get('model') or 'unknown'}\n"
        f"tool: {TOOL}\n"
        f"project: {PROJECT}\n"
        f"total_exchanges: {state.get('total_exchanges', 0)}\n"
        f"first_prompt_time: {state.get('first_prompt_time') or ''}\n"
        f"last_prompt_time: {state.get('last_prompt_time') or ''}\n"
        "---\n"
        "\n"
        f"# Session Log - {state['date']}\n"
        "\n"
        f"Session: `{short_id(state['session_id'])}` | Project: `{PROJECT}` | Author: `{AUTHOR}`\n"
        "\n"
        "---\n"
    )


def ensure_log(state: dict, log_path: Path) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    if not log_path.exists():
        log_path.write_text(header_block(state) + "\n", encoding="utf-8")
        return
    text = log_path.read_text(encoding="utf-8")
    idx = text.find("[LOG_ENTRY")
    if idx == -1:
        log_path.write_text(header_block(state) + "\n", encoding="utf-8")
        return
    log_path.write_text(header_block(state) + "\n" + text[idx:], encoding="utf-8")


def append_entry(
    log_path: Path,
    *,
    entry_type: str,
    num: int,
    session_id: str,
    timestamp: str,
    model: str,
    body: str,
) -> None:
    body = body.replace("\r\n", "\n")
    if body and not body.endswith("\n"):
        body += "\n"
    chunk = (
        f"\n[LOG_ENTRY type={entry_type} num={num} session={short_id(session_id)}]\n"
        f"timestamp: {timestamp}\n"
        f"model: {model}\n"
        f"\n"
        f"{body}"
    )
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(chunk)


def replace_response(
    log_path: Path,
    *,
    num: int,
    session_id: str,
    timestamp: str,
    model: str,
    body: str,
) -> bool:
    text = log_path.read_text(encoding="utf-8")
    needle = f"[LOG_ENTRY type=RESPONSE num={num} session={short_id(session_id)}]"
    start = text.find(needle)
    if start == -1:
        return False
    body = body.replace("\r\n", "\n")
    if body and not body.endswith("\n"):
        body += "\n"
    replacement = (
        f"[LOG_ENTRY type=RESPONSE num={num} session={short_id(session_id)}]\n"
        f"timestamp: {timestamp}\n"
        f"model: {model}\n"
        f"\n"
        f"{body}"
    )
    nxt = text.find("\n[LOG_ENTRY ", start + 1)
    if nxt == -1:
        new_text = text[:start] + replacement
    else:
        new_text = text[:start] + replacement + text[nxt:]
    log_path.write_text(new_text, encoding="utf-8")
    return True


def write_response(state: dict, log_path: Path, timestamp: str, model: str, body: str) -> None:
    num = int(state.get("current_exchange") or 0)
    if num < 1 or not (body or "").strip():
        return
    session_id = state["session_id"]
    if state.get("response_written_for") == num:
        replace_response(
            log_path,
            num=num,
            session_id=session_id,
            timestamp=timestamp,
            model=model,
            body=body,
        )
    else:
        append_entry(
            log_path,
            entry_type="RESPONSE",
            num=num,
            session_id=session_id,
            timestamp=timestamp,
            model=model,
            body=body,
        )
        state["response_written_for"] = num
        state["total_exchanges"] = num


def get_or_create_state(root: Path, data: dict) -> tuple[dict, Path, Path]:
    sid = session_key(data)
    state_dir = root / STATE_DIRNAME
    state_dir.mkdir(parents=True, exist_ok=True)
    state_path = state_dir / f"{sid}.json"
    state = load_json(state_path) or {}
    if not state:
        created = utc_now()
        file_stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        date = created[:10]
        rel = f"{LOG_DIRNAME}/{file_stamp}_{sid}.md"
        state = {
            "session_id": sid,
            "date": date,
            "created_at": created,
            "log_relpath": rel,
            "total_exchanges": 0,
            "current_exchange": 0,
            "first_prompt_time": "",
            "last_prompt_time": "",
            "model": data.get("model") or "unknown",
            "pending_response": "",
            "response_written_for": 0,
        }
        dump_json(state_path, state)
    log_path = root / state["log_relpath"]
    return state, state_path, log_path


def emit_continue() -> None:
    sys.stdout.write(json.dumps({"continue": True}) + "\n")


def main() -> int:
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        data = {"_raw": raw, "hook_event_name": "unknown"}

    event = infer_event(data)
    root = repo_root(data)
    debug_path = root / STATE_DIRNAME / "last-payload.json"
    try:
        dump_json(debug_path, {"received_at": utc_now(), "event": event, "payload": data})
    except OSError:
        pass

    lock_path = root / STATE_DIRNAME / "capture.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        state, state_path, log_path = get_or_create_state(root, data)
        model = str(data.get("model") or state.get("model") or "unknown")
        state["model"] = model
        ts = utc_now()

        if event == "sessionStart":
            ensure_log(state, log_path)
        elif event == "beforeSubmitPrompt":
            prompt = data.get("prompt")
            if prompt is None:
                prompt = ""
            prompt = str(prompt)
            state["current_exchange"] = int(state.get("current_exchange") or 0) + 1
            num = state["current_exchange"]
            if not state.get("first_prompt_time"):
                state["first_prompt_time"] = ts
            state["last_prompt_time"] = ts
            state["pending_response"] = ""
            ensure_log(state, log_path)
            append_entry(
                log_path,
                entry_type="PROMPT",
                num=num,
                session_id=state["session_id"],
                timestamp=ts,
                model=model,
                body=prompt,
            )
        elif event == "afterAgentResponse":
            text = data.get("text")
            if text is None:
                text = ""
            text = str(text)
            if text.strip():
                state["pending_response"] = text
                write_response(state, log_path, ts, model, text)
                ensure_log(state, log_path)
        elif event == "stop":
            pending = state.get("pending_response") or ""
            if pending.strip() and state.get("response_written_for") != state.get("current_exchange"):
                write_response(state, log_path, ts, model, pending)
            ensure_log(state, log_path)

        dump_json(state_path, state)

    if event == "beforeSubmitPrompt":
        emit_continue()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        try:
            emit_continue()
        except Exception:
            pass
        raise
