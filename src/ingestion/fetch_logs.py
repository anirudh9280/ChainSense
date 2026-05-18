"""CK: Pull ERC-20 Transfer logs. Writes token_transfers.parquet."""
import time, pandas as pd
from pathlib import Path
from src.ingestion.rpc import rpc

PROCESSED_DIR = Path("data/processed")
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
CHUNK = 10        # CK: Alchemy limit
SLEEP = 0.1       # eth_getLogs is 75 CU, slower pacing

def topic_to_addr(topic):
    return "0x" + topic[-40:].lower()

def fetch_logs(start, end):
    """Pull ERC-20 Transfers across [start, end], decode, write parquet."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    all_logs = []
    t0 = time.time()

    for chunk_start in range(start, end + 1, CHUNK):
        chunk_end = min(chunk_start + CHUNK - 1, end)
        logs = rpc("eth_getLogs", [{
            "fromBlock": hex(chunk_start),
            "toBlock":   hex(chunk_end),
            "topics":    [TRANSFER_TOPIC],
        }])
        all_logs.extend(logs)
        print(f"  blocks {chunk_start}-{chunk_end}: {len(logs)} logs (total {len(all_logs):,})")
        time.sleep(SLEEP)

    rows = []
    for log in all_logs:
        # ERC-721 Transfer shares this topic but has 4 topics (tokenId is the 4th).
        # ERC-20 has exactly 3 topics. Filter to ERC-20.
        if len(log["topics"]) != 3:
            continue
        rows.append({
            "block": int(log["blockNumber"], 16),
            "tx_hash": log["transactionHash"],
            "log_index": int(log["logIndex"], 16),
            "token": log["address"].lower(),
            "from": topic_to_addr(log["topics"][1]),
            "to":   topic_to_addr(log["topics"][2]),
            # CK: prevent overflow
            "value_raw": str(int(log["data"], 16)) if log["data"] != "0x" else "0",
        })

    logs_df = pd.DataFrame(rows)
    blocks = pd.read_parquet(PROCESSED_DIR / "blocks.parquet")
    logs_df = logs_df.merge(blocks[["block", "ts"]], on="block", how="left")
    logs_df["dt"] = pd.to_datetime(logs_df["ts"], unit="s")

    out = PROCESSED_DIR / "token_transfers.parquet"
    if out.exists():
        existing = pd.read_parquet(out)
        logs_df = pd.concat([existing, logs_df]).drop_duplicates(["tx_hash", "log_index"])
    logs_df.to_parquet(out, index=False)
    print(f"Done. {len(logs_df):,} total transfers in {time.time()-t0:.0f}s")

if __name__ == "__main__":
    from src.ingestion.watermark import read_watermark
    # logs use the same watermark as blocks
    blocks = pd.read_parquet(PROCESSED_DIR / "blocks.parquet")
    start, end = int(blocks["block"].min()), int(blocks["block"].max())
    print(f"Fetching logs {start} -> {end}")
    fetch_logs(start, end)