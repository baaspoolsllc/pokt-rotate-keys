import { KeyManager } from "@pokt-foundation/pocketjs-signer";
import { ChainID, TransactionBuilder } from "@pokt-foundation/pocketjs-transaction-builder";
import { getPoktProvider } from "../di";

/**
 * Tries to perform a specific app action (stake or unstake) with retries.
 *
 * @param {string} actionType - The action to perform: 'stake' or 'unstake'.
 * @param {string} appPrivateKey - The private key for the app.
 * @param {number} [retryAttempts=10] - The number of times to retry the action if it fails.
 * @returns {Promise<string>} The transaction hash if successful, 'Failed' otherwise.
 */
async function performAppActionRetry(actionType: 'stake' | 'unstake', appPrivateKey: string, retryAttempts = 10): Promise<string> {
    const signer = await KeyManager.fromPrivateKey(appPrivateKey);

    const transactionBuilder = new TransactionBuilder({
        provider: getPoktProvider(),
        signer,
        chainID: process.env.chainId as ChainID || "mainnet"
    });

    let actionMsg;
    if (actionType === 'unstake') {
        console.log("Attempting to unstake app: ", signer.getAddress());
        actionMsg = transactionBuilder.appUnstake(signer.getAddress());
    } else if (actionType === 'stake') {
        console.log("Attempting to stake app: ", signer.getAddress());
        actionMsg = transactionBuilder.appStake({
            appPubKey: signer.getPublicKey(),
            chains: ["0001"],
            amount: "1000000"
        });
    } else {
        throw new Error("Invalid action type provided.");
    }

    let error: any;
    for (let i = 0; i < retryAttempts; i++) {
        try {
            const response = await transactionBuilder.submit({txMsg: actionMsg});
            return response.txHash;
        } catch (e) {
            error = e;
        }
    }
    throw Error(error);
}

/**
 * Tries to unstake an app with retries.
 *
 * @param {string} appPrivateKey - The private key for the app.
 * @param {number} [retryAttempts=10] - The number of times to retry the action if it fails.
 * @returns {Promise<string>} The transaction hash if successful, 'Failed' otherwise.
 */
export const appUnstakeRetry = (appPrivateKey: string, retryAttempts = 10): Promise<string> =>
    performAppActionRetry('unstake', appPrivateKey, retryAttempts);

/**
 * Tries to stake an app with retries.
 *
 * @param {string} appPrivateKey - The private key for the app.
 * @param {number} [retryAttempts=10] - The number of times to retry the action if it fails.
 * @returns {Promise<string>} The transaction hash if successful, 'Failed' otherwise.
 */
export const appStakeRetry = (appPrivateKey: string, retryAttempts = 10): Promise<string> =>
    performAppActionRetry('stake', appPrivateKey, retryAttempts);
