import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundPacket } from "../Packet";
export type ClientboundSecretPacketData = {
    secret: UUID;
    serverPort: number;
    playerUUID: UUID;
    codec: number;
    mtuSize: number;
    voiceChatDistance: number;
    keepAlive: number;
    groupsEnabled: boolean;
    voiceHost: string;
    allowRecording: boolean;
};
export default class ClientboundSecretPacket extends ClientboundPacket<ClientboundSecretPacketData> {
    constructor(bot: Bot);
    deserialize(packet: FriendlyByteBuf): ClientboundSecretPacketData;
}
