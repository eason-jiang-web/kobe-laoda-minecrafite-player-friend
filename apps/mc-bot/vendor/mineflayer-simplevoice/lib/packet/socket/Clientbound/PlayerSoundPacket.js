"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketPacket_1 = require("../SocketPacket");
const WHISPER_MASK = 0b1;
const HAS_CATEGORY_MASK = 0b10;
class ClientboundPlayerSoundPacket extends SocketPacket_1.ClientboundSocketPacket {
    constructor(socket) {
        super(socket, 0x2, "ClientboundPlayerSoundPacket");
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
            distance: data.readFloat(),
            whispering: false,
        };
        const flags = data.readByte();
        soundPacket.whispering = this.hasFlag(flags, WHISPER_MASK);
        if (this.hasFlag(flags, HAS_CATEGORY_MASK)) {
            soundPacket.category = data.readUtf(16);
        }
        return soundPacket;
    }
}
exports.default = ClientboundPlayerSoundPacket;
