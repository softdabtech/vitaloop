"""OpenAI-backed AI service facade.

This module intentionally re-exports the legacy implementation while the codebase
is migrated away from the old claude_service name. New code should import from
app.services.ai.openai_service.
"""

from app.services.claude_service import *  # noqa: F401,F403
from app.services.claude_service import _chat_completions_path  # noqa: F401
