import pandas as pd

PROCESSED = "data/processed"

blocks = pd.read_parquet(f"{PROCESSED}/blocks.parquet")
txs = pd.read_parquet(f"{PROCESSED}/transactions.parquet")
receipts = pd.read_parquet(f"{PROCESSED}/receipts.parquet")
codes = pd.read_parquet(f"{PROCESSED}/address_codes.parquet")
logs = pd.read_parquet(f"{PROCESSED}/token_transfers.parquet")

print("=== Row counts ===")
print(f"blocks:           {len(blocks):>10,}")
print(f"transactions:     {len(txs):>10,}")
print(f"receipts:         {len(receipts):>10,}")
print(f"token_transfers:  {len(logs):>10,}")
print(f"address_codes:    {len(codes):>10,}")

# Check 1: tx counts reconcile
print("\n=== Check 1: tx counts ===")
sum_from_blocks = blocks["tx_count"].sum()
actual_txs = len(txs)
print(f"Sum of tx_count in blocks: {sum_from_blocks:,}")
print(f"Rows in transactions:      {actual_txs:,}")
print(f"Match: {sum_from_blocks == actual_txs}")
if sum_from_blocks != actual_txs:
    print(f"  DIFF: {sum_from_blocks - actual_txs:+,}")

# Check 2: receipts are 1:1 with transactions
print("\n=== Check 2: receipts coverage ===")
tx_hashes = set(txs["tx_hash"])
receipt_hashes = set(receipts["tx_hash"])
print(f"Unique tx_hashes in transactions: {len(tx_hashes):,}")
print(f"Unique tx_hashes in receipts:     {len(receipt_hashes):,}")
print(f"Duplicate receipts:               {len(receipts) - len(receipt_hashes):,}")
print(f"Txs missing a receipt:            {len(tx_hashes - receipt_hashes):,}")
print(f"Receipts with no matching tx:     {len(receipt_hashes - tx_hashes):,}")

# Check 3: contract ratio in classified addresses
print("\n=== Check 3: EOA vs contract split ===")
contract_pct = codes["is_contract"].mean() * 100
print(f"Classified addresses: {len(codes):,}")
print(f"Contracts:            {codes['is_contract'].sum():,} ({contract_pct:.1f}%)")
print(f"EOAs:                 {(~codes['is_contract']).sum():,} ({100-contract_pct:.1f}%)")
print(f"Expected range:       25-45% contracts")
status = "OK" if 25 <= contract_pct <= 45 else "INVESTIGATE"
print(f"Status: {status}")

# Bonus checks worth running
print("\n=== Bonus sanity ===")
print(f"Block range:          {blocks['block'].min():,} -> {blocks['block'].max():,}")
print(f"Block range span:     {blocks['block'].max() - blocks['block'].min() + 1:,}")
print(f"Distinct blocks:      {blocks['block'].nunique():,}")
print(f"Failed tx ratio:      {(receipts['status'] == 0).mean():.2%}  (typical: 3-8%)")
print(f"Coverage of addrs:    {len(codes) / len(set(txs['from']) | set(txs['to'].dropna())):.1%}")