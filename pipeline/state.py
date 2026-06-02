"""ChainSense pipeline state (SQLite/WAL): live LUT, per-minute tally, deferred queue, cursors.

Author: Chris Kim
"""
from pathlib import Path

import sqlite3

DB = (Path(__file__).parent / "data" / "live_lut.sqlite").as_posix()
NEW = -2  # tally bucket for a sender we haven't classified yet


def _connect():
    con = sqlite3.connect(DB, timeout=30)
    con.execute("PRAGMA busy_timeout=5000")
    return con


def init():
    """Create tables + enable WAL once. Safe to call on every boot."""
    Path(DB).parent.mkdir(parents=True, exist_ok=True)
    con = _connect()
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("CREATE TABLE IF NOT EXISTS live_lut (address TEXT PRIMARY KEY, cluster INTEGER, confidence REAL, state TEXT, ts INTEGER)")
    con.execute("CREATE TABLE IF NOT EXISTS live_tally (minute INTEGER, cluster INTEGER, n INTEGER, PRIMARY KEY (minute, cluster))")
    con.execute("CREATE TABLE IF NOT EXISTS to_classify (minute INTEGER, address TEXT, due_block INTEGER, PRIMARY KEY (minute, address))")
    con.execute("CREATE TABLE IF NOT EXISTS pipeline_state (key TEXT PRIMARY KEY, value INTEGER)")
    # ts is first-seen (the enqueue minute); final_ts is wall-clock finalization, the
    # cursor the live `classified` feed reads. Added separately so the feed can resume
    # by finalize order after a restart without replaying the whole backlog.
    try:
        con.execute("ALTER TABLE live_lut ADD COLUMN final_ts INTEGER")
    except sqlite3.OperationalError:
        pass  # column already present
    con.commit()
    con.close()


def set_val(key, value):
    con = _connect()
    con.execute("INSERT INTO pipeline_state VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
    con.commit()
    con.close()


def get_val(key):
    con = _connect()
    try:
        row = con.execute("SELECT value FROM pipeline_state WHERE key=?", (key,)).fetchone()
        return row[0] if row else None
    finally:
        con.close()


def composition(after_minute=-1):
    """[(minute, cluster, n)] for closed minutes after `after_minute`, in order.
    The read side of live_tally — the API rolls cluster->family for the live chart."""
    con = _connect()
    try:
        return con.execute("SELECT minute, cluster, n FROM live_tally WHERE minute>? ORDER BY minute, cluster", (after_minute,)).fetchall()
    finally:
        con.close()


def recently_classified(after_final_ts=-1):
    """[(address, cluster, confidence, final_ts)] for model-classified wallets finalized
    after the given finalize-time cursor, oldest→newest. Drives the live `classified` feed:
    NEW and noise (cluster<0) are excluded, so only real model assignments surface, each
    with the model's confidence. Rows finalized before final_ts existed (NULL) never appear
    — the feed starts fresh, no backlog replay."""
    con = _connect()
    try:
        return con.execute(
            "SELECT address, cluster, confidence, final_ts FROM live_lut "
            "WHERE state='final' AND cluster>=0 AND final_ts IS NOT NULL AND final_ts>? "
            "ORDER BY final_ts", (after_final_ts,)).fetchall()
    finally:
        con.close()


def live_known(addresses):
    """{address: cluster} for any of these already finalized to a real cluster."""
    if not addresses:
        return {}
    con = _connect()
    try:
        q = f"SELECT address, cluster FROM live_lut WHERE state='final' AND cluster>=0 AND address IN ({','.join('?' * len(addresses))})"
        return {a: c for a, c in con.execute(q, list(addresses)).fetchall()}
    finally:
        con.close()


def record_minute(minute, first_block, cluster_counts, new_addrs, ts):
    """Commit one closed minute: bump the per-cluster tally, bucket unclassified
    senders under NEW, and enqueue each of them for deferred classification (due one
    hour / 300 blocks later). All in one transaction so a reader never sees a partial
    minute. Re-enqueuing an address that's still pending is a no-op on the PKs."""
    con = _connect()
    try:
        con.execute("BEGIN")
        for cluster, n in cluster_counts.items():
            con.execute("INSERT INTO live_tally VALUES (?, ?, ?) ON CONFLICT(minute, cluster) DO UPDATE SET n=n+excluded.n", (minute, cluster, n))
        if new_addrs:
            con.execute("INSERT INTO live_tally VALUES (?, ?, ?) ON CONFLICT(minute, cluster) DO UPDATE SET n=n+excluded.n", (minute, NEW, len(new_addrs)))
            due = first_block + 300
            con.executemany("INSERT OR IGNORE INTO to_classify VALUES (?, ?, ?)", [(minute, a, due) for a in new_addrs])
            con.executemany("INSERT OR IGNORE INTO live_lut (address, cluster, confidence, state, ts) VALUES (?, NULL, NULL, 'pending', ?)", [(a, ts) for a in new_addrs])
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def due(settled):
    """[(minute, address)] whose 1h window has fully settled and can be classified."""
    con = _connect()
    try:
        return con.execute("SELECT minute, address FROM to_classify WHERE due_block<=?", (settled,)).fetchall()
    finally:
        con.close()


def still_pending(addresses):
    """The subset of these addresses we haven't classified yet (classify-once)."""
    if not addresses:
        return set()
    con = _connect()
    try:
        q = f"SELECT address FROM live_lut WHERE state='pending' AND address IN ({','.join('?' * len(addresses))})"
        return {a for (a,) in con.execute(q, list(addresses)).fetchall()}
    finally:
        con.close()


def finalize_and_backfill(due_rows, labels):
    """Stamp predictions onto live_lut, move each due sender out of the NEW bucket into
    its real cluster for every minute it appeared in, then drain those queue rows. One
    transaction. Backfill reads each address's final cluster, so rows queued before the
    address was classified still settle correctly. NEW/noise predictions stay put."""
    con = _connect()
    try:
        con.execute("BEGIN")
        con.executemany("UPDATE live_lut SET cluster=?, confidence=?, state='final', final_ts=CAST(strftime('%s','now') AS INTEGER) WHERE address=? AND state='pending'",
                        [(c, conf, a) for a, (c, conf) in labels.items()])
        for minute, address in due_rows:
            row = con.execute("SELECT cluster, state FROM live_lut WHERE address=?", (address,)).fetchone()
            if row and row[1] == "final" and row[0] is not None and row[0] >= 0:
                con.execute("UPDATE live_tally SET n=n-1 WHERE minute=? AND cluster=?", (minute, NEW))
                con.execute("INSERT INTO live_tally VALUES (?, ?, 1) ON CONFLICT(minute, cluster) DO UPDATE SET n=n+1", (minute, row[0]))
        con.executemany("DELETE FROM to_classify WHERE minute=? AND address=?", due_rows)
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
