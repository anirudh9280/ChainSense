"""Classify only the addresses that matter, in batches."""
import json
import time
from pathlib import Path
import pandas as pd
import requests
from src.ingestion.rpc import URL

PROCESSED_DIR = Path("data/processed")
BATCH_SIZE = 100      # 100 calls per HTTP request
SLEEP = 0.5           # one batch every 0.5s = 200 addrs/sec, CU-safe

def batch_get_code(addresses):
    """Send up to BATCH_SIZE eth_getCode calls in one HTTP POST."""
    payload = [
        {"jsonrpc": "2.0", "id": i, "method": "eth_getCode", "params": [a, "latest"]}
        for i, a in enumerate(addresses)
    ]
    r = requests.post(URL, json=payload, timeout=60)
    results = r.json()
    # responses may come back out of order — match by id
    by_id = {res["id"]: res.get("result", "0x") for res in results}
    return [by_id[i] for i in range(len(addresses))]

def classify_addresses():
    tx_df = pd.read_parquet(PROCESSED_DIR / "transactions.parquet")
    logs_df = pd.read_parquet(PROCESSED_DIR / "token_transfers.parquet")

    # only classify `to` addresses — `from` is always an EOA on L1.
    # plus token transfer recipients, since those are often contracts.
    addrs = set(tx_df["to"].dropna()) | set(logs_df["to"].dropna())
    addrs = {a.lower() for a in addrs if a}

    out = PROCESSED_DIR / "address_codes.parquet"
    known = set()
    if out.exists():
        known = set(pd.read_parquet(out)["address"])
    todo = sorted(addrs - known)
    print(f"{len(addrs):,} unique recipient addresses; {len(todo):,} new to classify")

    rows = []
    t0 = time.time()
    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i:i + BATCH_SIZE]
        codes = batch_get_code(batch)
        for addr, code in zip(batch, codes):
            rows.append({
                "address": addr,
                "is_contract": code != "0x",
                "code_size": (len(code) - 2) // 2 if code != "0x" else 0,
            })
        time.sleep(SLEEP)

        if i % (BATCH_SIZE * 20) == 0 and i > 0:
            rate = i / (time.time() - t0)
            eta = (len(todo) - i) / rate / 60
            print(f"  {i:,}/{len(todo):,} — {rate:.0f}/sec — ETA {eta:.1f} min")

    new_df = pd.DataFrame(rows)
    if out.exists():
        new_df = pd.concat([pd.read_parquet(out), new_df]).drop_duplicates("address")
    new_df.to_parquet(out, index=False)
    print(f"Done. {len(new_df):,} total addresses in {(time.time()-t0)/60:.1f} min")

if __name__ == "__main__":
    classify_addresses()