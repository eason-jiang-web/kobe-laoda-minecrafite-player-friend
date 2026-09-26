"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FriendlyByteBuf_1 = require("../../../data/FriendlyByteBuf");
const SocketPacket_1 = require("../SocketPacket");
class ServerboundMicPacket extends SocketPacket_1.ServerboundSocketPacket {
    constructor(socket) {
        super(socket, 0x1, "MicPacket");
    }
    serialize(data) {
        const buf = new FriendlyByteBuf_1.FriendlyByteBuf();
        buf.writeByteArray(data.data);
        buf.writeLong(data.sequenceNumber);
        buf.writeBoolean(data.whispering);
        return buf;
    }
}
exports.default = ServerboundMicPacket;
