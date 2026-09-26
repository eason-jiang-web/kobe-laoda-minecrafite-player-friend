"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketPacket_1 = require("../SocketPacket");
const HAS_CATEGORY_MASK = 0b10;
class ClientboundGroupSoundPacket extends SocketPacket_1.ClientboundSocketPacket {
    constructor(socket) {
        super(socket, 0x3, "GroupSoundPacket");
    }
    hasFlag(data, mask) {
        return (data & mask) !== 0;
    }
    deserialize(data) {
        const soundPacket = {
            channelId: data.readUUID(),
            sender: data.readUUID(),
            data: data.readByteArray(),
            sequenceNumber: data.readLong(),
        };
        const flags = data.readByte();
        if (this.hasFlag(flags, HAS_CATEGORY_MASK)) {
            soundPacket.category = data.readUtf(16);
        }
        return soundPacket;
    }
}
exports.default = ClientboundGroupSoundPacket;
