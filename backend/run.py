#!/usr/bin/env python3
"""Application entry point."""

import os

if __name__ == "__main__":
    import uvicorn

    env = os.getenv("ENV", "development").lower()
    is_dev = env in ("development", "dev")

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=is_dev,
        workers=1 if is_dev else int(os.getenv("WORKERS", "2")),
    )