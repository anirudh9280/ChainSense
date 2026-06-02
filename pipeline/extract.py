"""ChainSense pipeline 1/3 — extract: Alchemy → bronze, publishes the settled_block cursor.

Extracts data into /pipeline/data/bronze/ in the same schema as /data/bronze/.
Sole writer of live bronze. Every settled block also bumps the `settled_block`
cursor in live_lut.sqlite, which transform and the API read.

Author: Chris Kim
Contributor: Laksh Goyal
"""
import os
import time
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests
from dotenv import load_dotenv

import state

load_dotenv(Path(__file__).parent.parent / ".env")
HTTP_URL = f"https://eth-mainnet.g.alchemy.com/v2/{os.environ.get('ALCHEMY_KEY', '')}"

# Bronze lives pipeline/data/ (a symlink to the data volume) so live and historical
# files unify under one glob — transform.py reads this exact path.
BRONZE = Path(os.getenv("BRONZE_OUT", Path(__file__).parent.parent /  "pipeline" / "data" / "bronze"))
TABLES = ("blocks", "transactions", "token_transfers", "contracts")

FINALITY_LAG = 64    # only ingest settled blocks — no reorgs
POLL_SEC = 12        # one slot
MAX_BACKFILL = 600   # resume from disk only if within ~2h of the live edge; else snap to it

# keccak256("Transfer(address,uint256)") — ERC-20 fungible transfer (3 topics).
TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

_STR, _I64, _TS = pa.string(), pa.int64(), pa.timestamp("us")
# Fixed schemas matching the historical /data bronze exactly (string, not
# large_string) so a glob over historical + live files unifies cleanly.
SCHEMAS = {
    "blocks": pa.schema([
        ("block_number", _I64), ("block_timestamp", _TS),
        ("base_fee_per_gas_wei", _STR), ("miner", _STR),
        ("block_gas_used", _I64), ("block_gas_limit", _I64),
        ("transaction_count", _I64)]),
    "transactions": pa.schema([
        ("tx_hash", _STR), ("block_number", _I64), ("block_timestamp", _TS),
        ("from_address", _STR), ("to_address", _STR), ("value_wei", _STR),
        ("gas_limit", _I64), ("gas_price_wei", _STR), ("gas_used", _I64),
        ("status", _I64), ("effective_gas_price_wei", _STR),
        ("method_selector", _STR)]),
    "token_transfers": pa.schema([
        ("token_address", _STR), ("from_address", _STR), ("to_address", _STR),
        ("value", _STR), ("transaction_hash", _STR), ("block_number", _I64),
        ("block_timestamp", _TS)]),
    "contracts": pa.schema([("address", _STR)]),
}

# addr -> bool(has code); and addresses already written to contracts (append new only).
_code_cache: dict[str, bool] = {}
_known_contracts: set[str] = set()


def rpc(method, params):
    """One JSON-RPC call over HTTP. Raises loudly on error."""
    body = requests.post(
        HTTP_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=30,
    ).json()
    if "error" in body:
        raise RuntimeError(f"Alchemy error on {method}: {body['error']}")
    return body["result"]


def _hexint(x):
    return int(x, 16) if isinstance(x, str) else int(x)


def _addr(topic):
    """Last 20 bytes of a 32-byte log topic -> 0x-address."""
    return "0x" + topic[-40:].lower()


def is_contract(addr):
    """True if the address has bytecode. Cached (both outcomes) to bound RPC."""
    a = addr.lower()
    if a in _code_cache:
        return _code_cache[a]
    code = rpc("eth_getCode", [a, "latest"])
    has = code not in (None, "0x", "0x0")
    _code_cache[a] = has
    return has


def _write(df, tbl, path):
    schema = SCHEMAS[tbl]
    # An empty block yields a column-less DataFrame; from_pandas can't map the schema
    # onto it, so emit a typed empty table instead.
    table = schema.empty_table() if df.empty else pa.Table.from_pandas(df, schema=schema, preserve_index=False)
    pq.write_table(table, path)


def seed_caches():
    """Preload known contracts from prior bronze output so we don't re-getCode them."""
    for tbl in TABLES:
        (BRONZE / tbl).mkdir(parents=True, exist_ok=True)
    for f in sorted((BRONZE / "contracts").glob("block-*.parquet")):
        for a in pd.read_parquet(f)["address"]:
            _known_contracts.add(a)
            _code_cache[a] = True
    if _known_contracts:
        print(f"seeded {len(_known_contracts):,} known contracts from prior output")


def build_block(full_block, receipts):
    """Transform one (full block, receipts) pair into the four bronze frames.

    Returns (blocks_df, txs_df, transfers_df, contracts_df). Frames may be empty.
    """
    n = _hexint(full_block["number"])
    ts = pd.Timestamp(_hexint(full_block["timestamp"]), unit="s").as_unit("us")
    rmap = {r["transactionHash"]: r for r in receipts}

    base_fee = full_block.get("baseFeePerGas")
    blocks_df = pd.DataFrame([{
        "block_number": n,
        "block_timestamp": ts,
        "base_fee_per_gas_wei": str(_hexint(base_fee)) if base_fee is not None else None,
        "miner": full_block["miner"],
        "block_gas_used": _hexint(full_block["gasUsed"]),
        "block_gas_limit": _hexint(full_block["gasLimit"]),
        "transaction_count": len(full_block["transactions"]),
    }])

    tx_rows, transfer_rows = [], []
    contract_addrs: set[str] = set()

    for tx in full_block["transactions"]:
        r = rmap.get(tx["hash"], {})
        inp = tx.get("input", "0x")
        selector = inp[:10] if len(inp) >= 10 else "0x"
        to = tx["to"].lower() if tx.get("to") else None
        tx_rows.append({
            "tx_hash": tx["hash"],
            "block_number": n,
            "block_timestamp": ts,
            "from_address": tx["from"].lower(),
            "to_address": to,
            "value_wei": str(_hexint(tx["value"])),
            "gas_limit": _hexint(tx["gas"]),
            "gas_price_wei": str(_hexint(tx["gasPrice"])) if tx.get("gasPrice") is not None else None,
            "gas_used": _hexint(r["gasUsed"]) if r.get("gasUsed") is not None else 0,
            "status": _hexint(r["status"]) if r.get("status") is not None else 1,
            "effective_gas_price_wei": str(_hexint(r["effectiveGasPrice"])) if r.get("effectiveGasPrice") is not None else None,
            "method_selector": selector,
        })

        # contract creations: the new address is a contract.
        created = r.get("contractAddress")
        if created:
            contract_addrs.add(created.lower())
        # a tx carrying calldata to a non-null target is calling a contract; confirm
        # with code so contract_call_ratio matches the historical address_codes
        # definition (a bare payable call has selector '0x').
        if to is not None and selector != "0x" and is_contract(to):
            contract_addrs.add(to)

        for log in r.get("logs", []):
            topics = log.get("topics", [])
            if len(topics) == 3 and topics[0].lower() == TRANSFER_SIG:
                token = log["address"].lower()
                contract_addrs.add(token)
                _code_cache[token] = True
                data = log.get("data") or "0x"
                transfer_rows.append({
                    "token_address": token,
                    "from_address": _addr(topics[1]),
                    "to_address": _addr(topics[2]),
                    "value": str(_hexint(data)) if data != "0x" else "0",
                    "transaction_hash": log["transactionHash"],
                    "block_number": n,
                    "block_timestamp": ts,
                })

    txs_df = pd.DataFrame(tx_rows)
    transfers_df = pd.DataFrame(transfer_rows)
    new_contracts = sorted(contract_addrs - _known_contracts)
    contracts_df = pd.DataFrame({"address": new_contracts}) if new_contracts else pd.DataFrame({"address": pd.Series([], dtype="string")})
    return blocks_df, txs_df, transfers_df, contracts_df


def write_block(n, blocks_df, txs_df, transfers_df, contracts_df):
    """Append one block's frames as per-block parquet files in the bronze scheme."""
    name = f"block-{n:012d}.parquet"
    _write(blocks_df, "blocks", BRONZE / "blocks" / name)
    _write(txs_df, "transactions", BRONZE / "transactions" / name)
    if not transfers_df.empty:
        _write(transfers_df, "token_transfers", BRONZE / "token_transfers" / name)
    if not contracts_df.empty:
        _write(contracts_df, "contracts", BRONZE / "contracts" / name)
        _known_contracts.update(contracts_df["address"])


def last_block():
    """Highest block already on disk, so a restart resumes instead of refetching."""
    files = sorted((BRONZE / "blocks").glob("block-*.parquet"))
    return int(files[-1].stem.split("-")[1]) if files else None


def ingest(num):
    """Fetch one block + its receipts and append the four bronze frames."""
    block = rpc("eth_getBlockByNumber", [hex(num), True])
    receipts = rpc("eth_getBlockReceipts", [hex(num)]) or []
    write_block(num, *build_block(block, receipts))


def main():
    state.init()
    seed_caches()
    live_edge = int(rpc("eth_blockNumber", []), 16) - FINALITY_LAG
    disk = last_block()
    # Resume from disk only if we're genuinely near the live edge; otherwise
    # (empty or stale bronze) jump to the edge instead of crawling from genesis.
    processed = disk if disk is not None and disk >= live_edge - MAX_BACKFILL else live_edge
    state.set_val("settled_block", processed)
    print(f"extract up — resuming after block {processed}")
    while True:
        try:
            head = int(rpc("eth_blockNumber", []), 16)
            while processed < head - FINALITY_LAG:
                processed += 1
                ingest(processed)
                state.set_val("settled_block", processed)
                print(f"wrote block {processed}")
        except Exception as e:  # noqa: BLE001
            print(f"[extract] {type(e).__name__}: {e}")
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
