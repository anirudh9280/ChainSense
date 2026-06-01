"""ChainSense — 1h family classifier (predict step).

Loads the tree model (clf, cols, families) and scores the live feature frame
stream-extractor.py produced. Selects the model columns by name from the 14-col
frame, so the extra extractor columns are ignored instead of causing a shape
mismatch. Senders with too few txs in the window are gated to New / Unmodeled —
ratios/entropy degenerate on 3-5 txs and the year-aggregate model never saw them.

    python backend/classify.py --in backend/data/live_features.parquet
"""
import argparse
from pathlib import Path

import joblib
import pandas as pd

DATA = Path(__file__).parent / "data"
NEW_BUCKET = "New / Unmodeled"
MIN_TX = 5  # below this the 1h window is too sparse to trust a label


def classify(df, model_path=DATA / "xgb_family_1h.joblib", min_tx=MIN_TX):
    clf, cols, fams = joblib.load(model_path)
    proba = clf.predict_proba(df[cols])
    out = df[["address", "tx_count_1h"]].copy()
    out["family"] = [fams[i] for i in proba.argmax(1)]
    out["confidence"] = proba.max(1)
    out.loc[out["tx_count_1h"] < min_tx, ["family", "confidence"]] = [NEW_BUCKET, 0.0]
    return out


def main():
    ap = argparse.ArgumentParser(description="ChainSense 1h family classifier.")
    ap.add_argument("--in", dest="inp", default=str(DATA / "live_features.parquet"))
    ap.add_argument("--out", default=str(DATA / "live_predictions.parquet"))
    args = ap.parse_args()

    df = pd.read_parquet(args.inp)
    out = classify(df)
    out.to_parquet(args.out, index=False)

    counts = out["family"].value_counts()
    print(f"{len(out)} senders classified -> {args.out}\n")
    print(counts.to_string())


if __name__ == "__main__":
    main()
