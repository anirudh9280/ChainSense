"""Train the 1h family classifier on year-1 raw features.

Uses the 12 features the live extractor also produces. Tree model -> raw
values, no scaler. Saves (clf, cols, families) so the live frame feeds straight
in. This is the feature-sufficiency model (year aggregates); retrain on real 1h
windows later to de-risk sparsity.

    python backend/train_family_1h.py
"""
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

ROOT = Path(__file__).parent.parent
DATA = Path(__file__).parent / "data"

# the 12 features shared by the live extractor and the year-1 training set
FEATS = ["failed_tx_ratio", "contract_call_ratio", "selector_entropy", "same_block_tx_ratio",
         "counterparty_concentration_top3", "median_priority_fee_gwei", "has_eth_volume",
         "transfer_share", "approve_share", "swap_meme_share", "mint_share", "automation_share"]

FAMILY = {int(k): v for k, v in json.load(open(DATA / "cluster_archetypes.json")).items()}


def main():
    df = pd.read_parquet(DATA / "wallet_features_v5_unstandardized.parquet", columns=["address"] + FEATS)
    lut = pd.read_parquet(ROOT / "data" / "gold" / "wallet_label_lut.parquet")
    df = df.merge(lut, on="address")
    df = df[df["cluster"] >= 0]
    df["family"] = df["cluster"].map(FAMILY)

    fams = sorted(df["family"].unique())
    code = {f: i for i, f in enumerate(fams)}
    X, y = df[FEATS], df["family"].map(code)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)

    clf = XGBClassifier(n_estimators=300, max_depth=6, learning_rate=0.2,
                        tree_method="hist", n_jobs=-1, eval_metric="mlogloss")
    clf.fit(Xtr, ytr)

    pred = [fams[i] for i in clf.predict(Xte)]
    true = [fams[i] for i in yte]
    print(classification_report(true, pred, zero_division=0))

    joblib.dump((clf, FEATS, fams), DATA / "xgb_family_1h.joblib")
    print(f"saved -> {DATA / 'xgb_family_1h.joblib'}")


if __name__ == "__main__":
    main()
