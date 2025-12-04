const NotificationProvider = require("./notification-provider");
const Crypto = require("crypto");
const { log } = require("../../src/util");

const { CryptoBackend } = require("@matrix-org/matrix-sdk-crypto-nodejs");
const sdk = require("matrix-js-sdk");

class MatrixEncrypted extends NotificationProvider {
    name = "matrix-encrypted";

    // Singleton client and store
    static client = null;
    static store = null;

    async send(notification, msg) {
        const okMsg = "Sent Successfully.";

        // Initialize JSON store once
        if (!MatrixEncrypted.store) {
            MatrixEncrypted.store = new JsonCryptoStore("./my_crypto_store2.json");
        }

        // Initialize client once
        if (!MatrixEncrypted.client) {
            MatrixEncrypted.client = sdk.createClient({
                baseUrl: notification.homeserverUrl,
                accessToken: notification.accessToken,
                userId: notification.userId,
                deviceId: notification.deviceId,
                cryptoStore: MatrixEncrypted.store,
            });

            // Initialize Rust crypto
            await MatrixEncrypted.client.initRustCrypto({ useIndexedDB: false });

            // Listen for verification requests
            this.listenForVerificationRequests(MatrixEncrypted.client);

            // Start client
            await MatrixEncrypted.client.startClient({ initialSyncLimit: 1 });

            // Wait for initial sync
            await new Promise((resolve) => {
                MatrixEncrypted.client.once("sync", (state) => {
                    if (state === "PREPARED") resolve();
                });
            })

            log.info("Matrix", "Client initialized and ready");

            await this.selfVerifyDevice(MatrixEncrypted.client);
        } else {
            log.info("Matrix", "Reusing existing client instance");
        }

        log.info("Matrix", "Sending encrypted message…");

        await MatrixEncrypted.client.sendMessage(notification.internalRoomId, {
            msgtype: "m.text",
            body: msg,
        });

        return okMsg;
    }

    // Automatically self-verify this device
    async selfVerifyDevice(client) {
        try {
            const userId = client.getUserId();
            const deviceId = client.getDeviceId();
            const crypto = client.getCrypto();

            await crypto.setDeviceVerified(userId, deviceId);
            log.info("Matrix", `Device ${deviceId} self-verified!`);
        } catch (err) {
            log.error("Matrix", "Failed to self-verify device:", err);
        }
    }

    // Listen for verification requests and auto-accept trusted devices
    listenForVerificationRequests(client) {
        client.on(CryptoEvent.VerificationRequestReceived, async (request) => {  
            console.log(`Verification request from ${request.otherUserId}`);  
            
            // 2. Accept the request  
            await request.accept();  
            console.log("Request accepted, waiting for method selection...");  
            
            // 3. Wait for the other device to start verification  
            request.once("change", async () => {
                console.log("Changed");
                console.log("Phase:", request.phase);  
                console.log("Chosen method:", request.chosenMethod);  
                if (request.phase === 4 && request.verifier) {  
                    console.log("Started")
                    const verifier = request.verifier;  
                    
                    // 4. Handle SAS verification  
                    verifier.on("show_sas", async (showSas) => {  
                        const emojis = showSas.sas.emoji;  
                        if (emojis) {  
                            // Display emojis to user  
                            console.log("Compare these emojis:");  
                            emojis.forEach(([emoji, name], index) => {  
                                console.log(`${index + 1}. ${emoji} - ${name}`);  
                            });  
                            setTimeout(() => {
                                console.log("Confirming sas");
                                showSas.confirm();  
                                console.log("SAS confirmed");  
                            }, 5000);
                        }  
                    });  
                    
                    // 5. Start verification process  
                    try {  
                        await verifier.verify();  
                        console.log("Verification complete!");  
                    } catch (error) {  
                        console.error("Verification failed:", error);  
                    }  
                }  
            });  
        });
    }
}

const fs = require("fs");
const path = require("path");
const { CryptoEvent } = require("matrix-js-sdk/lib/crypto-api");
const { VerificationMethod } = require("matrix-js-sdk/lib/types");

/**
 * A simple JSON-file-based CryptoStore for Node.js
 * Compatible with matrix-js-sdk E2EE
 */
class JsonCryptoStore {
    /**
     * @param {string} filePath
     */
    constructor(filePath) {
        this.filePath = filePath || path.join(__dirname, "crypto_store.json");
        this.store = {};
        this.loadFromFile();
    }

    loadFromFile() {
        if (fs.existsSync(this.filePath)) {
            try {
                const data = fs.readFileSync(this.filePath, "utf-8");
                this.store = JSON.parse(data);
            } catch (err) {
                console.warn("Failed to load crypto store, starting fresh.", err);
                this.store = {};
            }
        }
    }

    containsData() {
        return false;
    }

    saveToFile() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), "utf-8");
        } catch (err) {
            console.error("Failed to save crypto store", err);
        }
    }

    // ICryptoStore interface methods

    async get(name) {
        return this.store[name];
    }

    async set(name, value) {
        this.store[name] = value;
        this.saveToFile();
    }

    async remove(name) {
        delete this.store[name];
        this.saveToFile();
    }

    async getAll() {
        return { ...this.store };
    }

    async doTxn(type, mode, txnFn) {
        // JSON store is in-memory, so txn is a no-op
        return txnFn(null);
    }

    async isNew() {
        return !fs.existsSync(this.filePath);
    }

    async close() {
        // nothing to close
    }
}

module.exports = MatrixEncrypted;
