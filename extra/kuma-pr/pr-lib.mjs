/**
 * Parse <name>:<branch> to an object.
 * @param {string} prName <name>:<branch>
 * @returns {object} An object with name and branch properties.
 */
export function parsePrName(prName) {
    let name = "louislam";
    let branch;

    const errorMessage = "Please set a repo to the environment variable 'UPTIME_KUMA_GH_REPO' (e.g. mhkarimi1383:goalert-notification)";

    if (!prName) {
        throw new Error(errorMessage);
    }

    prName = prName.trim();
    if (prName === "") {
        throw new Error(errorMessage);
    }

    let inputArray = prName.split(":");

    // Just realized that owner's prs are not prefixed with "louislam:"
    if (inputArray.length === 1) {
        branch = inputArray[0];

    } else if (inputArray.length === 2) {
        name = inputArray[0];
        branch = inputArray[1];

    } else {
        throw new Error("Invalid format. The format is like this: mhkarimi1383:goalert-notification");
    }

    return {
        name,
        branch
    };
}
