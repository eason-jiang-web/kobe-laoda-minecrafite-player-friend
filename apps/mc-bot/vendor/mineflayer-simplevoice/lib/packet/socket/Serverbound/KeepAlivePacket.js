"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FriendlyByteBuf_1 = require("../../../data/FriendlyByteBuf");
const SocketPacket_1 = require("../SocketPacket");
class ServerboundKeepAlivePacket extends SocketPacket_1.ServerboundSocketPacket {
    constructor(socket) {
        super(socket, 0x8, "ServerboundKeepAlivePacket");
    }
    serialize() {
        return new FriendlyByteBuf_1.FriendlyByteBuf();
    }
}
exports.default = ServerboundKeepAlivePacket;
