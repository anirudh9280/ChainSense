# ChainSense — Technical Report

**Authors:** Chris Kim, Team1, Team2, Team3
**Course:** DS3 × TQT, Spring 2026
**Repo:** github.com/anirudh9280/ChainSense
**Date:** [submission date]

---

> **How to use this skeleton:** Each section below has (1) a purpose line, (2) a checklist of what to include, (3) prompts to guide your thinking. Delete the prompts as you write. Target total length: 6–10 pages. Keep prose tight — bullet points and figures over paragraphs of theory.

---

## Abstract

**Purpose:** Elevator pitch. The whole project in one paragraph.
**Length:** ~150 words.

Include:
- [ ] One sentence on what the project is
- [ ] One sentence on the data
- [ ] One sentence on the method
- [ ] One sentence on key findings (how many clusters, what archetypes)
- [ ] One sentence on what makes this interesting / what we learned

Prompts to think about:
- If a recruiter read only this paragraph, what's the one thing they should remember?
- Lead with the result, not the method.

---

## 1. Introduction

**Purpose:** Frame the problem and motivate the approach.
**Length:** ~½ page.

Include:
- [ ] Why Ethereum is an interesting dataset (append-only, public, behavioral)
- [ ] What question we're answering (do wallet archetypes exist? can ML find them?)
- [ ] Why this matters (use cases: compliance, MEV detection, market intelligence)
- [ ] What we did *not* try to do (price prediction, speculation) — scope guard
- [ ] One-sentence thesis statement

Prompts:
- What's the tension or open question that makes this worth doing?
- What would a skeptic say, and how do we pre-empt it?

---

## 2. Data

**Purpose:** Tell the reader exactly what dataset we worked with.
**Length:** ~1 page.

Include:
- [ ] Source (Alchemy Node API on Ethereum mainnet)
- [ ] Block range covered (start, end, total count)
- [ ] Time window in human terms (date range)
- [ ] Raw counts table: blocks / transactions / receipts / token transfers / unique addresses
- [ ] Schema description for the four parquet tables (one-sentence each)
- [ ] Scope decisions: EOA-only vs contracts, MIN_ACTIVITY threshold, why
- [ ] Anything excluded and why (failed receipts retries? specific tokens?)

Figures to consider:
- [ ] Tx-count-per-hour line plot (proves time coverage is clean)
- [ ] Top-10 ERC-20 tokens by transfer volume (sanity check on data realism)

Prompts:
- Can a stranger reproduce this dataset from your description alone?
- What's the most surprising statistic in your data?

---

## 3. Methodology

**Purpose:** The technical meat. How the pipeline works and why we made each major choice.
**Length:** ~2–3 pages.

### 3.1 Ingestion Architecture

Include:
- [ ] Architecture diagram (use the one from project planning)
- [ ] Two-channel design: WebSocket for live notifications + HTTP for fetches
- [ ] Why this isn't streaming (12-second block time — not Kafka territory)
- [ ] Watermark-based incrementality (how restarts work)
- [ ] Safety buffer for reorg tolerance (why 10 blocks)
- [ ] Caching strategy (raw JSON to disk, idempotent reruns)

Prompts:
- For each design decision, what's the alternative we rejected and why?
- What would break if we removed the safety buffer? The watermark?

### 3.2 Feature Engineering

Include:
- [ ] How we joined the four parquets into wallet-level rows
- [ ] List of final features used for clustering (table format works well)
- [ ] Heavy-tail handling: log1p transform, which columns, why
- [ ] Standardization (StandardScaler), why
- [ ] Features we tried and dropped (and why — correlation? variance? interpretability?)
- [ ] Filtering: EOA-only, MIN_ACTIVITY threshold

Figures:
- [ ] Before/after histogram for one heavy-tailed feature (shows log transform working)
- [ ] Correlation heatmap of final feature set

Prompts:
- Which one feature was the single most important for clustering? How do we know?
- What feature would we add if we had more time? Why don't we have it now?

### 3.3 Clustering

Include:
- [ ] Algorithm choice (K-Means) and why over alternatives (DBSCAN, GMM, hierarchical)
- [ ] How we chose k (silhouette sweep, plot included)
- [ ] UMAP for visualization, not for clustering — note this distinction
- [ ] Validation approach: feature signatures + Etherscan eyeball test

Figures:
- [ ] Silhouette vs k plot
- [ ] UMAP scatter colored by cluster (this is the headline figure)

Prompts:
- Why is interpretability more important than maximum silhouette score for this project?
- What's the limit of unsupervised methods here — what could we not learn without labels?

---

## 4. Results

**Purpose:** What we actually found. The payoff section.
**Length:** ~2 pages.

Include:
- [ ] Number of final clusters
- [ ] Cluster size table (cluster id, size, % of total, archetype name)
- [ ] Cluster profile heatmap (z-scored feature means per cluster)
- [ ] For each cluster: 1 paragraph
  - [ ] Archetype label
  - [ ] Defining features (what's high, what's low)
  - [ ] Etherscan-verified example wallet (with link)
  - [ ] What this archetype tells us about Ethereum activity

Optional but strong:
- [ ] Anomaly detection results (IsolationForest top 1%) — who are the weirdest wallets?
- [ ] One cross-cluster comparison (e.g., "bots vs. casual users: bots fail 12× more often")

Prompts:
- Which cluster surprised us most when we looked at example wallets on Etherscan?
- Are any of our archetypes redundant? Should there really be fewer clusters?

---

## 5. Discussion

**Purpose:** Show maturity. Acknowledge what didn't work and what we'd do differently.
**Length:** ~½ page.

Include:
- [ ] What worked well (and why — be specific)
- [ ] What didn't work or required iteration
- [ ] Limitations of the current approach (be honest):
  - Single time window — no wallet evolution captured
  - EOA-only — contract behavior excluded
  - Mainnet-only — L2 activity invisible
  - Feature set is bounded by what RPC exposes
- [ ] Threats to validity: clusters depend heavily on feature choice; "interpretability" is partly subjective

Prompts:
- If we started over knowing what we know now, what would we change first?
- What's the strongest argument *against* the value of these clusters?

---

## 6. Future Work

**Purpose:** Show vision beyond the project scope. Convince the reader this could keep growing.
**Length:** ~½ page.

Include 3–5 directions, each 1–2 sentences:
- [ ] Algorithmic trading strategy using cluster signals (Week 8 extension)
- [ ] Temporal cluster evolution — how do wallets migrate between archetypes?
- [ ] Anomaly detection deep-dive — drainers, exploit contracts, sanctioned addresses
- [ ] Multi-chain extension (L2s, other EVM chains) using the same pipeline
- [ ] Supervised refinement: use Etherscan tags as labels to validate or train classifiers

Prompts:
- Which extension would teach us the most new thing? Which would be the easiest?
- What would a 6-month version of this project look like?

---

## 7. References

Include:
- [ ] Ethereum JSON-RPC specification
- [ ] Alchemy API documentation
- [ ] UMAP paper (McInnes et al., 2018)
- [ ] scikit-learn (Pedregosa et al., 2011)
- [ ] Any blog posts, papers, or Etherscan threads that informed our work

---

## Appendix (optional)

Include if useful:
- [ ] Full list of features with definitions
- [ ] Hyperparameter choices for K-Means, UMAP, IsolationForest
- [ ] Example tx record schema (one block, one tx, one receipt) for reproducibility
- [ ] Detailed Etherscan validation table (which wallets, which clusters, verified yes/no)

---

## Writing notes for the team

- **Write the worst possible first draft this week.** Don't aim for polish until the structure is right.
- **One person owns each section.** Avoid simultaneous editing.
- **Use figures liberally.** Three good figures beat three good paragraphs.
- **All claims should be reproducible from the repo.** If a number appears in the report, it should be reproducible by running a notebook.
- **Read your section out loud.** If it sounds like a textbook, cut it.
- **Target reading time: 15 minutes.** A recruiter or admissions reviewer should be able to understand the whole project in one coffee.
