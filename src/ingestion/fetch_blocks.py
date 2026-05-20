"""CK: Pull blocks with full transactions. Writes blocks.parquet + transactions.parquet."""
import json, time, pandas as pd
from pathlib import Path
from src.ingestion.rpc import rpc, latest_block
from src.ingestion.watermark import read_watermark, write_watermark

RAW_DIR = Path("data/raw/blocks")
PROCESSED_DIR = Path("data/processed")
SAFETY_BUFFER = 10        # stay this many blocks behind head to avoid reorgs
DEFAULT_WINDOW = 10     # blocks to pull on a fresh run
SLEEP = 0.05              # ~20 req/sec, well under 300 CU/s

def fetch_blocks(start, end):
    """Pull blocks [start, end] inclusive. Caches each block as JSON on disk."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    block_rows, tx_rows = [], []
    t0 = time.time()

    for n in range(start, end + 1):
        cache = RAW_DIR / f"block_{n}.json"
        if cache.exists():
            b = json.loads(cache.read_text())
        else:
            b = rpc("eth_getBlockByNumber", [hex(n), True])
            cache.write_text(json.dumps(b))
            time.sleep(SLEEP)

        ts = int(b["timestamp"], 16)
        block_rows.append({
            "block": n,
            "ts": ts,
            "gas_used": int(b["gasUsed"], 16),
            "base_fee_wei": int(b.get("baseFeePerGas", "0x0"), 16),
            "tx_count": len(b["transactions"]),
        })

        for tx in b["transactions"]:
            tx_rows.append({
                "block": n,
                "ts": ts,
                "tx_hash": tx["hash"],
                "from": tx["from"],
                "to": tx["to"],
                "value_wei": str(int(tx["value"], 16)), # CK: prevent overflow
                "gas": int(tx["gas"], 16),
                "input_len": len(tx["input"]),
                "is_contract_call": tx["input"] != "0x",
            })

        if (n - start) % 50 == 0:
            print(f"  block {n} ({n - start + 1}/{end - start + 1}) — {time.time()-t0:.0f}s")

    blocks_df = pd.DataFrame(block_rows)
    tx_df = pd.DataFrame(tx_rows)
    tx_df["value_eth"] = tx_df["value_wei"].astype(float) / 1e18
    tx_df["dt"] = pd.to_datetime(tx_df["ts"], unit="s")

    # append if existing, else write fresh
    blocks_path = PROCESSED_DIR / "blocks.parquet"
    tx_path = PROCESSED_DIR / "transactions.parquet"
    if blocks_path.exists():
        blocks_df = pd.concat([pd.read_parquet(blocks_path), blocks_df]).drop_duplicates("block")
        tx_df = pd.concat([pd.read_parquet(tx_path), tx_df]).drop_duplicates("tx_hash")
    blocks_df.to_parquet(blocks_path, index=False)
    tx_df.to_parquet(tx_path, index=False)

    print(f"Done. {len(tx_rows)} new txs across {len(block_rows)} blocks in {time.time()-t0:.0f}s")

if __name__ == "__main__":
    last = read_watermark()
    end = latest_block() - SAFETY_BUFFER
    start = (last + 1) if last is not None else (end - DEFAULT_WINDOW + 1)
    print(f"Fetching blocks {start} -> {end} ({end - start + 1} blocks)")
    fetch_blocks(start, end)
    write_watermark(end)