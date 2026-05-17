"""CK: Pull receipts a block at a time. ~150x fewer calls than per-tx fetching.
1. Loops over blocks instead of tx hashes
2. eth_getBlockReceipts() return full lit of receipts for the block
3. Cache is keyed by block (not tx hash)
4. Sleep 1.0 since CU is higher per call
"""
import json
import time
from pathlib import Path
import pandas as pd
from src.ingestion.rpc import rpc

RAW_DIR = Path("data/raw/receipts")
PROCESSED_DIR = Path("data/processed")
SLEEP = 1.0   # eth_getBlockReceipts costs 500 throughput CU; ~1/sec is the floor

def fetch_receipts():
    """Fetch all receipts block-by-block via eth_getBlockReceipts."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    blocks_df = pd.read_parquet(PROCESSED_DIR / "blocks.parquet")
    block_nums = sorted(blocks_df["block"].tolist())
    print(f"Fetching receipts for {len(block_nums)} blocks")

    rows = []
    t0 = time.time()
    for i, n in enumerate(block_nums):
        cache = RAW_DIR / f"block_{n}.json"
        if cache.exists():
            receipts = json.loads(cache.read_text())
        else:
            receipts = rpc("eth_getBlockReceipts", [hex(n)])
            cache.write_text(json.dumps(receipts))
            time.sleep(SLEEP)

        for r in receipts:
            rows.append({
                "tx_hash": r["transactionHash"],
                "block": n,
                "gas_used": int(r["gasUsed"], 16),
                "status": int(r["status"], 16),  # 1 = success, 0 = failed
                "effective_gas_price_wei": int(r.get("effectiveGasPrice", "0x0"), 16),
                "contract_address": r.get("contractAddress"),  # set if tx deployed a contract
            })

        if i % 50 == 0 and i > 0:
            rate = i / (time.time() - t0)
            eta = (len(block_nums) - i) / rate / 60
            print(f"  {i}/{len(block_nums)} blocks — {rate:.1f}/sec — ETA {eta:.1f} min")

    pd.DataFrame(rows).to_parquet(PROCESSED_DIR / "receipts.parquet", index=False)
    print(f"Done. {len(rows):,} receipts in {(time.time()-t0)/60:.1f} min")

if __name__ == "__main__":
    fetch_receipts()