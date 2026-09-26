"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../../../utils");
const Packet_1 = require("../Packet");
class ClientboundPlayerStatesPacket extends Packet_1.ClientboundPacket {
    constructor(bot) {
        super(bot, "voicechat:player_states", "ClientboundPlayerStatesPacket");
    }
    deserialize(data) {
        const list = new Map();
        const amount = data.readInt();
        for (let i = 0; i < amount; i++) {
            const playerState = {
                disabled: data.readBoolean(),
                disconnected: data.readBoolean(),
                playerUUID: data.readUUID(),
                name: data.readUtf(),
                group: data.readBoolean() ? data.readUUID() : undefined,
            };
            list.set(utils_1.Utils.uuidToString(playerState.playerUUID), playerState);
        }
        return list;
    }
}
exports.default = ClientboundPlayerStatesPacket;
