"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketPacket_1 = require("../SocketPacket");
class ClientboundConnectionCheckAckPacket extends SocketPacket_1.ClientboundSocketPacket {
    constructor(socket) {
        super(socket, 0xa, "ClientboundConnectionCheckAckPacket");
    }
    deserialize(data) {
        return {};
    }
}
exports.default = ClientboundConnectionCheckAckPacket;
