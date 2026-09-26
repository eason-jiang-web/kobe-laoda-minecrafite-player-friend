"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Packet_1 = require("../Packet");
class ClientboundAddGroupPacket extends Packet_1.ClientboundPacket {
    constructor(bot) {
        super(bot, "voicechat:add_group", "ClientboundAddGroupPacket");
    }
    deserialize(data) {
        return {
            id: data.readUUID(),
            name: data.readUtf(512),
            hasPassword: data.readBoolean(),
            persistent: data.readBoolean(),
            hidden: data.readBoolean(),
            type: data.readShort(),
        };
    }
}
exports.default = ClientboundAddGroupPacket;
