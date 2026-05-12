import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="ChainSense", layout="wide")

demo = True

# ---------- Load data ----------
@st.cache_data
def load_data():
    prefix = "demo_data/" if demo else "../data/processed"
    raw = pd.read_csv(prefix + "wallet_features.csv")
    scaled = pd.read_csv(prefix + "wallet_features_scaled.csv")
    txs = pd.read_csv(prefix + "transactions.csv")
    return raw, scaled, txs

raw, scaled, txs = load_data()
FEATURE_COLS = [c for c in raw.columns if c != "wallet"]

# ---------- Header ----------
st.title("ChainSense — Wallet Feature Explorer")
st.caption("Behavioral features derived from raw Ethereum transactions and ERC-20 transfer logs.")

# ---------- Top-line stats ----------
st.header("Dataset summary")
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Blocks", f"{txs['block'].nunique():,}")
c2.metric("Transactions", f"{len(txs):,}")
c3.metric("Wallets (active ≥5 events)", f"{len(raw):,}")
c4.metric("Features", len(FEATURE_COLS))
c5.metric("Time span", f"{(txs['ts'].max() - txs['ts'].min()) / 3600:.1f} hrs")

st.divider()

# ---------- Feature distributions ----------
st.header("Feature distributions")
st.caption("Raw values — heavy-tailed, as expected. Scaled versions used for clustering.")
feature = st.selectbox("Pick a feature", FEATURE_COLS, index=0)
vals = raw[feature]
log_x = st.checkbox("Log scale (x-axis)", value=False)
if log_x:
    vals = vals[vals > 0]
    st.caption(f"Log scale drops {(raw[feature] <= 0).sum():,} rows with value ≤ 0.")
fig = px.histogram(vals, nbins=60, log_x=log_x, log_y=True)
fig.update_layout(height=400, bargap=0.02, xaxis_title=feature, showlegend=False)
st.plotly_chart(fig, use_container_width=True)

st.divider()


# ---------- Top-N tables ----------
st.header("Top wallets")
metric = st.selectbox("Rank by", FEATURE_COLS, index=FEATURE_COLS.index("tx_count"))
top_n = st.slider("How many", 10, 50, 20)
top = raw.nlargest(top_n, metric)[["wallet", metric] + [c for c in FEATURE_COLS if c != metric][:4]].copy()
top["etherscan"] = top["wallet"].apply(lambda w: f"https://etherscan.io/address/{w}")
st.dataframe(top, use_container_width=True, hide_index=True,
             column_config={"etherscan": st.column_config.LinkColumn("Etherscan")})

st.divider()

# ---------- Correlation heatmap ----------
st.header("Feature correlations")
st.caption("Highly correlated pairs are candidates for removal before clustering.")
corr = raw[FEATURE_COLS].corr()
fig = px.imshow(corr, text_auto=".2f", aspect="auto", color_continuous_scale="RdBu_r", zmin=-1, zmax=1)
fig.update_layout(height=600)
st.plotly_chart(fig, use_container_width=True)

st.divider()

# ---------- Wallet lookup ----------
st.header("Wallet lookup")
addr = st.text_input("Paste a wallet address (0x...)").strip().lower()
if addr:
    match = raw[raw["wallet"].str.lower() == addr]
    if len(match) == 0:
        st.warning("Wallet not in active set (either not in window, or had <5 events).")
    else:
        st.success(f"Found. [View on Etherscan](https://etherscan.io/address/{addr})")
        st.dataframe(match[FEATURE_COLS].T.rename(columns={match.index[0]: "value"}),
                     use_container_width=True)