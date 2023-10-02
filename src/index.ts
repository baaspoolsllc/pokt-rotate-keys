import * as fs from 'fs';
import * as readline from 'readline';

import {JsonRpcProvider} from "@pokt-foundation/pocketjs-provider";

import * as Path from "path";
import {setPoktProvider} from "./di";
import {appStakeRetry, appUnstakeRetry} from "./pokt/appStakeTxs";


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const STAKE_BATCH_SIZE = 50;
const PROPAGATE_SLEEP_MS = 15000;

const oldAppPrivateKeysPath = Path.join(__dirname, "../input/old-app-private-keys.csv")
const newAppPrivateKeysPath = Path.join(__dirname, "../input/new-app-private-keys.csv")

async function main() {
    const rpcProviderUrl = await askQuestion('Enter your POKT RPC Provider URL: ');

    const inputFiles = [oldAppPrivateKeysPath, newAppPrivateKeysPath]
    for (const f of inputFiles) {
        if (!isValidFilePath(f)) {
            console.error(`Could not find ${f}`);
            return;
        }
    }

    const unstakePrivateKeys = getAppPrivateKeysFromCSV(oldAppPrivateKeysPath)
    const newAppStakePrivateKeys = getAppPrivateKeysFromCSV(newAppPrivateKeysPath)

    if(unstakePrivateKeys.length != newAppStakePrivateKeys.length) {
        throw new Error(`${unstakePrivateKeys} old app stakes does not match the replacement of ${newAppStakePrivateKeys} new app stakes`)
    }

    console.log('')
    console.log(`App stakes count being rotated: ${unstakePrivateKeys.length}`)
    console.log(`RPC Provider: ${rpcProviderUrl}`)
    console.log('')

    const confirm = await askQuestion(`Does this seem correct? Confirm by typing yes: `)

    if(!["y", "yes"].includes(confirm)) {
        throw new Error(`User confirmation failed, user answered with ${confirm}`)
    }

    // Instantiate a provider for querying information on the chain!
    setPoktProvider(new JsonRpcProvider({
        rpcUrl: rpcProviderUrl,
        dispatchers: [rpcProviderUrl],
    }));

    // handle stakes
    if(!await handleAppStakeAction('unstake', unstakePrivateKeys)) {
        throw new Error("Failed to stake all apps, try running the script again!")

    }

    console.log("Sleeping for 15s to allow txs to propagate")
    await sleep(PROPAGATE_SLEEP_MS)

    if(!await handleAppStakeAction('stake', newAppStakePrivateKeys)) {
        throw new Error("Failed to stake all apps, try running the script again!")
    }

    console.log("App stakes successfully rotated")
    rl.close()
}

/**
 * Handles the staking or unstaking actions for given app private keys.
 * Processes the keys in batches and generates a CSV report of the results.
 *
 * @param {('stake' | 'unstake')} action - The action to perform, either 'stake' or 'unstake'.
 * @param {string[]} appPrivateKeys - Array of app private keys to process.
 * @returns {Promise<boolean>} Returns true if all actions are successful, false otherwise.
 */
async function handleAppStakeAction(action: 'stake' | 'unstake', appPrivateKeys: string[]) {
    console.log(`Handling ${action}s`);

    const responses: {
        address: string,
        response: string,
        success: boolean
    }[] = [];

    const poktActionFuncWithRetry = action === 'stake' ? appStakeRetry : appUnstakeRetry;

    for (let i = 0; i < appPrivateKeys.length; i += STAKE_BATCH_SIZE) {
        const batch = appPrivateKeys.slice(i, i + STAKE_BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch.map(addr => poktActionFuncWithRetry(addr)));

        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            if (result.status === 'fulfilled') {
                const responseValue = (result as PromiseFulfilledResult<string>).value;
                responses.push({
                    address: batch[j],
                    response: responseValue,
                    success: true,
                });
            } else {
                // promise rejected, likely from an exception
                responses.push({
                    address: batch[j],
                    response: (result as PromiseRejectedResult).reason.toString(),
                    success: false
                });
            }
        }
    }

    // Create the csv file for output
    let csvContent = 'address,response,success\n';
    for (const {address, response, success} of responses) {
        csvContent += `${address},${response},${success}\n`;
    }
    const outputFileName = `${new Date().toISOString().replace(/:/g,"_")}-${action}-results.csv`;
    const outputPath = Path.join(__dirname, "../", "output", outputFileName);
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
    console.log(`Results saved to ${outputPath}`);

    return !responses.find(s=> !s.success)
}


/**
 * Prompts the user with a question and waits for the answer.
 *
 * @param {string} question - The question to ask.
 * @returns {Promise<string>} A promise that resolves to the user's answer.
 */
function askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
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
    if(privateKeys.slice(1).length > 100) {
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

    return receiverAddressesFile.slice(1);
}

/**
 * Pauses the execution for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to pause for.
 * @returns {Promise<void>} A promise that resolves after the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error) => {
    console.error('An error occurred:', error);
    rl.close();
});