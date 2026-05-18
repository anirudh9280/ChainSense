"""Clustering models. Thin sklearn wrappers with consistent return types."""
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.ensemble import IsolationForest
from sklearn.metrics import silhouette_score, davies_bouldin_score

RANDOM_STATE = 42


def sweep_kmeans(X, k_range=range(2, 13), sample_size=10000):
    """Fit K-Means for each k and return a metrics DataFrame.

    Silhouette is O(n^2) so it's computed on a random sample if X is large.
    Returns columns: k, silhouette, inertia, davies_bouldin (lower is better for DB).
    """
    X = _as_array(X)
    rng = np.random.default_rng(RANDOM_STATE)
    sample_idx = (
        rng.choice(len(X), sample_size, replace=False)
        if len(X) > sample_size else np.arange(len(X))
    )

    rows = []
    for k in k_range:
        model = KMeans(n_clusters=k, random_state=RANDOM_STATE, n_init=10)
        labels = model.fit_predict(X)

        sil = silhouette_score(X[sample_idx], labels[sample_idx])
        db  = davies_bouldin_score(X[sample_idx], labels[sample_idx])

        rows.append({"k": k, "silhouette": sil, "inertia": model.inertia_, "davies_bouldin": db})
        print(f"  k={k:2d}  silhouette={sil:.3f}  inertia={model.inertia_:>10.0f}  DB={db:.3f}")

    return pd.DataFrame(rows)


def fit_kmeans(X, k):
    """Fit K-Means with chosen k. Returns (model, labels)."""
    X = _as_array(X)
    model = KMeans(n_clusters=k, random_state=RANDOM_STATE, n_init=10)
    labels = model.fit_predict(X)
    return model, labels


def fit_dbscan(X, eps=0.5, min_samples=10):
    """Fit DBSCAN. Returns (model, labels). Noise points are labeled -1.

    eps is the neighborhood radius in the SCALED feature space. Tune by:
      1. Plot k-NN distances for each point (k=min_samples), sort ascending.
      2. Pick eps at the 'elbow' of that curve.
    """
    X = _as_array(X)
    model = DBSCAN(eps=eps, min_samples=min_samples)
    labels = model.fit_predict(X)
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = (labels == -1).sum()
    print(f"  DBSCAN: {n_clusters} clusters, {n_noise:,} noise points ({n_noise/len(labels):.1%})")
    return model, labels


def fit_isolation_forest(X, contamination=0.01):
    """Flag the weirdest ~1% of wallets as anomalies.

    Returns (model, scores, is_outlier). Higher score = more normal.
    """
    X = _as_array(X)
    model = IsolationForest(contamination=contamination, random_state=RANDOM_STATE, n_jobs=-1)
    model.fit(X)
    scores = model.score_samples(X)
    is_outlier = model.predict(X) == -1
    print(f"  IsolationForest: {is_outlier.sum():,} anomalies flagged ({is_outlier.mean():.1%})")
    return model, scores, is_outlier


def _as_array(X):
    """Accept DataFrame or array; return float ndarray."""
    if isinstance(X, pd.DataFrame):
        return X.select_dtypes("number").values
    return np.asarray(X)