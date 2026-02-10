"""
Main FastAPI server for the Engineering Document Practice Tool.

WHY FASTAPI:
FastAPI is a modern Python web framework that:
  - Has async support (important for long API calls that would block)
  - Auto-generates API docs at /docs (great for debugging)
  - Uses Pydantic for request/response validation
  - Is lightweight — installs in seconds, runs fast

HOW THIS SERVER WORKS:
The server manages "sessions" — each session is one training exercise.
Sessions are stored in memory (active_sessions dict) while in progress,
and saved to JSON files when complete.

The frontend calls these endpoints in order:
  1. POST /api/session/start → generates scenario, returns session_id + request
  2. GET /api/session/{id}/doc/{n} → returns document n (revealed one at a time)
  3. GET /api/session/{id}/data → returns the data artifact
  4. POST /api/session/{id}/submit → saves user notes for a step
  5. POST /api/session/{id}/review → triggers AI review + saves everything
  6. GET /api/session/{id} → gets full session (for viewing history)
  7. GET /api/sessions → lists all past sessions
"""

import os
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
from typing import Optional

from config import app_config, MODELS
from claude_client import (
    generate_scenario,
    generate_review,
    generate_improvement_comparison,
    review_checklist,
    generate_quick_scenario,
    grade_quick_response,
)
from token_tracker import TokenTracker
from session_store import (
    generate_session_id,
    save_session,
    load_session,
    list_sessions,
    get_past_summaries,
    generate_quick_session_id,
    save_quick_session,
    list_quick_sessions,
)

# Load .env file if it exists (for ANTHROPIC_API_KEY)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")


# ──────────────────────────────────────────────
# In-memory storage for active (in-progress) sessions
# ──────────────────────────────────────────────
# WHY IN-MEMORY:
# While a session is in progress, we need fast access to the scenario
# data (to serve documents one at a time) and the user's notes
# (accumulating across steps). Once complete, everything gets saved
# to a JSON file and removed from memory.
#
# WHY A DICT:
# Python dicts are hash maps — O(1) lookup by session_id.
# For a single-user app, this is the simplest approach.

active_sessions: dict[str, dict] = {}


# ──────────────────────────────────────────────
# FastAPI app setup
# ──────────────────────────────────────────────

# Check if frontend build exists
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown logic."""
    print("🚀 Engineering Document Practice Tool starting...")
    print(f"   Model: {app_config.model.display_name}")
    print(f"   Cost limit: ${app_config.cost_limit:.2f}")
    yield
    print("👋 Shutting down...")

app = FastAPI(
    title="Engineering Document Practice Tool",
    lifespan=lifespan,
)

# CORS — allow the frontend dev server to talk to us
# WHY CORS:
# When the frontend runs on localhost:5173 (Vite dev server) and
# the backend runs on localhost:8000, the browser blocks requests
# between them by default (security feature). CORS headers tell
# the browser "it's okay, I trust that origin."
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Pydantic models for request/response bodies
# ──────────────────────────────────────────────
# WHY PYDANTIC:
# These define the shape of JSON that the frontend sends/receives.
# FastAPI uses them to validate incoming data automatically —
# if the frontend sends the wrong shape, FastAPI returns a 422
# error with details about what's wrong.

class SubmitNotesRequest(BaseModel):
    """Sent by frontend when user submits notes for a step."""
    step: str  # e.g. "deliverable_summary", "doc1_notes", etc.
    content: str
    time_used: int  # seconds the user spent on this step


class ConfigUpdate(BaseModel):
    """Sent by frontend to update settings."""
    model_key: Optional[str] = None
    timer_request: Optional[int] = None
    timer_document: Optional[int] = None
    timer_predictions: Optional[int] = None
    timer_data: Optional[int] = None
    cost_limit: Optional[float] = None
    domain: Optional[str] = None
    difficulty: Optional[str] = None


class ChecklistRow(BaseModel):
    """A single row in the parameter checklist."""
    id: str
    parameter: str
    check: str


class ChecklistReviewRequest(BaseModel):
    """Request to review a checklist for a document."""
    doc_num: int  # 1, 2, or 3
    checklist: list[ChecklistRow]


# ──────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────

@app.post("/api/session/start")
async def start_session():
    """
    Start a new training session.
    
    WHAT HAPPENS:
    1. Generate a unique session ID
    2. Call Claude to generate the entire scenario
    3. Store scenario in memory (for serving docs one at a time)
    4. Return the session ID and the client request (Step 2)
    
    WHY ASYNC:
    The Claude API call can take 10-30 seconds. Using async means
    the server isn't blocked while waiting — it could handle other
    requests (though for single-user that doesn't matter much).
    Note: The anthropic SDK call itself is synchronous, but wrapping
    in an async endpoint still keeps FastAPI's event loop responsive.
    """
    session_id = generate_session_id()
    tracker = TokenTracker()

    try:
        scenario = generate_scenario(tracker)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate scenario: {str(e)}")

    # Check for JSON parse error
    if "error" in scenario:
        raise HTTPException(
            status_code=500,
            detail=f"Scenario generation failed: {scenario.get('error')}. "
                   f"Raw response: {scenario.get('raw_response', '')[:500]}"
        )

    # Store in memory for the duration of the exercise
    active_sessions[session_id] = {
        "session_id": session_id,
        "timestamp": datetime.now().isoformat(),
        "model_used": app_config.model.api_name,
        "domain": app_config.domain or "random",
        "difficulty": app_config.difficulty,
        "scenario": scenario,
        "user_responses": {},
        "time_used": {},
        "tracker": tracker,  # Not serializable — only in memory
    }

    # Return background doc and request (other documents and data are revealed later)
    # Background timer is half the document timer
    timer_background = app_config.timer_document // 2

    return {
        "session_id": session_id,
        "background": scenario["background"],
        "request": scenario["request"],
        "config": {
            "timer_request": app_config.timer_request,
            "timer_document": app_config.timer_document,
            "timer_predictions": app_config.timer_predictions,
            "timer_data": app_config.timer_data,
            "timer_background": timer_background,
        },
        "cost_so_far": tracker.estimate_cost(app_config.model),
    }


@app.get("/api/session/{session_id}/doc/{doc_num}")
async def get_document(session_id: str, doc_num: int):
    """
    Get a specific document (1, 2, or 3).
    
    WHY SERVE DOCUMENTS ONE AT A TIME:
    The exercise reveals documents sequentially — the user shouldn't
    see Document 2 until they've finished reading Document 1.
    The frontend requests each document as the user progresses.
    
    (In practice, all docs are already in memory from the scenario
    generation. We're just controlling *when* they're revealed.)
    """
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if doc_num < 1 or doc_num > 3:
        raise HTTPException(status_code=400, detail="doc_num must be 1, 2, or 3")

    doc = session["scenario"]["documents"][doc_num - 1]  # 0-indexed
    return {"document": doc}


@app.get("/api/session/{session_id}/data")
async def get_data(session_id: str):
    """Get the data artifact for examination."""
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"data": session["scenario"]["data"]}


@app.post("/api/session/{session_id}/review-checklist")
async def review_checklist_endpoint(session_id: str, request: ChecklistReviewRequest):
    """
    Review the trainee's parameter checklist for a specific document.

    Called after each document step to provide immediate feedback on
    what parameters/thresholds were captured vs. missed.
    """
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if request.doc_num < 1 or request.doc_num > 3:
        raise HTTPException(status_code=400, detail="doc_num must be 1, 2, or 3")

    tracker: TokenTracker = session["tracker"]
    scenario = session["scenario"]

    # Get the document and its rubric key concepts
    document = scenario["documents"][request.doc_num - 1]
    rubric_key = f"key_concepts_doc{request.doc_num}"
    rubric_concepts = scenario["rubric"].get(rubric_key, [])

    # Convert checklist to list of dicts
    checklist_data = [row.model_dump() for row in request.checklist]

    try:
        feedback = review_checklist(
            document=document,
            checklist=checklist_data,
            rubric_key_concepts=rubric_concepts,
            tracker=tracker,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Checklist review failed: {str(e)}")

    return {
        "feedback": feedback,
        "cost_so_far": tracker.estimate_cost(app_config.model),
    }


@app.post("/api/session/{session_id}/submit")
async def submit_notes(session_id: str, request: SubmitNotesRequest):
    """
    Save user notes for a step.
    
    Called after each timed step completes (either timer runs out
    or user clicks "Submit & Continue").
    
    VALID STEP NAMES:
    - deliverable_summary (Step 2)
    - doc1_notes (Step 3)
    - doc2_notes (Step 4)
    - doc3_notes (Step 5)
    - data_predictions (Step 6)
    - data_notes (Step 7)
    """
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    valid_steps = [
        "background_notes", "deliverable_summary",
        "doc1_notes", "doc2_notes", "doc3_notes",
        "data_predictions", "data_notes",
    ]
    if request.step not in valid_steps:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid step '{request.step}'. Must be one of: {valid_steps}"
        )

    session["user_responses"][request.step] = request.content
    session["time_used"][request.step] = request.time_used

    return {"status": "saved", "step": request.step}


@app.post("/api/session/{session_id}/review")
async def review_session(session_id: str):
    """
    Trigger AI review of the completed session.
    
    WHAT HAPPENS:
    1. Send scenario + rubric + all user notes to Claude for grading
    2. Optionally compare to past sessions
    3. Save the complete session to a JSON file
    4. Remove from active memory
    5. Return feedback to the frontend
    
    THIS IS THE MOST EXPENSIVE API CALL because it sends everything.
    """
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    tracker: TokenTracker = session["tracker"]

    # API call #2: Generate review
    try:
        feedback = generate_review(
            scenario=session["scenario"],
            user_responses=session["user_responses"],
            tracker=tracker,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Review failed: {str(e)}")

    # API call #3 (optional): Improvement comparison
    improvement = None
    past_summaries = get_past_summaries(limit=5)
    if past_summaries and "error" not in feedback:
        try:
            improvement = generate_improvement_comparison(
                past_summaries=past_summaries,
                current_feedback=feedback,
                tracker=tracker,
            )
        except Exception:
            # Non-critical — don't fail the review if comparison fails
            improvement = None

    # Build the complete session record
    session_data = {
        "session_id": session["session_id"],
        "timestamp": session["timestamp"],
        "model_used": session["model_used"],
        "domain": session["domain"],
        "difficulty": session["difficulty"],
        "scenario": session["scenario"],
        "user_responses": session["user_responses"],
        "time_used": session["time_used"],
        "feedback": feedback,
        "improvement": improvement,
        "token_usage": tracker.to_dict(app_config.model),
    }

    # Save to disk
    save_session(session_id, session_data)

    # Remove from active memory
    del active_sessions[session_id]

    return {
        "feedback": feedback,
        "improvement": improvement,
        "token_usage": tracker.to_dict(app_config.model),
    }


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """
    Get a complete session (for viewing history).
    
    Checks active memory first, then falls back to disk.
    """
    # Check active sessions
    if session_id in active_sessions:
        session = active_sessions[session_id]
        return {
            "session_id": session["session_id"],
            "timestamp": session["timestamp"],
            "scenario": session["scenario"],
            "user_responses": session["user_responses"],
            "time_used": session["time_used"],
            "status": "in_progress",
        }

    # Check saved sessions
    data = load_session(session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Session not found")

    data["status"] = "complete"
    return data


@app.get("/api/sessions")
async def get_sessions():
    """List all past sessions (summary only)."""
    return {"sessions": list_sessions()}


@app.get("/api/cost/{session_id}")
async def get_cost(session_id: str):
    """Get current cost estimate for an active session."""
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found (may be completed)")

    tracker: TokenTracker = session["tracker"]
    return {
        "cost": tracker.estimate_cost(app_config.model),
        "limit": app_config.cost_limit,
        "tokens": tracker.to_dict(app_config.model),
    }


@app.get("/api/config")
async def get_config():
    """Get current configuration."""
    return {
        "model_key": app_config.model_key,
        "model_name": app_config.model.display_name,
        "available_models": {
            k: v.display_name for k, v in MODELS.items()
        },
        "timer_request": app_config.timer_request,
        "timer_document": app_config.timer_document,
        "timer_predictions": app_config.timer_predictions,
        "timer_data": app_config.timer_data,
        "cost_limit": app_config.cost_limit,
        "domain": app_config.domain,
        "difficulty": app_config.difficulty,
    }


@app.patch("/api/config")
async def update_config(update: ConfigUpdate):
    """
    Update configuration.
    
    WHY PATCH INSTEAD OF PUT:
    PATCH means "update only the fields I'm sending."
    PUT means "replace everything." PATCH is more convenient
    because the frontend can send just the fields that changed.
    
    The 'exclude_unset=True' trick: Pydantic knows which fields
    were actually sent vs. which are just defaults. So if the
    frontend sends {"model_key": "sonnet"}, only model_key gets
    updated — all other settings stay the same.
    """
    updates = update.model_dump(exclude_unset=True)

    for key, value in updates.items():
        if hasattr(app_config, key):
            setattr(app_config, key, value)

    return await get_config()


# ──────────────────────────────────────────────
# QUICK PRACTICE API ENDPOINTS
# ──────────────────────────────────────────────
# Simpler mobile-focused practice sessions.

# In-memory storage for active quick sessions
active_quick_sessions: dict[str, dict] = {}

DURATION_SECONDS = {
    "2.5min": 150,
    "5min": 300,
    "10min": 600,
}


class QuickStartRequest(BaseModel):
    """Request to start a quick practice session."""
    duration_mode: str  # "2.5min", "5min", or "10min"


class QuickSubmitRequest(BaseModel):
    """Request to submit a quick practice response."""
    response: str
    time_used: int  # seconds
    device: str  # "mobile" or "desktop"


@app.post("/api/quick/start")
async def start_quick_session(request: QuickStartRequest):
    """
    Start a new quick practice session.

    Returns the scenario with question and bullet points.
    """
    if request.duration_mode not in DURATION_SECONDS:
        raise HTTPException(status_code=400, detail="Invalid duration mode")

    session_id = generate_quick_session_id()
    tracker = TokenTracker()

    try:
        scenario = generate_quick_scenario(
            duration_mode=request.duration_mode,
            domain=app_config.domain,
            tracker=tracker,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate scenario: {str(e)}")

    if "error" in scenario:
        raise HTTPException(status_code=500, detail=f"Scenario generation failed: {scenario.get('error')}")

    # Store in memory
    active_quick_sessions[session_id] = {
        "session_id": session_id,
        "timestamp": datetime.now().isoformat(),
        "duration_mode": request.duration_mode,
        "scenario": scenario,
        "tracker": tracker,
    }

    return {
        "session_id": session_id,
        "question": scenario["question"],
        "documents": scenario["documents"],
        "timer_seconds": DURATION_SECONDS[request.duration_mode],
    }


@app.post("/api/quick/{session_id}/submit")
async def submit_quick_session(session_id: str, request: QuickSubmitRequest):
    """
    Submit a response and get grading.
    """
    session = active_quick_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    tracker: TokenTracker = session["tracker"]
    scenario = session["scenario"]

    try:
        feedback = grade_quick_response(
            question=scenario["question"],
            documents=scenario["documents"],
            key_facts=scenario["key_facts"],
            ideal_response=scenario["ideal_response"],
            user_response=request.response,
            tracker=tracker,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(e)}")

    # Check for parsing errors from Claude
    if "error" in feedback:
        raise HTTPException(status_code=500, detail=f"Grading parse error: {feedback.get('error')}")

    # Save the complete session
    session_data = {
        "session_id": session_id,
        "timestamp": session["timestamp"],
        "duration_mode": session["duration_mode"],
        "question": scenario["question"],
        "documents": scenario["documents"],
        "key_facts": scenario["key_facts"],
        "ideal_response": scenario["ideal_response"],
        "user_response": request.response,
        "time_used": request.time_used,
        "device": request.device,
        "feedback": feedback,
        "token_usage": tracker.to_dict(app_config.model),
    }
    save_quick_session(session_id, session_data)

    # Remove from active memory
    del active_quick_sessions[session_id]

    return {"feedback": feedback}


@app.get("/api/quick/sessions")
async def get_quick_sessions():
    """List all past quick practice sessions."""
    return {"sessions": list_quick_sessions()}


# Serve frontend static files (if built)
# Check for mobile-dist first (deployed version), then regular frontend
MOBILE_DIST_DIR = Path(__file__).parent.parent / "mobile-dist"

if MOBILE_DIST_DIR.exists():
    # Deployed version - serve mobile app
    app.mount("/", StaticFiles(directory=str(MOBILE_DIST_DIR), html=True), name="mobile")
elif FRONTEND_DIR.exists():
    # Local dev - serve desktop frontend
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
