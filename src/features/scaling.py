"""Log-transform heavy-tailed features, then standardize.

Reads:  wallet_features.parquet
Writes: wallet_features_scaled.parquet, scaler.pkl
"""
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.preprocessing import StandardScaler

PROCESSED = Path("data/processed")

# Columns that go into the clustering matrix
FEATURE_COLS = [
    "tx_count",
    "total_value_eth_sent",
    "total_value_eth_received",
    "avg_gas",
    "avg_gas_used",
    "unique_recipients",
    "unique_senders",
    "contract_call_ratio",
    "failed_tx_ratio",
    "tx_frequency",
    "tokens_sent_count",
    "tokens_received_count",
    "unique_tokens_sent",
    "unique_tokens_received",
    "send_vs_receive",
    "token_send_vs_receive",
]

# Subset that needs log1p before scaling (heavy-tailed counts and sums)
HEAVY_TAILED = [
    "tx_count",
    "total_value_eth_sent",
    "total_value_eth_received",
    "avg_gas",
    "avg_gas_used",
    "unique_recipients",
    "unique_senders",
    "tx_frequency",
    "tokens_sent_count",
    "tokens_received_count",
    "unique_tokens_sent",
    "unique_tokens_received",
]


def scale_features(features=None):
    """Apply log1p + StandardScaler. Saves scaled parquet and pickled scaler."""
    if features is None:
        features = pd.read_parquet(PROCESSED / "wallet_features.parquet")

    print(f"Scaling {len(features):,} wallets x {len(FEATURE_COLS)} features...")

    X = features[FEATURE_COLS].copy()

    # Log-transform the heavy-tailed columns
    for col in HEAVY_TAILED:
        X[col] = np.log1p(X[col])

    # Standardize: mean 0, std 1
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Assemble output DataFrame with wallet column attached
    out_df = pd.DataFrame(X_scaled, columns=FEATURE_COLS)
    out_df.insert(0, "wallet", features["wallet"].values)

    # Save
    out_path = PROCESSED / "wallet_features_scaled.parquet"
    out_df.to_parquet(out_path, index=False)
    joblib.dump(scaler, PROCESSED / "scaler.pkl")

    print(f"Saved {out_path}")
    print(f"Saved scaler.pkl")
    print("\nScaled stats (should be ~mean 0, std 1):")
    print(out_df[FEATURE_COLS].describe().loc[["mean", "std"]].round(3))

    return out_df


if __name__ == "__main__":
    scale_features()