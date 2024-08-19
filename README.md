## POKT App Stake Rotator

### Description

The POKT App Stake Rotator is a tool designed to simplify the process of rotating POKT app stakes. Specifically, it replaces a set of old app stakes with new ones. 

### Prerequisites

- Node.js environment
- A CSV file, `old-app-private-keys.csv`, containing old app private keys that you intend to unstake. This file should be located in the `input` directory.
- A CSV file, `new-app-private-keys.csv`, containing new app private keys that you intend to stake. This file should also be located in the `input` directory.
  - **Ensure that all your new public app stakes have at least 2 POKT**

### File Format

Each CSV file should have the following format:

```
privateKey
YOUR_APP_PRIVATE_KEY_1
YOUR_APP_PRIVATE_KEY_2
...
```

Ensure that the header is labeled "privateKey" and each subsequent row contains one private key.

### Setup

1. **Clone the Repository**: Clone or download the source code to your local machine.

2. **Install Dependencies**: Navigate to the root directory of the source code in your terminal and run:

   ```bash
   npm install
   ```

3. **Install TypeScript and tsc:** If you haven't already installed TypeScript and its compiler, you can do so globally with:

   ```bash
   npm install -g typescript
   ```
3. **Environment Variables**: Set up the `chainId` environment variable if it's different from the default ("mainnet").

   ```bash
   export chainId="testnet"
   ```

### Generate New Private Keys Usage
1. **Execution**:

   ```bash
   npm run generate-new-keys
   ```
2. **Follow the prompts**:

   - You will be prompted to enter how many new keys to generate
   - The script will generate the new keys to the input folder with the output of: `new-app-private-keys-{date}.csv`

### Rotate App Instructions

1. **Execution**:

   ```bash
   npm run start
   ```

2. **Follow the prompts**:

    - You will first be prompted to enter your POKT RPC Provider URL. Enter the appropriate URL.
    - The tool will then check for the existence and validity of the `old-app-private-keys.csv` and `new-app-private-keys.csv` files.
    - If everything is in order, you will receive a summary of the actions about to be performed and be asked for confirmation before proceeding.
    - If you confirm the actions, the tool will proceed to unstake old app stakes and stake new app stakes.

3. **Verify the mesults manually**:

    - After the process is completed, you can check the results in the `output` directory. A CSV file will be generated for both the staking and unstaking actions, detailing the success or failure of each action.

4. **Verify the results automatically**

   - You can run `npm run verify-new-stakes.ts` to verify whether the app stakes in `new-app-private-keys.csv` are staked into the blockchain.
   - This script allows you to quickly validate new application stakes in bulk without manually searching up the tx hashes.
  
_Transfer your old app stake wallet balances to your new app stakes. Rotating app stakes via network transaction does not transfer funds, you should do that manually._
---
