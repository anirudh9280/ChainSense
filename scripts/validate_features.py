"""Validate the feature matrix before clustering."""
import pandas as pd
import numpy as np
from pathlib import Path

PROCESSED = Path("data/processed")

features = pd.read_parquet(PROCESSED / "wallet_features.parquet")
scaled   = pd.read_parquet(PROCESSED / "wallet_features_scaled.parquet")

FEATURE_COLS = [c for c in scaled.columns if c != "wallet"]

print("=" * 60)
print("FEATURE VALIDATION")
print("=" * 60)

# Check 1: row counts match between raw and scaled
print("\n=== Check 1: row counts ===")
print(f"wallet_features:        {len(features):>8,}")
print(f"wallet_features_scaled: {len(scaled):>8,}")
print(f"Match: {len(features) == len(scaled)}")

# Check 2: wallet IDs match in order
print("\n=== Check 2: wallet alignment ===")
aligned = (features["wallet"].reset_index(drop=True) == scaled["wallet"].reset_index(drop=True)).all()
print(f"Wallet order matches: {aligned}")

# Check 3: no NaNs anywhere in scaled matrix
print("\n=== Check 3: NaN check ===")
nan_counts = scaled[FEATURE_COLS].isna().sum()
total_nans = nan_counts.sum()
print(f"Total NaNs in scaled matrix: {total_nans}")
if total_nans > 0:
    print("Columns with NaNs:")
    print(nan_counts[nan_counts > 0])

# Check 4: no inf values
print("\n=== Check 4: inf check ===")
inf_counts = np.isinf(scaled[FEATURE_COLS]).sum()
total_inf = inf_counts.sum()
print(f"Total inf values: {total_inf}")
if total_inf > 0:
    print(inf_counts[inf_counts > 0])

# Check 5: scaled stats — should be ~mean 0, std 1
print("\n=== Check 5: scaling sanity ===")
stats = scaled[FEATURE_COLS].describe().loc[["mean", "std"]].round(3)
print(stats.T)
mean_ok = scaled[FEATURE_COLS].mean().abs().max() < 0.01
std_ok  = (scaled[FEATURE_COLS].std() - 1).abs().max() < 0.01
print(f"\nAll means ~ 0: {mean_ok}")
print(f"All stds ~ 1:  {std_ok}")

# Check 6: no constant columns (zero variance kills clustering)
print("\n=== Check 6: variance check ===")
variances = scaled[FEATURE_COLS].var()
dead = variances[variances < 1e-6]
print(f"Near-zero-variance features: {len(dead)}")
if len(dead) > 0:
    print(f"  DROP THESE: {dead.index.tolist()}")

# Check 7: correlation — flag pairs above 0.95
print("\n=== Check 7: redundant features ===")
corr = scaled[FEATURE_COLS].corr().abs()
upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
high_corr = upper.stack().sort_values(ascending=False)
high_corr = high_corr[high_corr > 0.95]
if len(high_corr) > 0:
    print("Pairs with |corr| > 0.95 (consider dropping one):")
    for (a, b), v in high_corr.items():
        print(f"  {a:30s} <-> {b:30s}  ({v:.3f})")
else:
    print("No problematic correlations.")

# Check 8: distribution of total_activity (sanity on filter)
print("\n=== Check 8: activity distribution ===")
print(f"total_activity percentiles:")
print(features["total_activity"].describe(percentiles=[.5, .9, .99]).round(1))
print(f"Min: {features['total_activity'].min():.0f}  (should be >= 5)")

# Check 9: failed_tx_ratio sanity (only if receipts joined)
print("\n=== Check 9: receipt-derived features ===")
if "failed_tx_ratio" in features.columns:
    pct_with_failures = (features["failed_tx_ratio"] > 0).mean() * 100
    avg_failure = features["failed_tx_ratio"].mean()
    print(f"Wallets with any failed tx: {pct_with_failures:.1f}%")
    print(f"Mean failed_tx_ratio:       {avg_failure:.3f}  (typical: 0.02-0.08)")
    if avg_failure == 0:
        print("  WARN: all zeros — receipts probably weren't joined correctly")
else:
    print("No failed_tx_ratio column — receipts not joined yet.")

# Check 10: head of scaled matrix
print("\n=== Sample rows from scaled matrix ===")
print(scaled.head(3).round(2).to_string())