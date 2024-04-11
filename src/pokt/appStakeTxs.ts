import { KeyManager } from "@pokt-foundation/pocketjs-signer";
import { ChainID, TransactionBuilder } from "@pokt-foundation/pocketjs-transaction-builder";
import { getPoktProvider } from "../di";


/**
 * Tries to perform a app transfer with retries
 *
 * @param {string} appPrivateKey - The private key for the app.
 * @param {string} newAppPrivateKey - new app private key if using app transfer
 * @param {number} [retryAttempts=10] - The number of times to retry the action if it fails.
 * @returns {Promise<string>} The transaction hash if successful, 'Failed' otherwise.
 */
export async function sendAppStakeTransfer(appPrivateKey: string,  newAppPrivateKey: string, retryAttempts = 10): Promise<string> {
    const signer = await KeyManager.fromPrivateKey(appPrivateKey);

    const transactionBuilder = new TransactionBuilder({
        provider: getPoktProvider(),
        signer,
        chainID: process.env.chainId as ChainID || "mainnet"
    });

    const transferAppKM = await KeyManager.fromPrivateKey(newAppPrivateKey)
    console.log(`Attempting to transfer app: ${signer.getAddress()} to ${transferAppKM.getPublicKey()}`);
    const actionMsg = transactionBuilder.appTransfer({
        appPubKey: transferAppKM.getPublicKey(),
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