"""Build web/public/snapshot.json from real pipeline output.

Source of truth: dashboard/demo_data/ (in-repo CSVs, no /Volumes/Data needed).

What this script DOES compute from real data:
  - archetype counts, percentages, and transaction-share (via tx ⋈ cluster join)
  - block range, window length, wallet count, txn count
  - silhouette + davies-bouldin on the scaled feature space
  - real PCA scatter coordinates (sampled)
  - sample wallets with real engineered features
  - anomaly pressure z-score from per-minute tx volume

What this script DOES NOT compute (because no model exists in the repo):
  - flagged-for-review count, median risk score, risk distribution
  - per-wallet risk scores or anomaly reasons
  - XGBoost classifier AUC / confidence
  - real-time ingest rate (unless subscriber.py is running and writing to ../streaming/)
  - USD-denominated portfolio value (no price data wired)
  - 47-feature space (we have 12 features, not 47)
  - 365-day window (the in-repo demo data covers ~3.5 hours)

Every section of the output JSON carries a "_provenance" tag so the UI knows
whether a number is real, derived, or absent.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import davies_bouldin_score, silhouette_score

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "dashboard" / "demo_data"
STREAM_DIR = Path(os.getenv("STREAM_OUT_DIR", str(ROOT / "streaming")))
OUT = ROOT / "web" / "public" / "snapshot.json"

ARCHETYPE_COLOR = {
    "Casual ETH user": "longterm",
    "Active DeFi user": "traders",
    "Token receiver / airdrop": "nft",
    "Likely bot / MEV": "bots",
}


def _human(n: float) -> str:
    if n >= 1e9:
        return f"{n / 1e9:.2f}B".rstrip("0").rstrip(".")
    if n >= 1e6:
        return f"{n / 1e6:.2f}M".rstrip("0").rstrip(".")
    if n >= 1e3:
        return f"{n / 1e3:.1f}K".rstrip("0").rstrip(".")
    return f"{int(n)}"


def main() -> int:
    clusters_csv = DEMO / "wallet_clusters.csv"
    features_csv = DEMO / "wallet_features.csv"
    scaled_csv = DEMO / "wallet_features_scaled.csv"
    proj_csv = DEMO / "wallet_projections.csv"
    txs_csv = DEMO / "transactions.csv"

    for p in (clusters_csv, features_csv, scaled_csv, proj_csv, txs_csv):
        if not p.exists():
            print(f"missing input: {p}", file=sys.stderr)
            return 1

    clusters = pd.read_csv(clusters_csv)
    features = pd.read_csv(features_csv)
    scaled = pd.read_csv(scaled_csv)
    proj = pd.read_csv(proj_csv)
    txs = pd.read_csv(txs_csv, parse_dates=["dt"])

    n_wallets = len(clusters)
    n_features = features.shape[1] - 1  # minus wallet column

    # --- Archetype counts + tx share via join -------------------------------
    counts = clusters["archetype"].value_counts()
    tx_with_arch = txs.merge(
        clusters[["wallet", "archetype"]], left_on="from", right_on="wallet", how="left"
    )
    tx_share = tx_with_arch["archetype"].value_counts(dropna=True)
    tx_share_total = int(tx_share.sum())

    archetypes = []
    for name, n in counts.items():
        archetypes.append(
            {
                "name": name,
                "count": int(n),
                "pct": round(100.0 * n / n_wallets, 1),
                "txnSharePct": round(100.0 * int(tx_share.get(name, 0)) / max(tx_share_total, 1), 1),
                "color": ARCHETYPE_COLOR.get(name, "traders"),
            }
        )

    # --- Clustering quality on the real scaled feature space ---------------
    feat_cols = [c for c in scaled.columns if c != "wallet"]
    X = scaled[feat_cols].to_numpy()
    labels = clusters["km_cluster"].to_numpy()
    # silhouette is expensive on 31k points; sample 5k for tractability
    rng = np.random.default_rng(0)
    sample_idx = rng.choice(len(X), size=min(5000, len(X)), replace=False)
    sil = float(silhouette_score(X[sample_idx], labels[sample_idx]))
    db = float(davies_bouldin_score(X, labels))

    # Inertia drop vs k=1 baseline (k=1 inertia = total variance)
    centroids = np.stack(
        [X[labels == k].mean(axis=0) for k in np.unique(labels)]
    )
    inertia = float(
        sum(
            ((X[labels == k] - centroids[i]) ** 2).sum()
            for i, k in enumerate(np.unique(labels))
        )
    )
    inertia_k1 = float(((X - X.mean(axis=0)) ** 2).sum())
    inertia_drop_pct = round(100.0 * (inertia - inertia_k1) / inertia_k1, 1)

    # --- Time window + block range -----------------------------------------
    block_min = int(txs["block"].min())
    block_max = int(txs["block"].max())
    window_seconds = (txs["dt"].max() - txs["dt"].min()).total_seconds()
    window_hours = round(window_seconds / 3600, 1)

    # --- Active wallets over time (1-min buckets in this short window) -----
    per_min = (
        txs.set_index("dt")["from"]
        .resample("1min")
        .nunique()
        .sort_index()
    )
    avg_active = int(per_min.mean()) if len(per_min) else 0
    active_series = [int(v) for v in per_min.tolist()]

    # --- Active wallets per minute, split by archetype (stacked-area data) -
    tx_arch = tx_with_arch.dropna(subset=["archetype"])
    tx_arch = tx_arch.set_index("dt")
    arch_order = list(counts.index)
    stacked = (
        tx_arch.groupby("archetype")["from"]
        .resample("1min")
        .nunique()
        .unstack(level=0)
        .reindex(columns=arch_order, fill_value=0)
        .sort_index()
        .fillna(0)
        .astype(int)
    )
    active_by_arch = {
        "buckets": [ts.isoformat() for ts in stacked.index],
        "series": {col: [int(v) for v in stacked[col].tolist()] for col in stacked.columns},
    }

    # --- Anomaly pressure: z-score of tx-volume vs trailing 10-bucket mean -
    tx_per_min = txs.set_index("dt").resample("1min").size().sort_index()
    if len(tx_per_min) >= 11:
        roll = tx_per_min.rolling(10, min_periods=5)
        z = (tx_per_min - roll.mean()) / roll.std().replace(0, np.nan)
        z = z.fillna(0.0).clip(lower=0).tolist()
        anomaly_pressure = [round(float(v), 2) for v in z]
    else:
        anomaly_pressure = []

    # --- PCA scatter from REAL projections (sample 1200 for SVG perf) ------
    # wallet_projections.csv already carries archetype; no merge needed.
    proj_lab = proj.dropna(subset=["pca1", "pca2", "archetype"])
    sample_n = min(1200, len(proj_lab))
    pca_sample = proj_lab.sample(sample_n, random_state=42)
    pca_points = [
        {
            "x": round(float(r.pca1), 3),
            "y": round(float(r.pca2), 3),
            "cls": ARCHETYPE_COLOR.get(r.archetype, "traders"),
            "arch": r.archetype,
        }
        for r in pca_sample.itertuples()
    ]

    # --- Per-archetype fingerprints (radar) + medians (cards) -------------
    # Radar = 6-axis aggregation of scaled features, mapped to behavioral groups.
    # Each axis is the mean of one or more scaled columns, then min-max scaled
    # across archetypes so each axis spans 0..1 in the chart.
    AXES = {
        "Tx Activity": ["tx_count", "tx_frequency"],
        "Value Flow": ["total_value_eth_sent", "total_value_eth_received"],
        "Gas": ["avg_gas"],
        "Counterparty": ["unique_recipients", "unique_senders"],
        "Contract Calls": ["contract_call_ratio"],
        "Token Activity": ["tokens_sent_count", "tokens_received_count",
                           "unique_tokens_sent", "unique_tokens_received"],
    }

    scaled_with_arch = scaled.merge(
        clusters[["wallet", "archetype"]], on="wallet", how="left"
    ).dropna(subset=["archetype"])

    # Mean of selected scaled columns per archetype, per axis.
    axis_means: dict[str, dict[str, float]] = {}
    for axis_name, cols in AXES.items():
        sub = scaled_with_arch.groupby("archetype")[cols].mean().mean(axis=1)
        axis_means[axis_name] = {arch: float(v) for arch, v in sub.items()}

    # Normalize each axis to [0, 1] across archetypes for plotting.
    axis_norm: dict[str, dict[str, float]] = {}
    for axis_name, by_arch in axis_means.items():
        vals = list(by_arch.values())
        lo, hi = min(vals), max(vals)
        span = hi - lo if hi > lo else 1.0
        axis_norm[axis_name] = {
            arch: round((v - lo) / span, 3) for arch, v in by_arch.items()
        }

    # Fingerprints: list of {archetype, axes: {axis_name: value 0..1}}
    fingerprints = [
        {
            "archetype": arch,
            "color": ARCHETYPE_COLOR.get(arch, "traders"),
            "axes": {axis: axis_norm[axis][arch] for axis in AXES.keys()},
        }
        for arch in counts.index
    ]

    # Separation read: for each archetype, find top-2 features with the largest
    # absolute z-score of cluster-mean vs population-mean.
    pop_mean = scaled[feat_cols].mean()
    pop_std = scaled[feat_cols].std().replace(0, 1.0)
    arch_means = scaled_with_arch.groupby("archetype")[feat_cols].mean()
    separation = []
    for arch in counts.index:
        z = ((arch_means.loc[arch] - pop_mean) / pop_std).abs().sort_values(ascending=False)
        top = list(z.head(2).index)
        signs = []
        for feat in top:
            delta = float(arch_means.loc[arch, feat] - pop_mean[feat])
            signs.append("high" if delta > 0 else "low")
        separation.append({
            "archetype": arch,
            "topFeatures": [{"feature": f, "direction": s} for f, s in zip(top, signs)],
        })

    # Cards: per-archetype median of raw features for the 4 card tiles.
    raw_with_arch = features.merge(clusters[["wallet", "archetype"]], on="wallet", how="left").dropna(subset=["archetype"])
    medians = raw_with_arch.groupby("archetype").median(numeric_only=True)
    archetype_cards = []
    for arch in counts.index:
        row = medians.loc[arch]
        archetype_cards.append({
            "archetype": arch,
            "color": ARCHETYPE_COLOR.get(arch, "traders"),
            "walletCount": int(counts[arch]),
            "pct": round(100.0 * counts[arch] / n_wallets, 1),
            "medianTx": int(row.get("tx_count", 0)),
            "medianValueSent": round(float(row.get("total_value_eth_sent", 0)), 4),
            "medianValueReceived": round(float(row.get("total_value_eth_received", 0)), 4),
            "medianUniqueRecipients": int(row.get("unique_recipients", 0)),
            "medianContractCallRatio": round(float(row.get("contract_call_ratio", 0)), 3),
        })

    # --- Sample wallets for the inspector (1 per archetype, real features) -
    merged = clusters.merge(features.rename(columns={c: f"{c}_raw" for c in features.columns if c != "wallet"}), on="wallet", how="left")
    sample_wallets = []
    for arch in counts.index:
        row = merged[merged["archetype"] == arch].sort_values("tx_count", ascending=False).head(1)
        if row.empty:
            continue
        r = row.iloc[0]
        addr = str(r["wallet"])
        sample_wallets.append({
            "addr": addr,
            "short": f"{addr[:6]}…{addr[-4:]}",
            "archetype": arch,
            "confidence": None,
            "balanceEth": None,
            "txns": int(r["tx_count_raw"]),
            "totalSentEth": round(float(r["total_value_eth_sent_raw"]), 4),
            "totalReceivedEth": round(float(r["total_value_eth_received_raw"]), 4),
            "avgGas": int(r["avg_gas_raw"]),
            "uniqueRecipients": int(r["unique_recipients_raw"]),
            "uniqueSenders": int(r["unique_senders_raw"]),
            "contractCallRatio": round(float(r["contract_call_ratio_raw"]), 3),
            "txFrequency": round(float(r["tx_frequency_raw"]), 4),
            "tokensSent": int(r["tokens_sent_count_raw"]),
            "tokensReceived": int(r["tokens_received_count_raw"]),
            "uniqueTokensSent": int(r["unique_tokens_sent_raw"]),
            "uniqueTokensReceived": int(r["unique_tokens_received_raw"]),
        })

    # --- Real-time subscriber bridge (only if subscriber.py is writing) ----
    classifier = {
        "model": None,
        "auc": None,
        "ingestRateTxs": None,
        "lastBlockLagSec": None,
        "_provenance": "no classifier deployed",
    }
    live_tape = []
    live_tape_provenance = "subscriber output not found"

    if STREAM_DIR.exists():
        block_files = sorted(STREAM_DIR.glob("block_*.json"))
        if block_files:
            tail = block_files[-6:]
            for f in tail:
                try:
                    blob = json.loads(f.read_text())
                    bnum = blob.get("header", {}).get("blockNumber")
                    blk = blob.get("block", {})
                    txns = blk.get("transactions", [])
                    if txns:
                        t = txns[0]
                        live_tape.append({
                            "block": int(bnum) if bnum else 0,
                            "from": f"{t.get('from','')[:6]}…{t.get('from','')[-4:]}",
                            "to": f"{(t.get('to') or '0xContract')[:6]}…{(t.get('to') or '0xContract')[-4:]}",
                            "valueWei": t.get("value", "0x0"),
                            "txType": "transfer",
                        })
                except Exception:
                    pass
            if live_tape:
                live_tape_provenance = f"latest {len(live_tape)} blocks from {STREAM_DIR}"

    snapshot = {
        "_dataSource": {
            "wallets": str(clusters_csv.relative_to(ROOT)),
            "transactions": str(txs_csv.relative_to(ROOT)),
            "projections": str(proj_csv.relative_to(ROOT)),
            "subscriberDir": str(STREAM_DIR.relative_to(ROOT)) if STREAM_DIR.exists() else None,
            "generatedAt": pd.Timestamp.utcnow().isoformat(),
        },
        "meta": {
            "network": "Mainnet",
            "windowHours": window_hours,
            "blockStart": _human(block_min),
            "blockEnd": _human(block_max),
            "status": "snapshot · indexed",
        },
        "medallion": {
            "bronze": {"rows": f"{_human(len(txs))} txs",
                       "label": "Raw transactions",
                       "_provenance": "real · transactions.csv"},
            "silver": {"rows": "—",
                       "label": "Decoded events · transfers",
                       "_provenance": "missing · ABI decoding not run on this slice"},
            "gold":   {"rows": f"{_human(n_wallets)} × {n_features}",
                       "label": "Wallet feature vectors",
                       "_provenance": "real · wallet_features.csv"},
            "model":  {"algo": f"K-Means · k={int(len(np.unique(labels)))}",
                       "silhouette": round(sil, 3),
                       "_provenance": "real · silhouette computed live"},
        },
        "metrics": {
            "walletsLabeled": _human(n_wallets),
            "txnsProcessed": _human(len(txs)),
            "eventsDecoded": None,
            "featuresPerWallet": n_features,
            "activeWalletsPerMin": _human(avg_active),
            "flaggedForReview": None,
            "flaggedPct": None,
            "portfolioUnderLens": None,
            "medianRisk": None,
            "_provenance": {
                "walletsLabeled": "real",
                "txnsProcessed": "real",
                "eventsDecoded": "missing · no decoder run",
                "featuresPerWallet": "real",
                "activeWalletsPerMin": "real",
                "flaggedForReview": "missing · no risk model",
                "flaggedPct": "missing · no risk model",
                "portfolioUnderLens": "missing · no price data",
                "medianRisk": "missing · no risk model",
            },
        },
        "classifier": classifier,
        "archetypes": archetypes,
        "clustering": {
            "silhouette": round(sil, 3),
            "daviesBouldin": round(db, 3),
            "k": int(len(np.unique(labels))),
            "inertiaDropPct": inertia_drop_pct,
            "_provenance": "real · sklearn.metrics on scaled features",
        },
        "activeSeries": {
            "values": active_series,
            "bucketLabel": "1 min",
            "_provenance": "real · 1-min unique-from-address resample",
        },
        "activeByArchetype": {
            "buckets": active_by_arch["buckets"],
            "series": active_by_arch["series"],
            "bucketLabel": "1 min",
            "_provenance": "real · tx ⋈ clusters, then per-minute unique from per archetype",
        },
        "fingerprints": {
            "values": fingerprints,
            "axes": list(AXES.keys()),
            "_provenance": "real · per-archetype mean of scaled features, min-max normalized per axis",
        },
        "separation": {
            "values": separation,
            "_provenance": "real · top-2 features by |z-score| of cluster mean vs population mean",
        },
        "archetypeCards": {
            "values": archetype_cards,
            "_provenance": "real · per-archetype medians of raw features",
        },
        "anomalyPressure": {
            "values": anomaly_pressure,
            "_provenance": "derived · z-score of tx volume vs trailing 10-min baseline",
        },
        "riskDistribution": {
            "values": None,
            "_provenance": "missing · no risk model",
        },
        "flaggedWallets": {
            "values": None,
            "_provenance": "missing · no risk model",
        },
        "pcaPoints": {
            "values": pca_points,
            "_provenance": f"real · sampled {sample_n} of {len(proj_lab)} PCA-projected wallets",
        },
        "sampleWallets": {
            "values": sample_wallets,
            "_provenance": "real · top-tx wallet per archetype with raw engineered features",
        },
        "liveTape": {
            "values": live_tape,
            "_provenance": live_tape_provenance,
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=2))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    print(f"  wallets={n_wallets:,}  txs={len(txs):,}  features={n_features}  k={len(counts)}")
    print(f"  silhouette={sil:.3f}  davies-bouldin={db:.3f}  inertia drop={inertia_drop_pct}%")
    print(f"  live tape: {live_tape_provenance}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
