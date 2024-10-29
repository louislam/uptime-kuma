import { uploadArtifacts } from "./lib.mjs";

const version = process.env.RELEASE_BETA_VERSION;
const githubToken = process.env.RELEASE_GITHUB_TOKEN;

uploadArtifacts(version, githubToken);
