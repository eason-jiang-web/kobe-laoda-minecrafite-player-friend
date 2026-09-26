import dgram from "dgram";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundSocketPacket } from "../SocketPacket";
export type GroupSoundPacketData = {
    channelId: UUID;
    sender: UUID;
    data: Uint8Array<ArrayBufferLike>;
    sequenceNumber: bigint;
    category?: string;
};
export default class ClientboundGroupSoundPacket extends ClientboundSocketPacket<GroupSoundPacketData> {
    constructor(socket: dgram.Socket);
    protected hasFlag(data: number, mask: number): boolean;
    deserialize(data: FriendlyByteBuf): GroupSoundPacketData;
}
