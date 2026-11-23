"""Runner for AI Service ensuring compatible event loop on Windows."""

import asyncio
import selectors
import sys
from pathlib import Path

# Add apps/ai-service to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "ai-service"))

import uvicorn

def main():
    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        config = uvicorn.Config("src.main:app", host="127.0.0.1", port=8000, loop="none", log_level="info")
        server = uvicorn.Server(config)
        loop.run_until_complete(server.serve())
    else:
        uvicorn.run("src.main:app", host="127.0.0.1", port=8000)

if __name__ == "__main__":
    main()
