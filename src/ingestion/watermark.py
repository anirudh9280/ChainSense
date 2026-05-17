"""CK: Tracks the last block successfully processed. Enables incremental runs."""
import json
from pathlib import Path

WATERMARK_PATH = Path("data/processed/_watermark.json")

def read_watermark():
    """Return last processed block, or None if pipeline has never run."""
    if not WATERMARK_PATH.exists():
        return None
    return json.loads(WATERMARK_PATH.read_text())["last_block"]

def write_watermark(block_num):
    """Advance the watermark. Call only after a stage fully succeeds."""
    WATERMARK_PATH.parent.mkdir(parents=True, exist_ok=True)
    WATERMARK_PATH.write_text(json.dumps({"last_block": block_num}))
    print(f"  watermark advanced to block {block_num}")