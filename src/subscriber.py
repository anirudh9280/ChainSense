"""
Live subscriber for Ethereum mainnet blocks via Alchemy's WebSocket API.
This module is meant for live streaming, so we extract fields aggressively to keep payloads small.

Contributors: L. Goyal, C. Kim
Part of ChainSense — see CONTRIBUTORS.md for full list.
"""

import os, asyncio
from pathlib import Path
from web3 import AsyncWeb3, AsyncHTTPProvider, WebSocketProvider, Web3
from dotenv import load_dotenv

# 1. set up environment and directory
load_dotenv()
KEY = os.getenv("ALCHEMY_KEY")
OUT = Path("streaming"); OUT.mkdir(exist_ok=True)

# 2. Block labels needed (extracted out for future changes)
def filter_block(block):
    return {
        "blockNumber": block["number"],
        "timestamp": block["timestamp"],
        "miner": block["miner"],
        "baseFeePerGas": block.get("baseFeePerGas"),
        "logsBloom": block["logsBloom"],
    }

# 3. Transaction labels needed (extracted out for future changes)
def extract_tx(tx, r):
    return {
        "hash": tx["hash"],
        "blockNumber": tx["blockNumber"],
        "transactionIndex": tx["transactionIndex"],
        "from": tx["from"],
        "to": tx["to"],
        "value": tx["value"],
        "gas": tx["gas"],
        "input": tx["input"],
        "status": r["status"],
        "gasUsed": r["gasUsed"],
        "effectiveGasPrice": r["effectiveGasPrice"],
        "logs": r["logs"],
    }


# 3. subscribe, fetch, filter, and save.
async def run():
    http = AsyncWeb3(AsyncHTTPProvider(f"https://eth-mainnet.g.alchemy.com/v2/{KEY}"))
    last_hash = None
    async with AsyncWeb3(WebSocketProvider(f"wss://eth-mainnet.g.alchemy.com/v2/{KEY}")) as ws:
        await ws.eth.subscribe("newHeads")
        async for msg in ws.socket.process_subscriptions():
            h = msg["result"]
            if last_hash and h["parentHash"] != last_hash:
                continue
            n = h["number"]
            block = await http.eth.get_block(n, full_transactions=True)
            transactions, block = block["transactions"], filter_block(block)
            receipts = await http.eth.get_block_receipts(n)
            payload = {
                "header": filter_block(block),
                "transactions": [extract_tx(tx, r) for tx, r in zip(block["transactions"], receipts)],
            }
            (OUT / f"block_{n}.json").write_text(Web3.to_json(payload))


            pq.write_table(pa.Table.from_pylist([header]), OUT / f"block_{n}_header.parquet")
            pq.write_table(pa.Table.from_pylist(txs), OUT / f"block_{n}_txs.parquet")
            last_hash = h["hash"]
            print(f"saved {n}")

asyncio.run(run())