"""
Build frontend-ready static assets from the ML pipeline artifacts.

Reads the source artifacts in dashboard/public/ and writes small, browser-safe
JSON into web/public/data/. The two large parquet files (wallet_lut,
wallet_features) and the model artifacts (joblib) are NEVER copied here — they
are backend-only.

What it does:
  - Sanitizes every JSON (NaN/Inf -> null) so the browser's fetch().json()
    can't choke. family_summary.json in particular ships bare `NaN` tokens.
  - Downsamples activity_timeseries.json (per-minute, ~100MB) to a coarse
    bucket (daily or hourly) so the Overview stacked chart stays tiny.
  - Converts wallet_projections.parquet (~1.2k rows) to projections.json.
  - Copies the already-small JSONs through the sanitizer unchanged in shape.

Run:
    .venv/bin/python scripts/build_frontend_data.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "dashboard" / "public"
OUT = ROOT / "web" / "public" / "data"

# Canonical family display order (also the stack order for charts).
FAMILY_ORDER = [
    "Mainstream/Retail",
    "DeFi Traders",
    "Holders & Receivers",
    "Token-Only",
    "Bots & Automation",
    "Minters",
    "Compromised/Phishing",
    "Unclassified",
]


def clean(obj):
    """Recursively replace NaN/Inf floats with None so the result is valid JSON."""
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean(v) for v in obj]
    return obj


def write_json(name: str, data) -> None:
    path = OUT / name
    with open(path, "w") as f:
        json.dump(clean(data), f, allow_nan=False, separators=(",", ":"))
    kb = path.stat().st_size / 1024
    print(f"  wrote {name:28s} {kb:>9.1f} KB")


def copy_sanitized(name: str) -> None:
    """Load a source JSON (Python's json tolerates NaN) and re-emit valid JSON."""
    with open(SRC / name) as f:
        data = json.load(f)
    write_json(name, data)


def build_projections() -> None:
    df = pd.read_parquet(SRC / "wallet_projections.parquet")
    df = df[["x", "y", "cluster", "family", "address"]].copy()
    df["x"] = df["x"].round(4)
    df["y"] = df["y"].round(4)
    df["cluster"] = df["cluster"].astype(int)
    records = df.to_dict(orient="records")
    write_json("projections.json", records)
    print(f"    ({len(records)} points)")


def build_activity_daily() -> None:
    src = SRC / "activity_timeseries.json"
    print(f"  reading {src.name} ({src.stat().st_size / 1e6:.0f} MB) ...")
    df = pd.read_json(src)
    df["bucket"] = pd.to_datetime(df["bucket"])
    fam_cols = [c for c in df.columns if c != "bucket"]

    span_days = (df["bucket"].max() - df["bucket"].min()).days
    freq, label = ("D", "day") if span_days >= 30 else ("h", "hour")

    agg = (
        df.set_index("bucket")[fam_cols]
        .resample(freq)
        .sum()
        .round()
        .astype("int64")
        .reset_index()
    )
    fmt = "%Y-%m-%d" if label == "day" else "%Y-%m-%d %H:%M"
    rows = []
    for _, r in agg.iterrows():
        row = {"t": r["bucket"].strftime(fmt)}
        for c in fam_cols:
            row[c] = int(r[c])
        rows.append(row)

    families = [f for f in FAMILY_ORDER if f in fam_cols]
    families += [c for c in fam_cols if c not in families]
    write_json(
        "activity_daily.json",
        {"bucketLabel": label, "families": families, "rows": rows},
    )
    print(f"    (span {span_days}d -> {len(rows)} {label} buckets)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"src: {SRC}\nout: {OUT}\n")

    print("copy small JSONs (sanitized):")
    for name in [
        "model_stats.json",
        "family_summary.json",
        "cluster_archetypes.json",
        "feature_groups.json",
        "top20selectors.json",
        "inspector_sample.json",
    ]:
        copy_sanitized(name)

    print("\nbuild projections:")
    build_projections()

    print("\nbuild activity (downsampled):")
    build_activity_daily()

    print("\ndone.")


if __name__ == "__main__":
    main()
