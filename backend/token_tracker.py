"""
Token usage and cost tracking for a session.

WHY THIS EXISTS:
The Anthropic API returns exact token counts in every response.
We capture those and convert to dollar amounts so the user can
see their running cost and we can enforce the budget limit.

HOW IT WORKS:
Each session gets a TokenTracker instance. After every API call,
we call track() with the usage data from the response. The tracker
accumulates totals and can estimate cost at any time.
"""

from dataclasses import dataclass, field
from config import ModelConfig


@dataclass
class TokenTracker:
    """
    Accumulates token usage across multiple API calls in a session.
    
    WHY TRACK INPUT AND OUTPUT SEPARATELY:
    They have very different prices. Opus charges $15/M for input
    but $75/M for output — output is 5x more expensive. So a response
    with lots of output tokens costs way more than one that reads
    a lot but says little.
    """
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    call_count: int = 0

    # We store per-call breakdowns for debugging/display
    calls: list = field(default_factory=list)

    def track(self, input_tokens: int, output_tokens: int, call_label: str = ""):
        """
        Record tokens from one API call.
        
        Args:
            input_tokens: Number of input tokens (from response.usage.input_tokens)
            output_tokens: Number of output tokens (from response.usage.output_tokens)
            call_label: Human-readable label like "scenario_generation"
        """
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.call_count += 1
        self.calls.append({
            "label": call_label,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        })

    def estimate_cost(self, model: ModelConfig) -> float:
        """
        Calculate estimated cost in dollars.
        
        WHY THE DIVISION BY 1_000_000:
        Pricing is per million tokens. So if you used 15,000 input tokens
        at $15/M, that's 15000 / 1000000 * 15 = $0.225
        
        Python lets you use underscores in numbers for readability:
        1_000_000 == 1000000 but is much easier to read.
        """
        input_cost = (self.total_input_tokens / 1_000_000) * model.input_cost_per_m
        output_cost = (self.total_output_tokens / 1_000_000) * model.output_cost_per_m
        return round(input_cost + output_cost, 4)

    def to_dict(self, model: ModelConfig) -> dict:
        """Serialize for JSON storage and API responses."""
        return {
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "call_count": self.call_count,
            "calls": self.calls,
            "estimated_cost": self.estimate_cost(model),
        }
