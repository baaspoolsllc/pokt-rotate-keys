import { KeyManager } from "@pokt-foundation/pocketjs-signer";
import { ChainID, TransactionBuilder } from "@pokt-foundation/pocketjs-transaction-builder";
import { getPoktProvider } from "../di";


/**
 * Tries to perform a app transfer with retries
 *
 * @param {string} oldAppPrivateKey - The private key for the old app key
 * @param {string} newAppPrivateKey - The private key for the new app key being rotated.
 * @param {number} [retryAttempts=10] - The number of times to retry the action if it fails.
 * @returns {Promise<string>} The transaction hash if successful, 'Failed' otherwise.
 */
export async function sendAppStakeTransfer(oldAppPrivateKey: string, newAppPrivateKey: string, retryAttempts = 10): Promise<string> {
    const oldAppPrivateKeySigner = await KeyManager.fromPrivateKey(oldAppPrivateKey);

    const transactionBuilder = new TransactionBuilder({
        provider: getPoktProvider(),
        signer: oldAppPrivateKeySigner,
        chainID: process.env.chainId as ChainID || "mainnet"
    });

    const newAppPrivateKeySigner = await KeyManager.fromPrivateKey(newAppPrivateKey)
    console.log(`Attempting to transfer app: ${oldAppPrivateKeySigner.getAddress()} to ${newAppPrivateKeySigner.getAddress()}`);
    const actionMsg = transactionBuilder.appTransfer({
        appPubKey: newAppPrivateKeySigner.getPublicKey(),
    });

    let error: any;
    for (let i = 0; i < retryAttempts; i++) {
        try {
            const response = await transactionBuilder.submit({txMsg: actionMsg});
            return response.txHash;
        } catch (e) {
            error = e;
        }
        throw Error(error);
    }
    return ""
}