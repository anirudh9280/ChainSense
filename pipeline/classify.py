"""ChainSense pipeline 3/3 — classify: drains the queue, labels wallets, backfills the tally.

Author: Chris Kim
"""
import math
import sys
import time
from pathlib import Path

import duckdb
import joblib

sys.path.insert(0, (Path(__file__).parent).as_posix())
import featstore
import state
from transform import FEATS, build_features

POLL_SEC = 60
CONF_FLOOR = 0.30  # below this the model isn't sure enough — leave the wallet in NEW

HERE = Path(__file__).resolve().parent
MODEL = HERE / "data" / "model" / "xgb_cluster_1h_windows.joblib"
BRONZE = HERE / "data" / "bronze"
SILVER = HERE.parent / "data" / "silver"

_con = duckdb.connect()
_model = None


def _load():
    """Load (clf, feats, clusters) once. Lazy so importing classify never needs the
    model file present — it's read on the first real prediction."""
    global _model
    if _model is None:
        _model = joblib.load(MODEL)
    return _model


def _contracts_src():
    """Contract universe for contract_call_ratio: historical silver plus any contracts
    seen live. Bronze contracts only exist once new ones appear, so include that glob
    only when files are there — read_parquet errors on a glob that matches nothing."""
    silver = f"SELECT address FROM read_parquet('{(SILVER / 'contracts').as_posix()}/**/*.parquet')"
    if list((BRONZE / "contracts").glob("*.parquet")):
        return f"({silver} UNION ALL SELECT address FROM read_parquet('{(BRONZE / 'contracts').as_posix()}/*.parquet'))"
    return f"({silver})"


def _predict(addresses):
    """{address: (cluster, confidence)} for each due wallet.

    Recompute the wallet's behavioral features from live bronze with the SAME
    build_features the model trained on, classify its earliest fully-closed calendar-hour
    window, and keep the top class only if the model clears CONF_FLOOR — otherwise the
    wallet stays NEW ("belongs nowhere" shows up as low confidence, never a fake label).
    Every input address gets an entry so finalize_and_backfill drains the whole batch."""
    if not addresses:
        return {}
    out = {a: (state.NEW, 0.0) for a in addresses}

    clf, feats, clusters = _load()
    addr_in = "(" + ",".join(f"'{a}'" for a in addresses) + ")"
    tx_src = (f"(SELECT * FROM read_parquet('{(BRONZE / 'transactions').as_posix()}/*.parquet') "
              f"WHERE from_address IN {addr_in})")
    blocks_src = f"read_parquet('{(BRONZE / 'blocks').as_posix()}/*.parquet')"
    feat = build_features(_con, tx_src, blocks_src, _contracts_src())
    if feat.empty:
        return out

    # one prediction per wallet, on its earliest settled window
    feat = feat.sort_values("hour").groupby("address", as_index=False).first()
    proba = clf.predict_proba(feat[feats])
    records = []  # (address, cluster, conf, feats_dict) for the live feature store
    for (_, frow), p in zip(feat.iterrows(), proba):
        addr = frow["address"]
        i = int(p.argmax())
        conf = float(p[i])
        # Below the floor the model isn't sure enough — the wallet stays NEW, but we still
        # keep its features + (low) confidence so the Inspector can show why.
        cluster = int(clusters[i]) if conf >= CONF_FLOOR else state.NEW
        if conf >= CONF_FLOOR:
            out[addr] = (cluster, conf)
        fv = {f: (None if isinstance(v, float) and math.isnan(v) else float(v))
              for f in feats for v in (frow[f],)}
        records.append((addr, cluster, conf, fv))
    featstore.finalize(records)
    return out


def step():
    settled = state.get_val("settled_block")
    if settled is None:
        return
    due_rows = state.due(settled)
    if not due_rows:
        return
    pending = state.still_pending({a for _, a in due_rows})
    state.finalize_and_backfill(due_rows, _predict(pending))
    print(f"classified {len(pending)} wallets, drained {len(due_rows)} queue rows")


def main():
    state.init()
    featstore.init()
    print("classify up")
    while True:
        try:
            step()
        except Exception as e:  # noqa: BLE001
            print(f"[classify] {type(e).__name__}: {e}")
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
