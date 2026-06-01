"""ChainSense data-access: parquet lookups, DuckDB, cluster->family map, model artifacts.

Author: Chris Kim
"""
import json, math
from collections import defaultdict
from pathlib import Path

import duckdb

DATA = Path(__file__).parent / "data"
LUT = (DATA / "wallet_lut.parquet").as_posix()
FEATS = (DATA / "wallet_features_v5_unstandardized.parquet").as_posix()
NEW_BUCKET = "New / Unmodeled"  # senders absent from the LUT

con = duckdb.connect()  # in-memory; reads parquet directly

# cluster -> family. Server-side only (SSE counts); per-wallet endpoints don't return
# family — the frontend owns the public mapping.
FAMILY = {int(k): v for k, v in json.load(open(DATA / "cluster_archetypes.json")).items()}

_models: dict = {"clf": None, "cols": None, "scaler": None}
_lut_built = False


def load_models():
    """Load XGBoost clf + scaler. Guarded — lookup API boots even without xgboost."""
    try:
        import joblib  # noqa: WPS433

        _models["clf"], _models["cols"] = joblib.load(DATA / "xgb_cluster_clf.joblib")
        _models["scaler"] = joblib.load(DATA / "scaler_v5.joblib")
    except Exception as e:
        print(f"[startup] model not loaded ({e}); /api/wallet still works")


def family_of(cluster) -> str:
    return FAMILY.get(int(cluster), "Unclassified")


def _row_dict(cur):
    """One row -> {col: value}; NaN/Inf -> None (invalid in JSON)."""
    row = cur.fetchone()
    if row is None:
        return None
    cols = [d[0] for d in cur.description]
    return {c: (None if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v)
            for c, v in zip(cols, row)}


def effective_label(lut: dict):
    """Label facts -> (cluster, membership). hdbscan = real assignment; else cluster_xgb (-1 = noise)."""
    if lut.get("label_source") == "hdbscan":
        return int(lut["cluster"]), {"score": lut.get("cluster_prob"), "basis": "hdbscan"}
    return int(lut["cluster_xgb"]), {"score": lut.get("xgb_conf"), "basis": "xgboost"}


def lookup_wallet(addr: str):
    """(features, lut) for one address. features None = unknown; lut None = unlabeled."""
    feats = _row_dict(con.cursor().execute(
        f"SELECT * FROM read_parquet('{FEATS}') WHERE address = ?", [addr]))
    if feats is None:
        return None, None
    lut = _row_dict(con.cursor().execute(
        f"SELECT * FROM read_parquet('{LUT}') WHERE address = ?", [addr]))
    feats.pop("address", None)
    return feats, lut


def _ensure_lut():
    """Materialize the LUT into an indexed in-memory table once (realtime hot path)."""
    global _lut_built
    if _lut_built:
        return
    cur = con.cursor()
    cur.execute(f"CREATE TABLE IF NOT EXISTS lut AS SELECT address, cluster_xgb FROM read_parquet('{LUT}')")
    cur.execute("CREATE INDEX IF NOT EXISTS lut_addr ON lut(address)")
    _lut_built = True


def enrich(senders):
    """Block senders -> (family->count, [{addr, family}]). Unknowns -> NEW_BUCKET."""
    _ensure_lut()
    fam: dict = {}
    if senders:
        q = f"SELECT address, cluster_xgb FROM lut WHERE address IN ({','.join('?' * len(senders))})"
        for a, c in con.cursor().execute(q, list(senders)).fetchall():
            fam[a] = family_of(c)
    counts: dict = defaultdict(int)
    for a in senders:
        counts[fam.get(a, NEW_BUCKET)] += 1
    classified = [{"addr": a, "family": fam.get(a, NEW_BUCKET)} for a in senders]
    return dict(counts), classified
