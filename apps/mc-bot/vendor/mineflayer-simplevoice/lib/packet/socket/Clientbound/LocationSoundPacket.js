"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketPacket_1 = require("../SocketPacket");
const HAS_CATEGORY_MASK = 0b10;
class ClientboundLocationSoundPacket extends SocketPacket_1.ClientboundSocketPacket {
    constructor(socket) {
        super(socket, 0x4, "ClientboundLocationSoundPacket");
    }
    hasFlag(data, mask) {
        return (data & mask) !== 0;
    }
    deserialize(data) {
        const soundPacket = {
            channelId: data.readUUID(),
            sender: data.readUUID(),
            location: {
                x: data.readDouble(),
                y: data.readDouble(),
                z: data.readDouble(),
            },
            data: data.readByteArray(),
            sequenceNumber: data.readLong(),
            distance: data.readFloat(),
        };
        const flags = data.readByte();
        if (this.hasFlag(flags, HAS_CATEGORY_MASK)) {
            soundPacket.category = data.readUtf(16);
        }
        return soundPacket;
    }
}
exports.default = ClientboundLocationSoundPacket;
