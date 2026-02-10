"""
Anthropic API client wrapper.

WHY A WRAPPER:
Instead of calling the Anthropic SDK directly everywhere, we wrap it.
This gives us one place to:
  - Handle errors consistently
  - Track tokens automatically  
  - Parse JSON responses
  - Switch models easily

The Anthropic Python SDK is straightforward: you create a client,
call client.messages.create(), and get back a response with
.content[0].text (the text) and .usage (token counts).
"""

import json
import anthropic
from config import app_config, get_api_key
from token_tracker import TokenTracker
from prompts import (
    SCENARIO_SYSTEM_PROMPT,
    get_scenario_user_prompt,
    REVIEW_SYSTEM_PROMPT,
    get_review_user_prompt,
    IMPROVEMENT_SYSTEM_PROMPT,
    get_improvement_user_prompt,
    CHECKLIST_REVIEW_SYSTEM_PROMPT,
    get_checklist_review_prompt,
    QUICK_SCENARIO_SYSTEM_PROMPT,
    get_quick_scenario_user_prompt,
    QUICK_GRADE_SYSTEM_PROMPT,
    get_quick_grade_user_prompt,
)


def _get_client() -> anthropic.Anthropic:
    """
    Create an Anthropic client instance.
    
    WHY CREATE FRESH EACH TIME:
    The client is lightweight and stateless. Creating it fresh
    ensures we always use the current API key (in case it changes).
    For a high-traffic app you'd reuse it, but for personal use
    this is simpler and more robust.
    """
    return anthropic.Anthropic(api_key=get_api_key())


def _call_claude(
    system_prompt: str,
    user_prompt: str,
    tracker: TokenTracker,
    call_label: str,
    max_tokens: int = 8192,
) -> dict:
    """
    Make a single Claude API call and return parsed JSON.
    
    WHY PARSE JSON HERE:
    All our prompts ask Claude to return JSON. By parsing it here,
    every calling function gets a Python dict back instead of a
    raw string. If parsing fails, we get a clear error.
    
    Args:
        system_prompt: The system message (instructions for Claude)
        user_prompt: The user message (what we want Claude to do)
        tracker: TokenTracker to record usage
        call_label: Human name for this call (for cost display)
        max_tokens: Maximum output tokens (default 8192)
    
    Returns:
        Parsed JSON as a Python dict
    
    Raises:
        ValueError: If Claude's response isn't valid JSON
        anthropic.APIError: If the API call fails
    """
    client = _get_client()
    model = app_config.model

    # Check cost budget before making the call
    current_cost = tracker.estimate_cost(model)
    if current_cost >= app_config.cost_limit:
        raise ValueError(
            f"Cost limit reached: ${current_cost:.2f} >= ${app_config.cost_limit:.2f}. "
            f"Increase cost_limit in settings to continue."
        )

    response = client.messages.create(
        model=model.api_name,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    # Track token usage from the response
    # response.usage has .input_tokens and .output_tokens
    tracker.track(
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        call_label=call_label,
    )

    # Extract text from response
    # response.content is a list of content blocks; we want the text one
    raw_text = response.content[0].text

    # Parse JSON — Claude sometimes wraps in ```json fences despite instructions
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        # Remove markdown code fence
        cleaned = cleaned.split("\n", 1)[1]  # Remove first line (```json)
        cleaned = cleaned.rsplit("```", 1)[0]  # Remove last fence
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        # If JSON parsing fails, return the raw text in a wrapper
        # so the caller can still display something useful
        return {
            "error": "Failed to parse JSON response",
            "raw_response": raw_text,
            "parse_error": str(e),
        }


def generate_scenario(tracker: TokenTracker) -> dict:
    """
    Generate a complete training scenario.

    This is API call #1 — creates everything the user will see
    during the exercise (request, 3 documents, data) plus the
    hidden rubric for grading.

    WHY ONE BIG CALL:
    Generating everything at once means Claude can ensure internal
    consistency — the data actually matches the documents, the
    rubric matches the scenario, etc. If we generated each piece
    separately, they might not connect well.

    Content length scales with timer settings — shorter timers
    produce shorter documents and data sets.
    """
    return _call_claude(
        system_prompt=SCENARIO_SYSTEM_PROMPT,
        user_prompt=get_scenario_user_prompt(
            domain=app_config.domain,
            difficulty=app_config.difficulty,
            timer_request=app_config.timer_request,
            timer_document=app_config.timer_document,
            timer_data=app_config.timer_data,
        ),
        tracker=tracker,
        call_label="scenario_generation",
        max_tokens=8192,  # Scenarios can be long
    )


def generate_review(
    scenario: dict, user_responses: dict, tracker: TokenTracker
) -> dict:
    """
    Generate detailed feedback on the user's performance.
    
    This is API call #2 — sent after the user completes all steps.
    We send the entire scenario (including rubric) plus all user notes.
    
    WHY SEND THE RUBRIC BACK:
    Even though Claude generated the rubric earlier, that was a
    different API call. Claude has no memory between calls — each
    one starts fresh. So we must re-send the rubric so Claude knows
    what the "right answers" are.
    """
    return _call_claude(
        system_prompt=REVIEW_SYSTEM_PROMPT,
        user_prompt=get_review_user_prompt(scenario, user_responses),
        tracker=tracker,
        call_label="review",
        max_tokens=4096,
    )


def generate_improvement_comparison(
    past_summaries: list[dict], current_feedback: dict, tracker: TokenTracker
) -> dict:
    """
    Compare current session to past sessions (optional API call #3).

    Only called when there are previous sessions to compare against.
    Uses less tokens because we only send summaries, not full sessions.
    """
    return _call_claude(
        system_prompt=IMPROVEMENT_SYSTEM_PROMPT,
        user_prompt=get_improvement_user_prompt(past_summaries, current_feedback),
        tracker=tracker,
        call_label="improvement_comparison",
        max_tokens=1024,
    )


def review_checklist(
    document: dict,
    checklist: list[dict],
    rubric_key_concepts: list[str],
    tracker: TokenTracker,
) -> dict:
    """
    Review a trainee's parameter checklist for a specific document.

    Called after each document step to give immediate feedback on
    what parameters/thresholds were captured vs. missed.
    """
    return _call_claude(
        system_prompt=CHECKLIST_REVIEW_SYSTEM_PROMPT,
        user_prompt=get_checklist_review_prompt(document, checklist, rubric_key_concepts),
        tracker=tracker,
        call_label="checklist_review",
        max_tokens=1024,
    )


# ──────────────────────────────────────────────
# QUICK PRACTICE FUNCTIONS
# ──────────────────────────────────────────────

def generate_quick_scenario(duration_mode: str, domain: str | None, tracker: TokenTracker) -> dict:
    """
    Generate a quick practice scenario with bullet points.

    Args:
        duration_mode: "2.5min", "5min", or "10min"
        domain: Engineering domain or None for random
        tracker: Token tracker
    """
    return _call_claude(
        system_prompt=QUICK_SCENARIO_SYSTEM_PROMPT,
        user_prompt=get_quick_scenario_user_prompt(duration_mode, domain),
        tracker=tracker,
        call_label="quick_scenario",
        max_tokens=2048,
    )


def grade_quick_response(
    question: str,
    documents: list[dict],
    key_facts: list[str],
    ideal_response: str,
    user_response: str,
    tracker: TokenTracker,
) -> dict:
    """
    Grade a quick practice response.
    """
    return _call_claude(
        system_prompt=QUICK_GRADE_SYSTEM_PROMPT,
        user_prompt=get_quick_grade_user_prompt(
            question, documents, key_facts, ideal_response, user_response
        ),
        tracker=tracker,
        call_label="quick_grade",
        max_tokens=1024,
    )
