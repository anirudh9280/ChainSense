"""CK: Single-purpose RPC wrapper. Imported by every fetcher."""
import os, time, requests
from dotenv import load_dotenv

load_dotenv()
URL = f"https://eth-mainnet.g.alchemy.com/v2/{os.getenv('ALCHEMY_KEY')}"

def rpc(method, params, retries=4):
    """Call an Alchemy JSON-RPC method. Retries on 429 and transient errors."""
    for attempt in range(retries):
        try:
            r = requests.post(
                URL,
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                timeout=30,
            )
            if r.status_code == 429:
                # rate limited — back off and retry
                time.sleep(2 ** attempt)
                continue
            result = r.json()
            if "error" in result:
                raise Exception(result["error"])
            return result["result"]
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt+1} after error: {e}")
            time.sleep(2 ** attempt)

def latest_block():
    return int(rpc("eth_blockNumber", []), 16)