import pandas as pd
import plotly.express as px
import streamlit as st
from pathlib import Path

DEMO = False

st.set_page_config(page_title="ChainSense", layout="wide")
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "demo_data" if DEMO else BASE_DIR / ".." / "data" / "processed"

# ---------- Load data ----------
@st.cache_data
def load_data(data_dir: Path):
    raw         = pd.read_csv(data_dir / "wallet_features.csv")
    scaled      = pd.read_csv(data_dir / "wallet_features_scaled.csv")
    txs         = pd.read_csv(data_dir / "transactions.csv")
    clusters    = pd.read_csv(data_dir / "wallet_clusters.csv")
    projections = pd.read_csv(data_dir / "wallet_projections.csv")
    return raw, scaled, txs, clusters, projections

raw, scaled, txs, clusters, projections = load_data(DATA_DIR)
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

# ---------- Cluster overview ----------
st.header("Wallet archetypes")
st.caption("K-Means (k=4) clustering reveals four behavioral archetypes.")

# Cluster sizes
arch_counts = clusters["archetype"].value_counts()
c1, c2, c3, c4 = st.columns(4)
for col, (arch, count) in zip([c1, c2, c3, c4], arch_counts.items()):
    col.metric(arch, f"{count:,}", f"{count/len(clusters):.1%}")

# Per-cluster feature profile
st.subheader("Per-cluster feature profile")
st.caption("Mean feature values per archetype — what makes each cluster distinct.")
profile = clusters.groupby("archetype")[FEATURE_COLS].mean().round(2)
st.dataframe(profile, use_container_width=True)

# PCA scatter colored by archetype
st.subheader("PCA projection by archetype")
fig = px.scatter(
    projections, x="pca1", y="pca2", color="archetype",
    hover_data=["wallet"], opacity=0.5,
    color_discrete_sequence=px.colors.qualitative.Set2,
)
fig.update_traces(marker=dict(size=4))
fig.update_layout(height=500)
st.plotly_chart(fig, use_container_width=True)

# UMAP scatter colored by archetype
st.subheader("UMAP projection by archetype")
fig = px.scatter(
    projections, x="umap1", y="umap2", color="archetype",
    hover_data=["wallet"], opacity=0.5,
    color_discrete_sequence=px.colors.qualitative.Set2,
)
fig.update_traces(marker=dict(size=4))
fig.update_layout(height=500)
st.plotly_chart(fig, use_container_width=True)

st.divider()

# ---------- Wallet lookup ----------
st.header("Wallet lookup")
addr = st.text_input("Paste a wallet address (0x...)").strip().lower()
if addr:
    match = clusters[clusters["wallet"].str.lower() == addr]
    if len(match) == 0:
        st.warning("Wallet not in active set.")
    else:
        row = match.iloc[0]
        st.success(f"**Archetype: {row['archetype']}** · [Etherscan](https://etherscan.io/address/{addr})")
        st.dataframe(
            match[FEATURE_COLS].T.rename(columns={match.index[0]: "value"}),
            use_container_width=True,
        )