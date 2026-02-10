"""
Configuration for the Engineering Document Practice Tool.

WHY THIS FILE EXISTS:
Instead of scattering magic numbers and strings throughout the code,
we put all configurable values here. This makes it easy to change
the model, adjust timers, or update pricing without hunting through
multiple files.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ModelConfig:
    """
    Holds info about a Claude model — its API name and pricing.
    
    WHY A DATACLASS:
    dataclass auto-generates __init__, __repr__, etc. from the fields.
    It's Python's way of saying "this is just a container for data"
    without writing boilerplate. Think of it like a struct in C.
    """
    api_name: str           # e.g. "claude-opus-4-6"
    display_name: str       # e.g. "Opus 4.6" (for the UI)
    input_cost_per_m: float   # dollars per 1M input tokens
    output_cost_per_m: float  # dollars per 1M output tokens


# Available models — add new ones here as they release
MODELS = {
    "opus": ModelConfig(
        api_name="claude-opus-4-6",
        display_name="Opus 4.6",
        input_cost_per_m=15.0,
        output_cost_per_m=75.0,
    ),
    "sonnet": ModelConfig(
        api_name="claude-sonnet-4-5-20250929",
        display_name="Sonnet 4.5",
        input_cost_per_m=3.0,
        output_cost_per_m=15.0,
    ),
    "haiku": ModelConfig(
        api_name="claude-haiku-4-5-20251001",
        display_name="Haiku 4.5",
        input_cost_per_m=0.80,
        output_cost_per_m=4.0,
    ),
}


@dataclass
class AppConfig:
    """
    All runtime settings for the app.
    
    WHY DEFAULTS HERE:
    These are sensible starting values. The user can change them
    via the settings modal in the UI, which calls PATCH /api/config.
    """
    # Which model to use (key into MODELS dict)
    model_key: str = "opus"

    # Timer durations in seconds (7 minutes = 420 seconds)
    timer_request: int = 420       # Step 2: Read the request
    timer_document: int = 420      # Steps 3-5: Read each document
    timer_predictions: int = 420   # Step 6: Write data predictions
    timer_data: int = 420          # Step 7: Examine data

    # Cost limit per session in dollars
    cost_limit: float = 4.00

    # Engineering domain — None means "pick randomly"
    domain: Optional[str] = None

    # Difficulty level
    difficulty: str = "intermediate"  # beginner, intermediate, advanced

    @property
    def model(self) -> ModelConfig:
        """Look up the full ModelConfig from the key."""
        return MODELS[self.model_key]


def get_api_key() -> str:
    """
    Read the Anthropic API key from environment.
    
    WHY NOT HARDCODE IT:
    API keys should NEVER be in source code. If you push code to GitHub
    with a key in it, bots will find it within minutes and abuse it.
    We read from the .env file (loaded by the server) or environment.
    """
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise ValueError(
            "ANTHROPIC_API_KEY not set. Create a .env file with:\n"
            "ANTHROPIC_API_KEY=sk-ant-..."
        )
    return key


# Global config instance — modified by PATCH /api/config
app_config = AppConfig()
