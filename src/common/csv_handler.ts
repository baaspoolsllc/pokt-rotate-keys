import fs from "fs";

/**
 * Checks if the given file path is valid and accessible.
 *
 * @param {string} filePath - Path to the file.
 * @returns {boolean} True if the file is accessible, otherwise false.
 */
export function isValidFilePath(filePath: string): boolean {
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
export function isValidCsv(privateKeys: string[]): boolean {
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
export function getAppPrivateKeysFromCSV(filePath: string): string[] {
    const receiverData = fs.readFileSync(filePath, 'utf-8');
    const receiverAddressesFile = receiverData.split('\n').map(line => line.trim());

    if (!isValidCsv(receiverAddressesFile)) {
        throw new Error(`malformed CSV for app keys: ${filePath}`)
    }
    return receiverAddressesFile.slice(1).filter(s => s.length == 128);
}
