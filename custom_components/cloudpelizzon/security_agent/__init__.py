"""CloudPelizzon Security Agent.

AUDIT-only agent.

This package must never make the main CloudPelizzon config entry fail.
"""

from __future__ import annotations

from .agent import (
    async_start,
    async_stop,
)

__all__ = [
    "async_start",
    "async_stop",
]
