"""
ChainSense Backend — Static Lookup API

Serves wallet label look up for the Wallet Inspector and Live ACTIVE WALLETS BY FAMILY stream.
Handles selector decoding, cluster archetype resolution, and behavioral scoring.

Author: Chris Kim
"""
import asyncio, json, duckdb, joblib
from collections import defaultdict
from fastapi import FastAPI
from sse_starlette.sse import EventSourceResponse

app = FastAPI()
con = duckdb.connect()

FAMILY = {int(k): v["family"] for k, v in json.load(open("data/cluster_archetypes.json")).items()}

@app.on_event("startup")
def load():
    # LUT + raw features into in-memory tables once; model loaded for later inference
    col = "cluster_xgb"  # or 'cluster'
    con.execute(f"""CREATE TABLE lut AS
        SELECT address, {col} AS cluster FROM read_parquet('data/wallet_label_lut.parquet')""")
    con.execute("CREATE INDEX idx ON lut(address)")
    con.execute("""CREATE TABLE feats AS
        SELECT * FROM read_parquet('data/wallet_features_v5_unstandardized.parquet')""")
    app.state.clf, app.state.cols = joblib.load("data/xgb_cluster_clf.joblib")
    app.state.scaler = joblib.load("data/scaler_v5.joblib")

def family_of(cluster):           # int label -> family name
    return FAMILY.get(int(cluster), "Unclassified")

# --- static lookups (Wallet Inspector) ---
@app.get("/api/wallet/{addr}")
def wallet(addr: str):
    r = con.execute("SELECT * FROM feats WHERE address = ?", [addr.lower()]).df()
    c = con.execute("SELECT cluster FROM lut WHERE address = ?", [addr.lower()]).fetchone()
    if r.empty: return {"found": False}
    return {"found": True, "family": family_of(c[0]) if c else "Unclassified",
            "features": r.iloc[0].to_dict()}

def lookup_families(addrs):       # BATCHED: one query for the whole block
    if not addrs: return {}
    q = f"SELECT address, cluster FROM lut WHERE address IN ({','.join('?'*len(addrs))})"
    rows = con.execute(q, addrs).fetchall()
    return {a: family_of(c) for a, c in rows}

# --- live stream (SSE, server->client only) ---
async def block_loop(queue):
    """Per finalized block: get senders, batch-lookup families, emit counts + log."""
    while True:
        senders = await get_block_senders()          # <- Alchemy newHeads, lagged 64 blocks (TODO)
        fams = lookup_families(senders)
        counts = defaultdict(int)
        for a in senders:
            counts[fams.get(a, "Unclassified")] += 1
        await queue.put({"type":"counts", "data":dict(counts)})
        for a in list(senders)[:20]:                  # classification log sample
            await queue.put({"type":"classified","data":{"addr":a,"family":fams.get(a,"Unclassified")}})
        await asyncio.sleep(12)

@app.get("/api/stream")
async def stream():
    q = asyncio.Queue()
    asyncio.create_task(block_loop(q))
    async def gen():
        while True:
            ev = await q.get()
            yield {"event": ev["type"], "data": json.dumps(ev["data"])}
    return EventSourceResponse(gen())


# TODO: implement get_block_senders() with Alchemy WS + eth_getBlockByNumber, lagged 64 blocks for finality
#   get_block_senders(): Alchemy newHeads WS, lag 64 blocks (finality), eth_getBlockByNumber,
#                        return set of unique from_addresses (lowercased)
#   ETH price feed -> emit {"type":"price"} events into the same queue
#   anomaly: flag low xgb_conf / phishing signature -> {"type":"anomaly"} events
#   pub/sub: if multiple consumers, swap the single queue for Redis pub/sub fan-out