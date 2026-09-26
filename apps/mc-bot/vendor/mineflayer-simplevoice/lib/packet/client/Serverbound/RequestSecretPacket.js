"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FriendlyByteBuf_1 = require("../../../data/FriendlyByteBuf");
const Packet_1 = require("../Packet");
class ServerboundRequestSecretPacket extends Packet_1.ServerboundPacket {
    constructor(bot) {
        super(bot, "voicechat:request_secret", "ServerboundRequestSecretPacket");
    }
    serialize(data) {
        const packet = new FriendlyByteBuf_1.FriendlyByteBuf();
        packet.writeInt(data.compatibilityVersion);
        return packet;
    }
}
exports.default = ServerboundRequestSecretPacket;
