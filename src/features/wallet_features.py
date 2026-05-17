"""Build the wallet-level feature matrix from ingested parquets.

Reads: transactions.parquet, token_transfers.parquet, receipts.parquet, address_codes.parquet
Writes: wallet_features.parquet
"""
import numpy as np
import pandas as pd
from pathlib import Path

PROCESSED = Path("data/processed")
MIN_ACTIVITY = 5         # drop wallets with fewer than this many events
EOA_ONLY = True          # filter out contract addresses from the final feature set


def build_features():
    """Build and save wallet feature matrix. Returns the DataFrame."""
    print("Loading parquets...")
    txs      = pd.read_parquet(PROCESSED / "transactions.parquet")
    logs     = pd.read_parquet(PROCESSED / "token_transfers.parquet")
    receipts = pd.read_parquet(PROCESSED / "receipts.parquet")
    codes    = pd.read_parquet(PROCESSED / "address_codes.parquet")
    print(f"  {len(txs):,} txs, {len(logs):,} transfers, {len(receipts):,} receipts, {len(codes):,} addresses")

    # Join receipts onto txs so we have failure status per tx
    txs = txs.merge(receipts[["tx_hash", "status", "gas_used"]], on="tx_hash", how="left")
    txs["failed"] = (txs["status"] == 0).astype(int)
    txs["day"] = pd.to_datetime(txs["ts"], unit="s").dt.date

    # ---- Sender-side features (wallets that sent txs) ----
    print("Aggregating sender features...")
    sender = txs.groupby("from").agg(
        tx_count=("tx_hash", "count"),
        total_value_eth_sent=("value_eth", "sum"),
        avg_gas=("gas", "mean"),
        avg_gas_used=("gas_used", "mean"),
        contract_call_count=("is_contract_call", "sum"),
        failed_count=("failed", "sum"),
        active_days=("day", "nunique"),
        unique_recipients=("to", "nunique"),
        first_ts=("ts", "min"),
        last_ts=("ts", "max"),
    ).reset_index().rename(columns={"from": "wallet"})

    sender["contract_call_ratio"] = sender["contract_call_count"] / sender["tx_count"]
    sender["failed_tx_ratio"] = sender["failed_count"] / sender["tx_count"]
    sender["lifespan_hours"] = (sender["last_ts"] - sender["first_ts"]) / 3600
    sender["tx_frequency"] = sender["tx_count"] / sender["active_days"]

    # ---- Receiver-side features ----
    print("Aggregating receiver features...")
    receiver = txs.groupby("to").agg(
        total_value_eth_received=("value_eth", "sum"),
        received_tx_count=("tx_hash", "count"),
        unique_senders=("from", "nunique"),
    ).reset_index().rename(columns={"to": "wallet"})

    # ---- Token transfer features (sent + received) ----
    print("Aggregating token transfer features...")
    token_sent = logs.groupby("from").agg(
        tokens_sent_count=("tx_hash", "count"),
        unique_tokens_sent=("token", "nunique"),
        unique_token_recipients=("to", "nunique"),
    ).reset_index().rename(columns={"from": "wallet"})

    token_recv = logs.groupby("to").agg(
        tokens_received_count=("tx_hash", "count"),
        unique_tokens_received=("token", "nunique"),
        unique_token_senders=("from", "nunique"),
    ).reset_index().rename(columns={"to": "wallet"})

    # ---- Merge all into one wallet table ----
    features = (
        sender
        .merge(receiver,   on="wallet", how="outer")
        .merge(token_sent, on="wallet", how="outer")
        .merge(token_recv, on="wallet", how="outer")
    )

    # Fill NaN with 0 for wallets that didn't appear in some tables
    fill_cols = [c for c in features.columns if c != "wallet"]
    features[fill_cols] = features[fill_cols].fillna(0)

    # ---- Derived features ----
    # log-difference is better-behaved than ratio at zero
    features["send_vs_receive"] = (
        np.log1p(features["total_value_eth_sent"])
        - np.log1p(features["total_value_eth_received"])
    )
    features["token_send_vs_receive"] = (
        np.log1p(features["tokens_sent_count"])
        - np.log1p(features["tokens_received_count"])
    )
    features["total_token_transfers"] = (
        features["tokens_sent_count"] + features["tokens_received_count"]
    )
    features["total_activity"] = (
        features["tx_count"]
        + features["received_tx_count"]
        + features["total_token_transfers"]
    )

    # ---- Join contract classification ----
    features["wallet"] = features["wallet"].str.lower()
    codes["address"] = codes["address"].str.lower()
    features = features.merge(
        codes[["address", "is_contract"]],
        left_on="wallet", right_on="address", how="left",
    ).drop(columns="address")
    features["is_contract"] = features["is_contract"].fillna(False)

    print(f"All wallets: {len(features):,}")

    # ---- Filter ----
    if EOA_ONLY:
        before = len(features)
        features = features[~features["is_contract"]]
        print(f"  filtered to EOAs: {len(features):,} (dropped {before - len(features):,} contracts)")

    before = len(features)
    features = features[features["total_activity"] >= MIN_ACTIVITY].reset_index(drop=True)
    print(f"  filtered to active (>={MIN_ACTIVITY} events): {len(features):,} (dropped {before - len(features):,})")

    # ---- Save ----
    out = PROCESSED / "wallet_features.parquet"
    features.to_parquet(out, index=False)
    print(f"Saved {out} with {len(features):,} wallets and {len(features.columns)} columns")
    return features


if __name__ == "__main__":
    build_features()