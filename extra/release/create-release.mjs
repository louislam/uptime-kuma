import { createDraftRelease, getVersionFromEnv, isBetaRelease } from "./lib.mjs";
import { generateChangelogAI } from "./generate-changelog.mjs";

const version = getVersionFromEnv();
const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;

if (!version) {
    console.error("RELEASE_VERSION is required");
    process.exit(1);
}

if (!previousVersion) {
    console.error("RELEASE_PREVIOUS_VERSION is required");
    process.exit(1);
}

const isBeta = isBetaRelease();
const changelog = await generateChangelogAI(previousVersion);
await createDraftRelease(version, changelog, isBeta);