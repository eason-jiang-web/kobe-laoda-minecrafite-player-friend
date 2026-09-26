"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = void 0;
var Utils;
(function (Utils) {
    function uuidToString(uuid) {
        const mostHex = (uuid.mostSignificantBits & 0xffffffffffffffffn)
            .toString(16)
            .padStart(16, "0");
        const leastHex = (uuid.leastSignificantBits & 0xffffffffffffffffn)
            .toString(16)
            .padStart(16, "0");
        return (mostHex.substring(0, 8) +
            "-" +
            mostHex.substring(8, 12) +
            "-" +
            mostHex.substring(12, 16) +
            "-" +
            leastHex.substring(0, 4) +
            "-" +
            leastHex.substring(4, 16));
    }
    Utils.uuidToString = uuidToString;
    function stringToUUID(uuidString) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(uuidString)) {
            throw new Error("Invalid UUID string format");
        }
        const hex = uuidString.replace(/-/g, "");
        let mostSignificantBits = BigInt(`0x${hex.substring(0, 16)}`);
        let leastSignificantBits = BigInt(`0x${hex.substring(16, 32)}`);
        if (mostSignificantBits >= 2n ** 63n) {
            mostSignificantBits -= 2n ** 64n;
        }
        if (leastSignificantBits >= 2n ** 63n) {
            leastSignificantBits -= 2n ** 64n;
        }
        return {
            mostSignificantBits,
            leastSignificantBits,
        };
    }
    Utils.stringToUUID = stringToUUID;
})(Utils || (exports.Utils = Utils = {}));
