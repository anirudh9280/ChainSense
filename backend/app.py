"""ChainSense API: wallet lookup, AI news digest, SSE live feed. Data access in db.py.

Author: Chris Kim
"""
import asyncio, json, os, re, time
from collections import deque
from html import escape
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

import db

load_dotenv(Path(__file__).parent.parent / ".env")
ALCHEMY_KEY = os.environ.get("ALCHEMY_KEY", "")
ALCHEMY_HTTP = f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}"
ALCHEMY_WS = f"wss://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}"
FINALITY_LAG = 64  # classify head-64 — only settled blocks

COINBASE_SPOT = "https://api.coinbase.com/v2/prices/ETH-USD/spot"  # public, no auth
TICKER_INTERVAL = 5  # seconds

app = FastAPI(title="ChainSense API")
app.add_middleware(CORSMiddleware, allow_origins=["https://chainsense-eth.vercel.app"], allow_methods=["GET"])


@app.on_event("startup")
def load():
    db.load_models()


# --- wallet lookup ---------------------------------------------------------
@app.get("/api/wallet/{addr}")
def wallet(addr: str):
    a = addr.strip().lower()
    feats, lut = db.lookup_wallet(a)
    if feats is None:
        return JSONResponse(status_code=404, content={"address": a, "found": False})

    if lut is None:  # has features but no label row -> unlabeled
        return {
            "address": a, "found": True, "effective_cluster": -1,
            "label_source": None, "membership": None, "raw": None, "features": feats,
        }

    eff, membership = db.effective_label(lut)
    return {
        "address": a,
        "found": True,
        "effective_cluster": eff,
        "label_source": lut.get("label_source"),
        "membership": membership,
        "raw": {k: lut.get(k) for k in ("cluster", "cluster_xgb", "cluster_prob", "xgb_conf", "label_source")},
        "features": feats,
    }


# --- news digest -----------------------------------------------------------
# RSS -> local Ollama (llama3.2) -> sanitized HTML <ul>. TTL-cached; both calls block,
# so they run off the event loop. Degrades to bare headline links if Ollama is down.
NEWS_FEEDS = (
    "https://www.theblock.co/api/v1/rss",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
)
NEWS_MODEL = "llama3.2"
NEWS_TTL = 1200  # seconds (~20 min)
_news_cache: dict = {"html": None, "updated": 0, "source": None}
_news_lock = asyncio.Lock()


def _fetch_headlines(per_feed: int = 3):
    """Top N (title, link) per feed; skips a feed on failure."""
    import urllib.request

    import feedparser

    items = []
    for url in NEWS_FEEDS:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ChainSense)"})
            raw = urllib.request.urlopen(req, timeout=8).read()
        except Exception as exc:  # noqa: BLE001
            print(f"[news] feed failed {url}: {type(exc).__name__}")
            continue
        for e in feedparser.parse(raw).entries[:per_feed]:
            title = (getattr(e, "title", "") or "").strip()
            link = (getattr(e, "link", "") or "").strip()
            if title and link.startswith(("http://", "https://")):
                items.append((title, link))
    return items


def _headlines_html(headlines) -> str:
    """Plain headline list — the no-LLM fallback."""
    lis = "".join(
        f'<li>{escape(t)} '
        f'<a href="{escape(l)}" target="_blank" rel="noopener noreferrer">Read &rarr;</a></li>'
        for t, l in headlines
    )
    return f"<ul>{lis}</ul>" if lis else "<ul><li>No headlines available right now.</li></ul>"


def _sanitize_news_html(raw: str, headlines) -> str:
    """Keep the model's <ul>, strip anything unsafe before it hits the DOM."""
    m = re.search(r"<ul[\s\S]*</ul>", raw, re.IGNORECASE)  # drop fences/prose around it
    if not m:
        return _headlines_html(headlines)
    s = m.group(0)
    s = re.sub(r"<\s*(script|style|iframe)[\s\S]*?<\s*/\s*\1\s*>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", s, flags=re.IGNORECASE)  # on*= handlers
    s = re.sub(r"href\s*=\s*([\"'])\s*javascript:[^\"']*\1", 'href="#"', s, flags=re.IGNORECASE)
    s = re.sub(r"<a\b", '<a target="_blank" rel="noopener noreferrer"', s, flags=re.IGNORECASE)
    return s


def _build_news_html():
    """(html, source). Runs in a worker thread — feedparser + ollama block."""
    headlines = _fetch_headlines(3)
    if not headlines:
        return "<ul><li>News feed temporarily unavailable.</li></ul>", "empty"
    context = "".join(f"Title: {t} | Link: {l}\n" for t, l in headlines)
    prompt = (
        "Summarize the 3 most important stories below. Output ONLY raw HTML <ul> and <li> "
        'tags. Make each bullet 1 sentence, and turn the end of the sentence into an '
        '<a href="..."> link using the provided URL.\n\n' + context
    )
    try:
        from ollama import Client

        resp = Client(timeout=60).chat(model=NEWS_MODEL, messages=[{"role": "user", "content": prompt}])
        return _sanitize_news_html(resp["message"]["content"], headlines), "ollama"
    except Exception as exc:  # noqa: BLE001
        print(f"[news] ollama failed: {type(exc).__name__}: {exc}")
        return _headlines_html(headlines), "fallback"


@app.get("/api/news")
async def news():
    """AI-summarized headlines. TTL-cached, single-flight."""
    now = time.time()
    if _news_cache["html"] and now - _news_cache["updated"] < NEWS_TTL:
        return dict(_news_cache)
    async with _news_lock:
        if _news_cache["html"] and time.time() - _news_cache["updated"] < NEWS_TTL:
            return dict(_news_cache)  # refreshed while we waited
        html, source = await asyncio.to_thread(_build_news_html)
        _news_cache.update(html=html, updated=int(time.time()), source=source)
        return dict(_news_cache)


# --- live stream (SSE) -----------------------------------------------------
# Each finalized block's unique senders -> LUT lookup -> family buckets (db.enrich);
# unknowns -> NEW_BUCKET. One background producer reads the chain, fans out to all subs.
_subscribers: "set[asyncio.Queue]" = set()
_producer: "asyncio.Task | None" = None
_ticker_task: "asyncio.Task | None" = None
_producer_lock = asyncio.Lock()

# Replay for instant first paint: latest block + bounded ring buffers, replayed as one
# `snapshot` event per (re)connect. In-memory, shared across clients, lost on restart.
TICK_HISTORY = 90    # ticker points (~7.5 min)
COUNTS_HISTORY = 45  # block-count points (~9 min)
_latest: dict = {"block": None}
_tick_hist: "deque[dict]" = deque(maxlen=TICK_HISTORY)      # {ethUsd, gasGwei, ts}
_counts_hist: "deque[dict]" = deque(maxlen=COUNTS_HISTORY)  # {block, ts, counts}


async def _fetch_block(http, num: int):
    """eth_getBlockByNumber(full=True) for one height."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": "eth_getBlockByNumber", "params": [hex(num), True]}
    async with http.post(ALCHEMY_HTTP, json=payload) as r:
        body = await r.json()
    return body.get("result")


def _broadcast(ev: dict):
    """Fan one event to every subscriber (drop on full queues)."""
    for q in list(_subscribers):
        try:
            q.put_nowait(ev)
        except asyncio.QueueFull:
            pass


async def alchemy_producer():
    """newHeads -> finalized block -> enrich -> fan out. Reconnects with backoff.

    aiohttp/websockets imported lazily so the lookup API boots if they're absent in dev.
    """
    import aiohttp
    import websockets

    backoff = 1
    processed = -1
    sub = {"jsonrpc": "2.0", "id": 1, "method": "eth_subscribe", "params": ["newHeads"]}
    while True:
        try:
            async with aiohttp.ClientSession() as http:
                async with websockets.connect(ALCHEMY_WS, ping_interval=20) as ws:
                    await ws.send(json.dumps(sub))
                    await ws.recv()   # subscription-id ack
                    backoff = 1
                    async for raw in ws:
                        head_hex = json.loads(raw).get("params", {}).get("result", {}).get("number")
                        if head_hex is None:
                            continue
                        target = int(head_hex, 16) - FINALITY_LAG
                        if target <= processed:
                            continue
                        block = await _fetch_block(http, target)
                        if not block:
                            continue
                        processed = target
                        senders = sorted({
                            tx["from"].lower()
                            for tx in block.get("transactions", [])
                            if isinstance(tx, dict) and tx.get("from")
                        })
                        counts, classified = await asyncio.to_thread(db.enrich, senders)
                        block_ev = {
                            "number": target,
                            "txCount": len(block.get("transactions", [])),
                            "senderCount": len(senders),
                            "finalityLag": FINALITY_LAG,
                            "ts": int(time.time()),
                        }
                        _latest["block"] = block_ev
                        _counts_hist.append({"block": target, "ts": block_ev["ts"], "counts": counts})
                        _broadcast({"type": "block", "data": block_ev})
                        _broadcast({"type": "counts", "data": counts})
                        _broadcast({"type": "classified", "data": classified[:15]})
        except Exception as e:  # noqa: BLE001
            print(f"[producer] {type(e).__name__}: {e}; reconnecting in {backoff}s")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)


async def _fetch_eth_usd(http) -> "float | None":
    """Spot ETH/USD from Coinbase."""
    async with http.get(COINBASE_SPOT) as r:
        body = await r.json()
    amt = (body.get("data") or {}).get("amount")
    return float(amt) if amt is not None else None


async def _fetch_gas_gwei(http) -> "float | None":
    """Gas price via Alchemy eth_gasPrice (wei -> gwei)."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": "eth_gasPrice", "params": []}
    async with http.post(ALCHEMY_HTTP, json=payload) as r:
        body = await r.json()
    wei = body.get("result")
    return int(wei, 16) / 1e9 if wei else None


async def ticker_producer():
    """Poll ETH/USD + gas every few seconds, fan out a `ticker` event. Each field
    fetched independently so one failure still ships the other."""
    import aiohttp

    backoff = 1
    while True:
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as http:
                while True:
                    eth = gas = None
                    try:
                        eth = await _fetch_eth_usd(http)
                    except Exception:  # noqa: BLE001
                        pass
                    try:
                        gas = await _fetch_gas_gwei(http)
                    except Exception:  # noqa: BLE001
                        pass
                    if eth is not None or gas is not None:
                        ev = {"ethUsd": eth, "gasGwei": gas, "ts": int(time.time())}
                        _tick_hist.append(ev)
                        _broadcast({"type": "ticker", "data": ev})
                    backoff = 1
                    await asyncio.sleep(TICKER_INTERVAL)
        except Exception as e:  # noqa: BLE001
            print(f"[ticker] {type(e).__name__}: {e}; retrying in {backoff}s")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)


def _sse(ev: dict):
    return {"event": ev["type"], "data": json.dumps(ev["data"])}


@app.get("/api/stream")
async def stream():
    if not ALCHEMY_KEY:
        return JSONResponse(status_code=503, content={"error": "live feed unconfigured (no ALCHEMY_KEY)"})

    global _producer, _ticker_task
    async with _producer_lock:
        if _producer is None or _producer.done():
            _producer = asyncio.create_task(alchemy_producer())
        if _ticker_task is None or _ticker_task.done():
            _ticker_task = asyncio.create_task(ticker_producer())

    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(q)

    async def gen():
        try:
            # Backfill on connect: latest block, then ring-buffered series as one snapshot.
            yield {"event": "hello", "data": json.dumps({"finalityLag": FINALITY_LAG})}
            if _latest["block"]:
                yield _sse({"type": "block", "data": _latest["block"]})
            if _counts_hist or _tick_hist:
                yield _sse({"type": "snapshot", "data": {
                    "counts": list(_counts_hist),
                    "ticker": list(_tick_hist),
                }})
            while True:
                yield _sse(await q.get())
        finally:
            _subscribers.discard(q)

    # no-transform / X-Accel-Buffering stop the Cloudflare tunnel from buffering the stream.
    return EventSourceResponse(gen(), headers={
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
    })
