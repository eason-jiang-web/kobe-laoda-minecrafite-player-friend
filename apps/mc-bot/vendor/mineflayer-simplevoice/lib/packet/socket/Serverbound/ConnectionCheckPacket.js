"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FriendlyByteBuf_1 = require("../../../data/FriendlyByteBuf");
const SocketPacket_1 = require("../SocketPacket");
class ServerboundConnectionCheckPacket extends SocketPacket_1.ServerboundSocketPacket {
    constructor(socket) {
        super(socket, 0x9, "ServerboundConnectionCheckPacket");
    }
    serialize() {
        return new FriendlyByteBuf_1.FriendlyByteBuf();
    }
}
exports.default = ServerboundConnectionCheckPacket;
