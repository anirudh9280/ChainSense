"""ChainSense — 1h feature extractor.

Reads the trailing window of bronze blocks written by streamer.py and builds the
per-address feature frame the classifier consumes. One row per sender.

    python backend/stream-extractor.py --blocks 300 --out backend/data/live_features.parquet
"""
import argparse
import glob
from pathlib import Path

import numpy as np
import pandas as pd

BRONZE = Path(__file__).parent / "data" / "bronze"

# selector groups (must match the year-1 training definitions)
SELECTORS = {
    "transfer":     {"0xa9059cbb"},
    "approve":      {"0x095ea7b3"},
    "swap_meme":    {"0x791ac947", "0xb6f9de95"},
    "mint":         {"0x1249c58b"},
    "automation":   {"0x2213bc0b", "0x78e111f6"},
    "transferFrom": {"0x23b872dd"},
}


def _tail(table, n):
    files = sorted(glob.glob(str(BRONZE / table / "block-*.parquet")))[-n:]
    return pd.concat((pd.read_parquet(f) for f in files), ignore_index=True) if files else pd.DataFrame()


def _all_contracts():
    files = glob.glob(str(BRONZE / "contracts" / "block-*.parquet"))
    out = set()
    for f in files:
        out |= set(pd.read_parquet(f)["address"])
    return out


def _entropy(s):
    p = s.value_counts(normalize=True)
    val = -(p * np.log(p)).sum()
    return float(val) if val else 0.0


def extract(n_blocks):
    tx = _tail("transactions", n_blocks)
    blocks = _tail("blocks", n_blocks)
    contracts = _all_contracts()  # cumulative dictionary, not windowed

    base = pd.to_numeric(blocks.set_index("block_number")["base_fee_per_gas_wei"], errors="coerce")
    tx["value"] = pd.to_numeric(tx["value_wei"], errors="coerce")
    tx["is_call"] = tx["to_address"].isin(contracts)
    tx["prio_gwei"] = (pd.to_numeric(tx["effective_gas_price_wei"], errors="coerce")
                       - tx["block_number"].map(base)) / 1e9

    in_eth = tx.groupby("to_address")["value"].sum()  # involving-view: ETH received

    rows = []
    for addr, g in tx.groupby("from_address"):
        n = len(g)
        calls = g[g["is_call"]]
        nc = len(calls)
        same_block = g.groupby("block_number").size()
        feats = {
            "address": addr,
            "tx_count_1h": n,
            "failed_tx_ratio": (g["status"] == 0).mean(),
            "contract_call_ratio": nc / n,
            "selector_entropy": _entropy(g["method_selector"]),
            "same_block_tx_ratio": same_block[same_block > 1].sum() / n,
            "counterparty_concentration_top3": g["to_address"].value_counts().head(3).sum() / n,
            "median_priority_fee_gwei": g["prio_gwei"].median(),
            "has_eth_volume": int(g["value"].sum() + in_eth.get(addr, 0.0) > 0),
        }
        for name, sels in SELECTORS.items():
            feats[f"{name}_share"] = calls["method_selector"].isin(sels).sum() / nc if nc else 0.0
        rows.append(feats)

    return pd.DataFrame(rows).fillna(0.0)


def main():
    ap = argparse.ArgumentParser(description="ChainSense 1h feature extractor.")
    ap.add_argument("--blocks", type=int, default=300, help="trailing blocks to read (≈300/h)")
    ap.add_argument("--out", default=str(Path(__file__).parent / "data" / "live_features.parquet"))
    args = ap.parse_args()
    df = extract(args.blocks)
    df.to_parquet(args.out, index=False)
    print(f"{len(df)} senders x {df.shape[1] - 1} features -> {args.out}")


if __name__ == "__main__":
    main()
