import dgram from "dgram";
import { EventEmitter } from "events";
import { Bot } from "mineflayer";
import ClientboundAuthenticateAckPacket from "./packet/socket/Clientbound/AuthenticateAckPacket";
import ClientboundConnectionCheckAckPacket from "./packet/socket/Clientbound/ConnectionCheckAckPacket";
import ClientboundGroupSoundPacket from "./packet/socket/Clientbound/GroupSoundPacket";
import ClientboundKeepAlivePacket from "./packet/socket/Clientbound/KeepAlivePacket";
import ClientboundLocationSoundPacket from "./packet/socket/Clientbound/LocationSoundPacket";
import ClientboundPingPacket from "./packet/socket/Clientbound/PingPacket";
import ClientboundPlayerSoundPacket from "./packet/socket/Clientbound/PlayerSoundPacket";
import ServerboundAuthenticatePacket from "./packet/socket/Serverbound/AuthenticatePacket";
import ServerboundConnectionCheckPacket from "./packet/socket/Serverbound/ConnectionCheckPacket";
import ServerboundKeepAlivePacket from "./packet/socket/Serverbound/KeepAlivePacket";
import ServerboundMicPacket from "./packet/socket/Serverbound/MicPacket";
import ServerboundPingPacket from "./packet/socket/Serverbound/PingPacket";
interface PacketRegistry {
    authenticatePacket: ServerboundAuthenticatePacket;
    authenticateAckPacket: ClientboundAuthenticateAckPacket;
    connectionCheckPacket: ServerboundConnectionCheckPacket;
    connectionCheckAckPacket: ClientboundConnectionCheckAckPacket;
    pingPacket: ClientboundPingPacket;
    clientboundKeepAlivePacket: ClientboundKeepAlivePacket;
    serverboundKeepAlivePacket: ServerboundKeepAlivePacket;
    clientboundPingPacket: ClientboundPingPacket;
    serverboundPingPacket: ServerboundPingPacket;
    playerSoundPacket: ClientboundPlayerSoundPacket;
    groupSoundPacket: ClientboundGroupSoundPacket;
    locationSoundPacket: ClientboundLocationSoundPacket;
    micPacket: ServerboundMicPacket;
}
export default class VoiceChatSocketClient extends EventEmitter {
    private readonly bot;
    private socket?;
    private packets;
    private readonly logger;
    constructor(bot: Bot);
    connect(): void;
    getSocket(): dgram.Socket | undefined;
    isConnected(): boolean;
    close(): void;
    getPackets(): PacketRegistry;
    private setupSocketListeners;
    private initializePackets;
}
export {};
