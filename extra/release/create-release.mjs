import { createRelease } from "./lib.mjs";
import { generateChangelogAI } from "../generate-changelog.mjs";

const version = process.env.RELEASE_VERSION || process.env.RELEASE_BETA_VERSION;
const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;

if (!version) {
    console.error("RELEASE_VERSION is required");
    process.exit(1);
}

if (!previousVersion) {
    console.error("RELEASE_PREVIOUS_VERSION is required");
    process.exit(1);
}

const isBeta = !!process.env.RELEASE_BETA_VERSION;
const changelog = await generateChangelogAI(previousVersion);
await createRelease(version, changelog, isBeta, "");
