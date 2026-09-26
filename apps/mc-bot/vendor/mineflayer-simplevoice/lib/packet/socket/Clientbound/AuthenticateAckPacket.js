"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketPacket_1 = require("../SocketPacket");
class ClientboundAuthenticateAckPacket extends SocketPacket_1.ClientboundSocketPacket {
    constructor(socket) {
        super(socket, 0x6, "ClientboundAuthenticateAckPacket");
    }
    deserialize(data) {
        return {};
    }
}
exports.default = ClientboundAuthenticateAckPacket;
