"""Run the full ingestion pipeline end-to-end.

Usage:
    python scripts/run_pipeline.py                       # incremental: from watermark to head
    python scripts/run_pipeline.py --window 5000         # first run: pull last 5000 blocks
    python scripts/run_pipeline.py --start 19000000 --end 19020000   # manual range
    python scripts/run_pipeline.py --skip-receipts       # quick test without the slow stage
"""
import sys
import time
import argparse
from pathlib import Path

# Make `src` importable when running this file directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ingestion.rpc import latest_block
from src.ingestion.watermark import read_watermark, write_watermark
from src.ingestion.fetch_blocks import fetch_blocks, SAFETY_BUFFER, DEFAULT_WINDOW
from src.ingestion.fetch_logs import fetch_logs
from src.ingestion.fetch_receipts import fetch_receipts
from src.ingestion.classify_addresses import classify_addresses


def run_stage(name, func, *args, **kwargs):
    """Run a stage with a banner and timing."""
    print(f"\n{'='*60}\nSTAGE: {name}\n{'='*60}")
    t0 = time.time()
    func(*args, **kwargs)
    elapsed = time.time() - t0
    print(f"{name} done in {elapsed/60:.1f} min ({elapsed:.0f}s)")


def main():
    p = argparse.ArgumentParser(description="Run the chainsense ingestion pipeline.")
    p.add_argument("--start", type=int, help="Override start block (default: watermark + 1)")
    p.add_argument("--end",   type=int, help="Override end block (default: latest - safety buffer)")
    p.add_argument("--window", type=int, default=DEFAULT_WINDOW,
                   help=f"Blocks to pull on first run if no watermark (default: {DEFAULT_WINDOW})")
    p.add_argument("--skip-receipts", action="store_true", help="Skip fetch_receipts (slow stage)")
    p.add_argument("--skip-classify", action="store_true", help="Skip classify_addresses")
    args = p.parse_args()

    # Resolve block range
    last = read_watermark()
    end = args.end if args.end is not None else latest_block() - SAFETY_BUFFER
    if args.start is not None:
        start = args.start
    elif last is not None:
        start = last + 1
    else:
        start = end - args.window + 1

    print(f"Watermark:      {last}")
    print(f"Block range:    {start:,} -> {end:,}  ({end - start + 1:,} blocks)")

    if start > end:
        print(f"Nothing to do — start ({start}) > end ({end}).")
        return

    pipeline_t0 = time.time()

    run_stage("1/4 fetch_blocks", fetch_blocks, start, end)
    run_stage("2/4 fetch_logs",   fetch_logs,   start, end)

    if args.skip_receipts:
        print("\n[SKIPPED] fetch_receipts")
    else:
        run_stage("3/4 fetch_receipts", fetch_receipts)

    if args.skip_classify:
        print("\n[SKIPPED] classify_addresses")
    else:
        run_stage("4/4 classify_addresses", classify_addresses)

    write_watermark(end)

    total = time.time() - pipeline_t0
    print(f"\n{'='*60}")
    print(f"PIPELINE COMPLETE in {total/60:.1f} min ({total/3600:.2f} hours)")
    print(f"Watermark advanced to block {end:,}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()