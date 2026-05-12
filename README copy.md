# ChainSense

  # Features

**total_sent**: total eth sent by wallet
**total_recieved**: total eth recieved
**tx_count**: # of transactions sent
**avg_value_sent** avg eth/transaction
**avg_gas** avg gas used
**unique_recipients** # of distinct wallets we intereacted with
- **send_receive_ratio**: total_sent / total_received (high = distributor, low = holder)
**tx_frequency**: transaction per active day
**active_days** # of days wallet has been transacting

  ## Preprocessing
- Sent and received stats computed separately then merged on wallet address
- Missing received values filled with 0
- All features normalized using Scikit learn StandardScaler

## Outputs
- transactions.csv – raw transaction data
- wallet_features.csv – one row per wallet with all features above
