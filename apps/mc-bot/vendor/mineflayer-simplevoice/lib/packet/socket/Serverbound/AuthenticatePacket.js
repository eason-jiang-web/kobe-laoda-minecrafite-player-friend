"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FriendlyByteBuf_1 = require("../../../data/FriendlyByteBuf");
const SocketPacket_1 = require("../SocketPacket");
class ServerboundAuthenticatePacket extends SocketPacket_1.ServerboundSocketPacket {
    constructor(socket) {
        super(socket, 0x5, "AuthenticatePacket");
    }
    serialize(data) {
        const buf = new FriendlyByteBuf_1.FriendlyByteBuf();
        buf.writeUUID(data.playerUUID);
        buf.writeUUID(data.secret);
        return buf;
    }
}
exports.default = ServerboundAuthenticatePacket;
