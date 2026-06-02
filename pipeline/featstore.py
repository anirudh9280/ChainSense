"""ChainSense live feature store (live_feat.sqlite): per-wallet behavioral features +
model label for wallets first seen live — the ones absent from the frozen
wallet_feat.parquet / wallet_lut.parquet snapshot. This is the live mirror of that
static pair, and it lets the Wallet Inspector resolve a fresh wallet through a
static->live fallback chain instead of 404ing.

A wallet's first-hour features don't exist until its 1h window settles, so the row is
written in two phases: transform stubs it as 'pending' at first sighting (address only);
classify fills in the 12-feature vector + cluster/confidence once it classifies the
wallet, flipping it to 'final'.

Author: Chris Kim
"""
import json
import sqlite3
from pathlib import Path

DB = (Path(__file__).parent / "data" / "live_feat.sqlite").as_posix()


def _connect():
    con = sqlite3.connect(DB, timeout=30)
    con.execute("PRAGMA busy_timeout=5000")
    return con


def init():
    """Create the table + enable WAL once. Safe to call on every boot."""
    Path(DB).parent.mkdir(parents=True, exist_ok=True)
    con = _connect()
    con.execute("PRAGMA journal_mode=WAL")
    con.execute(
        "CREATE TABLE IF NOT EXISTS live_feat ("
        "address TEXT PRIMARY KEY, state TEXT, cluster INTEGER, confidence REAL, "
        "feats TEXT, ts INTEGER, final_ts INTEGER)")
    con.commit()
    con.close()


def upsert_pending(addresses, ts):
    """Stub each newly-seen wallet as 'pending' — no features yet, since they don't
    exist until the wallet's first hour settles. Idempotent on the address PK, so
    re-seeing a still-pending (or already-final) wallet is a no-op."""
    if not addresses:
        return
    con = _connect()
    try:
        con.executemany(
            "INSERT OR IGNORE INTO live_feat (address, state, ts) VALUES (?, 'pending', ?)",
            [(a, ts) for a in addresses])
        con.commit()
    finally:
        con.close()


def finalize(records):
    """Stamp the computed feature vector + model label onto each classified wallet.
    `records` is [(address, cluster, confidence, feats_dict)]; feats_dict is the 12
    model features. Flips the row to 'final' (inserting it if transform never stubbed
    it). final_ts is wall-clock finalization seconds."""
    if not records:
        return
    con = _connect()
    try:
        con.executemany(
            "INSERT INTO live_feat (address, state, cluster, confidence, feats, final_ts) "
            "VALUES (?, 'final', ?, ?, ?, CAST(strftime('%s','now') AS INTEGER)) "
            "ON CONFLICT(address) DO UPDATE SET state='final', cluster=excluded.cluster, "
            "confidence=excluded.confidence, feats=excluded.feats, final_ts=excluded.final_ts",
            [(a, c, conf, json.dumps(f)) for a, c, conf, f in records])
        con.commit()
    finally:
        con.close()


def lookup(address):
    """One wallet's live row as a dict (feats parsed back to a dict), or None if the
    wallet was never seen live. The read side of the Inspector's fallback chain."""
    con = _connect()
    try:
        row = con.execute(
            "SELECT address, state, cluster, confidence, feats, ts, final_ts "
            "FROM live_feat WHERE address=?", (address,)).fetchone()
    finally:
        con.close()
    if row is None:
        return None
    address, st, cluster, confidence, feats, ts, final_ts = row
    return {"address": address, "state": st, "cluster": cluster, "confidence": confidence,
            "feats": json.loads(feats) if feats else {}, "ts": ts, "final_ts": final_ts}
