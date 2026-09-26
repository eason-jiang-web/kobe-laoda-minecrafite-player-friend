"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketPacket_1 = require("../SocketPacket");
class ClientboundKeepAlivePacket extends SocketPacket_1.ClientboundSocketPacket {
    constructor(socket) {
        super(socket, 0x8, "ClientboundKeepAlivePacket");
    }
    deserialize(data) {
        return {};
    }
}
exports.default = ClientboundKeepAlivePacket;
