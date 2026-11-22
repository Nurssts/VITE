"""Request-level security helpers shared by the server and the AI routes."""
from __future__ import annotations

import os

from fastapi import Request


def client_ip(request: Request) -> str:
    """Real client address for rate limiting.

    Render (and most hosts) APPEND the connecting address to X-Forwarded-For, so the trusted
    value is counted from the RIGHT. The left part is whatever the client sent and can be forged
    to dodge rate limits. TRUSTED_PROXY_HOPS = number of proxies in front of the app (default 1).
    """
    forwarded = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    try:
        hops = max(1, int(os.getenv("TRUSTED_PROXY_HOPS", "1")))
    except ValueError:
        hops = 1
    if forwarded:
        return forwarded[-hops] if len(forwarded) >= hops else forwarded[0]
    return request.client.host if request.client else "unknown"
