import dgram from "dgram";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundSocketPacket } from "../SocketPacket";
export type PlayerSoundPacketData = {
    channelId: UUID;
    sender: UUID;
    data: Uint8Array<ArrayBufferLike>;
    sequenceNumber: bigint;
    distance: number;
    whispering: boolean;
    category?: string;
};
export default class ClientboundPlayerSoundPacket extends ClientboundSocketPacket<PlayerSoundPacketData> {
    constructor(socket: dgram.Socket);
    protected hasFlag(data: number, mask: number): boolean;
    deserialize(data: FriendlyByteBuf): PlayerSoundPacketData;
}
