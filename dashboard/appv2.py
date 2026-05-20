# dashboard/app.py
import streamlit as st, pandas as pd, json
from pathlib import Path
from streamlit_autorefresh import st_autorefresh

PROCESSED = Path(__file__).parent.parent / "data" / "processed"
STREAMING = Path(__file__).parent.parent / "data" / "streaming"

# 1. Set up Streamlit page
st.set_page_config(page_title="ChainSense", layout="wide")
st.title("ChainSense — Ethereum Wallet Behavior")

# 2. Load data with caching
@st.cache_data(ttl=12)  # cache for one block time
def load_recent():
    clusters = pd.read_parquet(PROCESSED / "clusters.parquet")[["wallet", "archetype"]]
    arch = clusters.set_index("wallet")["archetype"]

    txs = pd.read_parquet(STREAMING / "transactions.parquet")
    txs = txs.loc[
        txs["block"] == txs["block"].max(),
        ["block","from", "to", "value_eth", "is_contract_call", "dt"]
    ].copy()

    txs["from_archetype"] = txs["from"].map(arch).fillna("unclassified")
    txs["to_archetype"]   = txs["to"].map(arch).fillna("contract")
    txs["dt"] = pd.to_datetime(txs["dt"]).dt.tz_localize("UTC").dt.tz_convert("America/Los_Angeles")
    

    return txs.sort_values("dt").reset_index(drop=True), clusters

txs, clusters = load_recent()

# 3. Display basic metrics.
col1, col2, col3, col4 = st.columns(4)
col1.metric("Latest Block", f"{txs['block'].max():,}")
col2.metric("Transactions last 12s", f"{len(txs):,}")
col3.metric("Unique Wallets", f"{txs['from'].nunique():,}")
col4.metric("Archetypes Identified", txs["from_archetype"].nunique())


# 4. Ticker
tick = st_autorefresh(interval=2000, key="tick")

short = lambda a: a[:6] + "…" + a[-6:] if pd.notna(a) else "Contract"

def fmt_line(r):
    return (
        f"{r['dt'].strftime('%Y-%m-%d %H:%M:%S')} "
        f"{r['value_eth']:>11.4f} ETH   "
        f"({r['from_archetype']}) {short(r['from'])} → ({r['to_archetype']}) {short(r['to'])}"
    )

data = json.dumps([fmt_line(r) for _, r in txs.iterrows()])

html = f"""
<style>
  .board {{
    background: #fff;
    padding: 16px 20px;
    border: 1px solid #e5e5e7;
    border-radius: 10px;
  }}
  .viewport {{
    position: relative;
    height: 20px;
    overflow: hidden;
    font: 600 13px/20px 'JetBrains Mono', 'Courier New', monospace;
    color: #3C56A6;   /* darker Ethereum blue, ~7:1 contrast — passes AA Large */
    
    white-space: pre;
  }}
#   .viewport {{
#     position: relative;
#     height: 20px;
#     overflow: hidden;
#     font: 500 13px/20px 'JetBrains Mono', 'Courier New', monospace;
#     color: #3C56A6;
#     white-space: pre;
#     -webkit-font-smoothing: antialiased;
# }}
  .line {{
    position: absolute;
    inset: 0;
    animation: in .5s cubic-bezier(.4,0,.2,1);
  }}
  .line.out {{ animation: out .5s cubic-bezier(.4,0,.2,1) forwards; }}
  @keyframes in  {{ from {{ transform: translateY(100%);  }} }}
  @keyframes out {{ to   {{ transform: translateY(-100%); }} }}
</style>
<div class="board"><div class="viewport" id="vp"></div></div>
<script>
  const lines = {data}, vp = document.getElementById('vp');
  let i = 0;

  function tick() {{
    const prev = vp.querySelector('.line');
    const next = Object.assign(document.createElement('div'),
      {{ className: 'line', textContent: lines[i++ % lines.length] }});
    vp.appendChild(next);
    if (prev) {{
      prev.classList.add('out');
      prev.addEventListener('animationend', () => prev.remove(), {{ once: true }});
    }}
  }}

  tick();
  setInterval(tick, 2500);
</script>
"""
st.iframe(html, height=100)
st.caption(f"{len(txs)} txs · row cycles every 2.5s · data refresh 12s")


# counts = clusters["archetype"].value_counts()
# st.bar_chart(counts)

# 5. Charts
@st.cache_data(ttl=3600)  # cluster sizes only change when clustering reruns
def cluster_sizes():
    return pd.read_parquet(PROCESSED / "clusters.parquet")["archetype"].value_counts()

@st.cache_data(ttl=60)
def hourly_by_archetype():
    arch = (pd.read_parquet(PROCESSED / "clusters.parquet")
              [["wallet", "archetype"]].set_index("wallet")["archetype"])
    txs = pd.read_parquet(STREAMING / "transactions.parquet", columns=["dt", "from"])
    txs["dt"] = pd.to_datetime(txs["dt"]).dt.tz_localize("UTC").dt.tz_convert("America/Los_Angeles")
    cutoff = txs["dt"].max() - pd.Timedelta(hours=24)
    txs = txs[txs["dt"] >= cutoff].copy()
    txs["archetype"] = txs["from"].map(arch).fillna("unclassified")
    return (txs.groupby([pd.Grouper(key="dt", freq="1min"), "archetype"])
              .size().unstack(fill_value=0))

col1, col2 = st.columns(2)
with col1:
    st.subheader("Wallets per archetype")
    st.bar_chart(cluster_sizes(), horizontal=True, height=300)
with col2:
    st.subheader("Transactions per minute (last 24 hours)")
    st.area_chart(hourly_by_archetype(), height=300, stack=True)