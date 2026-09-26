"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Packet_1 = require("../Packet");
class ClientboundPlayerStatePacket extends Packet_1.ClientboundPacket {
    constructor(bot) {
        super(bot, "voicechat:player_state", "ClientboundPlayerStatePacket");
    }
    deserialize(data) {
        return {
            disabled: data.readBoolean(),
            disconnected: data.readBoolean(),
            playerUUID: data.readUUID(),
            name: data.readUtf(),
            group: data.readBoolean() ? data.readUUID() : undefined,
        };
    }
}
exports.default = ClientboundPlayerStatePacket;
