"""ChainSense — live bronze ingest.

Streams accepted Ethereum blocks and appends them to
``backend/data/bronze/{blocks,transactions,token_transfers,contracts}/`` in the
*same* parquet schema as the historical ``/data`` lake, so the 1h feature
builder reads live and historical data through one identical path.

What it produces per accepted block (one parquet file per table, named by
zero-padded block number so a glob sorts chronologically and the trailing-1h
window is a simple tail):

  blocks/block-<n>.parquet           one row  — header + base fee (for priority fee)
  transactions/block-<n>.parquet     N rows   — tx fields merged with receipt status/gas
  token_transfers/block-<n>.parquet  M rows   — ERC-20 Transfer events decoded from receipt logs
  contracts/block-<n>.parquet        K rows   — newly-seen contract addresses (append-only set)

Two modes:
    python backend/streamer.py                 # live: subscribe to newHeads
    python backend/streamer.py --backfill 300  # grab the last ~300 settled blocks then exit (≈1h)

ALCHEMY_KEY must be set in the repo-root .env.

Author: Chris Kim
"""
import argparse
import json
import os
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests
import websockets
import asyncio
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
ALCHEMY_KEY = os.environ.get("ALCHEMY_KEY", "")
HTTP_URL = f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}"
WS_URL = f"wss://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}"

# Only ingest settled blocks so we never write a tx that later reorgs away.
FINALITY_LAG = 64

BRONZE = Path(os.getenv("BRONZE_OUT", Path(__file__).parent / "data" / "bronze"))
TABLES = ("blocks", "transactions", "token_transfers", "contracts")

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


def _write(df, tbl, path):
    pq.write_table(pa.Table.from_pandas(df, schema=SCHEMAS[tbl], preserve_index=False), path)

# keccak256("Transfer(address,uint256)") — ERC-20 fungible transfer (3 topics).
TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# addr -> bool(has code). Seeded from our own prior output; grows via eth_getCode.
_code_cache: dict[str, bool] = {}
# addresses already written to the contracts table, so we only append new ones.
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


def is_contract(addr: str) -> bool:
    """True if the address has bytecode. Cached (both outcomes) to bound RPC."""
    a = addr.lower()
    if a in _code_cache:
        return _code_cache[a]
    code = rpc("eth_getCode", [a, "latest"])
    has = code not in (None, "0x", "0x0")
    _code_cache[a] = has
    return has


def seed_caches():
    """Preload known contracts from prior bronze output so we don't re-getCode them."""
    BRONZE.mkdir(parents=True, exist_ok=True)
    for tbl in TABLES:
        (BRONZE / tbl).mkdir(parents=True, exist_ok=True)
    files = sorted((BRONZE / "contracts").glob("block-*.parquet"))
    for f in files:
        for a in pd.read_parquet(f)["address"]:
            _known_contracts.add(a)
            _code_cache[a] = True
    if files:
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
        # a tx carrying calldata to a non-null target is calling a contract;
        # confirm with code so contract_call_ratio matches the historical
        # address_codes definition (a bare payable call has selector '0x').
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


def ingest_block(n):
    full_block = rpc("eth_getBlockByNumber", [hex(n), True])
    receipts = rpc("eth_getBlockReceipts", [hex(n)])
    frames = build_block(full_block, receipts)
    write_block(n, *frames)
    _, txs_df, transfers_df, contracts_df = frames
    print(f"block {n}: {len(txs_df)} txs, {len(transfers_df)} transfers, "
          f"+{len(contracts_df)} contracts")


def backfill(n_blocks):
    head = _hexint(rpc("eth_blockNumber", []))
    end = head - FINALITY_LAG
    start = end - n_blocks + 1
    print(f"backfill: settled blocks {start}..{end} ({n_blocks} blocks)")
    for n in range(start, end + 1):
        ingest_block(n)
    print("backfill done.")


async def live():
    finalized = rpc("eth_getBlockByNumber", ["finalized", True])
    print(f"finalized at {_hexint(finalized['number'])}; streaming head-{FINALITY_LAG} "
          f"settled blocks.\n")
    last_settled = None
    async with websockets.connect(WS_URL) as ws:
        await ws.send(json.dumps({"id": 1, "method": "eth_subscribe", "params": ["newHeads"]}))
        await ws.recv()
        print("subscribed to newHeads. listening...\n")
        async for raw in ws:
            header = json.loads(raw).get("params", {}).get("result")
            if not header:
                continue
            # ingest the block that just became settled (head - FINALITY_LAG).
            settle = _hexint(header["number"]) - FINALITY_LAG
            if last_settled is None:
                last_settled = settle - 1
            for n in range(last_settled + 1, settle + 1):
                ingest_block(n)
            last_settled = settle


def main():
    ap = argparse.ArgumentParser(description="ChainSense live bronze ingest.")
    ap.add_argument("--backfill", type=int, metavar="N",
                    help="ingest the last N settled blocks then exit (e.g. 300 ≈ 1h)")
    args = ap.parse_args()
    if not ALCHEMY_KEY:
        raise SystemExit("ALCHEMY_KEY not set (repo-root .env)")
    seed_caches()
    if args.backfill:
        backfill(args.backfill)
    else:
        try:
            asyncio.run(live())
        except KeyboardInterrupt:
            print("\nstopped.")


if __name__ == "__main__":
    main()
