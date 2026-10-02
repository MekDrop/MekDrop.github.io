#!/usr/bin/env python3
"""Send a bounded subtask to an installed Ollama model and save the response."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


OLLAMA_URL = "http://127.0.0.1:11434"
MODEL_PREFERENCE = ("qwen3.5:9b", "ministral-3:8b")
SENSITIVE_PARTS = {
    ".env",
    ".git",
    "credentials",
    "credential",
    "secrets",
    "secret",
    "private-key",
    "private_key",
}
SENSITIVE_SUFFIXES = {".key", ".pem", ".pfx", ".p12", ".kdbx"}
MODE_GUIDANCE = {
    "analyze": "Return concise findings, evidence, uncertainties, and suggested checks.",
    "draft": "Return only the requested draft or unified diff. Do not claim it was applied.",
    "review": "Return prioritized findings with file references when supported by the supplied context.",
    "summarize": "Return a compact factual summary. Separate facts from inference.",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", required=True, help="Bounded task for the local model")
    parser.add_argument(
        "--context",
        action="append",
        default=[],
        help="Workspace file to include; repeat for multiple files",
    )
    parser.add_argument("--mode", choices=MODE_GUIDANCE, default="analyze")
    parser.add_argument("--model", default="auto", help="Installed Ollama model or auto")
    parser.add_argument("--output", help="Output path inside the workspace")
    parser.add_argument("--max-context-chars", type=int, default=60_000)
    parser.add_argument("--max-output-tokens", type=int, default=2_048)
    parser.add_argument("--timeout-seconds", type=int, default=180)
    return parser.parse_args()


def request_json(path: str, payload: dict | None, timeout: int) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{OLLAMA_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="GET" if payload is None else "POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def installed_models(timeout: int) -> list[str]:
    payload = request_json("/api/tags", None, timeout)
    return [item["name"] for item in payload.get("models", []) if item.get("name")]


def choose_model(requested: str, available: list[str]) -> str:
    if requested != "auto":
        if requested not in available:
            raise ValueError(f"Requested model is not installed: {requested}")
        return requested
    for preferred in MODEL_PREFERENCE:
        if preferred in available:
            return preferred
    raise ValueError("No preferred local model is installed")


def safe_workspace_file(raw_path: str, workspace: Path) -> Path:
    path = Path(raw_path)
    resolved = (workspace / path).resolve() if not path.is_absolute() else path.resolve()
    try:
        resolved.relative_to(workspace)
    except ValueError as error:
        raise ValueError(f"Context path is outside the workspace: {raw_path}") from error
    lowered_parts = {part.lower() for part in resolved.parts}
    if lowered_parts & SENSITIVE_PARTS or resolved.suffix.lower() in SENSITIVE_SUFFIXES:
        raise ValueError(f"Refusing sensitive context path: {raw_path}")
    if not resolved.is_file():
        raise ValueError(f"Context path is not a file: {raw_path}")
    return resolved


def collect_context(paths: list[str], workspace: Path, limit: int) -> tuple[str, list[str]]:
    sections: list[str] = []
    included: list[str] = []
    used = 0
    for raw_path in paths:
        path = safe_workspace_file(raw_path, workspace)
        text = path.read_text(encoding="utf-8", errors="replace")
        remaining = limit - used
        if remaining <= 0:
            break
        clipped = text[:remaining]
        relative = path.relative_to(workspace).as_posix()
        marker = "\n[TRUNCATED]" if len(clipped) < len(text) else ""
        sections.append(f"\n--- FILE: {relative} ---\n{clipped}{marker}\n")
        included.append(relative)
        used += len(clipped)
    return "".join(sections), included


def default_output(workspace: Path, task: str) -> Path:
    slug = re.sub(r"[^a-z0-9]+", "-", task.lower()).strip("-")[:48] or "result"
    stamp = time.strftime("%Y%m%d-%H%M%S")
    return workspace / "tmp" / "local-ai" / f"{stamp}-{slug}.md"


def resolve_output(raw_path: str | None, workspace: Path, task: str) -> Path:
    path = default_output(workspace, task) if raw_path is None else Path(raw_path)
    resolved = (workspace / path).resolve() if not path.is_absolute() else path.resolve()
    try:
        resolved.relative_to(workspace)
    except ValueError as error:
        raise ValueError("Output path must remain inside the workspace") from error
    return resolved


def build_prompt(task: str, mode: str, context: str) -> str:
    return f"""You are a bounded local assistant supporting a primary coding agent.
Use only the supplied task and context. Do not invent files, execution results, or current facts.
If evidence is insufficient, say exactly what is missing. Do not perform or authorize actions.
{MODE_GUIDANCE[mode]}

TASK
{task}

CONTEXT
{context if context else "No file context supplied."}
"""


def main() -> int:
    args = parse_args()
    workspace = Path.cwd().resolve()
    try:
        available = installed_models(min(args.timeout_seconds, 10))
        model = choose_model(args.model, available)
        context, included = collect_context(
            args.context, workspace, max(1_000, args.max_context_chars)
        )
        output_path = resolve_output(args.output, workspace, args.task)
        payload = {
            "model": model,
            "prompt": build_prompt(args.task, args.mode, context),
            "stream": False,
            "think": False,
            "options": {
                "temperature": 0.2,
                "num_predict": max(128, args.max_output_tokens),
            },
        }
        started = time.monotonic()
        result = request_json("/api/generate", payload, args.timeout_seconds)
        response_text = result.get("response", "").strip()
        if not response_text:
            raise RuntimeError("Ollama returned an empty response")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(response_text + "\n", encoding="utf-8")
        receipt = {
            "status": "ok",
            "model": model,
            "mode": args.mode,
            "output": output_path.relative_to(workspace).as_posix(),
            "response_chars": len(response_text),
            "context_files": included,
            "elapsed_seconds": round(time.monotonic() - started, 2),
        }
        print(json.dumps(receipt, ensure_ascii=False))
        return 0
    except (OSError, ValueError, RuntimeError, urllib.error.URLError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "unavailable", "error": str(error)}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
