"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FriendlyByteBuf_1 = require("../../../data/FriendlyByteBuf");
const Packet_1 = require("../Packet");
class ServerboundSetGroupPacket extends Packet_1.ServerboundPacket {
    constructor(bot) {
        super(bot, "voicechat:set_group", "ServerboundSetGroupPacket");
    }
    serialize(data) {
        const packet = new FriendlyByteBuf_1.FriendlyByteBuf();
        packet.writeUUID(data.group);
        packet.writeBoolean(data.password != undefined);
        if (data.password) {
            packet.writeUtf(data.password);
        }
        return packet;
    }
}
exports.default = ServerboundSetGroupPacket;
