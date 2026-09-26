"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketPacket_1 = require("../SocketPacket");
class ClientboundPingPacket extends SocketPacket_1.ClientboundSocketPacket {
    constructor(socket) {
        super(socket, 0x7, "ClientboundPingPacket");
    }
    deserialize(data) {
        return {};
    }
}
exports.default = ClientboundPingPacket;
