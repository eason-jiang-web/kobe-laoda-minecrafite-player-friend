"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Packet_1 = require("../Packet");
class ClientboundJoinedGroupPacket extends Packet_1.ClientboundPacket {
    constructor(bot) {
        super(bot, "voicechat:joined_group", "ClientboundJoinedGroupPacket");
    }
    deserialize(data) {
        return {
            id: data.readBoolean() ? data.readUUID() : undefined,
            wrongPassword: data.readBoolean(),
        };
    }
}
exports.default = ClientboundJoinedGroupPacket;
