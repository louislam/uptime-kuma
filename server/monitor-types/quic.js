const { MonitorType } = require("./monitor-type");
const { UP, PING_GLOBAL_TIMEOUT_DEFAULT: TIMEOUT } = require("../../src/util");
const dgram = require('dgram');
const crypto = require('crypto');
const dns = require("dns").promises;
const net = require('net');

/**
 * create a quic connect packet
 * this packet will fail to decrypt, the server sends a retry packet
 * this is the only way to get a ping in quic because the PING frame is only allowed after the handshake
 * nodejs quic is still experimental so until it is not this is the most reliable method of pinging
 * @returns {Buffer} the packet
 */
function createInitialPacket() {
    const buffer = Buffer.alloc(1200);
    let offset = 0;

    // header
    buffer[offset++] = 0xc0; // 11000000 (long header, fixed bit)
    buffer.writeUInt32BE(0x00000001, offset); // version
    offset += 4;

    // dest conn id length
    const destConnIdLength = 8;
    buffer[offset++] = destConnIdLength;

    // dest conn id
    const destConnId = crypto.randomBytes(destConnIdLength);
    destConnId.copy(buffer, offset);
    offset += destConnIdLength;

    // src conn id length
    buffer[offset++] = 0x00;

    // token length
    buffer[offset++] = 0x00;

    // length
    const remainingLength = 1200 - offset - 2;
    buffer[offset++] = 0x40 | ((remainingLength >> 8) & 0x3f);
    buffer[offset++] = remainingLength & 0xff;

    // packet number
    buffer[offset++] = 0x00;

    // payload frame type CRYPTO
    buffer[offset++] = 0x06;

    // offset
    buffer[offset++] = 0x00;

    // crypto payload length
    buffer[offset++] = 0;

    // padding
    buffer.fill(0, offset);
    return buffer;
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

const quicping = (type, hostname, port, timeout) => {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket(type);
        
        let startTime = 0;
        let responded = false;

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

        const packet = createInitialPacket();
        socket.send(packet, 0, packet.length, port, hostname, (err) => {
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
        const resp = await quicping(family, host, monitor.port, TIMEOUT * 1000);
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
