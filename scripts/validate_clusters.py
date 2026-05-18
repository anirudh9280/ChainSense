"""Validate clustering output — statistical structure + interpretability."""
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.metrics import silhouette_score, davies_bouldin_score

PROCESSED = Path("data/processed")

scaled   = pd.read_parquet(PROCESSED / "wallet_features_scaled.parquet")
features = pd.read_parquet(PROCESSED / "wallet_features.parquet")
clusters = pd.read_parquet(PROCESSED / "clusters.parquet")

FEATURE_COLS = [c for c in scaled.columns if c != "wallet"]
X = scaled[FEATURE_COLS].values
labels = clusters["cluster"].values

print("=" * 60)
print("CLUSTER VALIDATION")
print("=" * 60)

# Check 1: alignment
print("\n=== Check 1: alignment ===")
print(f"Scaled rows:  {len(scaled):>8,}")
print(f"Cluster rows: {len(clusters):>8,}")
aligned = (scaled["wallet"].values == clusters["wallet"].values).all()
print(f"Wallet order matches: {aligned}")

# Check 2: cluster sizes
print("\n=== Check 2: cluster sizes ===")
sizes = pd.Series(labels).value_counts().sort_index()
total = len(labels)
for c, n in sizes.items():
    bar = "█" * int(50 * n / sizes.max())
    print(f"  cluster {c}:  {n:>7,}  ({n/total:>5.1%})  {bar}")

biggest_share = sizes.max() / total
smallest = sizes.min()
print(f"\nBiggest cluster share: {biggest_share:.1%}  (warn if > 70%)")
print(f"Smallest cluster:      {smallest:,}  (warn if < 20)")

# Check 3: statistical quality
print("\n=== Check 3: clustering metrics ===")
rng = np.random.default_rng(42)
sample = rng.choice(len(X), min(10000, len(X)), replace=False)
sil = silhouette_score(X[sample], labels[sample])
db  = davies_bouldin_score(X[sample], labels[sample])
print(f"Silhouette:     {sil:.3f}   (good: >0.25, great: >0.4)")
print(f"Davies-Bouldin: {db:.3f}    (lower is better, good: <1.5)")

# Check 4: cluster separation in feature space
print("\n=== Check 4: cluster signatures ===")
df = features.copy()
df["cluster"] = labels
# Pick a few key features to read
KEY = ["tx_count", "total_value_eth_sent", "contract_call_ratio",
       "failed_tx_ratio", "unique_recipients", "tokens_sent_count"]
KEY = [c for c in KEY if c in df.columns]
print(df.groupby("cluster")[KEY].mean().round(2))

# Check 5: distinctiveness — do clusters actually differ?
print("\n=== Check 5: distinctiveness ===")
from src.models.evaluation import cluster_profiles
profiles = cluster_profiles(scaled, labels)
# Largest absolute z-score per cluster across all features
max_z = profiles.abs().max(axis=1)
print("Each cluster's strongest feature deviation (|z-score|):")
for c, z in max_z.items():
    flag = "weak" if z < 0.5 else "ok" if z < 1.0 else "strong"
    print(f"  cluster {c}: max |z| = {z:.2f}  ({flag})")

if (max_z < 0.5).any():
    print("\nWARN: at least one cluster has no strongly distinguishing feature.")
    print("      It's probably a 'leftover' cluster of mixed wallets.")

# Check 6: Etherscan sample
print("\n=== Check 6: sample wallets per cluster ===")
print("Open each in Etherscan and confirm the archetype fits.\n")
for c in sorted(set(labels)):
    in_cluster = clusters[clusters["cluster"] == c]
    sample = in_cluster.sample(min(3, len(in_cluster)), random_state=42)
    print(f"Cluster {c}:")
    for w in sample["wallet"]:
        print(f"  https://etherscan.io/address/{w}")
    print()