"""ChainSense pipeline 2/3 — transform: bronze → per-minute cluster tally, queues new wallets.

Author: Chris Kim
Contributor: Laksh Goyal
"""
import sys
import time
from collections import Counter
from pathlib import Path

import duckdb
import pandas as pd

sys.path.insert(0, (Path(__file__).parent).as_posix())
import featstore
import state

LUT = (Path(__file__).parent / "data" / "wallet_lut.parquet").as_posix()
TX = (Path(__file__).parent / "data" / "bronze" / "transactions" / "*.parquet").as_posix()
POLL_SEC = 12

con = duckdb.connect()

# ── Shared feature builder ────────────────────────────────────────────────
# The 12 behavioral features the cluster model trains and serves on, computed
# per (sender, calendar-hour). This is the SINGLE definition: the retrain script
# runs it over historical silver, classify.py runs it over live bronze, so train
# and serve features are byte-for-byte the same code. Order matters — it's the
# column order the model expects.
FEATS = [
    "failed_tx_ratio", "contract_call_ratio", "selector_entropy", "same_block_tx_ratio",
    "counterparty_concentration_top3", "median_priority_fee_gwei", "has_eth_volume",
    "transfer_share", "approve_share", "swap_meme_share", "mint_share", "automation_share",
]

# method_selector (first 4 bytes of calldata) → coarse intent bucket. Defined here
# as the one source of truth for the *_share features; anything unlisted (incl. "0x"
# bare ETH sends) is "other" and contributes to no share. Same map at train + serve.
SELECTOR_CATEGORY = {
    "transfer":   {"0xa9059cbb", "0x23b872dd"},                                              # transfer, transferFrom
    "approve":    {"0x095ea7b3"},                                                            # approve
    "swap_meme":  {"0x3593564c", "0x791ac947", "0x7ff36ab5", "0xb6f9de95", "0x12aa3caf",     # routers / DEX aggregators
                   "0x07ed2379", "0x5f575529", "0x38ed1739", "0x18cbafe5", "0x8803dbee"},
    "mint":       {"0x1249c58b", "0x40c10f19", "0xa0712d68"},                                # mint()/mint(addr,amt)/mint(uint)
    "automation": {"0x00000000", "0xa0000000", "0x0162e2d0", "0x765e827f", "0x771d503f",     # MEV / bot / opaque routers
                   "0x2213bc0b", "0x78e111f6"},
}


def _inlist(selectors):
    return "(" + ",".join(f"'{s}'" for s in sorted(selectors)) + ")"


def build_features(con, tx_src, blocks_src, contracts_src):
    """Compute the 12 model features per (sender, calendar-hour) from raw tx data.

    tx_src / blocks_src / contracts_src are SQL table expressions (a bare
    read_parquet(...) or a parenthesized subquery) so the caller controls the
    universe: the retrain script points them at historical silver pre-filtered to
    labeled wallets; classify.py points them at live bronze scoped to due wallets.
    Returns a DataFrame [address, hour, tx_count, *FEATS]; never restricts or caps
    rows itself — that's the caller's job — so train and serve see identical math.
    """
    share = lambda cat: f"AVG(CASE WHEN method_selector IN {_inlist(SELECTOR_CATEGORY[cat])} THEN 1.0 ELSE 0.0 END)"
    q = f"""
    WITH base AS (
        SELECT
            t.from_address AS address,
            date_trunc('hour', t.block_timestamp) AS hour,
            t.block_number, t.status, t.to_address,
            COALESCE(t.value_wei, '0') AS value_wei,
            t.method_selector, t.effective_gas_price_wei,
            b.base_fee_per_gas_wei,
            (c.address IS NOT NULL) AS to_is_contract
        FROM {tx_src} t
        LEFT JOIN {blocks_src} b ON b.block_number = t.block_number
        LEFT JOIN (SELECT DISTINCT address FROM {contracts_src} _cs) c ON c.address = t.to_address
    ),
    sel AS (  -- per-selector counts, for natural-log entropy of the call mix
        SELECT address, hour, method_selector, COUNT(*)::DOUBLE AS c,
               SUM(COUNT(*)) OVER (PARTITION BY address, hour)::DOUBLE AS tot
        FROM base GROUP BY 1, 2, 3
    ),
    sel_ent AS (
        SELECT address, hour, -SUM((c/tot) * ln(c/tot)) AS selector_entropy
        FROM sel GROUP BY 1, 2
    ),
    cp AS (  -- per-counterparty counts (creations collapse to one bucket)
        SELECT address, hour, COALESCE(to_address, '0x0') AS peer, COUNT(*)::DOUBLE AS c,
               SUM(COUNT(*)) OVER (PARTITION BY address, hour)::DOUBLE AS tot,
               ROW_NUMBER() OVER (PARTITION BY address, hour ORDER BY COUNT(*) DESC) AS rk
        FROM base GROUP BY 1, 2, 3
    ),
    cp_top3 AS (
        SELECT address, hour, SUM(c)/MAX(tot) AS counterparty_concentration_top3
        FROM cp WHERE rk <= 3 GROUP BY 1, 2
    ),
    agg AS (
        SELECT
            address, hour,
            COUNT(*) AS tx_count,
            AVG(CASE WHEN status = 0 THEN 1.0 ELSE 0.0 END) AS failed_tx_ratio,
            AVG(CASE WHEN to_is_contract THEN 1.0 ELSE 0.0 END) AS contract_call_ratio,
            (COUNT(*) - COUNT(DISTINCT block_number))::DOUBLE / COUNT(*) AS same_block_tx_ratio,
            MAX(CASE WHEN value_wei <> '0' THEN 1 ELSE 0 END) AS has_eth_volume,
            median(GREATEST(0.0, (CAST(effective_gas_price_wei AS DOUBLE)
                   - CAST(COALESCE(base_fee_per_gas_wei, '0') AS DOUBLE)) / 1e9)) AS median_priority_fee_gwei,
            {share('transfer')}   AS transfer_share,
            {share('approve')}    AS approve_share,
            {share('swap_meme')}  AS swap_meme_share,
            {share('mint')}       AS mint_share,
            {share('automation')} AS automation_share
        FROM base GROUP BY 1, 2
    )
    SELECT
        a.address, a.hour, a.tx_count,
        a.failed_tx_ratio, a.contract_call_ratio,
        COALESCE(se.selector_entropy, 0.0) AS selector_entropy,
        a.same_block_tx_ratio,
        COALESCE(ct.counterparty_concentration_top3, 1.0) AS counterparty_concentration_top3,
        COALESCE(a.median_priority_fee_gwei, 0.0) AS median_priority_fee_gwei,
        a.has_eth_volume,
        a.transfer_share, a.approve_share, a.swap_meme_share, a.mint_share, a.automation_share
    FROM agg a
    LEFT JOIN sel_ent se USING (address, hour)
    LEFT JOIN cp_top3 ct USING (address, hour)
    """
    return con.execute(q).df()


def _static(addresses):
    """{address: cluster} from the frozen LUT for any of these with a real label."""
    senders_df = pd.DataFrame({"address": list(addresses)})  # noqa: F841 — duckdb scans it
    return dict(con.execute(
        f"SELECT l.address, l.cluster_xgb FROM read_parquet('{LUT}') l "
        "JOIN senders_df s ON l.address=s.address WHERE l.cluster_xgb>=0").fetchall())


def step():
    settled = state.get_val("settled_block")
    if settled is None:
        return
    cursor = state.get_val("transform_block")
    if cursor is None:  # first run: skip history, start from the live edge
        state.set_val("transform_block", settled)
        return
    if settled <= cursor:
        return

    rows = con.execute(
        f"SELECT from_address, block_number, epoch(date_trunc('minute', block_timestamp))::BIGINT AS minute "
        f"FROM read_parquet('{TX}') WHERE block_number>{cursor} AND block_number<={settled}").df()
    if rows.empty:
        state.set_val("transform_block", settled)
        return
    mins = sorted(rows["minute"].unique())
    if len(mins) < 2:  # only the open minute so far — wait for it to close
        return

    closed = mins[:-1]
    batch = rows[rows["minute"].isin(closed)]
    static = _static(set(batch["from_address"]))
    for m in closed:
        sub = batch[batch["minute"] == m]
        senders = set(sub["from_address"])
        first_block = int(sub["block_number"].min())
        known = {a: static[a] for a in senders if a in static}
        known.update(state.live_known(senders - known.keys()))
        new_addrs = list(senders - known.keys())
        state.record_minute(int(m), first_block, dict(Counter(known.values())), new_addrs, int(m))
        # Mirror each new (unclassified) wallet into the live feature store so the Inspector
        # can resolve it even before classify fills in its features/label.
        featstore.upsert_pending(new_addrs, int(m))
    state.set_val("transform_block", int(batch["block_number"].max()))


def main():
    state.init()
    featstore.init()
    print("transform up")
    while True:
        try:
            step()
        except Exception as e:  # noqa: BLE001
            print(f"[transform] {type(e).__name__}: {e}")
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
