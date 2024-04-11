import * as fs from 'fs';
import * as readline from 'readline';

import {JsonRpcProvider} from "@pokt-foundation/pocketjs-provider";

import * as Path from "path";
import {setPoktProvider} from "./di";

import {askQuestion} from "./common/ask_question";
import {sendAppStakeTransfer} from "./pokt/appStakeTxs";
import {KeyManager} from "@pokt-foundation/pocketjs-signer";
import {newAppPrivateKeysPath, oldAppPrivateKeysPath} from "./common/private_keys_paths";
import {getAppPrivateKeysFromCSV, isValidFilePath} from "./common/csv_handler";


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const STAKE_BATCH_SIZE = 50;


async function main() {
    const rpcProviderUrl = await askQuestion(rl, 'Enter your POKT RPC Provider URL: ');

    const inputFiles = [oldAppPrivateKeysPath, newAppPrivateKeysPath]
    for (const f of inputFiles) {
        if (!isValidFilePath(f)) {
            console.error(`Could not find ${f}`);
            return;
        }
    }

    const oldAppStakePrivateKeys = getAppPrivateKeysFromCSV(oldAppPrivateKeysPath)
    const newAppStakePrivateKeys = getAppPrivateKeysFromCSV(newAppPrivateKeysPath)

    if (oldAppStakePrivateKeys.length != newAppStakePrivateKeys.length) {
        throw new Error(`${oldAppStakePrivateKeys.length} old app stakes does not match the replacement of ${newAppStakePrivateKeys.length} new app stakes`)
    }

    console.log('')
    console.log(`App stakes count being rotated: ${oldAppStakePrivateKeys.length}`)
    console.log(`RPC Provider: ${rpcProviderUrl}`)
    console.log('')

    const confirm = await askQuestion(rl, `Does this seem correct? Confirm by typing yes: `)

    if (!["y", "yes"].includes(confirm)) {
        throw new Error(`User confirmation failed, user answered with ${confirm}`)
    }

    // Instantiate a provider for querying information on the chain!
    setPoktProvider(new JsonRpcProvider({
        rpcUrl: rpcProviderUrl,
        dispatchers: [rpcProviderUrl],
    }));

    // handle stakes
    if (!await handleAppStakeTransfers(oldAppStakePrivateKeys, newAppStakePrivateKeys)) {
        throw new Error("Failed to stake all apps, try running the script again!")
    }
    console.log("App stakes successfully rotated")
    rl.close()
}

/**
 * Handles the app stake transfers
 * Processes the keys in batches and generates a CSV report of the results.
 *
 * @param {string[]} oldPrivateKeys - Array of app private keys to transfer from
 * @param {string[]} newPrivateKeys - Array of app private keys to transfer to
 * @returns {Promise<boolean>} Returns true if all actions are successful, false otherwise.
 */
async function handleAppStakeTransfers(oldPrivateKeys: string[], newPrivateKeys: string[]) {

    const responses: {
        oldAddress: string,
        newAddress: string,
        response: string,
        success: boolean
    }[] = [];


    for (let i = 0; i < oldPrivateKeys.length; i += STAKE_BATCH_SIZE) {
        const oldAppStakeKeysBatch = oldPrivateKeys.slice(i, i + STAKE_BATCH_SIZE);
        const newAppStakeKeysBatch = newPrivateKeys.slice(i, i + STAKE_BATCH_SIZE);

        const batchResults = await Promise.allSettled(oldAppStakeKeysBatch.map((oldPrivateKey, i) => sendAppStakeTransfer(oldPrivateKey, newAppStakeKeysBatch[i])));

        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const oldAddress =  (await KeyManager.fromPrivateKey(oldAppStakeKeysBatch[j])).getAddress()
            const newAddress = (await KeyManager.fromPrivateKey(newAppStakeKeysBatch[j])).getAddress()
            if (result.status === 'fulfilled') {
                const responseValue = (result as PromiseFulfilledResult<string>).value;
                responses.push({
                    oldAddress,
                    newAddress,
                    response: responseValue,
                    success: true,
                });
            } else {
                // promise rejected, likely from an exception
                responses.push({
                    oldAddress,
                    newAddress,
                    response: (result as PromiseRejectedResult).reason.toString(),
                    success: false
                });
            }
        }
    }

    // Create the csv file for output
    let csvContent = 'oldAddress,newAddress,response,success\n';
    for (const {oldAddress, newAddress, response, success} of responses) {
        csvContent += `${oldAddress},${newAddress},${response},${success}\n`;
    }
    const outputFileName = `${new Date().toISOString()}-app_transfer-results.csv`.replace(/:/g, "_");
    const outputPath = Path.join(__dirname, "../", "output", outputFileName);
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
    console.log(`Results saved to ${outputPath}`);

    return !responses.find(s => !s.success)
}


main().catch((error) => {
    console.error('An error occurred:', error);
    rl.close();
});