import * as readline from "readline";

/**
 * Prompts the user with a question and waits for the answer.
 *
 * @param {string} question - The question to ask.
 * @returns {Promise<string>} A promise that resolves to the user's answer.
 */
export function askQuestion(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}
