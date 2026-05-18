"""Cluster interpretation and visualization."""
import numpy as np
import pandas as pd


def cluster_profiles(features_df, labels, feature_cols=None):
    """Per-cluster feature means, z-scored against the global mean.

    Pass either scaled or unscaled features — the z-scoring handles both.
    Output: rows = clusters, cols = features, values = z-scores.

    A z-score of +2 in column X for cluster 3 means: 'cluster 3 wallets average
    2 standard deviations above the global mean on feature X.' This is what
    you read to assign archetype names.
    """
    if feature_cols is None:
        feature_cols = [c for c in features_df.columns if c != "wallet"]

    df = features_df[feature_cols].copy()
    df["cluster"] = labels

    cluster_means = df.groupby("cluster")[feature_cols].mean()
    global_mean = df[feature_cols].mean()
    global_std  = df[feature_cols].std().replace(0, 1)   # guard against constant cols

    return (cluster_means - global_mean) / global_std


def cluster_sizes(labels):
    """Series: cluster_id -> count, sorted by cluster_id."""
    s = pd.Series(labels).value_counts().sort_index()
    s.index.name = "cluster"
    s.name = "size"
    return s


def umap_embed(X, n_neighbors=15, min_dist=0.1, random_state=42):
    """Project X to 2D with UMAP. Returns (n, 2) array.

    Tuning notes:
      - n_neighbors: smaller (5-15) preserves local structure, larger (50+) global.
      - min_dist: smaller (0.0-0.1) tighter clusters, larger (0.5+) more spread.
      - For wallet clustering, defaults work well — don't over-tune.
    """
    import umap   # imported lazily so the package isn't required to import this module

    reducer = umap.UMAP(
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        n_components=2,
        random_state=random_state,
    )
    if isinstance(X, pd.DataFrame):
        X = X.select_dtypes("number").values
    return reducer.fit_transform(X)


def top_wallets_per_cluster(wallets, labels, features_df, sort_by="tx_count", n=5):
    """Return top N wallets per cluster, ranked by a chosen feature.

    Useful for the Etherscan eyeball-validation step in the clustering notebook.
    """
    df = features_df.copy()
    df["wallet"] = wallets
    df["cluster"] = labels

    out = []
    for c in sorted(df["cluster"].unique()):
        sub = df[df["cluster"] == c].nlargest(n, sort_by)
        for _, row in sub.iterrows():
            out.append({"cluster": c, "wallet": row["wallet"], sort_by: row[sort_by]})
    return pd.DataFrame(out)