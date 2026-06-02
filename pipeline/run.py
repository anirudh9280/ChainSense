"""ChainSense — single-process runner: extract + transform + classify + API, one terminal.

The three pipeline loops run as daemon threads; uvicorn serves server.py on the main
thread. They share only two SQLite-WAL files (live_lut.sqlite for pipeline state +
live_feat.sqlite for live wallet features — many readers, one writer), so co-locating
them is safe. Ctrl+C stops everything.

    python pipeline/run.py

Author: Chris Kim
"""
import fcntl
import os
import sys
import threading
from pathlib import Path

import uvicorn

import classify
import extract
import server
import transform

# Single-instance guard. The three loops write the same bronze parquet + SQLite-WAL
# files, so two runners at once would race/corrupt them. We hold an exclusive flock for
# the life of the process; a second `run.py` fails to acquire it and exits cleanly
# before starting any threads. The handle is module-global so it stays open (and the
# lock held) until the process dies — the OS releases it automatically on exit/kill.
_LOCK_PATH = Path(__file__).parent / "data" / "run.lock"
_lock_fh = None


def _acquire_single_instance_lock():
    global _lock_fh
    _LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    _lock_fh = open(_LOCK_PATH, "w")
    try:
        fcntl.flock(_lock_fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        sys.exit(f"another ChainSense pipeline is already running (lock held: {_LOCK_PATH}); exiting")
    _lock_fh.write(str(os.getpid()))
    _lock_fh.flush()


def main():
    _acquire_single_instance_lock()
    # Bind to the platform-provided PORT (Heroku/Railway/etc.) when present;
    # default to localhost:8001 for local dev.
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8001"))
    loops = {"extract": extract.main, "transform": transform.main, "classify": classify.main}
    for name, fn in loops.items():
        threading.Thread(target=fn, name=name, daemon=True).start()
    print(f"pipeline up — {', '.join(loops)} as daemon threads; API on http://{host}:{port} (Ctrl+C to stop)")
    uvicorn.run(server.app, host=host, port=port)


if __name__ == "__main__":
    main()