"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Packet_1 = require("../Packet");
class ClientboundSecretPacket extends Packet_1.ClientboundPacket {
    constructor(bot) {
        super(bot, "voicechat:secret", "ClientboundSecretPacket");
    }
    deserialize(packet) {
        const secret = packet.readUUID();
        const serverPort = packet.readInt();
        const playerUUID = packet.readUUID();
        const codec = packet.readByte();
        const mtuSize = packet.readInt();
        const voiceChatDistance = packet.readDouble();
        const keepAlive = packet.readInt();
        const groupsEnabled = packet.readBoolean();
        const voiceHost = packet.readUtf();
        const allowRecording = packet.readBoolean();
        return {
            secret: secret,
            serverPort: serverPort,
            playerUUID: playerUUID,
            codec: codec,
            mtuSize: mtuSize,
            voiceChatDistance: voiceChatDistance,
            keepAlive: keepAlive,
            groupsEnabled: groupsEnabled,
            voiceHost: voiceHost,
            allowRecording: allowRecording,
        };
    }
}
exports.default = ClientboundSecretPacket;
