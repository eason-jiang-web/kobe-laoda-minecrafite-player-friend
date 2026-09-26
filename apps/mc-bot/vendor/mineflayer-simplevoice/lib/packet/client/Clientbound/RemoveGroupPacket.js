"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Packet_1 = require("../Packet");
class ClientboundRemoveGroupPacket extends Packet_1.ClientboundPacket {
    constructor(bot) {
        super(bot, "voicechat:remove_group", "ClientboundRemoveGroupPacket");
    }
    deserialize(data) {
        return {
            id: data.readUUID(),
        };
    }
}
exports.default = ClientboundRemoveGroupPacket;
