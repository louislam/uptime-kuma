#!/usr/bin/env node

/**
 * Update RDAP DNS data from IANA
 * This script downloads the latest RDAP bootstrap file from IANA and updates the local file.
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RDAP_DNS_URL = "https://data.iana.org/rdap/dns.json";
const OUTPUT_PATH = join(__dirname, "..", "server", "model", "rdap-dns.json");

console.log("Downloading RDAP DNS data from IANA...");

try {
    const response = await fetch(RDAP_DNS_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate that we have the expected structure
    if (!data.services || !Array.isArray(data.services)) {
        throw new Error("Invalid RDAP DNS data structure");
    }
    
    console.log(`Found ${data.services.length} RDAP services`);
    console.log(`Publication date: ${data.publication}`);
    
    // Write the file with proper formatting
    writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
    
    console.log(`✓ Successfully updated ${OUTPUT_PATH}`);
    process.exit(0);
} catch (error) {
    console.error("✗ Failed to update RDAP DNS data:");
    console.error(error.message);
    process.exit(1);
}
