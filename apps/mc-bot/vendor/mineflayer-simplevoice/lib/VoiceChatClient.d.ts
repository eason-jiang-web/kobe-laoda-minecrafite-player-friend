import { OpusEncoder } from "./opus-shim";
import { Bot } from "mineflayer";
import ClientboundAddGroupPacket, { ClientboundAddGroupPacketData } from "./packet/client/Clientbound/AddGroupPacket";
import ClientboundJoinedGroupPacket from "./packet/client/Clientbound/JoinedGroupPacket";
import ClientboundPlayerStatePacket, { ClientboundPlayerStatePacketData } from "./packet/client/Clientbound/PlayerStatePacket";
import ClientboundPlayerStatesPacket from "./packet/client/Clientbound/PlayerStatesPacket";
import ClientboundRemoveGroupPacket from "./packet/client/Clientbound/RemoveGroupPacket";
import ClientboundSecretPacket from "./packet/client/Clientbound/SecretPacket";
import ServerboundLeaveGroupPacket from "./packet/client/Serverbound/LeaveGroupPacket";
import ServerboundRequestSecretPacket from "./packet/client/Serverbound/RequestSecretPacket";
import ServerboundSetGroupPacket from "./packet/client/Serverbound/SetGroupPacket";
import SimpleVoiceSocketClient from "./VoiceChatSocketClient";
interface PacketRegistry {
    requestSecretPacket: ServerboundRequestSecretPacket;
    secretPacket: ClientboundSecretPacket;
    playerStatePacket: ClientboundPlayerStatePacket;
    playerStatesPacket: ClientboundPlayerStatesPacket;
    addGroupPacket: ClientboundAddGroupPacket;
    setGroupPacket: ServerboundSetGroupPacket;
    removeGroupPacket: ClientboundRemoveGroupPacket;
    leaveGroupPacket: ServerboundLeaveGroupPacket;
    joinedGroupPacket: ClientboundJoinedGroupPacket;
}
export default class VoiceChatClient {
    private readonly bot;
    private readonly compatibilityVersion;
    private readonly socketClient;
    private readonly logger;
    readonly opusEncoder: OpusEncoder;
    private readonly packets;
    private connected;
    private players;
    private groups;
    constructor(bot: Bot);
    getSocketClient(): SimpleVoiceSocketClient;
    isConnected(): boolean;
    getPlayers(): Map<string, ClientboundPlayerStatePacketData>;
    getGroups(): Map<string, ClientboundAddGroupPacketData>;
    getNameBySenderID(senderID: string): string | undefined;
    getIdByName(username: string): string | undefined;
    private initializePackets;
    getPackets(): PacketRegistry;
    private registerChannels;
    private setupEvents;
    private setupSocketEvents;
}
export {};
