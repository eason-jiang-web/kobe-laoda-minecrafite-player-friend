"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AESEncryption = void 0;
const crypto_1 = __importDefault(require("crypto"));
const StoredData_1 = require("./StoredData");
var AESEncryption;
(function (AESEncryption) {
    function encrypt(data) {
        if (!StoredData_1.StoredData.secretPacketData.secret)
            throw new Error("Not initialized");
        const iv = crypto_1.default.randomBytes(16);
        // Convert UUID to a 16-byte buffer by combining most and least significant bits
        const uuidBuffer = Buffer.alloc(16);
        uuidBuffer.writeBigInt64BE(StoredData_1.StoredData.secretPacketData.secret.mostSignificantBits, 0);
        uuidBuffer.writeBigInt64BE(StoredData_1.StoredData.secretPacketData.secret.leastSignificantBits, 8);
        const cipher = crypto_1.default.createCipheriv("aes-128-cbc", uuidBuffer, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        return Buffer.concat([iv, encrypted]);
    }
    AESEncryption.encrypt = encrypt;
    function decrypt(encryptedData) {
        if (!StoredData_1.StoredData.secretPacketData.secret)
            throw new Error("Not initialized");
        // Extract IV from the first 16 bytes
        const iv = encryptedData.subarray(0, 16);
        const data = encryptedData.subarray(16);
        // Convert UUID to a 16-byte buffer by combining most and least significant bits
        const uuidBuffer = Buffer.alloc(16);
        uuidBuffer.writeBigInt64BE(StoredData_1.StoredData.secretPacketData.secret.mostSignificantBits, 0);
        uuidBuffer.writeBigInt64BE(StoredData_1.StoredData.secretPacketData.secret.leastSignificantBits, 8);
        const decipher = crypto_1.default.createDecipheriv("aes-128-cbc", uuidBuffer, iv);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    }
    AESEncryption.decrypt = decrypt;
})(AESEncryption || (exports.AESEncryption = AESEncryption = {}));
