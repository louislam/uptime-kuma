const { MonitorType } = require("./monitor-type");
const { UP, PING_GLOBAL_TIMEOUT_DEFAULT: TIMEOUT } = require("../../src/util");
const dgram = require('dgram');
const crypto = require('crypto');
const dns = require("dns").promises;
const net = require('net');

// https://www.rfc-editor.org/rfc/rfc9000.html#name-variable-length-integer-enc
const encodeVarint = (buffer, offset, value) => {
    if (value <= 63) {
        buffer[offset] = value;
        return offset + 1;
    } else if (value <= 16383) {
        buffer[offset] = 0x40 | ((value >> 8) & 0x3F);
        buffer[offset + 1] = value & 0xFF;
        return offset + 2;
    } else if (value <= 1073741823) {
        buffer[offset] = 0x80 | ((value >> 24) & 0x3F);
        buffer[offset + 1] = (value >> 16) & 0xFF;
        buffer[offset + 2] = (value >> 8) & 0xFF;
        buffer[offset + 3] = value & 0xFF;
        return offset + 4;
    }
    throw new Error('too large');
}

const getVarintSize = (value) => {
    if (value <= 63) {
        return 1;
    }
    if (value <= 16383) {
        return 2;
    }
    if (value <= 1073741823) {
        return 4;
    }
    throw new Error('too large');
};

// https://www.rfc-editor.org/rfc/rfc9001#name-header-protection-applicati
const applyHeaderProtection = (packet, pnOffset, hp) => {
    const pnLength = (packet[0] & 0x03) + 1;
    const sampleOffset = pnOffset + 4;
    const sample = packet.slice(sampleOffset, sampleOffset + 16);
    const cipher = crypto.createCipheriv('aes-128-ecb', hp, null);
    cipher.setAutoPadding(false);
    const mask = cipher.update(sample);
    packet[0] ^= mask[0] & 0x0F;
    for (let i = 0; i < pnLength; i++) {
        packet[pnOffset + i] ^= mask[1 + i];
    }
    return packet;
}

// https://www.rfc-editor.org/rfc/rfc5869#section-2.2
const hdkfExtract = (salt, ikm) => {
    return crypto.createHmac("sha256", salt).update(ikm).digest();
}

// https://www.rfc-editor.org/rfc/rfc8446.html#section-7.1
const hkdfExpandLabel = (secret, label, context, length) => {
    const fullLabel = Buffer.concat([
        Buffer.from('tls13 ', 'utf8'),
        Buffer.from(label, 'utf8')
    ]);
    const hkdfLabel = Buffer.concat([
        Buffer.from([length >> 8, length & 0xFF]),  // length
        Buffer.from([fullLabel.length]),            // label length
        fullLabel,                                  // label
        Buffer.from([context.length]),              // context length
        context                                     // context
    ]);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(hkdfLabel);
    hmac.update(Buffer.from([0x01]));
    const output = hmac.digest();
    return output.subarray(0, length);
}


const INITIAL_SALT = Buffer.from('38762cf7f55934b34d179ae6a4c80cadccbb7f0a', 'hex');

// https://www.rfc-editor.org/rfc/rfc9001#name-initial-secrets
const deriveInitialSecrets = (dcid) => {
    const initialSecret = hdkfExtract(INITIAL_SALT, dcid);
    const clientSecret = hkdfExpandLabel( initialSecret, 'client in', Buffer.alloc(0), 32);
    const key = hkdfExpandLabel(clientSecret, 'quic key', Buffer.alloc(0), 16);
    const iv = hkdfExpandLabel(clientSecret, 'quic iv', Buffer.alloc(0), 12);
    const hp = hkdfExpandLabel(clientSecret, 'quic hp', Buffer.alloc(0), 16);
    return { key, iv, hp };
}

// https://www.rfc-editor.org/rfc/rfc9001#name-aead-usage
const encryptPayload = (payload, key, iv, packetNumber, header) => {
    const nonce = Buffer.from(iv);
    const pnBuf = Buffer.alloc(12);
    pnBuf.writeUInt32BE(packetNumber, 8);
    for (let i = 0; i < 12; i++) {
        nonce[i] ^= pnBuf[i];
    }
    const cipher = crypto.createCipheriv('aes-128-gcm', key, nonce);
    cipher.setAAD(header);
    const cipherText = Buffer.concat([cipher.update(payload), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([cipherText, authTag]);
}

/**
 * creates a tls1.3 client hello packet
 * @param {string} hostname the server name
 * @param {string} alpn the alpn
 * @returns {Buffer} the client hello packet
 */
function createClientHello(hostname, alpn = undefined) {
    const buffer = Buffer.alloc(0x100);
    let offset = 0;
    buffer[offset++] = 0x01; // client hello
    const handshakeLengthOffset = offset;
    offset += 3;

    offset = buffer.writeUInt16BE(0x0303, offset); // tls 1.2
    crypto.randomFillSync(buffer.subarray(offset, offset+0x20)); // random
    offset += 0x20;
    buffer[offset++] = 0x00; // session id length

    offset = buffer.writeUInt16BE(0x4, offset);     // cipher suites length
    offset = buffer.writeUInt16BE(0x1301, offset);  // TLS_AES_128_GCM_SHA256
    offset = buffer.writeUInt16BE(0x00ff, offset);  // TLS_EMPTY_RENEGOTIATION_INFO_SCSV
    offset = buffer.writeUInt16BE(0x0100, offset);  // compression methods: none
    
    const extensionsLengthOffset = offset;
    offset += 2;

    // server name
    offset = buffer.writeUInt16BE(0x0000, offset);                  // extension type
    offset = buffer.writeUInt16BE(5 + hostname.length, offset);     // extension length
    offset = buffer.writeUInt16BE(3 + hostname.length, offset);     // server name list length
    buffer[offset++] = 0;                                           // server name type: host name
    offset = buffer.writeUInt16BE(hostname.length, offset);         // server name length
    offset += Buffer.from(hostname, 'utf8').copy(buffer, offset);   // server name

    // supported_versions
    offset = buffer.writeUInt16BE(0x002b, offset);                  // extension type
    offset = buffer.writeUInt16BE(0x0003, offset);                  // extension length
    buffer[offset++] = 0x02;                                        // supported versions length
    offset = buffer.writeUInt16BE(0x0304, offset);                  // tls 1.3

    // application layer protocol negotiation
    if(alpn) {
        offset = buffer.writeUInt16BE(0x10, offset);                // extension type
        offset = buffer.writeUInt16BE(3 + alpn.length, offset);     // extension length
        offset = buffer.writeUInt16BE(1 + alpn.length, offset);     // alpn extension length
        buffer[offset++] = alpn.length;                             // alpn string length
        offset += Buffer.from(alpn, 'utf8').copy(buffer, offset);   // alpn next protocol
    }

    const extensionsLength = offset - extensionsLengthOffset - 2;
    buffer.writeUInt16BE(extensionsLength, extensionsLengthOffset);

    const handshakeLength = offset - handshakeLengthOffset - 3;
    buffer[handshakeLengthOffset] = (handshakeLength >> 16) & 0xff;
    buffer[handshakeLengthOffset + 1] = (handshakeLength >> 8) & 0xff;
    buffer[handshakeLengthOffset + 2] = handshakeLength & 0xff;

    return buffer.subarray(0, offset);
}

/**
 * create a quic connect packet
 * @param {number} packetNumber the packet number
 * @param {string} hostname the server name
 * @returns {Buffer} the packet
 */
function createInitialPacket(packetNumber, hostname) {
    const packetNumberLength = getVarintSize(packetNumber);
    const destConnId = crypto.randomBytes(8);
    const { key, iv, hp } = deriveInitialSecrets(destConnId);

    // create CRYPTO frame
    const payload = Buffer.alloc(0x100);
    let payloadOffset = 0;
    payload[payloadOffset++] = 0x06; // frame type CRYPTO
    payloadOffset = encodeVarint(payload, payloadOffset, 0); // offset = 0
    const clientHello = createClientHello(hostname);
    payloadOffset = encodeVarint(payload, payloadOffset, clientHello.length); // length
    clientHello.copy(payload, payloadOffset);
    payloadOffset += clientHello.length;

    const paddingLength = 1200 - (payloadOffset + 16) - packetNumberLength;
    const actualPayload = Buffer.alloc(payloadOffset + paddingLength);
    payload.copy(actualPayload, 0, 0, payloadOffset);

    const encryptedSize = actualPayload.length + 16;
    const totalLength = packetNumberLength + encryptedSize;

    const header = Buffer.alloc(0x100);
    let headerOffset = 0;
    
    // header byte (long header, fixed bit, packet type initial, reserved, packet number length)
    header[headerOffset++] = 0b11000000 | ((packetNumberLength - 1) & 0x03);
    
    headerOffset = header.writeUInt32BE(0x00000001, headerOffset); // version

    // dest conn id
    header[headerOffset++] = destConnId.length;
    headerOffset += destConnId.copy(header, headerOffset);

    header[headerOffset++] = 0x00; // src conn id
    header[headerOffset++] = 0x00; // token length
    headerOffset = encodeVarint(header, headerOffset, totalLength); // payload length

    // packet number
    const packetNumberOffset = headerOffset;
    header[headerOffset++] = packetNumber;

    const actualHeader = header.subarray(0, headerOffset);
    const encryptedPayload = encryptPayload(actualPayload, key, iv, packetNumber, actualHeader);
    const packet = Buffer.concat([
        actualHeader,
        encryptedPayload
    ]);
    applyHeaderProtection(packet, packetNumberOffset, hp);
    return packet;
}

/**
 * checks if the buffer looks like a quic packet
 * @param {Buffer} buffer the packet
 * @returns {void}
 */
function isQuicResponse(buffer) {
    if (buffer.length < 1) {
        return false;
    }
    const headerByte = buffer[0];
    const isLongHeader = (headerByte & 0x80) !== 0;
    const hasFixedBit = (headerByte & 0x40) !== 0;
    return hasFixedBit && isLongHeader;
}

const quicping = (hostname, type, address, port, timeout) => {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket(type);
        
        let startTime = 0;
        let responded = false;
        let packetNumber = 0;

        const timer = setTimeout(() => {
            if (!responded) {
            socket.close();
            reject(new Error(`Timeout after ${timeout}ms`));
            }
        }, timeout);

        socket.on('error', (err) => {
            clearTimeout(timer);
            responded = true;
            socket.close();
            reject(err);
        });

        socket.on('message', (msg, rinfo) => {
            if (responded) {
                return;
            }
            
            const latency = performance.now() - startTime;
            clearTimeout(timer);
            responded = true;
            const isQuic = isQuicResponse(msg);
            if(!isQuic) {
                reject(new Error("not a quic message"))
            }
            
            socket.close();
            resolve(latency);
        });

        const packet = createInitialPacket(packetNumber, hostname);
        socket.send(packet, 0, packet.length, port, address, (err) => {
            startTime = performance.now();
            if (err) {
                clearTimeout(timer);
                responded = true;
                socket.close();
                reject(err);
            }
        });
    });
};

class QuicMonitorType extends MonitorType {
    name = "quic";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let { host, family } = await this.resolveHost(monitor.hostname);
        const resp = await quicping(monitor.hostname, family, host, monitor.port, TIMEOUT * 1000);
        heartbeat.ping = resp;
        heartbeat.msg = `${Math.round(resp)} ms`;
        heartbeat.status = UP;
    }

    /**
     * resolves a host to its ip family and address
     * @param {string} host the hostname
     * @returns {object} the resolved address
     */
    async resolveHost(host) {
        let family = "udp4";
        if(net.isIPv4(host)) {
            family = "udp4";
        } else if(net.isIPv6(host)) {
            family = "udp6";
        } else {
            try {
                const result = await dns.lookup(host);
                host = result.address;
                family = result.family === 6 ? "udp6" : "udp4";
            } catch (err) {
                throw new Error(`DNS resolution failed for ${host}: ${err.message}`);
            }
        }
        return {host, family};
    }
}

module.exports = {
    QuicMonitorType,
};
