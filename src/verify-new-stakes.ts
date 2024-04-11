import * as fs from 'fs';

import * as Path from "path";
import {askQuestion} from "./common/ask_question";
import {getAppPrivateKeysFromCSV} from "./common/csv_handler";
import {newAppPrivateKeysPath} from "./common/private_keys_paths";
import {KeyManager} from "@pokt-foundation/pocketjs-signer";
import {getPoktProvider, setPoktProvider} from "./di";
import {JsonRpcProvider} from "@pokt-foundation/pocketjs-provider";
import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
async function main() {

    const rpcProviderUrl = await askQuestion(rl, 'Enter your POKT RPC Provider URL: ');

    // Instantiate a provider for querying information on the chain!
    setPoktProvider(new JsonRpcProvider({
        rpcUrl: rpcProviderUrl,
        dispatchers: [rpcProviderUrl],
    }));

    let success = true
    const privateKeys = getAppPrivateKeysFromCSV(newAppPrivateKeysPath)
    for(const pk of privateKeys) {
        const km = await KeyManager.fromPrivateKey(pk)
        try {
            const app = await getPoktProvider().getApp({address: km.getAddress()})
            if(app.status != 2) {
                console.log(`App: ${km.getAddress()} cannot be found, status ${app.status}.`)
                success = false
            }
        } catch (e) {
            success = false
            console.log(`App: ${km.getAddress()} cannot be found.`)
        }
    }
    if(success) {
        console.log(`All ${privateKeys.length} new app stakes are verified staked into the network.`)
    }
    rl.close()
}


main().catch((error) => {
    console.error('An error occurred:', error);

});