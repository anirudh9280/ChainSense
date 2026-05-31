# ChainSense — Meeting Minutes

*Spring 2026 · 04/15 – 05/30*

**Project.** ChainSense models Ethereum as a global, event-driven distributed system: an ETL pipeline ingests raw transactions and decodes smart-contract interactions into wallet-level behavioral features, then unsupervised clustering (HDBSCAN) surfaces behavioral archetypes — traders, holders, NFT users, bots — served through a real-time analytics dashboard, with an algorithmic-trading extension built on the resulting signals.

**Team.** Chris Kim, Laksh Goyal, Devang Pant, Ojas Dessai · *earlier contributors:* Jay, Maggie, Joshua
**Mentors / leads.** Anirudh, Tanishq

**Standing resources**

| | |
| :---- | :---- |
| Repo | github.com/anirudh9280/ChainSense |
| Prior quarter | github.com/KaiiB/chainsense |
| Data | Alchemy — alchemy.com |
| Trading | QuantConnect — quantconnect.com/league |
| Environment | conda · Python 3.12.x |

---

## 04/15/2026 — Kickoff

**Present:** Jay, Maggie, Joshua *(Chris Kim — absent)*
**Focus:** Introductions, project scope, repo + workflow setup.

- Set a recurring meeting time; walked through project scope and open questions.
- Configured the GitHub repo and agreed on the git workflow; everyone to send usernames for collaborator invites.
- Surveyed the core tooling — Alchemy for data ingestion, QuantConnect for the trading extension.

**Action items**
- Create conda env (Python 3.12.x) and confirm repo access.
- Send GitHub usernames in the channel for invites.
- Read up on Ethereum + Web3.py; explore Alchemy and QuantConnect; come ready to drive Week 3.

---

## 04/29/2026 — Data ingestion kickoff

**Present:** Maggie, Joshua *(Jay, Chris Kim — absent)*
**Focus:** Stand up Alchemy access and lock the raw extraction.

- Scoped a small, fixed pull — a block range or selected wallet set plus recent transactions — to unblock feature work.
- Froze the raw schema: wallet addresses, timestamps, value transferred, gas used, token-transfer counts.
- Agreed all work happens in reproducible notebooks with a short data-collection README.

**Action items**
- **Jay & Maggie** — Alchemy setup + raw extraction → `transactions.csv`, `token_transfers.csv`, `wallets_raw.csv` (+ README).
- **Joshua & Chris** — review the raw schema and pre-spec the wallet-level feature table.

---

## 05/06/2026 — Data collection → feature prep

**Present:** Jay, Joshua, Chris Kim *(Maggie — absent)*
**Focus:** Finish the first dataset; begin the wallet-level feature table.

- Raw extraction landing; began aggregating transactions into a per-wallet table.
- Drafted the core feature set: total tx count, avg/total value sent & received, avg gas, active days, token-transfer count, send/receive ratio, unique counterparties, tx frequency.
- Agreed on cleaning + normalization so clustering can start the following week.

**Action items**
- **Joshua & Chris** — build and normalize `wallet_features.csv` with a feature-engineering notebook + a README explaining each feature.

---

## 05/15/2026 — Feature engineering + contract decoding

**Present:** Laksh Goyal, Maggie, Joshua, Chris Kim
**Focus:** Decode contract interactions and finalize behavioral features.

- Kicked off contract-interaction & event decoding (4-byte selectors) to turn opaque calls into behavioral signal — led mostly by Chris (the ≈ 5/15–5/22 push).
- Expanded the wallet-level table to the full behavioral feature set; validated and normalized it.
- Declared the feature matrix clustering-ready; HDBSCAN to follow.

**Action items**
- **Chris** — wrap contract decoding + feature engineering; hand off a frozen, normalized feature matrix.
- **Team** — review features and prep the clustering run.

---

## 05/22/2026 — Clustering results + presentation narrative

**Present:** Chris Kim, Laksh Goyal, Devang Pant, Ojas Dessai
**Focus:** Review clustering output and draft the presentation story.

- Contract decoding + feature engineering wrapped (the 5/15–5/22 push, led by Chris); feature matrix frozen.
- Reviewed the first HDBSCAN results — dense behavioral clusters distilling toward interpretable archetypes (traders, holders, bots, …).
- Began drafting the presentation narrative around the strongest findings.
- **Agreed hypothesis:** *If the clustering identified genuinely sophisticated wallets ("smart money"), their aggregate trading flow should contain information about future price movements that random or naive cohorts do not.*

**Action items**
- Define the "smart-money" cohort from the clusters, plus naive/random baselines.
- Specify the signal test: aggregate cohort flow vs. forward price movements.
- Slot the archetypes + headline finding into the deck outline.

---

## 05/30/2026 — Finalize deck + technical storytelling

**Present:** Chris Kim, Laksh Goyal, Devang Pant, Ojas Dessai
**Focus:** Lock slides/figures, rehearse delivery, prep the repo.

- Finalize slides and figures; tighten the technical story end-to-end.
- Prepare the GitHub README so reviewers can follow the full pipeline.
- **Presentation split:** Ojas & Devang to co-present the findings (2–3 slides).
- **Hypothesis status:** Devang is satisfied with his results and reiterated confidence in the signal; Ojas did not find a significant result and wants to push further on an alternative hypothesis.

**Action items**
- **Devang** — finalize the supporting figures for the confirmed result.
- **Ojas** — scope the alternative hypothesis; decide whether to fold a null-result caveat into the talk.
- **All** — finalize slides/figures, rehearse timing + technical storytelling, polish the README.
