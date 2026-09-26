"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FriendlyByteBuf_1 = require("../../../data/FriendlyByteBuf");
const Packet_1 = require("../Packet");
class ServerboundLeaveGroupPacket extends Packet_1.ServerboundPacket {
    constructor(bot) {
        super(bot, "voicechat:leave_group", "ServerboundLeaveGroupPacket");
    }
    serialize() {
        const packet = new FriendlyByteBuf_1.FriendlyByteBuf();
        return packet;
    }
}
exports.default = ServerboundLeaveGroupPacket;
