import os, asyncio, json, websockets
from dotenv import load_dotenv

"""CK: very basic subscription using websocketes.

"""

load_dotenv()
endpoint = f"wss://eth-mainnet.g.alchemy.com/v2/{os.getenv('ALCHEMY_KEY')}"
payload = '{"id": 1, "method": "eth_subscribe", "params": ["newHeads"]}'

async def main():
    async with websockets.connect(endpoint) as ws:
        await ws.send(payload)
        async for msg in ws:
            print(json.loads(msg))
asyncio.run(main())