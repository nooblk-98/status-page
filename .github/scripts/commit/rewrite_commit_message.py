#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence
from urllib import error, request

MARKER = "[copilot-commit]"
COPILOT_URL = "https://api.githubcopilot.com/chat/completions"
MESSAGE_FILE = Path("/tmp/copilot-commit-message.txt")
MAX_DIFF_CHARS = 60000
MAX_CHANGED_FILES = 30

GENERIC_SUBJECTS = {
    "update",
    "updates",
    "fix",
    "fixes",
    "change",
    "changes",
    "misc",
    "wip",
    "temp",
    "test",
    "tests",
    "commit",
    "done",
    "cleanup",
    "small fix",
    "quick fix",
    "minor fix",
    "bug fix",
}

CONVENTIONAL_PREFIX_RE = re.compile(
    r"^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)"
    r"(?:\([^)]+\))?!?:\s*(?P<core>.+)$",
    re.IGNORECASE,
)
WEAK_SUBJECT_RE = re.compile(
    r"^(update|updates|fix|fixes|change|changes|misc|wip|temp|test|tests|cleanup)"
    r"(?:\s+[a-z0-9]+){0,2}$",
    re.IGNORECASE,
)
CI_PREFIX_RE = re.compile(r"^ci(?:\([^)]+\))?!?:\s*", re.IGNORECASE)


@dataclass
class CommitContext:
    sha: str
    full_message: str
    subject: str
    body: str
    shortstat: str
    changed_files: list[str]
    diff: str
    parent_count: int


def run_git(args: Sequence[str], strip: bool = True) -> str:
    completed = subprocess.run(
        ["git", *args],
        check=True,
        text=True,
        capture_output=True,
    )
    output = completed.stdout.replace("\r", "")
    return output.strip() if strip else output


def parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def normalize_space(value: str) -> str:
    return " ".join(value.split())


def extract_subject_core(subject: str) -> str:
    compact = normalize_space(subject)
    match = CONVENTIONAL_PREFIX_RE.match(compact)
    if match:
        return normalize_space(match.group("core"))
    return compact


def is_weak_subject(subject: str) -> bool:
    if CI_PREFIX_RE.match(normalize_space(subject)):
        return True

    core = extract_subject_core(subject)
    if not core:
        return True

    cleaned = re.sub(r"[^a-z0-9\s]+", "", core.lower()).strip()
    if not cleaned:
        return True
    if len(cleaned) < 12:
        return True
    if cleaned in GENERIC_SUBJECTS:
        return True
    if WEAK_SUBJECT_RE.fullmatch(cleaned):
        return True
    if not re.search(r"[a-z]", cleaned):
        return True

    words = cleaned.split()
    if len(words) <= 2 and len(cleaned) < 20:
        return True

    return False


def has_detailed_body(body: str) -> bool:
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    if not lines:
        return False

    bullet_like = sum(1 for line in lines if re.match(r"^[-*]\s+\S+", line))
    if bullet_like >= 2:
        return True

    joined = " ".join(lines)
    if len(joined) >= 90:
        return True

    return len(lines) >= 3


def get_commit_context() -> CommitContext:
    sha = run_git(["rev-parse", "HEAD"])
    full_message = run_git(["log", "-1", "--pretty=%B"], strip=False).strip("\n")
    subject = run_git(["log", "-1", "--pretty=%s"])
    body = run_git(["log", "-1", "--pretty=%b"], strip=False).strip()

    changed_files_raw = run_git(["show", "--pretty=", "--name-only", sha], strip=False)
    changed_files = [line.strip() for line in changed_files_raw.splitlines() if line.strip()]
    changed_files = changed_files[:MAX_CHANGED_FILES]

    shortstat_output = run_git(["show", "--shortstat", "--oneline", sha], strip=False)
    shortstat_lines = [line.strip() for line in shortstat_output.splitlines() if line.strip()]
    shortstat = shortstat_lines[-1] if shortstat_lines else ""

    diff = run_git(
        ["show", "--patch", "--unified=2", "--no-color", "--format=fuller", sha],
        strip=False,
    )[:MAX_DIFF_CHARS]

    parent_line = run_git(["rev-list", "--parents", "-n", "1", "HEAD"])
    parent_count = max(len(parent_line.split()) - 1, 0)

    return CommitContext(
        sha=sha,
        full_message=full_message,
        subject=subject,
        body=body,
        shortstat=shortstat,
        changed_files=changed_files,
        diff=diff,
        parent_count=parent_count,
    )


def infer_fallback_subject(files: list[str]) -> str:
    if not files:
        return "chore: improve commit message quality for repository updates"

    docs_only = all(file.endswith(".md") or file.startswith("docs/") for file in files)
    has_ci = any(file.startswith(".github/") for file in files)
    has_tests = any(
        file.startswith("test/")
        or file.startswith("tests/")
        or file.endswith(".spec.js")
        or file.endswith(".spec.ts")
        or file.endswith(".test.js")
        or file.endswith(".test.ts")
        for file in files
    )
    has_app_code = any(
        file.startswith("server/")
        or file.startswith("public/")
        or file.endswith(".js")
        or file.endswith(".ts")
        for file in files
    )

    if docs_only:
        subject = "docs: expand documentation details for recent changes"
    elif has_ci:
        subject = "Refine automation to enforce better commit messages"
    elif has_tests:
        subject = "test: improve test coverage for recent code updates"
    elif has_app_code:
        subject = "feat: improve application behavior in updated modules"
    else:
        subject = "chore: organize and describe repository file updates"

    first_file = files[0]
    if len(first_file) <= 28:
        suffix = f" ({first_file})"
        if len(subject) + len(suffix) <= 72:
            subject += suffix

    if len(subject) > 72:
        subject = subject[:72].rstrip()

    return subject


def build_fallback_message(context: CommitContext, reason: str) -> str:
    subject = infer_fallback_subject(context.changed_files)
    preview = ", ".join(context.changed_files[:5]) if context.changed_files else "none"
    file_count = len(context.changed_files)

    bullets = [
        f"- Rewrite a {reason} into a clearer, detailed commit description.",
        f"- Touch {file_count} file(s): {preview}.",
    ]
    if context.shortstat:
        bullets.append(f"- Diff summary: {context.shortstat}.")
    bullets.append("- Keep commit history readable and searchable for collaborators.")

    return "\n".join([subject, "", *bullets, "", MARKER]).strip() + "\n"


def strip_fences(text: str) -> str:
    value = text.strip()
    if value.startswith("```"):
        value = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", value)
        value = re.sub(r"\n?```$", "", value)
    return value.strip()


def strip_ci_prefix_from_message(message: str) -> str:
    lines = message.splitlines()
    if not lines:
        return message

    subject = lines[0].strip()
    cleaned_subject = CI_PREFIX_RE.sub("", subject).strip()
    if cleaned_subject:
        lines[0] = cleaned_subject

    return "\n".join(lines)


def validate_generated_message(message: str) -> bool:
    lines = [line.rstrip() for line in message.splitlines()]
    if not lines:
        return False

    subject = lines[0].strip()
    if CI_PREFIX_RE.match(subject):
        return False
    if is_weak_subject(subject):
        return False
    if len(subject) > 72:
        return False

    body_lines = [line.strip() for line in lines[1:] if line.strip()]
    bullets = [line for line in body_lines if re.match(r"^[-*]\s+\S+", line)]
    if len(bullets) < 2:
        return False

    return True


def call_copilot(context: CommitContext, reason: str, token: str) -> str | None:
    files_section = "\n".join(context.changed_files) or "(no files listed)"
    payload = {
        "model": os.getenv("COPILOT_MODEL", "gpt-4o"),
        "temperature": 0.2,
        "max_tokens": 360,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You write high-quality git commit messages. Return only commit message text. "
                    "Format: first line is a clear, specific subject under 72 chars, "
                    "then a blank line, then 3-6 bullet points beginning with '- '. "
                    "Do not start the subject with 'ci:'. "
                    "Use only real changes from provided diff/files and do not invent facts. "
                    f"End with '{MARKER}' on its own line."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Current subject: {context.subject}\n"
                    f"Reason to rewrite: {reason}\n"
                    f"Short stat: {context.shortstat}\n"
                    f"Changed files:\n{files_section}\n\n"
                    f"Git diff:\n{context.diff}"
                ),
            },
        ],
    }

    req = request.Request(
        COPILOT_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Copilot-Integration-Id": "github-actions",
            "Editor-Version": "vscode/1.90.0",
            "Editor-Plugin-Version": "copilot-chat/0.17.0",
        },
    )

    try:
        with request.urlopen(req, timeout=60) as response:
            raw = response.read().decode("utf-8")
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        print(f"Copilot API HTTP error: {exc.code} {details}", file=sys.stderr)
        return None
    except error.URLError as exc:
        print(f"Copilot API request failed: {exc.reason}", file=sys.stderr)
        return None

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        print("Copilot API returned invalid JSON.", file=sys.stderr)
        return None

    content = (
        parsed.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .replace("\r", "")
        .strip()
    )
    if not content:
        return None

    cleaned = strip_fences(content)
    cleaned = strip_ci_prefix_from_message(cleaned)
    if MARKER not in cleaned:
        cleaned = f"{cleaned.rstrip()}\n\n{MARKER}"
    cleaned = cleaned.strip() + "\n"

    if not validate_generated_message(cleaned):
        print("Copilot output did not pass validation checks.", file=sys.stderr)
        return None

    return cleaned


def normalize_message_for_compare(message: str) -> str:
    return "\n".join(line.rstrip() for line in message.strip().splitlines()).strip()


def resolve_target_branch() -> str:
    branch = os.getenv("GITHUB_REF_NAME", "").strip()
    if branch:
        return branch

    ref = os.getenv("GITHUB_REF", "").strip()
    if ref.startswith("refs/heads/"):
        return ref.removeprefix("refs/heads/")

    fallback = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    if fallback == "HEAD":
        raise RuntimeError("Detached HEAD: unable to determine target branch.")
    return fallback


def amend_and_push(message_path: Path) -> None:
    actor = os.getenv("GITHUB_ACTOR", "github-actions[bot]")
    name = os.getenv("COMMIT_USER_NAME", "").strip() or actor
    email = os.getenv("COMMIT_USER_EMAIL", "").strip() or f"{actor}@users.noreply.github.com"

    subprocess.run(["git", "config", "user.name", name], check=True)
    subprocess.run(["git", "config", "user.email", email], check=True)
    subprocess.run(["git", "commit", "--amend", "-F", str(message_path), "--no-verify"], check=True)

    branch = resolve_target_branch()
    subprocess.run(["git", "push", "--force-with-lease", "origin", f"HEAD:{branch}"], check=True)
    print(f"Rewrote and pushed improved commit message to {branch}.")


def should_rewrite(context: CommitContext, require_detailed_body: bool) -> tuple[bool, str]:
    if MARKER in context.full_message:
        return False, "already rewritten commit message"
    if context.parent_count > 1:
        return False, "merge commit"
    if is_weak_subject(context.subject):
        return True, "weak commit subject"
    if require_detailed_body and not has_detailed_body(context.body):
        return True, "too-short commit message"
    return False, "commit message already detailed"


def main() -> int:
    try:
        context = get_commit_context()
        require_detailed_body = parse_bool(os.getenv("REWRITE_WHEN_BODY_MISSING"), default=True)
        dry_run = parse_bool(os.getenv("COMMIT_REWRITE_DRY_RUN"), default=False)

        rewrite, reason = should_rewrite(context, require_detailed_body=require_detailed_body)
        if not rewrite:
            print(f"Skipping rewrite: {reason}.")
            return 0

        print(f"Commit message rewrite required ({reason}).")
        token = os.getenv("COPILOT_TOKEN", "").strip()

        rewritten = None
        if token:
            rewritten = call_copilot(context, reason=reason, token=token)
        else:
            print("COPILOT_TOKEN is missing; using deterministic fallback message.")

        if rewritten is None:
            rewritten = build_fallback_message(context, reason=reason)

        current_normalized = normalize_message_for_compare(context.full_message)
        rewritten_normalized = normalize_message_for_compare(rewritten)
        if current_normalized == rewritten_normalized:
            print("Generated commit message matches current message; skipping amend.")
            return 0

        MESSAGE_FILE.write_text(rewritten, encoding="utf-8")
        print(f"Prepared rewritten commit message at {MESSAGE_FILE}.")

        if dry_run:
            print("Dry run enabled; skipping amend and push.")
            return 0

        amend_and_push(MESSAGE_FILE)
        return 0
    except subprocess.CalledProcessError as exc:
        print(f"Git command failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"Commit message rewrite failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
