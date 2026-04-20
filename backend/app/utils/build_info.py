from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import subprocess


APP_VERSION = "2.1.2"
SERVICE_NAME = "vitaloop-api"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _read_release_version() -> str:
    version_file = _repo_root() / "VERSION"
    if not version_file.exists():
        return APP_VERSION

    value = version_file.read_text(encoding="utf-8").strip()
    return value or APP_VERSION


def _read_git_value(*args: str) -> str | None:
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=_repo_root(),
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return None

    value = (completed.stdout or "").strip()
    return value or None


@lru_cache(maxsize=1)
def get_build_info() -> dict[str, str | None]:
    return {
        "service": SERVICE_NAME,
        "app_version": APP_VERSION,
        "release_version": _read_release_version(),
        "commit": _read_git_value("rev-parse", "HEAD"),
        "short_commit": _read_git_value("rev-parse", "--short=12", "HEAD"),
        "branch": _read_git_value("rev-parse", "--abbrev-ref", "HEAD"),
    }