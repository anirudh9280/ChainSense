import os, asyncio, json, websockets
from dotenv import load_dotenv
from pathlib import Path

"""CK: very basic subscription using websocketes.

"""

load_dotenv()
endpoint = f"wss://eth-mainnet.g.alchemy.com/v2/{os.getenv('ALCHEMY_KEY')}"
payload = '{"id": 1, "method": "eth_subscribe", "params": ["newHeads"]}'

WS_URL = f"wss://eth-mainnet.g.alchemy.com/v2/{os.getenv('ALCHEMY_KEY')}"
RAW_DIR = Path("data/streaming/raw")
PROCESSED_DIR = Path("data/streaming")
RECONNECT_DELAY = 5
MAX_RECONNECT_DELAY = 60


def parse_block(b):
    """Parse a full block into block row + tx rows. Same logic as fetch_blocks.py."""
    block_num = int(b["number"], 16)
    ts = int(b["timestamp"], 16)

    block_row = {
        "block": block_num,
        "ts": ts,
        "gas_used": int(b["gasUsed"], 16),
        "base_fee_wei": int(b.get("baseFeePerGas", "0x0"), 16),
        "tx_count": len(b["transactions"]),
    }

    tx_rows = []
    for tx in b["transactions"]:
        tx_rows.append({
            "block": block_num,
            "ts": ts,
            "tx_hash": tx["hash"],
            "from": tx["from"],
            "to": tx["to"],
            "value_wei": str(int(tx["value"], 16)),
            "gas": int(tx["gas"], 16),
            "input_len": len(tx["input"]),
            "is_contract_call": tx["input"] != "0x",
        })

    return block_row, tx_rows


def save_block(block_row, tx_rows, raw_block):
    """Cache raw JSON and append to streaming parquets."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    # # cache raw JSON
    # cache = RAW_DIR / f"block_{block_row['block']}.json"
    # cache.write_text(json.dumps(raw_block))

    # build dataframes
    blocks_df = pd.DataFrame([block_row])   
    tx_df = pd.DataFrame(tx_rows)
    if len(tx_df) > 0:
        tx_df["value_eth"] = tx_df["value_wei"].astype(float) / 1e18
        tx_df["dt"] = pd.to_datetime(tx_df["ts"], unit="s")

    # append to existing parquets, dedup
    blocks_path = PROCESSED_DIR / "blocks.parquet"
    tx_path = PROCESSED_DIR / "transactions.parquet"

    if blocks_path.exists():
        blocks_df = pd.concat([pd.read_parquet(blocks_path), blocks_df]).drop_duplicates("block")
    blocks_df.to_parquet(blocks_path, index=False)

    if len(tx_df) > 0:
        if tx_path.exists():
            tx_df = pd.concat([pd.read_parquet(tx_path), tx_df]).drop_duplicates("tx_hash")
        tx_df.to_parquet(tx_path, index=False)


async def subscribe():
    """Connect to Alchemy WebSocket, subscribe to newHeads,
    fetch full block by hash on each notification."""
    delay = RECONNECT_DELAY

    while True:
        try:
            async with websockets.connect(WS_URL) as ws:
                # subscribe to new block headers
                await ws.send(json.dumps({
                    "id": 1,
                    "method": "eth_subscribe",
                    "params": ["newHeads"],
                }))

                ack = json.loads(await ws.recv())
                sub_id = ack.get("result")
                print(f"Subscribed — id: {sub_id}")
                delay = RECONNECT_DELAY  # reset backoff on success

                async for raw_msg in ws:
                    msg = json.loads(raw_msg)
                    header = msg.get("params", {}).get("result", {})
                    block_hash = header.get("hash")

                    if not block_hash:
                        continue

                    block_num = int(header["number"], 16)
                    print(f"New block {block_num} — hash {block_hash[:18]}...")

                    # fetch full block by hash (includes transactions)
                    full_block = rpc("eth_getBlockByHash", [block_hash, True])

                    if full_block is None:
                        print(f"  WARNING: block {block_num} returned None, skipping")
                        continue

                    block_row, tx_rows = parse_block(full_block)
                    save_block(block_row, tx_rows, full_block)
                    print(f"  Saved block {block_num} — {len(tx_rows)} txs")

        except (websockets.ConnectionClosed, ConnectionError, OSError) as e:
            print(f"Connection lost: {e}. Reconnecting in {delay}s...")
            await asyncio.sleep(delay)
            delay = min(delay * 2, MAX_RECONNECT_DELAY)

        except KeyboardInterrupt:
            print("Shutting down.")
            break


if __name__ == "__main__":
    print("Starting block subscriber...")
    print(f"  Raw JSON  -> {RAW_DIR}")
    print(f"  Parquets  -> {PROCESSED_DIR}")
    asyncio.run(subscribe())
