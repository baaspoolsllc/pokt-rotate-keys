import * as fs from 'fs';
import * as readline from 'readline';

import {JsonRpcProvider} from "@pokt-foundation/pocketjs-provider";

import * as Path from "path";
import {setPoktProvider} from "./di";

import {askQuestion} from "./common/ask_question";
import {sendAppStakeTransfer} from "./pokt/appStakeTxs";
import {KeyManager} from "@pokt-foundation/pocketjs-signer";


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const STAKE_BATCH_SIZE = 50;

const oldAppPrivateKeysPath = Path.join(__dirname, "../input/old-app-private-keys.csv")
const newAppPrivateKeysPath = Path.join(__dirname, "../input/new-app-private-keys.csv")

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

/**
 * Checks if the given file path is valid and accessible.
 *
 * @param {string} filePath - Path to the file.
 * @returns {boolean} True if the file is accessible, otherwise false.
 */
function isValidFilePath(filePath: string): boolean {
    try {
        fs.accessSync(filePath);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Validates the content of a CSV containing private keys.
 *
 * @param {string[]} privateKeys - Array of strings from the CSV, where the first element is expected to be the header.
 * @returns {boolean} True if the CSV is valid, otherwise false.
 */
function isValidCsv(privateKeys: string[]): boolean {
    const header = privateKeys[0];
    if (header != "privateKey") {
        console.error('malformed addreses.csv header');
        return false;
    }
    const invalidAddresses = privateKeys.slice(1).filter(key => key.length !== 128);
    if (invalidAddresses.length > 0) {
        console.error('Invalid addresses:', invalidAddresses);
        return false;
    }
    if (privateKeys.slice(1).length > 100) {
        console.error('Avoid batch sending to more than 100 to, wait another 15 minutes and try another 100');
        return false;
    }
    return true;
}

/**
 * Extracts and validates app private keys from a CSV file.
 *
 * @param {string} filePath - Path to the CSV file.
 * @returns {string[] | undefined} Array of validated private keys, or throws an exception if the CSV is not valid.
 */
function getAppPrivateKeysFromCSV(filePath: string): string[] {
    const receiverData = fs.readFileSync(filePath, 'utf-8');
    const receiverAddressesFile = receiverData.split('\n').map(line => line.trim());

    if (!isValidCsv(receiverAddressesFile)) {
        throw new Error(`malformed CSV for app keys: ${filePath}`)
    }
    return receiverAddressesFile.slice(1).filter(s => s.length == 128);
}


main().catch((error) => {
    console.error('An error occurred:', error);
    rl.close();
});