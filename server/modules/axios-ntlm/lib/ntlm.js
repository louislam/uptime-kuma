'use strict';
// Original file https://raw.githubusercontent.com/elasticio/node-ntlm-client/master/lib/ntlm.js
var os = require('os'), flags = require('./flags'), hash = require('./hash');
var NTLMSIGNATURE = "NTLMSSP\0";
function createType1Message(workstation, target) {
    var dataPos = 32, pos = 0, buf = new Buffer.alloc(1024);
    workstation = workstation === undefined ? os.hostname() : workstation;
    target = target === undefined ? '' : target;
    //signature
    buf.write(NTLMSIGNATURE, pos, NTLMSIGNATURE.length, 'ascii');
    pos += NTLMSIGNATURE.length;
    //message type
    buf.writeUInt32LE(1, pos);
    pos += 4;
    //flags
    buf.writeUInt32LE(flags.NTLMFLAG_NEGOTIATE_OEM |
        flags.NTLMFLAG_REQUEST_TARGET |
        flags.NTLMFLAG_NEGOTIATE_NTLM_KEY |
        flags.NTLMFLAG_NEGOTIATE_NTLM2_KEY |
        flags.NTLMFLAG_NEGOTIATE_ALWAYS_SIGN, pos);
    pos += 4;
    //domain security buffer
    buf.writeUInt16LE(target.length, pos);
    pos += 2;
    buf.writeUInt16LE(target.length, pos);
    pos += 2;
    buf.writeUInt32LE(target.length === 0 ? 0 : dataPos, pos);
    pos += 4;
    if (target.length > 0) {
        dataPos += buf.write(target, dataPos, 'ascii');
    }
    //workstation security buffer
    buf.writeUInt16LE(workstation.length, pos);
    pos += 2;
    buf.writeUInt16LE(workstation.length, pos);
    pos += 2;
    buf.writeUInt32LE(workstation.length === 0 ? 0 : dataPos, pos);
    pos += 4;
    if (workstation.length > 0) {
        dataPos += buf.write(workstation, dataPos, 'ascii');
    }
    return 'NTLM ' + buf.toString('base64', 0, dataPos);
}
function decodeType2Message(str) {
    if (str === undefined) {
        throw new Error('Invalid argument');
    }
    //convenience
    if (Object.prototype.toString.call(str) !== '[object String]') {
        if (str.hasOwnProperty('headers') && str.headers.hasOwnProperty('www-authenticate')) {
            str = str.headers['www-authenticate'];
        }
        else {
            throw new Error('Invalid argument');
        }
    }
    var ntlmMatch = /^NTLM ([^,\s]+)/.exec(str);
    if (ntlmMatch) {
        str = ntlmMatch[1];
    }
    var buf = new Buffer.from(str, 'base64'), obj = {};
    //check signature
    if (buf.toString('ascii', 0, NTLMSIGNATURE.length) !== NTLMSIGNATURE) {
        throw new Error('Invalid message signature: ' + str);
    }
    //check message type
    if (buf.readUInt32LE(NTLMSIGNATURE.length) !== 2) {
        throw new Error('Invalid message type (no type 2)');
    }
    //read flags
    obj.flags = buf.readUInt32LE(20);
    obj.encoding = (obj.flags & flags.NTLMFLAG_NEGOTIATE_OEM) ? 'ascii' : 'ucs2';
    obj.version = (obj.flags & flags.NTLMFLAG_NEGOTIATE_NTLM2_KEY) ? 2 : 1;
    obj.challenge = buf.slice(24, 32);
    //read target name
    obj.targetName = (function () {
        var length = buf.readUInt16LE(12);
        //skipping allocated space
        var offset = buf.readUInt32LE(16);
        if (length === 0) {
            return '';
        }
        if ((offset + length) > buf.length || offset < 32) {
            throw new Error('Bad type 2 message');
        }
        return buf.toString(obj.encoding, offset, offset + length);
    })();
    //read target info
    if (obj.flags & flags.NTLMFLAG_NEGOTIATE_TARGET_INFO) {
        obj.targetInfo = (function () {
            var info = {};
            var length = buf.readUInt16LE(40);
            //skipping allocated space
            var offset = buf.readUInt32LE(44);
            var targetInfoBuffer = new Buffer.alloc(length);
            buf.copy(targetInfoBuffer, 0, offset, offset + length);
            if (length === 0) {
                return info;
            }
            if ((offset + length) > buf.length || offset < 32) {
                throw new Error('Bad type 2 message');
            }
            var pos = offset;
            while (pos < (offset + length)) {
                var blockType = buf.readUInt16LE(pos);
                pos += 2;
                var blockLength = buf.readUInt16LE(pos);
                pos += 2;
                if (blockType === 0) {
                    //reached the terminator subblock
                    break;
                }
                var blockTypeStr = void 0;
                switch (blockType) {
                    case 1:
                        blockTypeStr = 'SERVER';
                        break;
                    case 2:
                        blockTypeStr = 'DOMAIN';
                        break;
                    case 3:
                        blockTypeStr = 'FQDN';
                        break;
                    case 4:
                        blockTypeStr = 'DNS';
                        break;
                    case 5:
                        blockTypeStr = 'PARENT_DNS';
                        break;
                    default:
                        blockTypeStr = '';
                        break;
                }
                if (blockTypeStr) {
                    info[blockTypeStr] = buf.toString('ucs2', pos, pos + blockLength);
                }
                pos += blockLength;
            }
            return {
                parsed: info,
                buffer: targetInfoBuffer
            };
        })();
    }
    return obj;
}
function createType3Message(type2Message, username, password, workstation, target) {
    var dataPos = 52, buf = new Buffer.alloc(1024);
    if (workstation === undefined) {
        workstation = os.hostname();
    }
    if (target === undefined) {
        target = type2Message.targetName;
    }
    //signature
    buf.write(NTLMSIGNATURE, 0, NTLMSIGNATURE.length, 'ascii');
    //message type
    buf.writeUInt32LE(3, 8);
    if (type2Message.version === 2) {
        dataPos = 64;
        var ntlmHash = hash.createNTLMHash(password), nonce = hash.createPseudoRandomValue(16), lmv2 = hash.createLMv2Response(type2Message, username, ntlmHash, nonce, target), ntlmv2 = hash.createNTLMv2Response(type2Message, username, ntlmHash, nonce, target);
        //lmv2 security buffer
        buf.writeUInt16LE(lmv2.length, 12);
        buf.writeUInt16LE(lmv2.length, 14);
        buf.writeUInt32LE(dataPos, 16);
        lmv2.copy(buf, dataPos);
        dataPos += lmv2.length;
        //ntlmv2 security buffer
        buf.writeUInt16LE(ntlmv2.length, 20);
        buf.writeUInt16LE(ntlmv2.length, 22);
        buf.writeUInt32LE(dataPos, 24);
        ntlmv2.copy(buf, dataPos);
        dataPos += ntlmv2.length;
    }
    else {
        var lmHash = hash.createLMHash(password), ntlmHash = hash.createNTLMHash(password), lm = hash.createLMResponse(type2Message.challenge, lmHash), ntlm = hash.createNTLMResponse(type2Message.challenge, ntlmHash);
        //lm security buffer
        buf.writeUInt16LE(lm.length, 12);
        buf.writeUInt16LE(lm.length, 14);
        buf.writeUInt32LE(dataPos, 16);
        lm.copy(buf, dataPos);
        dataPos += lm.length;
        //ntlm security buffer
        buf.writeUInt16LE(ntlm.length, 20);
        buf.writeUInt16LE(ntlm.length, 22);
        buf.writeUInt32LE(dataPos, 24);
        ntlm.copy(buf, dataPos);
        dataPos += ntlm.length;
    }
    //target name security buffer
    buf.writeUInt16LE(type2Message.encoding === 'ascii' ? target.length : target.length * 2, 28);
    buf.writeUInt16LE(type2Message.encoding === 'ascii' ? target.length : target.length * 2, 30);
    buf.writeUInt32LE(dataPos, 32);
    dataPos += buf.write(target, dataPos, type2Message.encoding);
    //user name security buffer
    buf.writeUInt16LE(type2Message.encoding === 'ascii' ? username.length : username.length * 2, 36);
    buf.writeUInt16LE(type2Message.encoding === 'ascii' ? username.length : username.length * 2, 38);
    buf.writeUInt32LE(dataPos, 40);
    dataPos += buf.write(username, dataPos, type2Message.encoding);
    //workstation name security buffer
    buf.writeUInt16LE(type2Message.encoding === 'ascii' ? workstation.length : workstation.length * 2, 44);
    buf.writeUInt16LE(type2Message.encoding === 'ascii' ? workstation.length : workstation.length * 2, 46);
    buf.writeUInt32LE(dataPos, 48);
    dataPos += buf.write(workstation, dataPos, type2Message.encoding);
    if (type2Message.version === 2) {
        //session key security buffer
        buf.writeUInt16LE(0, 52);
        buf.writeUInt16LE(0, 54);
        buf.writeUInt32LE(0, 56);
        //flags
        buf.writeUInt32LE(type2Message.flags, 60);
    }
    return 'NTLM ' + buf.toString('base64', 0, dataPos);
}
module.exports = {
    createType1Message: createType1Message,
    decodeType2Message: decodeType2Message,
    createType3Message: createType3Message
};
//# sourceMappingURL=ntlm.js.map