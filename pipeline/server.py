"""ChainSense API: wallet lookup, AI news digest, SSE live feed. Reads the pipeline.

Author: Chris Kim
"""
import asyncio, json, math, os, re, sys, time
from collections import defaultdict, deque
from html import escape
from pathlib import Path

import duckdb
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

_HERE = Path(__file__).parent
sys.path.insert(0, _HERE.as_posix())
import featstore
import state as pstate

load_dotenv(_HERE.parent / ".env")
ALCHEMY_KEY = os.environ.get("ALCHEMY_KEY", "")
ALCHEMY_HTTP = f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}"
FINALITY_LAG = 64

COINBASE_SPOT = "https://api.coinbase.com/v2/prices/ETH-USD/spot"  # public, no auth
TICKER_INTERVAL = 5  # seconds
POLL_SEC = 12        # how often we check live_lut.sqlite for a freshly-closed minute

# --- static wallet layer (parquet via DuckDB) ------------------------------
DATA = _HERE/ "data"  # wallet parquets + cluster_archetypes.json
LUT = (DATA / "wallet_lut.parquet").as_posix()
FEATS = (DATA / "wallet_feat.parquet").as_posix()
NEW_BUCKET = "New / Unmodeled"  # senders absent from the LUT
_wallet = duckdb.connect()  # in-memory; reads parquet directly
FAMILY = {int(k): v for k, v in json.load(open(DATA / "cluster_archetypes.json")).items()}


def family_of(cluster) -> str:
    return FAMILY.get(int(cluster), "Unclassified")


def _row(cur):
    """One DuckDB row -> {col: value}; NaN/Inf -> None (invalid in JSON)."""
    row = cur.fetchone()
    if row is None:
        return None
    return {c[0]: (None if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v)
            for c, v in zip(cur.description, row)}


def lookup_wallet(addr: str):
    """(features, lut) for one address. features None = unknown; lut None = unlabeled."""
    feats = _row(_wallet.cursor().execute(f"SELECT * FROM read_parquet('{FEATS}') WHERE address = ?", [addr]))
    if feats is None:
        return None, None
    lut = _row(_wallet.cursor().execute(f"SELECT * FROM read_parquet('{LUT}') WHERE address = ?", [addr]))
    feats.pop("address", None)
    return feats, lut


def effective_label(lut: dict):
    """hdbscan = real assignment; else cluster_xgb (-1 = noise)."""
    if lut.get("label_source") == "hdbscan":
        return int(lut["cluster"]), {"score": lut.get("cluster_prob"), "basis": "hdbscan"}
    return int(lut["cluster_xgb"]), {"score": lut.get("xgb_conf"), "basis": "xgboost"}

app = FastAPI(title="ChainSense API")
app.add_middleware(CORSMiddleware, allow_origins=["https://ucsd-chainsense.vercel.app"], allow_methods=["GET"])


@app.on_event("startup")
async def load():
    pstate.init()
    featstore.init()
    global _producer, _ticker_task, _classified_task
    _producer = asyncio.create_task(composition_producer())
    _classified_task = asyncio.create_task(classified_producer())
    if ALCHEMY_KEY:
        _ticker_task = asyncio.create_task(ticker_producer())


# --- wallet lookup ---------------------------------------------------------
def _live_wallet(a: str):
    """Static-miss fallback: resolve a wallet first seen live from live_feat.sqlite.
    Same response shape as the static path with live=True, or 404 if never seen at all.
    A wallet still inside its first-hour window resolves as live+pending (no features
    yet); a classified one carries its XGB-propagated label + the 12-feature vector."""
    row = featstore.lookup(a)
    if row is None:
        return JSONResponse(status_code=404, content={"address": a, "found": False})

    cluster, conf = row["cluster"], row["confidence"]
    if row["state"] != "final" or cluster is None:  # seen live, classification pending
        return {
            "address": a, "found": True, "live": True, "effective_cluster": -1,
            "label_source": None, "membership": None, "raw": None, "features": row["feats"],
        }

    real = cluster >= 0  # below the confidence floor a live wallet stays NEW (noise)
    src = "xgb_predicted" if real else "xgb_noise"
    return {
        "address": a,
        "found": True,
        "live": True,
        "effective_cluster": cluster if real else -1,
        "label_source": src,
        "membership": {"score": conf, "basis": "xgboost"} if conf is not None else None,
        "raw": {"cluster": pstate.NEW, "cluster_xgb": cluster, "cluster_prob": None,
                "xgb_conf": conf, "label_source": src},
        "features": row["feats"],
    }


@app.get("/api/wallet/{addr}")
def wallet(addr: str):
    a = addr.strip().lower()
    feats, lut = lookup_wallet(a)
    if feats is None:  # not in the frozen snapshot -> try the live feature store
        return _live_wallet(a)

    if lut is None:  # has features but no label row -> unlabeled
        return {
            "address": a, "found": True, "live": False, "effective_cluster": -1,
            "label_source": None, "membership": None, "raw": None, "features": feats,
        }

    eff, membership = effective_label(lut)
    return {
        "address": a,
        "found": True,
        "live": False,
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
# One background task polls live_lut.sqlite; each newly-closed minute -> family roll-up ->
# fan out to all subscribers. A second task polls the price/gas ticker. Same SSE event
# shape the frontend already speaks; "block" is now keyed per minute (ts = minute epoch).
_subscribers: "set[asyncio.Queue]" = set()
_producer: "asyncio.Task | None" = None
_ticker_task: "asyncio.Task | None" = None
_classified_task: "asyncio.Task | None" = None
_producer_lock = asyncio.Lock()

TICK_HISTORY = 90        # ticker points (~7.5 min)
COUNTS_HISTORY = 45      # composition points (one per minute)
CLASSIFIED_HISTORY = 30  # classification-log rows (mirrors the frontend MAX_LOG)
_latest: dict = {"block": None, "classifiedAt": None}
_tick_hist: "deque[dict]" = deque(maxlen=TICK_HISTORY)
_counts_hist: "deque[dict]" = deque(maxlen=COUNTS_HISTORY)
_classified_hist: "deque[dict]" = deque(maxlen=CLASSIFIED_HISTORY)  # chronological {addr, family, conf}


def _broadcast(ev: dict):
    """Fan one event to every subscriber (drop on full queues)."""
    for q in list(_subscribers):
        try:
            q.put_nowait(ev)
        except asyncio.QueueFull:
            pass


def _rollup(cluster_counts: dict) -> dict:
    """{cluster: n} -> {family: n}. NEW bucket (-2) -> the New / Unmodeled family."""
    fam: dict = defaultdict(int)
    for c, n in cluster_counts.items():
        fam[NEW_BUCKET if c == pstate.NEW else family_of(c)] += n
    return dict(fam)


async def composition_producer():
    """Poll state.live_tally; emit one (block, counts) pair per freshly-closed minute.

    The pipeline reports minutes, so a "block" event carries the latest settled block
    for display but is identified by its minute (ts). The first pass only seeds the ring
    buffer (no subscribers yet); after that, each new minute fans out live.
    """
    last_min = -1
    first = True
    while True:
        try:
            settled = (await asyncio.to_thread(pstate.get_val, "settled_block")) or 0
            rows = await asyncio.to_thread(pstate.composition, last_min)
            by_min: dict = {}
            for m, c, n in rows:
                by_min.setdefault(m, {})[c] = n
            for m in sorted(by_min):
                counts = _rollup(by_min[m])
                total = sum(by_min[m].values())
                ev = {"number": settled, "txCount": total, "senderCount": total,
                      "finalityLag": FINALITY_LAG, "ts": m}
                _latest["block"] = ev
                _counts_hist.append({"block": settled, "ts": m, "counts": counts})
                if not first:
                    _broadcast({"type": "block", "data": ev})
                    _broadcast({"type": "counts", "data": counts})
                last_min = m
            first = False
        except Exception as e:  # noqa: BLE001
            print(f"[producer] {type(e).__name__}: {e}")
        await asyncio.sleep(POLL_SEC)


async def classified_producer():
    """Poll state.live_lut for newly-finalized, model-classified wallets and fan out a
    `classified` event per batch ({updatedAt, wallets:[{addr, family, conf}]}). The cursor is
    the finalization timestamp (state.final_ts), so a restart resumes from the last
    emitted finalization rather than replaying the backlog. The first pass only seeds the
    ring buffer (snapshot) — no live fan-out — so reconnecting clients get the last few
    rows + timestamp without a flood. Batches share a finalize second; we emit them
    newest-first so the frontend's prepend keeps the most recent at the top."""
    last_ts = -1
    first = True
    while True:
        try:
            rows = await asyncio.to_thread(pstate.recently_classified, last_ts)
            if rows:
                last_ts = max(r[3] for r in rows)
                _latest["classifiedAt"] = last_ts
                wallets = [{"addr": a, "family": family_of(c), "conf": conf} for a, c, conf, _ in rows]
                for w in wallets:
                    _classified_hist.append(w)
                if not first:
                    _broadcast({"type": "classified",
                                "data": {"updatedAt": last_ts, "wallets": list(reversed(wallets))}})
            first = False
        except Exception as e:  # noqa: BLE001
            print(f"[classified] {type(e).__name__}: {e}")
        await asyncio.sleep(POLL_SEC)


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
    global _producer, _ticker_task, _classified_task
    async with _producer_lock:
        if _producer is None or _producer.done():
            _producer = asyncio.create_task(composition_producer())
        if _classified_task is None or _classified_task.done():
            _classified_task = asyncio.create_task(classified_producer())
        if ALCHEMY_KEY and (_ticker_task is None or _ticker_task.done()):
            _ticker_task = asyncio.create_task(ticker_producer())

    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(q)

    async def gen():
        try:
            yield {"event": "hello", "data": json.dumps({"finalityLag": FINALITY_LAG})}
            if _latest["block"]:
                yield _sse({"type": "block", "data": _latest["block"]})
            if _counts_hist or _tick_hist or _classified_hist:
                yield _sse({"type": "snapshot", "data": {
                    "counts": list(_counts_hist),
                    "ticker": list(_tick_hist),
                    "classified": {"updatedAt": _latest["classifiedAt"],
                                   "wallets": list(reversed(_classified_hist))},
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
