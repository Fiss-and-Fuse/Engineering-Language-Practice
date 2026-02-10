"""
Session storage — save and load training sessions as JSON files.

WHY JSON FILES:
For a single-user training tool, JSON files are perfect:
  - Human-readable (you can open them in any text editor)
  - No database setup required
  - Easy to back up (just copy the folder)
  - Easy to migrate later if needed

Each session is one file in the sessions/ directory, named by
session ID (which is a timestamp-based string).

FILE STRUCTURE:
  sessions/
    2026-02-07_001.json
    2026-02-07_002.json
    2026-02-08_001.json
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

# Where session files live — relative to the project root
SESSIONS_DIR = Path(__file__).parent.parent / "sessions"


def _ensure_dir():
    """Create the sessions directory if it doesn't exist."""
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def generate_session_id() -> str:
    """
    Create a unique session ID like '2026-02-07_001'.
    
    WHY THIS FORMAT:
    - Date prefix makes it easy to find sessions from a specific day
    - Counter suffix handles multiple sessions per day
    - Human-readable (unlike UUIDs which look like gibberish)
    
    HOW THE COUNTER WORKS:
    We look at existing files for today and find the highest counter,
    then add 1. If no files exist for today, we start at 001.
    """
    _ensure_dir()
    today = datetime.now().strftime("%Y-%m-%d")

    # Find existing sessions for today
    existing = [
        f.stem for f in SESSIONS_DIR.glob(f"{today}_*.json")
    ]

    if existing:
        # Extract the counter part (after the last underscore)
        counters = [int(name.split("_")[-1]) for name in existing]
        next_counter = max(counters) + 1
    else:
        next_counter = 1

    return f"{today}_{next_counter:03d}"  # :03d pads to 3 digits


def save_session(session_id: str, data: dict) -> str:
    """
    Save a session to disk.
    
    Args:
        session_id: The session identifier (e.g. '2026-02-07_001')
        data: The complete session data dict
    
    Returns:
        The file path where it was saved
    
    WHY json.dumps WITH indent=2:
    Pretty-printing makes the files human-readable. The tiny
    extra disk space is worth it when you want to inspect a session
    manually. sort_keys=False preserves insertion order.
    """
    _ensure_dir()
    filepath = SESSIONS_DIR / f"{session_id}.json"
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return str(filepath)


def load_session(session_id: str) -> Optional[dict]:
    """
    Load a session from disk. Returns None if not found.
    
    WHY RETURN NONE INSTEAD OF RAISING:
    The caller can decide what to do — show a 404, create a new
    session, etc. Raising an exception here would force try/except
    everywhere this is called.
    """
    filepath = SESSIONS_DIR / f"{session_id}.json"
    if not filepath.exists():
        return None
    with open(filepath) as f:
        return json.load(f)


def list_sessions() -> list[dict]:
    """
    List all sessions with basic metadata.
    
    Returns a list of dicts with id, timestamp, domain, overall_score.
    Sorted newest first.
    
    WHY NOT RETURN FULL SESSIONS:
    Full sessions can be large (all documents + notes + feedback).
    For the list view, we only need summary info. The frontend
    can request full details for a specific session if needed.
    """
    _ensure_dir()
    sessions = []

    for filepath in sorted(SESSIONS_DIR.glob("*.json"), reverse=True):
        try:
            with open(filepath) as f:
                data = json.load(f)
            sessions.append({
                "session_id": filepath.stem,
                "timestamp": data.get("timestamp", ""),
                "domain": data.get("domain", "unknown"),
                "difficulty": data.get("difficulty", "unknown"),
                "model_used": data.get("model_used", "unknown"),
                "overall_score": (
                    data.get("feedback", {})
                    .get("overall", {})
                    .get("score", None)
                ),
                "estimated_cost": (
                    data.get("token_usage", {})
                    .get("estimated_cost", None)
                ),
            })
        except (json.JSONDecodeError, KeyError):
            # Skip corrupted files
            continue

    return sessions


def get_past_summaries(limit: int = 5) -> list[dict]:
    """
    Get summary data from past sessions for the improvement comparison.
    
    WHY A SEPARATE FUNCTION:
    The improvement comparison prompt only needs scores and summaries,
    not full session data. This extracts just what's needed to keep
    the API call token-efficient.
    
    Args:
        limit: Maximum number of past sessions to include
    """
    _ensure_dir()
    summaries = []

    for filepath in sorted(SESSIONS_DIR.glob("*.json"), reverse=True):
        if len(summaries) >= limit:
            break
        try:
            with open(filepath) as f:
                data = json.load(f)
            feedback = data.get("feedback", {})
            overall = feedback.get("overall", {})
            if overall:  # Only include completed sessions
                summaries.append({
                    "session_id": filepath.stem,
                    "overall_score": overall.get("score"),
                    "summary": overall.get("summary", ""),
                    "top_improvement": overall.get("top_improvement", ""),
                })
        except (json.JSONDecodeError, KeyError):
            continue

    return summaries


# ──────────────────────────────────────────────
# QUICK PRACTICE SESSION STORAGE
# ──────────────────────────────────────────────
# Separate directory for quick practice sessions so they don't mix
# with full practice sessions.

QUICK_SESSIONS_DIR = Path(__file__).parent.parent / "sessions" / "quick"


def _ensure_quick_dir():
    """Create the quick sessions directory if it doesn't exist."""
    QUICK_SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def generate_quick_session_id() -> str:
    """Create a unique quick session ID like 'quick_2026-02-07_001'."""
    _ensure_quick_dir()
    today = datetime.now().strftime("%Y-%m-%d")

    existing = [
        f.stem for f in QUICK_SESSIONS_DIR.glob(f"quick_{today}_*.json")
    ]

    if existing:
        counters = [int(name.split("_")[-1]) for name in existing]
        next_counter = max(counters) + 1
    else:
        next_counter = 1

    return f"quick_{today}_{next_counter:03d}"


def save_quick_session(session_id: str, data: dict) -> str:
    """Save a quick practice session."""
    _ensure_quick_dir()
    filepath = QUICK_SESSIONS_DIR / f"{session_id}.json"
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return str(filepath)


def load_quick_session(session_id: str) -> Optional[dict]:
    """Load a quick practice session."""
    filepath = QUICK_SESSIONS_DIR / f"{session_id}.json"
    if not filepath.exists():
        return None
    with open(filepath) as f:
        return json.load(f)


def list_quick_sessions() -> list[dict]:
    """List all quick practice sessions, newest first."""
    _ensure_quick_dir()
    sessions = []

    for filepath in sorted(QUICK_SESSIONS_DIR.glob("*.json"), reverse=True):
        try:
            with open(filepath) as f:
                data = json.load(f)
            sessions.append({
                "session_id": filepath.stem,
                "timestamp": data.get("timestamp", ""),
                "duration_mode": data.get("duration_mode", "unknown"),
                "question": data.get("question", ""),
                "user_response": data.get("user_response", ""),
                "feedback": data.get("feedback", {}),
                "device": data.get("device", "unknown"),
            })
        except (json.JSONDecodeError, KeyError):
            continue

    return sessions
