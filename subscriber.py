"""
ChainSense — real-time Ethereum block subscriber.

Plain-English summary of what this does:

  1. Ask Alchemy for the latest *finalized* block. That's the newest block the
     network promises will never be reorganised away. We grab it once on startup
     as a sanity check (proves our key/connection works) and a reference point.
  2. Open a websocket and subscribe to "newHeads", so Alchemy pushes us a tiny
     header for every brand-new block the instant it's mined.
  3. For each header that arrives, make sure it builds directly on the last block
     we accepted — its parentHash must equal that block's hash. If it doesn't,
     it's a gap or a chain reorganisation, so we ignore it and stay on one
     single, continuous chain.
  4. For every block we accept, pull the full block (with all transactions) and
     all of its receipts from Alchemy.
  5. Save them to disk, remember this block as the new "last accepted" block,
     and wait for the next one.

Run it:
    # ALCHEMY_KEY must be set, e.g. in a .env file next to this script
    python subscriber.py
"""

import os
import json
import asyncio
from pathlib import Path

import requests
import websockets
from dotenv import load_dotenv


# ---------------------------------------------------------------------------
# Setup: read the API key once and build the two URLs we'll talk to.
# ---------------------------------------------------------------------------
load_dotenv()                          # pulls ALCHEMY_KEY out of a local .env file
ALCHEMY_KEY = os.getenv("ALCHEMY_KEY")

# Alchemy gives us two doors into the same node:
#   - HTTP, for normal "ask a question, get an answer" calls.
#   - WebSocket, for a live stream that it pushes to us.
HTTP_URL = f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}"
WS_URL = f"wss://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}"

# One JSON file per block lands here. Kept out of git (see .gitignore).
OUT_DIR = Path(os.getenv("STREAM_OUT_DIR", "streaming"))


def rpc(method, params):
    """Make one JSON-RPC call to Alchemy over HTTP and return its result.

    Every Ethereum HTTP call uses the same little envelope, so we write it once
    here. If Alchemy reports an error we raise it, so problems are loud, not silent.
    """
    response = requests.post(
        HTTP_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=30,
    )
    body = response.json()
    if "error" in body:
        raise RuntimeError(f"Alchemy error on {method}: {body['error']}")
    return body["result"]


def save_block(header_fields, full_block, receipts):
    """Write everything we gathered for one block into a single JSON file.

    Deliberately the simplest thing that works: one file per block. When you want
    parquet / a database later, this is the only function you have to change.
    """
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = OUT_DIR / f"block_{header_fields['blockNumber']}.json"
    out_file.write_text(json.dumps(
        {"header": header_fields, "block": full_block, "receipts": receipts}
    ))


async def run():
    # -- Step 1: finalized block = our startup reference ----------------------
    # "finalized" is the newest block that can never be reorged. We fetch it once,
    # mostly to prove the key/connection works and to show where finality sits.
    # Heads-up: the live "newHeads" feed below runs minutes AHEAD of this block,
    # so we don't chain directly off it — we start our chain from the first live
    # header that arrives (see Step 3).
    finalized = rpc("eth_getBlockByNumber", ["finalized", True])
    print(f"Finalized block right now: {int(finalized['number'], 16)} "
          f"({finalized['hash'][:12]}...). Waiting for live blocks ahead of it.\n")

    # The hash of the last block we accepted. None until the first header arrives.
    last_hash = None

    # -- Step 2: subscribe to new block headers over the websocket ------------
    async with websockets.connect(WS_URL) as ws:
        await ws.send(json.dumps(
            {"id": 1, "method": "eth_subscribe", "params": ["newHeads"]}
        ))
        await ws.recv()                # first reply is just the subscription id
        print("Subscribed to newHeads. Listening...\n")

        # -- Step 3: handle every header Alchemy pushes us --------------------
        async for raw_message in ws:
            header = json.loads(raw_message).get("params", {}).get("result")
            if not header:
                continue               # not a block notification — skip it

            block_number = int(header["number"], 16)

            # Continuity guard: a block only counts if it sits right on top of the
            # last block we accepted. The very first header has nothing to compare
            # against, so we accept it to start our chain.
            if last_hash is not None and header["parentHash"] != last_hash:
                print(f"Ignoring block {block_number}: doesn't build on our chain "
                      f"(reorg or gap).")
                continue

            # -- Step 4: keep just the header fields we care about ------------
            header_fields = {
                "blockNumber": block_number,
                "timestamp": int(header["timestamp"], 16),
                "miner": header["miner"],
                "baseFeePerGas": (int(header["baseFeePerGas"], 16)
                                  if header.get("baseFeePerGas") else None),
                "logsBloom": header["logsBloom"],
            }

            # -- Step 5: fetch the full block + all of its receipts -----------
            # The header is tiny; these two calls get the actual transactions and
            # their outcomes (gas used, status, emitted logs, etc.).
            full_block = rpc("eth_getBlockByNumber", [hex(block_number), True])
            receipts = rpc("eth_getBlockReceipts", [hex(block_number)])

            # -- Step 6: save it and move our chain pointer forward -----------
            save_block(header_fields, full_block, receipts)
            last_hash = header["hash"]
            print(f"Saved block {block_number}: "
                  f"{len(full_block['transactions'])} txs, {len(receipts)} receipts")


if __name__ == "__main__":
    # asyncio.run starts the event loop and runs our coroutine until Ctrl-C.
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nStopped.")
