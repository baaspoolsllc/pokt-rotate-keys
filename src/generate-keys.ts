import * as fs from 'fs';
import * as readline from 'readline';

import {JsonRpcProvider} from "@pokt-foundation/pocketjs-provider";

import * as Path from "path";
import {setPoktProvider} from "./di";
import {appStakeRetry, appUnstakeRetry} from "./pokt/appStakeTxs";
import {askQuestion} from "./common/ask_question";
import {KeyManager} from "@pokt-foundation/pocketjs-signer";


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});


async function main() {
    const appStakeAmount = await askQuestion(rl, 'How many app stakes to generate?: ');

    let csvOutput = 'privateKey\n'

    const privateKeys: string[] = []
    for(let i = 0; i < parseInt(appStakeAmount); i++) {
        const km = await KeyManager.createRandom()
        privateKeys.push(km.getPrivateKey())
    }
    csvOutput += privateKeys.join("\n")
    fs.writeFileSync(csvOutput, Path.join(__dirname, `../input/new-app-private-keys-${new Date().toISOString()}.csv`.replace(/:/g,"_"), csvOutput, 'utf8'))
    rl.close()
}


main().catch((error) => {
    console.error('An error occurred:', error);
    rl.close();
});